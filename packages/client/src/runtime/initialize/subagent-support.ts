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
  function createSubagentContext(system: string, task: string) {
    const ledger = resolvedContextLedgerFactory.create();
    ledger.add({ id: "system", role: "system", content: system });
    ledger.add({ id: "task", role: "user", content: task });
    return ledger;
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
          const stream = scope.withProviderConcurrency(
            scope.providerConcurrencyLimiter,
            activeProvider.provider,
            () =>
              activeProvider.stream({
                messages: scope.contextEntriesToProviderMessages(
                  ledger.snapshot().entries,
                ),
                tools: allowToolCalls
                  ? visibleTools.map((tool) => ({
                      name: tool.name,
                      description: tool.description,
                      parameters: tool.parameters,
                    }))
                  : undefined,
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
      result = await resolvedCompactionService.runWithContextLimitRecovery({
        id,
        step,
        compactionID: `${id}:context-limit:${step}`,
        ledger,
        provider: activeProvider,
        budget: activeContextConfig,
        preservedRecentMessages:
          scope.tsRuntimeConfig?.context.preservedRecentMessages ?? 2,
        instruction: "Recover this subagent from the provider context limit.",
        signal: runner.signal,
        runStep,
        onEvent: (event: RuntimeEvent) => publishSubagentEvent(runner, event),
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
