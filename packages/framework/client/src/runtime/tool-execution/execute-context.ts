/**
 * Tool execution context builder — runtime/tool-execution/execute-context.ts.
 *
 * Builds the `ToolExecutionContext` handed to a tool's `execute` call: the
 * session-scoped bindings, interactive question bridge, subagent/terminal/
 * sandbox controllers, workspace/sandbox authorization, resolved config and
 * settings, and the sandbox/workspace event hooks. Split into its own file so
 * `execute-run.ts` stays within the source line limit.
 */
import type { ProviderToolCall } from "@natalia/runtime";
import type { RuntimeTool } from "@natalia/tools";
import type { RuntimeEvent } from "@natalia/contracts";
import {
  SANDBOX_SERVICE,
  SUBAGENTS_SERVICE,
  TERMINAL_CONTROLLER_SERVICE,
  WORK_LEDGER_CONTROLLER_SERVICE,
  WORKSPACE_MUTATIONS_SERVICE,
  type MutationRegistry,
  type SandboxService,
  type SubagentsService,
  type TerminalController,
  type WorkLedgerController,
} from "@natalia/runtime-services";
import type { RuntimeContext } from "../context";
import type { SessionExecutionState } from "../context";

export type BuildContextInput = {
  exec: SessionExecutionState | undefined;
  publish: (event: RuntimeEvent) => void;
  toolID: string;
  tool: RuntimeTool;
  call: ProviderToolCall;
  turnID: string;
  attachImage?: (path: string) => Promise<void>;
  attachPdf?: (path: string) => Promise<void>;
  ctx: RuntimeContext;
  sessionID: import("@natalia/contracts").SessionID;
  workspaceRoot: string;
  signal: AbortSignal;
  parsed: unknown;
};

export function buildToolExecutionContext(input: BuildContextInput) {
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
    sessionID,
    workspaceRoot,
    signal,
    parsed,
  } = input;
  const {
    getCapabilityRegistry,
    getTsRuntimeConfig,
    getInteractive,
    authorizeWorkspaceRead,
    authorizeSandboxMerge,
    toolSettings,
    scheduleRuntimeStatusSnapshot,
  } = ctx.ports;
  const { sandboxResourcesByID } = ctx.state;
  const subagents =
    ctx.ports.resolveService<SubagentsService>(SUBAGENTS_SERVICE);
  const terminal = ctx.ports.resolveService<TerminalController>(
    TERMINAL_CONTROLLER_SERVICE,
  );
  const sandboxes = ctx.ports.resolveService<SandboxService>(SANDBOX_SERVICE);
  return {
    workspaceRoot,
    signal,
    sessionID: exec?.session.id ?? sessionID,
    askQuestion: async (input: {
      title: string;
      questions: Array<{
        id: string;
        header: string;
        question: string;
        options: Array<{ label: string; description?: string }>;
        multiple?: boolean;
        custom?: boolean;
      }>;
    }) =>
      await getInteractive().requireQuestion(
        `${toolID}:question`,
        turnID,
        input,
      ),
    subagents,
    terminal,
    sandboxes,
    ...(attachImage ? { attachImage } : {}),
    ...(attachPdf ? { attachPdf } : {}),
    workspaceReadAuthorize: (request: { toolName: string; paths: string[] }) =>
      authorizeWorkspaceRead(request, exec),
    sandboxMergeAuthorize: (request: { id: string; paths: string[] }) =>
      authorizeSandboxMerge(request, exec),
    // The resolved config as a service: a tool family reads it by
    // name (e.g. `sandbox.backend`) instead of re-parsing config.
    runtimeConfig: () => getCapabilityRegistry().service("runtime.config"),
    settings: toolSettings(exec),
    // The turn's own session, not the attached one: a background turn's
    // subagents and terminal starts belong to its session (I1/I3).
    parentSessionID: exec?.session.id ?? sessionID,
    maxSubagentDepth: getTsRuntimeConfig()?.runtime.subagentDepth,
    onSandboxEvent: (event: { [key: string]: unknown; type: string }) => {
      const update = event as Extract<RuntimeEvent, { type: "sandbox.update" }>;
      publish(update);
      if (sandboxResourcesByID.get(update.id) !== update.runningResources) {
        if (update.runningResources === 0)
          sandboxResourcesByID.delete(update.id);
        else sandboxResourcesByID.set(update.id, update.runningResources);
        scheduleRuntimeStatusSnapshot();
      }
    },
    onWorkspaceChange: (changes: Array<{ path: string }>) => {
      // WG4 Phase 3: the tool settled successfully — the expected
      // mutation stops matching unrelated later hints, but its identity
      // stays available for attributing the change it caused.
      ctx.ports
        .resolveService<MutationRegistry>(WORKSPACE_MUTATIONS_SERVICE)
        ?.settle(call.id);
      if (!exec?.session) return;
      const workLedgerController =
        ctx.ports.resolveService<WorkLedgerController>(
          WORK_LEDGER_CONTROLLER_SERVICE,
        );
      if (!workLedgerController)
        throw new Error("work ledger unavailable (natalia-work-ledger)");
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
  };
}
