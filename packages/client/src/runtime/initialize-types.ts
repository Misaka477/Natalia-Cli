import type { AgentDefinition, AgentRegistry } from "@natalia/agent";
import type { CapabilityRegistryHost } from "@natalia/capability";
import type { ConfigV3, RuntimeEvent, SessionID } from "@natalia/contracts";
import type { ProviderToolCall, StreamingProvider } from "@natalia/runtime";
import type {
  InteractiveWaiterDeps,
  RuntimeContextLedger,
} from "@natalia/runtime-services";
import type {
  PermissionProfileCommandRules,
  RuntimeTool,
  SubagentRunnerContext,
  TerminalCommandBuffer,
} from "@natalia/tools";
import type { SessionExecutionState } from "./session-execution-state";

export type InitializeOptions = {
  sessionID?: SessionID;
  title?: string;
  globalConfigPath?: string;
  sessionDir?: string;
  useSqliteStore?: boolean;
  provider?: StreamingProvider;
  tools?: import("@natalia/tools").ToolRegistry;
  permissionProfile?: string;
  toolPolicy?: import("@natalia/tools").ToolPolicy;
  hooks?: import("@natalia/tools").ToolHooks;
  taskModuleContext?: import("@natalia/workflow").TaskModuleContext;
};

type ResolvedConfig = Awaited<
  ReturnType<typeof import("@natalia/config").resolveConfig>
>;
type BuiltinCatalog = ReturnType<
  typeof import("@natalia/builtin-plugins").builtinPluginCatalog
>;
type BuiltinInput = Parameters<
  typeof import("@natalia/builtin-plugins").builtinPluginCatalog
>[0];

export type InitializeDependencies = {
  resolveConfig: typeof import("@natalia/config").resolveConfig;
  reloadPermissionSettings: (config: ConfigV3) => void;
  skillsPluginInput: (config: ConfigV3) => BuiltinInput["skills"];
  localToolsPluginInput: (config: ConfigV3) => BuiltinInput["localTools"];
  workspacePluginInput: (config: ConfigV3) => BuiltinInput["workspace"];
  terminalPluginInput: (config: ConfigV3) => BuiltinInput["terminal"];
  sandboxPluginInput: (config: ConfigV3) => BuiltinInput["sandbox"];
  mcpPluginInput: (config: ConfigV3) => BuiltinInput["mcp"];
  compactionPluginInput: (config: ConfigV3) => BuiltinInput["compaction"];
  providerModelPluginInput: (config: ConfigV3) => BuiltinInput["providerModel"];
  builtinPluginCatalog: typeof import("@natalia/builtin-plugins").builtinPluginCatalog;
  computeBuiltinFeatureGates: typeof import("@natalia/builtin-plugins").computeBuiltinFeatureGates;
  capabilityRegistry: CapabilityRegistryHost;
  workspaceCapabilityView?: import("@natalia/capability").CapabilityRegistryView;
  waiterDeps: InteractiveWaiterDeps;
  deliverQueuedMailboxAtBoundary: (exec?: SessionExecutionState) => void;
  effectiveFlowPermissions: typeof import("@natalia/workflow").effectiveFlowPermissions;
  createRealRuntimeClient: NonNullable<
    BuiltinInput["taskWorkflow"]
  >["controller"]["createRuntimeClient"];
  handleCommand: (
    id: string,
    text: string,
    signal: AbortSignal | undefined,
    exec: SessionExecutionState,
  ) => Promise<boolean>;
  scheduleTitleGeneration: (sessionID: SessionID) => void;
  mountRuntimePlugins: typeof import("../builtin-mount").mountRuntimePlugins;
  moduleToolPolicy: typeof import("@natalia/workflow").moduleToolPolicy;
  agentPolicyLayer: (
    agent?: AgentDefinition,
  ) => import("@natalia/runtime-services").ToolPolicyHookLayer;
  permissionProfileLayer: (
    profile?: ConfigV3["permissionProfiles"][string],
  ) => import("@natalia/runtime-services").ToolPolicyHookLayer;
  terminalCommandBuffer: TerminalCommandBuffer;
  evaluatePermissionProfileCommandRules: (
    rules: PermissionProfileCommandRules | undefined,
    toolName: string,
    args: Record<string, unknown>,
    source?: string,
  ) => Promise<{ allowed: boolean; diagnostics: string[] }>;
  ensureBashCommandParser: () => Promise<unknown>;
  agentsFromConfig: (config: ConfigV3) => AgentRegistry;
  providerForModel: typeof import("@natalia/runtime").providerForModel;
  sessionSeed: (workspaceRoot: string) => string;
  createHash: typeof import("node:crypto").createHash;
  lineCount: (text: string) => number;
  contextEntriesToProviderMessages: typeof import("@natalia/runtime").contextEntriesToProviderMessages;
  withProviderConcurrency: typeof import("@natalia/runtime").withProviderConcurrency;
  requireNativeToolCallProtocol: typeof import("@natalia/runtime").requireNativeToolCallProtocol;
  normalizeRawToolCallProtocol: typeof import("@natalia/runtime").normalizeRawToolCallProtocol;
  nativeToolCallCorrection: typeof import("@natalia/runtime").nativeToolCallCorrection;
  MAX_PROTOCOL_CORRECTIONS: number;
  WAITING_TOOLS: ReadonlySet<string>;
  readOnlyToolMessage: (toolName: string) => string;
  cleanupToolOutput: typeof import("@natalia/tools").cleanupToolOutput;
  settleInterruptedTurnIDs: typeof import("@natalia/session").settleInterruptedTurnIDs;
  settleInterruptedTurns: typeof import("@natalia/session").settleInterruptedTurns;
  projectSession: typeof import("@natalia/session").projectSession;
  modelVisibleEvents: typeof import("@natalia/session").modelVisibleEvents;
  turnCoordinator: () => ReturnType<
    typeof import("@natalia/session").sessionRunCoordinator
  >;
  drainSession: (signal: AbortSignal) => Promise<void>;
  projectedMailboxMessages: typeof import("@natalia/session").projectedMailboxMessages;
  buildMailboxStatus: typeof import("@natalia/runtime-services").buildMailboxStatus;
  createMailboxAcknowledgeTool: typeof import("@natalia/runtime-services").createMailboxAcknowledgeTool;
  projectedCollabMessages: typeof import("@natalia/session").projectedCollabMessages;
  projectInteractiveRequests: typeof import("@natalia/session").projectInteractiveRequests;
  contextStatusEvent: typeof import("@natalia/runtime").contextStatusEvent;
  publishBuiltinCapabilities: () => void;
  publishRegisteredTools: () => void;
  MAX_STEPS_PROMPT: string;
  MISSING_FINAL_RESPONSE_FALLBACK: string;
  ProviderConcurrencyLimiter: typeof import("@natalia/runtime").ProviderConcurrencyLimiter;
  serviceNames: {
    attachment: string;
    retry: string;
    contextLedgerFactory: string;
    compaction: string;
    statusSnapshotController: string;
    workLedgerController: string;
    governanceLedgerController: string;
    turnController: string;
    checkpointFactory: string;
    workspaceWriteLock: string;
    workspaceMutations: string;
    workspaceFiles: string;
    terminalController: string;
    sandbox: string;
    mcp: string;
    subagents: string;
    sessionStoreController: string;
    toolPolicy: string;
    collaborationWaiter: string;
    providerModelController: string;
    taskWorkflowController: string;
  };
  pluginIDs: {
    sandboxController: string;
    taskWorkflow: string;
    runtimeUi: string;
  };
};

export type InitializeCatalogResult = {
  runtimeConfig: ConfigV3;
  tsConfig: ResolvedConfig;
};

export type SubagentSupport = {
  acquireSandboxedSubagentSlot(signal: AbortSignal): Promise<void>;
  releaseSandboxedSubagentSlot(): void;
  publishSubagentEvent(
    runner: SubagentRunnerContext,
    event: RuntimeEvent,
  ): void;
  subagentTurnID(runner: SubagentRunnerContext): string;
  beginSubagentConversation(runner: SubagentRunnerContext, task: string): void;
  finishSubagentConversation(
    runner: SubagentRunnerContext,
    reason: "done" | "cancelled" | "error",
  ): void;
  createSubagentContext(system: string, task: string): RuntimeContextLedger;
  runSubagentProviderStep(
    ledger: RuntimeContextLedger,
    tools: RuntimeTool[],
    runner: SubagentRunnerContext,
    step: number,
    provider: StreamingProvider,
    contextConfig: { max: number; thresholdPercent: number; reserved: number },
    allowToolCalls?: boolean,
  ): Promise<{
    output: string;
    thinking: string;
    calls: ProviderToolCall[];
    protocolViolation: string;
  }>;
  appendSubagentAssistant(
    ledger: RuntimeContextLedger,
    runner: SubagentRunnerContext,
    step: number,
    output: string,
    calls: ProviderToolCall[],
  ): void;
  appendSubagentToolResult(
    ledger: RuntimeContextLedger,
    runner: SubagentRunnerContext,
    step: number,
    call: ProviderToolCall,
    content: string,
  ): void;
};

export type BuiltinPluginCatalog = BuiltinCatalog;
