import type {
  InitializeOptions,
  RuntimeContext,
  RuntimeEvent,
  SessionExecutionState,
  SessionID,
  StreamingProvider,
  SubagentRunnerContext,
  SubagentSupport,
} from "../context";
import { createInitializeRuntime } from "./runtime";

export async function installSubagents(
  ctx: RuntimeContext,
  _options: InitializeOptions,
  support: SubagentSupport & {
    executeSubagentToolCall: ReturnType<
      typeof import("./subagent-tools").createSubagentTools
    > extends Promise<infer T>
      ? T extends { executeSubagentToolCall: infer F }
        ? F
        : never
      : never;
  },
) {
  const scope = createInitializeRuntime(ctx);
  const {
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
    executeSubagentToolCall,
  } = support;
  async function runSandboxedSubagent(
    task: string,
    runner: SubagentRunnerContext,
    exec: SessionExecutionState,
    activeProvider: StreamingProvider,
  ) {
    await acquireSandboxedSubagentSlot(runner.signal);
    try {
      await runSandboxedSubagentInner(task, runner, exec, activeProvider);
    } finally {
      releaseSandboxedSubagentSlot();
    }
  }
  async function runSandboxedSubagentInner(
    task: string,
    runner: SubagentRunnerContext,
    exec: SessionExecutionState,
    activeProvider: StreamingProvider,
  ) {
    const record = scope.subagentsController?.get(runner.agentId);
    if (!record)
      throw new Error(`subagent record not found: ${runner.agentId}`);
    const allowed = record.allowedTools ?? [];
    const excluded = new Set(record.excludeTools ?? []);
    // The sub-agent's own worktree, created through the sandbox backend.
    const manifest = await scope.sandboxController?.create(runner.agentId);
    if (!manifest)
      throw new Error("sandbox controller unavailable for subagent worktree");
    const sandboxRoot = manifest.root;
    // The ownership map's domain: paths (relative to the sub-agent's
    // worktree) it may write. Absent = unrestricted (same authority as the
    // main agent).
    const writePaths = record.writePaths;
    const writeAuthorize = writePaths?.length
      ? async ({ toolName, path }: { toolName: string; path: string }) => {
          const relative = path.startsWith(sandboxRoot + "/")
            ? path.slice(sandboxRoot.length + 1)
            : path;
          const inDomain = writePaths.some(
            (domain) =>
              relative === domain ||
              relative.startsWith(domain.endsWith("/") ? domain : `${domain}/`),
          );
          if (!inDomain)
            throw new Error(
              `subagent write outside file domain (${toolName}): ${relative}`,
            );
        }
      : undefined;
    runner.log(`accepted (sandboxed): ${task}`);
    runner.setStatus("running");
    beginSubagentConversation(runner, task);
    const ledger = createSubagentContext(
      scope.teamBehavior()?.sandboxedSubagentSystemPrompt(writePaths) ??
        "You are a focused Natalia TS/Bun subagent. Use the provided native tools to inspect, edit, and validate the workspace. Return a concise factual final result. Never claim a tool action you did not run. Do not reveal private reasoning.",
      task,
    );
    const repeatedCalls = new Map<string, number>();
    const maxSubagentSteps = scope.effectiveMaxSteps(exec);
    const activeContextConfig = { ...exec.runtimeContextConfig };
    for (let step = 1; step <= maxSubagentSteps; step++) {
      const isLastStep =
        Number.isFinite(maxSubagentSteps) && step >= maxSubagentSteps;
      const visibleTools = [...scope.tools.values()].filter(
        (tool) =>
          scope.isToolAllowed(tool.name, exec) &&
          (exec.permissionMode !== "read_only" || !tool.requiresApproval) &&
          !excluded.has(tool.name) &&
          (!allowed.length || allowed.includes(tool.name)),
      );
      if (isLastStep)
        ledger.add({
          id: `${runner.agentId}:${step}:max-steps`,
          role: "assistant",
          content: scope.MAX_STEPS_PROMPT,
        });
      const { output, calls } = await runSubagentProviderStep(
        ledger,
        visibleTools,
        runner,
        step,
        activeProvider,
        activeContextConfig,
        !isLastStep,
      );
      if (!calls.length || isLastStep) {
        const finalOutput =
          output.trim() ||
          (isLastStep || step > 1
            ? scope.MISSING_FINAL_RESPONSE_FALLBACK
            : output);
        appendSubagentAssistant(ledger, runner, step, finalOutput, []);
        if (isLastStep && calls.length)
          publishSubagentEvent(runner, {
            type: "diagnostic",
            level: "warning",
            message:
              "Provider emitted a subagent tool call after tools were disabled; ignored the call and finalized with text",
          });
        if (!output.trim() && (isLastStep || step > 1)) {
          publishSubagentEvent(runner, {
            type: "content.delta",
            id: subagentTurnID(runner),
            text: finalOutput,
          });
          publishSubagentEvent(runner, {
            type: "content.done",
            id: subagentTurnID(runner),
            text: finalOutput,
          });
        }
        runner.log(finalOutput.trim() || "completed without text output");
        finishSubagentConversation(runner, "done");
        return;
      }
      appendSubagentAssistant(ledger, runner, step, output, calls);
      for (const call of calls) {
        const result = await executeSubagentToolCall({
          call,
          step,
          runner,
          visibleTools,
          childWorkspaceRoot: sandboxRoot,
          repeatedCalls,
          exec,
          writeAuthorize,
        });
        appendSubagentToolResult(ledger, runner, step, call, result);
      }
    }
    throw new Error("subagent step limit reached");
  }
  await scope.subagentsController?.init(async (task, runner) => {
    try {
      const record = scope.subagentsController?.get(runner.agentId);
      const exec = scope.executionBySession.get(
        record?.parentSessionID as SessionID,
      );
      if (!exec) throw new Error("parent session unavailable for subagent");
      const activeProvider = exec.provider;
      if (!activeProvider) throw new Error("provider unavailable for subagent");
      // `mode: "sandbox"` routes to the sub-agent's own worktree; everything
      // else keeps the shared-context loop unchanged.
      if (record?.mode === "sandbox")
        return await runSandboxedSubagent(task, runner, exec, activeProvider);
      const allowed = record?.allowedTools ?? [];
      const excluded = new Set(record?.excludeTools ?? []);
      const ledger = createSubagentContext(
        "You are a focused Natalia TS/Bun subagent. Use the provided native tools for filesystem work. When a tool is needed, call it through the provider's native structured tool-calling interface; never write XML, JSON, Markdown, or prose that imitates a tool call in assistant content. Return a concise factual final result. Never claim a tool action you did not run. Do not reveal private reasoning.",
        task,
      );
      const repeatedCalls = new Map<string, number>();
      runner.log(`accepted: ${task}`);
      beginSubagentConversation(runner, task);
      const maxSubagentSteps = scope.effectiveMaxSteps(exec);
      const activeContextConfig = { ...exec.runtimeContextConfig };
      for (let step = 1; step <= maxSubagentSteps; step++) {
        const isLastStep =
          Number.isFinite(maxSubagentSteps) && step >= maxSubagentSteps;
        const visibleTools = [...scope.tools.values()].filter(
          (tool) =>
            scope.isToolAllowed(tool.name, exec) &&
            (exec.permissionMode !== "read_only" || !tool.requiresApproval) &&
            !excluded.has(tool.name) &&
            (!allowed.length || allowed.includes(tool.name)),
        );
        if (isLastStep)
          ledger.add({
            id: `${runner.agentId}:${step}:max-steps`,
            role: "assistant",
            content: scope.MAX_STEPS_PROMPT,
          });
        const { output, calls } = await runSubagentProviderStep(
          ledger,
          visibleTools,
          runner,
          step,
          activeProvider,
          activeContextConfig,
          !isLastStep,
        );
        if (!calls.length || isLastStep) {
          const finalOutput =
            output.trim() ||
            (isLastStep || step > 1
              ? scope.MISSING_FINAL_RESPONSE_FALLBACK
              : output);
          appendSubagentAssistant(ledger, runner, step, finalOutput, []);
          if (isLastStep && calls.length)
            publishSubagentEvent(runner, {
              type: "diagnostic",
              level: "warning",
              message:
                "Provider emitted a subagent tool call after tools were disabled; ignored the call and finalized with text",
            });
          if (!output.trim() && (isLastStep || step > 1)) {
            publishSubagentEvent(runner, {
              type: "content.delta",
              id: subagentTurnID(runner),
              text: finalOutput,
            });
            publishSubagentEvent(runner, {
              type: "content.done",
              id: subagentTurnID(runner),
              text: finalOutput,
            });
          }
          runner.log(finalOutput.trim() || "completed without text output");
          finishSubagentConversation(runner, "done");
          return;
        }
        appendSubagentAssistant(ledger, runner, step, output, calls);
        for (const call of calls) {
          const result = await executeSubagentToolCall({
            call,
            step,
            runner,
            visibleTools,
            childWorkspaceRoot: scope.workspaceRoot,
            repeatedCalls,
            exec,
            exposeSandboxes: true,
          });
          appendSubagentToolResult(ledger, runner, step, call, result);
        }
      }
      throw new Error("subagent step limit reached");
    } catch (error) {
      finishSubagentConversation(
        runner,
        runner.signal.aborted ? "cancelled" : "error",
      );
      throw error;
    }
  });
  scope.subagentsController!.subscribe((event) => {
    const record = scope.subagentsController!.get(event.agentId);
    const update = {
      type: "subagent.update",
      id: event.agentId,
      event: event.event as Extract<
        RuntimeEvent,
        { type: "subagent.update" }
      >["event"],
      status: event.status as Extract<
        RuntimeEvent,
        { type: "subagent.update" }
      >["status"],
      attached: event.attached,
      task: record?.task,
      text: event.text,
      parentSessionID: event.parentSessionID,
      parentAgentID: event.parentAgentID,
      continuation: event.continuation,
      phase: event.phase ?? record?.phase,
      activityDetail: event.activityDetail ?? record?.activityDetail,
      health: scope.subagentsController!.health(event.agentId),
      lastActivityAt: record?.lastActivityAt,
      startedAt: record?.startedAt,
      endedAt: record?.endedAt,
      stopReason: event.stopReason,
      requestedBy: event.requestedBy,
      force: event.force,
    } satisfies Extract<RuntimeEvent, { type: "subagent.update" }>;
    // Registry events can arrive after the UI attaches to another scope.session.
    // Persist them with the spawning scope.session, rather than whichever scope.session
    // happens to be active when the asynchronous subagent reports progress.
    scope.publishForSession(
      scope.executionBySession.get(event.parentSessionID as SessionID),
      update,
    );
    if (event.event === "created" || event.event === "done")
      scope.scheduleRuntimeStatusSnapshot();
  });
}
