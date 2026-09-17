import type {
  CompactionService,
  ContextLedgerFactory,
  InitializeOptions,
  ProviderToolCall,
  RetryService,
  RuntimeContext,
  RuntimeContextLedger,
  RuntimeEvent,
  RuntimeTool,
  SessionID,
  StreamingProvider,
  SubagentRunnerContext,
  SubagentSupport,
  SubagentsService,
} from "../context";
import { TokenMeter } from "@natalia/runtime";
import { createInitializeRuntime } from "./runtime";

export async function createSubagentSupport(
  ctx: RuntimeContext,
  _options: InitializeOptions,
): Promise<SubagentSupport> {
  const scope = createInitializeRuntime(ctx);
  const subagents = scope.resolveService<SubagentsService>(
    scope.SUBAGENTS_SERVICE,
  );
  const contextLedgerFactory = scope.resolveService<ContextLedgerFactory>(
    scope.CONTEXT_LEDGER_FACTORY_SERVICE,
  );
  if (!contextLedgerFactory)
    throw new Error("context ledger unavailable (natalia-context-ledger)");
  const resolvedContextLedgerFactory = contextLedgerFactory;
  const compactionService = scope.resolveService<CompactionService>(
    scope.COMPACTION_SERVICE,
  );
  if (!compactionService)
    throw new Error("compaction service unavailable (natalia-compaction)");
  const resolvedCompactionService = compactionService;
  const retryService = scope.resolveService<RetryService>(scope.RETRY_SERVICE);
  if (!retryService)
    throw new Error("retry service unavailable (natalia-retry)");
  const resolvedRetryService = retryService;
  let sandboxedSubagentActive = 0;
  const sandboxedSubagentWaiters: Array<{
    resume: () => void;
    signal: AbortSignal;
    abort: () => void;
  }> = [];
  async function acquireSandboxedSubagentSlot(signal: AbortSignal) {
    const limit = scope.tsRuntimeConfig?.team?.maxConcurrent ?? 4;
    if (signal.aborted)
      throw new DOMException("subagent cancelled", "AbortError");
    if (sandboxedSubagentActive >= limit) {
      await new Promise<void>((resolve, reject) => {
        const waiter = {
          signal,
          resume: () => {
            signal.removeEventListener("abort", waiter.abort);
            // Transfer the released slot before waking the waiter so a new
            // spawn cannot steal it between promise resolution and resume.
            sandboxedSubagentActive++;
            resolve();
          },
          abort: () => {
            const index = sandboxedSubagentWaiters.indexOf(waiter);
            if (index >= 0) sandboxedSubagentWaiters.splice(index, 1);
            reject(new DOMException("subagent cancelled", "AbortError"));
          },
        };
        sandboxedSubagentWaiters.push(waiter);
        signal.addEventListener("abort", waiter.abort, { once: true });
        // Cover cancellation between the pre-wait check and listener setup.
        if (signal.aborted) waiter.abort();
      });
      return;
    }
    sandboxedSubagentActive++;
  }
  function releaseSandboxedSubagentSlot() {
    sandboxedSubagentActive--;
    while (sandboxedSubagentWaiters.length) {
      const waiter = sandboxedSubagentWaiters.shift()!;
      if (waiter.signal.aborted) continue;
      waiter.resume();
      break;
    }
  }
  function publishSubagentEvent(
    runner: SubagentRunnerContext,
    event: RuntimeEvent,
  ) {
    const parentSessionID = subagents?.get(runner.agentId)?.parentSessionID as
      | SessionID
      | undefined;
    scope.publishForSession(
      parentSessionID
        ? scope.executionBySession.get(parentSessionID)
        : scope.activeExec,
      parentSessionID && event.sessionID === undefined
        ? { ...event, sessionID: parentSessionID, agentID: runner.agentId }
        : { ...event, agentID: runner.agentId },
    );
  }
  function subagentTurnID(runner: SubagentRunnerContext) {
    const continuation = subagents?.get(runner.agentId)?.continuation ?? 0;
    return continuation
      ? `subagent:${runner.agentId}:continuation:${continuation}`
      : `subagent:${runner.agentId}`;
  }
  function beginSubagentConversation(
    runner: SubagentRunnerContext,
    task: string,
  ) {
    const id = subagentTurnID(runner);
    const parentSessionID = subagents?.get(runner.agentId)?.parentSessionID as
      | SessionID
      | undefined;
    if (parentSessionID) scope.turnSession.set(id, parentSessionID);
    scope.turnAgent.set(id, runner.agentId);
    publishSubagentEvent(runner, {
      type: "turn.submitted",
      id,
      text: task,
      byteLength: new TextEncoder().encode(task).byteLength,
      lineCount: scope.lineCount(task),
      sha256: scope.createHash("sha256").update(task).digest("hex"),
    });
    publishSubagentEvent(runner, { type: "turn.started", id });
  }
  function finishSubagentConversation(
    runner: SubagentRunnerContext,
    stopReason: "done" | "cancelled" | "error",
  ) {
    const id = subagentTurnID(runner);
    publishSubagentEvent(runner, {
      type: "turn.finished",
      id,
      stopReason,
    });
    scope.turnSession.delete(id);
    scope.turnAgent.delete(id);
  }
  function createSubagentContext(
    system: string,
    task: string,
    planPointer?: { planID: string; documentPath: string; version: number },
  ) {
    const ledger = resolvedContextLedgerFactory.create();
    ledger.add({ id: "system", role: "system", content: system });
    ledger.add({ id: "task", role: "user", content: task });
    // ADR D4/B2: the plan正文 is never injected — the subagent reads the plan
    // file itself with read_file. Only the low-churn pointer (planID + path +
    // version) travels as a `<runtime_context source="plan_ptr">` user
    // message, so the subagent can find and read the current plan.
    if (planPointer)
      ledger.add({
        id: "plan_ptr",
        role: "dynamic",
        content: `<runtime_context source="plan_ptr" trust="runtime" revision="1">\nThe session has an active plan you must follow:\nplanID: ${planPointer.planID} · version: ${planPointer.version}\npath: ${planPointer.documentPath}\nRead the plan file with read_file before acting on it. If the path is missing or the read fails, say so instead of guessing the plan.\n</runtime_context>`,
      });
    return ledger;
  }
  const tokenMeters = new WeakMap<RuntimeContextLedger, TokenMeter>();
  function tokenMeterFor(ledger: RuntimeContextLedger): TokenMeter {
    let meter = tokenMeters.get(ledger);
    if (meter === undefined) {
      meter = new TokenMeter();
      tokenMeters.set(ledger, meter);
    }
    return meter;
  }
  function subagentProviderMessages(ledger: RuntimeContextLedger) {
    return scope.contextEntriesToProviderMessages(ledger.snapshot().entries);
  }
  function subagentToolSchemas(tools: RuntimeTool[]) {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }
  function publishSubagentTokenSnapshot(
    ledger: RuntimeContextLedger,
    runner: SubagentRunnerContext,
  ) {
    const meter = tokenMeterFor(ledger);
    const projection = meter.project(`subagent:${runner.agentId}`);
    publishSubagentEvent(runner, {
      type: "context.snapshot",
      usedTokens:
        projection.projectedTokens ??
        projection.pressureTokens ??
        ledger.effectiveTokens(),
      ...(projection.pressureTokens === undefined
        ? {}
        : { pressureTokens: projection.pressureTokens }),
      ...(projection.projectedTokens === undefined
        ? {}
        : { projectedTokens: projection.projectedTokens }),
      ...(projection.contextWindow === undefined
        ? {}
        : { contextWindow: projection.contextWindow }),
      source: projection.source,
      at: new Date().toISOString(),
    });
  }
  function measureSubagentRequest(
    ledger: RuntimeContextLedger,
    runner: SubagentRunnerContext,
    tools: RuntimeTool[],
    contextConfig: { max: number; thresholdPercent: number; reserved: number },
  ): number {
    const meter = tokenMeterFor(ledger);
    const measured = meter.measureRequest(`subagent:${runner.agentId}`, {
      tools: subagentToolSchemas(tools),
      messages: subagentProviderMessages(ledger),
      contextWindow: contextConfig.max,
    });
    publishSubagentTokenSnapshot(ledger, runner);
    return Math.max(ledger.effectiveTokens(), measured.totalTokens);
  }
  async function runSubagentProviderStep(
    ledger: RuntimeContextLedger,
    visibleTools: RuntimeTool[],
    runner: SubagentRunnerContext,
    step: number,
    activeProvider: StreamingProvider,
    activeContextConfig: {
      max: number;
      thresholdPercent: number;
      reserved: number;
    },
    allowToolCalls = true,
  ) {
    const id = subagentTurnID(runner);
    const runStep = () =>
      resolvedRetryService.run(
        { id, operation: "llm_step", step },
        async ({ attempt }) => {
          let output = "";
          let thinking = "";
          const calls: ProviderToolCall[] = [];
          let protocolViolation = "";
          let providerUsage:
            | { inputTokens: number; outputTokens: number }
            | undefined;
          const providerMessages = subagentProviderMessages(ledger);
          const toolSchemas = subagentToolSchemas(visibleTools);
          const stream = scope.withProviderConcurrency(
            scope.providerConcurrencyLimiter,
            activeProvider.provider,
            () =>
              activeProvider.stream({
                messages: providerMessages,
                tools: allowToolCalls ? toolSchemas : undefined,
                toolChoice: allowToolCalls ? undefined : "none",
                signal: runner.signal,
              }),
            runner.signal,
          );
          const normalized = allowToolCalls
            ? scope.requireNativeToolCallProtocol(
                scope.normalizeRawToolCallProtocol(stream),
              )
            : stream;
          for await (const chunk of normalized) {
            if (chunk.type === "thinking") {
              thinking += chunk.text;
              publishSubagentEvent(runner, {
                type: "thinking.delta",
                id,
                text: chunk.text,
                attempt,
              });
            }
            if (chunk.type === "content") {
              output += chunk.text;
              publishSubagentEvent(runner, {
                type: "content.delta",
                id,
                text: chunk.text,
                attempt,
              });
            }
            if (chunk.type === "tool_call") calls.push(...chunk.calls);
            if (chunk.type === "tool_protocol_violation")
              protocolViolation = chunk.text;
            if (chunk.type === "usage")
              providerUsage = {
                inputTokens: chunk.inputTokens,
                outputTokens: chunk.outputTokens,
              };
          }
          if (providerUsage) {
            const meter = tokenMeterFor(ledger);
            const scopeKey = `subagent:${runner.agentId}`;
            const system =
              providerMessages[0]?.role === "system"
                ? providerMessages[0].content
                : undefined;
            meter.setContextWindow(scopeKey, activeContextConfig.max);
            meter.recordUsage(scopeKey, providerUsage, {
              headerKey: JSON.stringify({ system, tools: toolSchemas }),
              surfaceTokens: meter.observeSurface(scopeKey, providerMessages),
            });
            publishSubagentTokenSnapshot(ledger, runner);
            // Mirror the main runner's per-step usage event so the subagent
            // pane can show the same token/latency bar as Natalia/Navi/Nia.
            publishSubagentEvent(runner, {
              type: "runtime.step_usage",
              id: `${id}:usage:${attempt}`,
              inputTokens: providerUsage.inputTokens,
              outputTokens: providerUsage.outputTokens,
            });
          }
          return { output, thinking, calls, protocolViolation };
        },
        {
          signal: runner.signal,
          onEvent: (event) => {
            publishSubagentEvent(runner, event);
            if (event.type === "step.retry")
              runner.log(
                `provider retry ${event.attempt}/${event.maxAttempts ?? "unlimited"} after ${event.reason} (${event.waitMs}ms)`,
              );
          },
        },
      );
    let correction = 0;
    let result;
    while (true) {
      runner.signal.throwIfAborted();
      await resolvedCompactionService.compactBeforeProviderStep({
        compactionID: `${id}:preflight:${step}`,
        ledger,
        provider: activeProvider,
        budget: activeContextConfig,
        usedTokens: measureSubagentRequest(
          ledger,
          runner,
          visibleTools,
          activeContextConfig,
        ),
        enabled: scope.tsRuntimeConfig?.context.compactionEnabled ?? true,
        preservedRecentMessages:
          scope.tsRuntimeConfig?.context.preservedRecentMessages ?? 2,
        preservedRecentTokens:
          scope.tsRuntimeConfig?.context.preservedRecentTokens ?? 0,
        instruction:
          "Compact before this subagent provider request while preserving the active task.",
        signal: runner.signal,
        onEvent: (event: RuntimeEvent) => publishSubagentEvent(runner, event),
      });
      // Drop the pre-compaction provider anchor before re-measuring.
      tokenMeterFor(ledger).clear(`subagent:${runner.agentId}`);
      // Publish the compacted projection before the provider request starts.
      measureSubagentRequest(ledger, runner, visibleTools, activeContextConfig);
      result = await resolvedCompactionService.runWithContextLimitRecovery({
        id,
        step,
        compactionID: `${id}:context-limit:${step}`,
        ledger,
        provider: activeProvider,
        budget: activeContextConfig,
        preservedRecentMessages:
          scope.tsRuntimeConfig?.context.preservedRecentMessages ?? 2,
        preservedRecentTokens:
          scope.tsRuntimeConfig?.context.preservedRecentTokens ?? 0,
        maxOverflowRetries:
          scope.tsRuntimeConfig?.context.maxOverflowRetries ?? 1,
        instruction: "Recover this subagent from the provider context limit.",
        signal: runner.signal,
        runStep,
        onEvent: (event: RuntimeEvent) => {
          publishSubagentEvent(runner, event);
          if (event.type === "compaction.end" && event.success) {
            // Context-limit recovery rewrites the ledger in place; drop the
            // pre-compaction anchor and publish the post-compaction meter before
            // the retried provider request.
            tokenMeterFor(ledger).clear(`subagent:${runner.agentId}`);
            measureSubagentRequest(
              ledger,
              runner,
              visibleTools,
              activeContextConfig,
            );
          }
        },
      });
      if (!result.protocolViolation) break;
      correction += 1;
      if (correction > scope.MAX_PROTOCOL_CORRECTIONS)
        throw new Error(
          "model repeatedly emitted malformed textual tool calls instead of the provider's native tool protocol",
        );
      ledger.add({
        id: `${runner.agentId}:${step}:protocol:${correction}:assistant`,
        role: "assistant",
        content: result.protocolViolation,
      });
      ledger.add({
        id: `${runner.agentId}:${step}:protocol:${correction}:system`,
        role: "system",
        content: scope.nativeToolCallCorrection(correction),
      });
      runner.log(
        `correcting textual tool call; native tool calling required (attempt ${correction})`,
      );
    }
    if (result.thinking)
      publishSubagentEvent(runner, {
        type: "thinking.done",
        id,
        text: result.thinking,
      });
    if (result.output)
      publishSubagentEvent(runner, {
        type: "content.done",
        id,
        text: result.output,
      });
    return result;
  }
  function appendSubagentAssistant(
    ledger: RuntimeContextLedger,
    runner: SubagentRunnerContext,
    step: number,
    output: string,
    calls: ProviderToolCall[],
  ) {
    if (output)
      ledger.add({
        id: `${runner.agentId}:${step}:assistant`,
        role: "assistant",
        content: output,
      });
    for (const call of calls)
      ledger.add({
        id: `${runner.agentId}:${step}:${call.id}:call`,
        role: "tool_call",
        content: `${call.name} ${call.arguments}`,
        pairID: call.id,
      });
  }
  function appendSubagentToolResult(
    ledger: RuntimeContextLedger,
    runner: SubagentRunnerContext,
    step: number,
    call: ProviderToolCall,
    content: string,
  ) {
    ledger.add({
      id: `${runner.agentId}:${step}:${call.id}:result`,
      role: "tool_result",
      content,
      pairID: call.id,
    });
  }
  return {
    acquireSandboxedSubagentSlot,
    releaseSandboxedSubagentSlot,
    publishSubagentEvent,
    subagentTurnID,
    beginSubagentConversation,
    finishSubagentConversation,
    createSubagentContext,
    runSubagentProviderStep,
    appendSubagentAssistant,
    appendSubagentToolResult,
  };
}
