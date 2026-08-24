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
import type { RuntimeContextStatusConfig } from "./status-config";
import type { RuntimePorts } from "./ports";
import type { RuntimePortsExtra } from "./ports-extra";
import type { RuntimeInitializePorts } from "./ports-initialize";
import type { RuntimeClientSurfacePorts } from "./ports-client-surface";
import type { InitializeDependencies } from "./initialize-types";
export type {
  InitializeCatalogResult,
  InitializeOptions,
  SubagentSupport,
} from "./initialize-types";
export type { RuntimeEvent, SessionID } from "@natalia/contracts";
export type { ProviderToolCall, StreamingProvider } from "@natalia/runtime";
export type { RuntimeContextLedger } from "@natalia/runtime-services";
export type {
  RuntimeTool,
  SubagentRunnerContext,
  ToolHookEvent,
} from "@natalia/tools";
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
  CheckpointController,
  CheckpointFactory,
  InteractiveWaiter,
  InteractiveWaiterDeps,
  ProviderRunnerInput,
  RuntimeContextLedger,
  RuntimeServiceClient,
  SkillMetadata,
  SkillService,
  TeamBehaviorService,
} from "@natalia/runtime-services";
export type {
  AttachmentService,
  CheckpointFactory,
  CompactionService,
  ContextLedgerFactory,
  GovernanceLedgerController,
  InteractiveWaiter,
  McpService,
  MutationRegistry,
  ProviderModelController,
  RetryService,
  SandboxService,
  SessionStoreController,
  StatusSnapshotController,
  SubagentsService,
  TaskWorkflowController,
  TerminalController,
  ToolPolicyService,
  TurnController,
  WorkLedgerController,
  WorkspaceFilesController,
  WorkspaceWriteLock,
} from "@natalia/runtime-services";
export type { PermissionProfileCommandRules } from "@natalia/tools";
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
import type { SessionExecutionState } from "./session-execution-state";
export type { SessionExecutionState } from "./session-execution-state";

type PermissionProfile = ConfigV3["permissionProfiles"][string];
type RuntimeDiagnostic = Extract<RuntimeEvent, { type: "diagnostic" }> & {
  at: string;
};

/**
 * Every mutable and shared value the runtime carries. The composition root
 * (`runtime/main.ts`) creates this once; modules read it through `ctx.state`.
 */
export type RuntimeState = {
  runtimeDisposed: boolean;
  initialize: InitializeDependencies;
  workspaceRoot: string;
  sessionID: SessionID;
  provider?: StreamingProvider;
  providerSource: "explicit" | "environment" | "ts_config" | "unconfigured";
  capabilityRegistry: CapabilityRegistryHost;
  capabilityHost?: CapabilityHost;
  workspaceCapabilityView?:
    | import("@natalia/capability").CapabilityRegistryView
    | undefined;
  tools: ToolRegistryType;
  terminalCommandBuffer: TerminalCommandBuffer;
  permissionMode: "ask" | "auto" | "read_only";
  selectedPermissionProfile?: PermissionProfile;
  defaultPermissionMode: "ask" | "auto" | "read_only";
  defaultPermissionProfile?: PermissionProfile;
  maxSteps?: number;
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
  checkpointControllerBySession: Map<
    SessionID,
    { factory: CheckpointFactory; controller: CheckpointController }
  >;
  checkpointInitBySession: Map<
    SessionID,
    { factory: CheckpointFactory; promise: Promise<void> }
  >;
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
  buildBuiltinPluginCatalog: (config: ConfigV3) => unknown[];
  contextWindowResolver: ContextWindowResolver;
  runtimeContextConfig: RuntimeContextStatusConfig;
  retryPolicy: import("@natalia/runtime").RetryRunnerOptions["policy"];
  providerConcurrencyLimiter: ProviderConcurrencyLimiter;
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
export type RuntimeContext = {
  state: RuntimeState;
  ports: RuntimePorts &
    RuntimePortsExtra &
    RuntimeInitializePorts &
    RuntimeClientSurfacePorts;
};

/** The resolved context window status carried by the runtime and each exec. */
