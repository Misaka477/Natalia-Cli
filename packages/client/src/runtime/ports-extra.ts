/**
 * RuntimePortsExtra — the overflow of the cross-module runtime ports.
 *
 * Split out of `ports.ts` to stay within the source line limit; merged into the
 * `RuntimeContext.ports` type through an intersection in `context.ts`.
 */
import type { AgentDefinition, AgentRegistry } from "@natalia/agent";
import type { ConfigV3, RuntimeEvent, SessionID } from "@natalia/contracts";
import type {
  ContextWindowResolver,
  ProviderConcurrencyLimiter,
  StreamingProvider,
} from "@natalia/runtime";
import type { RuntimeContextStatusConfig } from "./status-config";
import type { SessionExecutionState } from "../real-runtime";

export type RuntimePortsExtra = {
  setLastSubmitted: (
    turn: import("@natalia/contracts").SubmittedTurn | undefined,
  ) => void;
  rememberTitleInput: (id: SessionID, text: string) => void;
  drainSessionFor: (
    sessionID: SessionID,
  ) => (signal: AbortSignal) => Promise<void>;
  setSessionID: (id: SessionID) => void;
  setSession: (session: import("@natalia/session").SessionRecord) => void;
  setRuntimeContext: (
    context: import("@natalia/runtime-services").RuntimeContextLedger,
  ) => void;
  setActiveExec: (exec: SessionExecutionState | undefined) => void;
  setAttachmentReferences: (
    refs: Map<string, import("@natalia/contracts").LocalAttachment[]>,
  ) => void;
  setToolCalls: (calls: Map<string, number>) => void;
  setPauseWaiters: (waiters: Array<() => void>) => void;
  setActiveSkill: (
    skill: import("@natalia/runtime-services").SkillMetadata | undefined,
  ) => void;
  setLastProviderUsage: (
    usage: { inputTokens: number; outputTokens: number } | undefined,
  ) => void;
  clearRuntimeDiagnostics: () => void;
  getRuntimeDiagnosticsBySession: () => Map<
    SessionID,
    Array<Extract<RuntimeEvent, { type: "diagnostic" }> & { at: string }>
  >;
  getRuntimeDiagnostics: () => Array<
    Extract<RuntimeEvent, { type: "diagnostic" }> & { at: string }
  >;
  getPerformanceTrace: () => import("../performance-trace").RuntimePerformanceTrace;
  getNativeRuntimeID: () => string;
  getUserRuntimeHome: () => string | undefined;
  getUserSkillRoot: () => string | undefined;
  extensionEnabled: (
    extension: "skills" | "mcp" | "plugins",
    profile?: ConfigV3["permissionProfiles"][string],
  ) => boolean;
  hotReloadToolFamily: (familyID: string) => Promise<{ reloaded: boolean }>;
  setProviderSource: (
    source: "explicit" | "environment" | "ts_config" | "unconfigured",
  ) => void;
  providerFromEnvironment: () =>
    | import("@natalia/runtime").StreamingProvider
    | undefined;
  runChatTurnBody: (
    input: {
      text: string;
      responseMessageID: string;
      exec: SessionExecutionState;
      internal?: boolean;
    },
    signal: AbortSignal,
  ) => Promise<{ text: string }>;
  wakeNavi: (exec: SessionExecutionState) => Promise<void>;
  getBuiltinPluginIDs: () => Set<string>;
  isBuiltinToolPlugin: (id: string) => boolean;
  isStaticBuiltinPlugin: (id: string) => boolean;
  setTsRuntimeConfig: (config: ConfigV3 | undefined) => void;
  setMaxSteps: (steps: number | undefined) => void;
  setRetryPolicy: (
    policy: import("@natalia/runtime").RetryRunnerOptions["policy"],
  ) => void;
  setProviderConcurrencyLimiter: (limiter: ProviderConcurrencyLimiter) => void;
  setAgentRegistry: (registry: AgentRegistry) => void;
  setBuiltinPluginIDs: (ids: Set<string>) => void;
  getPluginsController: () => ReturnType<
    typeof import("../plugins-controller").createPluginsController
  >;
  setActiveExternalPluginConfigFingerprint: (
    fingerprint: string | undefined,
  ) => void;
  buildBuiltinPluginCatalog: (config: ConfigV3) => unknown[];
  refreshBuiltinServices: (
    selectedSkills?: Map<SessionID, string>,
  ) => Promise<void>;
  publishToolCatalogChanges: (before: Set<string>) => void;
  externalPluginConfigFingerprint: (config: ConfigV3) => string;
  getActiveExternalPluginConfigFingerprint: () => string | undefined;
  reloadPermissionSettings: (config: ConfigV3) => void;
  resolveContextStatusConfig: (
    config: ConfigV3,
    provider: StreamingProvider | undefined,
    resolver: ContextWindowResolver,
    selectedRef?: string,
  ) => Promise<RuntimeContextStatusConfig>;
  modelRefKeyForSelection: (
    agent: import("@natalia/agent").AgentDefinition | undefined,
    model: { modelID?: string; variant?: string } | undefined,
  ) => string | undefined;
  configReloadBlockedReason: () => string | undefined;
  setWorkspaceWriteLock: (
    lock: import("@natalia/runtime-services").WorkspaceWriteLock | undefined,
  ) => void;
  setMutationRegistry: (
    registry: import("@natalia/runtime-services").MutationRegistry | undefined,
  ) => void;
  setWorkspaceFilesController: (
    controller:
      | import("@natalia/runtime-services").WorkspaceFilesController
      | undefined,
  ) => void;
  setTerminalController: (
    controller:
      | import("@natalia/runtime-services").TerminalController
      | undefined,
  ) => void;
  setSandboxController: (
    controller: import("@natalia/runtime-services").SandboxService | undefined,
  ) => void;
  setMcpService: (
    service: import("@natalia/runtime-services").McpService | undefined,
  ) => void;
  setSubagentsController: (
    controller:
      | import("@natalia/runtime-services").SubagentsService
      | undefined,
  ) => void;
  setProviderModelController: (
    controller:
      | import("@natalia/runtime-services").ProviderModelController
      | undefined,
  ) => void;
  setTaskWorkflowController: (
    controller:
      | import("@natalia/runtime-services").TaskWorkflowController
      | undefined,
  ) => void;
  setCompactionService: (
    service: import("@natalia/runtime-services").CompactionService | undefined,
  ) => void;
  setSessionStoreController: (
    controller: import("@natalia/runtime-services").SessionStoreController,
  ) => void;
  setToolPolicyService: (
    service: import("@natalia/runtime-services").ToolPolicyService | undefined,
  ) => void;
  setInteractive: (
    waiter: import("@natalia/runtime-services").InteractiveWaiter,
  ) => void;
  setAttachmentService: (
    service: import("@natalia/runtime-services").AttachmentService,
  ) => void;
  setRetryService: (
    service: import("@natalia/runtime-services").RetryService,
  ) => void;
  setContextLedgerFactory: (
    factory: import("@natalia/runtime-services").ContextLedgerFactory,
  ) => void;
  setStatusController: (
    controller: import("@natalia/runtime-services").StatusSnapshotController,
  ) => void;
  setWorkLedgerController: (
    controller: import("@natalia/runtime-services").WorkLedgerController,
  ) => void;
  setGovernanceLedgerController: (
    controller: import("@natalia/runtime-services").GovernanceLedgerController,
  ) => void;
  setTurnController: (
    controller: import("@natalia/runtime-services").TurnController,
  ) => void;
  setActiveCheckpointFactory: (
    factory: import("@natalia/runtime-services").CheckpointFactory | undefined,
  ) => void;
  getActiveCheckpointFactory: () =>
    | import("@natalia/runtime-services").CheckpointFactory
    | undefined;
  toolSettings: (exec?: SessionExecutionState) => Record<string, unknown>;
  authorizeWorkspaceRead: (
    input: { toolName: string; paths: string[] },
    exec?: SessionExecutionState,
  ) => Promise<void>;
  authorizeSandboxMerge: (
    input: { id: string; paths: string[] },
    exec?: SessionExecutionState,
  ) => Promise<void>;
  authorizeSandboxManagement: (
    toolName: "sandbox_merge" | "sandbox_delete" | "sandbox_resource_stop",
    arguments_: Record<string, string>,
    exec: SessionExecutionState,
  ) => Promise<void>;
  getTerminalController: () =>
    | import("@natalia/runtime-services").TerminalController
    | undefined;
  getInteractive: () => import("@natalia/runtime-services").InteractiveWaiter;
  getMutationRegistry: () =>
    | import("@natalia/runtime-services").MutationRegistry
    | undefined;
  getTerminalCommandBuffer: () => import("@natalia/tools").TerminalCommandBuffer;
  getSandboxResourcesByID: () => Map<string, number>;
  getEndTurnWaitingHuman: () =>
    | { terminalID: string; reason: string }
    | undefined;
  setEndTurnWaitingHuman: (marker: {
    terminalID: string;
    reason: string;
  }) => void;
  redactToolOutputEnabled: (exec?: SessionExecutionState) => boolean;
  waitForToolExecution: <T>(
    execution: Promise<T>,
    signal?: AbortSignal,
  ) => Promise<T>;
  boundToolOutput: (
    workspaceRoot: string,
    text: string,
  ) => Promise<{ text: string; outputPath?: string }>;
  isManagedResourceTool: (toolName: string) => boolean;
  tryParseToolArguments: (arguments_: string) => unknown;
  parseToolArguments: (arguments_: string) => unknown;
  validateToolParameters: (
    schema: import("@natalia/tools").ToolSchema,
    input: unknown,
  ) => Array<{ path: string; message: string }>;
};
