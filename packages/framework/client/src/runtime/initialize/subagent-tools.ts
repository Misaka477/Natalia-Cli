import type {
  InitializeOptions,
  ProviderToolCall,
  RuntimeContext,
  RuntimeTool,
  SandboxService,
  SessionExecutionState,
  SubagentRunnerContext,
  SubagentSupport,
  SubagentsService,
  TerminalController,
  ToolHookEvent,
} from "../context";
import { createInitializeRuntime } from "./runtime";

export async function createSubagentTools(
  ctx: RuntimeContext,
  _options: InitializeOptions,
  support: SubagentSupport,
) {
  const scope = createInitializeRuntime(ctx);
  const subagents = scope.resolveService<SubagentsService>(
    scope.SUBAGENTS_SERVICE,
  );
  const terminal = scope.resolveService<TerminalController>(
    scope.TERMINAL_CONTROLLER_SERVICE,
  );
  const sandbox = scope.resolveService<SandboxService>(scope.SANDBOX_SERVICE);
  const { publishSubagentEvent, subagentTurnID } = support;
  async function executeSubagentToolCall(input: {
    call: ProviderToolCall;
    step: number;
    runner: SubagentRunnerContext;
    visibleTools: RuntimeTool[];
    childWorkspaceRoot: string;
    repeatedCalls: Map<string, number>;
    exec: SessionExecutionState;
    writeAuthorize?: (input: {
      toolName: string;
      path: string;
    }) => Promise<void>;
    exposeSandboxes?: boolean;
  }) {
    const { call, runner } = input;
    const displayCallID = `step:${input.step}:${call.id}`;
    const toolID = `${subagentTurnID(runner)}:${displayCallID}`;
    const tool = input.visibleTools.find(
      (candidate) => candidate.name === call.name,
    );
    if (!tool) {
      const message = `subagent requested unavailable or denied tool: ${call.name || "<missing name>"}`;
      publishSubagentEvent(runner, {
        type: "tool.update",
        id: toolID,
        name: call.name || "invalid_tool_call",
        callID: displayCallID,
        status: "failed",
        summary: message,
        argumentsDelta: call.arguments,
        result: message,
        endedAt: Date.now(),
      });
      return `ERROR: ${message}`;
    }
    const dedupKey = `${call.name}\u0000${call.arguments}`;
    const occurrences = (input.repeatedCalls.get(dedupKey) ?? 0) + 1;
    input.repeatedCalls.set(dedupKey, occurrences);
    if (occurrences > 12 && !scope.WAITING_TOOLS.has(tool.name)) {
      const message = `blocked repeated tool call after ${occurrences} identical attempts: ${tool.name}`;
      publishSubagentEvent(runner, {
        type: "tool.update",
        id: toolID,
        name: tool.name,
        callID: displayCallID,
        status: "failed",
        summary: message,
        argumentsDelta: call.arguments,
        result: message,
        endedAt: Date.now(),
      });
      return `ERROR: ${message}`;
    }
    const hookEvent: ToolHookEvent = {
      turnID: subagentTurnID(runner),
      toolName: tool.name,
      toolCallID: call.id,
      arguments: call.arguments,
    };
    try {
      publishSubagentEvent(runner, {
        type: "tool.update",
        id: toolID,
        name: tool.name,
        callID: displayCallID,
        status: tool.requiresApproval ? "awaiting_approval" : "queued",
        summary: tool.requiresApproval ? "awaiting approval" : "queued",
        argumentsDelta: call.arguments,
      });
      const preResult = await scope
        .createToolPolicyLayer(input.exec)
        .preExecute(hookEvent);
      if (!preResult.allowed)
        throw new Error(
          `subagent tool denied by policy: ${preResult.diagnostics.join("; ")}`,
        );
      if (input.exec.permissionMode === "read_only" && tool.requiresApproval)
        throw new Error(scope.readOnlyToolMessage(tool.name));
      if (tool.requiresApproval) {
        const refusal = await scope.interactive.requireApproval(
          toolID,
          tool,
          call,
          hookEvent.turnID,
        );
        if (refusal) throw new Error(refusal.reason);
      }
      const parsed = scope.parseToolArguments(call.arguments);
      const paramErrors = scope.validateToolParameters(tool.parameters, parsed);
      if (paramErrors.length)
        throw new Error(
          `tool "${tool.name}" parameter validation failed: ${paramErrors.map((error) => `${error.path}: ${error.message}`).join("; ")}`,
        );
      const parentSessionID = subagents?.get(runner.agentId)?.parentSessionID;
      const startedAt = Date.now();
      publishSubagentEvent(runner, {
        type: "tool.update",
        id: toolID,
        name: tool.name,
        callID: displayCallID,
        status: "running",
        summary: "running",
        startedAt,
        metadata: tool.output?.presentCall
          ? { call: tool.output.presentCall(parsed) }
          : undefined,
      });
      const completeResult = await tool.execute(parsed, {
        workspaceRoot: input.childWorkspaceRoot,
        signal: runner.signal,
        sessionID: input.exec.session.id,
        askQuestion: async (question) =>
          await scope.interactive.requireQuestion(
            `${toolID}:question`,
            hookEvent.turnID,
            question,
          ),
        subagents: subagents ?? undefined,
        terminal: terminal ?? undefined,
        ...(input.exposeSandboxes ? { sandboxes: sandbox ?? undefined } : {}),
        workspaceReadAuthorize: (request) =>
          scope.authorizeWorkspaceRead(request, input.exec),
        ...(input.writeAuthorize
          ? { workspaceWriteAuthorize: input.writeAuthorize }
          : {}),
        sandboxMergeAuthorize: (request) =>
          scope.authorizeSandboxMerge(request, input.exec),
        settings: scope.toolSettings(input.exec),
        parentSessionID: parentSessionID ?? input.exec.session.id,
        parentAgentID: runner.agentId,
        maxSubagentDepth: scope.tsRuntimeConfig?.runtime.subagentDepth,
      });
      const finalizedResult =
        tool.output?.finalizeContent?.(completeResult) ?? completeResult;
      const result = scope.redactToolOutput(
        finalizedResult,
        scope.redactToolOutputEnabled(input.exec),
      );
      const projectedRender = tool.output?.presentResult?.(parsed, result);
      await scope
        .createToolPolicyLayer(input.exec)
        .postExecute({ ...hookEvent, result });
      publishSubagentEvent(runner, {
        type: "tool.update",
        id: toolID,
        name: tool.name,
        callID: displayCallID,
        status: "succeeded",
        summary: result.slice(0, 200),
        result,
        metadata: projectedRender ? { render: projectedRender } : undefined,
        endedAt: Date.now(),
      });
      runner.log(`tool ${tool.name}: ${result.slice(0, 240)}`);
      return result;
    } catch (error) {
      if (runner.signal.aborted) throw error;
      const message = error instanceof Error ? error.message : String(error);
      await scope
        .createToolPolicyLayer(input.exec)
        .postExecute({ ...hookEvent, error: message });
      publishSubagentEvent(runner, {
        type: "tool.update",
        id: toolID,
        name: call.name || "invalid_tool_call",
        callID: call.id,
        status: "failed",
        summary: message,
        result: message,
        endedAt: Date.now(),
      });
      runner.log(`tool ${tool.name}: ERROR: ${message.slice(0, 240)}`);
      return `ERROR: ${message}`;
    }
  }
  return { executeSubagentToolCall };
}
