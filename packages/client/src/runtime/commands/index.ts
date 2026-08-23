/**
 * Slash commands and command catalog — runtime/commands module.
 *
 * `handleCommand` is a thin router over the read-only slash handlers
 * (`slash-read.ts`) and the state-changing slash handlers (`slash-action.ts`).
 * `commandCatalogEntries` is the plugin-command catalog read surface. Reads
 * everything it needs from `RuntimeContext` at call time.
 */
import { projectInteractiveRequests } from "@natalia/session";
import type { RuntimeEvent, SessionID } from "@natalia/contracts";
import type { PluginCommand } from "@natalia/plugin";
import type { RuntimeContext } from "../context";
import type { SessionExecutionState } from "../context";
import { tryReadSlashCommand } from "./slash-read";
import { tryActionSlashCommand } from "./slash-action";

/**
 * The application-layer host allowlist is enforced where fetch-style tools
 * build their request URL; it cannot see traffic a shell command or terminal
 * keystroke opens on its own. Blocklisting `curl` would only be a false sense
 * of safety (`python -c`, `nc`, `/dev/tcp` remain), so the boundary is stated
 * plainly here instead and the real enforcement belongs to the operator's
 * firewall or container network. Runtime doctor and `natalia doctor` share this
 * one string so the two surfaces cannot drift apart.
 */
export const EGRESS_ADVISORY =
  "egress: the application-layer host allowlist only covers fetch-style tools; outbound traffic from run_shell and native terminal input is not constrained here, so configure egress in your firewall or container network";

/** The dependencies every slash handler resolves from the runtime context. */
export type SlashDeps = {
  id: string;
  text: string;
  signal: AbortSignal | undefined;
  commandExec: SessionExecutionState;
  publish: (event: RuntimeEvent) => void;
  runtimeStatusSnapshot: () => Promise<
    Extract<RuntimeEvent, { type: "status.snapshot" }>
  >;
  runtimeContext: SessionExecutionState["context"];
  session: SessionExecutionState["session"];
  provider: SessionExecutionState["provider"];
  selectedAgent: SessionExecutionState["selectedAgent"];
  activeSkill: SessionExecutionState["activeSkill"];
  commandContext: SessionExecutionState["context"];
  sessionStoreController: ReturnType<
    RuntimeContext["ports"]["getSessionStoreController"]
  >;
  sandboxController: SessionExecutionState["provider"] extends never
    ? never
    : ReturnType<RuntimeContext["ports"]["getSandboxController"]>;
  agentRegistry: ReturnType<RuntimeContext["ports"]["getAgentRegistry"]>;
  workspaceRoot: string;
  toolsSize: number;
  providerSource: ReturnType<RuntimeContext["ports"]["getProviderSource"]>;
  runtimeDiagnostics: Array<
    Extract<RuntimeEvent, { type: "diagnostic" }> & { at: string }
  >;
  runtimeDiagnosticsForSession: Array<
    Extract<RuntimeEvent, { type: "diagnostic" }> & { at: string }
  >;
  skillsList: () => import("@natalia/runtime-services").SkillMetadata[];
  skillService: () =>
    | import("@natalia/runtime-services").SkillService
    | undefined;
  clientModelCatalog: RuntimeContext["ports"]["clientModelCatalog"];
  selectRuntimeModel: RuntimeContext["ports"]["selectRuntimeModel"];
  submitInput: RuntimeContext["ports"]["submitInput"];
  applyAgentPolicy: () => void;
  applyAgentProvider: (exec: SessionExecutionState) => void;
  initializeCheckpointController: RuntimeContext["ports"]["initializeCheckpointController"];
  getActiveExec: () => SessionExecutionState | undefined;
  setPaused: (paused: boolean) => void;
};

export function createCommands(ctx: RuntimeContext) {
  return {
    isPendingInteractiveRequest,
    handleCommand,
    commandCatalogEntries,
  };

  function isPendingInteractiveRequest(
    forSessionID: SessionID,
    id: string,
    kind: "approval" | "question",
  ) {
    const { getExecutionBySession } = ctx.ports;
    // D2: the request lives in the session whose turn issued it. A response
    // arriving while the UI is attached to another session must be judged
    // against that session's journal, never the attached one's.
    const target = getExecutionBySession().get(forSessionID)?.session;
    const pending = projectInteractiveRequests(target?.events ?? []);
    return kind === "approval"
      ? pending.approvals.some((request) => request.id === id)
      : pending.questions.some((request) => request.id === id);
  }

  function commandCatalogEntries(): PluginCommand[] {
    const { getCapabilityRegistry } = ctx.ports;
    return getCapabilityRegistry()
      .contributions<PluginCommand>("commands")
      .map((entry) => entry.payload);
  }

  async function handleCommand(
    id: string,
    text: string,
    signal: AbortSignal | undefined,
    commandExec: SessionExecutionState = ctx.ports.getActiveExec()!,
  ) {
    if (!text.trim().startsWith("/")) return false;
    const {
      getStatusController,
      getProviderSource,
      getWorkspaceRoot,
      getSessionStoreController,
      getSandboxController,
      getAgentRegistry,
      setPaused,
      publishForSession,
      skillsList,
      skillService,
      clientModelCatalog,
      selectRuntimeModel,
      submitInput,
      applyAgentPolicy,
      applyAgentProvider,
      initializeCheckpointController,
      getActiveExec,
    } = ctx.ports;
    const { tools, runtimeDiagnostics, runtimeDiagnosticsBySession } =
      ctx.state;
    const commandSession = commandExec.session;
    const commandContext = commandExec.context;
    const commandProvider = commandExec.provider;
    const commandRuntimeStatusSnapshot = () =>
      getStatusController().snapshotFor({
        provider: commandProvider,
        context: commandContext,
        permissionMode: commandExec.permissionMode,
      });
    // Commands run inside a session's drain. Bind their output to that session
    // even when the UI is attached elsewhere.
    const deps: SlashDeps = {
      id,
      text,
      signal,
      commandExec,
      publish: (event) => publishForSession(commandExec, event),
      runtimeStatusSnapshot: commandRuntimeStatusSnapshot,
      runtimeContext: commandContext,
      session: commandSession,
      provider: commandProvider,
      selectedAgent: commandExec.selectedAgent,
      activeSkill: commandExec.activeSkill,
      commandContext,
      sessionStoreController: getSessionStoreController(),
      sandboxController: getSandboxController(),
      agentRegistry: getAgentRegistry(),
      workspaceRoot: getWorkspaceRoot(),
      toolsSize: tools.size,
      providerSource: getProviderSource(),
      runtimeDiagnostics,
      runtimeDiagnosticsForSession:
        runtimeDiagnosticsBySession.get(commandExec.session.id) ?? [],
      skillsList,
      skillService,
      clientModelCatalog,
      selectRuntimeModel,
      submitInput,
      applyAgentPolicy,
      applyAgentProvider,
      initializeCheckpointController,
      getActiveExec,
      setPaused,
    };
    if (await tryReadSlashCommand(deps)) return true;
    return await tryActionSlashCommand(deps);
  }
}
