/**
 * The execute stage of a single tool call — runtime/tool-execution/execute-run.ts.
 *
 * `runExecuteStage` is the execute-stage content of `executeOneTool`: it
 * publishes the awaiting/queued fact, runs the interactive approval, drives the
 * tool with the session-scoped cancellation signal and write lock, records the
 * mutation attribution, bounds and redacts the output, publishes the outcome
 * facts, and settles the in-flight audit. Split into its own file so
 * `execute-one.ts` stays within the source line limit.
 */
import type { ProviderToolCall } from "@natalia/runtime";
import type { RuntimeTool } from "@natalia/tools";
import type { RuntimeEvent } from "@natalia/contracts";
import type { SessionExecutionState } from "../../real-runtime";
import type { RealRuntimeClientOptions } from "../../real-runtime";
import type { RuntimeContext } from "../context";

export type ExecuteStageInput = {
  exec: SessionExecutionState | undefined;
  publish: (event: RuntimeEvent) => void;
  toolID: string;
  tool: RuntimeTool;
  call: ProviderToolCall;
  turnID: string;
  attachImage?: (path: string) => Promise<void>;
  attachPdf?: (path: string) => Promise<void>;
  ctx: RuntimeContext;
  options: RealRuntimeClientOptions;
  sessionID: import("@natalia/contracts").SessionID;
  workspaceRoot: string;
};

export async function runExecuteStage(
  input: ExecuteStageInput,
): Promise<string> {
  const {
    exec,
    publish,
    toolID,
    tool,
    call,
    turnID,
    attachImage,
    attachPdf,
    ctx,
    options,
    sessionID,
    workspaceRoot,
  } = input;
  const {
    publishWorkGraphToolCall,
    waitIfPaused,
    toolSettings,
    authorizeWorkspaceRead,
    authorizeSandboxMerge,
    setInFlightOperationFor,
    requireWriteLock,
    getTsRuntimeConfig,
    getCapabilityRegistry,
    getSubagentsController,
    getTerminalController,
    getSandboxController,
    getInteractive,
    getToolLayer,
    getToolPolicy,
    getWorkLedgerController,
    getMutationRegistry,
    getTerminalCommandBuffer,
    setEndTurnWaitingHuman,
    scheduleRuntimeStatusSnapshot,
  } = ctx.ports;
  const { sandboxResourcesByID } = ctx.state;
  const toolPolicy = getToolPolicy();
  const toolLayer = getToolLayer();
  const interactive = getInteractive();
  const terminalController = getTerminalController();
  const sandboxController = getSandboxController();
  const subagentsController = getSubagentsController();
  const tsRuntimeConfig = getTsRuntimeConfig();
  const terminalCommandBuffer = getTerminalCommandBuffer();
  const mutationRegistry = getMutationRegistry();
  const workLedgerController = getWorkLedgerController();
  const capabilityRegistry = getCapabilityRegistry();
  const redactToolOutput = ctx.ports.redactToolOutput;
  const redactToolOutputEnabled = ctx.ports.redactToolOutputEnabled;
  const waitForToolExecution = ctx.ports.waitForToolExecution;
  const boundToolOutput = ctx.ports.boundToolOutput;
  const isManagedResourceTool = ctx.ports.isManagedResourceTool;
  const tryParseToolArguments = ctx.ports.tryParseToolArguments;
  const parseToolArguments = ctx.ports.parseToolArguments;
  const validateToolParameters = ctx.ports.validateToolParameters;
  publish({
    type: "tool.update",
    id: toolID,
    name: tool.name,
    callID: call.id,
    status: tool.requiresApproval ? "awaiting_approval" : "queued",
    summary: tool.requiresApproval ? "awaiting approval" : "queued",
    argumentsDelta: call.arguments,
  });
  publish({
    type: "policy.decision",
    turnID,
    toolName: tool.name,
    toolCallID: call.id,
    decision: tool.requiresApproval ? "approval_required" : "allow",
  });
  if (tool.requiresApproval) {
    const refusal = await interactive.requireApproval(
      toolID,
      tool,
      call,
      turnID,
    );
    if (refusal) {
      // Reported like a policy denial: the call did not run, the turn keeps
      // going, and the model receives the reason as this call's result.
      publish({
        type: "tool.update",
        id: toolID,
        name: tool.name,
        callID: call.id,
        status: "rejected",
        summary: refusal.reason,
        result: refusal.reason,
        endedAt: Date.now(),
      });
      publishWorkGraphToolCall(turnID, call.id, tool.name, "rejected");
      await toolLayer.postExecute({
        ...{
          turnID,
          toolName: tool.name,
          toolCallID: call.id,
          arguments: call.arguments,
        },
        error: refusal.reason,
      });
      throw new Error(refusal.reason);
    }
  }
  await waitIfPaused(exec);
  publish({
    type: "tool.update",
    id: toolID,
    name: tool.name,
    callID: call.id,
    status: "running",
    summary: "running",
    startedAt: Date.now(),

    metadata: tool.output?.presentCall
      ? {
          call: tool.output.presentCall(tryParseToolArguments(call.arguments)),
        }
      : undefined,
  });
  let executionAudited = false;
  let releaseWriteLock: (() => void) | undefined;
  try {
    const parsed = parseToolArguments(call.arguments);
    const paramErrors = validateToolParameters(tool.parameters, parsed);
    if (paramErrors.length) {
      const detail = paramErrors
        .map((e) => `${e.path}: ${e.message}`)
        .join("; ");
      throw new Error(
        `tool "${tool.name}" parameter validation failed: ${detail}`,
      );
    }
    if (!exec) throw new Error("session execution state unavailable");
    await setInFlightOperationFor(exec, {
      kind: "tool_execution",
      turnID,
      toolName: tool.name,
      toolCallID: call.id,
      startedAt: new Date().toISOString(),
    });
    executionAudited = true;
    const executionController = new AbortController();
    // The cancellation listener binds the turn's own exec, not the activity
    // closure: a background turn's tool must stop when its session is
    // cancelled, never when the attached session is.
    const cancelExecution = () =>
      executionController.abort(
        exec?.activeAbort?.signal.reason ?? new Error("tool cancelled"),
      );
    const execSignal = exec?.activeAbort?.signal;
    if (execSignal?.aborted) cancelExecution();
    else execSignal?.addEventListener("abort", cancelExecution, { once: true });
    const timeoutTimer = tool.timeoutSec
      ? setTimeout(
          () =>
            executionController.abort(
              new Error(
                `tool ${tool.name} timed out after ${tool.timeoutSec}s`,
              ),
            ),
          tool.timeoutSec * 1000,
        )
      : undefined;
    const signal = executionController.signal;
    // D2: workspace writes serialise across sessions.

    releaseWriteLock = toolPolicy!.workspaceWritePathForTool(
      tool.name,
      parsed as Record<string, unknown>,
    )
      ? await requireWriteLock().acquire()
      : undefined;
    // WG4 Phase 3: register the expected mutation before the tool runs.
    const writePath = toolPolicy!.workspaceWritePathForTool(
      tool.name,
      parsed as Record<string, unknown>,
    );
    if (writePath) {
      mutationRegistry?.register({
        sessionID: exec.session.id,
        turnID,
        callID: call.id,
        toolName: tool.name,
        authorizedPaths: [writePath],
        expectedOperations: ["modified", "added", "deleted", "renamed"],
      });
    }
    const completeResult = await waitForToolExecution(
      tool.execute(parsed, {
        workspaceRoot,
        signal,
        sessionID: exec?.session.id ?? sessionID,
        askQuestion: async (question) =>
          await interactive.requireQuestion(
            `${toolID}:question`,
            turnID,
            question,
          ),
        subagents: subagentsController,
        terminal: terminalController,
        sandboxes: sandboxController,
        ...(attachImage ? { attachImage } : {}),
        ...(attachPdf ? { attachPdf } : {}),
        workspaceReadAuthorize: (request) =>
          authorizeWorkspaceRead(request, exec),
        sandboxMergeAuthorize: (request) =>
          authorizeSandboxMerge(request, exec),
        // The resolved config as a service: a tool family reads it by
        // name (e.g. `sandbox.backend`) instead of re-parsing config.
        runtimeConfig: () => capabilityRegistry.service("runtime.config"),
        settings: toolSettings(exec),
        // The turn's own session, not the attached one: a background turn's
        // subagents and terminal starts belong to its session (I1/I3).
        parentSessionID: exec?.session.id ?? sessionID,
        maxSubagentDepth: tsRuntimeConfig?.runtime.subagentDepth,
        onSandboxEvent: (event) => {
          const update = event as Extract<
            RuntimeEvent,
            { type: "sandbox.update" }
          >;
          publish(update);
          if (sandboxResourcesByID.get(update.id) !== update.runningResources) {
            sandboxResourcesByID.set(update.id, update.runningResources);
            scheduleRuntimeStatusSnapshot();
          }
        },
        onWorkspaceChange: (changes) => {
          // WG4 Phase 3: the tool settled successfully — the expected
          // mutation stops matching unrelated later hints, but its identity
          // stays available for attributing the change it caused.
          mutationRegistry?.settle(call.id);
          for (const change of changes) {
            publish(
              workLedgerController.workspaceChangeNode({
                turnID,
                path: change.path,
                toolName: tool.name,
                sessionID: exec.session.id,
              }),
            );
            publish(
              workLedgerController.workspaceChangeEdge({
                turnID,
                callID: call.id,
                path: change.path,
              }),
            );
          }
        },
      }),
      signal,
    ).finally(() => {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      exec?.activeAbort?.signal.removeEventListener("abort", cancelExecution);
    });
    // The tool.s own final content invariant runs exactly once, pre-redaction.
    const finalizedContent =
      tool.output?.finalizeContent?.(completeResult) ?? completeResult;
    const bounded = await boundToolOutput(
      workspaceRoot,
      redactToolOutput(finalizedContent, redactToolOutputEnabled(exec)),
    );
    const result = bounded.text;
    // The tool's own output projection becomes part of the event metadata, so
    // a client can draw the result as the card the tool described instead of
    // guessing from the string.
    const projectedRender = tool.output?.presentResult?.(
      tryParseToolArguments(call.arguments),
      result,
    );
    if (options.taskModuleContext && tool.name !== "flow_module_complete") {
      options.taskModuleContext.store.recordModuleEvidence({
        invocationID: options.taskModuleContext.invocationID,
        attempt: options.taskModuleContext.attempt,
        flowID: options.taskModuleContext.flowID,
        moduleID: options.taskModuleContext.moduleID,
        ref: `tool:${call.id}`,
        tool: tool.name,
      });
    }
    if (
      tool.name === "interactive_terminal_start" ||
      tool.name === "interactive_terminal_stop"
    ) {
      const terminalID = (parsed as Record<string, unknown>).id;
      if (typeof terminalID === "string")
        terminalCommandBuffer.clear(terminalID);
    }
    publish({
      type: "tool.update",
      id: toolID,
      name: tool.name,
      callID: call.id,
      status: "succeeded",
      summary: result.slice(0, 200),
      result,
      metadata: {
        ...(bounded.outputPath ? { outputPath: bounded.outputPath } : {}),
        ...(projectedRender ? { render: projectedRender } : {}),
      },
      endedAt: Date.now(),
    });
    publishWorkGraphToolCall(turnID, call.id, tool.name, "succeeded");
    // Only after success: a write that failed did not change the workspace, and
    // a graph that says otherwise sends a reader looking for a change that is
    // not there.
    const changedPath = toolPolicy!.workspaceWritePathForTool(
      tool.name,
      tryParseToolArguments(call.arguments),
    );
    if (changedPath) {
      publish(
        workLedgerController.workspaceChangeNode({
          turnID,
          path: changedPath,
          toolName: tool.name,
          sessionID: exec.session.id,
        }),
      );
      publish(
        workLedgerController.workspaceChangeEdge({
          turnID,
          callID: call.id,
          path: changedPath,
        }),
      );
    }
    if (isManagedResourceTool(tool.name)) scheduleRuntimeStatusSnapshot();
    // TERM-M.3 (c): request_human with endTurn=true ends the current turn as
    // waiting_human; the runtime resumes with a new turn once the human
    // releases the pane.
    if (tool.name === "interactive_terminal_request_human") {
      const requestArgs = tryParseToolArguments(call.arguments) as {
        id?: unknown;
        reason?: unknown;
        endTurn?: unknown;
      };
      if (
        requestArgs?.endTurn === true &&
        typeof requestArgs.id === "string" &&
        typeof requestArgs.reason === "string"
      ) {
        const marker = {
          terminalID: requestArgs.id,
          reason: requestArgs.reason,
        };
        if (exec) exec.endTurnWaitingHuman = marker;
        else setEndTurnWaitingHuman(marker);
      }
    }
    return result;
  } catch (error) {
    // WG4 Phase 3: a failed write did not change the workspace — drop the
    // expected mutation so it cannot attribute a later unrelated hint.
    if (
      toolPolicy!.workspaceWritePathForTool(
        tool.name,
        tryParseToolArguments(call.arguments),
      )
    )
      mutationRegistry?.forget(call.id);
    const message = error instanceof Error ? error.message : String(error);
    publish({
      type: "tool.update",
      id: toolID,
      name: tool.name,
      callID: call.id,
      status: "failed",
      summary: message,
      result: message,
      endedAt: Date.now(),
    });
    // A failed call is as much a fact as a successful one; the error text stays
    // out of the graph.
    publishWorkGraphToolCall(turnID, call.id, tool.name, "failed");
    await toolLayer.postExecute({
      ...{
        turnID,
        toolName: tool.name,
        toolCallID: call.id,
        arguments: call.arguments,
      },
      error: message,
    });
    throw new Error(message);
  } finally {
    releaseWriteLock?.();
    if (executionAudited && exec)
      await setInFlightOperationFor(exec, undefined);
  }
}
