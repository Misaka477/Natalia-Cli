/**
 * RuntimePorts — every cross-module function of the runtime.
 *
 * The composition root assigns each as its owning module is created; modules
 * read them at call time so construction order never matters. Defined in its
 * own file so `context.ts` stays within the source line limit.
 */
import type { AgentDefinition, AgentRegistry } from "@natalia/agent";
import type { CapabilityRegistryHost } from "@natalia/capability";
import type { ConfigV3, RuntimeEvent, SessionID } from "@natalia/contracts";
import type {
  ContextLedgerFactory,
  CheckpointController,
  ProviderModelController,
  ProviderRunnerInput,
  RuntimeContextLedger,
  SandboxService,
  SessionStoreController,
  SkillMetadata,
  SkillService,
  StatusSnapshotController,
  SubagentsService,
  TeamBehaviorService,
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
import type { RuntimeContextStatusConfig } from "./status-config";
import type { SessionExecutionState } from "./context";

export type RuntimePorts = {
  resolveService: <T>(serviceID: string) => T | undefined;
  publish: (event: RuntimeEvent) => void;
  publishForSession: (
    exec: SessionExecutionState | undefined,
    event: RuntimeEvent,
  ) => void;
  scheduleRuntimeStatusSnapshot: () => void;
  runtimeStatusSnapshot: () => Promise<
    Extract<RuntimeEvent, { type: "status.snapshot" }>
  >;
  ensureExecution: (id: SessionID) => Promise<SessionExecutionState>;
  commandCatalogEntries: () => import("@natalia/plugin").PluginCommand[];
  skillService: () => SkillService | undefined;
  skillsList: () => SkillMetadata[];
  teamBehavior: () => TeamBehaviorService | undefined;
  providerRunnerInput: (sessionID: SessionID) => ProviderRunnerInput;
  setInFlightOperation: (
    operation: import("@natalia/session").DurableInFlightOperation | undefined,
  ) => Promise<void>;
  setInFlightOperationFor: (
    exec: SessionExecutionState,
    operation: import("@natalia/session").DurableInFlightOperation | undefined,
  ) => Promise<void>;
  isDisposed: () => boolean;
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
  takeLiveUserMessages: (
    exec?: SessionExecutionState,
  ) => Array<{ source: "user" | "navi"; text: string }>;
  activateQueuedPlanAtBoundary: (exec?: SessionExecutionState) => void;
  reconcileWorkspaceObservation: (
    exec?: SessionExecutionState,
  ) => ReturnType<
    NonNullable<
      import("@natalia/contracts").RuntimeClient["confirmedWorkspaceChanges"]
    >
  >;
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
  cancelMailboxMessage: (
    messageID: string,
    reason?: string,
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
  executionForTurn: (turnID: string) => SessionExecutionState | undefined;
  getTurnSession: () => Map<string, SessionID>;
  getActiveExec: () => SessionExecutionState | undefined;
  getActiveTurnID: () => string | undefined;
  getPauseWaiters: () => Array<() => void>;
  getRuntimeContext: () => RuntimeContextLedger;
  currentModelImageInput: (exec?: SessionExecutionState) => boolean;
  currentModelPdfInput: (exec?: SessionExecutionState) => boolean;
  modelCapabilitiesForExecution: (
    exec: SessionExecutionState | undefined,
  ) => import("@natalia/contracts").ModelCapabilities;
  mediaTypeForImage: (
    path: string,
  ) => "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  publishWorkGraphToolCall: (
    turnID: string,
    callID: string,
    toolName: string,
    status: string,
  ) => void;
  executeOneTool: (
    turnID: string,
    call: import("@natalia/runtime").ProviderToolCall,
    tool: import("@natalia/tools").RuntimeTool,
    attachImage?: (path: string) => Promise<void>,
    attachPdf?: (path: string) => Promise<void>,
  ) => Promise<string>;
  executeToolCalls: (
    turnID: string,
    calls: import("@natalia/runtime").ProviderToolCall[],
    assistant: string,
    materialized: import("@natalia/tools").ToolMaterialization,
  ) => Promise<import("@natalia/runtime").ProviderMessage[]>;
  toolResultContent: (
    content: string,
    callID: string,
    moduleContext: unknown,
  ) => string;
  checkConstitutionForTool: (
    turnID: string,
    callID: string,
    toolName: string,
    toolAction: string,
    toolResource: string,
    commandText?: string,
  ) => string | undefined;
  isToolAllowed: (toolName: string, exec?: SessionExecutionState) => boolean;
  extensionToolPermission: (
    toolName: string,
    profile?: import("@natalia/contracts").PermissionProfile,
  ) => { allowed: boolean; diagnostics: string[] };
  getWorkspaceRoot: () => string;
  nextMailboxSequence: () => number;
  getWorkspaceWriteLock: () => WorkspaceWriteLock | undefined;
  getWorkspaceCapabilityView: () =>
    | import("@natalia/capability").CapabilityRegistryView
    | undefined;
  getTools: () => import("@natalia/tools").ToolRegistry;
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
    modelID: string | undefined,
    variant: string | undefined,
    exec?: SessionExecutionState,
  ) => Promise<void>;
  submitInput: (
    input: import("@natalia/contracts").SubmitInput & { internal?: boolean },
    forSessionID?: SessionID,
  ) => Promise<import("@natalia/contracts").SubmittedTurn>;
  applyAgentPolicy: () => void;
  applyAgentProvider: (exec?: SessionExecutionState) => void;
  refreshExecutionContextConfig: (exec: SessionExecutionState) => Promise<void>;
  getCapabilityRegistry: () => CapabilityRegistryHost;
  getTsRuntimeConfig: () => ConfigV3 | undefined;
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
  waitIfPaused: (exec?: SessionExecutionState) => Promise<void>;
  chatToolSummary: (
    toolName: string,
    args: Record<string, unknown>,
    result: string,
  ) => string;
  getSelectedAgent: () => AgentDefinition | undefined;
  getSelectedModel: () => { modelID?: string; variant?: string } | undefined;
  getProviderSource: () =>
    | "explicit"
    | "environment"
    | "ts_config"
    | "unconfigured";
  getMaxSteps: () => number | undefined;
  getReady: () => Promise<void> | undefined;
  getContextWindowResolver: () => ContextWindowResolver;
  setProvider: (provider: StreamingProvider | undefined) => void;
  setSelectedModel: (
    model: { modelID?: string; variant?: string } | undefined,
  ) => void;
  setRuntimeContextConfig: (config: RuntimeContextStatusConfig) => void;
  getRuntimeContextConfig: () => RuntimeContextStatusConfig;
  getSessionID: () => SessionID;
  getProvider: () => StreamingProvider | undefined;
  createToolPolicyLayer: (exec?: SessionExecutionState) => ToolPolicyHookLayer;
  getPermissionMode: () => "ask" | "auto" | "read_only";
  setPermissionMode: (mode: "ask" | "auto" | "read_only") => void;
  getSelectedPermissionProfile: () =>
    | import("@natalia/contracts").PermissionProfile
    | undefined;
  setSelectedPermissionProfile: (
    profile: import("@natalia/contracts").PermissionProfile | undefined,
  ) => void;
  getDefaultPermissionMode: () => "ask" | "auto" | "read_only";
  setDefaultPermissionMode: (mode: "ask" | "auto" | "read_only") => void;
  getDefaultPermissionProfile: () =>
    | import("@natalia/contracts").PermissionProfile
    | undefined;
  setDefaultPermissionProfile: (
    profile: import("@natalia/contracts").PermissionProfile | undefined,
  ) => void;
  setActiveAbort: (controller: AbortController | undefined) => void;
  setActiveTurnID: (id: string | undefined) => void;
  setSelectedAgent: (agent: AgentDefinition | undefined) => void;
  setPendingAgent: (agent: AgentDefinition | undefined) => void;
  persistInboxPromotion: (targetSessionID?: SessionID) => Promise<void>;
  reloadConfigFromDisk: () => Promise<{
    read: boolean;
    providerReconfigured: boolean;
    reason?: string;
  }>;
};
