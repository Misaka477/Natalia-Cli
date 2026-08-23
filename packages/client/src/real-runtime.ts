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
import { createChatPrompt } from "./runtime/collaboration/chat-prompt";
import { createChatTools } from "./runtime/collaboration/chat-tools";
import { createCollaborationWake } from "./runtime/collaboration/wake";
import { createMailboxPlans } from "./runtime/collaboration/mailbox-plans";
import { createChatTurn } from "./runtime/collaboration/chat-turn";
import { createSessionExecution } from "./runtime/session-execution";
import { createToolPolicySurface } from "./runtime/tool-execution/policy";
import { createExecuteCalls } from "./runtime/tool-execution/execute-calls";
import { createExecuteOne } from "./runtime/tool-execution/execute-one";
import { createTurnRunner } from "./runtime/turn-runner";
import { createSessionAdmission } from "./runtime/session-admission";
import { createSessionAttach } from "./runtime/session-attach";
import { createPluginAssembly } from "./runtime/plugin-assembly";
import { createConfigReload } from "./runtime/config-reload";
import { createToolPublish } from "./runtime/tool-publish";
import { createServiceRefresh } from "./runtime/service-refresh";
import { createEnsureReady } from "./runtime/ensure-ready";
import { createEventSink } from "./runtime/event-sink";
import { createCommands } from "./runtime/commands";
import type { RuntimeContext } from "./runtime/context";
import { createInitialize } from "./runtime/initialize";
import type { SessionExecutionState } from "./runtime/session-execution-state";
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
  ctx.ports.getSession = () => session;
  ctx.ports.getReplayMode = () => replayMode;
  ctx.ports.getSessionPersistence = () => sessionPersistence;
  ctx.ports.getProviderConcurrencyLimiter = () => providerConcurrencyLimiter;
  ctx.ports.getExecutionBySession = () => executionBySession;
  ctx.ports.getTurnSession = () => turnSession;
  ctx.ports.getRuntimeContext = () => runtimeContext;
  ctx.ports.getActiveSkill = () => activeSkill;
  ctx.ports.getTurnAgent = () => turnAgent;
  ctx.ports.getAttachmentReferences = () => attachmentReferences;
  ctx.ports.getToolCalls = () => toolCalls;
  ctx.ports.getRetryPolicy = () => retryPolicy;
  ctx.ports.getGovernanceLedgerController = () => governanceLedgerController;
  ctx.ports.executionForTurn = executionForTurn;
  ctx.ports.getTurnController = () => turnController;
  ctx.ports.getTaskWorkflowController = () => taskWorkflowController;
  ctx.ports.getSessionID = () => sessionID;
  ctx.ports.getContextLedgerFactory = () => contextLedgerFactory;
  ctx.ports.getProvider = () => provider;
  ctx.state.executionBySession = executionBySession;
  ctx.ports.getActiveExec = () => activeExec;
  ctx.ports.getActiveTurnID = () => activeTurnID;
  ctx.ports.getPauseWaiters = () => pauseWaiters;
  ctx.ports.getWorkspaceWriteLock = () => workspaceWriteLock;
  ctx.ports.getWorkspaceCapabilityView = () => workspaceCapabilityView;
  ctx.ports.getTools = () => tools;
  ctx.ports.requireWriteLock = requireWriteLock;
  ctx.ports.requireSandboxes = requireSandboxes;
  ctx.ports.scheduleRuntimeStatusSnapshot = scheduleRuntimeStatusSnapshot;
  ctx.ports.runtimeStatusSnapshot = runtimeStatusSnapshot;
  ctx.ports.skillService = skillService;
  ctx.ports.skillsList = skillsList;
  ctx.ports.teamBehavior = teamBehavior;
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
  ctx.ports.getProviderModelController = () => providerModelController;
  ctx.ports.nextChatSequence = () => chatSequence++;
  ctx.state.internalWakeTasks = internalWakeTasks;
  ctx.ports.setSessionPersistence = (next) => {
    sessionPersistence = next;
  };
  ctx.ports.redactToolOutput = redactToolOutput;
  ctx.state.activeToolByTurn = activeToolByTurn;
  ctx.state.liveMainOutputByTurn = liveMainOutputByTurn;
  ctx.state.terminalStatusByID = terminalStatusByID;
  ctx.state.sandboxResourcesByID = sandboxResourcesByID;
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
  ctx.ports.setModuleToolLayer = (layer) => {
    moduleToolLayer = layer;
  };
  ctx.ports.setModulePermissionToolLayer = (layer) => {
    modulePermissionToolLayer = layer;
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
  ctx.ports.isToolAllowed = isToolAllowed;
  ctx.ports.extensionToolPermission = extensionToolPermission;
  ctx.ports.extensionEnabled = extensionEnabled;
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
  ctx.ports.currentSessionSnapshot = currentSessionSnapshot;
  ctx.ports.nextCollabSequence = () => collabSequence++;
  ctx.ports.nextPlanSequence = () => planSequence++;
  const chatPrompt = createChatPrompt(ctx);
  const { recentMainAgentActivity, recentToolActivity, chatSystemPrompt } =
    chatPrompt;
  const chatToolsModule = createChatTools(ctx);
  const { chatTools, chatToolSummary } = chatToolsModule;
  const collaborationWake = createCollaborationWake(ctx);
  const {
    wakeMainForCollaboration,
    scheduleInternalWake,
    requestNaviWake,
    wakeNavi,
  } = collaborationWake;
  ctx.ports.wakeMainForCollaboration = wakeMainForCollaboration;
  ctx.ports.wakeNavi = wakeNavi;
  ctx.ports.requestNaviWake = requestNaviWake;
  ctx.ports.scheduleInternalWake = scheduleInternalWake;
  const mailboxPlans = createMailboxPlans(ctx);
  const { createCollabChatTool, enqueueMailboxMessage, createPlanDraft } =
    mailboxPlans;
  ctx.ports.createCollabChatTool = createCollabChatTool;
  ctx.ports.enqueueMailboxMessage = enqueueMailboxMessage;
  ctx.ports.createPlanDraft = createPlanDraft;
  ctx.ports.chatSystemPrompt = chatSystemPrompt;
  ctx.ports.chatTools = chatTools;
  ctx.ports.chatToolSummary = chatToolSummary;
  const chatTurn = createChatTurn(ctx);
  const { runChatTurnBody } = chatTurn;
  ctx.ports.runChatTurnBody = runChatTurnBody;
  ctx.ports.providerFromEnvironment = providerFromEnvironment;
  ctx.ports.getPerformanceTrace = () => performanceTrace;
  ctx.ports.getNativeRuntimeID = () => nativeRuntimeID;
  ctx.ports.getUserRuntimeHome = () => userRuntimeHome();
  ctx.ports.getUserSkillRoot = () => userSkillRoot();
  ctx.ports.setProviderSource = (source) => {
    providerSource = source;
  };
  ctx.ports.getBuiltinPluginIDs = () => builtinPluginIDs;
  ctx.ports.isBuiltinToolPlugin = isBuiltinToolPlugin;
  ctx.ports.isStaticBuiltinPlugin = isStaticBuiltinPlugin;
  const pluginAssembly = createPluginAssembly(ctx, options);
  const {
    skillsPluginInput,
    checkpointPluginInput,
    sandboxPluginInput,
    terminalPluginInput,
    workspacePluginInput,
    providerModelPluginInput,
    compactionPluginInput,
    mcpPluginInput,
    localToolsPluginInput,
    externalPluginConfigFingerprint,
    selectPluginConfig,
  } = pluginAssembly;
  ctx.ports.externalPluginConfigFingerprint = externalPluginConfigFingerprint;
  ctx.ports.reloadPermissionSettings = reloadPermissionSettings;
  ctx.ports.setTsRuntimeConfig = (config) => {
    tsRuntimeConfig = config;
  };
  ctx.ports.setMaxSteps = (steps) => {
    maxSteps = steps;
  };
  ctx.ports.setRetryPolicy = (policy) => {
    retryPolicy = policy;
  };
  ctx.ports.setProviderConcurrencyLimiter = (limiter) => {
    providerConcurrencyLimiter = limiter;
  };
  ctx.ports.setAgentRegistry = (registry) => {
    agentRegistry = registry;
  };
  ctx.ports.setBuiltinPluginIDs = (ids) => {
    builtinPluginIDs = ids;
  };
  ctx.ports.setBuildBuiltinPluginCatalog = (build) => {
    buildBuiltinPluginCatalog = build;
  };
  ctx.ports.getPluginsController = () => pluginsController;
  ctx.ports.setActiveExternalPluginConfigFingerprint = (fingerprint) => {
    activeExternalPluginConfigFingerprint = fingerprint;
  };
  ctx.ports.getActiveExternalPluginConfigFingerprint = () =>
    activeExternalPluginConfigFingerprint;
  ctx.ports.buildBuiltinPluginCatalog = (config) =>
    buildBuiltinPluginCatalog(config);
  const configReload = createConfigReload(ctx, options);
  const {
    configReloadBlockedReason,
    applyConfigFromDisk,
    reloadConfigFromDisk,
  } = configReload;
  ctx.ports.configReloadBlockedReason = configReloadBlockedReason;
  const toolPublish = createToolPublish(ctx, options);
  const {
    publishBuiltinCapabilities,
    hotReloadToolFamily,
    publishRegisteredTools,
    publishToolCatalogChanges,
    publishWorkGraphToolCall,
  } = toolPublish;
  ctx.ports.publishWorkGraphToolCall = publishWorkGraphToolCall;
  ctx.ports.hotReloadToolFamily = hotReloadToolFamily;
  ctx.ports.publishToolCatalogChanges = publishToolCatalogChanges;
  ctx.ports.setWorkspaceWriteLock = (lock) => {
    workspaceWriteLock = lock;
  };
  ctx.ports.setMutationRegistry = (registry) => {
    mutationRegistry = registry;
  };
  ctx.ports.setWorkspaceFilesController = (controller) => {
    workspaceFilesController = controller;
  };
  ctx.ports.setTerminalController = (controller) => {
    terminalController = controller;
  };
  ctx.ports.setSandboxController = (controller) => {
    sandboxController = controller;
  };
  ctx.ports.setMcpService = (service) => {
    mcpService = service;
  };
  ctx.ports.setSubagentsController = (controller) => {
    subagentsController = controller;
  };
  ctx.ports.setProviderModelController = (controller) => {
    providerModelController = controller;
  };
  ctx.ports.setTaskWorkflowController = (controller) => {
    taskWorkflowController = controller;
  };
  ctx.ports.setCompactionService = (service) => {
    compactionService = service;
  };
  ctx.ports.setSessionStoreController = (controller) => {
    sessionStoreController = controller;
  };
  ctx.ports.setToolPolicyService = (service) => {
    toolPolicy = service;
  };
  ctx.ports.setInteractive = (waiter) => {
    interactive = waiter;
  };
  ctx.ports.setAttachmentService = (service) => {
    attachmentService = service;
  };
  ctx.ports.setRetryService = (service) => {
    retryService = service;
  };
  ctx.ports.setContextLedgerFactory = (factory) => {
    contextLedgerFactory = factory;
  };
  ctx.ports.setStatusController = (controller) => {
    statusController = controller;
  };
  ctx.ports.setWorkLedgerController = (controller) => {
    workLedgerController = controller;
  };
  ctx.ports.setGovernanceLedgerController = (controller) => {
    governanceLedgerController = controller;
  };
  ctx.ports.setTurnController = (controller) => {
    turnController = controller;
  };
  ctx.ports.setActiveCheckpointFactory = (factory) => {
    activeCheckpointFactory = factory;
  };
  ctx.ports.getActiveCheckpointFactory = () => activeCheckpointFactory;
  const serviceRefresh = createServiceRefresh(ctx);
  const { refreshBuiltinServices } = serviceRefresh;
  ctx.ports.refreshBuiltinServices = refreshBuiltinServices;
  ctx.ports.setReady = (next) => {
    ready = next;
  };
  const ensureReadyModule = createEnsureReady(ctx);
  const { ensureReady } = ensureReadyModule;
  const sessionExecution = createSessionExecution(ctx, options);
  const {
    drainSessionFor,
    drainPendingQueue,
    runAdmittedInput,
    persistInboxPromotion,
    loadSessionForAttach,
    ensureExecution,
  } = sessionExecution;
  ctx.ports.ensureExecution = ensureExecution;
  ctx.ports.persistInboxPromotion = persistInboxPromotion;
  ctx.ports.drainSessionFor = drainSessionFor;
  ctx.ports.setLastSubmitted = (turn) => {
    lastSubmitted = turn;
  };
  ctx.ports.setSessionID = (id) => {
    sessionID = id;
  };
  ctx.ports.setSession = (record) => {
    session = record;
  };
  ctx.ports.setRuntimeContext = (context) => {
    runtimeContext = context;
  };
  ctx.ports.setActiveExec = (exec) => {
    activeExec = exec;
  };
  ctx.ports.setAttachmentReferences = (refs) => {
    attachmentReferences = refs;
  };
  ctx.ports.setToolCalls = (calls) => {
    toolCalls = calls;
  };
  ctx.ports.setPauseWaiters = (waiters) => {
    pauseWaiters = waiters;
  };
  ctx.ports.setActiveSkill = (skill) => {
    activeSkill = skill;
  };
  ctx.ports.setLastProviderUsage = (usage) => {
    lastProviderUsage = usage;
  };
  ctx.ports.clearRuntimeDiagnostics = () => {
    runtimeDiagnostics.splice(0);
  };
  ctx.ports.getRuntimeDiagnosticsBySession = () => runtimeDiagnosticsBySession;
  ctx.ports.getRuntimeDiagnostics = () => runtimeDiagnostics;
  const sessionAttach = createSessionAttach(ctx);
  const { attachSession } = sessionAttach;
  ctx.ports.setActiveAbort = (controller) => {
    activeAbort = controller;
  };
  ctx.ports.setActiveTurnID = (id) => {
    activeTurnID = id;
  };
  ctx.ports.setSelectedAgent = (agent) => {
    selectedAgent = agent;
  };
  ctx.ports.setPendingAgent = (agent) => {
    pendingAgent = agent;
  };
  ctx.ports.getCompactionService = () => compactionService;
  ctx.ports.getAttachmentService = () => attachmentService;
  ctx.ports.getMcpService = () => mcpService;
  ctx.ports.getRetryService = () => retryService;
  ctx.ports.reloadConfigFromDisk = reloadConfigFromDisk;
  ctx.ports.setInFlightOperationFor = setInFlightOperationFor;
  const toolPolicySurface = createToolPolicySurface(ctx);
  const {
    authorizeSandboxMerge,
    authorizeSandboxManagement,
    authorizeWorkspaceRead,
    waitIfPaused,
    toolSettings,
  } = toolPolicySurface;
  ctx.ports.waitIfPaused = waitIfPaused;
  ctx.ports.toolSettings = toolSettings;
  ctx.ports.authorizeWorkspaceRead = authorizeWorkspaceRead;
  ctx.ports.authorizeSandboxMerge = authorizeSandboxMerge;
  ctx.ports.authorizeSandboxManagement = authorizeSandboxManagement;
  ctx.ports.getTerminalController = () => terminalController;
  ctx.ports.getInteractive = () => interactive;
  ctx.ports.getMutationRegistry = () => mutationRegistry;
  ctx.ports.getTerminalCommandBuffer = () => terminalCommandBuffer;
  ctx.ports.getSandboxResourcesByID = () => sandboxResourcesByID;
  ctx.ports.getEndTurnWaitingHuman = () => endTurnWaitingHuman;
  ctx.ports.setEndTurnWaitingHuman = (marker) => {
    endTurnWaitingHuman = marker;
  };
  ctx.ports.waitForToolExecution = waitForToolExecution;
  ctx.ports.boundToolOutput = boundToolOutput;
  ctx.ports.isManagedResourceTool = isManagedResourceTool;
  ctx.ports.tryParseToolArguments = (input) => {
    const parsed = tryParseToolArguments(input);
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  };
  ctx.ports.parseToolArguments = parseToolArguments;
  ctx.ports.validateToolParameters = validateToolParameters;
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
  ctx.ports.effectiveMaxSteps = effectiveMaxSteps;
  ctx.ports.modelCapabilitiesForExecution = modelCapabilitiesForExecution;
  const turnRunner = createTurnRunner(ctx, options);
  const { providerRunnerInput } = turnRunner;
  ctx.ports.providerRunnerInput = providerRunnerInput;
  ctx.ports.selectRuntimeModel = selectRuntimeModel;
  ctx.ports.applyAgentProvider = applyAgentProvider;
  ctx.ports.refreshExecutionContextConfig = refreshExecutionContextConfig;
  ctx.ports.applyAgentPolicy = applyAgentPolicy;
  ctx.ports.currentModelImageInput = currentModelImageInput;
  ctx.ports.currentModelPdfInput = currentModelPdfInput;
  ctx.ports.mediaTypeForImage = mediaTypeForImage;
  ctx.ports.redactToolOutputEnabled = redactToolOutputEnabled;
  ctx.ports.resolveContextStatusConfig = resolveContextStatusConfig;
  ctx.ports.modelRefKeyForSelection = modelRefKeyForSelection;
  const executeCalls = createExecuteCalls(ctx, options);
  const { executeToolCalls, toolResultContent, checkConstitutionForTool } =
    executeCalls;
  ctx.ports.executeToolCalls = executeToolCalls;
  ctx.ports.toolResultContent = toolResultContent;
  ctx.ports.checkConstitutionForTool = checkConstitutionForTool;
  const executeOne = createExecuteOne(ctx, options);
  const { executeOneTool } = executeOne;
  ctx.ports.executeOneTool = executeOneTool;
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
  ctx.ports.rememberTitleInput = rememberTitleInput;
  const sessionAdmission = createSessionAdmission(ctx, options);
  const { submitInput } = sessionAdmission;
  ctx.ports.submitInput = submitInput;
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

  ctx.state.initialize = {
    resolveConfig,
    reloadPermissionSettings,
    skillsPluginInput,
    localToolsPluginInput,
    workspacePluginInput,
    terminalPluginInput,
    sandboxPluginInput,
    mcpPluginInput,
    compactionPluginInput,
    providerModelPluginInput,
    builtinPluginCatalog,
    computeBuiltinFeatureGates,
    capabilityRegistry,
    workspaceCapabilityView,
    waiterDeps,
    handleCommand,
    scheduleTitleGeneration,
    deliverQueuedMailboxAtBoundary,
    effectiveFlowPermissions,
    createRealRuntimeClient,
    mountRuntimePlugins,
    moduleToolPolicy,
    agentPolicyLayer,
    permissionProfileLayer,
    terminalCommandBuffer,
    evaluatePermissionProfileCommandRules,
    ensureBashCommandParser,
    agentsFromConfig,
    providerForModel,
    sessionSeed,
    createHash,
    lineCount,
    contextEntriesToProviderMessages,
    withProviderConcurrency,
    requireNativeToolCallProtocol,
    normalizeRawToolCallProtocol,
    nativeToolCallCorrection,
    MAX_PROTOCOL_CORRECTIONS,
    WAITING_TOOLS,
    readOnlyToolMessage,
    MAX_STEPS_PROMPT,
    MISSING_FINAL_RESPONSE_FALLBACK,
    cleanupToolOutput,
    settleInterruptedTurnIDs,
    settleInterruptedTurns,
    projectSession,
    modelVisibleEvents,
    turnCoordinator,
    drainSession,
    projectedMailboxMessages,
    buildMailboxStatus,
    createMailboxAcknowledgeTool,
    projectedCollabMessages,
    projectInteractiveRequests,
    contextStatusEvent,
    publishBuiltinCapabilities,
    publishRegisteredTools,
    ProviderConcurrencyLimiter,
    serviceNames: {
      attachment: ATTACHMENT_SERVICE,
      retry: RETRY_SERVICE,
      contextLedgerFactory: CONTEXT_LEDGER_FACTORY_SERVICE,
      compaction: COMPACTION_SERVICE,
      statusSnapshotController: STATUS_SNAPSHOT_CONTROLLER_SERVICE,
      workLedgerController: WORK_LEDGER_CONTROLLER_SERVICE,
      governanceLedgerController: GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
      turnController: TURN_CONTROLLER_SERVICE,
      checkpointFactory: CHECKPOINT_FACTORY_SERVICE,
      workspaceWriteLock: WORKSPACE_WRITE_LOCK_SERVICE,
      workspaceMutations: WORKSPACE_MUTATIONS_SERVICE,
      workspaceFiles: WORKSPACE_FILES_SERVICE,
      terminalController: TERMINAL_CONTROLLER_SERVICE,
      sandbox: SANDBOX_SERVICE,
      mcp: MCP_SERVICE,
      subagents: SUBAGENTS_SERVICE,
      sessionStoreController: SESSION_STORE_CONTROLLER_SERVICE,
      toolPolicy: TOOL_POLICY_SERVICE,
      collaborationWaiter: COLLABORATION_WAITER_SERVICE,
      providerModelController: PROVIDER_MODEL_CONTROLLER_SERVICE,
      taskWorkflowController: TASK_WORKFLOW_CONTROLLER_SERVICE,
    },
    pluginIDs: {
      sandboxController: SANDBOX_CONTROLLER_PLUGIN_ID,
      taskWorkflow: TASK_WORKFLOW_PLUGIN_ID,
      runtimeUi: RUNTIME_UI_PLUGIN_ID,
    },
  };
  const { initialize } = createInitialize(ctx, options);
  ctx.ports.initialize = initialize;

  /**
   * Publishes the loaded capability catalogue into the durable journal. Every
   * capability the kernel holds — built-in tool families, controllers,
   * workspace services and plugins alike — is a real capability and belongs in
   * the journal, so a consumer projection sees what is loaded. Published after
   * the session exists, so the events land in the session's history.
   */

  async function drainSession(signal: AbortSignal) {
    await turnController.drain(signal, sessionID);
  }

  // --- Live Work Chat (P8 C2) ---
  // A long-lived, always-available read-only collaborator. It shares the safe
  // project/execution context (the same durable state the main agent reads),
  // answers anytime, drafts plans and sends user-confirmed mailbox intents.
  // Its only writes are the two surfaces the plan grants it — plan drafts and
  // mailbox messages — never files, shells, PTY, sandboxes, checkpoints or
  // approvals.

  const CHAT_WRITE_TOOLS = new Set([
    "mailbox_send",
    "plan_create",
    "plan_update",
    "plan_propose",
  ]);

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
