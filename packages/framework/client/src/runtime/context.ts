/**
 * RuntimeContext — the single shared port between every runtime module.
 *
 * Architecture convergence plan §3.1: modules under `packages/framework/client/src/runtime/`
 * receive the same `RuntimeContext` and may communicate with each other only
 * through it. They never import one another's implementations.
 *
 * `state` holds every mutable value the runtime shares; `ports` holds every
 * cross-module function. Modules read what they need at call time (destructured
 * at the top of each function), so construction order never matters.
 */
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
import type { StatusSnapshotController } from "@natalia/runtime-status";
export type { StatusSnapshotController } from "@natalia/runtime-status";
export type {
  RuntimeTool,
  SubagentRunnerContext,
  ToolHookEvent,
} from "@natalia/tools";
import type {
  CapabilityHost,
  CapabilityRegistryHost,
} from "@natalia/capability";
import type { AgentDefinition, AgentRegistry } from "@natalia/agent";
import type {
  RuntimeEvent,
  SessionID,
  SubmittedTurn,
  ConfigV3,
  LocalAttachment,
} from "@natalia/contracts";
import type { SessionRecord } from "@natalia/session";
import type {
  InteractiveWaiterDeps,
  ServiceDirectory,
  SkillMetadata,
} from "@natalia/runtime-services";
export type {
  CheckpointFactory,
  ContextLedgerFactory,
  GovernanceLedgerController,
  InteractiveWaiter,
  McpService,
  SandboxService,
  SessionStoreController,
  SubagentsService,
  TerminalController,
  ToolPolicyService,
  TurnController,
  WorkLedgerController,
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
import type {
  AttachmentService,
  CompactionService,
  ProviderUsage,
  RetryService,
} from "@natalia/runtime";
import type { ProviderModelController } from "@natalia/provider-model";
import type {
  MutationRegistry,
  WorkspaceFilesController,
  WorkspaceWriteLock,
} from "@natalia/workspace";
export type {
  MutationRegistry,
  WorkspaceFilesController,
  WorkspaceWriteLock,
} from "@natalia/workspace";
export type { SessionExecutionState } from "./session-execution-state";

type PermissionProfile = import("@natalia/contracts").PermissionProfile;
type RuntimeDiagnostic = Extract<RuntimeEvent, { type: "diagnostic" }> & {
  at: string;
};

/**
 * The host-owned lifecycle of the framework subsystems wired by
 * `initialize/framework-services.ts`. `refreshRuntimeConfig` re-contributes the
 * config and plugin input services after a config reload; `close` releases the
 * framework resources at dispose.
 */
export type FrameworkServices = {
  refreshRuntimeConfig(): void;
  close(): void;
};

/**
 * Every mutable and shared value the runtime carries. The composition root
 * (`runtime/main.ts`) creates this once; modules read it through `ctx.state`.
 */
export type RuntimeState = {
  runtimeDisposed: boolean;
  initialize: InitializeDependencies;
  workspaceRoot: string;
  pluginStoreRoot?: string;
  sessionID: SessionID;
  provider?: StreamingProvider;
  /** Immutable host/test provider injection for the independent chat streams. */
  readonly chatDefaultProvider?: StreamingProvider;
  providerSource: "explicit" | "environment" | "ts_config" | "unconfigured";
  capabilityRegistry: CapabilityRegistryHost;
  /** Typed service resolution over the registry's service channel. */
  serviceDirectory: ServiceDirectory;
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
  toolCalls: Map<string, number[]>;
  waiterDeps: InteractiveWaiterDeps;
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
  /**
   * The latest provider usage sample. Typed by the shared `ProviderUsage`
   * rather than an inline `{inputTokens, outputTokens}`: a narrower local
   * declaration compiles while dropping the cache fields, and the loss only
   * shows up as an implausible hit rate.
   */
  lastProviderUsage?: ProviderUsage;
  sessionPersistence: Promise<void>;
  sessionPersistenceBySession: Map<SessionID, Promise<void>>;
  nativeRuntimeID: string;
  tsRuntimeConfig?: ConfigV3;
  frameworkServices?: FrameworkServices;
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
