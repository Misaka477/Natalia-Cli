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
import { createClientSurface } from "./runtime/client-surface";
import { redactToolOutput } from "./runtime/client-surface/helpers";
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
  ctx.ports.setDisposed = (disposed) => {
    runtimeDisposed = disposed;
  };
  ctx.ports.getSessionStoreController = () => sessionStoreController;
  ctx.ports.getSession = () => session;
  ctx.ports.getReplayMode = () => replayMode;
  ctx.ports.setReplayMode = (mode) => {
    replayMode = mode;
  };
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
  ctx.ports.nextDecisionSequence = () => decisionSequence++;
  ctx.ports.nextEvidenceSequence = () => evidenceSequence++;
  ctx.ports.nextCompletionSequence = () => completionSequence++;
  ctx.ports.getProviderModelController = () => providerModelController;
  ctx.ports.nextChatSequence = () => chatSequence++;
  ctx.state.internalWakeTasks = internalWakeTasks;
  ctx.ports.getInternalWakeTasks = () => internalWakeTasks;
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
  ctx.ports.setSink = (next) => {
    sink = next;
  };
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
  ctx.ports.createPlanDraftForClient = (input) => createPlanDraft(input);
  ctx.ports.enqueueMailboxForClient = (input) => enqueueMailboxMessage(input);
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
  ctx.ports.attachSession = attachSession;
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
  ctx.ports.selectedModelRefKey = selectedModelRefKey;
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
  ctx.ports.cancelTitleGeneration = cancelTitleGeneration;
  ctx.ports.rememberTitleInput = rememberTitleInput;
  const sessionAdmission = createSessionAdmission(ctx, options);
  const { submitInput } = sessionAdmission;
  ctx.ports.submitInput = submitInput;
  const { isPendingInteractiveRequest, handleCommand, commandCatalogEntries } =
    createCommands(ctx);
  ctx.ports.commandCatalogEntries = commandCatalogEntries;
  ctx.ports.requireTaskWorkflow = requireTaskWorkflow;

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
  ctx.ports.ensureReady = ensureReady;
  ctx.ports.applyConfigFromDisk = applyConfigFromDisk;

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

  return createClientSurface(ctx, options);
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
