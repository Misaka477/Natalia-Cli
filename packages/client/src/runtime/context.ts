/**
 * RuntimeContext — the single shared port between every runtime module.
 *
 * Architecture convergence plan §3.1: modules under `packages/client/src/runtime/`
 * receive the same `RuntimeContext` and may communicate with each other only
 * through it. They never import one another's implementations.
 *
 * `state` holds every mutable value the runtime shares; `ports` holds every
 * cross-module function. Modules read what they need at call time (destructured
 * at the top of each function), so construction order never matters.
 */
import type { createPluginsController } from "../plugins-controller";
import type { ToolRegistry } from "@natalia/tools";
import type {
  CapabilityHost,
  CapabilityRegistryHost,
} from "@natalia/capability";
import type { AgentDefinition, AgentRegistry } from "@natalia/agent";
import type {
  RuntimeClient,
  RuntimeEvent,
  SessionID,
  SubmittedTurn,
  ConfigV3,
  ModelCapabilities,
  LocalAttachment,
} from "@natalia/contracts";
import type { SessionRecord } from "@natalia/session";
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
  ProviderModelController,
  ProviderRunnerInput,
  RetryService,
  RuntimeContextLedger,
  RuntimeServiceClient,
  SandboxService,
  SessionStoreController,
  SkillMetadata,
  SkillService,
  StatusSnapshotController,
  SubagentsService,
  TeamBehaviorService,
  TaskWorkflowController,
  TerminalController,
  ToolPolicyHookLayer,
  ToolPolicyService,
  TurnController,
  WorkLedgerController,
  WorkspaceFilesController,
  WorkspaceWriteLock,
} from "@natalia/runtime-services";
import type {
  ContextWindowResolver,
  ProviderConcurrencyLimiter,
  StreamingProvider,
} from "@natalia/runtime";
import type {
  TerminalCommandBuffer,
  ToolRegistry as ToolRegistryType,
} from "@natalia/tools";
import type { RuntimePerformanceTrace } from "../performance-trace";
import type { SessionExecutionState } from "../real-runtime";

type PermissionProfile = ConfigV3["permissionProfiles"][string];
type RuntimeDiagnostic = Extract<RuntimeEvent, { type: "diagnostic" }> & {
  at: string;
};

/**
 * Every mutable and shared value the runtime carries. The composition root
 * (`runtime/main.ts`) creates this once; modules read it through `ctx.state`.
 */
export type RuntimeState = {
  workspaceRoot: string;
  sessionID: SessionID;
  sessionStoreController: SessionStoreController;
  provider?: StreamingProvider;
  providerSource: "explicit" | "environment" | "ts_config" | "unconfigured";
  capabilityRegistry: CapabilityRegistryHost;
  capabilityHost?: CapabilityHost;
  workspaceCapabilityView?:
    | import("@natalia/capability").CapabilityRegistryView
    | undefined;
  tools: ToolRegistryType;
  toolPolicy?: ToolPolicyService;
  agentToolLayer: ToolPolicyHookLayer;
  permissionProfileToolLayer: ToolPolicyHookLayer;
  moduleToolLayer: ToolPolicyHookLayer;
  modulePermissionToolLayer: ToolPolicyHookLayer;
  toolLayer: ToolPolicyHookLayer;
  terminalCommandBuffer: TerminalCommandBuffer;
  permissionMode: "ask" | "auto" | "read_only";
  selectedPermissionProfile?: PermissionProfile;
  defaultPermissionMode: "ask" | "auto" | "read_only";
  defaultPermissionProfile?: PermissionProfile;
  maxSteps?: number;
  subagentsController?: SubagentsService;
  providerModelController?: ProviderModelController;
  taskWorkflowController?: TaskWorkflowController;
  contextLedgerFactory: ContextLedgerFactory;
  workLedgerController: WorkLedgerController;
  governanceLedgerController: GovernanceLedgerController;
  turnController: TurnController;
  terminalController?: TerminalController;
  sandboxController?: SandboxService;
  mcpService?: McpService;
  pluginsController: ReturnType<typeof createPluginsController>;
  toolCalls: Map<string, number>;
  runtimeContext: RuntimeContextLedger;
  waiterDeps: InteractiveWaiterDeps;
  interactive: InteractiveWaiter;
  sink?: (event: RuntimeEvent) => void;
  replayMode: "all" | "none";
  session?: SessionRecord;
  lastSubmitted?: SubmittedTurn;
  activeAbort?: AbortController;
  activeTurnID?: string;
  endTurnWaitingHuman?: { terminalID: string; reason: string };
  turnSession: Map<string, SessionID>;
  liveMainOutputByTurn: Map<string, string>;
  turnAgent: Map<string, string>;
  executionBySession: Map<SessionID, SessionExecutionState>;
  activeExec?: SessionExecutionState;
  checkpointControllerBySession: Map<SessionID, CheckpointController>;
  checkpointInitBySession: Map<SessionID, Promise<void>>;
  activeCheckpointFactory?: CheckpointFactory;
  workspaceWriteLock?: WorkspaceWriteLock;
  mutationRegistry?: MutationRegistry;
  workspaceFilesController?: WorkspaceFilesController;
  paused: boolean;
  pauseWaiters: Array<() => void>;
  ready?: Promise<void>;
  activeSkill?: SkillMetadata;
  attachmentReferences: Map<string, LocalAttachment[]>;
  runtimeDiagnosticsBySession: Map<SessionID, RuntimeDiagnostic[]>;
  runtimeDiagnostics: RuntimeDiagnostic[];
  selectedAgent?: AgentDefinition;
  selectedModel?: { modelID?: string; variant?: string };
  pendingAgent?: AgentDefinition;
  agentRegistry?: AgentRegistry;
  lastProviderUsage?: { inputTokens: number; outputTokens: number };
  sessionPersistence: Promise<void>;
  nativeRuntimeID: string;
  tsRuntimeConfig?: ConfigV3;
  activeExternalPluginConfigFingerprint?: string;
  builtinPluginIDs: Set<string>;
  buildBuiltinPluginCatalog: (config: ConfigV3) => unknown[];
  contextWindowResolver: ContextWindowResolver;
  runtimeContextConfig: RuntimeContextStatusConfig;
  retryPolicy: import("@natalia/runtime").RetryRunnerOptions["policy"];
  retryService: RetryService;
  attachmentService: AttachmentService;
  compactionService?: CompactionService;
  providerConcurrencyLimiter: ProviderConcurrencyLimiter;
  statusController: StatusSnapshotController;
  terminalStatusByID: Map<string, string>;
  performanceTrace: RuntimePerformanceTrace;
  sandboxResourcesByID: Map<string, number>;
  activeToolByTurn: Map<string, string>;
  sessionSnapshotSequence: number;
  decisionSequence: number;
  evidenceSequence: number;
  mailboxSequence: number;
  chatSequence: number;
  collabSequence: number;
  internalWakeTasks: Set<Promise<unknown>>;
  planSequence: number;
  completionSequence: number;
  /** Title generation owned state (title-generation module). */
  titleGenerationTasks: Map<
    SessionID,
    {
      input: string;
      timer?: ReturnType<typeof setTimeout>;
      controller?: AbortController;
      promise?: Promise<void>;
    }
  >;
};

/**
 * Every cross-module function. The composition root assigns each as its owning
 * module is created; modules read them at call time so cycles are fine.
 */
export type RuntimePorts = {
  publish: (event: RuntimeEvent) => void;
  publishForSession: (
    exec: SessionExecutionState | undefined,
    event: RuntimeEvent,
  ) => void;
  scheduleRuntimeStatusSnapshot: () => void;
  runtimeStatusSnapshot: () => Promise<unknown>;
  ensureExecution: (id: SessionID) => Promise<SessionExecutionState>;
  commandCatalogEntries: () => import("@natalia/plugin").PluginCommand[];
  skillService: () => SkillService | undefined;
  skillsList: () => SkillMetadata[];
  teamBehavior: () => TeamBehaviorService | undefined;
  providerRunnerInput: (sessionID: SessionID) => ProviderRunnerInput;
  setInFlightOperation: (
    operation: import("@natalia/session").DurableInFlightOperation | undefined,
  ) => Promise<void>;
  isDisposed: () => boolean;
  getSessionStoreController: () => SessionStoreController;
  getSessionPersistence: () => Promise<void>;
  setSessionPersistence: (next: Promise<void>) => void;
  redactToolOutput: (output: string, redact: boolean | undefined) => string;
  getSink: () => ((event: RuntimeEvent) => void) | undefined;
  setPendingHumanTerminal: (
    forSessionID: SessionID,
    input: { terminalID: string; reason: string },
  ) => Promise<void>;
  maybeContinueAfterHumanInput: (
    terminalID: string,
    forSessionID?: SessionID,
  ) => Promise<void>;
  settleMailboxAtBoundary: (exec?: SessionExecutionState) => void;
  activateQueuedPlanAtBoundary: (exec?: SessionExecutionState) => void;
  reconcileWorkspaceObservation: (
    exec?: SessionExecutionState,
  ) => Promise<unknown[]>;
  toolEventTurnID: (event: { id: string; callID?: string }) => string;
  isSessionSnapshotTrigger: (event: RuntimeEvent) => boolean;
  publishSessionSnapshot: (exec?: SessionExecutionState) => void;
  currentSessionSnapshot: (
    exec: SessionExecutionState,
    id: string,
  ) => Extract<RuntimeEvent, { type: "session.snapshot" }>;
  nextCollabSequence: () => number;
  wakeMainForCollaboration: (
    exec: SessionExecutionState,
    id: string,
    kind: string,
  ) => void;
  createCollabChatTool: (
    from: "live_chat" | "main_agent",
    exec: SessionExecutionState | undefined,
  ) => import("@natalia/tools").RuntimeTool;
  enqueueMailboxMessage: (
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
  ) => Promise<unknown>;
  createPlanDraft: (
    input: {
      title: string;
      objective: string;
      steps: Array<{ id: string; title: string }>;
      constraints?: string[];
      verification?: string[];
      riskNotes?: string[];
    },
    exec: SessionExecutionState | undefined,
  ) => Promise<unknown>;
  getProviderConcurrencyLimiter: () => ProviderConcurrencyLimiter;
  getExecutionBySession: () => Map<SessionID, SessionExecutionState>;
  getActiveExec: () => SessionExecutionState | undefined;
  getStatusController: () => StatusSnapshotController;
  getWorkspaceRoot: () => string;
  getWorkspaceFilesController: () => WorkspaceFilesController | undefined;
  nextMailboxSequence: () => number;
  getSandboxController: () => SandboxService | undefined;
  getAgentRegistry: () => AgentRegistry | undefined;
  setPaused: (paused: boolean) => void;
  getPaused: () => boolean;
  initializeCheckpointController: (
    exec: SessionExecutionState,
  ) => Promise<CheckpointController | undefined>;
  clientModelCatalog: () => Promise<
    Array<{ id: string; name: string; provider: string; variants: string[] }>
  >;
  selectRuntimeModel: (
    modelID: string,
    variant: string | undefined,
    exec?: SessionExecutionState,
  ) => Promise<void>;
  submitInput: (
    input: import("@natalia/contracts").SubmitInput & { internal?: boolean },
    forSessionID?: SessionID,
  ) => Promise<import("@natalia/contracts").SubmittedTurn>;
  applyAgentPolicy: () => void;
  applyAgentProvider: (exec: SessionExecutionState) => void;
  refreshExecutionContextConfig: (exec: SessionExecutionState) => Promise<void>;
  getCapabilityRegistry: () => CapabilityRegistryHost;
  getTsRuntimeConfig: () => ConfigV3 | undefined;
  getSubagentsController: () => SubagentsService | undefined;
  getWorkLedgerController: () => WorkLedgerController;
  getProviderModelController: () => ProviderModelController | undefined;
  nextChatSequence: () => number;
  nextPlanSequence: () => number;
  requestNaviWake: (exec: SessionExecutionState) => void;
  scheduleInternalWake: (
    exec: SessionExecutionState,
    input: import("@natalia/contracts").SubmitInput,
  ) => void;
  chatSystemPrompt: (exec?: SessionExecutionState) => string;
  chatTools: (
    exec?: SessionExecutionState,
  ) => import("@natalia/tools").RuntimeTool[];
  effectiveMaxSteps: (exec?: SessionExecutionState) => number;
  chatToolSummary: (
    toolName: string,
    args: Record<string, unknown>,
    result: string,
  ) => string;
  getSelectedAgent: () => AgentDefinition | undefined;
  getSelectedModel: () => { modelID?: string; variant?: string } | undefined;
  getProviderSource: () => RuntimeState["providerSource"];
  getMaxSteps: () => number | undefined;
  getReady: () => Promise<void> | undefined;
  getContextWindowResolver: () => ContextWindowResolver;
  setProvider: (provider: StreamingProvider | undefined) => void;
  setSelectedModel: (
    model: { modelID?: string; variant?: string } | undefined,
  ) => void;
  setRuntimeContextConfig: (config: RuntimeContextStatusConfig) => void;
  getRuntimeContextConfig: () => RuntimeContextStatusConfig;
  getTurnController: () => TurnController;
  getSessionID: () => SessionID;
  getContextLedgerFactory: () => ContextLedgerFactory;
  getProvider: () => StreamingProvider | undefined;
  getToolPolicy: () => ToolPolicyService | undefined;
  getToolLayer: () => ToolPolicyHookLayer;
  getAgentToolLayer: () => ToolPolicyHookLayer;
  getPermissionProfileToolLayer: () => ToolPolicyHookLayer;
  getModuleToolLayer: () => ToolPolicyHookLayer;
  getModulePermissionToolLayer: () => ToolPolicyHookLayer;
  setToolLayer: (layer: ToolPolicyHookLayer) => void;
  setAgentToolLayer: (layer: ToolPolicyHookLayer) => void;
  setPermissionProfileToolLayer: (layer: ToolPolicyHookLayer) => void;
  getPermissionMode: () => RuntimeState["permissionMode"];
  setPermissionMode: (mode: "ask" | "auto" | "read_only") => void;
  getSelectedPermissionProfile: () =>
    | ConfigV3["permissionProfiles"][string]
    | undefined;
  setSelectedPermissionProfile: (
    profile: ConfigV3["permissionProfiles"][string] | undefined,
  ) => void;
  getDefaultPermissionMode: () => "ask" | "auto" | "read_only";
  setDefaultPermissionMode: (mode: "ask" | "auto" | "read_only") => void;
  getDefaultPermissionProfile: () =>
    | ConfigV3["permissionProfiles"][string]
    | undefined;
  setDefaultPermissionProfile: (
    profile: ConfigV3["permissionProfiles"][string] | undefined,
  ) => void;
};

export type RuntimeContext = {
  state: RuntimeState;
  ports: RuntimePorts;
};

/** The resolved context window status carried by the runtime and each exec. */
export type RuntimeContextStatusConfig = {
  max: number;
  thresholdPercent: number;
  reserved: number;
};
