import type { AgentDefinition, AgentRegistry } from "@natalia/agent";
import type { CapabilityRegistryHost } from "@natalia/capability";
import type { ConfigV3, RuntimeEvent, SessionID } from "@natalia/contracts";
import type {
  ContextEntry,
  ProviderToolCall,
  StreamingProvider,
} from "@natalia/runtime";
import type {
  InteractiveWaiterDeps,
  RuntimeContextLedger,
  ServiceDirectory,
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
  checkpointDir?: string;
  useSqliteStore?: boolean;
  nativeTerminal?: import("@natalia/runtime-services").TerminalControllerInput["external"];
  provider?: StreamingProvider;
  tools?: import("@natalia/tools").ToolRegistry;
  permissionProfile?: string;
  toolPolicy?: import("@natalia/tools").ToolPolicy;
  hooks?: import("@natalia/tools").ToolHooks;
};

type ResolvedConfig = Awaited<
  ReturnType<typeof import("@natalia/config").resolveConfig>
>;
export type InitializeDependencies = {
  resolveConfig: typeof import("@natalia/config").resolveConfig;
  reloadPermissionSettings: (config: ConfigV3) => void;
  skillsPluginInput: (
    config: ConfigV3,
  ) => import("@natalia/runtime-services").SkillsInput | undefined;
  localToolsPluginInput: (
    config: ConfigV3,
  ) => import("@natalia/runtime-services").LocalToolsInput | undefined;
  mcpPluginInput: (
    config: ConfigV3,
  ) => import("@natalia/runtime-services").McpInput | undefined;
  providerModelPluginInput: () => import("@natalia/runtime-services").ProviderModelControllerInput;
  wireFrameworkServices: (
    ctx: import("./context").RuntimeContext,
    options: InitializeOptions,
  ) => Promise<import("./context").FrameworkServices>;
  capabilityRegistry: CapabilityRegistryHost;
  /** Typed service resolution shared with `ctx.state.serviceDirectory`. */
  serviceDirectory: ServiceDirectory;
  workspaceCapabilityView?: import("@natalia/capability").CapabilityRegistryView;
  waiterDeps: InteractiveWaiterDeps;
  deliverQueuedMailboxAtBoundary: (exec?: SessionExecutionState) => void;
  createRealRuntimeClient: (
    options: import("./options").RealRuntimeClientOptions,
  ) => import("@natalia/contracts").RuntimeClient;
  handleCommand: (
    id: string,
    text: string,
    signal: AbortSignal | undefined,
    exec: SessionExecutionState,
  ) => Promise<boolean>;
  scheduleTitleGeneration: (sessionID: SessionID) => void;
  mountPlugins: typeof import("../plugin-mount").mountPlugins;
  agentPolicyLayer: (
    agent?: AgentDefinition,
  ) => import("@natalia/runtime-services").ToolPolicyHookLayer;
  permissionProfileLayer: (
    profile?: import("@natalia/contracts").PermissionProfile,
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
  projectInteractiveRequests: typeof import("@natalia/session").projectInteractiveRequests;
  contextStatusEvent: typeof import("@natalia/runtime").contextStatusEvent;
  publishRuntimeCapabilities: () => void;
  publishRegisteredTools: () => void;
  MAX_STEPS_PROMPT: string;
  MISSING_FINAL_RESPONSE_FALLBACK: string;
  ProviderConcurrencyLimiter: typeof import("@natalia/runtime").ProviderConcurrencyLimiter;
  serviceNames: {
    workLedgerController: string;
    sessionStoreController: string;
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
  /** Register the ledger a subagent's current run is writing to. */
  registerSubagentLedger(
    agentId: string,
    ledger: RuntimeContextLedger,
  ): RuntimeContextLedger;
  /** Drop a subagent's live ledger, when its run ends. */
  unregisterSubagentLedger(agentId: string): void;
  /** Queue a parent message for a subagent with no live runner. */
  queueSubagentMessage(agentId: string, message: string): boolean;
  /** How many subagents currently hold a live ledger. */
  liveSubagentLedgerCount(): number;
  createSubagentContext(
    system: string,
    task: string,
    planPointer?: { planID: string; documentPath: string; version: number },
    forkSeed?: { entries: readonly ContextEntry[] },
  ): RuntimeContextLedger;
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
