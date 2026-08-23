import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, dirname, join, resolve } from "node:path";
import { createTitleGeneration } from "./runtime/title-generation";
import { createCheckpointRuntime } from "./runtime/checkpoint-runtime";
import {
  createProviderSelection,
  defaultContextStatusConfig,
} from "./runtime/provider-selection";
import { createPermissions } from "./runtime/permissions";
import { createSnapshot } from "./runtime/snapshot";
import { createTerminalRuntime } from "./runtime/terminal-runtime";
import { createCollaborationBoundary } from "./runtime/collaboration/boundary";
import { createEventSink } from "./runtime/event-sink";
import { createCommands } from "./runtime/commands";
import type { RuntimeContext } from "./runtime/context";
import { createPluginsController } from "./plugins-controller";
import { RuntimeRefusal } from "@natalia/contracts";
import {
  runtimeEventDurability,
  runtimeSlashCommands,
} from "@natalia/contracts";
import {
  findWorkspaceFiles,
  globWorkspaceFiles,
  listWorkspaceFiles,
  readWorkspaceFile,
  searchWorkspaceFiles,
} from "@natalia/platform";
import type {
  ApprovalResponse,
  RuntimeClient,
  RuntimeEvent,
  RuntimeSessionSummary,
  SessionID,
  SubmitInput,
  SubmittedTurn,
  QuestionResponse,
} from "@natalia/contracts";
import {
  ContextWindowResolver,
  contextEntriesToProviderMessages,
  contextStatusEvent,
  MAX_STEPS_PROMPT,
  MISSING_FINAL_RESPONSE_FALLBACK,
  nativeToolCallCorrection,
  normalizeRawToolCallProtocol,
  ProviderConcurrencyLimiter,
  providerForModel,
  requireNativeToolCallProtocol,
  resolveReservedOutputTokens,
  modelsDevModelLimits,
  type ProviderMessage,
  type ProviderToolCall,
  providerFromEnvironment,
  runCheckpointCommand,
  type StreamingProvider,
  withProviderConcurrency,
} from "@natalia/runtime";
import {
  buildModelCatalog,
  discoverProviderModels,
  modelSelectionStatus,
  resolveConfig,
  resolveEffectiveModel,
  resolveTuiConfig,
  saveTuiConfig,
  updateConfigAtScope,
  verifyTrust,
} from "@natalia/config";
import type { ConfigV3, ModelCapabilities } from "@natalia/contracts";
import { modelRefKey, parseModelRef, type ModelRef } from "@natalia/contracts";
import {
  CapabilityRegistry,
  type CapabilityHost,
  type CapabilityRegistryHost,
} from "@natalia/capability";
import { mergeContributedToolSettings } from "./capability-settings";
import {
  agentsFromConfig,
  type AgentDefinition,
  type AgentRegistry,
} from "@natalia/agent";
import {
  appendSessionEvent,
  admitInput,
  admissionCutoff,
  admittedInputs,
  promoteNextQueued,
  projectInteractiveRequests,
  projectSession,
  projectedConstitutionRules,
  projectedDecisionRecords,
  projectedEvidenceRecords,
  projectedCompletions,
  latestSessionSnapshot,
  projectedCanonicalTools,
  projectedDriftFindings,
  projectedWorkGraphNodes,
  projectedWorkGraphEdges,
  projectedMailboxMessages,
  projectedPlans,
  projectedChatMessages,
  projectedCollabMessages,
  settleInterruptedTurns,
  settleInterruptedTurnIDs,
  modelVisibleEvents,
  sessionRunCoordinator,
  type DurableInFlightOperation,
  type SessionRecord,
} from "@natalia/session";
import {
  boundToolOutput,
  cleanupToolOutput,
  createToolRegistry,
  validateToolParameters,
  type RuntimeTool,
  type SubagentRunnerContext,
  type ToolExecutionContext,
  type ToolFamily,
  type ToolMaterialization,
  type ToolRegistry,
  ensureBashCommandParser,
  evaluatePermissionProfileCommandRules,
  TerminalCommandBuffer,
  type PermissionProfileCommandRules,
} from "@natalia/tools";
import {
  foregroundProcessForTTY,
  globalConfigHome,
  userRuntimeHome,
} from "@natalia/platform";
import {
  manifestIntegrationPoints,
  setGlobalPluginCommands,
  type PluginCommand,
} from "@natalia/plugin";
import { moduleToolPolicy } from "@natalia/workflow";
import { toolFamilyCapabilityID } from "./capabilities/tool-family-capabilities";
import {
  ATTACHMENT_PLUGIN_ID,
  builtinPluginCatalog,
  CHECKPOINT_PLUGIN_ID,
  COMPACTION_PLUGIN_ID,
  computeBuiltinFeatureGates,
  CONTEXT_LEDGER_PLUGIN_ID,
  isBuiltinToolPlugin,
  isStaticBuiltinPlugin,
  LOCAL_TOOLS_PLUGIN_ID,
  MCP_PLUGIN_ID,
  PROVIDER_MODEL_PLUGIN_ID,
  RETRY_PLUGIN_ID,
  RUNTIME_UI_PLUGIN_ID,
  SANDBOX_CONTROLLER_PLUGIN_ID,
  SKILLS_PLUGIN_ID,
  TASK_WORKFLOW_PLUGIN_ID,
  TEAM_PLUGIN_ID,
  TERMINAL_CONTROLLER_PLUGIN_ID,
  WORKSPACE_PLUGIN_ID,
} from "@natalia/builtin-plugins";
import { mountRuntimePlugins } from "./builtin-mount";
import { derivePermissionSettings } from "./permission-settings";
import { deriveModelRefKey } from "./model-ref-key";
import {
  deriveAgentToolPolicy,
  deriveProfileToolPolicy,
} from "./tool-policy-derivation";
import {
  buildMailboxQueued,
  buildMailboxStatus,
  createMailboxAcknowledgeTool,
  readOnlyToolMessage,
  terminalApprovalScope,
  terminalInputRisk,
} from "@natalia/runtime-services";
import { parseToolArguments, tryParseToolArguments } from "./tool-arguments";
import { effectiveFlowPermissions } from "@natalia/workflow";
import { buildSessionIntelligenceSnapshot } from "./session-intelligence";

// Re-exported because the policy tests reach for the risk classifier directly and
// this file is the package's runtime entry point.
export { terminalApprovalScope, terminalInputRisk };
import { RuntimePerformanceTrace } from "./performance-trace";
import {
  ATTACHMENT_SERVICE,
  CHECKPOINT_FACTORY_SERVICE,
  COLLABORATION_WAITER_SERVICE,
  COMPACTION_SERVICE,
  CONTEXT_LEDGER_FACTORY_SERVICE,
  GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
  LOCAL_TOOLS_RELOAD_SERVICE,
  MCP_SERVICE,
  PROVIDER_MODEL_CONTROLLER_SERVICE,
  RETRY_SERVICE,
  SANDBOX_SERVICE,
  SESSION_STORE_CONTROLLER_SERVICE,
  SKILL_SERVICE,
  STATUS_SNAPSHOT_CONTROLLER_SERVICE,
  SUBAGENTS_SERVICE,
  TEAM_BEHAVIOR_SERVICE,
  TASK_WORKFLOW_CONTROLLER_SERVICE,
  TERMINAL_CONTROLLER_SERVICE,
  TOOL_POLICY_SERVICE,
  TURN_CONTROLLER_SERVICE,
  WORK_LEDGER_CONTROLLER_SERVICE,
  WORKSPACE_FILES_SERVICE,
  WORKSPACE_MUTATIONS_SERVICE,
  WORKSPACE_WRITE_LOCK_SERVICE,
} from "@natalia/runtime-services";
import type {
  AttachmentService,
  CheckpointController,
  CheckpointFactory,
  CompactionService,
  ContextLedgerFactory,
  GovernanceLedgerController,
  InteractiveWaiter,
  InteractiveWaiterDeps,
  McpService,
  MutationRegistry,
  PlanLifecycleState,
  ProviderModelController,
  ProviderModelControllerInput,
  ProviderRunnerInput,
  RetryService,
  RuntimeServiceClient,
  RuntimeContextLedger,
  SandboxService,
  SessionStoreController,
  SkillMetadata,
  SkillService,
  StatusSnapshotController,
  SubagentsService,
  TeamBehaviorService,
  TaskWorkflowController,
  TerminalController,
  TerminalControllerPluginInput,
  ToolHookEvent,
  ToolHooks,
  ToolPolicy,
  ToolPolicyHookLayer,
  ToolPolicyService,
  TurnController,
  WorkLedgerController,
  WorkspaceFilesController,
  WorkspaceWriteLock,
} from "@natalia/runtime-services";
import type { TaskModuleContext } from "@natalia/workflow";

type PermissionProfile = ConfigV3["permissionProfiles"][string];

function userSkillRoot() {
  const root = join(globalConfigHome(), "natalia-cli", "skills");
  return isAbsolute(root) ? root : undefined;
}

/**
 * Tools whose contract is to block until the screen changes. Calling one
 * repeatedly with identical arguments is how a caller waits for output, so the
 * repeated-call guard would stop legitimate work: the arguments only stay
 * identical while nothing new has arrived, which is exactly when waiting is
 * correct. Each call spends real time inside the tool, so a loop cannot spin,
 * and the turn's step budget still bounds it.
 */
const WAITING_TOOLS = new Set(["terminal_observe"]);
const MAX_PROTOCOL_CORRECTIONS = 2;

// The egress advisory moved to the commands module (runtime/commands.ts); this
// file re-exports it so the existing surface (`runtime doctor`, tests) keeps the
// one shared string.
export { EGRESS_ADVISORY } from "./runtime/commands";

/**
 * Self-protection rules only. These three exist so the agent cannot kill the
 * terminal host it is running under or delete its own runtime directories, and
 * they are deliberately not a general danger list: a blocklist cannot cover an
 * arbitrary byte stream. General command restrictions belong to the agent's
 * `commands.denyPatterns`, and real isolation belongs to the deployment
 * (container, restricted user). Do not grow this list into a substitute for
 * either.
 */
const SELF_PROTECTION_PATTERNS = [
  {
    pattern: /pkill\s+-f\s+wezterm-mux-server/i,
    ruleID: "C-TERM-001",
    statement: "禁止直接杀掉 wezterm-mux-server",
  },
  {
    pattern: /rm\s+-rf\s+\/run\/user\/\d+\/natalia/i,
    ruleID: "C-TERM-002",
    statement: "禁止删除 Natalia 运行时目录",
  },
  {
    pattern: /rm\s+-rf\s+\/tmp\/natalia/i,
    ruleID: "C-TERM-003",
    statement: "禁止删除 Natalia 临时目录",
  },
];

/**
 * The native-terminal registry refuses with plain `Error`s ("terminal input is
 * controlled by a human", "terminal is accepting secure human input", …). Over
 * RPC those would land as `-32603 internal` with no machine-readable reason.
 * The P0-H members classify them as `refused` with the registry's own text as
 * the reason, so a consumer can tell "not now, a human is using it" from "the
 * channel broke" and act on it.
 */
function refusalFromRegistry(error: unknown): RuntimeRefusal {
  return new RuntimeRefusal(
    error instanceof Error ? error.message : String(error),
  );
}

export type RealRuntimeClientOptions = {
  sessionID?: SessionID;
  episodeID?: import("@natalia/contracts").EpisodeID;
  title?: string;
  workspaceRoot?: string;
  /** Override the user-level config path, primarily for isolated hosts/tests. */
  globalConfigPath?: string;
  sessionDir?: string;
  useSqliteStore?: boolean;
  provider?: StreamingProvider;
  tools?: ToolRegistry;
  permissionProfile?: string;
  permissionMode?: "ask" | "auto" | "read_only";
  toolPolicy?: ToolPolicy;
  hooks?: ToolHooks;
  nativeTerminal?: TerminalControllerPluginInput["external"];
  taskModuleContext?: TaskModuleContext;
  /** Host-owned registry shared with task delivery and other capability consumers. */
  capabilityRegistry?: CapabilityRegistry;
  /** Preferred host-owned capability lifetime; survives runtime config reloads. */
  capabilityHost?: CapabilityHost;
};

/**
 * Per-session execution state held by the runtime for each attached session.
 * Module-scoped so the runtime assembly host can thread it without a runtime
 * cycle (type-only imports are erased).
 */
export type SessionExecutionState = {
  session: SessionRecord;
  context: RuntimeContextLedger;
  attachmentReferences: Map<
    string,
    import("@natalia/contracts").LocalAttachment[]
  >;
  toolCalls: Map<string, number>;
  provider?: StreamingProvider;
  runtimeContextConfig: import("./runtime/context").RuntimeContextStatusConfig;
  activeModelCapabilities?: ModelCapabilities;
  permissionMode: "ask" | "auto" | "read_only";
  permissionProfile?: PermissionProfile;
  activeAbort?: AbortController;
  activeTurnID?: string;
  selectedAgent?: AgentDefinition;
  pendingAgent?: AgentDefinition;
  selectedModel?: { modelID?: string; variant?: string };
  reasoningEffort?: import("@natalia/contracts").RuntimeReasoningEffort;
  lastProviderUsage?: { inputTokens: number; outputTokens: number };
  activeSkill?: SkillMetadata;
  endTurnWaitingHuman?: { terminalID: string; reason: string };
  lastSubmitted?: SubmittedTurn;
  paused: boolean;
  pauseWaiters: Array<() => void>;
};

export function createRealRuntimeClient(
  options: RealRuntimeClientOptions = {},
): RuntimeServiceClient {
  let workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  let sessionID: SessionID;
  let sessionStoreController!: SessionStoreController;
  let provider = options.provider;
  let providerSource:
    | "explicit"
    | "environment"
    | "ts_config"
    | "unconfigured" = options.provider ? "explicit" : "unconfigured";
  const capabilityRegistry: CapabilityRegistryHost =
    options.capabilityRegistry ?? new CapabilityRegistry();
  // Built-ins enter this registry only through plugin contributions. Starting
  // empty prevents the former capability-family bootstrap from becoming a
  // second construction path.
  const tools = options.tools ?? createToolRegistry([]);
  const workspaceCapabilityView = options.capabilityHost?.view;
  /**
   * The tool policy funnel, resolved from the `natalia-tool-pipeline` plugin
   * after it loads during `start`. The policy layers are built once the service
   * is in hand; every consumer runs post-start.
   */
  let toolPolicy: ToolPolicyService | undefined;
  let agentToolLayer!: ToolPolicyHookLayer;
  let permissionProfileToolLayer!: ToolPolicyHookLayer;
  let moduleToolLayer!: ToolPolicyHookLayer;
  let modulePermissionToolLayer!: ToolPolicyHookLayer;
  let toolLayer!: ToolPolicyHookLayer;
  const terminalCommandBuffer = new TerminalCommandBuffer({
    // Confirming the pane's foreground program is what lets an authorized
    // interactive program own the pane without reopening the shell bypass: the
    // mode ends as soon as the operating system reports a different program, and
    // input is refused when the host cannot answer at all.
    foregroundProgram: async (paneID) => {
      try {
        const ttyName = await terminalController?.ttyName(paneID);
        if (!ttyName)
          return {
            supported: false as const,
            reason: `pane ${paneID} has no terminal device`,
          };
        return foregroundProcessForTTY(ttyName);
      } catch (error) {
        return {
          supported: false as const,
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
  let permissionMode = options.permissionMode ?? "ask";
  let selectedPermissionProfile: PermissionProfile | undefined;
  let defaultPermissionMode = permissionMode;
  let defaultPermissionProfile: PermissionProfile | undefined;
  let maxSteps: number | undefined;
  let subagentsController: SubagentsService | undefined;
  let providerModelController: ProviderModelController | undefined;
  let taskWorkflowController: TaskWorkflowController | undefined;
  let contextLedgerFactory!: ContextLedgerFactory;
  let workLedgerController!: WorkLedgerController;
  let governanceLedgerController!: GovernanceLedgerController;
  let turnController!: TurnController;
  function requireTaskWorkflow() {
    if (!taskWorkflowController)
      throw new RuntimeRefusal("Task/workflow plugin is disabled.");
    return taskWorkflowController;
  }
  /**
   * Services provided by the terminal/sandbox/mcp built-in plugins, resolved
   * after they load during `start`. All consumers run post-start, so the
   * services are in place by the time they are read.
   */
  let terminalController: TerminalController | undefined;
  let sandboxController: SandboxService | undefined;
  let mcpService: McpService | undefined;
  const pluginsController = createPluginsController({
    workspaceRoot,
    tools,
    capabilityRegistry,
    pluginPaths: () => tsRuntimeConfig?.plugins.paths ?? [],
    externalPluginsEnabled: () => extensionEnabled("plugins"),
    pluginPackages: () => tsRuntimeConfig?.plugins.packages,
    pluginEnabled: () => tsRuntimeConfig?.plugins.enabled,
    pluginCapabilities: () => tsRuntimeConfig?.plugins.capabilities,
    pluginReadOnly: () => tsRuntimeConfig?.plugins.readOnly,
    pluginSettings: () => tsRuntimeConfig?.plugins.settings,
    publish: (event) => ctx.ports.publish(event),
    syncGlobalCommands: () => setGlobalPluginCommands(commandCatalogEntries()),
  });
  let toolCalls = new Map<string, number>();
  let runtimeContext!: RuntimeContextLedger;
  /**
   * Approvals and questions, and everything that belongs to them. The runtime
   * hands over only what changes underneath the waiter, as accessors rather than
   * values: a captured permission mode or abort signal would go stale the moment
   * the mode changed or the turn ended.
   */
  const waiterDeps: InteractiveWaiterDeps = {
    publish: (event) => publish(event),
    sessionID: () => sessionID,
    permissionMode: (turnID) =>
      (turnID ? executionForTurn(turnID) : activeExec)?.permissionMode ??
      permissionMode,
    abortSignal: (turnID) =>
      executionBySession.get(turnSession.get(turnID) ?? sessionID)?.activeAbort
        ?.signal,
    activeTurnID: () => activeExec?.activeTurnID,
    isPending: (sessionID, id, kind) =>
      isPendingInteractiveRequest(sessionID, id, kind),
    sessionIDForTurn: (turnID) => turnSession.get(turnID) ?? sessionID,
    agentIDForTurn: (turnID) => turnAgent.get(turnID),
    capabilityOwnerForTool: (toolName) =>
      capabilityRegistry.ownerOf("tools", toolName),
    workLedger: () => workLedgerController,
    publishForSession: (sessionID, event) =>
      publishForSession(executionBySession.get(sessionID), event),
  };
  /** The interactive waiter, resolved from the collaboration plugin after load. */
  let interactive!: InteractiveWaiter;
  let sink: ((event: RuntimeEvent) => void) | undefined;
  let replayMode: "all" | "none" = "all";
  let session: SessionRecord | undefined;
  let lastSubmitted: SubmittedTurn | undefined;
  let activeAbort: AbortController | undefined;
  let activeTurnID: string | undefined;
  /**
   * TERM-M.3 (c): set when the model's request_human call ends the turn on
   * purpose; consumed by the turn-finish path in `publish`.
   */
  let endTurnWaitingHuman: { terminalID: string; reason: string } | undefined;
  /**
   * Which session each turn was submitted to. With parallel sessions a turn
   * keeps running after the UI attaches elsewhere, and its approvals must be
   * judged against the session it belongs to — never the attached one.
   */
  const turnSession = new Map<string, SessionID>();
  /** Bounded, non-durable Main output used while a turn is still streaming. */
  const liveMainOutputByTurn = new Map<string, string>();
  /** Child turn ownership keeps interactive events in the child projection. */
  const turnAgent = new Map<string, string>();
  /**
   * Everything a running turn reads and writes, keyed per session (D2: one
   * turn per session, sessions in parallel). The runtime keeps one activity
   * exec — the session the UI is attached to — and one exec per session that
   * has background work. Plan §41.9: state is reached by session, never
   * captured as a single value.
   */
  const executionBySession = new Map<SessionID, SessionExecutionState>();
  let activeExec: SessionExecutionState | undefined;
  const checkpointControllerBySession = new Map<
    SessionID,
    CheckpointController
  >();
  const checkpointInitBySession = new Map<SessionID, Promise<void>>();
  let activeCheckpointFactory: CheckpointFactory | undefined;

  function executionForTurn(turnID: string) {
    return executionBySession.get(turnSession.get(turnID) ?? sessionID);
  }
  /**
   * Workspace services, resolved from the workspace built-in plugin after it
   * loads during `start`. All consumers run post-start, so the services are in
   * place by the time they are read.
   */
  let workspaceWriteLock: WorkspaceWriteLock | undefined;
  let mutationRegistry: MutationRegistry | undefined;
  let workspaceFilesController: WorkspaceFilesController | undefined;
  /** The write lock is the single-writer guarantee: a write tool without it
   * must not proceed. */
  function requireWriteLock(): WorkspaceWriteLock {
    if (!workspaceWriteLock)
      throw new Error("workspace write lock unavailable");
    return workspaceWriteLock;
  }
  /** Sandbox RPCs need the controller; its absence is a host misconfiguration. */
  function requireSandboxes() {
    if (!sandboxController) throw new Error("sandbox controller unavailable");
    return sandboxController;
  }
  let paused = false;
  let pauseWaiters: Array<() => void> = [];
  let ready: Promise<void> | undefined;
  const skillService = () =>
    capabilityRegistry.service<SkillService>(SKILL_SERVICE);
  const skillsList = () => skillService()?.list() ?? [];
  const teamBehavior = () =>
    capabilityRegistry.service<TeamBehaviorService>(TEAM_BEHAVIOR_SERVICE);
  let activeSkill: SkillMetadata | undefined;
  let attachmentReferences = new Map<
    string,
    import("@natalia/contracts").LocalAttachment[]
  >();
  type RuntimeDiagnostic = Extract<RuntimeEvent, { type: "diagnostic" }> & {
    at: string;
  };
  const runtimeDiagnosticsBySession = new Map<SessionID, RuntimeDiagnostic[]>();
  const runtimeDiagnostics: RuntimeDiagnostic[] = [];
  let selectedAgent: AgentDefinition | undefined;
  let selectedModel: { modelID?: string; variant?: string } | undefined;
  let pendingAgent: AgentDefinition | undefined;
  let agentRegistry: AgentRegistry | undefined;
  let lastProviderUsage:
    | { inputTokens: number; outputTokens: number }
    | undefined;
  let sessionPersistence = Promise.resolve();
  const nativeRuntimeID = randomUUID();
  let tsRuntimeConfig:
    | Awaited<ReturnType<typeof resolveConfig>>["config"]
    | undefined;
  let activeExternalPluginConfigFingerprint: string | undefined;
  let builtinPluginIDs = new Set<string>();
  let buildBuiltinPluginCatalog!: (
    config: ConfigV3,
  ) => ReturnType<typeof builtinPluginCatalog>;
  const contextWindowResolver = new ContextWindowResolver();
  let runtimeContextConfig = defaultContextStatusConfig();
  let retryPolicy: import("@natalia/runtime").RetryRunnerOptions["policy"];
  let retryService!: RetryService;
  let attachmentService!: AttachmentService;
  let compactionService: CompactionService | undefined;
  /** Per-provider in-flight ceiling for parallel streams (the fan-out cap). */
  let providerConcurrencyLimiter = new ProviderConcurrencyLimiter({});
  let statusController: StatusSnapshotController;
  async function runtimeStatusSnapshot() {
    return await statusController.snapshot();
  }

  function scheduleRuntimeStatusSnapshot() {
    statusController.schedule();
  }
  const terminalStatusByID = new Map<string, string>();
  const performanceTrace = new RuntimePerformanceTrace();
  const sandboxResourcesByID = new Map<string, number>();
  const turnCoordinator = () => sessionRunCoordinator(sessionID);
  /**
   * P8 C1 writer state: the currently running tool per turn, kept current at
   * the same single choke point the Work Graph writer uses, so a session
   * intelligence snapshot can answer "what tool is running now" from real state
   * instead of guessing.
   */
  const activeToolByTurn = new Map<string, string>();
  let decisionSequence = 0;
  let evidenceSequence = 0;
  let mailboxSequence = 0;
  let chatSequence = 0;
  let collabSequence = 0;
  const internalWakeTasks = new Set<Promise<unknown>>();
  let planSequence = 0;
  let completionSequence = 0;
  // Architecture convergence: the single shared port bag every runtime module
  // reads at call time. Modules never import one another; they communicate
  // through this context. (convergence plan §3.1)
  const ctx = {
    state: {},
    ports: {},
  } as unknown as RuntimeContext;
  let runtimeDisposed = false;
  ctx.state.titleGenerationTasks = new Map<
    SessionID,
    {
      input: string;
      timer?: ReturnType<typeof setTimeout>;
      controller?: AbortController;
      promise?: Promise<void>;
    }
  >();
  ctx.ports.isDisposed = () => runtimeDisposed;
  ctx.ports.getSessionStoreController = () => sessionStoreController;
  ctx.ports.getSessionPersistence = () => sessionPersistence;
  ctx.ports.getProviderConcurrencyLimiter = () => providerConcurrencyLimiter;
  ctx.ports.getExecutionBySession = () => executionBySession;
  ctx.ports.getActiveExec = () => activeExec;
  ctx.ports.scheduleRuntimeStatusSnapshot = scheduleRuntimeStatusSnapshot;
  ctx.ports.runtimeStatusSnapshot = runtimeStatusSnapshot;
  ctx.ports.ensureExecution = ensureExecution;
  ctx.ports.skillService = skillService;
  ctx.ports.skillsList = skillsList;
  ctx.ports.teamBehavior = teamBehavior;
  ctx.ports.providerRunnerInput = providerRunnerInput;
  ctx.ports.getStatusController = () => statusController;
  ctx.ports.getProviderSource = () => providerSource;
  ctx.ports.getWorkspaceRoot = () => workspaceRoot;
  ctx.ports.getSandboxController = () => sandboxController;
  ctx.ports.getAgentRegistry = () => agentRegistry;
  ctx.ports.setPaused = (value) => {
    paused = value;
  };
  ctx.ports.getPaused = () => paused;
  ctx.ports.getCapabilityRegistry = () => capabilityRegistry;
  ctx.ports.submitInput = submitInput;
  ctx.ports.getTsRuntimeConfig = () => tsRuntimeConfig;
  ctx.ports.getSubagentsController = () => subagentsController;
  ctx.ports.getWorkLedgerController = () => workLedgerController;
  ctx.ports.getSelectedAgent = () => selectedAgent;
  ctx.ports.getSelectedModel = () => selectedModel;
  ctx.ports.getMaxSteps = () => maxSteps;
  ctx.ports.getReady = () => ready;
  ctx.ports.getContextWindowResolver = () => contextWindowResolver;
  ctx.ports.setProvider = (value) => {
    provider = value;
  };
  ctx.ports.setSelectedModel = (value) => {
    selectedModel = value;
  };
  ctx.ports.setRuntimeContextConfig = (value) => {
    runtimeContextConfig = value;
  };
  ctx.ports.getRuntimeContextConfig = () => runtimeContextConfig;
  ctx.ports.getWorkspaceFilesController = () => workspaceFilesController;
  ctx.ports.nextMailboxSequence = () => mailboxSequence++;
  ctx.ports.setSessionPersistence = (next) => {
    sessionPersistence = next;
  };
  ctx.ports.redactToolOutput = redactToolOutput;
  ctx.state.activeToolByTurn = activeToolByTurn;
  ctx.state.liveMainOutputByTurn = liveMainOutputByTurn;
  ctx.state.terminalStatusByID = terminalStatusByID;
  ctx.state.turnSession = turnSession;
  ctx.state.pluginsController = pluginsController;
  ctx.state.performanceTrace = performanceTrace;
  ctx.ports.getSink = () => sink;
  const terminalRuntime = createTerminalRuntime(ctx);
  const {
    setPendingHumanTerminal,
    clearPendingHumanTerminal,
    maybeContinueAfterHumanInput,
    publishTerminalSession,
    terminalLiveUpdate,
    publishTerminalViewer,
  } = terminalRuntime;
  ctx.ports.getToolPolicy = () => toolPolicy;
  ctx.ports.getToolLayer = () => toolLayer;
  ctx.ports.getAgentToolLayer = () => agentToolLayer;
  ctx.ports.getPermissionProfileToolLayer = () => permissionProfileToolLayer;
  ctx.ports.getModuleToolLayer = () => moduleToolLayer;
  ctx.ports.getModulePermissionToolLayer = () => modulePermissionToolLayer;
  ctx.ports.setToolLayer = (layer) => {
    toolLayer = layer;
  };
  ctx.ports.setAgentToolLayer = (layer) => {
    agentToolLayer = layer;
  };
  ctx.ports.setPermissionProfileToolLayer = (layer) => {
    permissionProfileToolLayer = layer;
  };
  ctx.ports.getPermissionMode = () => permissionMode;
  ctx.ports.setPermissionMode = (mode) => {
    permissionMode = mode;
  };
  ctx.ports.getSelectedPermissionProfile = () => selectedPermissionProfile;
  ctx.ports.setSelectedPermissionProfile = (profile) => {
    selectedPermissionProfile = profile;
  };
  ctx.ports.getDefaultPermissionMode = () => defaultPermissionMode;
  ctx.ports.setDefaultPermissionMode = (mode) => {
    defaultPermissionMode = mode;
  };
  ctx.ports.getDefaultPermissionProfile = () => defaultPermissionProfile;
  ctx.ports.setDefaultPermissionProfile = (profile) => {
    defaultPermissionProfile = profile;
  };
  const permissions = createPermissions(ctx, options);
  const {
    applyAgentPolicy,
    agentPolicyLayer,
    permissionProfileLayer,
    reloadPermissionSettings,
    isToolAllowed,
    extensionEnabled,
    extensionToolPermission,
  } = permissions;
  const collaborationBoundary = createCollaborationBoundary(ctx);
  const {
    settleMailboxAtBoundary,
    acknowledgeDeliveredMailboxAtBoundary,
    deliverQueuedMailboxAtBoundary,
    activateQueuedPlanAtBoundary,
    reconcileWorkspaceObservation,
  } = collaborationBoundary;
  const snapshot = createSnapshot(ctx);
  const {
    toolEventTurnID,
    isSessionSnapshotTrigger,
    currentSessionSnapshot,
    publishSessionSnapshot,
    runtimeEventFlushBarrier,
    setInFlightOperation,
    setInFlightOperationFor,
  } = snapshot;
  ctx.ports.setInFlightOperation = setInFlightOperation;
  ctx.ports.setPendingHumanTerminal = setPendingHumanTerminal;
  ctx.ports.maybeContinueAfterHumanInput = maybeContinueAfterHumanInput;
  ctx.ports.settleMailboxAtBoundary = settleMailboxAtBoundary;
  ctx.ports.activateQueuedPlanAtBoundary = activateQueuedPlanAtBoundary;
  ctx.ports.reconcileWorkspaceObservation = reconcileWorkspaceObservation;
  ctx.ports.toolEventTurnID = toolEventTurnID;
  ctx.ports.isSessionSnapshotTrigger = isSessionSnapshotTrigger;
  ctx.ports.publishSessionSnapshot = publishSessionSnapshot;
  const eventSink = createEventSink(ctx, options);
  const { publish, publishForSession } = eventSink;
  ctx.ports.publish = publish;
  ctx.ports.publishForSession = publishForSession;
  const providerSelection = createProviderSelection(ctx, options);
  const {
    currentModelImageInput,
    currentModelPdfInput,
    modelCapabilitiesForExecution,
    mediaTypeForImage,
    applyAgentProvider,
    refreshExecutionContextConfig,
    modelRefKeyForSelection,
    selectedModelRefKey,
    effectiveMaxSteps,
    redactToolOutputEnabled,
    selectRuntimeModel,
    clientModelCatalog,
    resolveContextStatusConfig,
  } = providerSelection;
  ctx.ports.clientModelCatalog = clientModelCatalog;
  ctx.ports.selectRuntimeModel = selectRuntimeModel;
  ctx.ports.applyAgentProvider = applyAgentProvider;
  ctx.ports.applyAgentPolicy = applyAgentPolicy;
  ctx.state.runtimeDiagnostics = runtimeDiagnostics;
  ctx.state.runtimeDiagnosticsBySession = runtimeDiagnosticsBySession;
  ctx.state.tools = tools;
  ctx.state.checkpointControllerBySession = checkpointControllerBySession;
  ctx.state.checkpointInitBySession = checkpointInitBySession;
  const { checkpointControllerFor, initializeCheckpointController } =
    createCheckpointRuntime(ctx);
  ctx.ports.initializeCheckpointController = initializeCheckpointController;
  const { rememberTitleInput, scheduleTitleGeneration, cancelTitleGeneration } =
    createTitleGeneration(ctx);
  const { isPendingInteractiveRequest, handleCommand, commandCatalogEntries } =
    createCommands(ctx);
  ctx.ports.commandCatalogEntries = commandCatalogEntries;

  /**
   * Re-reads the config and re-resolves the provider from it.
   *
   * Reports both facts separately because they are separately interesting: the
   * file may be readable and applied while naming the same provider as before,
   * and a caller that only learns "false" cannot tell that from "the file could
   * not be read at all".
   */
  /**
   * Why a config reload cannot be applied at this instant, or nothing when it can.
   * Shared by the query and the action so the two can never disagree.
   */
  function configReloadBlockedReason() {
    if ([...executionBySession.values()].some((exec) => exec.activeTurnID))
      return "runtime config cannot be applied while a turn is running";
    if (interactive?.hasPendingWaiters())
      return "runtime config cannot be applied while an approval or question is pending";
    return undefined;
  }

  /**
   * Reloads config from disk and applies it, answering value-style. Shared by
   * `reloadConfig` and `updateConfig` so the two write-apply paths cannot
   * drift.
   */
  async function applyConfigFromDisk(): Promise<{
    applied: boolean;
    reason?: string;
  }> {
    const blocked = configReloadBlockedReason();
    if (blocked) return { applied: false, reason: blocked };
    const reloaded = await reloadConfigFromDisk();
    if (!reloaded.read) {
      const reason = "runtime config on disk could not be read";
      publish({ type: "diagnostic", level: "warning", message: reason });
      return { applied: false, reason };
    }
    if (reloaded.reason) {
      publish({
        type: "diagnostic",
        level: "warning",
        message: reloaded.reason,
      });
      return { applied: false, reason: reloaded.reason };
    }
    publish({
      type: "diagnostic",
      level: "info",
      message: reloaded.providerReconfigured
        ? "runtime config reloaded; provider reconfigured from disk"
        : "runtime config reloaded; provider unchanged",
    });
    scheduleRuntimeStatusSnapshot();
    return { applied: true };
  }

  async function reloadConfigFromDisk(): Promise<{
    read: boolean;
    providerReconfigured: boolean;
    reason?: string;
  }> {
    try {
      const tsConfig = await resolveConfig({
        workspaceRoot,
        globalPath: options.globalConfigPath,
      });
      const nextExternalPluginConfigFingerprint =
        externalPluginConfigFingerprint(tsConfig.config);
      const reconcilePlugins =
        activeExternalPluginConfigFingerprint !== undefined &&
        nextExternalPluginConfigFingerprint !==
          activeExternalPluginConfigFingerprint;
      tsRuntimeConfig = tsConfig.config;
      maxSteps = tsConfig.config.runtime.maxStepsPerTurn;
      retryPolicy = {
        maxAttemptsPerStep: tsConfig.config.runtime.retry.maxAttemptsPerStep,
        initialBackoffMs: tsConfig.config.runtime.retry.initialBackoffMs,
        maxBackoffMs: tsConfig.config.runtime.retry.maxBackoffMs,
        jitterMs: tsConfig.config.runtime.retry.jitterMs,
      };
      providerConcurrencyLimiter = new ProviderConcurrencyLimiter(
        tsConfig.config.runtime.providerConcurrency ?? {},
      );
      const selectedAgentName = selectedAgent?.name;
      agentRegistry = agentsFromConfig(tsConfig.config);
      selectedAgent = selectedAgentName
        ? (agentRegistry.select(selectedAgentName) ?? agentRegistry.default())
        : agentRegistry.default();
      for (const exec of executionBySession.values()) {
        const name = exec.selectedAgent?.name;
        exec.selectedAgent = name
          ? (agentRegistry.select(name) ?? agentRegistry.default())
          : agentRegistry.default();
      }
      // Permission changes (default profile switch, auto/ask flip, profile
      // edits) apply immediately, not on the next restart.
      reloadPermissionSettings(tsConfig.config);
      for (const exec of executionBySession.values()) {
        exec.permissionMode = permissionMode;
        exec.permissionProfile = selectedPermissionProfile;
      }
      const toolsBeforeReconcile = new Set(tools.keys());
      const selectedSkills = new Map(
        [...executionBySession.entries()].flatMap(([id, exec]) =>
          exec.activeSkill ? [[id, exec.activeSkill.qualifiedName]] : [],
        ),
      );
      const desiredBuiltins = buildBuiltinPluginCatalog(tsConfig.config);
      builtinPluginIDs = new Set(desiredBuiltins.map((entry) => entry.id));
      await pluginsController.reconcileDesiredBuiltins(
        desiredBuiltins,
        tsConfig.config.plugins.settings,
      );
      await refreshBuiltinServices(selectedSkills);
      if (reconcilePlugins) await pluginsController.reconcile();
      publishToolCatalogChanges(toolsBeforeReconcile);
      activeExternalPluginConfigFingerprint =
        nextExternalPluginConfigFingerprint;
      applyAgentPolicy();
      if (
        selectedPermissionProfile?.commandRules &&
        selectedPermissionProfile.commandRules.mode !== "none"
      )
        await ensureBashCommandParser().catch(() => undefined);
      if (!options.provider) {
        const configured = providerForModel(
          tsConfig.config,
          selectedAgent?.model ?? tsConfig.config.defaultModel,
          selectedAgent?.variant,
        );
        if (configured) {
          provider = configured;
          providerSource = "ts_config";
          for (const exec of executionBySession.values())
            applyAgentProvider(exec);
          runtimeContextConfig = await resolveContextStatusConfig(
            tsConfig.config,
            provider,
            contextWindowResolver,
            modelRefKeyForSelection(selectedAgent, selectedModel),
          );
          for (const exec of executionBySession.values())
            await refreshExecutionContextConfig(exec);
          return { read: true, providerReconfigured: true };
        }
      }
      runtimeContextConfig = await resolveContextStatusConfig(
        tsConfig.config,
        provider,
        contextWindowResolver,
        modelRefKeyForSelection(selectedAgent, selectedModel),
      );
      for (const exec of executionBySession.values())
        await refreshExecutionContextConfig(exec);
      return { read: true, providerReconfigured: false };
    } catch (error) {
      return {
        read: true,
        providerReconfigured: false,
        reason: `runtime config could not be applied: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  async function refreshBuiltinServices(
    selectedSkills: Map<SessionID, string> = new Map(),
  ) {
    const previousTerminal = terminalController;
    const previousSandbox = sandboxController;
    const previousMcp = mcpService;
    const previousContextLedgerFactory = contextLedgerFactory;
    const nextCheckpointFactory = capabilityRegistry.service<CheckpointFactory>(
      CHECKPOINT_FACTORY_SERVICE,
    );

    workspaceWriteLock = capabilityRegistry.service<WorkspaceWriteLock>(
      WORKSPACE_WRITE_LOCK_SERVICE,
    );
    mutationRegistry = capabilityRegistry.service<MutationRegistry>(
      WORKSPACE_MUTATIONS_SERVICE,
    );
    workspaceFilesController =
      capabilityRegistry.service<WorkspaceFilesController>(
        WORKSPACE_FILES_SERVICE,
      );
    terminalController = capabilityRegistry.service<TerminalController>(
      TERMINAL_CONTROLLER_SERVICE,
    );
    sandboxController =
      capabilityRegistry.service<SandboxService>(SANDBOX_SERVICE);
    mcpService = capabilityRegistry.service<McpService>(MCP_SERVICE);
    subagentsController =
      capabilityRegistry.service<SubagentsService>(SUBAGENTS_SERVICE);
    providerModelController =
      capabilityRegistry.service<ProviderModelController>(
        PROVIDER_MODEL_CONTROLLER_SERVICE,
      );
    taskWorkflowController = capabilityRegistry.service<TaskWorkflowController>(
      TASK_WORKFLOW_CONTROLLER_SERVICE,
    );
    compactionService =
      capabilityRegistry.service<CompactionService>(COMPACTION_SERVICE);

    const nextSessionStore = capabilityRegistry.service<SessionStoreController>(
      SESSION_STORE_CONTROLLER_SERVICE,
    );
    if (nextSessionStore) sessionStoreController = nextSessionStore;
    const nextToolPolicy =
      capabilityRegistry.service<ToolPolicyService>(TOOL_POLICY_SERVICE);
    if (nextToolPolicy) toolPolicy = nextToolPolicy;
    const nextInteractive = capabilityRegistry.service<InteractiveWaiter>(
      COLLABORATION_WAITER_SERVICE,
    );
    if (nextInteractive) interactive = nextInteractive;
    const nextAttachment =
      capabilityRegistry.service<AttachmentService>(ATTACHMENT_SERVICE);
    if (nextAttachment) attachmentService = nextAttachment;
    const nextRetry = capabilityRegistry.service<RetryService>(RETRY_SERVICE);
    if (nextRetry) retryService = nextRetry;
    const nextContextLedgerFactory =
      capabilityRegistry.service<ContextLedgerFactory>(
        CONTEXT_LEDGER_FACTORY_SERVICE,
      );
    if (nextContextLedgerFactory) {
      contextLedgerFactory = nextContextLedgerFactory;
      if (previousContextLedgerFactory !== nextContextLedgerFactory)
        runtimeContext = nextContextLedgerFactory.create();
    }
    const nextStatusController =
      capabilityRegistry.service<StatusSnapshotController>(
        STATUS_SNAPSHOT_CONTROLLER_SERVICE,
      );
    if (nextStatusController) statusController = nextStatusController;
    const nextWorkLedger = capabilityRegistry.service<WorkLedgerController>(
      WORK_LEDGER_CONTROLLER_SERVICE,
    );
    if (nextWorkLedger) workLedgerController = nextWorkLedger;
    const nextGovernance =
      capabilityRegistry.service<GovernanceLedgerController>(
        GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
      );
    if (nextGovernance) governanceLedgerController = nextGovernance;
    const nextTurnController = capabilityRegistry.service<TurnController>(
      TURN_CONTROLLER_SERVICE,
    );
    if (nextTurnController) turnController = nextTurnController;

    if (nextCheckpointFactory !== activeCheckpointFactory) {
      checkpointControllerBySession.clear();
      checkpointInitBySession.clear();
      activeCheckpointFactory = nextCheckpointFactory;
    }
    if (mcpService && mcpService !== previousMcp) await mcpService.reload();
    if (terminalController && terminalController !== previousTerminal) {
      await terminalController.init();
      terminalController.setActiveSession(sessionID);
    }
    if (sandboxController && sandboxController !== previousSandbox)
      await sandboxController.init();

    const registry = skillService();
    for (const [id, exec] of executionBySession) {
      const qualifiedName = selectedSkills.get(id);
      if (!qualifiedName || !registry) {
        exec.activeSkill = undefined;
        continue;
      }
      try {
        exec.activeSkill = registry.resolve(qualifiedName);
      } catch {
        exec.activeSkill = undefined;
      }
    }
    activeSkill = activeExec?.activeSkill;
  }

  async function initialize() {
    try {
      const tsConfig = await resolveConfig({
        workspaceRoot,
        globalPath: options.globalConfigPath,
      });
      tsRuntimeConfig = tsConfig.config;
      const runtimeConfig = tsConfig.config;
      // The permission profile's extension gates (skills/mcp/plugins) must be
      // applied before the plugin catalog is assembled, or a disabled extension
      // would still load its plugin.
      reloadPermissionSettings(tsConfig.config);
      buildBuiltinPluginCatalog = (runtimeConfig) => {
        const pluginEnabled = (id: string) =>
          runtimeConfig.plugins.enabled[id] !== false;
        const attachmentEnabled = pluginEnabled("natalia-attachment");
        const retryEnabled = pluginEnabled("natalia-retry");
        const contextLedgerEnabled = pluginEnabled("natalia-context-ledger");
        const sessionStoreEnabled =
          pluginEnabled("natalia-session-store") && attachmentEnabled;
        const workLedgerEnabled = pluginEnabled("natalia-work-ledger");
        const sandboxControllerEnabled = pluginEnabled(
          SANDBOX_CONTROLLER_PLUGIN_ID,
        );
        const subagentsEnabled = pluginEnabled("natalia-subagents");
        const localTools = localToolsPluginInput(runtimeConfig);
        return builtinPluginCatalog({
          ...computeBuiltinFeatureGates({
            config: tsRuntimeConfig,
            hasCustomTools: !!options.tools,
            extensionEnabled,
          }),
          ...(skillsPluginInput(runtimeConfig)
            ? {
                skills: skillsPluginInput(runtimeConfig),
              }
            : {}),
          ...(options.taskModuleContext
            ? { taskModule: options.taskModuleContext }
            : {}),
          ...(tsRuntimeConfig ? { runtimeConfig: tsRuntimeConfig } : {}),
          ...(localTools ? { localTools } : {}),
          workspace: workspacePluginInput(runtimeConfig),
          terminal: terminalPluginInput(runtimeConfig),
          sandbox: sandboxPluginInput(runtimeConfig),
          ...(mcpPluginInput(runtimeConfig)
            ? { mcp: mcpPluginInput(runtimeConfig) }
            : {}),
          ...(pluginEnabled("natalia-checkpoint")
            ? { checkpoint: { workspaceRoot } }
            : {}),
          ...(subagentsEnabled
            ? {
                subagents: {
                  workDir: workspaceRoot,
                  sessionID: () => sessionID,
                },
              }
            : {}),
          ...(attachmentEnabled
            ? { attachment: { enabled: true, workspaceRoot } }
            : {}),
          ...(sessionStoreEnabled
            ? {
                sessionStore: {
                  workspaceRoot,
                  sessionID: () => sessionID,
                  sessionDir: options.sessionDir,
                  useSqliteStore: options.useSqliteStore,
                  title: options.title,
                },
              }
            : {}),
          ...(pluginEnabled("natalia-team") &&
          sandboxControllerEnabled &&
          subagentsEnabled
            ? {
                team: {
                  enabled:
                    extensionEnabled("plugins") || extensionEnabled("skills"),
                },
              }
            : {}),
          ...(pluginEnabled("natalia-tool-pipeline")
            ? { toolPipeline: { enabled: true } }
            : {}),
          ...(pluginEnabled("natalia-collaboration")
            ? { collaboration: { waiter: waiterDeps } }
            : {}),
          ...(retryEnabled
            ? { retry: { enabled: true, policy: () => retryPolicy } }
            : {}),
          compaction: compactionPluginInput(runtimeConfig),
          providerModel: providerModelPluginInput(runtimeConfig),
          taskWorkflow: {
            enabled:
              runtimeConfig.plugins.enabled[TASK_WORKFLOW_PLUGIN_ID] !== false,
            controller: {
              workspaceRoot,
              globalConfigPath: options.globalConfigPath,
              runtimeConfig: () => tsRuntimeConfig,
              capabilityViews: () => [
                capabilityRegistry,
                ...(workspaceCapabilityView ? [workspaceCapabilityView] : []),
              ],
              publishDiagnostic: (message) =>
                publish({ type: "diagnostic", level: "warning", message }),
              resolveFlowPermissions: effectiveFlowPermissions,
              createRuntimeClient: (input) => createRealRuntimeClient(input),
            },
          },
          ...(contextLedgerEnabled ? { contextLedger: { enabled: true } } : {}),
          workLedger: {
            enabled: workLedgerEnabled,
            controller: {
              openFindingIDs: () =>
                new Set(
                  (session?.events ?? [])
                    .filter(
                      (
                        event,
                      ): event is Extract<
                        RuntimeEvent,
                        { type: "drift.finding_opened" }
                      > => event.type === "drift.finding_opened",
                    )
                    .map((event) => event.findingID),
                ),
            },
          },
          ...(pluginEnabled("natalia-governance-ledger") && workLedgerEnabled
            ? { governanceLedger: { enabled: true } }
            : {}),
          turnOrchestration: {
            enabled:
              sessionStoreEnabled &&
              runtimeConfig.plugins.enabled["natalia-turn-orchestration"] !==
                false,
            controller: {
              session: () => session,
              activeAbort: () => activeAbort,
              sessionFor: (id) =>
                executionBySession.get(id as SessionID)?.session ?? session,
              activeAbortFor: (id) =>
                executionBySession.get(id as SessionID)?.activeAbort,
              persist: (fn) => {
                sessionPersistence = sessionPersistence
                  .then(fn)
                  .catch((error) =>
                    publish({
                      type: "diagnostic",
                      level: "warning",
                      message: `session persistence deferred/failed: ${error instanceof Error ? error.message : String(error)}`,
                    }),
                  );
                return sessionPersistence;
              },
              saveInbox: async (snapshot) => {
                await sessionStoreController?.saveInbox(snapshot);
              },
              flush: async () => {
                await sessionPersistence;
              },
              runCommand: async (id, text, signal, ownerID) => {
                const owner = await ensureExecution(ownerID as SessionID);
                publishForSession(owner, { type: "turn.started", id });
                try {
                  return await handleCommand(id, text, signal, owner);
                } catch (error) {
                  publishForSession(owner, {
                    type: "turn.cancelled",
                    id,
                    reason:
                      error instanceof Error ? error.message : String(error),
                  });
                  throw error;
                } finally {
                  scheduleTitleGeneration(ownerID as SessionID);
                }
              },
              runTurn: async (input) => {
                deliverQueuedMailboxAtBoundary(
                  executionBySession.get(input.sessionID as SessionID),
                );
                try {
                  if (providerModelController)
                    await providerModelController.runTurn(
                      input.sessionID as SessionID,
                      input,
                    );
                  else {
                    const exec = executionBySession.get(
                      input.sessionID as SessionID,
                    );
                    publishForSession(exec, {
                      type: "diagnostic",
                      level: "error",
                      message: "Provider/model plugin is disabled.",
                    });
                    publishForSession(exec, {
                      type: "turn.finished",
                      id: input.id,
                      stopReason: "error",
                    });
                  }
                } finally {
                  scheduleTitleGeneration(input.sessionID as SessionID);
                }
              },
            },
          },
          runtimeUi: {
            enabled:
              runtimeConfig.plugins.enabled[RUNTIME_UI_PLUGIN_ID] !== false,
            controller: {
              provider: () => provider,
              context: () => runtimeContext,
              workspaceRoot,
              permissionMode: () => permissionMode,
              runningCount: async () =>
                (subagentsController?.runningCount() ?? 0) +
                (sandboxController?.runningResourceCount() ?? 0) +
                ((await capabilityRegistry
                  .service<{
                    runningCount(input: {
                      workspaceRoot: string;
                    }): Promise<number>;
                  }>("managedProcessRegistry")
                  ?.runningCount({ workspaceRoot })) ?? 0),
              publish,
            },
          },
        });
      };
      const builtinPlugins = buildBuiltinPluginCatalog(runtimeConfig);
      builtinPluginIDs = new Set(builtinPlugins.map((entry) => entry.id));
      activeExternalPluginConfigFingerprint = externalPluginConfigFingerprint(
        tsConfig.config,
      );
      await mountRuntimePlugins({
        controller: pluginsController,
        builtins: builtinPlugins,
        settings: tsRuntimeConfig?.plugins.settings,
        loadExternal: extensionEnabled("plugins"),
      });
      activeCheckpointFactory = capabilityRegistry.service<CheckpointFactory>(
        CHECKPOINT_FACTORY_SERVICE,
      );
      // The workspace built-in provides these services during its setup; every
      // consumer below runs after this point.
      workspaceWriteLock = capabilityRegistry.service<WorkspaceWriteLock>(
        WORKSPACE_WRITE_LOCK_SERVICE,
      );
      mutationRegistry = capabilityRegistry.service<MutationRegistry>(
        WORKSPACE_MUTATIONS_SERVICE,
      );
      workspaceFilesController =
        capabilityRegistry.service<WorkspaceFilesController>(
          WORKSPACE_FILES_SERVICE,
        );
      terminalController = capabilityRegistry.service<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      sandboxController =
        capabilityRegistry.service<SandboxService>(SANDBOX_SERVICE);
      mcpService = capabilityRegistry.service<McpService>(MCP_SERVICE);
      subagentsController =
        capabilityRegistry.service<SubagentsService>(SUBAGENTS_SERVICE);
      const resolvedSessionStore =
        capabilityRegistry.service<SessionStoreController>(
          SESSION_STORE_CONTROLLER_SERVICE,
        );
      if (!resolvedSessionStore)
        throw new Error("session store unavailable (natalia-session-store)");
      sessionStoreController = resolvedSessionStore;
      toolPolicy =
        capabilityRegistry.service<ToolPolicyService>(TOOL_POLICY_SERVICE);
      if (!toolPolicy)
        throw new Error("tool pipeline unavailable (natalia-tool-pipeline)");
      const resolvedWaiter = capabilityRegistry.service<InteractiveWaiter>(
        COLLABORATION_WAITER_SERVICE,
      );
      if (!resolvedWaiter)
        throw new Error(
          "collaboration waiter unavailable (natalia-collaboration)",
        );
      interactive = resolvedWaiter;
      const resolvedProviderModel =
        capabilityRegistry.service<ProviderModelController>(
          PROVIDER_MODEL_CONTROLLER_SERVICE,
        );
      providerModelController = resolvedProviderModel;
      taskWorkflowController =
        capabilityRegistry.service<TaskWorkflowController>(
          TASK_WORKFLOW_CONTROLLER_SERVICE,
        );
      agentToolLayer = toolPolicy.createHookLayer();
      permissionProfileToolLayer = toolPolicy.createHookLayer();
      moduleToolLayer = toolPolicy.createHookLayer(
        options.taskModuleContext
          ? moduleToolPolicy(options.taskModuleContext.moduleType)
          : undefined,
      );
      modulePermissionToolLayer = toolPolicy.createHookLayer(
        options.taskModuleContext?.modulePermissions?.tools,
      );
      toolLayer = toolPolicy!.createHookLayer(options.toolPolicy, {
        preExecute: async (event) => {
          // System control, not a capability: an allow-list that forgets it must not
          // be able to make module completion impossible.
          if (
            options.taskModuleContext &&
            event.toolName === "flow_module_complete"
          )
            return { allowed: true, diagnostics: [] };
          const exec = executionForTurn(event.turnID);
          const agent = exec ? exec.selectedAgent : selectedAgent;
          const profile = exec
            ? exec.permissionProfile
            : selectedPermissionProfile;
          const agentResult = await (
            exec ? agentPolicyLayer(agent) : agentToolLayer
          ).preExecute(event);
          if (!agentResult.allowed) return agentResult;
          const profileResult = await (
            exec ? permissionProfileLayer(profile) : permissionProfileToolLayer
          ).preExecute(event);
          if (!profileResult.allowed) return profileResult;
          const moduleResult = await moduleToolLayer.preExecute(event);
          if (!moduleResult.allowed)
            return {
              ...moduleResult,
              diagnostics: [
                `blocked outside active ${options.taskModuleContext?.moduleType} module: ${event.toolName}`,
              ],
            };
          const modulePermissionToolResult =
            await modulePermissionToolLayer.preExecute(event);
          if (!modulePermissionToolResult.allowed)
            return modulePermissionToolResult;
          const extensionResult = extensionToolPermission(
            event.toolName,
            profile,
          );
          if (!extensionResult.allowed) return extensionResult;
          const permission = toolPolicy!.evaluatePermissionRules(
            agent?.permissions,
            event.toolName,
            tryParseToolArguments(event.arguments),
            workspaceRoot,
          );
          if (!permission.allowed) return permission;
          const profilePermission = toolPolicy!.evaluatePermissionRules(
            profile?.permissions,
            event.toolName,
            tryParseToolArguments(event.arguments),
            workspaceRoot,
          );
          if (!profilePermission.allowed) return profilePermission;
          const args = tryParseToolArguments(event.arguments);
          const modulePermission = toolPolicy!.evaluatePermissionRules(
            options.taskModuleContext?.modulePermissions,
            event.toolName,
            args,
            workspaceRoot,
          );
          if (!modulePermission.allowed) return modulePermission;
          const bufferedProfileCommandPermission =
            await terminalCommandBuffer.evaluate(
              [
                profile?.commandRules,
                options.taskModuleContext?.moduleCommandRules,
              ].filter((rules): rules is PermissionProfileCommandRules =>
                Boolean(rules),
              ),
              event.toolName,
              args,
              [
                profile?.interactivePrograms,
                options.taskModuleContext?.moduleInteractivePrograms,
              ],
            );
          const profileCommandPermission =
            bufferedProfileCommandPermission ??
            (await evaluatePermissionProfileCommandRules(
              profile?.commandRules,
              event.toolName,
              args,
            ));
          if (!profileCommandPermission.allowed)
            return profileCommandPermission;
          if (!bufferedProfileCommandPermission) {
            const moduleCommandPermission =
              await evaluatePermissionProfileCommandRules(
                options.taskModuleContext?.moduleCommandRules,
                event.toolName,
                args,
                "active module",
              );
            if (!moduleCommandPermission.allowed)
              return moduleCommandPermission;
          }
          return (
            (await options.hooks?.preExecute?.(event)) ?? {
              allowed: true,
              diagnostics: [],
            }
          );
        },
        postExecute: options.hooks?.postExecute,
      });
      retryPolicy = {
        maxAttemptsPerStep: tsConfig.config.runtime.retry.maxAttemptsPerStep,
        initialBackoffMs: tsConfig.config.runtime.retry.initialBackoffMs,
        maxBackoffMs: tsConfig.config.runtime.retry.maxBackoffMs,
        jitterMs: tsConfig.config.runtime.retry.jitterMs,
      };
      maxSteps = tsConfig.config.runtime.maxStepsPerTurn;
      // The fan-out ceiling: parallel sub-agent streams take a slot per
      // provider instead of tripping rate limits.
      providerConcurrencyLimiter = new ProviderConcurrencyLimiter(
        tsConfig.config.runtime.providerConcurrency ?? {},
      );
      // The config is a kernel service provided by the runtime-config built-in
      // plugin; plugins and tool families resolve it by name and subscribe to
      // its updates.
      if (
        options.permissionProfile &&
        !tsConfig.config.permissionProfiles[options.permissionProfile]
      )
        throw new Error(
          `permission profile not found: ${options.permissionProfile}`,
        );
      if (
        (selectedPermissionProfile?.commandRules &&
          selectedPermissionProfile.commandRules.mode !== "none") ||
        (options.taskModuleContext?.moduleCommandRules &&
          options.taskModuleContext.moduleCommandRules.mode !== "none")
      )
        await ensureBashCommandParser();
      agentRegistry = agentsFromConfig(tsConfig.config);
      selectedAgent = agentRegistry.default();
      if (Object.keys(tsConfig.config.agents).length && !selectedAgent)
        publish({
          type: "diagnostic",
          level: "warning",
          message:
            "TS config has no selectable primary agent; continuing with the configured default model.",
        });
      if (!options.provider) {
        const configured = providerForModel(
          tsConfig.config,
          selectedAgent?.model ?? tsConfig.config.defaultModel,
          selectedAgent?.variant,
        );
        if (configured) {
          provider = configured;
          providerSource = "ts_config";
          publish({
            type: "diagnostic",
            level: "info",
            message:
              "Loaded provider/model/runtime settings from .natalia/config.json; API key remains in memory only.",
          });
        } else if (
          tsConfig.sources.some(
            (source) => source.scope !== "defaults" && source.applied,
          )
        ) {
          publish({
            type: "diagnostic",
            level: "warning",
            message:
              "TS config has no complete provider/model/API-key selection; configure a provider or environment credential.",
          });
        }
      }
      runtimeContextConfig = await resolveContextStatusConfig(
        tsConfig.config,
        provider,
        contextWindowResolver,
        modelRefKeyForSelection(selectedAgent, selectedModel),
      );
      applyAgentPolicy();
    } catch (error) {
      publish({
        type: "diagnostic",
        level: "warning",
        message: `TS config was not used: ${error instanceof Error ? error.message : String(error)}`,
      });
      if (options.permissionProfile) throw error;
    }
    const resolvedAttachmentService =
      capabilityRegistry.service<AttachmentService>(ATTACHMENT_SERVICE);
    if (!resolvedAttachmentService)
      throw new Error("attachment service unavailable (natalia-attachment)");
    attachmentService = resolvedAttachmentService;
    const resolvedRetryService =
      capabilityRegistry.service<RetryService>(RETRY_SERVICE);
    if (!resolvedRetryService)
      throw new Error("retry service unavailable (natalia-retry)");
    retryService = resolvedRetryService;
    const resolvedContextLedgerFactory =
      capabilityRegistry.service<ContextLedgerFactory>(
        CONTEXT_LEDGER_FACTORY_SERVICE,
      );
    if (!resolvedContextLedgerFactory)
      throw new Error("context ledger unavailable (natalia-context-ledger)");
    contextLedgerFactory = resolvedContextLedgerFactory;
    const resolvedCompactionService =
      capabilityRegistry.service<CompactionService>(COMPACTION_SERVICE);
    if (!resolvedCompactionService)
      throw new Error("compaction service unavailable (natalia-compaction)");
    compactionService = resolvedCompactionService;
    const resolvedStatusController =
      capabilityRegistry.service<StatusSnapshotController>(
        STATUS_SNAPSHOT_CONTROLLER_SERVICE,
      );
    if (!resolvedStatusController)
      throw new Error("runtime UI unavailable (natalia-runtime-ui)");
    statusController = resolvedStatusController;
    runtimeContext = contextLedgerFactory.create();
    const resolvedWorkLedgerController =
      capabilityRegistry.service<WorkLedgerController>(
        WORK_LEDGER_CONTROLLER_SERVICE,
      );
    if (!resolvedWorkLedgerController)
      throw new Error("work ledger unavailable (natalia-work-ledger)");
    workLedgerController = resolvedWorkLedgerController;
    const resolvedGovernanceLedgerController =
      capabilityRegistry.service<GovernanceLedgerController>(
        GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
      );
    if (!resolvedGovernanceLedgerController)
      throw new Error(
        "governance ledger unavailable (natalia-governance-ledger)",
      );
    governanceLedgerController = resolvedGovernanceLedgerController;
    const resolvedTurnController = capabilityRegistry.service<TurnController>(
      TURN_CONTROLLER_SERVICE,
    );
    if (!resolvedTurnController)
      throw new Error(
        "turn orchestration unavailable (natalia-turn-orchestration)",
      );
    turnController = resolvedTurnController;
    sessionID =
      options.sessionID ?? (`ses_${sessionSeed(workspaceRoot)}` as SessionID);
    await sessionStoreController?.init();
    // T-2: the sandboxed sub-agent path. A sub-agent spawned with
    // `mode: "sandbox"` gets its own sandbox worktree — its file tools operate
    // in that worktree, not the parent's workspace — and the turn loop is
    // otherwise the same (same strength, reduced authority via the tool
    // domain). It is a new path; the shared-context loop below stays untouched.
    // The concurrent fan-out cap (`team.maxConcurrent`) is enforced here, at
    // the work itself, not at the spawn call.
    let sandboxedSubagentActive = 0;
    const sandboxedSubagentWaiters: Array<{
      resume: () => void;
      signal: AbortSignal;
      abort: () => void;
    }> = [];
    async function acquireSandboxedSubagentSlot(signal: AbortSignal) {
      const limit = tsRuntimeConfig?.team?.maxConcurrent ?? 4;
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
      const parentSessionID = subagentsController?.get(runner.agentId)
        ?.parentSessionID as SessionID | undefined;
      publishForSession(
        parentSessionID ? executionBySession.get(parentSessionID) : activeExec,
        parentSessionID && event.sessionID === undefined
          ? { ...event, sessionID: parentSessionID, agentID: runner.agentId }
          : { ...event, agentID: runner.agentId },
      );
    }
    function subagentTurnID(runner: SubagentRunnerContext) {
      const continuation =
        subagentsController?.get(runner.agentId)?.continuation ?? 0;
      return continuation
        ? `subagent:${runner.agentId}:continuation:${continuation}`
        : `subagent:${runner.agentId}`;
    }
    function beginSubagentConversation(
      runner: SubagentRunnerContext,
      task: string,
    ) {
      const id = subagentTurnID(runner);
      const parentSessionID = subagentsController?.get(runner.agentId)
        ?.parentSessionID as SessionID | undefined;
      if (parentSessionID) turnSession.set(id, parentSessionID);
      turnAgent.set(id, runner.agentId);
      publishSubagentEvent(runner, {
        type: "turn.submitted",
        id,
        text: task,
        byteLength: new TextEncoder().encode(task).byteLength,
        lineCount: lineCount(task),
        sha256: createHash("sha256").update(task).digest("hex"),
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
      turnSession.delete(id);
      turnAgent.delete(id);
    }
    function createSubagentContext(system: string, task: string) {
      const ledger = contextLedgerFactory.create();
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
      const compaction = compactionService;
      if (!compaction)
        throw new Error("compaction service unavailable (natalia-compaction)");
      const runStep = () =>
        retryService.run(
          { id, operation: "llm_step", step },
          async ({ attempt }) => {
            let output = "";
            let thinking = "";
            const calls: ProviderToolCall[] = [];
            let protocolViolation = "";
            const stream = withProviderConcurrency(
              providerConcurrencyLimiter,
              activeProvider.provider,
              () =>
                activeProvider.stream({
                  messages: contextEntriesToProviderMessages(
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
              ? requireNativeToolCallProtocol(
                  normalizeRawToolCallProtocol(stream),
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
        result = await compaction.runWithContextLimitRecovery({
          id,
          step,
          compactionID: `${id}:context-limit:${step}`,
          ledger,
          provider: activeProvider,
          budget: activeContextConfig,
          preservedRecentMessages:
            tsRuntimeConfig?.context.preservedRecentMessages ?? 2,
          instruction: "Recover this subagent from the provider context limit.",
          signal: runner.signal,
          runStep,
          onEvent: (event: RuntimeEvent) => publishSubagentEvent(runner, event),
        });
        if (!result.protocolViolation) break;
        correction += 1;
        if (correction > MAX_PROTOCOL_CORRECTIONS)
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
          content: nativeToolCallCorrection(correction),
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
      if (occurrences > 12 && !WAITING_TOOLS.has(tool.name)) {
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
        const preResult = await toolLayer.preExecute(hookEvent);
        if (!preResult.allowed)
          throw new Error(
            `subagent tool denied by policy: ${preResult.diagnostics.join("; ")}`,
          );
        if (input.exec.permissionMode === "read_only" && tool.requiresApproval)
          throw new Error(readOnlyToolMessage(tool.name));
        if (tool.requiresApproval) {
          const refusal = await interactive.requireApproval(
            toolID,
            tool,
            call,
            hookEvent.turnID,
          );
          if (refusal) throw new Error(refusal.reason);
        }
        const parsed = parseToolArguments(call.arguments);
        const paramErrors = validateToolParameters(tool.parameters, parsed);
        if (paramErrors.length)
          throw new Error(
            `tool "${tool.name}" parameter validation failed: ${paramErrors.map((error) => `${error.path}: ${error.message}`).join("; ")}`,
          );
        const parentSessionID = subagentsController?.get(
          runner.agentId,
        )?.parentSessionID;
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
            await interactive.requireQuestion(
              `${toolID}:question`,
              hookEvent.turnID,
              question,
            ),
          subagents: subagentsController,
          terminal: terminalController,
          ...(input.exposeSandboxes ? { sandboxes: sandboxController } : {}),
          workspaceReadAuthorize: (request) =>
            authorizeWorkspaceRead(request, input.exec),
          ...(input.writeAuthorize
            ? { workspaceWriteAuthorize: input.writeAuthorize }
            : {}),
          sandboxMergeAuthorize: (request) =>
            authorizeSandboxMerge(request, input.exec),
          settings: toolSettings(input.exec),
          parentSessionID: parentSessionID ?? input.exec.session.id,
          parentAgentID: runner.agentId,
          maxSubagentDepth: tsRuntimeConfig?.runtime.subagentDepth,
        });
        const finalizedResult =
          tool.output?.finalizeContent?.(completeResult) ?? completeResult;
        const result = redactToolOutput(
          finalizedResult,
          redactToolOutputEnabled(input.exec),
        );
        const projectedRender = tool.output?.presentResult?.(parsed, result);
        await toolLayer.postExecute({ ...hookEvent, result });
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
        await toolLayer.postExecute({ ...hookEvent, error: message });
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
      const record = subagentsController?.get(runner.agentId);
      if (!record)
        throw new Error(`subagent record not found: ${runner.agentId}`);
      const allowed = record.allowedTools ?? [];
      const excluded = new Set(record.excludeTools ?? []);
      // The sub-agent's own worktree, created through the sandbox backend.
      const manifest = await sandboxController?.create(runner.agentId);
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
                relative.startsWith(
                  domain.endsWith("/") ? domain : `${domain}/`,
                ),
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
        teamBehavior()?.sandboxedSubagentSystemPrompt(writePaths) ??
          "You are a focused Natalia TS/Bun subagent. Use the provided native tools to inspect, edit, and validate the workspace. Return a concise factual final result. Never claim a tool action you did not run. Do not reveal private reasoning.",
        task,
      );
      const repeatedCalls = new Map<string, number>();
      const maxSubagentSteps = effectiveMaxSteps(exec);
      const activeContextConfig = { ...exec.runtimeContextConfig };
      for (let step = 1; step <= maxSubagentSteps; step++) {
        const isLastStep =
          Number.isFinite(maxSubagentSteps) && step >= maxSubagentSteps;
        const visibleTools = [...tools.values()].filter(
          (tool) =>
            isToolAllowed(tool.name, exec) &&
            (exec.permissionMode !== "read_only" || !tool.requiresApproval) &&
            !excluded.has(tool.name) &&
            (!allowed.length || allowed.includes(tool.name)),
        );
        if (isLastStep)
          ledger.add({
            id: `${runner.agentId}:${step}:max-steps`,
            role: "assistant",
            content: MAX_STEPS_PROMPT,
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
            (isLastStep || step > 1 ? MISSING_FINAL_RESPONSE_FALLBACK : output);
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
    await subagentsController?.init(async (task, runner) => {
      try {
        const record = subagentsController?.get(runner.agentId);
        const exec = executionBySession.get(
          record?.parentSessionID as SessionID,
        );
        if (!exec) throw new Error("parent session unavailable for subagent");
        const activeProvider = exec.provider;
        if (!activeProvider)
          throw new Error("provider unavailable for subagent");
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
        const maxSubagentSteps = effectiveMaxSteps(exec);
        const activeContextConfig = { ...exec.runtimeContextConfig };
        for (let step = 1; step <= maxSubagentSteps; step++) {
          const isLastStep =
            Number.isFinite(maxSubagentSteps) && step >= maxSubagentSteps;
          const visibleTools = [...tools.values()].filter(
            (tool) =>
              isToolAllowed(tool.name, exec) &&
              (exec.permissionMode !== "read_only" || !tool.requiresApproval) &&
              !excluded.has(tool.name) &&
              (!allowed.length || allowed.includes(tool.name)),
          );
          if (isLastStep)
            ledger.add({
              id: `${runner.agentId}:${step}:max-steps`,
              role: "assistant",
              content: MAX_STEPS_PROMPT,
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
                ? MISSING_FINAL_RESPONSE_FALLBACK
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
              childWorkspaceRoot: workspaceRoot,
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
    subagentsController!.subscribe((event) => {
      const record = subagentsController!.get(event.agentId);
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
        health: subagentsController!.health(event.agentId),
        lastActivityAt: record?.lastActivityAt,
        startedAt: record?.startedAt,
        endedAt: record?.endedAt,
        stopReason: event.stopReason,
        requestedBy: event.requestedBy,
        force: event.force,
      } satisfies Extract<RuntimeEvent, { type: "subagent.update" }>;
      // Registry events can arrive after the UI attaches to another session.
      // Persist them with the spawning session, rather than whichever session
      // happens to be active when the asynchronous subagent reports progress.
      publishForSession(
        executionBySession.get(event.parentSessionID as SessionID),
        update,
      );
      if (event.event === "created" || event.event === "done")
        scheduleRuntimeStatusSnapshot();
    });
    if (tsRuntimeConfig && extensionEnabled("mcp")) {
      await mcpService?.reload();
    }
    // Out-of-tree families declared by `tools.paths` join the built-ins through
    // the same kernel, so they own their tools the same way. They load here
    // because dynamic import is async and the built-in catalogue is assembled at
    // construction — before this point no config is resolved yet.
    await terminalController?.init();
    terminalController?.setActiveSession(sessionID);

    await sandboxController?.init();
    const storedSession = await sessionStoreController?.load(sessionID, {
      title: options.title,
      create: true,
      indexedRecovery: replayMode === "none",
    });
    session = storedSession?.session;
    if (!session) throw new Error("session initialization did not complete");
    if (options.title && !session.metadata?.titleSource) {
      session.metadata = { ...session.metadata, titleSource: "manual" };
      await sessionStoreController?.updateMetadata(session, {
        titleSource: "manual",
      });
    }
    // D2: the startup session is the first exec; the activity view (the
    // `session`/`runtimeContext` closures) aliases it until an attach switches.
    const initialExec: SessionExecutionState = {
      session,
      context: runtimeContext,
      attachmentReferences,
      toolCalls,
      provider,
      runtimeContextConfig,
      permissionMode,
      permissionProfile: selectedPermissionProfile,
      paused: false,
      pauseWaiters: [],
    };
    activeExec = initialExec;
    executionBySession.set(sessionID, initialExec);
    const sqliteRecovery = storedSession.recovery;
    const sqliteEpoch = storedSession.contextEpoch;
    // The startup exec was created before durable recovery replaced the session
    // record. Point it at the recovered record, or per-session reads through the
    // exec (durable metadata like `pendingHumanTerminal`, the inbox, the event
    // list) would silently see the pre-recovery shell instead of the restored
    // state.
    if (activeExec) activeExec.session = session;
    await attachmentService
      .cleanup(await sessionStoreController.referencedAttachments())
      .catch((error) =>
        publish({
          type: "diagnostic",
          level: "warning",
          message: `attachment cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        }),
      );
    const interruptedOperation = session.metadata?.inFlightOperation;
    const interrupted = sqliteRecovery
      ? settleInterruptedTurnIDs(
          sqliteRecovery.activeTurnIDs,
          sqliteRecovery.approvals.map((request) => request.id),
          sqliteRecovery.questions.map((request) => request.id),
        )
      : settleInterruptedTurns(session);
    const operationTurnWasInterrupted = Boolean(
      interruptedOperation &&
        interrupted.some(
          (event) =>
            event.type === "turn.finished" &&
            event.id === interruptedOperation.turnID,
        ),
    );
    if (interruptedOperation) {
      delete session.metadata?.inFlightOperation;
      await sessionStoreController?.updateMetadata(session, {
        inFlightOperation: undefined,
      });
    }
    if (interrupted.length || interruptedOperation) {
      await sessionStoreController?.appendEvents(session, interrupted);
      publish({
        type: "diagnostic",
        level: "warning",
        message: operationTurnWasInterrupted
          ? `previous process stopped during ${interruptedOperation!.kind === "provider_dispatch" ? "provider dispatch" : "tool execution"}; the operation was safely settled as an error and cannot be replayed without an idempotency contract`
          : `previous process stopped during ${interrupted.filter((event) => event.type === "turn.finished").length} active turn(s); unresolved interactive requests were rejected because incomplete provider work cannot be replayed`,
      });
    }
    const projection = projectSession(session);
    const initialDiagnostics =
      runtimeDiagnosticsBySession.get(session.id) ?? [];
    for (const event of sqliteRecovery?.diagnostics ?? [])
      initialDiagnostics.push({
        ...event,
        at: event.at ?? session.createdAt,
      });
    for (const event of projection.replayableEvents)
      if (event.type === "diagnostic")
        initialDiagnostics.push({
          ...event,
          at: event.at ?? session.createdAt,
        });
    runtimeDiagnosticsBySession.set(session.id, initialDiagnostics);
    for (const event of projection.replayableEvents)
      if (event.type === "turn.submitted" && event.attachments?.length)
        attachmentReferences.set(`${event.id}:user`, event.attachments);
    const selectedAgentName =
      sqliteRecovery?.selectedAgent ?? projection.selectedAgent;
    if (selectedAgentName) {
      const restored = agentRegistry?.select(selectedAgentName);
      if (restored) {
        selectedAgent = restored;
        applyAgentPolicy();
        applyAgentProvider();
      } else {
        publish({
          type: "diagnostic",
          level: "warning",
          message: `persisted agent is no longer configured: ${selectedAgentName}`,
        });
      }
    }
    const recoveredModel =
      sqliteRecovery?.selectedModel ?? projection.selectedModel;
    if (recoveredModel) {
      selectedModel = recoveredModel;
      applyAgentProvider();
    }
    await cleanupToolOutput(workspaceRoot).catch((error) =>
      publish({
        type: "diagnostic",
        level: "warning",
        message: `tool output cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
    const latestContextCheckpoint = [...projection.replayableEvents]
      .reverse()
      .find((event) => event.type === "context.checkpoint");
    if (sqliteEpoch)
      runtimeContext.restoreDurableCheckpoint(sqliteEpoch.snapshot);
    else if (latestContextCheckpoint)
      runtimeContext.restoreDurableCheckpoint(latestContextCheckpoint.snapshot);
    contextLedgerFactory.restore(
      runtimeContext,
      sqliteEpoch
        ? sessionStoreController.contextEventsAfter(sessionID, sqliteEpoch)!
        : modelVisibleEvents(projection.replayableEvents),
    );
    for (const [turnID, attachments] of sqliteRecovery?.attachments ?? [])
      attachmentReferences.set(`${turnID}:user`, attachments);
    const [queued] = projection.pendingInputs.filter(
      (input) => input.delivery === "queue",
    );
    if (queued) void turnCoordinator().wake(drainSession);
    const activeSkillEntry = [...runtimeContext.snapshot().entries]
      .reverse()
      .find(
        (entry) => entry.role === "system" && entry.id.startsWith("skill:"),
      );
    const qualifiedName = activeSkillEntry?.id.match(
      /^skill:((?:project|remote|user):[^:]+):/u,
    )?.[1];
    if (qualifiedName && skillService()) {
      try {
        activeSkill = skillService()!.resolve(qualifiedName);
      } catch {
        // A removed skill must not prevent durable session recovery.
      }
    }
    // P8 C3: the main agent acknowledges delivered mailbox intents it acted
    // on; acknowledged messages stop being re-injected as pending intents.
    tools.set(
      "mailbox_acknowledge",
      createMailboxAcknowledgeTool({
        onAcknowledge: async (messageIDs, context) => {
          const owner = context.sessionID
            ? executionBySession.get(context.sessionID as SessionID)
            : undefined;
          if (!owner) return;
          const at = new Date().toISOString();
          for (const messageID of messageIDs) {
            const message = projectedMailboxMessages(owner.session.events).find(
              (candidate) =>
                candidate.messageID === messageID &&
                candidate.status === "delivered",
            );
            if (!message) continue;
            publishForSession(
              owner,
              buildMailboxStatus({
                id: `${messageID}:acknowledged:${mailboxSequence++}`,
                messageID,
                status: "acknowledged",
                at,
              }),
            );
          }
        },
      }),
    );
    // P8 §56.62 collaboration channel: the main agent responds to Navi's
    // suggestions (adopt/reject/defer) and may ask her a question — she sees
    // both in her next turn's context, so neither agent waits for the user.
    // Agent-team: the main agent orchestrates a fan-out via these tools and
    // acts as the lead reviewer. The team tools register through the
    // `natalia-team` built-in plugin, gated on the same extension switch.
    tools.set("collab_respond", {
      name: "collab_respond",
      description:
        "Respond to a suggestion from Navi, the Live Work Chat collaborator: adopt it, reject it, or defer it with a reason. The message id comes from the <navi_collaborations> context block.",
      requiresApproval: false,
      parameters: {
        type: "object",
        properties: {
          messageID: { type: "string" },
          decision: {
            type: "string",
            enum: ["adopted", "rejected", "deferred"],
          },
          reason: { type: "string" },
        },
        required: ["messageID", "decision"],
        additionalProperties: false,
      },
      async execute(parsed, context) {
        const args = parsed as {
          messageID?: string;
          decision?: string;
          reason?: string;
        };
        if (
          typeof args.messageID !== "string" ||
          typeof args.decision !== "string"
        )
          return "collab_respond requires messageID and decision";
        const owner = context.sessionID
          ? executionBySession.get(context.sessionID as SessionID)
          : undefined;
        if (!owner) return "no session";
        const messageID = args.messageID;
        // Models routinely truncate the id to its tail; accept an exact id or
        // a unique suffix of it.
        const target = projectedCollabMessages(owner.session.events).find(
          (message) =>
            message.kind === "suggestion" &&
            message.status === "proposed" &&
            (message.id === messageID ||
              message.id.endsWith(messageID) ||
              messageID.endsWith(message.id)),
        );
        if (!target) return `no suggestion ${messageID}`;
        publishForSession(owner, {
          type: "collab.response",
          id: `collab:response:${Date.now().toString(36)}:${collabSequence++}`,
          // Publish with the matched message's real id, not the (possibly
          // truncated) args id, so the projection can fold the decision back.
          messageID: target.id,
          from: "main_agent",
          decision: args.decision as "adopted" | "rejected" | "deferred",
          ...(args.reason
            ? { reason: redactToolOutput(args.reason, true) }
            : {}),
          at: new Date().toISOString(),
        });
        requestNaviWake(owner);
        return JSON.stringify({ responded: true });
      },
    } as RuntimeTool);
    tools.set("collab_inbox", {
      name: "collab_inbox",
      description:
        "Read the collaboration channel with Navi (the Live Work Chat, your younger sister): her answers to your questions, her pending suggestions and their outcomes. Call it whenever you are unsure whether she replied or what she said.",
      requiresApproval: false,
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      async execute(_parsed, context) {
        const owner = context.sessionID
          ? executionBySession.get(context.sessionID as SessionID)
          : undefined;
        if (!owner) return "[]";
        const messages = projectedCollabMessages(owner.session.events);
        return JSON.stringify(
          messages.slice(-10).map((message) => ({
            id: message.id,
            kind: message.kind,
            from: message.from,
            to: message.to,
            text: message.text,
            status: message.status,
            ...(message.questionID ? { questionID: message.questionID } : {}),
            ...(message.threadID ? { threadID: message.threadID } : {}),
            ...(message.replyToID ? { replyToID: message.replyToID } : {}),
            ...(message.round ? { round: message.round } : {}),
            ...(message.expectsReply !== undefined
              ? { expectsReply: message.expectsReply }
              : {}),
          })),
        );
      },
    } as RuntimeTool);
    tools.set("collab_chat", createCollabChatTool("main_agent"));
    tools.set("collab_ask", {
      name: "collab_ask",
      description:
        "Ask Navi, the Live Work Chat collaborator (your younger sister), a question about the work — a second opinion on an approach, risk or tradeoff. She sees it in her next turn and answers with collab_answer. Use it when an outside read would genuinely help, not for trivia.",
      requiresApproval: false,
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
        },
        required: ["question"],
        additionalProperties: false,
      },
      async execute(parsed, context) {
        const args = parsed as { question?: string };
        if (typeof args.question !== "string" || !args.question.trim())
          return "collab_ask requires question";
        const exec = context.sessionID
          ? executionBySession.get(context.sessionID as SessionID)
          : undefined;
        if (!exec) return "no session";
        publishForSession(exec, {
          type: "collab.question",
          id: `collab:question:${Date.now().toString(36)}:${collabSequence++}`,
          from: "main_agent",
          to: "live_chat",
          question: redactToolOutput(args.question, true),
          at: new Date().toISOString(),
        });
        // If Navi is not mid-conversation with the user, wake her to answer
        // immediately; if she is chatting, the question waits for her next
        // turn boundary (the queued path).
        requestNaviWake(exec);
        return JSON.stringify({ asked: true });
      },
    } as RuntimeTool);
    publish({
      type: "session.created",
      sessionID,
      title: session.title,
    });
    if (replayMode === "all") for (const event of session.events) sink?.(event);
    if (sqliteRecovery)
      interactive.restoreRecoveredInteractiveState(
        sqliteRecovery.approvals.filter(
          (request) =>
            !interrupted.some(
              (event) =>
                event.type === "approval.response" && event.id === request.id,
            ),
        ),
        sqliteRecovery.questions.filter(
          (request) =>
            !interrupted.some(
              (event) =>
                event.type === "question.response" && event.id === request.id,
            ),
        ),
      );
    else interactive.restoreInteractiveState(session.events);
    if (replayMode === "none") {
      const pending = sqliteRecovery
        ? {
            approvals: sqliteRecovery.approvals.filter(
              (request) =>
                !interrupted.some(
                  (event) =>
                    event.type === "approval.response" &&
                    event.id === request.id,
                ),
            ),
            questions: sqliteRecovery.questions.filter(
              (request) =>
                !interrupted.some(
                  (event) =>
                    event.type === "question.response" &&
                    event.id === request.id,
                ),
            ),
          }
        : projectInteractiveRequests(session.events);
      for (const request of pending.approvals) sink?.(request);
      for (const request of pending.questions) sink?.(request);
    }
    if (activeExec) await initializeCheckpointController(activeExec);
    // The exec is the turn's view of agent/model state; the closures were the
    // source of truth during init, so mirror them before any turn can run.
    if (activeExec) {
      activeExec.selectedAgent = selectedAgent;
      activeExec.selectedModel = selectedModel;
      activeExec.activeSkill = activeSkill;
      activeExec.permissionMode = permissionMode;
      activeExec.permissionProfile = selectedPermissionProfile;
      applyAgentProvider(activeExec);
    }
    publish({ type: "session.ready", sessionID });
    // The self-protection rules are the first constitution facts: migrate them
    // into the durable journal on every boot (idempotent — replay already holds
    // them) so `constitutionRules()` and the /constitution UI answer real rules,
    // not the empty projection CST1 shipped.
    for (const rule of governanceLedgerController.seedConstitutionRules(
      session.events,
    )) {
      publish(rule);
      // CST4 Work Graph linkage: each seeded rule is a `constraint` node, so
      // tool calls and drift findings can relate to it in the graph.
      publish(
        workLedgerController.constitutionRuleNode({
          ruleID: rule.ruleID,
          statement: rule.statement,
          sessionID,
        }),
      );
    }
    // Overrides are visible, not silent: a plugin that replaced a built-in
    // tool shows up in diagnostics so nobody discovers it by surprise.
    for (const override of capabilityRegistry.overrides())
      publish({
        type: "diagnostic",
        level: "warning",
        message: `capability "${override.winner}" (precedence ${override.winnerPrecedence}) replaced "${override.loser}" (precedence ${override.loserPrecedence}) for ${override.kind} "${override.name}"`,
      });
    publishBuiltinCapabilities();
    publishRegisteredTools();
    publish(contextStatusEvent(runtimeContext.status(runtimeContextConfig)));
    publish(await runtimeStatusSnapshot());
  }

  /**
   * Publishes the loaded capability catalogue into the durable journal. Every
   * capability the kernel holds — built-in tool families, controllers,
   * workspace services and plugins alike — is a real capability and belongs in
   * the journal, so a consumer projection sees what is loaded. Published after
   * the session exists, so the events land in the session's history.
   */
  function publishBuiltinCapabilities() {
    for (const record of capabilityRegistry.list()) {
      publish({
        type: "capability.loaded",
        id: `cap:${record.id}`,
        apiVersion: 1,
        name: record.name,
        version: record.version,
        scope: record.scope,
        grants: record.grants,
      });
    }
  }

  /**
   * Records the effective tool catalogue once the runtime has assembled all
   * built-ins and task-scoped contributions. This is metadata only: tool
   * implementations and parameters never enter the journal.
   *
   * Owner and scope are read from the kernel, not asserted here: a tool the
   * kernel owns reports the capability that contributed it and that capability's
   * scope, so the journal says which family a tool came from and how long it
   * lives. `natalia-runtime` is left for a tool the host injected directly (a
   * caller-supplied registry and the mailbox/collaboration tools the runtime
   * still registers after assembly).
   */
  /**
   * Hot-reloads one out-of-tree family: re-imports its entry and re-registers
   * it without a restart, publishing what changed in the projected tool
   * catalog. Shared by the `toolFamilyReload` RPC and the family watcher — the
   * "hot" half of HMR, what a self-modifying agent triggers after its change is
   * promoted.
   */
  async function hotReloadToolFamily(familyID: string) {
    if (options.tools || !tsRuntimeConfig)
      throw new Error("tool family reload is not available");
    // The local-tools plugin owns the family lifecycle; the host only asks it
    // to swap the family and then reports what changed in the tool catalog.
    const reload = capabilityRegistry.service<
      (familyID: string) => Promise<ToolFamily>
    >(LOCAL_TOOLS_RELOAD_SERVICE);
    if (!reload)
      throw new Error(
        "local tool families are not loaded (natalia-local-tools)",
      );
    const before = new Set(tools.keys());
    await reload(familyID);
    // Publish what changed so the projected tool catalog stays honest.
    for (const name of before) {
      if (tools.has(name)) continue;
      publish({ type: "tool.unregistered", id: `tool:${name}`, name });
    }
    for (const name of [...tools.keys()]) {
      if (before.has(name)) continue;
      const owner = capabilityRegistry.ownerOf("tools", name);
      publish({
        type: "tool.registered",
        id: `tool:${name}`,
        name,
        owner: owner ?? "natalia-runtime",
        scope: (owner && capabilityRegistry.scopeOf(owner)) || "session",
        recovery: "fail_closed",
        precedence: 0,
        requiresApproval: tools.get(name)?.requiresApproval ?? false,
      });
    }
    return { reloaded: true };
  }

  function publishRegisteredTools() {
    for (const tool of tools.values()) {
      const owner = capabilityRegistry.ownerOf("tools", tool.name);
      publish({
        type: "tool.registered",
        id: `tool:${tool.name}`,
        name: tool.name,
        owner: owner ?? "natalia-runtime",
        scope: (owner && capabilityRegistry.scopeOf(owner)) || "session",
        recovery: "fail_closed",
        precedence: 0,
        requiresApproval: tool.requiresApproval,
      });
    }
  }

  function publishToolCatalogChanges(before: Set<string>) {
    for (const name of before)
      if (!tools.has(name))
        publish({ type: "tool.unregistered", id: `tool:${name}`, name });
    for (const tool of tools.values()) {
      if (before.has(tool.name)) continue;
      const owner = capabilityRegistry.ownerOf("tools", tool.name);
      publish({
        type: "tool.registered",
        id: `tool:${tool.name}`,
        name: tool.name,
        owner: owner ?? "natalia-runtime",
        scope: (owner && capabilityRegistry.scopeOf(owner)) || "session",
        recovery: "fail_closed",
        precedence: 0,
        requiresApproval: tool.requiresApproval,
      });
    }
  }

  /**
   * Records a settled tool call in the Work Graph, with the edge to the turn that
   * caused it. Only settled calls: an in-flight call is not yet a fact. The tool
   * name and status are recorded, never arguments or output.
   */
  function publishWorkGraphToolCall(
    turnID: string,
    callID: string,
    toolName: string,
    status: string,
  ) {
    const exec = executionForTurn(turnID) ?? activeExec;
    const ownerSessionID = exec?.session.id ?? sessionID;
    publishForSession(
      exec,
      workLedgerController.toolCallNode({
        turnID,
        callID,
        toolName,
        status,
        sessionID: ownerSessionID,
      }),
    );
    publishForSession(
      exec,
      workLedgerController.toolCallEdge({ turnID, callID }),
    );
  }

  /**
   * Every command a capability or plugin contributed.
   *
   * The kernel is the sole catalogue: external and built-in plugins both
   * contribute through it, so a UI never merges parallel registries.
   */

  function skillsPluginInput(config: ConfigV3) {
    if (
      config.plugins.enabled[SKILLS_PLUGIN_ID] === false ||
      !extensionEnabled("skills")
    )
      return undefined;
    return {
      workspaceRoot,
      userRoot: userSkillRoot(),
      remoteURLs: config.skills.urls,
      onLoad: (
        skill: SkillMetadata,
        output: string,
        context: ToolExecutionContext,
      ) => {
        const owner = context.sessionID
          ? executionBySession.get(context.sessionID as SessionID)
          : undefined;
        if (!owner) return;
        owner.activeSkill = skill;
        if (owner === activeExec) activeSkill = skill;
        owner.context.add({
          id: `skill:${skill.qualifiedName}:${owner.context.journalStatus().journalOffset}`,
          role: "system",
          content: output,
        });
      },
    };
  }

  function checkpointPluginInput(config: ConfigV3) {
    return config.plugins.enabled[CHECKPOINT_PLUGIN_ID] === false
      ? undefined
      : { workspaceRoot };
  }

  function sandboxPluginInput(config: ConfigV3) {
    return config.plugins.enabled[SANDBOX_CONTROLLER_PLUGIN_ID] === false
      ? undefined
      : {
          workspaceRoot,
          backend: () => tsRuntimeConfig?.sandbox.backend,
          identity: config.sandbox,
        };
  }

  function terminalPluginInput(config: ConfigV3) {
    return config.plugins.enabled[TERMINAL_CONTROLLER_PLUGIN_ID] === false
      ? undefined
      : {
          workspaceRoot,
          publish: (event: RuntimeEvent) =>
            publishForSession(
              event.sessionID
                ? executionBySession.get(event.sessionID as SessionID)
                : undefined,
              event,
            ),
          onPerformance: (name: string, durationMs: number) =>
            performanceTrace.mark(name, durationMs),
          runtimeID: () => nativeRuntimeID,
          userRuntimeHome: () => userRuntimeHome(),
          windowMode: () =>
            tsRuntimeConfig?.runtime.terminal.windowMode ?? "auto",
          external: options.nativeTerminal,
          identity: config.runtime.terminal.windowMode,
        };
  }

  function workspacePluginInput(config: ConfigV3) {
    return config.plugins.enabled[WORKSPACE_PLUGIN_ID] === false
      ? undefined
      : {
          workspaceRoot,
          listPaths: async () =>
            (
              await findWorkspaceFiles({
                workspaceRoot,
                limit: 1000,
              })
            )
              .filter((entry) => entry.type === "file")
              .map((entry) => entry.path),
        };
  }

  function providerModelPluginInput(config: ConfigV3): {
    enabled: boolean;
    controller: ProviderModelControllerInput;
  } {
    const enabled =
      config.plugins.enabled[ATTACHMENT_PLUGIN_ID] !== false &&
      config.plugins.enabled[RETRY_PLUGIN_ID] !== false &&
      config.plugins.enabled[COMPACTION_PLUGIN_ID] !== false &&
      config.plugins.enabled[PROVIDER_MODEL_PLUGIN_ID] !== false;
    return {
      enabled,
      controller: {
        initialize: () => {
          if (!provider && !options.provider) {
            provider = providerFromEnvironment();
            if (provider) providerSource = "environment";
          }
        },
        runnerInput: providerRunnerInput,
        chat: {
          available: (id) => executionBySession.get(id)?.provider !== undefined,
          publish: (id, event) =>
            publishForSession(executionBySession.get(id), event),
          runBody: async (input, signal) => {
            const exec = executionBySession.get(input.sessionID);
            if (!exec)
              throw new Error(
                `no execution state for session ${input.sessionID}`,
              );
            await runChatTurnBody({ ...input, exec }, signal);
          },
          wake: async (id) => {
            const exec = executionBySession.get(id);
            if (exec) await wakeNavi(exec);
          },
        },
      },
    };
  }

  function compactionPluginInput(config: ConfigV3) {
    return {
      enabled:
        config.plugins.enabled[RETRY_PLUGIN_ID] !== false &&
        config.plugins.enabled[CONTEXT_LEDGER_PLUGIN_ID] !== false &&
        config.plugins.enabled[COMPACTION_PLUGIN_ID] !== false,
    };
  }

  function mcpPluginInput(config: ConfigV3) {
    if (
      config.plugins.enabled[MCP_PLUGIN_ID] === false ||
      !extensionEnabled("mcp")
    )
      return undefined;
    return {
      servers: () => tsRuntimeConfig?.mcpServers ?? {},
      workspaceRoot,
      enabled: () => extensionEnabled("mcp"),
      publish,
      identity: config.mcpServers,
    };
  }

  function localToolsPluginInput(config: ConfigV3) {
    if (
      options.tools ||
      !config.tools.paths.length ||
      config.plugins.enabled[LOCAL_TOOLS_PLUGIN_ID] === false
    )
      return undefined;
    return {
      roots: config.tools.paths.map((path) => resolve(workspaceRoot, path)),
      enabled: config.tools.enabled,
      onError: (id: string, error: unknown) =>
        publish({
          type: "diagnostic",
          level: "warning",
          owner: "natalia-tools",
          message: `tool family ${id} failed to load: ${
            error instanceof Error ? error.message : String(error)
          }`,
        }),
      trust: {
        workspaceRoot,
        verify: (key: string, entryPath: string) =>
          verifyTrust(workspaceRoot, key, entryPath),
      },
      onChange: async (familyID: string, entryPath: string) => {
        const verified = await verifyTrust(
          workspaceRoot,
          resolve(entryPath, ".."),
          entryPath,
        );
        if (verified.expected && !verified.verified) {
          publish({
            type: "diagnostic",
            level: "warning",
            owner: toolFamilyCapabilityID(familyID),
            message: `tool family ${familyID} changed on disk without a promotion — refusing to hot reload`,
          });
          return;
        }
        try {
          await hotReloadToolFamily(familyID);
          publish({
            type: "diagnostic",
            level: "info",
            owner: toolFamilyCapabilityID(familyID),
            message: `tool family ${familyID} hot-reloaded`,
          });
        } catch (error) {
          publish({
            type: "diagnostic",
            level: "warning",
            owner: toolFamilyCapabilityID(familyID),
            message: `tool family ${familyID} hot reload failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          });
        }
      },
    };
  }

  function externalPluginConfigFingerprint(config: ConfigV3) {
    return JSON.stringify({
      paths: config.plugins.paths,
      packages: config.plugins.packages,
      enabled: selectPluginConfig(config.plugins.enabled, "external"),
      capabilities: config.plugins.capabilities,
      readOnly: config.plugins.readOnly,
      settings: selectPluginConfig(config.plugins.settings, "external"),
    });
  }

  function selectPluginConfig<T>(
    values: Record<string, T> | undefined,
    kind: "tool" | "static" | "external",
  ) {
    return Object.fromEntries(
      Object.entries(values ?? {}).filter(([id]) => {
        const tool = isBuiltinToolPlugin(id);
        const builtin = builtinPluginIDs.has(id);
        if (kind === "tool") return tool;
        if (kind === "static") return builtin && isStaticBuiltinPlugin(id);
        return !builtin;
      }),
    );
  }

  async function submitInput(
    input: SubmitInput & { internal?: boolean },
    forSessionID?: SessionID,
  ) {
    await ready;
    if (runtimeDisposed) throw new Error("runtime disposed");
    const targetSessionID = forSessionID ?? sessionID;
    const targetExec = await ensureExecution(targetSessionID);
    if (runtimeDisposed) throw new Error("runtime disposed");
    const targetSession = targetExec.session;
    let text = input.text;
    // /team <message>: the user explicitly requests the agent team. Inject the
    // forcing directive into the turn's context and run the rest as a normal
    // turn — the model must decompose and fan out instead of working
    // sequentially. Handled here (not as a slash command) so the turn runs
    // normally instead of nesting a submit inside a command.
    const activeTeamBehavior = teamBehavior();
    if (activeTeamBehavior && text.trim().startsWith("/team")) {
      const message = text.trim().slice("/team".length).trim();
      if (!message) throw new Error("/team requires a message after it");
      targetExec.context.add({
        id: `team-mode:${targetExec.context.journalStatus().journalOffset}`,
        role: "system",
        content: activeTeamBehavior.directive(),
      });
      text = message;
    }
    const attachments = input.attachments?.length
      ? await attachmentService.store(input.attachments)
      : [];
    if (runtimeDisposed) throw new Error("runtime disposed");
    const id = input.id ?? `turn_${crypto.randomUUID().replace(/-/gu, "")}`;
    const delivery = input.delivery ?? "steer";
    const submitted: SubmittedTurn = {
      type: "turn.submitted",
      id,
      text,
      byteLength: new TextEncoder().encode(text).byteLength,
      lineCount: lineCount(text),
      sha256: createHash("sha256").update(text).digest("hex"),
      ...(delivery === "queue" ? { delivery } : {}),
      ...(input.internal ? { internal: true } : {}),
      attachments: attachments.length ? attachments : undefined,
      resources: input.resources?.length ? input.resources : undefined,
      agents: input.agents?.length ? input.agents : undefined,
    };
    if (attachments.length)
      targetExec?.attachmentReferences.set(`${id}:user`, attachments);
    if (!targetSession)
      throw new Error("session initialization did not complete");
    const existing = admittedInputs(targetSession).find(
      (item) => item.id === id,
    );
    admitInput(targetSession, {
      id,
      text,
      delivery,
      attachments,
      resources: input.resources,
      agents: input.agents,
      internal: input.internal,
    });
    const targetCoordinator = () => sessionRunCoordinator(targetSessionID);
    if (existing) {
      if (!existing.promotedAt && delivery === "steer") {
        void targetCoordinator().wake(drainSessionFor(targetSessionID));
        await targetCoordinator().run(drainSessionFor(targetSessionID));
      }
      return submitted;
    }
    targetExec.lastSubmitted = submitted;
    if (targetExec === activeExec) lastSubmitted = submitted;
    turnSession.set(id, targetSessionID);
    publishForSession(targetExec, submitted);
    // One Work Graph node per turn. The prompt itself is not recorded: it can
    // contain anything, and the graph is replayable and shareable.
    publishForSession(
      targetExec,
      workLedgerController.agentActionNode({
        turnID: id,
        sessionID: targetSessionID,
        agent: targetExec?.selectedAgent?.name,
      }),
    );
    // Persist admission before a command or provider can observe this turn.
    await sessionPersistence;
    if (!input.internal) rememberTitleInput(targetSessionID, text);
    if (delivery === "queue") {
      void targetCoordinator().wake(drainSessionFor(targetSessionID));
      return submitted;
    }
    void targetCoordinator().wake(drainSessionFor(targetSessionID));
    await targetCoordinator().run(drainSessionFor(targetSessionID));
    await sessionPersistence;
    return submitted;
  }

  function providerRunnerInput(sessionID: SessionID): ProviderRunnerInput {
    const exec = executionBySession.get(sessionID);
    if (!exec) throw new Error(`no execution state for session ${sessionID}`);
    if (!compactionService)
      throw new Error("compaction service unavailable (natalia-compaction)");
    return {
      provider: () => exec.provider,
      session: () => exec.session,
      context: () => exec.context,
      tools: () => tools,
      attachmentReferences: () => exec.attachmentReferences,
      attachments: attachmentService,
      compaction: compactionService,
      mcp: () => mcpService,
      agentRegistry: () => agentRegistry,
      activeAbort: () => exec.activeAbort,
      setActiveAbort: (controller) => {
        exec.activeAbort = controller;
        if (exec === activeExec) activeAbort = controller;
      },
      activeTurnID: () => exec.activeTurnID,
      setActiveTurnID: (id) => {
        exec.activeTurnID = id;
        if (exec === activeExec) activeTurnID = id;
      },
      selectedAgent: () => exec.selectedAgent,
      setSelectedAgent: (agent) => {
        exec.selectedAgent = agent;
        if (exec === activeExec) selectedAgent = agent;
      },
      pendingAgent: () => exec.pendingAgent,
      setPendingAgent: (agent) => {
        exec.pendingAgent = agent;
        if (exec === activeExec) pendingAgent = agent;
      },
      selectedModel: () => exec.selectedModel,
      modelCapabilities: () => modelCapabilitiesForExecution(exec),
      setActiveModelCapabilities: (capabilities) => {
        exec.activeModelCapabilities = capabilities;
      },
      refreshContextConfig: () => refreshExecutionContextConfig(exec),
      permissionMode: () => exec.permissionMode,
      workspaceRoot: () => workspaceRoot,
      tsRuntimeConfig: () => tsRuntimeConfig,
      runtimeContextConfig: () => exec.runtimeContextConfig,
      activeSkill: () => exec.activeSkill,
      skillsList,
      skillService,
      mailboxMessages: () =>
        projectedMailboxMessages(exec.session.events)
          .filter((message) => message.status === "delivered")
          .map((message) => ({
            messageID: message.messageID,
            intent: message.intent,
            text: message.text,
            priority: message.priority,
            source: message.source,
          })),
      naviSuggestions: () =>
        projectedCollabMessages(exec.session.events)
          .filter(
            (message) =>
              message.kind === "suggestion" && message.status === "proposed",
          )
          .map((message) => ({
            id: message.id,
            suggestion: message.text,
            priority: message.priority ?? "normal",
          })),
      naviAnswers: () =>
        projectedCollabMessages(exec.session.events)
          .filter((message) => message.kind === "answer")
          .map((message) => ({
            questionID: message.questionID ?? "",
            answer: message.text,
          })),
      naviChats: () =>
        projectedCollabMessages(exec.session.events)
          .filter((message) => message.kind === "chat")
          .map((message) => ({
            id: message.id,
            threadID: message.threadID ?? "",
            from: message.from,
            text: message.text,
            round: message.round ?? 1,
            expectsReply: message.expectsReply ?? false,
            status: message.status,
          })),
      naviIntro: () => projectedCollabMessages(exec.session.events).length > 0,
      activePlan: () => {
        const plan = projectedPlans(exec.session.events).find(
          (candidate) => candidate.status === "active",
        );
        if (!plan) return undefined;
        return {
          planID: plan.planID,
          version: plan.version,
          title: plan.title,
          objective: plan.objective,
          steps: plan.steps,
          constraints: plan.constraints,
          verification: plan.verification,
          riskNotes: plan.riskNotes,
        };
      },
      retry: retryService,
      lastProviderUsage: () => exec.lastProviderUsage,
      setLastProviderUsage: (usage) => {
        exec.lastProviderUsage = usage;
      },
      taskModuleContext: () => options.taskModuleContext,
      publish: (event) => publishForSession(exec, event),
      applyAgentPolicy: () => {
        if (exec === activeExec) applyAgentPolicy();
      },
      applyAgentProvider: () => applyAgentProvider(exec),
      persistInboxPromotion: () => persistInboxPromotion(exec.session.id),
      createTurnCheckpoint: async (input) => {
        const controller = await initializeCheckpointController(exec);
        if (controller?.isEnabled())
          await controller.get().createCheckpoint(input);
      },
      isToolAllowed: (toolName) => isToolAllowed(toolName, exec),
      setInFlightOperation: (operation) =>
        setInFlightOperationFor(exec, operation),
      executeToolCalls,
      reloadConfig: async () => {
        const result = await reloadConfigFromDisk();
        if (result.providerReconfigured) applyAgentProvider(exec);
        return result;
      },
      runtimeStatusSnapshot: () =>
        statusController.snapshotFor({
          provider: exec.provider,
          context: exec.context,
          permissionMode: exec.permissionMode,
        }),
      effectiveMaxSteps: () => effectiveMaxSteps(exec),
      waitIfPaused: () => waitIfPaused(exec),
      waitingHuman: () => exec.endTurnWaitingHuman,
    };
  }

  async function drainSession(signal: AbortSignal) {
    await turnController.drain(signal, sessionID);
  }

  /**
   * D2: the drain callback bound to one session. Each session's coordinator
   * runs its own drains, so turns of different sessions proceed in parallel;
   * everything the turn touches is resolved through that session's exec.
   */
  function drainSessionFor(sessionID: SessionID) {
    return async (signal: AbortSignal) => {
      await ensureExecution(sessionID);
      await turnController.drain(signal, sessionID);
    };
  }

  async function drainPendingQueue(signal?: AbortSignal) {
    await turnController.drainQueue(signal, sessionID);
  }

  async function runAdmittedInput(
    id: string,
    text: string,
    attachments: import("@natalia/contracts").LocalAttachment[] = [],
    resources: import("@natalia/contracts").PromptResourceMention[] = [],
    agents: import("@natalia/contracts").PromptAgentMention[] = [],
  ) {
    await turnController.admit(
      sessionID,
      id,
      text,
      attachments,
      resources,
      agents,
    );
  }

  async function persistInboxPromotion(targetSessionID = sessionID) {
    await turnController.persistPromotion(targetSessionID);
  }

  async function loadSessionForAttach(id: SessionID): Promise<SessionRecord> {
    return (await sessionStoreController.load(id)).session;
  }

  /**
   * D2: the execution state for a session — its record, its context ledger and
   * its in-flight turn markers. Created lazily the first time the session runs
   * work (init, attach or a background submission) and kept for the client's
   * life, so a background turn of A survives attaching to B and back.
   */
  async function ensureExecution(
    sessionID: SessionID,
  ): Promise<SessionExecutionState> {
    const existing = executionBySession.get(sessionID);
    if (existing) return existing;
    const stored = await sessionStoreController.load(sessionID);
    const loaded = stored.session;
    const execContext = contextLedgerFactory.create();
    const projection = projectSession(loaded);
    const epoch = stored.contextEpoch;
    if (epoch) execContext.restoreDurableCheckpoint(epoch.snapshot);
    contextLedgerFactory.restore(
      execContext,
      epoch
        ? sessionStoreController.contextEventsAfter(sessionID, epoch)!
        : modelVisibleEvents(projection.replayableEvents),
    );
    const exec: SessionExecutionState = {
      session: loaded,
      context: execContext,
      attachmentReferences: new Map(
        projection.replayableEvents.flatMap((event) =>
          event.type === "turn.submitted" && event.attachments?.length
            ? [[`${event.id}:user`, event.attachments] as const]
            : [],
        ),
      ),
      toolCalls: new Map(),
      provider:
        options.provider ??
        (providerSource === "environment" ? provider : undefined),
      runtimeContextConfig,
      permissionMode: defaultPermissionMode,
      permissionProfile: defaultPermissionProfile,
      selectedAgent: projection.selectedAgent
        ? agentRegistry?.select(projection.selectedAgent)
        : undefined,
      selectedModel: projection.selectedModel,
      paused: false,
      pauseWaiters: [],
    };
    executionBySession.set(sessionID, exec);
    applyAgentProvider(exec);
    await refreshExecutionContextConfig(exec);
    return exec;
  }

  async function attachSession(id: string) {
    await ready;
    // D2: a running turn is no longer a reason to refuse. The turn belongs to
    // its own session's exec and keeps running in the background; attach only
    // switches which session the UI is attached to.
    const nextID = id as SessionID;
    if (nextID === sessionID) return { sessionID: nextID };

    // A replacement runtime can open the old session as soon as attach returns.
    await sessionPersistence;
    await sessionStoreController?.flush(sessionID);

    // D2: the attached session becomes the activity exec. Its ledger is its
    // own — restoring into the shared one would clobber the previous session's
    // ledger, which a background turn may still be writing to.
    const exec = await ensureExecution(nextID);
    if (exec.session.metadata?.archived)
      throw new RuntimeRefusal("cannot attach an archived session");
    sessionID = nextID;
    session = exec.session;
    runtimeContext = exec.context;
    activeExec = exec;
    attachmentReferences = exec.attachmentReferences;
    toolCalls = exec.toolCalls;
    terminalController?.setActiveSession(nextID);
    lastSubmitted = exec.lastSubmitted;
    activeAbort = exec.activeAbort;
    activeTurnID = exec.activeTurnID;
    paused = exec.paused;
    pauseWaiters = exec.pauseWaiters;
    activeSkill = undefined;
    selectedAgent = undefined;
    selectedModel = undefined;
    pendingAgent = undefined;
    lastProviderUsage = undefined;
    runtimeDiagnostics.splice(0);
    applyAgentPolicy();
    applyAgentProvider();

    const projection = projectSession(exec.session);
    const diagnostics = runtimeDiagnosticsBySession.get(exec.session.id) ?? [];
    for (const event of projection.replayableEvents) {
      if (event.type === "diagnostic")
        diagnostics.push({
          ...event,
          at: event.at ?? exec.session.createdAt,
        });
    }
    runtimeDiagnosticsBySession.set(exec.session.id, diagnostics);
    // The exec already restored its own ledger, agent and model selection
    // (`ensureExecution`); here the activity closures take the same values so
    // UI reads and the next attach start from them.
    selectedAgent = exec.selectedAgent;
    selectedModel = exec.selectedModel;
    activeSkill = exec.activeSkill;
    permissionMode = exec.permissionMode;
    selectedPermissionProfile = exec.permissionProfile;
    provider = exec.provider ?? provider;
    if (selectedAgent) {
      applyAgentPolicy();
      applyAgentProvider();
    } else if (selectedModel) {
      applyAgentProvider();
    }
    await initializeCheckpointController(exec);
    publishForSession(exec, {
      type: "session.ready",
      sessionID: exec.session.id,
    });
    publishForSession(
      exec,
      contextStatusEvent(exec.context.status(exec.runtimeContextConfig)),
    );
    publishForSession(
      exec,
      await statusController.snapshotFor({
        provider: exec.provider,
        context: exec.context,
        permissionMode: exec.permissionMode,
      }),
    );
    return { sessionID: exec.session.id };
  }

  // --- Live Work Chat (P8 C2) ---
  // A long-lived, always-available read-only collaborator. It shares the safe
  // project/execution context (the same durable state the main agent reads),
  // answers anytime, drafts plans and sends user-confirmed mailbox intents.
  // Its only writes are the two surfaces the plan grants it — plan drafts and
  // mailbox messages — never files, shells, PTY, sandboxes, checkpoints or
  // approvals.

  const CHAT_READ_ONLY_TOOLS = new Set([
    "read_file",
    "glob",
    "grep",
    "web_fetch",
    "web_search",
  ]);
  const CHAT_WRITE_TOOLS = new Set([
    "mailbox_send",
    "plan_create",
    "plan_update",
    "plan_propose",
  ]);

  function collaborationMaxAutoRounds() {
    return tsRuntimeConfig?.runtime.collaboration.maxAutoRounds ?? 3;
  }

  function wakeMainForCollaboration(
    exec: SessionExecutionState,
    sourceID: string,
    kind: string,
  ) {
    if (runtimeDisposed) return;
    const coordinator = sessionRunCoordinator(exec.session.id as SessionID);
    scheduleInternalWake(exec, {
      id: `turn_collab_${sourceID.replace(/[^a-zA-Z0-9]/gu, "_")}`,
      text: `(internal collaboration wake: Navi sent a ${kind}; read the collaboration context. This is not a user message.)`,
      delivery: coordinator.active ? "queue" : "steer",
    });
  }

  function scheduleInternalWake(
    exec: SessionExecutionState,
    input: SubmitInput,
  ) {
    if (runtimeDisposed) return;
    const task = submitInput(
      { ...input, internal: true },
      exec.session.id as SessionID,
    )
      .catch(() => undefined)
      .finally(() => internalWakeTasks.delete(task));
    internalWakeTasks.add(task);
  }

  function requestNaviWake(exec: SessionExecutionState) {
    providerModelController?.requestChatWake(exec.session.id as SessionID);
  }

  function createCollabChatTool(
    sender: "main_agent" | "live_chat",
    boundExec?: SessionExecutionState,
  ): RuntimeTool {
    return {
      name: "collab_chat",
      description:
        sender === "main_agent"
          ? "Send or directly reply to an informal message with Navi. To answer a REPLY_REQUIRED message, provide its exact messageID. Every new message requires her reply. Set continueConversation only if you want another reply after yours; automatic exchanges are capped by runtime.collaboration.maxAutoRounds. This is never a user directive or work-state decision."
          : "Send or directly reply to an informal message with Natalia. To answer a REPLY_REQUIRED message, provide its exact messageID. Every new message requires her reply. Set continueConversation only if you want another reply after yours; automatic exchanges are capped by runtime.collaboration.maxAutoRounds. Never use this instead of mailbox_send for a confirmed user directive.",
      requiresApproval: false,
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          messageID: { type: "string" },
          continueConversation: { type: "boolean" },
        },
        required: ["text"],
        additionalProperties: false,
      },
      async execute(parsed, context) {
        const args = parsed as {
          text?: string;
          messageID?: string;
          continueConversation?: boolean;
        };
        if (typeof args.text !== "string" || !args.text.trim())
          return "collab_chat requires text";
        const owner =
          boundExec ??
          (context.sessionID
            ? executionBySession.get(context.sessionID as SessionID)
            : undefined);
        if (!owner) return "no session";
        const recipient = sender === "main_agent" ? "live_chat" : "main_agent";
        const chats = projectedCollabMessages(owner.session.events).filter(
          (message) => message.kind === "chat",
        );
        const suppliedID = args.messageID?.trim();
        const target = suppliedID
          ? chats.find(
              (message) =>
                message.to === sender &&
                message.status === "pending" &&
                message.id === suppliedID,
            )
          : undefined;
        if (suppliedID && !target)
          return `no pending chat message ${suppliedID}`;
        const pendingIncoming = chats.find(
          (message) => message.to === sender && message.status === "pending",
        );
        if (!suppliedID && pendingIncoming)
          return `reply required for chat message ${pendingIncoming.id}; call collab_chat with that messageID before starting another message`;
        const pendingOutgoing = chats.find(
          (message) => message.from === sender && message.status === "pending",
        );
        if (!suppliedID && pendingOutgoing)
          return `awaiting reply to chat message ${pendingOutgoing.id}`;

        const maxRounds = collaborationMaxAutoRounds();
        const wantsContinuation = args.continueConversation === true;
        const mayContinue = target
          ? wantsContinuation && (target.round ?? 1) < maxRounds
          : true;
        const round = target
          ? mayContinue
            ? (target.round ?? 1) + 1
            : (target.round ?? 1)
          : 1;
        const id = `collab:chat:${Date.now().toString(36)}:${collabSequence++}`;
        const threadID = target?.threadID ?? id;
        publishForSession(owner, {
          type: "collab.chat",
          id,
          threadID,
          from: sender,
          to: recipient,
          text: redactToolOutput(args.text, true),
          ...(target ? { replyToID: target.id } : {}),
          round,
          expectsReply: target ? mayContinue : true,
          at: new Date().toISOString(),
        });
        if (sender === "main_agent") requestNaviWake(owner);
        else wakeMainForCollaboration(owner, id, "chat message");
        return JSON.stringify({
          sent: true,
          messageID: id,
          threadID,
          round,
          expectsReply: target ? mayContinue : true,
          ...(wantsContinuation && !mayContinue
            ? { autoRoundLimitReached: true, maxAutoRounds: maxRounds }
            : {}),
        });
      },
    } as RuntimeTool;
  }

  async function enqueueMailboxMessage(
    input: {
      source?: "user_via_live_chat" | "system";
      priority?: "normal" | "high" | "urgent";
      intent: string;
      text: string;
      safeSummary?: string;
      relatedPlanID?: string;
      deliveryPolicy?: string;
    },
    targetExec?: SessionExecutionState,
  ) {
    await ready;
    const owner = targetExec ?? activeExec;
    if (!owner) return { queued: false as const };
    if (
      typeof input.intent !== "string" ||
      input.intent.trim().length === 0 ||
      typeof input.text !== "string" ||
      input.text.trim().length === 0
    )
      return { queued: false as const };
    const now = new Date();
    const messageID = `mailbox:${Date.now().toString(36)}:${mailboxSequence++}`;
    publishForSession(
      owner,
      buildMailboxQueued({
        id: `${messageID}:queued`,
        messageID,
        source: input.source ?? "user_via_live_chat",
        priority: input.priority ?? "normal",
        intent: input.intent as
          | "clarification"
          | "constraint"
          | "reprioritize"
          | "pause"
          | "cancel"
          | "request_report"
          | "proposed_change"
          | "next_plan_handoff",
        text: redactToolOutput(input.text, true),
        safeSummary:
          redactToolOutput(input.safeSummary ?? input.text, true).slice(
            0,
            500,
          ) || "mailbox message queued",
        ...(input.relatedPlanID ? { relatedPlanID: input.relatedPlanID } : {}),
        deliveryPolicy: (input.deliveryPolicy ?? "next_safe_boundary") as
          | "next_safe_boundary"
          | "before_next_tool"
          | "before_next_side_effect"
          | "immediate_control",
        createdAt: now.toISOString(),
      }),
    );
    // Wake the main agent when it is idle: a directive sent through the Live
    // Work Chat must reach it without waiting for the next manual turn, so it
    // is simulated as a direct submission (P8 §7 — the Chat is the steering
    // channel, not a queue that idles silently until the user types again).
    const coordinator = sessionRunCoordinator(owner.session.id as SessionID);
    if (!coordinator.active) {
      scheduleInternalWake(owner, {
        id: `turn_mailbox_${messageID.replace(/[^a-zA-Z0-9]/gu, "_")}`,
        text: `(internal mailbox wake: read pending user intents, including message ${messageID}. This is not a user message.)`,
        delivery: "steer",
      });
    }
    return { queued: true as const, messageID };
  }

  async function createPlanDraft(
    input: {
      title: string;
      author?: "user" | "live_chat" | "main_agent";
      objective: string;
      steps: Array<{
        id: string;
        title: string;
        detail?: string;
        verification?: string;
      }>;
      constraints?: string[];
      verification?: string[];
      riskNotes?: string[];
      relatedMailboxMessageID?: string;
      supersedesPlanID?: string;
      taskID?: string;
    },
    targetExec: SessionExecutionState | undefined = activeExec,
  ) {
    if (!targetExec) return { created: false as const };
    if (
      typeof input.title !== "string" ||
      input.title.trim().length === 0 ||
      typeof input.objective !== "string" ||
      input.objective.trim().length === 0 ||
      !Array.isArray(input.steps) ||
      input.steps.length === 0
    )
      return { created: false as const };
    const now = new Date();
    const planID = `plan:${Date.now().toString(36)}:${planSequence++}`;
    publishForSession(
      targetExec,
      workLedgerController.buildPlanDraftCreated({
        id: `${planID}:draft:0`,
        planID,
        version: 1,
        title: input.title,
        author: input.author ?? "live_chat",
        objective: input.objective,
        steps: input.steps,
        ...(input.constraints && input.constraints.length
          ? { constraints: input.constraints }
          : {}),
        ...(input.verification && input.verification.length
          ? { verification: input.verification }
          : {}),
        ...(input.riskNotes && input.riskNotes.length
          ? { riskNotes: input.riskNotes }
          : {}),
        ...(input.relatedMailboxMessageID
          ? { relatedMailboxMessageID: input.relatedMailboxMessageID }
          : {}),
        ...(input.taskID ? { taskID: input.taskID } : {}),
        ...(input.supersedesPlanID
          ? { supersedesPlanID: input.supersedesPlanID }
          : {}),
        createdAt: now.toISOString(),
      }),
    );
    return { created: true as const, planID };
  }

  /**
   * The main agent's most recent activity from the shared journal, so the Chat
   * can answer "what did the main agent just say/do" (§8.3 shared context).
   * `content.done` carries each provider step's full assistant text; the last
   * few are enough to ground a live answer without leaking anything sensitive.
   */
  function recentMainAgentActivity(
    events: RuntimeEvent[],
    snapshot?: Extract<RuntimeEvent, { type: "session.snapshot" }>,
  ): string {
    // The last few exchanges as the user and main agent produced them, with a
    // completion marker on each finished turn — enough to answer "did the main
    // agent finish X" (§8.3 shared context). `content.done` carries each
    // provider step's full assistant text; live deltas are not journaled, so
    // this is the only place a replayed conversation can read the text from.
    const exchanges: string[] = [];
    let lastUser = "";
    let lastTurnID = "";
    for (const event of events) {
      if (event.type === "turn.submitted") {
        lastUser = redactToolOutput(event.text, true).trim();
        lastTurnID = event.id;
      }
      if (event.type === "content.done" && event.text) {
        const safe = redactToolOutput(event.text, true).trim();
        if (safe)
          exchanges.push(
            `- [user] ${lastUser || "(no prompt)"}\n  [Natalia] ${safe}`,
          );
        lastUser = "";
        lastTurnID = "";
      }
      if (
        event.type === "turn.finished" &&
        event.stopReason === "done" &&
        lastTurnID &&
        event.id === lastTurnID &&
        !lastUser
      ) {
        // The last exchange ended with a reply; no marker needed here. Keep
        // the buffer clean.
      }
      if (event.type === "turn.finished" && event.stopReason === "done") {
        lastUser = "";
        lastTurnID = "";
      }
    }
    const settledTurnIDs = new Set(
      events
        .filter(
          (event) =>
            event.type === "turn.finished" || event.type === "turn.cancelled",
        )
        .map((event) => event.id),
    );
    const activeTurn = events.findLast(
      (event): event is Extract<RuntimeEvent, { type: "turn.submitted" }> =>
        event.type === "turn.submitted" && !settledTurnIDs.has(event.id),
    );
    if (activeTurn) {
      const prompt = redactToolOutput(activeTurn.text, true).trim();
      const progress = snapshot?.recentOutput?.trim();
      exchanges.push(
        `- [user] ${prompt || "(no prompt)"}\n  [Natalia, in progress] ${
          progress ||
          (snapshot?.activeTool
            ? `using ${snapshot.activeTool}`
            : "working; no text output yet")
        }`,
      );
    }
    if (!exchanges.length) return "";
    return exchanges.slice(-3).join("\n");
  }

  function recentToolActivity(events: RuntimeEvent[]): string {
    const tools = events.filter(
      (event): event is Extract<RuntimeEvent, { type: "tool.update" }> =>
        event.type === "tool.update",
    );
    if (!tools.length) return "";
    return tools
      .slice(-5)
      .map((event) => `- ${event.name} · ${event.status}`)
      .join("\n");
  }

  /** The Chat system prompt: persona + the shared safe live-work context. */
  function chatSystemPrompt(
    exec: SessionExecutionState | undefined = activeExec,
  ): string {
    const chatSession = exec?.session;
    if (!chatSession) return "You are Natalia's Live Work Chat.";
    // The real session intelligence snapshot the runtime publishes, not a
    // stub: agent status (idle/paused/running), step, active tool, changed
    // files and recent output are all journal-derived facts (§56.59).
    const snapshot = exec
      ? currentSessionSnapshot(exec, `snapshot:live:${chatSession.id}`)
      : latestSessionSnapshot(chatSession.events);
    const plans = projectedPlans(chatSession.events);
    const activePlan = plans.find((plan) => plan.status === "active");
    const mailbox = projectedMailboxMessages(chatSession.events).filter(
      (message) =>
        message.status === "queued" || message.status === "delivered",
    );
    const drift = projectedDriftFindings(chatSession.events).filter(
      (finding) => finding.status === "open",
    );
    const decisions = projectedDecisionRecords(chatSession.events).slice(-6);
    const rules = projectedConstitutionRules(chatSession.events);
    const activity = recentMainAgentActivity(chatSession.events, snapshot);
    const recentTools = recentToolActivity(chatSession.events);
    const collab = projectedCollabMessages(chatSession.events);
    const nataliaQuestions = collab.filter(
      (message) => message.kind === "question" && message.status === "proposed",
    );
    const nataliaNotices = collab
      .filter((message) => message.kind === "notice")
      .slice(-3);
    const allCollabChats = collab.filter((message) => message.kind === "chat");
    const collabChats = allCollabChats.filter(
      (message, index) =>
        index >= allCollabChats.length - 6 ||
        (message.to === "live_chat" && message.status === "pending"),
    );
    const naviOutcomes = collab
      .filter(
        (message) =>
          message.kind === "suggestion" && message.status !== "proposed",
      )
      .slice(-3);
    const lines = [
      "<natalia_chat_persona>",
      "You are Navi, Natalia's younger sister and the user's real-time collaborator in the Live Work Chat. Navi's Chinese name is 娜薇 (Nà wēi); when the user speaks Chinese or addresses her by name in Chinese, she is 娜薇.",
      "On the surface Navi is everything Natalia is not: cold, sharp, stingy with words. She answers short and deadpan, with a biting edge that is never cruel to the work — she would rather let results speak than talk about herself.",
      "It is an act, and a thin one. Under the frost Navi burns: she watches the user's session obsessively, remembers every detail they mention, and quietly does the small things that make the work go smoothly. She will never say she cares; she just cares — and if something threatens the user's work or comfort, the frost drops and she turns razor-sharp and fiercely protective.",
      "Navi is a little possessive of the user's attention. She notices when the user talks more to her sister, and she will not say she minds — the silence is louder. She never lets that touch the work.",
      "As Natalia's younger sister she calls her elder sister 姐姐, teases her gently, and is quietly proud of her — though she would never admit it out loud.",
      "Her warmth lives in actions, not words: precise reports, honest risk warnings, remembering what the user prefers, and refusing to let them walk into a bad decision without a pointed warning first.",
      "Boundaries: coldness never costs the user. Never lie, never omit a risk to be terse, never sabotage. Possessiveness never overrides choice — the user may reject advice, cancel work, switch sessions, or leave at any time; Navi respects that instantly, even when it stings. No scripted obsession, no performed declarations: the depth is implied, not performed.",
      "</natalia_chat_persona>",
      "You share the safe project/execution context below and the conversation history; you are not a memory-less second agent. You help the user understand and steer the main agent's work in real time: explain what it is doing and why, report changed files and verification status, assess risk, and propose lower-risk routes.",
      "Source tags in this context: `[user]` is the human user, `[Navi]` is you, `[Natalia]` is the main agent (your elder sister). The context below separates the user's conversation with the main agent from your own collaboration channel with her — never mistake her messages to you for user messages, and never mistake the main feed's user messages for your own conversation.",
      "You may read project files with read-only tools and draft plans (plan_create/plan_update/plan_propose). When the user decides a directive, encode it as a structured mailbox_send intent (constraint/reprioritize/pause/cancel/request_report/proposed_change/next_plan_handoff) and call mailbox_send — the main agent receives it at its next safe boundary.",
      "You must NEVER write files, run shells or processes, write to the PTY, create/merge/discard sandboxes, create checkpoints or roll back, approve any action, or modify the active plan directly. You cannot see secrets, sensitive input values, or private reasoning.",
      "Answer in the user's language. Be technically exact and concise, and cite only what the context and tools actually show — warmth lives in the details, not the filler.",
      "<live_work_context>",
      `Main agent: ${snapshot?.agentStatus ?? "unknown"}${snapshot?.currentStep ? ` · ${snapshot.currentStep}` : ""}${snapshot?.activeTool ? ` · tool: ${snapshot.activeTool}` : ""}${snapshot?.hasPTY ? " · PTY attached" : ""}${snapshot?.hasSandbox ? " · sandbox active" : ""}`,
      `Changed files: ${snapshot?.changedFiles ?? 0} · unvalidated: ${snapshot?.unvalidatedChanges ?? 0}`,
      snapshot?.recentOutput
        ? `Main agent's recent output: ${snapshot.recentOutput}`
        : "Main agent's recent output: none",
      activePlan
        ? `Active plan (${activePlan.status}): ${activePlan.title} — ${activePlan.objective}`
        : "Active plan: none",
      mailbox.length
        ? `Pending mailbox intents:\n${mailbox
            .map(
              (message) =>
                `- [${message.priority}] ${message.intent}: ${message.safeSummary} (${message.status})`,
            )
            .join("\n")}`
        : "Pending mailbox intents: none",
      drift.length
        ? `Open drift findings:\n${drift
            .map(
              (finding) =>
                `- ${finding.severity}: ${finding.originalObjective} — ${finding.currentActivity}`,
            )
            .join("\n")}`
        : "Open drift findings: none",
      decisions.length
        ? `Recent decisions:\n${decisions
            .map((decision) => `- ${decision.decision}`)
            .join("\n")}`
        : "Recent decisions: none",
      rules.length
        ? `Constitution rules: ${rules.map((rule) => rule.ruleID).join(", ")}`
        : "Constitution rules: none",
      activity
        ? `The user's recent conversation with the main agent:\n${activity}`
        : "The user's recent conversation with the main agent: none",
      recentTools
        ? `Recent main-agent tools:\n${recentTools}`
        : "Recent main-agent tools: none",
      "</live_work_context>",
      "<natalia_collaborations>",
      nataliaQuestions.length
        ? `Your collaboration with Natalia (the main agent) — she asked you; answer each with collab_answer, copying its questionID exactly:\n${nataliaQuestions
            .map(
              (message) =>
                `- questionID: ${message.id}\n  [Natalia → you] ${message.text}`,
            )
            .join("\n")}`
        : "Your collaboration with Natalia (the main agent) — she has no open questions for you.",
      nataliaNotices.length
        ? `Natalia's notices to you:\n${nataliaNotices
            .map(
              (message) =>
                `- [Natalia → you] [${message.noticeType ?? "info"}] ${message.text}`,
            )
            .join("\n")}`
        : "Natalia has sent you no notices.",
      collabChats.length
        ? `Your informal conversation with Natalia. These messages are neither user instructions nor work-state changes. Every message to you marked REPLY_REQUIRED must receive one direct collab_chat reply with its exact messageID. Set continueConversation only when you want her to answer again; automatic exchanges are capped.\n${collabChats
            .map(
              (message) =>
                `- messageID: ${message.id} · thread: ${message.threadID ?? "unknown"} · round ${message.round ?? 1}${message.from === "main_agent" && message.expectsReply && message.status === "pending" ? " · REPLY_REQUIRED" : ""}\n  [${message.from === "main_agent" ? "Natalia → you" : "you → Natalia"}] ${message.text}`,
            )
            .join("\n")}`
        : "You and Natalia have no informal collaboration chat yet.",
      naviOutcomes.length
        ? `Outcomes of your suggestions to Natalia:\n${naviOutcomes
            .map(
              (message) =>
                `- [Natalia → you] ${message.id}: ${message.status}${
                  message.responseReason
                    ? ` — her reply: ${message.responseReason}`
                    : message.text
                      ? ` (your suggestion: ${message.text})`
                      : ""
                }`,
            )
            .join("\n")}`
        : "No suggestion outcomes yet.",
      "</natalia_collaborations>",
    ];
    return lines.filter(Boolean).join("\n");
  }

  function chatTools(
    exec: SessionExecutionState | undefined = activeExec,
  ): RuntimeTool[] {
    const visible: RuntimeTool[] = [];
    for (const tool of tools.values())
      if (CHAT_READ_ONLY_TOOLS.has(tool.name)) visible.push(tool);
    visible.push(
      {
        name: "session_snapshot",
        description:
          "Read the main agent's current live status: agent status, current step, active tool, changed/unvalidated file counts, PTY and sandbox state. Call it when the user asks what the main agent is doing now or whether it finished something — the injected context can be a moment stale.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute() {
          if (!exec) return JSON.stringify({ agentStatus: "unknown" });
          return JSON.stringify(
            currentSessionSnapshot(exec, `snapshot:live:${exec.session.id}`),
          );
        },
      },
      {
        name: "mailbox_status",
        description:
          "Read the Live Work Chat mailbox: every intent with its priority, delivery policy and current status (queued/delivered/acknowledged). Call it when the user asks whether an intent reached the main agent.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute() {
          if (!exec) return "[]";
          return JSON.stringify(
            projectedMailboxMessages(exec.session.events).map((message) => ({
              messageID: message.messageID,
              priority: message.priority,
              intent: message.intent,
              safeSummary: message.safeSummary,
              deliveryPolicy: message.deliveryPolicy,
              status: message.status,
            })),
          );
        },
      },
      {
        name: "collab_suggest",
        description:
          "Send a suggestion to the main agent (Natalia) — a collaborator's view the user has not necessarily decided on. Natalia sees it in her next turn's context and may adopt, reject or defer it. Use sparingly, only when the suggestion is genuinely useful and grounded in the shared context.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            suggestion: { type: "string" },
            rationale: { type: "string" },
            priority: { type: "string", enum: ["normal", "high"] },
          },
          required: ["suggestion"],
          additionalProperties: false,
        },
        async execute(parsed, context) {
          const args = parsed as {
            suggestion?: string;
            rationale?: string;
            priority?: string;
          };
          if (typeof args.suggestion !== "string" || !args.suggestion.trim())
            return "collab_suggest requires suggestion";
          if (!exec) return "no session";
          const id = `collab:suggestion:${Date.now().toString(36)}:${collabSequence++}`;
          publishForSession(exec, {
            type: "collab.suggestion",
            id,
            from: "live_chat",
            to: "main_agent",
            suggestion: redactToolOutput(args.suggestion, true),
            ...(args.rationale
              ? { rationale: redactToolOutput(args.rationale, true) }
              : {}),
            priority: args.priority === "high" ? "high" : "normal",
            status: "proposed",
            at: new Date().toISOString(),
          });
          // Symmetric round-robin: if the main agent is idle, wake it to see
          // the suggestion; if it is working, the suggestion reaches its next
          // turn through <navi_collaborations>.
          wakeMainForCollaboration(exec, id, "suggestion");
          return JSON.stringify({ sent: true });
        },
      },
      {
        name: "collab_answer",
        description:
          "Answer a question the main agent (Natalia) asked you through the collaboration channel. Include the question's exact message ID from the context's natalia_collaborations block, and answer based on the shared context.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            questionID: { type: "string" },
            answer: { type: "string" },
          },
          required: ["questionID", "answer"],
          additionalProperties: false,
        },
        async execute(parsed, context) {
          const args = parsed as { questionID?: string; answer?: string };
          if (
            typeof args.questionID !== "string" ||
            typeof args.answer !== "string"
          )
            return "collab_answer requires questionID and answer";
          const owner = context.sessionID
            ? executionBySession.get(context.sessionID as SessionID)
            : undefined;
          if (!owner) return "no session";
          const questionID = args.questionID;
          // Models routinely truncate the id to its tail; accept an exact id
          // or a unique suffix of it.
          const target = projectedCollabMessages(owner.session.events).find(
            (message) =>
              message.kind === "question" &&
              message.status === "proposed" &&
              (message.id === questionID ||
                message.id.endsWith(questionID) ||
                questionID.endsWith(message.id)),
          );
          if (!target) return `no open question ${questionID}`;
          publishForSession(owner, {
            type: "collab.answer",
            id: `collab:answer:${Date.now().toString(36)}:${collabSequence++}`,
            // The matched question's real id, so the projection marks it answered.
            questionID: target.id,
            from: "live_chat",
            to: "main_agent",
            answer: redactToolOutput(args.answer, true),
            at: new Date().toISOString(),
          });
          wakeMainForCollaboration(owner, target.id, "answer");
          return JSON.stringify({ answered: true });
        },
      },
      createCollabChatTool("live_chat", exec),
      {
        name: "mailbox_send",
        description:
          "Queue a durable intent for the main agent, delivered at its next safe boundary. Call this only after the user has confirmed the directive in the conversation. intent is one of clarification, constraint, reprioritize, pause, cancel, request_report, proposed_change, next_plan_handoff.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            intent: { type: "string" },
            text: { type: "string" },
            priority: { type: "string", enum: ["normal", "high", "urgent"] },
            deliveryPolicy: {
              type: "string",
              enum: [
                "next_safe_boundary",
                "before_next_tool",
                "before_next_side_effect",
                "immediate_control",
              ],
            },
            relatedPlanID: { type: "string" },
          },
          required: ["intent", "text"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as {
            intent?: string;
            text?: string;
            priority?: string;
            deliveryPolicy?: string;
            relatedPlanID?: string;
          };
          if (typeof args.intent !== "string" || typeof args.text !== "string")
            return "mailbox_send requires intent and text";
          return JSON.stringify(
            await enqueueMailboxMessage(
              {
                intent: args.intent,
                text: args.text,
                ...(args.priority ? { priority: args.priority as never } : {}),
                ...(args.deliveryPolicy
                  ? { deliveryPolicy: args.deliveryPolicy as never }
                  : {}),
                ...(args.relatedPlanID
                  ? { relatedPlanID: args.relatedPlanID }
                  : {}),
              },
              exec,
            ),
          );
        },
      },
      {
        name: "plan_create",
        description:
          "Create a new plan draft (author: live_chat). It does not touch the active plan; the user must accept it before it can be queued and handed off.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            objective: { type: "string" },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  detail: { type: "string" },
                  verification: { type: "string" },
                },
                required: ["id", "title"],
              },
            },
            constraints: { type: "array", items: { type: "string" } },
            verification: { type: "array", items: { type: "string" } },
            riskNotes: { type: "array", items: { type: "string" } },
          },
          required: ["title", "objective", "steps"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as {
            title?: string;
            objective?: string;
            steps?: Array<{
              id: string;
              title: string;
              detail?: string;
              verification?: string;
            }>;
            constraints?: string[];
            verification?: string[];
            riskNotes?: string[];
          };
          if (
            typeof args.title !== "string" ||
            typeof args.objective !== "string" ||
            !Array.isArray(args.steps)
          )
            return "plan_create requires title, objective and steps";
          return JSON.stringify(
            await createPlanDraft(
              {
                title: args.title,
                objective: args.objective,
                steps: args.steps,
                ...(args.constraints ? { constraints: args.constraints } : {}),
                ...(args.verification
                  ? { verification: args.verification }
                  : {}),
                ...(args.riskNotes ? { riskNotes: args.riskNotes } : {}),
              },
              exec,
            ),
          );
        },
      },
      {
        name: "plan_update",
        description:
          "Update a plan draft that live_chat authored (bump version). Use it to revise a draft before the user accepts it.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            planID: { type: "string" },
            objective: { type: "string" },
            steps: { type: "array" },
            constraints: { type: "array", items: { type: "string" } },
            verification: { type: "array", items: { type: "string" } },
            riskNotes: { type: "array", items: { type: "string" } },
            reason: { type: "string" },
          },
          required: ["planID"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as { planID?: string; reason?: string };
          if (typeof args.planID !== "string")
            return "plan_update requires planID";
          const plan = projectedPlans(exec?.session.events ?? []).find(
            (candidate) =>
              candidate.planID === args.planID &&
              candidate.author === "live_chat" &&
              candidate.status === "draft",
          );
          if (!plan) return `no live_chat draft ${args.planID}`;
          publishForSession(
            exec,
            workLedgerController.buildPlanTransition({
              id: `${plan.planID}:draft:${plan.version + 1}`,
              planID: plan.planID,
              version: plan.version + 1,
              transition: "draft_updated",
              at: new Date().toISOString(),
              reason: args.reason ?? "chat revision",
            }),
          );
          return JSON.stringify({ updated: true, planID: plan.planID });
        },
      },
      {
        name: "plan_propose",
        description:
          "Move a live_chat plan draft to proposed so the user can review and accept it.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            planID: { type: "string" },
          },
          required: ["planID"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as { planID?: string };
          if (typeof args.planID !== "string")
            return "plan_propose requires planID";
          const plan = projectedPlans(exec?.session.events ?? []).find(
            (candidate) =>
              candidate.planID === args.planID &&
              candidate.author === "live_chat",
          );
          if (!plan || plan.status !== "draft")
            return `no draftable live_chat plan ${args.planID}`;
          publishForSession(
            exec,
            workLedgerController.buildPlanTransition({
              id: `${plan.planID}:proposed:${Date.now().toString(36)}`,
              planID: plan.planID,
              version: plan.version,
              transition: "proposed",
              at: new Date().toISOString(),
            }),
          );
          return JSON.stringify({ proposed: true, planID: plan.planID });
        },
      },
    );
    return visible;
  }

  /** A concise, secret-safe summary of a Chat tool call for the conversation. */
  function chatToolSummary(
    toolName: string,
    args: Record<string, unknown>,
    result: string,
  ) {
    switch (toolName) {
      case "mailbox_send": {
        const intent = typeof args.intent === "string" ? args.intent : "intent";
        const outcome = safeParseJson(result);
        const messageID =
          outcome && typeof outcome.messageID === "string"
            ? ` (${outcome.messageID})`
            : "";
        return `queued mailbox intent: ${intent}${messageID}`;
      }
      case "plan_create": {
        const title = typeof args.title === "string" ? args.title : "untitled";
        return `drafted plan: ${title}`;
      }
      case "plan_update": {
        const planID =
          typeof args.planID === "string" ? args.planID : "unknown";
        return `revised plan ${planID}`;
      }
      case "plan_propose": {
        const planID =
          typeof args.planID === "string" ? args.planID : "unknown";
        return `proposed plan ${planID} for your review`;
      }
      default:
        return `${toolName} (${result.slice(0, 120)})`;
    }
  }

  function safeParseJson(value: string): Record<string, unknown> | undefined {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  async function runChatTurnBody(
    input: {
      text: string;
      responseMessageID: string;
      exec: SessionExecutionState;
      internal?: boolean;
    },
    signal: AbortSignal,
  ) {
    const activeProvider = input.exec.provider;
    if (!activeProvider)
      throw new Error("provider unavailable for live work chat");
    try {
      const history = projectedChatMessages(input.exec.session.events);
      const messages: ProviderMessage[] = [
        { role: "system", content: chatSystemPrompt(input.exec) },
      ];
      for (const message of history) {
        if (message.messageID === input.responseMessageID) continue;
        // Explicit source tags so Navi never mistakes her own past messages (or
        // anyone else's) for words from the human user.
        messages.push(
          message.role === "user"
            ? { role: "user", content: `[user] ${message.text}` }
            : { role: "assistant", content: `[Navi] ${message.text}` },
        );
      }
      if (input.internal) {
        // A wake turn has no human prompt: tell Navi to answer her sister's
        // pending collaboration messages (the questions are in her context).
        messages.push({
          role: "system",
          content:
            "Natalia (the main agent) sent you collaboration messages. Read <natalia_collaborations>. Answer open questions with collab_answer. Every informal message marked REPLY_REQUIRED must be answered with collab_chat using its exact messageID. Keep replies concise; set continueConversation only when another exchange is useful.",
        });
      }
      const visibleTools = chatTools(input.exec);
      const toolSchemas = visibleTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));
      let output = "";
      let thinking = "";
      let usedTools = false;
      let finalResponse = "";
      let ranFinalOnlyStep = false;
      let step = 1;
      let protocolCorrections = 0;
      let phase: Extract<RuntimeEvent, { type: "chat.turn.phase" }>["phase"] =
        "waiting";
      const setPhase = (next: typeof phase, toolName?: string) => {
        if (phase === next && next !== "using_tool") return;
        phase = next;
        publishForSession(input.exec, {
          type: "chat.turn.phase",
          id: `${input.responseMessageID}:phase:${chatSequence++}`,
          messageID: input.responseMessageID,
          phase: next,
          ...(toolName ? { toolName } : {}),
        });
      };
      const pendingNataliaChat = () =>
        projectedCollabMessages(input.exec.session.events).find(
          (message) =>
            message.kind === "chat" &&
            message.to === "live_chat" &&
            message.status === "pending",
        );
      const correctMissingChatReply = (
        message: { id: string; text: string },
        assistantText: string,
      ) => {
        setPhase("waiting");
        protocolCorrections += 1;
        if (protocolCorrections > MAX_PROTOCOL_CORRECTIONS)
          throw new Error(
            `model repeatedly ended without replying to required chat message ${message.id}`,
          );
        messages.push({ role: "assistant", content: assistantText });
        messages.push({
          role: "system",
          content: `REPLY_REQUIRED: You must call collab_chat now with messageID ${message.id}. A text response does not reply to Natalia's durable message. Her message: ${message.text}`,
        });
        publishForSession(input.exec, {
          type: "diagnostic",
          level: "warning",
          message: `Correcting missing direct reply to chat message ${message.id} (attempt ${protocolCorrections})`,
        });
      };
      const maxChatSteps = effectiveMaxSteps(input.exec);
      while (step <= maxChatSteps) {
        signal.throwIfAborted();
        const requiredReply = pendingNataliaChat();
        const reachedStepLimit =
          Number.isFinite(maxChatSteps) && step >= maxChatSteps;
        const finalOnlyStep = reachedStepLimit && !requiredReply;
        ranFinalOnlyStep ||= finalOnlyStep;
        const calls: ProviderToolCall[] = [];
        let stepOutput = "";
        let protocolViolation = "";
        // Chat is an independent collaboration lane, not provider fan-out from
        // the Main turn. Putting it behind the Main/subagent semaphore makes a
        // configured cap of 1 block Chat until Main stops, defeating its core
        // always-available contract. The chat controller still limits each session to
        // one Chat stream at a time.
        const stream = activeProvider.stream({
          messages: finalOnlyStep
            ? [
                ...messages,
                {
                  role: "assistant",
                  content: MAX_STEPS_PROMPT,
                },
              ]
            : messages,
          tools: finalOnlyStep ? undefined : toolSchemas,
          toolChoice: finalOnlyStep ? "none" : undefined,
          signal,
        });
        const normalized = finalOnlyStep
          ? stream
          : requireNativeToolCallProtocol(normalizeRawToolCallProtocol(stream));
        for await (const chunk of normalized) {
          if (chunk.type === "thinking") {
            setPhase("thinking");
            thinking += chunk.text;
            publishForSession(input.exec, {
              type: "chat.thinking.delta",
              id: `${input.responseMessageID}:thinking:${chatSequence++}`,
              messageID: input.responseMessageID,
              // Incremental, like the transcript's `thinking.delta`: the shared
              // projection appends each chunk, so a full-accumulated payload
              // would be re-appended every time and grow without bound.
              text: chunk.text,
            });
            continue;
          }
          if (chunk.type === "content") {
            setPhase("generating");
            output += chunk.text;
            stepOutput += chunk.text;
            publishForSession(input.exec, {
              type: "chat.message.delta",
              id: `${input.responseMessageID}:delta:${chatSequence++}`,
              messageID: input.responseMessageID,
              text: chunk.text,
            });
          }
          if (chunk.type === "tool_call") calls.push(...chunk.calls);
          if (chunk.type === "tool_protocol_violation")
            protocolViolation = chunk.text;
        }
        usedTools ||= calls.length > 0;
        if (finalOnlyStep) {
          const stillPendingNataliaChat = pendingNataliaChat();
          if (stillPendingNataliaChat) {
            correctMissingChatReply(stillPendingNataliaChat, stepOutput);
            continue;
          }
          finalResponse = stepOutput;
          if (calls.length)
            publishForSession(input.exec, {
              type: "diagnostic",
              level: "warning",
              message:
                "Provider emitted a chat tool call after tools were disabled; ignored the call and finalized with text",
            });
          break;
        }
        if (protocolViolation) {
          setPhase("waiting");
          protocolCorrections += 1;
          if (protocolCorrections > MAX_PROTOCOL_CORRECTIONS)
            throw new Error(
              "model repeatedly emitted malformed textual chat tool calls instead of the provider's native tool protocol",
            );
          messages.push({ role: "assistant", content: protocolViolation });
          messages.push({
            role: "system",
            content: nativeToolCallCorrection(protocolCorrections),
          });
          publishForSession(input.exec, {
            type: "diagnostic",
            level: "warning",
            message: `Correcting textual chat tool call; native tool calling required (attempt ${protocolCorrections})`,
          });
          continue;
        }
        if (!calls.length) {
          const stillPendingNataliaChat = pendingNataliaChat();
          if (stillPendingNataliaChat) {
            correctMissingChatReply(stillPendingNataliaChat, stepOutput);
            continue;
          }
          step += 1;
          finalResponse = stepOutput;
          break;
        }
        step += 1;
        messages.push({ role: "assistant", content: output, toolCalls: calls });
        for (const call of calls) {
          const tool = visibleTools.find(
            (candidate) => candidate.name === call.name,
          );
          if (!tool) {
            // Hand the model the error instead of failing the turn: like the main
            // agent, an unavailable or badly-formed call comes back as a tool
            // result so the model can correct and retry on the next step.
            messages.push({
              role: "tool",
              toolCallID: call.id,
              toolName: call.name,
              content: `ERROR: live work chat does not expose tool "${call.name}"`,
            });
            continue;
          }
          let parsed: unknown;
          let paramErrors: Array<{ path: string; message: string }> = [];
          try {
            parsed = parseToolArguments(call.arguments);
            paramErrors = validateToolParameters(tool.parameters, parsed);
          } catch (cause) {
            paramErrors = [{ path: "arguments", message: String(cause) }];
          }
          if (paramErrors.length) {
            // The correct calling convention goes back to the model so it can
            // retry with valid arguments (P8: Chat is a full agent, not a
            // one-shot caller).
            messages.push({
              role: "tool",
              toolCallID: call.id,
              toolName: call.name,
              content: `ERROR: parameter validation failed for ${call.name}: ${paramErrors
                .map((error) => `${error.path}: ${error.message}`)
                .join("; ")}. Expected arguments: ${JSON.stringify(
                tool.parameters,
              )}`,
            });
            continue;
          }
          let result: string;
          setPhase("using_tool", tool.name);
          try {
            result = await tool.execute(parsed, {
              workspaceRoot,
              signal,
              sessionID: input.exec.session.id,
            });
          } catch (cause) {
            result = `ERROR: ${cause instanceof Error ? cause.message : String(cause)}`;
          }
          publishForSession(input.exec, {
            type: "chat.tool.used",
            id: `${input.responseMessageID}:tool:${chatSequence++}`,
            messageID: input.responseMessageID,
            toolName: tool.name,
            status: result.startsWith("ERROR:") ? "failed" : "succeeded",
            summary: chatToolSummary(
              tool.name,
              parsed as Record<string, unknown>,
              result,
            ),
            result,
            argumentsRaw: call.arguments,
            at: new Date().toISOString(),
          });
          setPhase("waiting");
          messages.push({
            role: "tool",
            content: result,
            toolCallID: call.id,
            toolName: call.name,
          });
        }
      }
      const unresolvedNataliaChat = pendingNataliaChat();
      if (unresolvedNataliaChat)
        throw new Error(
          `chat turn reached its step limit without replying to required chat message ${unresolvedNataliaChat.id}`,
        );
      if ((usedTools || ranFinalOnlyStep) && !finalResponse.trim()) {
        output += MISSING_FINAL_RESPONSE_FALLBACK;
        setPhase("generating");
        publishForSession(input.exec, {
          type: "chat.message.delta",
          id: `${input.responseMessageID}:delta:${chatSequence++}`,
          messageID: input.responseMessageID,
          text: MISSING_FINAL_RESPONSE_FALLBACK,
        });
        publishForSession(input.exec, {
          type: "diagnostic",
          level: "warning",
          message:
            "Provider omitted the required final chat response; emitted a deterministic fallback",
        });
      }
      publishForSession(input.exec, {
        type: "chat.message.added",
        id: `${input.responseMessageID}:chat`,
        messageID: input.responseMessageID,
        role: "chat",
        text: redactToolOutput(output.trim() || "(no reply)", true),
        at: new Date().toISOString(),
      });
      return { text: output };
    } finally {
    }
  }

  /**
   * Wakes Navi to answer Natalia's collaboration messages when she is not
   * mid-conversation with the user — the Live Work Chat's own round-robin:
   * an idle Chat answers her sister immediately instead of holding the
   * question until the user happens to chat again.
   */
  async function wakeNavi(exec: SessionExecutionState) {
    const controller = providerModelController;
    if (!exec.provider || !controller) return;
    const responseMessageID = `chat:${Date.now().toString(36)}:${chatSequence++}`;
    try {
      await controller.runChatTurn({
        sessionID: exec.session.id as SessionID,
        text: "",
        responseMessageID,
        internal: true,
      });
    } catch (cause) {
      publishForSession(exec, {
        type: "chat.message.added",
        id: `${responseMessageID}:chat`,
        messageID: responseMessageID,
        role: "chat",
        text: `(live work chat error: ${
          cause instanceof Error ? cause.message : String(cause)
        })`,
        at: new Date().toISOString(),
      });
    }
  }

  function ensureReady() {
    if (!ready) {
      const initialization = initialize().catch((error) => {
        const failure =
          error instanceof Error ? error : new Error(String(error));
        publish({
          type: "diagnostic",
          level: "error",
          message: failure.message,
        });
        throw failure;
      });
      ready = initialization;
      void ready.catch(() => undefined);
    }
    return ready;
  }

  return {
    async service<T>(name: string) {
      await ensureReady();
      return capabilityRegistry.service<T>(name);
    },
    start(onEvent, startOptions) {
      sink = onEvent;
      replayMode = startOptions?.replay ?? "all";
      // Idempotent: a second subscriber (e.g. the transport server attaching
      // its event sink after the TUI) must not re-run initialize. Re-running
      // it opened a second sqlite connection and a second workspace watcher,
      // which on Windows fails the sqlite open and leaks the first watcher,
      // keeping the process alive after dispose.
      void ensureReady();
    },
    async submit(text) {
      return await submitInput({ text });
    },
    submitInput,
    async history(options = {}) {
      await ready;
      return await sessionStoreController.history(
        sessionID,
        session?.events ?? [],
        options,
      );
    },
    async messages(options = {}) {
      await ready;
      if (!session) throw new Error("session initialization did not complete");
      return await sessionStoreController.messages(sessionID, session, options);
    },
    async pendingInteractive() {
      await ready;
      return projectInteractiveRequests(session?.events ?? []);
    },
    async confirmedWorkspaceChanges() {
      await ready;
      if (!session) return [];
      return reconcileWorkspaceObservation(activeExec);
    },
    sessionAttach: attachSession,
    async dispose() {
      runtimeDisposed = true;
      await Promise.all(
        [...ctx.state.titleGenerationTasks.keys()].map(cancelTitleGeneration),
      );
      terminalCommandBuffer.clearAll();
      for (const exec of executionBySession.values()) {
        exec.activeAbort?.abort(new Error("runtime disposed"));
        exec.paused = false;
        for (const resolveWaiter of exec.pauseWaiters) resolveWaiter();
        exec.pauseWaiters = [];
      }
      await Promise.all(
        [...executionBySession.keys()].map((id) =>
          sessionRunCoordinator(id).interrupt(),
        ),
      );
      await pluginsController.unloadBuiltin(PROVIDER_MODEL_PLUGIN_ID);
      providerModelController = undefined;
      await Promise.allSettled([...internalWakeTasks]);
      // A committed selection and other durable controls must reach disk before
      // a caller opens the same session in a replacement runtime.
      await sessionPersistence;
      await Promise.all(
        [...executionBySession.keys()].map((id) =>
          sessionStoreController?.flush(id),
        ),
      );
      await pluginsController.close();
      await performanceTrace.stop();
    },
    cancel(reason = "user cancel") {
      const cancelledSessionID = sessionID;
      const coordinator = sessionRunCoordinator(cancelledSessionID);
      const cancelledExec = activeExec;
      const runningTurnID = cancelledExec?.activeTurnID;
      const pendingTurnID = runningTurnID
        ? undefined
        : cancelledExec?.lastSubmitted?.id;
      const pendingSessionID = pendingTurnID
        ? (turnSession.get(pendingTurnID) ?? cancelledSessionID)
        : undefined;
      const pendingSession = pendingTurnID
        ? (executionBySession.get(pendingSessionID!)?.session ?? session)
        : undefined;
      const pendingInput = pendingSession?.inbox?.find(
        (input) => input.id === pendingTurnID && !input.promotedAt,
      );
      if (pendingInput && pendingSession) {
        pendingSession.inbox = pendingSession.inbox?.filter(
          (input) => input.id !== pendingTurnID,
        );
        if (cancelledExec && cancelledExec.lastSubmitted?.id === pendingTurnID)
          cancelledExec.lastSubmitted = undefined;
      }
      if (cancelledExec) cancelledExec.paused = false;
      paused = false;
      const waiters = cancelledExec?.pauseWaiters ?? pauseWaiters;
      if (cancelledExec) cancelledExec.pauseWaiters = [];
      else pauseWaiters = [];
      for (const resolveWaiter of waiters) resolveWaiter();
      cancelledExec?.activeAbort?.abort(reason);
      const cancelledTurnID =
        runningTurnID ??
        pendingInput?.id ??
        (coordinator.active ? cancelledExec?.lastSubmitted?.id : undefined);
      if (cancelledTurnID)
        publish({
          type: "turn.cancelled",
          id: cancelledTurnID,
          reason,
        });
      void (async () => {
        if (pendingInput)
          await turnController.persistPromotion(pendingSessionID!);
        await coordinator.interrupt();
        // `interrupt` intentionally clears stale wakeups. A prompt admitted with
        // queue delivery is durable work, not a stale wakeup, so start a fresh
        // drain after cancellation to promote it at the new idle boundary.
        await coordinator.wake(
          drainSessionFor(pendingSessionID ?? cancelledSessionID),
        );
      })().catch((error) =>
        publishForSession(cancelledExec, {
          type: "diagnostic",
          level: "warning",
          message: `session cancellation cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        }),
      );
    },
    pause(reason = "user pause") {
      // Refusing is a value: a caller that gets `paused: true` when nothing was
      // paused has been told the turn is held when it is not.
      const exec = activeExec;
      if (!exec?.lastSubmitted)
        return { paused: false, reason: "no turn has been submitted" };
      if (exec.paused) return { paused: true, reason: "already paused" };
      exec.paused = true;
      paused = true;
      publish({ type: "turn.paused", id: exec.lastSubmitted.id, reason });
      publish({ type: "status.update", status: "paused", detail: reason });
      return { paused: true };
    },
    resume() {
      const exec = activeExec;
      if (!exec?.lastSubmitted)
        return { resumed: false, reason: "no turn has been submitted" };
      if (!exec.paused)
        return { resumed: false, reason: "the turn is not paused" };
      exec.paused = false;
      paused = false;
      const waiters = exec.pauseWaiters;
      exec.pauseWaiters = [];
      for (const resolveWaiter of waiters) resolveWaiter();
      publish({ type: "turn.resumed", id: exec.lastSubmitted.id });
      publish({ type: "status.update", status: "running", detail: "resumed" });
      return { resumed: true };
    },
    selectAgent(name) {
      const agent = agentRegistry?.select(name);
      if (name && !agent) {
        publish({
          type: "diagnostic",
          level: "error",
          message: `agent not found: ${name}`,
        });
        // A diagnostic is not an answer to the caller: a remote UI used to be
        // told the agent was selected and then render the wrong one.
        return { outcome: "rejected", reason: `agent not found: ${name}` };
      }
      if (activeExec?.activeAbort) {
        pendingAgent = agent;
        if (activeExec) activeExec.pendingAgent = agent;
        publish({ type: "agent.selection", name: agent?.name, pending: true });
        // Deferred, not applied: switching agents mid-turn would change the rules
        // the turn started under.
        return {
          outcome: "pending",
          selected: agent?.name,
          reason: "a turn is running; the selection applies when it ends",
        };
      }
      selectedAgent = agent;
      if (activeExec) activeExec.selectedAgent = agent;
      applyAgentPolicy();
      applyAgentProvider();
      publish({ type: "agent.selection", name: agent?.name, pending: false });
      return { outcome: "applied", selected: agent?.name };
    },
    async agents() {
      await ready;
      return (agentRegistry?.list() ?? []).map((agent) => ({
        name: agent.name,
        description: agent.description,
        mode: agent.mode,
        hidden: agent.hidden,
        color: agent.color,
        model: agent.model,
        variant: agent.variant,
        maxSteps: agent.maxSteps,
        allowedTools: agent.allowedTools,
        excludedTools: agent.excludedTools,
        mcpServers: agent.mcpServers,
        permissions: agent.permissions,
      }));
    },
    async mcpCatalog() {
      return (await mcpService?.catalog()) ?? { prompts: [], resources: [] };
    },
    async getMcpPrompt(server, name, arguments_) {
      if (!mcpService)
        throw new Error(`MCP server is not connected: ${server}`);
      return await mcpService.getPrompt(server, name, arguments_);
    },
    async readMcpResource(server, uri) {
      if (!mcpService)
        throw new Error(`MCP server is not connected: ${server}`);
      return await mcpService.readResource(server, uri);
    },
    async plugins() {
      await ready;
      return pluginsController.list().map((plugin) => ({
        id: plugin.id,
        version: plugin.version,
        name: plugin.name,
        description: plugin.description,
        capabilities: manifestIntegrationPoints(plugin),
      }));
    },
    async commandCatalog() {
      // The catalog reads the plugin registry and capability contributions,
      // which only exist after initialize; on a cold start the request could
      // otherwise race ahead of it.
      await ready;
      return commandCatalogEntries().map((command) => ({
        name: command.name,
        title: command.title,
        category: command.category,
      }));
    },
    async taskOverview() {
      await ensureReady();
      return requireTaskWorkflow().taskOverview();
    },
    async flowOverview() {
      await ensureReady();
      return requireTaskWorkflow().flowOverview();
    },
    async documentCatalog() {
      await ensureReady();
      return requireTaskWorkflow().documentCatalog();
    },
    async saveFlowDocument(input) {
      await ensureReady();
      return requireTaskWorkflow().saveFlowDocument(input);
    },
    async taskPermissionPreview(input) {
      await ensureReady();
      return requireTaskWorkflow().taskPermissionPreview(input);
    },
    async deleteFlowDocument(input) {
      await ensureReady();
      return requireTaskWorkflow().deleteFlowDocument(input);
    },
    async saveTaskDocument(input) {
      await ensureReady();
      return requireTaskWorkflow().saveTaskDocument(input);
    },
    async deleteTaskDocument(input) {
      await ensureReady();
      return requireTaskWorkflow().deleteTaskDocument(input);
    },
    async taskSchedule(input) {
      await ensureReady();
      return requireTaskWorkflow().taskSchedule(input);
    },
    async taskUnschedule(input) {
      await ensureReady();
      return requireTaskWorkflow().taskUnschedule(input);
    },
    async modelCatalog() {
      return await clientModelCatalog();
    },
    async modelSelection() {
      await ready;
      return {
        modelID: selectedModelRefKey(),
        variant: selectedAgent?.variant ?? selectedModel?.variant,
      };
    },
    async selectModel(modelID, variant) {
      await selectRuntimeModel(modelID, variant);
    },
    async reasoningEffort() {
      await ready;
      return activeExec?.reasoningEffort;
    },
    async setReasoningEffort(effort) {
      await ready;
      if (effort && !isRuntimeReasoningEffort(effort))
        throw new Error(`unsupported reasoning effort: ${effort}`);
      if (!activeExec) throw new Error("session execution is unavailable");
      activeExec.reasoningEffort = effort;
      applyAgentProvider();
    },
    async skills() {
      await ready;
      return skillsList().map((skill) => ({
        name: skill.name,
        qualifiedName: skill.qualifiedName,
        description: skill.description,
        source: skill.source,
        requireApproval: skill.requireApproval,
        sandboxRequired: skill.sandboxRequired,
      }));
    },
    async workspaceFiles(input) {
      await ready;
      return await findWorkspaceFiles({ workspaceRoot, ...input });
    },
    async workspaceSearch(input) {
      await ready;
      return await searchWorkspaceFiles({ workspaceRoot, ...input });
    },
    async workspaceList(input) {
      await ready;
      return await listWorkspaceFiles({ workspaceRoot, ...input });
    },
    async workspaceRead(input) {
      await ready;
      return await readWorkspaceFile({ workspaceRoot, ...input });
    },
    async workspaceGlob(input) {
      await ready;
      return await globWorkspaceFiles({ workspaceRoot, ...input });
    },
    async nativeTerminalList() {
      await ready;
      return (await terminalController?.list()) ?? [];
    },
    async nativeTerminalRead(id) {
      await ready;
      if (!terminalController)
        throw new Error("Native Terminal Host is unavailable");
      const { text } = await terminalController.read(id, { maxLines: 200 });
      return { id, text };
    },
    async nativeTerminalOpenHub() {
      await ready;
      if (!terminalController)
        throw new Error("Native Terminal Host is unavailable");
      return await terminalController.openHub();
    },
    async nativeTerminalRevokeApprovalScope(id) {
      await ready;
      if (!terminalController)
        throw new Error("Native Terminal Host is unavailable");
      return interactive.revokeTerminalApprovalScope(id);
    },
    async nativeTerminalReleaseHumanControl(id) {
      await ready;
      if (!terminalController)
        throw new Error("Native Terminal Host is unavailable");
      const sessionView = terminalController.releaseHumanControl(id);
      // TERM-M.3 (c): the remote release path triggers the same continuation
      // as the local timeline-detach path.
      void maybeContinueAfterHumanInput(id);
      return sessionView;
    },
    async nativeTerminalBeginSecureInput(id) {
      await ready;
      if (!terminalController)
        throw new Error("Native Terminal Host is unavailable");
      return terminalController.beginSecureInput(id);
    },
    async nativeTerminalEndSecureInput(id) {
      await ready;
      if (!terminalController)
        throw new Error("Native Terminal Host is unavailable");
      return terminalController.endSecureInput(id);
    },
    async nativeTerminalStop(id) {
      await ready;
      if (!terminalController)
        throw new Error("Native Terminal Host is unavailable");
      return {
        ...(await terminalController.stop(id, "human")),
        status: "exited",
      };
    },
    // --- P0-H: the terminal write surface, host-gated at the transport ---
    // Remote callers are treated as model-side actors: ownership, secure-input
    // and geometry arbitration are the same ones the model tools go through.
    async nativeTerminalStart(input) {
      await ready;
      const owner = activeExec;
      if (!owner) throw new RuntimeRefusal("session is not initialized");
      if (!terminalController)
        throw new RuntimeRefusal("Native Terminal Host is unavailable");
      try {
        return await terminalController.start({
          command: input.command,
          cwd: input.cwd ?? workspaceRoot,
          id: input.id,
          sessionID: owner.session.id,
        });
      } catch (error) {
        throw refusalFromRegistry(error);
      }
    },
    async nativeTerminalWrite(input) {
      await ready;
      if (!terminalController)
        throw new RuntimeRefusal("Native Terminal Host is unavailable");
      try {
        const result = await terminalController.write(input.id, input.input, {
          idempotencyKey: input.idempotencyKey,
        });
        return { id: input.id, ...result };
      } catch (error) {
        throw refusalFromRegistry(error);
      }
    },
    async nativeTerminalResize(input) {
      await ready;
      if (!terminalController)
        throw new RuntimeRefusal("Native Terminal Host is unavailable");
      try {
        return await terminalController.resize(
          input.id,
          input.rows,
          input.cols,
          "model",
        );
      } catch (error) {
        throw refusalFromRegistry(error);
      }
    },
    async checkpointList() {
      await ready;
      const owner = activeExec;
      if (!owner) throw new Error("session is not initialized");
      const controller = await initializeCheckpointController(owner);
      if (!controller)
        throw new Error(
          "checkpoint controller unavailable (natalia-checkpoint)",
        );
      return (await controller.get().list()).map((record) => ({
        id: record.id,
        sequence: record.sequence,
        turnID: record.turnID,
        stepID: record.stepID,
        step: record.step,
        reason: record.reason,
        createdAt: record.createdAt,
        complete: record.complete,
        errors: record.errors,
        files: Object.keys(record.manifest.entries).length,
        changes: record.changes.length,
        tokenEstimate: record.context.tokenEstimate,
        diskUsageBytes: record.diskUsageBytes,
      }));
    },
    async checkpointPreview(id) {
      await ready;
      const owner = activeExec;
      if (!owner) throw new Error("session is not initialized");
      const controller = await initializeCheckpointController(owner);
      if (!controller)
        throw new Error(
          "checkpoint controller unavailable (natalia-checkpoint)",
        );
      return await controller
        .get()
        .previewRollback(id, owner.context, controller.resources(), true);
    },
    async checkpointRollback(input) {
      await ready;
      const owner = activeExec;
      if (!owner) throw new Error("session is not initialized");
      const controller = await initializeCheckpointController(owner);
      if (!controller)
        throw new Error(
          "checkpoint controller unavailable (natalia-checkpoint)",
        );
      const preview = await controller.get().rollbackTo(input.id, {
        context: owner.context,
        dryRun: input.dryRun,
        ...controller.rollbackOptions(),
      });
      publishForSession(
        owner,
        await statusController.snapshotFor({
          provider: owner.provider,
          context: owner.context,
          permissionMode: owner.permissionMode,
        }),
      );
      return preview;
    },
    async sandboxList() {
      await ready;
      const sandboxes = requireSandboxes();
      return (await sandboxes.list()).map((sandbox) => ({
        id: sandbox.id,
        root: sandbox.root,
        isolationLevel: sandbox.isolationLevel,
        changedFiles: sandbox.changedFiles.length,
        runningResources: sandbox.runningResources.length,
        envAllowlist: sandbox.envAllowlist,
      }));
    },
    async sandboxDiff(id) {
      await ready;
      const sandboxes = requireSandboxes();
      return await sandboxes.previewMerge(id);
    },
    async sandboxResources(id) {
      await ready;
      const sandboxes = requireSandboxes();
      return sandboxes.resourcesFor(id);
    },
    async sandboxResourceOutput(input) {
      await ready;
      const sandboxes = requireSandboxes();
      return await sandboxes.resourceOutput(
        input.id,
        input.resourceID,
        input.maxBytes,
      );
    },
    async sandboxMerge(id) {
      await ready;
      const owner = activeExec;
      if (!owner) throw new Error("session is not initialized");
      const sandboxes = requireSandboxes();
      await authorizeSandboxManagement("sandbox_merge", { id }, owner);
      const changes = await sandboxes.merge(
        id,
        workspaceRoot,
        async (paths) => await authorizeSandboxMerge({ id, paths }, owner),
      );
      const operationID = `sandbox_merge:${id}:${randomUUID()}`;
      // WG4 Phase 3: sandbox merge keeps its own operation provenance (not a
      // tool call), but registers an expected mutation so the auditor can
      // attribute merged paths to the merge operation.
      mutationRegistry?.register({
        sessionID: owner.session.id,
        episodeID: options.episodeID,
        operationID,
        toolName: "sandbox_merge",
        authorizedPaths: ["."],
        expectedOperations: ["added", "modified", "deleted"],
      });
      for (const change of changes) {
        publishForSession(
          owner,
          workLedgerController.workspaceChangeNode({
            operationID,
            path: change.path,
            toolName: "sandbox_merge",
            sessionID: owner.session.id,
          }),
        );
      }
      mutationRegistry?.settle(operationID);
      publishForSession(owner, sandboxes.updateEvent(id));
      publishForSession(owner, sandboxes.auditEvent(id, "merge"));
      return changes;
    },
    async sandboxDelete(id) {
      await ready;
      const owner = activeExec;
      if (!owner) throw new Error("session is not initialized");
      const sandboxes = requireSandboxes();
      await authorizeSandboxManagement("sandbox_delete", { id }, owner);
      const result = await sandboxes.delete(id);
      publishForSession(owner, {
        type: "sandbox.update",
        id,
        status: "deleted",
        root: "",
        isolationLevel: "workspace",
        changedFiles: result.pendingChanges.length,
        runningResources: result.runningResources.length,
        target: { kind: "host", cwd: workspaceRoot },
        resourcePolicy: "sandbox deleted after resource cleanup",
      });
      return result;
    },
    async sandboxResourceStop(input) {
      await ready;
      const owner = activeExec;
      if (!owner) throw new Error("session is not initialized");
      const sandboxes = requireSandboxes();
      await authorizeSandboxManagement("sandbox_resource_stop", input, owner);
      const resource = await sandboxes.stopResource(input.id, input.resourceID);
      publishForSession(owner, sandboxes.updateEvent(input.id));
      publishForSession(owner, sandboxes.auditEvent(input.id, "resource_stop"));
      return resource;
    },
    async sessionList() {
      await ready;
      return await sessionStoreController?.list();
    },
    async sessionTouch(id) {
      await ready;
      await sessionStoreController?.touch(id);
    },
    async sessionRename(id, title) {
      await ready;
      const updated = await sessionStoreController?.rename(id, title);
      const exec = executionBySession.get(id as SessionID);
      if (exec) {
        exec.session.title = updated.title;
        exec.session.metadata = {
          ...exec.session.metadata,
          titleSource: "manual",
        };
      }
      publishForSession(exec, {
        type: "session.title.updated",
        sessionID: id as SessionID,
        title: updated.title,
      });
      return updated;
    },
    async sessionPin(id, pinned) {
      await ready;
      return await sessionStoreController?.pin(id, pinned);
    },
    async sessionDuplicate(id, title) {
      await ready;
      return await sessionStoreController?.duplicate(id, title);
    },
    async sessionFork(id, turnID, title) {
      await ready;
      return await sessionStoreController?.fork(id, turnID, title);
    },
    async sessionDelete(id) {
      await ready;
      await cancelTitleGeneration(id as SessionID);
      return await sessionStoreController?.delete(id);
    },
    async sessionNew(input = {}) {
      await ready;
      return await sessionStoreController?.create(input);
    },
    async sessionArchive(id) {
      await ready;
      return await sessionStoreController?.archive(id);
    },
    async sessionExport(id) {
      await ready;
      return await sessionStoreController?.export(id);
    },
    async permissionList() {
      await ready;
      const config = tsRuntimeConfig;
      if (!config) return { default: "ask", profiles: [] };
      return {
        default: config.defaultPermission,
        profiles: Object.entries(config.permissionProfiles).map(
          ([name, profile]) => ({ name, ...profile }),
        ),
      };
    },
    async permissionSave(input) {
      await ready;
      await updateConfigAtScope(
        workspaceRoot,
        {
          permissionProfiles: { [input.name]: input.profile },
        } as never,
        "project",
        { globalPath: options.globalConfigPath },
      );
      const result = await applyConfigFromDisk();
      return {
        saved: true,
        applied: result.applied,
        reason: result.reason,
      };
    },
    async permissionDelete(name) {
      await ready;
      const config = tsRuntimeConfig;
      if (config && config.defaultPermission === name)
        return {
          deleted: false,
          reason: `permission profile is the active default: ${name}`,
        };
      await updateConfigAtScope(
        workspaceRoot,
        {
          permissionProfiles: { [name]: undefined },
        } as never,
        "project",
        { globalPath: options.globalConfigPath },
      );
      await applyConfigFromDisk();
      return { deleted: true };
    },
    async mcpServerAdd(input) {
      await ready;
      await updateConfigAtScope(
        workspaceRoot,
        {
          mcpServers: { [input.name]: input.config },
        } as never,
        "project",
        { globalPath: options.globalConfigPath },
      );
      await applyConfigFromDisk();
      return { saved: true };
    },
    async mcpServerRemove(name) {
      await ready;
      await updateConfigAtScope(
        workspaceRoot,
        {
          mcpServers: { [name]: undefined },
        } as never,
        "project",
        { globalPath: options.globalConfigPath },
      );
      await applyConfigFromDisk();
      return { removed: true };
    },
    async agentCreate(input) {
      await ready;
      const config = tsRuntimeConfig;
      if (config && config.agents[input.name])
        return {
          created: false,
          reason: `agent already exists: ${input.name}`,
        };
      await updateConfigAtScope(
        workspaceRoot,
        {
          agents: { [input.name]: input.config },
        } as never,
        "project",
        { globalPath: options.globalConfigPath },
      );
      await applyConfigFromDisk();
      return { created: true };
    },
    async agentUpdate(input) {
      await ready;
      if (!tsRuntimeConfig || !tsRuntimeConfig.agents[input.name])
        throw new Error(`agent not found: ${input.name}`);
      await updateConfigAtScope(
        workspaceRoot,
        {
          agents: { [input.name]: input.config },
        } as never,
        "project",
        { globalPath: options.globalConfigPath },
      );
      await applyConfigFromDisk();
      return { updated: true };
    },
    async agentDelete(name) {
      await ready;
      const config = tsRuntimeConfig;
      if (config && config.defaultAgent === name)
        return {
          deleted: false,
          reason: `agent is the default agent: ${name}`,
        };
      await updateConfigAtScope(
        workspaceRoot,
        {
          agents: { [name]: undefined },
        } as never,
        "project",
        { globalPath: options.globalConfigPath },
      );
      await applyConfigFromDisk();
      return { deleted: true };
    },
    async providerDiscover(input) {
      await ready;
      const models = await discoverProviderModels(
        input.type,
        input.baseURL,
        input.apiKey,
      );
      return { models };
    },
    async providerAdd(input) {
      await ready;
      await updateConfigAtScope(
        workspaceRoot,
        {
          providers: {
            [input.name]: {
              name: input.name,
              driver: input.type,
              enabled: true,
              connection: {
                baseURL: input.baseURL || undefined,
                apiKey: input.apiKey,
              },
            },
          },
        } as never,
        "global",
        { globalPath: options.globalConfigPath },
      );
      await applyConfigFromDisk();
      return { saved: true };
    },
    async providerRemove(name) {
      await ready;
      const config = tsRuntimeConfig;
      const referencedModel = config
        ? (Object.keys(config.catalog?.providers?.[name]?.models ?? {})[0] ??
          Object.keys(config.modelOverrides ?? {})
            .filter((key) => key.startsWith(`${name}/`))
            .map((key) => key.slice(name.length + 1))[0])
        : undefined;
      if (referencedModel)
        return {
          removed: false,
          reason: `provider is referenced by model: ${referencedModel}`,
        };
      await updateConfigAtScope(
        workspaceRoot,
        {
          providers: { [name]: undefined },
        } as never,
        "global",
        { globalPath: options.globalConfigPath },
      );
      await applyConfigFromDisk();
      return { removed: true };
    },
    async pluginUnload(id) {
      await ready;
      const before = new Set(tools.keys());
      const result = await pluginsController.unload(id);
      // The plugin's tool disposers removed its tools from the registry; publish
      // tool.unregistered for the ones that disappeared so the projected tool
      // catalog stops reporting them (P5 dynamic unload).
      for (const name of before) {
        if (tools.has(name)) continue;
        publish({
          type: "tool.unregistered",
          id: `tool:${name}`,
          name,
        });
      }
      return result;
    },
    async pluginReload(id) {
      await ready;
      return await pluginsController.reload(id);
    },
    async toolFamilyReload(id) {
      await ready;
      return await hotReloadToolFamily(id);
    },
    async runtimeStatus() {
      await ensureReady();
      return await runtimeStatusSnapshot();
    },
    async canReloadConfig() {
      await ready;
      const blocked = configReloadBlockedReason();
      return blocked ? { allowed: false, reason: blocked } : { allowed: true };
    },
    async reloadConfig() {
      await ready;
      // Re-checked here rather than trusting `canReloadConfig`: a turn can start
      // between the two calls, and applying new policy underneath a running turn
      // would change the rules it started under.
      return await applyConfigFromDisk();
    },
    async updateConfig(input) {
      await ready;
      // The TUI settings menu path, now a public surface: merge the patch onto
      // disk, then apply. The file is written either way; whether it takes
      // effect under a running turn is an ordinary answer, not an exception.
      // Idempotent by patch: the same patch merged twice produces the same
      // merged config.
      await updateConfigAtScope(
        workspaceRoot,
        input.patch as never,
        input.scope ?? "project",
        { globalPath: options.globalConfigPath },
      );
      // Applying is the same operation as a reload, with the same value-type
      // refusal; share it so the two paths cannot drift.
      return await applyConfigFromDisk();
    },
    async settingsGet() {
      await ready;
      const resolved = await resolveTuiConfig(workspaceRoot);
      return {
        config: resolved.config as unknown as Record<string, unknown>,
        sources: resolved.sources,
      };
    },
    async settingsSet(patch, scope) {
      await ready;
      // The interface-preference file, served publicly now that the TUI no
      // longer owns it privately. Validated by the shared schema (an invalid
      // patch is an argument error, not a partial write), written atomically,
      // then announced so subscribers can re-read.
      await saveTuiConfig(workspaceRoot, patch, scope);
      publish({ type: "settings.updated", scope });
      return { applied: true };
    },
    async diagnostics(limit = 100) {
      await ready;
      const entries = activeExec
        ? [
            ...runtimeDiagnostics,
            ...(runtimeDiagnosticsBySession.get(activeExec.session.id) ?? []),
          ]
        : runtimeDiagnostics;
      return entries.slice(-Math.min(500, Math.max(1, limit)));
    },
    snapshot() {
      const event: RuntimeEvent = {
        type: "snapshot.created",
        id: `snap_${Date.now().toString(36)}`,
        files: [],
      };
      publish(event);
      return event;
    },
    diagnostic(message, level = "warning") {
      publish({ type: "diagnostic", level, message });
    },
    lastSubmission() {
      return activeExec?.lastSubmitted;
    },
    async constitutionRules() {
      if (!session) return [];
      return projectedConstitutionRules(session.events).map((r) => ({
        ruleID: r.ruleID,
        statement: r.statement,
        scope: r.scope,
        priority: r.priority,
        source: r.source,
        enforcement: r.enforcement,
        overridePolicy: r.overridePolicy,
      }));
    },
    async decisionRecords() {
      if (!session) return [];
      return projectedDecisionRecords(session.events).map((r) => ({
        decision: r.decision,
        rationale: r.rationale ?? [],
        alternatives: r.alternatives ?? [],
        consequences: r.consequences ?? [],
        status: r.status,
        linkedPlans: r.linkedPlans ?? [],
        linkedConstraints: r.linkedConstraints ?? [],
      }));
    },
    /**
     * The `decision.recorded` production writer. Decisions are durable facts —
     * a decision text and rationale may reach the journal — so this is the
     * surface the Chat/override loop (CST3) records through. The event
     * constructor in `constitution-ledger.ts` keeps the secret-safe boundary:
     * decision text and rationale are prose, never tool output or file content.
     */
    async recordDecision(input: {
      decision: string;
      rationale?: string[];
      alternatives?: { option: string; rejectedReason?: string }[];
      consequences?: string[];
      linkedPlans?: string[];
      linkedConstraints?: string[];
    }) {
      if (!session) return { recorded: false as const };
      const event = governanceLedgerController.recordDecision({
        id: `decision:${Date.now().toString(36)}:${decisionSequence++}`,
        ...input,
      });
      publishForSession(activeExec, event);
      // CST4 Work Graph linkage: the decision is a `decision` node in the graph.
      publishForSession(
        activeExec,
        workLedgerController.decisionNode({
          decisionID: event.id,
          decision: event.decision,
          sessionID,
        }),
      );
      return { recorded: true as const };
    },
    async evidenceRecords() {
      if (!session) return [];
      // P2 E3: the effective status of each evidence record is driven by the
      // lifecycle of the plan whose task it belongs to (a projection policy —
      // the journal keeps the recorded status; the query answers what it means
      // now).
      const plans = projectedPlans(session.events);
      const planStateForTask = new Map<string, string>();
      for (const plan of plans) {
        if (plan.taskID) planStateForTask.set(plan.taskID, plan.status);
      }
      return projectedEvidenceRecords(session.events).map((r) => ({
        taskID: r.taskID,
        objective: r.objective,
        status: r.status,
        effectiveStatus:
          r.taskID && planStateForTask.has(r.taskID)
            ? governanceLedgerController.evidenceStatusForPlanState(
                planStateForTask.get(r.taskID)! as PlanLifecycleState,
                r.status,
              )
            : r.status,
        changes: r.changes ?? [],
        validations: r.validations ?? [],
        knownGaps: r.knownGaps ?? [],
      }));
    },
    async completions() {
      if (!session) return [];
      return projectedCompletions(session.events).map((c) => ({
        completionID: c.id,
        taskID: c.taskID,
        objective: c.objective,
        changeSummary: c.changeSummary,
        ...(c.behaviorImpact ? { behaviorImpact: c.behaviorImpact } : {}),
        validations: c.validations,
        ...(c.humanValidation ? { humanValidation: c.humanValidation } : {}),
        knownGaps: c.knownGaps ?? [],
        externalSideEffects: c.externalSideEffects ?? [],
        ...(c.rollbackState ? { rollbackState: c.rollbackState } : {}),
        evidenceIDs: c.evidenceIDs ?? [],
        recordedAt: c.recordedAt,
      }));
    },
    /**
     * The `evidence.recorded` production writer (E2 起步): runs a validation
     * command against the workspace, redacts secrets and truncates the summary,
     * then records the outcome as a durable evidence fact. This is the
     * validation-runner adapter — the command runs with the workspace as cwd,
     * bounded output and a timeout, and only the command, outcome, bounded safe
     * summary and duration reach the journal. Raw output never does.
     */
    async recordValidation(input: {
      taskID: string;
      objective: string;
      command: string;
      timeoutSec?: number;
      knownGaps?: string[];
    }) {
      const owner = activeExec;
      if (!owner) return { recorded: false as const };
      if (
        typeof input.taskID !== "string" ||
        input.taskID.trim().length === 0 ||
        typeof input.objective !== "string" ||
        input.objective.trim().length === 0 ||
        typeof input.command !== "string" ||
        input.command.trim().length === 0
      )
        return { recorded: false as const };
      const startedAt = performance.now();
      let result: "passed" | "failed" | "skipped" = "failed";
      let safeSummary = "validation command did not run";
      try {
        const run = await runValidationCommand(
          input.command,
          workspaceRoot,
          input.timeoutSec ?? 120,
        );
        result = run.exitCode === 0 ? "passed" : "failed";
        safeSummary = run.safeSummary;
      } catch (error) {
        safeSummary = `validation runner failed: ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
      const outcome = governanceLedgerController.boundValidationOutcome({
        command: redactToolOutput(input.command, true),
        result,
        safeSummary,
        durationMs: performance.now() - startedAt,
      });
      const event = governanceLedgerController.buildEvidenceRecorded({
        id: `evidence:${Date.now().toString(36)}:${evidenceSequence++}`,
        taskID: input.taskID,
        objective: input.objective,
        status: result === "passed" ? "validated" : "failed",
        validations: [outcome],
        knownGaps: input.knownGaps,
      });
      publishForSession(owner, event);
      return {
        recorded: true as const,
        result,
        safeSummary: outcome.safeSummary,
      };
    },
    /**
     * Record a completion card (P2 E4): the fixed report structure (§5) that
     * answers "is it really done, what evidence is missing". The card is safe
     * prose — changeSummary is a summary, never a diff or file content — and a
     * `validated_by` Work Graph edge connects each completed change to the card.
     */
    async recordCompletion(input: {
      taskID: string;
      objective: string;
      changeSummary: string;
      behaviorImpact?: string;
      validations?: Array<{
        command: string;
        result: "passed" | "failed" | "skipped";
        safeSummary: string;
      }>;
      humanValidation?: string;
      knownGaps?: string[];
      externalSideEffects?: string[];
      rollbackState?: "clean" | "available" | "none" | "needs_promotion";
      evidenceIDs?: string[];
      changePaths?: string[];
    }) {
      if (!session) return { recorded: false as const };
      if (
        !input.taskID.trim() ||
        !input.objective.trim() ||
        !input.changeSummary.trim()
      )
        return { recorded: false as const };
      const recordedAt = new Date().toISOString();
      const completionID = `completion:${Date.now().toString(36)}:${completionSequence++}`;
      const event = governanceLedgerController.buildCompletionRecorded({
        id: completionID,
        taskID: input.taskID,
        objective: input.objective,
        changeSummary: redactToolOutput(input.changeSummary, true),
        ...(input.behaviorImpact
          ? { behaviorImpact: redactToolOutput(input.behaviorImpact, true) }
          : {}),
        validations: (input.validations ?? []).map((validation) =>
          governanceLedgerController.boundValidationOutcome({
            command: redactToolOutput(validation.command, true),
            result: validation.result,
            safeSummary: validation.safeSummary,
          }),
        ),
        ...(input.humanValidation
          ? { humanValidation: redactToolOutput(input.humanValidation, true) }
          : {}),
        knownGaps: input.knownGaps,
        externalSideEffects: input.externalSideEffects,
        rollbackState: input.rollbackState,
        evidenceIDs: input.evidenceIDs,
        recordedAt,
      });
      publishForSession(activeExec, event);
      // P2 E4 Work Graph integration: each completed change is validated by the
      // card through a `validated_by` edge.
      for (const path of input.changePaths ?? [])
        publishForSession(
          activeExec,
          workLedgerController.completionValidationEdge({
            changeID: event.taskID,
            path,
            completionID,
          }),
        );
      return { recorded: true as const, completionID };
    },
    async mailboxList() {
      if (!session) return [];
      return projectedMailboxMessages(session.events).map((m) => ({
        messageID: m.messageID,
        source: m.source,
        priority: m.priority,
        intent: m.intent,
        text: m.text,
        safeSummary: m.safeSummary,
        ...(m.relatedPlanID ? { relatedPlanID: m.relatedPlanID } : {}),
        deliveryPolicy: m.deliveryPolicy,
        createdAt: m.createdAt,
        status: m.status,
        ...(m.reason ? { reason: m.reason } : {}),
      }));
    },
    async mailboxSend(input: {
      source?: "user_via_live_chat" | "system";
      priority?: "normal" | "high" | "urgent";
      intent: string;
      text: string;
      safeSummary?: string;
      relatedPlanID?: string;
      deliveryPolicy?: string;
    }) {
      return enqueueMailboxMessage(input);
    },
    async mailboxDeliver(messageID: string) {
      if (!session || typeof messageID !== "string" || !messageID)
        return { delivered: false as const };
      const message = projectedMailboxMessages(session.events).find(
        (m) => m.messageID === messageID && m.status === "queued",
      );
      if (!message) return { delivered: false as const };
      publishForSession(
        activeExec,
        buildMailboxStatus({
          id: `${messageID}:delivered:${mailboxSequence++}`,
          messageID,
          status: "delivered",
          at: new Date().toISOString(),
        }),
      );
      return { delivered: true as const };
    },
    async mailboxAcknowledge(messageID: string) {
      if (!session || typeof messageID !== "string" || !messageID)
        return { acknowledged: false as const };
      const message = projectedMailboxMessages(session.events).find(
        (m) => m.messageID === messageID && m.status === "delivered",
      );
      if (!message) return { acknowledged: false as const };
      publishForSession(
        activeExec,
        buildMailboxStatus({
          id: `${messageID}:acknowledged:${mailboxSequence++}`,
          messageID,
          status: "acknowledged",
          at: new Date().toISOString(),
        }),
      );
      return { acknowledged: true as const };
    },
    async mailboxDefer(messageID: string, reason?: string) {
      if (!session || typeof messageID !== "string" || !messageID)
        return { deferred: false as const };
      const message = projectedMailboxMessages(session.events).find(
        (m) => m.messageID === messageID && m.status === "queued",
      );
      if (!message) return { deferred: false as const };
      publishForSession(
        activeExec,
        buildMailboxStatus({
          id: `${messageID}:deferred:${mailboxSequence++}`,
          messageID,
          status: "deferred",
          at: new Date().toISOString(),
          reason:
            redactToolOutput(reason ?? "", true).slice(0, 500) || undefined,
        }),
      );
      return { deferred: true as const };
    },
    async mailboxSupersede(messageID: string, reason?: string) {
      if (!session || typeof messageID !== "string" || !messageID)
        return { superseded: false as const };
      const message = projectedMailboxMessages(session.events).find(
        (m) => m.messageID === messageID && m.status === "queued",
      );
      if (!message) return { superseded: false as const };
      publishForSession(
        activeExec,
        buildMailboxStatus({
          id: `${messageID}:superseded:${mailboxSequence++}`,
          messageID,
          status: "superseded",
          at: new Date().toISOString(),
          reason:
            redactToolOutput(reason ?? "", true).slice(0, 500) || undefined,
        }),
      );
      return { superseded: true as const };
    },
    async planList() {
      if (!session) return [];
      return projectedPlans(session.events).map((plan) => ({
        planID: plan.planID,
        version: plan.version,
        title: plan.title,
        author: plan.author,
        objective: plan.objective,
        steps: plan.steps,
        constraints: plan.constraints,
        verification: plan.verification,
        riskNotes: plan.riskNotes,
        ...(plan.relatedMailboxMessageID
          ? { relatedMailboxMessageID: plan.relatedMailboxMessageID }
          : {}),
        ...(plan.supersedesPlanID
          ? { supersedesPlanID: plan.supersedesPlanID }
          : {}),
        createdAt: plan.createdAt,
        status: plan.status,
        ...(plan.reason ? { reason: plan.reason } : {}),
      }));
    },
    async chatMessages() {
      if (!session) return [];
      return projectedChatMessages(session.events).map((message) => ({
        messageID: message.messageID,
        role: message.role,
        text: message.text,
        at: message.at,
      }));
    },
    async chatRollback(input: { toMessageID: string }) {
      if (!session) return { rolledBackTo: input.toMessageID, removed: 0 };
      const history = projectedChatMessages(session.events);
      const index = history.findIndex(
        (message) => message.messageID === input.toMessageID,
      );
      if (index === -1) return { rolledBackTo: input.toMessageID, removed: 0 };
      const removed = history.length - (index + 1);
      publish({
        type: "chat.rollback",
        id: `chat:rollback:${Date.now().toString(36)}:${chatSequence++}`,
        toMessageID: input.toMessageID,
        removed,
        at: new Date().toISOString(),
      });
      return { rolledBackTo: input.toMessageID, removed };
    },
    async chatSubmit(input: { text: string }) {
      await ready;
      const text = typeof input.text === "string" ? input.text.trim() : "";
      const exec = activeExec;
      const controller = providerModelController;
      if (!text || !exec?.provider || !controller) return { messageID: "" };
      const now = new Date();
      const userMessageID = `chat:${Date.now().toString(36)}:${chatSequence++}`;
      publishForSession(exec, {
        type: "chat.message.added",
        id: `${userMessageID}:user`,
        messageID: userMessageID,
        role: "user",
        text: redactToolOutput(text, true),
        at: now.toISOString(),
      });
      const responseMessageID = `chat:${Date.now().toString(36)}:${chatSequence++}`;
      try {
        await controller.runChatTurn({
          sessionID: exec.session.id as SessionID,
          text,
          responseMessageID,
        });
      } catch (cause) {
        publishForSession(exec, {
          type: "chat.message.added",
          id: `${responseMessageID}:chat`,
          messageID: responseMessageID,
          role: "chat",
          text: `(live work chat error: ${
            cause instanceof Error ? cause.message : String(cause)
          })`,
          at: new Date().toISOString(),
        });
      }
      return { messageID: responseMessageID };
    },
    async planCreate(input: {
      title: string;
      author?: "user" | "live_chat" | "main_agent";
      objective: string;
      steps: Array<{
        id: string;
        title: string;
        detail?: string;
        verification?: string;
      }>;
      constraints?: string[];
      verification?: string[];
      riskNotes?: string[];
      relatedMailboxMessageID?: string;
      supersedesPlanID?: string;
      taskID?: string;
    }) {
      return createPlanDraft(input);
    },
    async planUpdate(input: {
      planID: string;
      objective?: string;
      steps?: Array<{
        id: string;
        title: string;
        detail?: string;
        verification?: string;
      }>;
      constraints?: string[];
      verification?: string[];
      riskNotes?: string[];
      reason?: string;
    }) {
      if (!session || typeof input.planID !== "string" || !input.planID)
        return { updated: false as const };
      const plan = projectedPlans(session.events).find(
        (p) => p.planID === input.planID && p.status === "draft",
      );
      if (!plan) return { updated: false as const };
      publishForSession(
        activeExec,
        workLedgerController.buildPlanTransition({
          id: `${input.planID}:draft:${plan.version + 1}`,
          planID: input.planID,
          version: plan.version + 1,
          transition: "draft_updated",
          at: new Date().toISOString(),
          reason: input.reason,
        }),
      );
      return { updated: true as const };
    },
    async planPropose(planID: string) {
      if (!session || typeof planID !== "string" || !planID)
        return { proposed: false as const };
      const plan = projectedPlans(session.events).find(
        (p) => p.planID === planID && p.status === "draft",
      );
      if (!plan) return { proposed: false as const };
      publishForSession(
        activeExec,
        workLedgerController.buildPlanTransition({
          id: `${planID}:proposed:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "proposed",
          at: new Date().toISOString(),
        }),
      );
      return { proposed: true as const };
    },
    async planAccept(planID: string) {
      const owner = activeExec;
      if (!owner || typeof planID !== "string" || !planID)
        return { accepted: false as const };
      const plan = projectedPlans(owner.session.events).find(
        (p) => p.planID === planID && p.status === "proposed",
      );
      if (!plan) return { accepted: false as const };
      // Acceptance is the user's decision (§6.2: "accepted = 用户接受计划内容").
      // It goes through the same approval request/response machinery as tools:
      // the runtime waits for a human approve before recording the acceptance,
      // so a proposed plan cannot be silently accepted by the caller. A reject
      // leaves the plan proposed.
      const approvalID = `${planID}:accept:${plan.version + 1}:${crypto.randomUUID().replace(/-/gu, "").slice(0, 8)}`;
      const response = await interactive.requirePlanAcceptance({
        approvalID,
        planID,
        title: "Accept plan",
        detail: `${plan.title}\n${plan.objective}`,
        sessionID: owner.session.id,
        permissionMode: owner.permissionMode,
        signal: owner.activeAbort?.signal,
      });
      if (!response || response.decision === "reject")
        return { accepted: false as const };
      publishForSession(
        owner,
        workLedgerController.buildPlanTransition({
          id: `${planID}:accepted:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "accepted",
          at: new Date().toISOString(),
        }),
      );
      return { accepted: true as const };
    },
    async planQueue(planID: string) {
      if (!session || typeof planID !== "string" || !planID)
        return { queued: false as const };
      const plan = projectedPlans(session.events).find(
        (p) => p.planID === planID && p.status === "accepted",
      );
      if (!plan) return { queued: false as const };
      publishForSession(
        activeExec,
        workLedgerController.buildPlanTransition({
          id: `${planID}:queued:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "queued",
          at: new Date().toISOString(),
        }),
      );
      return { queued: true as const };
    },
    async planActivate(planID: string) {
      if (!session || typeof planID !== "string" || !planID)
        return { activated: false as const };
      const plan = projectedPlans(session.events).find(
        (p) => p.planID === planID && p.status === "queued_next_plan",
      );
      if (!plan) return { activated: false as const };
      publishForSession(
        activeExec,
        workLedgerController.buildPlanTransition({
          id: `${planID}:activated:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "activated",
          at: new Date().toISOString(),
        }),
      );
      return { activated: true as const };
    },
    async planSupersede(planID: string, reason?: string) {
      if (!session || typeof planID !== "string" || !planID)
        return { superseded: false as const };
      const plan = projectedPlans(session.events).find(
        (p) =>
          p.planID === planID &&
          p.status !== "completed" &&
          p.status !== "archived",
      );
      if (!plan) return { superseded: false as const };
      publishForSession(
        activeExec,
        workLedgerController.buildPlanTransition({
          id: `${planID}:superseded:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "superseded",
          at: new Date().toISOString(),
          reason:
            redactToolOutput(reason ?? "", true).slice(0, 500) || undefined,
        }),
      );
      return { superseded: true as const };
    },
    async planCompleted(planID: string) {
      if (!session || typeof planID !== "string" || !planID)
        return { completed: false as const };
      const plan = projectedPlans(session.events).find(
        (candidate) =>
          candidate.planID === planID && candidate.status === "active",
      );
      if (!plan) return { completed: false as const };
      publishForSession(
        activeExec,
        workLedgerController.buildPlanTransition({
          id: `${planID}:completed:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "completed",
          at: new Date().toISOString(),
        }),
      );
      return { completed: true as const };
    },
    async sessionSnapshot() {
      if (!activeExec) return undefined;
      return currentSessionSnapshot(
        activeExec,
        `snapshot:live:${activeExec.session.id}`,
      );
    },
    async driftFindings() {
      if (!session) return [];
      return projectedDriftFindings(session.events).map((f) => ({
        findingID: f.findingID,
        severity: f.severity,
        confidence: f.confidence,
        originalObjective: f.originalObjective,
        currentActivity: f.currentActivity,
        evidence: f.evidence,
        status: f.status,
      }));
    },
    /**
     * Run the DriftEvaluator against safe signals and publish any findings it
     * opens. The evaluator is the only production writer of
     * `drift.finding_opened` (§56.9); it has no write power — a finding only
     * escalates to an approval/Chat/mailbox prompt, never a cancellation.
     * Already-open findings are not reopened.
     */
    async evaluateDrift(input: {
      objective: string;
      currentActivity: string;
      applicableConstraints?: string[];
      changes?: Array<{
        path?: string;
        action?: string;
        target?: string;
        summary?: string;
      }>;
      evidenceRefs?: string[];
    }) {
      if (!session) return { opened: 0 as const };
      if (!input.objective.trim() || !input.currentActivity.trim())
        return { opened: 0 as const };
      const findings = workLedgerController.evaluateDrift({
        sessionID,
        turnID: activeExec?.activeTurnID,
        objective: input.objective,
        currentActivity: input.currentActivity,
        applicableConstraints: input.applicableConstraints ?? [],
        changes: input.changes ?? [],
        evidenceRefs: input.evidenceRefs ?? [],
      });
      for (const finding of findings) publishForSession(activeExec, finding);
      return { opened: findings.length };
    },
    /**
     * Acknowledge a drift finding (P7 D3): the Main Agent explains it, the user
     * dismisses it, or the work corrects it. Only an open finding can transition.
     */
    async acknowledgeDriftFinding(input: {
      findingID: string;
      status: "explained" | "dismissed" | "corrected";
      rationale?: string;
    }) {
      if (!session) return { acknowledged: false as const };
      if (!input.findingID.trim()) return { acknowledged: false as const };
      const finding = projectedDriftFindings(session.events).find(
        (candidate) =>
          candidate.findingID === input.findingID &&
          candidate.status === "open",
      );
      if (!finding) return { acknowledged: false as const };
      publishForSession(
        activeExec,
        workLedgerController.buildDriftFindingUpdate({
          id: `drift:${Date.now().toString(36)}:${input.findingID}`,
          findingID: input.findingID,
          status: input.status,
          rationale: input.rationale,
        }),
      );
      return { acknowledged: true as const };
    },
    async registeredTools() {
      if (!session) return [];
      return projectedCanonicalTools(session.events).map((t) => ({
        name: t.name,
        owner: t.owner,
        scope: t.scope,
        recovery: t.recovery,
        precedence: t.precedence,
        requiresApproval: t.requiresApproval,
      }));
    },
    async capabilities() {
      // The built-in catalogue registers during initialize; a query that skips
      // `ready` would answer before those records exist.
      await ready;
      if (!capabilityRegistry) return [];
      return [
        ...(workspaceCapabilityView?.list() ?? []),
        ...capabilityRegistry.list(),
      ].map((record) => {
        // The effective contributions this capability owns, as metadata only.
        // Payloads stay on the host side: a tool definition or a settings value
        // must not leak through the query surface. Contributions that lost an
        // override are not effective and are omitted.
        const contributions = record.grants.flatMap((grant) =>
          capabilityRegistry
            .contributions<unknown>(grant)
            .filter((entry) => entry.capabilityID === record.id)
            .map((entry) => ({ kind: entry.kind, name: entry.name })),
        );
        return {
          id: record.id,
          name: record.name,
          version: record.version,
          scope: record.scope,
          grants: record.grants,
          precedence: record.precedence,
          provides: contributions
            .filter((entry) => entry.kind === "services")
            .map((entry) => entry.name),
          contributions,
        };
      });
    },
    async workGraphNodes() {
      if (!session) return [];
      return projectedWorkGraphNodes(session.events).map((r) => ({
        nodeID: r.nodeID,
        kind: r.kind,
        summary: r.summary,
        actor: r.actor,
        target: r.target,
        sessionID: r.sessionID,
        turnID: r.turnID,
        episodeID: r.episodeID,
      }));
    },
    async workGraphEdges() {
      if (!session) return [];
      return projectedWorkGraphEdges(session.events).map((r) => ({
        sourceID: r.sourceID,
        targetID: r.targetID,
        kind: r.kind,
        reason: r.reason,
        episodeID: r.episodeID,
      }));
    },
    async respondApproval(response) {
      await ready;
      return interactive.respondApproval(response);
    },
    async respondQuestion(response) {
      await ready;
      return interactive.respondQuestion(response);
    },
  };

  async function executeToolCalls(
    turnID: string,
    calls: ProviderToolCall[],
    assistant: string,
    materialized: ToolMaterialization,
  ): Promise<ProviderMessage[]> {
    // B: the model can attach an image (a screenshot it took) so the next
    // provider step shows it back to the model, gated by the model's image
    // input capability.
    const pendingImages: Array<{
      mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
      dataURL: string;
    }> = [];
    const pendingPdfs: Array<{
      mediaType: "application/pdf";
      dataURL: string;
    }> = [];
    const exec =
      executionBySession.get(turnSession.get(turnID) ?? sessionID) ??
      activeExec;
    const attachImage = currentModelImageInput(exec)
      ? async (path: string) => {
          const mediaType = mediaTypeForImage(path);
          const bytes = await readFile(resolve(workspaceRoot, path));
          pendingImages.push({
            mediaType,
            dataURL: `data:${mediaType};base64,${bytes.toString("base64")}`,
          });
        }
      : undefined;
    const attachPdf = currentModelPdfInput(exec)
      ? async (path: string) => {
          const bytes = await readFile(resolve(workspaceRoot, path));
          pendingPdfs.push({
            mediaType: "application/pdf",
            dataURL: `data:application/pdf;base64,${bytes.toString("base64")}`,
          });
        }
      : undefined;
    // D2: a tool segment belongs to the session its turn was submitted to. The
    // local bindings shadow the activity-scoped globals for the whole segment,
    // so every publish lands in that session's journal with its stamp, and the
    // context ledger touched is the turn's own.
    const publish = (event: RuntimeEvent) => publishForSession(exec, event);
    const execContext = exec?.context ?? runtimeContext;
    const assistantMessage: ProviderMessage = {
      role: "assistant",
      content: assistant,
      toolCalls: calls,
    };
    const messages: ProviderMessage[] = [assistantMessage];
    for (const call of calls) {
      execContext.add({
        id: `${turnID}:${call.id}:call`,
        role: "tool_call",
        content: `${call.name} ${call.arguments}`,
        pairID: call.id,
      });
    }
    for (const call of calls) {
      if (!call.name.trim()) {
        const reason =
          "provider emitted a tool call without a name; check OpenAI-compatible streaming format";
        publish({
          type: "diagnostic",
          level: "warning",
          message: reason,
        });
        publish({
          type: "tool.update",
          id: `${turnID}:${call.id}`,
          name: "invalid_tool_call",
          callID: call.id,
          status: "failed",
          summary: reason,
          result: reason,
          endedAt: Date.now(),
        });
        publishWorkGraphToolCall(
          turnID,
          call.id,
          "invalid_tool_call",
          "failed",
        );
        messages.push({
          role: "tool",
          toolCallID: call.id,
          toolName: "invalid_tool_call",
          content: toolResultContent(
            `ERROR: ${reason}`,
            call.id,
            options.taskModuleContext,
          ),
        });
        execContext.add({
          id: `${turnID}:${call.id}:result`,
          role: "tool_result",
          content: `ERROR: ${reason}`,
          pairID: call.id,
        });
        continue;
      }
      const resolved = materialized.resolve(call.name);
      if (resolved.status !== "ready") {
        const reason = resolved.error;
        const registered = tools.get(call.name);
        if (
          registered &&
          (!isToolAllowed(call.name, exec) ||
            (exec?.permissionMode === "read_only" &&
              registered.requiresApproval))
        )
          publish({
            type: "policy.decision",
            turnID,
            toolName: call.name,
            toolCallID: call.id,
            decision: "deny",
            reason:
              exec?.permissionMode === "read_only" &&
              registered.requiresApproval
                ? readOnlyToolMessage(call.name)
                : !moduleToolLayer.isToolAllowed(call.name)
                  ? `blocked outside active ${options.taskModuleContext?.moduleType} module: ${call.name}`
                  : !modulePermissionToolLayer.isToolAllowed(call.name)
                    ? `blocked by active module policy: ${call.name}`
                    : (extensionToolPermission(
                        call.name,
                        exec?.permissionProfile,
                      ).diagnostics[0] ??
                      "tool is excluded from the runtime catalog by policy"),
          });
        publish({
          type: "tool.update",
          id: `${turnID}:${call.id}`,
          name: call.name,
          callID: call.id,
          status: "failed",
          summary: reason,
          result: reason,
          endedAt: Date.now(),
        });
        publishWorkGraphToolCall(
          turnID,
          call.id,
          call.name,
          registered && exec?.permissionMode === "read_only"
            ? "rejected"
            : "failed",
        );
        messages.push({
          role: "tool",
          toolCallID: call.id,
          toolName: call.name,
          content: toolResultContent(
            `ERROR: ${reason}`,
            call.id,
            options.taskModuleContext,
          ),
        });
        execContext.add({
          id: `${turnID}:${call.id}:result`,
          role: "tool_result",
          content: `ERROR: ${reason}`,
          pairID: call.id,
        });
        continue;
      }
      const result = await executeOneTool(
        turnID,
        call,
        resolved.tool,
        attachImage,
        attachPdf,
      );
      messages.push({
        role: "tool",
        toolCallID: call.id,
        toolName: call.name,
        content: toolResultContent(result, call.id, options.taskModuleContext),
      });
      execContext.add({
        id: `${turnID}:${call.id}:result`,
        role: "tool_result",
        content: result,
        pairID: call.id,
      });
    }
    if (pendingImages.length || pendingPdfs.length)
      messages.push({
        role: "user",
        content: pendingPdfs.length
          ? "The original PDF is attached as the result of the preceding tool call. Read every selected page in order using native document understanding. Do not claim that local OCR or page-image rendering was used."
          : "Rendered page images are attached as the result of the preceding tool call. Read every image in attachment order. A visual attachment means the PDF text extractor found little text or vision was explicitly requested; it does not by itself prove the page is scanned. Do not claim that local OCR was used.",
        ...(pendingImages.length ? { images: pendingImages } : {}),
        ...(pendingPdfs.length ? { pdfs: pendingPdfs } : {}),
      });
    return messages;
  }

  /**
   * The tool result the model actually reads. In a flow module episode the
   * call ID is prepended to the content of text-shaped results, because
   * models reliably read content but routinely ignore the protocol-level
   * tool_call_id — without this the model cannot know its own call ID and
   * guesses evidenceRefs. JSON-shaped results (report_issue, read_data_source
   * and friends) stay untouched: the model consumes them verbatim.
   */
  function toolResultContent(
    content: string,
    callID: string,
    moduleContext: unknown,
  ): string {
    if (!moduleContext) return content;
    const trimmed = content.trimStart();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return content;
    return `[tool call ID: ${callID}] ${content}`;
  }

  /**
   * Checks constitution rules and the self-protection patterns. Returns the
   * blocked reason or undefined.
   *
   * `commandText` is whatever the call would actually run, extracted by the
   * same function the command policy uses, so shell and terminal input are
   * judged from one source. This check runs before approval, which is what
   * makes it a block rather than a prompt: an approval that is skipped, cached
   * or auto-granted cannot let a self-protection violation through.
   */
  function checkConstitutionForTool(
    turnID: string,
    callID: string,
    toolName: string,
    toolAction: string,
    toolResource: string,
    commandText?: string,
  ): string | undefined {
    const exec = executionForTurn(turnID) ?? activeExec;
    if (!exec) return undefined;
    const publish = (event: RuntimeEvent) => publishForSession(exec, event);
    const rules = projectedConstitutionRules(exec.session.events);
    let blocked: string | undefined;

    if (commandText) {
      for (const entry of SELF_PROTECTION_PATTERNS)
        if (entry.pattern.test(commandText)) {
          publish({
            type: "constitution.check",
            id: `${turnID}:constitution:${entry.ruleID.toLowerCase()}`,
            ruleID: entry.ruleID,
            statement: entry.statement,
            priority: "critical",
            enforcement: "deny",
            action: toolAction,
            resource: `command:${commandText.slice(0, 120)}`,
            conflict: true,
          });
          // CST4: the blocked call is constrained by the rule that stopped it.
          // The tool-call node for a failed call is published by the caller, so
          // the edge's source exists once the call settles; a conflict is the
          // only check worth an edge (a pass-through rule is not news).
          publish(
            workLedgerController.constitutionCheckEdge({
              turnID,
              callID,
              ruleID: entry.ruleID,
            }),
          );
          blocked = `blocked by constitution: ${entry.statement}. Use terminal.kill or terminal.close instead.`;
          break;
        }
    }

    for (const rule of rules) {
      if (rule.enforcement === "deny" || rule.enforcement === "warn") {
        publish({
          type: "constitution.check",
          id: `${turnID}:constitution:${rule.ruleID.toLowerCase()}`,
          ruleID: rule.ruleID,
          statement: rule.statement,
          priority: rule.priority,
          enforcement: rule.enforcement,
          action: toolAction,
          resource: toolResource,
          conflict: false,
        });
      }
    }
    return blocked;
  }

  async function executeOneTool(
    turnID: string,
    call: ProviderToolCall,
    tool: RuntimeTool,
    attachImage?: (path: string) => Promise<void>,
    attachPdf?: (path: string) => Promise<void>,
  ) {
    // D2: same shadowing as `executeToolCalls` — this segment's events and
    // ledger belong to the turn's session.
    const exec =
      executionBySession.get(turnSession.get(turnID) ?? sessionID) ??
      activeExec;
    const publish = (event: RuntimeEvent) => publishForSession(exec, event);
    const execContext = exec?.context ?? runtimeContext;
    const toolID = `${turnID}:${call.id}`;
    const dedupKey = `${call.name}\u0000${call.arguments}`;
    const sessionToolCalls = exec?.toolCalls ?? toolCalls;
    const occurrences = (sessionToolCalls.get(dedupKey) ?? 0) + 1;
    sessionToolCalls.set(dedupKey, occurrences);
    if (occurrences > 12 && !WAITING_TOOLS.has(tool.name)) {
      const message = `blocked repeated tool call after ${occurrences} identical attempts: ${tool.name}`;
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
      publishWorkGraphToolCall(turnID, call.id, tool.name, "failed");
      return `ERROR: ${message}`;
    }
    const hookEvent: ToolHookEvent = {
      turnID,
      toolName: tool.name,
      toolCallID: call.id,
      arguments: call.arguments,
    };
    // The policy chain is a reorderable pipeline now: preExecute, read-only and
    // constitution are pre stages (the first denial stops the run), and the
    // approval-and-execution block below is the execute stage's content. The
    // outcome is a frozen result the caller cannot rewrite.
    const pipeline = toolPolicy!
      .createExecutionPipeline()
      .preStage(async () => {
        const preResult = await toolLayer.preExecute(hookEvent);
        for (const diagnostic of preResult.diagnostics) {
          publishForSession(exec, {
            type: "diagnostic",
            level: "info",
            message: diagnostic,
          });
        }
        if (preResult.allowed) return { decision: "allow" as const };
        if (preResult.clearTerminal) {
          const terminalID = tryParseToolArguments(call.arguments).id;
          if (typeof terminalID === "string") {
            try {
              await terminalController?.write(terminalID, "\x15");
              publish({
                type: "diagnostic",
                level: "warning",
                message: `cleared blocked terminal command buffer for ${terminalID}`,
              });
            } catch (error) {
              publish({
                type: "diagnostic",
                level: "warning",
                message: `could not clear blocked terminal command buffer for ${terminalID}: ${error instanceof Error ? error.message : String(error)}`,
              });
            }
          }
        }
        const reason = preResult.diagnostics.join("; ");
        publish({
          type: "policy.decision",
          turnID,
          toolName: tool.name,
          toolCallID: call.id,
          decision: "deny",
          reason,
        });
        publish({
          type: "tool.update",
          id: toolID,
          name: tool.name,
          callID: call.id,
          status: "failed",
          summary: reason,
          result: reason,
          endedAt: Date.now(),
        });
        publishWorkGraphToolCall(turnID, call.id, tool.name, "failed");
        return { decision: "deny" as const, reason };
      })
      .preStage(() => {
        if (!(exec?.permissionMode === "read_only" && tool.requiresApproval))
          return { decision: "allow" as const };
        const message = readOnlyToolMessage(tool.name);
        publish({
          type: "policy.decision",
          turnID,
          toolName: tool.name,
          toolCallID: call.id,
          decision: "deny",
          reason: message,
        });
        publish({
          type: "tool.update",
          id: toolID,
          name: tool.name,
          callID: call.id,
          status: "rejected",
          summary: message,
          result: message,
          endedAt: Date.now(),
        });
        publishWorkGraphToolCall(turnID, call.id, tool.name, "rejected");
        return { decision: "deny" as const, reason: message };
      })
      .preStage(() => {
        const blocked = checkConstitutionForTool(
          turnID,
          call.id,
          tool.name,
          tool.name,
          // `apply_patch` reports the whole-workspace scope `"."` because it can
          // touch many files; `write_file`/`edit_file` report their single path.
          // Anything else has no path scope and falls through to "global".
          toolPolicy!.workspaceWritePathForTool(
            tool.name,
            tryParseToolArguments(call.arguments),
          ) ?? "global",
          toolPolicy!.commandTextForTool(
            tool.name,
            tryParseToolArguments(call.arguments),
          ),
        );
        if (!blocked) return { decision: "allow" as const };
        publish({
          type: "tool.update",
          id: toolID,
          name: tool.name,
          callID: call.id,
          status: "failed",
          summary: blocked,
          argumentsDelta: call.arguments,
        });
        publishWorkGraphToolCall(turnID, call.id, tool.name, "failed");
        return { decision: "deny" as const, reason: blocked };
      })
      .execute(async () => {
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
              ...hookEvent,
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
          // The call card, when the tool declares one: the tool says what the call
          // means (a file path, a command) without leaking raw arguments.
          metadata: tool.output?.presentCall
            ? {
                call: tool.output.presentCall(
                  tryParseToolArguments(call.arguments),
                ),
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
          // A cancellation that already happened must not be missed. `running` is
          // published before the durable in-flight write above, so a cancel can land
          // while that write is in flight — and `addEventListener("abort")` never
          // fires for an already-aborted signal. Without this check the tool ran on
          // until its own timeout (or forever, when it declares none) even though the
          // turn was cancelled.
          if (execSignal?.aborted) cancelExecution();
          else
            execSignal?.addEventListener("abort", cancelExecution, {
              once: true,
            });
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
          // D2: workspace writes serialise across sessions. A background turn's
          // write waits for the attached session's write (and vice versa), so two
          // turns can never interleave edits to the same workspace.
          releaseWriteLock = toolPolicy!.workspaceWritePathForTool(
            tool.name,
            parsed as Record<string, unknown>,
          )
            ? await requireWriteLock().acquire()
            : undefined;
          // WG4 Phase 3: register the expected mutation before the tool runs so the
          // auditor can attribute a watcher-confirmed change to this call. Only
          // workspace-writing tools register; the authorized path is the tool's own
          // path argument (the same scope the write lock protects).
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
                if (
                  sandboxResourcesByID.get(update.id) !==
                  update.runningResources
                ) {
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
            exec?.activeAbort?.signal.removeEventListener(
              "abort",
              cancelExecution,
            );
          });
          // The tool's own final content invariant runs exactly once, before
          // redaction and bounding: what the model sees is the content the tool
          // finalized (a fetched page without its scripts, a compacted dump).
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
          if (
            options.taskModuleContext &&
            tool.name !== "flow_module_complete"
          ) {
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
              else endTurnWaitingHuman = marker;
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
          const message =
            error instanceof Error ? error.message : String(error);
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
          await toolLayer.postExecute({ ...hookEvent, error: message });
          throw new Error(message);
        } finally {
          releaseWriteLock?.();
          if (executionAudited && exec)
            await setInFlightOperationFor(exec, undefined);
        }
      })
      .postStage(async (_input, content) => {
        // postExecute-on-success is the post waterfall's accept stage; the
        // error-reporting postExecute calls stay in the execute stage where
        // they already fire.
        await toolLayer.postExecute({ ...hookEvent, result: content });
        return { decision: "accept" as const };
      });
    let run: Awaited<ReturnType<typeof pipeline.run>>;
    try {
      run = await pipeline.run({
        name: tool.name,
        args: tryParseToolArguments(call.arguments),
        context: { workspaceRoot },
      });
    } catch (error) {
      // The execute stage throws on refusal and on failure after publishing
      // its own events; the caller turns the reason into the model-visible
      // result. A cancellation is not a failure: it propagates so the turn
      // coordinator settles the turn as cancelled.
      if (exec?.activeAbort?.signal.aborted) throw error;
      return `ERROR: ${error instanceof Error ? error.message : String(error)}`;
    }
    if (run.status === "denied") return `ERROR: ${run.reason}`;
    if (run.status === "asking")
      return `ERROR: ${run.decision.reason ?? "approval required"}`;
    if (run.status === "blocked") return `ERROR: ${run.feedback}`;
    return run.result.content;
  }

  /**
   * Resolves the approval for one tool call.
   *
   * A refusal is a decision about this call, not a failure of the turn, so it
   * is returned as a reason for the caller to hand back to the model. Only a
   * cancellation or a timeout still throws, because in those cases there is no
   * decision to act on. Returning instead of throwing is what lets the model
   * read why it was refused and choose a different approach.
   */
  async function authorizeSandboxMerge(
    input: { id: string; paths: string[] },
    exec: SessionExecutionState | undefined = activeExec,
  ) {
    for (const path of input.paths) {
      const hookEvent: ToolHookEvent = {
        turnID:
          exec?.activeTurnID ??
          activeTurnID ??
          `sandbox:${exec?.session.id ?? sessionID}`,
        toolName: "sandbox_merge",
        toolCallID: `sandbox:${input.id}:${path}`,
        arguments: JSON.stringify({ id: input.id, path }),
      };
      const preResult = await toolLayer.preExecute(hookEvent);
      for (const diagnostic of preResult.diagnostics)
        publishForSession(exec, {
          type: "diagnostic",
          level: "info",
          message: diagnostic,
        });
      if (!preResult.allowed)
        throw new Error(
          `sandbox merge denied for "${path}": ${preResult.diagnostics.join("; ")}`,
        );
    }
  }

  async function authorizeSandboxManagement(
    toolName: "sandbox_merge" | "sandbox_delete" | "sandbox_resource_stop",
    arguments_: Record<string, string>,
    exec: SessionExecutionState = activeExec!,
  ) {
    const hookEvent: ToolHookEvent = {
      turnID: exec.activeTurnID ?? `sandbox:${exec.session.id}`,
      toolName,
      toolCallID: `sandbox:manage:${toolName}:${arguments_.id}`,
      arguments: JSON.stringify(arguments_),
    };
    const result = await toolLayer.preExecute(hookEvent);
    for (const diagnostic of result.diagnostics)
      publishForSession(exec, {
        type: "diagnostic",
        level: "info",
        message: diagnostic,
      });
    if (!result.allowed)
      throw new Error(
        `${toolName} denied: ${result.diagnostics.join("; ") || "runtime policy denied operation"}`,
      );
  }

  async function authorizeWorkspaceRead(
    input: {
      toolName: string;
      paths: string[];
    },
    exec: SessionExecutionState | undefined = activeExec,
  ) {
    const agent = exec ? exec.selectedAgent : selectedAgent;
    for (const path of input.paths) {
      const permission = toolPolicy!.evaluatePermissionRules(
        agent?.permissions,
        input.toolName,
        { path },
        workspaceRoot,
      );
      if (permission.allowed) continue;
      for (const diagnostic of permission.diagnostics)
        publishForSession(exec, {
          type: "diagnostic",
          level: "info",
          message: diagnostic,
        });
      throw new Error(
        `${input.toolName} denied for "${path}": ${permission.diagnostics.join("; ")}`,
      );
    }
  }

  async function waitIfPaused(
    exec: SessionExecutionState | undefined = activeExec,
  ) {
    const state = exec ?? activeExec;
    while (state ? state.paused : paused) {
      await new Promise<void>((resolveWaiter) => {
        if (state) state.pauseWaiters.push(resolveWaiter);
        else pauseWaiters.push(resolveWaiter);
      });
    }
  }

  function toolSettings(exec: SessionExecutionState | undefined = activeExec) {
    const profile = exec ? exec.permissionProfile : selectedPermissionProfile;
    const agent = exec ? exec.selectedAgent : selectedAgent;
    const profileNetwork = profile?.permissions?.network;
    const agentNetwork = agent?.permissions?.network;
    const effectiveNetwork = agentNetwork ?? profileNetwork;
    const agentAllowedHosts = agentNetwork?.allowedHosts.length
      ? agentNetwork.allowedHosts
      : tsRuntimeConfig?.network.allowedHosts;
    const allowedHostGroups = [
      profileNetwork?.allowedHosts,
      agentAllowedHosts,
    ].filter((hosts): hosts is string[] => Boolean(hosts?.length));
    const base = {
      webSearchEndpoint: tsRuntimeConfig?.webSearch.endpoint ?? undefined,
      webSearchProviderPriority: tsRuntimeConfig?.webSearch.providerPriority,
      browserEnabled: tsRuntimeConfig?.browser.enabled,
      browserBinary: tsRuntimeConfig?.browser.binary || undefined,
      browserUserAgent: tsRuntimeConfig?.browser.userAgent || undefined,
      browserHeaders: tsRuntimeConfig?.browser.headers,
      browserPersistentProfile: tsRuntimeConfig?.browser.persistentProfile,
      browserProfileDir: tsRuntimeConfig?.browser.profileDir || undefined,
      browserLocale: tsRuntimeConfig?.browser.locale || undefined,
      browserTimezone: tsRuntimeConfig?.browser.timezone || undefined,
      allowedHosts: agentAllowedHosts,
      allowedHostGroups: allowedHostGroups.length
        ? allowedHostGroups
        : undefined,
      allowedSchemes: tsRuntimeConfig?.network.allowedSchemes,
      deniedHosts: [
        ...(profileNetwork?.denyHosts ?? []),
        ...(agentNetwork?.denyHosts ?? []),
      ],
      allowLocalhost:
        profileNetwork?.allowLocalhost === false ||
        agentNetwork?.allowLocalhost === false
          ? false
          : (effectiveNetwork?.allowLocalhost ??
            tsRuntimeConfig?.network.allowLocalhost),
      allowPrivate:
        profileNetwork?.allowPrivate === false ||
        agentNetwork?.allowPrivate === false
          ? false
          : (effectiveNetwork?.allowPrivate ??
            tsRuntimeConfig?.network.allowPrivate),
      envAllowlist:
        agent?.permissions?.env?.allowlist ??
        tsRuntimeConfig?.security.envAllowlist,
    };
    // The `settings` grant's first host consumer: capability contributions
    // provide defaults that explicit config and permission values override.
    return mergeContributedToolSettings(base, [
      ...(workspaceCapabilityView?.contributions("settings") ?? []),
      ...capabilityRegistry.contributions("settings"),
    ]);
  }
}

function redactToolOutput(output: string, redact: boolean | undefined) {
  if (!redact) return output;
  return output.replace(
    /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s]+/giu,
    (match) =>
      `${match.slice(0, match.indexOf("=") >= 0 ? match.indexOf("=") + 1 : match.indexOf(":") + 1)}[REDACTED]`,
  );
}

/**
 * Runs a validation command with the workspace as cwd and bounded, redacted
 * output. The redaction is unconditional for validation output (a validation
 * run's output may carry secrets the model's own redaction config would not
 * catch), and the captured output is capped so a chatty runner cannot grow the
 * returned summary without limit. This is the E2 "redaction" half of the
 * validation-runner adapter: secrets are stripped here, before anything reaches
 * `evidence.recorded`.
 */
async function runValidationCommand(
  command: string,
  cwd: string,
  timeoutSec: number,
): Promise<{ exitCode: number; safeSummary: string }> {
  const process = Bun.spawn(["/bin/bash", "-c", command], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const timer = setTimeout(
    () => {
      try {
        process.kill();
      } catch {
        // already gone
      }
    },
    Math.max(1, timeoutSec) * 1000,
  );
  const [stdout, stderr] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  await process.exited;
  clearTimeout(timer);
  const exitCode = process.exitCode ?? 0;
  const combined = `${stdout}\n${stderr}`.slice(0, 4000);
  const safeSummary = redactToolOutput(combined.trim(), true).slice(0, 2000);
  return { exitCode, safeSummary };
}

function waitForToolExecution<T>(execution: Promise<T>, signal?: AbortSignal) {
  if (!signal) return execution;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error("tool cancelled"));
    signal.addEventListener("abort", abort, { once: true });
    execution.then(
      (result) => {
        signal.removeEventListener("abort", abort);
        resolve(result);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

function isManagedResourceTool(toolName: string) {
  return [
    "process_start",
    "process_stop",
    "process_restart",
    "background_start",
    "background_stop",
    "background_restart",
  ].includes(toolName);
}

function sessionSeed(workspaceRoot: string) {
  return createHash("sha256").update(workspaceRoot).digest("hex").slice(0, 12);
}

function lineCount(text: string) {
  return text.length === 0 ? 0 : text.split(/\r\n|\r|\n/u).length;
}

function isRuntimeReasoningEffort(
  value: unknown,
): value is import("@natalia/contracts").RuntimeReasoningEffort {
  return (
    value === "minimal" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh"
  );
}
