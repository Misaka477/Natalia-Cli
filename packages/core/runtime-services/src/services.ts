import type { AgentDefinition, AgentRegistry } from "@natalia/agent";
import type {
  ApprovalResponse,
  CheckpointResourcePolicy,
  ConfigV3,
  ConfirmedWorkspaceChange,
  InteractiveResponseOutcome,
  LocalAttachment,
  MCPCatalogSnapshot,
  PromptAgentMention,
  PromptResourceMention,
  QuestionResponse,
  RuntimeClient,
  RuntimeEvent,
  RuntimeMessagePage,
  RuntimeNativeTerminalSession,
  RuntimeSessionSummary,
  SessionID,
  WorkspaceOperation,
  NataliaFlowDocument,
  NataliaTaskDocument,
} from "@natalia/contracts";
import type {
  CheckpointStore,
  ContextLedger,
  DurableContextCheckpoint,
  ProviderToolCall,
  ContextLedger as RuntimeContextLedgerInput,
  CreateCheckpointInput,
  RetryAttemptContext,
  RetryContext,
  RetryRunnerOptions,
  StreamingProvider,
} from "@natalia/runtime";
import type {
  SessionMetadata,
  SessionRecord,
  StoredContextEpoch,
} from "@natalia/session";
import type {
  RuntimeTool,
  SandboxToolService,
  SubagentRunnerContext,
  SubagentToolService,
  TerminalToolService,
  ToolExecutionPipeline,
  ToolHookEvent as RuntimeToolHookEvent,
  ToolHookResult as RuntimeToolHookResult,
  ToolHooks as RuntimeToolHooks,
  ToolPolicy as RuntimeToolPolicy,
  ToolPolicyHookLayer as RuntimeToolPolicyHookLayer,
  ToolMaterialization,
  ToolRegistry,
} from "@natalia/tools";
import type {
  ContributedNataliaDocuments,
  TaskModuleContext,
  WorkflowExecutionHandle,
  WorkflowExecutionSchedulerService,
} from "@natalia/workflow";

export type LocalToolsInput = {
  roots: string[];
  trust?: {
    workspaceRoot: string;
    verify(
      key: string,
      entryPath: string,
    ): Promise<{ verified: boolean; expected?: string; actual?: string }>;
  };
  onError?(id: string, error: unknown): void;
  onChange?(familyID: string, entryPath: string): void;
};

export type McpInput = {
  servers(): Record<string, import("@natalia/contracts").MCPServerConfig>;
  workspaceRoot: string;
  enabled(): boolean;
  publish(event: RuntimeEvent): void;
};

export type SkillsInput = {
  workspaceRoot: string;
  userRoot?: string;
  remoteURLs?: string[];
  onLoad?(
    skill: SkillMetadata,
    output: string,
    context: import("@natalia/tools").ToolExecutionContext,
  ): void;
  commandSession?: {
    active(sessionID: SessionID): SkillMetadata | undefined;
    activate(sessionID: SessionID, skill: SkillMetadata): void;
  };
};

export type TaskModuleInput = TaskModuleContext;

export type TaskWorkflowInput = {
  workspaceRoot: string;
  globalConfigPath?: string;
  runtimeConfig(): ConfigV3 | undefined;
  capabilityViews(): Array<
    import("@natalia/capability").CapabilityRegistryView
  >;
  publishDiagnostic(message: string): void;
  resolveFlowPermissions: typeof import("@natalia/workflow").effectiveFlowPermissions;
  createRuntimeClient(options: {
    episodeID: import("@natalia/contracts").EpisodeID;
    sessionID: SessionID;
    title: string;
    useSqliteStore: boolean;
    workspaceRoot: string;
    permissionProfile: string;
    taskModuleContext: TaskModuleContext;
  }): RuntimeClient;
};

export type TerminalInput = TerminalControllerInput;

export type AttachmentService = {
  store(paths: string[]): Promise<LocalAttachment[]>;
  storeBytes(input: {
    name: string;
    mediaType: string;
    data: Uint8Array;
  }): Promise<LocalAttachment>;
  dataURL(attachment: LocalAttachment): Promise<string>;
  text(attachment: LocalAttachment): Promise<string>;
  isText(attachment: LocalAttachment): boolean;
  cleanup(attachments: LocalAttachment[]): Promise<string[]>;
  referencedForSessions(sessions: SessionRecord[]): LocalAttachment[];
};

export type SessionStoreRecoveryView = {
  activeTurnIDs: string[];
  approvals: Array<Extract<RuntimeEvent, { type: "approval.request" }>>;
  questions: Array<Extract<RuntimeEvent, { type: "question.request" }>>;
  selectedAgent?: string;
  selectedModel?: { modelID?: string; variant?: string };
  attachments: Map<string, LocalAttachment[]>;
  diagnostics: Array<Extract<RuntimeEvent, { type: "diagnostic" }>>;
};

export interface SessionStoreController {
  init(): Promise<void>;
  status(): { initialized: boolean; mode: "sqlite" | "json" };
  load(
    id: SessionID,
    options?: { title?: string; create?: boolean; indexedRecovery?: boolean },
  ): Promise<{
    session: SessionRecord;
    contextEpoch?: StoredContextEpoch;
    recovery?: SessionStoreRecoveryView;
  }>;
  saveInbox(session: SessionRecord): Promise<void>;
  appendEvent(session: SessionRecord, event: RuntimeEvent): Promise<void>;
  appendEvents(session: SessionRecord, events: RuntimeEvent[]): Promise<void>;
  updateMetadata(
    session: SessionRecord,
    partial: Partial<SessionMetadata>,
  ): Promise<void>;
  contextEventsAfter(
    id: SessionID,
    epoch?: StoredContextEpoch,
  ): RuntimeEvent[] | undefined;
  referencedAttachments(): Promise<LocalAttachment[]>;
  history(
    id: SessionID,
    fallback: RuntimeEvent[],
    options?: { after?: number; offset?: number; limit?: number },
  ): Promise<{
    events: Array<{ seq: number; event: RuntimeEvent }>;
    hasMore: boolean;
  }>;
  messages(
    id: SessionID,
    fallback: SessionRecord,
    options?: { limit?: number; order?: "asc" | "desc"; cursor?: string },
  ): Promise<RuntimeMessagePage>;
  flush(id?: SessionID): Promise<void>;
  list(): Promise<RuntimeSessionSummary[]>;
  touch(id: string): Promise<void>;
  rename(id: string, title: string): Promise<RuntimeSessionSummary>;
  pin(id: string, pinned: boolean): Promise<RuntimeSessionSummary>;
  duplicate(id: string, title?: string): Promise<RuntimeSessionSummary>;
  fork(
    id: string,
    turnID: string,
    title?: string,
  ): Promise<RuntimeSessionSummary>;
  messageRollback(
    id: string,
    turnID: string,
  ): Promise<{ id: string; rolledBackTo: string }>;
  delete(id: string): Promise<{ id: string; removedAttachments: number }>;
  create(input: {
    id?: string;
    title?: string;
  }): Promise<{ sessionID: string; created: boolean }>;
  setAutoTitle(
    id: string,
    title: string,
    source: "generated" | "fallback",
  ): Promise<RuntimeSessionSummary>;
  archive(id: string): Promise<{ id: string; archived: boolean }>;
  restore(id: string): Promise<{ id: string; archived: boolean }>;
  export(id: string): Promise<{
    sessionID: string;
    title: string;
    createdAt: string;
    archived: boolean;
    events: Array<{ seq: number; event: RuntimeEvent }>;
  }>;
  close(): Promise<void>;
}

export type TurnControllerInput = {
  session(): SessionRecord | undefined;
  activeAbort(): AbortController | undefined;
  sessionFor(sessionID: string): SessionRecord | undefined;
  activeAbortFor(sessionID: string): AbortController | undefined;
  persist(fn: () => Promise<void>): Promise<void>;
  saveInbox(snapshot: SessionRecord): Promise<void>;
  flush(): Promise<void>;
  runCommand(
    id: string,
    text: string,
    signal: AbortSignal | undefined,
    sessionID: string,
  ): Promise<boolean>;
  runTurn(input: {
    id: string;
    text: string;
    sessionID: string;
    attachments: LocalAttachment[];
    resources: PromptResourceMention[];
    agents: PromptAgentMention[];
    internal?: boolean;
  }): Promise<void>;
};

export interface TurnController {
  drain(signal: AbortSignal, sessionID: string): Promise<void>;
  drainQueue(signal: AbortSignal | undefined, sessionID: string): Promise<void>;
  admit(
    sessionID: string,
    id: string,
    text: string,
    attachments?: LocalAttachment[],
    resources?: PromptResourceMention[],
    agents?: PromptAgentMention[],
    internal?: boolean,
    signal?: AbortSignal,
  ): Promise<void>;
  persistPromotion(sessionID?: string): Promise<void>;
  dispose(): void;
}

export type ProviderTurnInput = {
  id: string;
  text: string;
  attachments: LocalAttachment[];
  resources: PromptResourceMention[];
  agents: PromptAgentMention[];
  internal?: boolean;
};
export type ProviderChatTurnInput = {
  sessionID: SessionID;
  text: string;
  responseMessageID: string;
  internal?: boolean;
  provider?: import("@natalia/runtime").StreamingProvider;
  reasoningEffort?: import("@natalia/contracts").RuntimeReasoningEffort;
  attachments?: import("@natalia/contracts").LocalAttachment[];
};
export type SkillMetadata = {
  name: string;
  description: string;
  allowedTools: string[];
  requireApproval: boolean;
  sandboxRequired: boolean;
  scripts: Record<string, string>;
  resources: string[];
  qualifiedName: string;
  root: string;
  body: string;
  source: "project" | "user" | "remote";
};
export type SkillPolicy = {
  mode: "default" | "restricted" | "sandbox" | "full";
  allowedTools?: string[];
};
export interface SkillService {
  resolve(name: string): SkillMetadata;
  list(): SkillMetadata[];
  authorizeTool(
    skill: SkillMetadata,
    tool: string,
    policy: SkillPolicy,
  ): boolean;
  readResource(skill: SkillMetadata, path: string): Promise<string>;
  runScript(
    skill: SkillMetadata,
    name: string,
    input?: { signal?: AbortSignal },
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;
}

export interface TeamBehaviorService {
  directive(): string;
  sandboxedSubagentSystemPrompt(domain?: string[]): string;
}

export type ProviderUsage = { inputTokens: number; outputTokens: number };
export type ProviderRunnerInput = {
  provider(): StreamingProvider | undefined;
  session(): SessionRecord | undefined;
  context(): RuntimeContextLedgerInput;
  tools(): ToolRegistry;
  attachmentReferences(): Map<string, LocalAttachment[]>;
  attachments: AttachmentService;
  compaction: CompactionService;
  mcp(): Pick<McpService, "readResource"> | undefined;
  agentRegistry(): AgentRegistry | undefined;
  activeAbort(): AbortController | undefined;
  setActiveAbort(controller: AbortController | undefined): void;
  activeTurnID(): string | undefined;
  setActiveTurnID(id: string | undefined): void;
  selectedAgent(): AgentDefinition | undefined;
  setSelectedAgent(agent: AgentDefinition | undefined): void;
  pendingAgent(): AgentDefinition | undefined;
  setPendingAgent(agent: AgentDefinition | undefined): void;
  selectedModel(): { modelID?: string; variant?: string } | undefined;
  modelCapabilities(): import("@natalia/contracts").ModelCapabilities;
  setActiveModelCapabilities(
    capabilities: import("@natalia/contracts").ModelCapabilities | undefined,
  ): void;
  refreshContextConfig?(): Promise<void>;
  permissionMode(): "ask" | "auto" | "read_only";
  workspaceRoot(): string;
  tsRuntimeConfig(): ConfigV3 | undefined;
  runtimeContextConfig(): {
    max: number;
    thresholdPercent: number;
    reserved: number;
  };
  activeSkill(): SkillMetadata | undefined;
  skillsList(): SkillMetadata[];
  skillService?(): SkillService | undefined;
  naviSuggestions(): Array<{
    id: string;
    suggestion: string;
    priority: string;
    rationale?: string;
  }>;
  naviAnswers(): Array<{ questionID: string; answer: string }>;
  naviChats?(): Array<{
    id: string;
    threadID: string;
    from: "live_chat" | "main_agent";
    text: string;
    round: number;
    expectsReply: boolean;
    status: string;
  }>;
  naviIntro(): boolean;
  activePlan():
    | {
        planID: string;
        version: number;
        title: string;
        objective: string;
        steps: Array<{
          id: string;
          title: string;
          detail?: string;
          verification?: string;
        }>;
        constraints: string[];
        verification: string[];
        riskNotes: string[];
      }
    | undefined;
  retry: RetryService;
  lastProviderUsage(): ProviderUsage | undefined;
  setLastProviderUsage(usage: ProviderUsage | undefined): void;
  taskModuleContext():
    | Pick<
        TaskModuleContext,
        | "moduleInstructions"
        | "moduleContinuation"
        | "flowID"
        | "moduleID"
        | "moduleConditions"
      >
    | undefined;
  publish(event: RuntimeEvent): void;
  applyAgentPolicy(): void;
  applyAgentProvider(): void;
  persistInboxPromotion(sessionID?: string): Promise<void>;
  createTurnCheckpoint(input: CreateCheckpointInput): Promise<void>;
  isToolAllowed(toolName: string): boolean;
  setInFlightOperation(
    operation: import("@natalia/session").DurableInFlightOperation | undefined,
  ): Promise<void>;
  executeToolCalls(
    turnID: string,
    calls: ProviderToolCall[],
    assistant: string,
    materialized: ToolMaterialization,
  ): Promise<import("@natalia/runtime").ProviderMessage[]>;
  takeLiveUserMessages?(): Array<{ source: "user" | "navi"; text: string }>;
  reloadConfig(): Promise<{ providerReconfigured: boolean }>;
  runtimeStatusSnapshot(): Promise<RuntimeEvent>;
  effectiveMaxSteps(): number;
  waitIfPaused(): Promise<void>;
  waitingHuman(): { terminalID: string; reason: string } | undefined;
};

export type ProviderModelControllerInput = {
  initialize(): void;
  runnerInput(sessionID: SessionID): ProviderRunnerInput;
  commands: {
    catalog(): Promise<
      Array<{ id: string; name: string; provider: string; variants: string[] }>
    >;
    select(
      sessionID: SessionID,
      modelID: string,
      variant?: string,
    ): Promise<void>;
  };
  chat: {
    available(sessionID: SessionID): boolean;
    publish(sessionID: SessionID, event: RuntimeEvent): void;
    runBody(input: ProviderChatTurnInput, signal: AbortSignal): Promise<void>;
    wake(sessionID: SessionID): Promise<void>;
  };
};
export interface ProviderModelController {
  runTurn(sessionID: SessionID, turn: ProviderTurnInput): Promise<void>;
  runChatTurn(turn: ProviderChatTurnInput): Promise<void>;
  requestChatWake(sessionID: SessionID): void;
  chatBusy?(sessionID: SessionID): boolean;
  abortChat?(sessionID: SessionID): boolean;
  dispose(): Promise<void>;
}

export interface RetryService {
  policy(): RetryRunnerOptions["policy"];
  run<T>(
    context: RetryContext,
    fn: (attempt: RetryAttemptContext) => Promise<T>,
    options?: Omit<RetryRunnerOptions, "policy">,
  ): Promise<T>;
}

export type StatusProvider = { provider: string; model: string };
export type StatusContextLedger = {
  journalStatus(): { tokenEstimate: number; messageCount: number };
};
export interface StatusSnapshotController {
  snapshot(): Promise<Extract<RuntimeEvent, { type: "status.snapshot" }>>;
  snapshotFor(overrides?: {
    provider?: StatusProvider;
    context?: StatusContextLedger;
    permissionMode?: "ask" | "auto" | "read_only";
  }): Promise<Extract<RuntimeEvent, { type: "status.snapshot" }>>;
  schedule(): void;
  dispose(): void;
}

export interface SubagentsService extends SubagentToolService {
  init(
    runner: (
      task: string,
      context: SubagentRunnerContext,
    ) => void | Promise<void>,
  ): Promise<void>;
  enabled(): boolean;
}

export type CheckpointSubagents = {
  list(): Array<{ id: string; task: string; status: string }>;
  stop(id: string): unknown;
};
export type CheckpointWorkLedger = {
  checkpointNode(input: {
    checkpointID: string;
    reason: string;
    sessionID: SessionID;
    turnID?: string;
  }): RuntimeEvent;
  rollbackCheckpointEdge(input: {
    checkpointID: string;
    safetyCheckpointID: string;
    sessionID: SessionID;
  }): RuntimeEvent;
};
export interface CheckpointController {
  init(): Promise<void>;
  get(): CheckpointStore;
  list(): ReturnType<CheckpointStore["list"]>;
  preview(id: string): ReturnType<CheckpointStore["previewRollback"]>;
  rollback(
    id: string,
    options: { dryRun?: boolean },
  ): ReturnType<CheckpointStore["rollbackTo"]>;
  createCheckpoint(
    input: import("@natalia/runtime").CreateCheckpointInput,
  ): ReturnType<CheckpointStore["createCheckpoint"]>;
  isEnabled(): boolean;
  resources(): Array<{
    kind: "subagent" | "tool";
    id: string;
    status: "running" | "waiting" | "stopped";
    summary: string;
  }>;
  rollbackOptions(): {
    resources: ReturnType<CheckpointController["resources"]>;
    onResourcePolicy(policy: CheckpointResourcePolicy): Promise<void>;
    onContextRestored(snapshot: DurableContextCheckpoint): Promise<void>;
  };
}
export type CheckpointControllerAccessors = {
  sessionID(): SessionID;
  checkpoint(): ConfigV3["checkpoint"] | undefined;
  workspace(): ConfigV3["workspace"] | undefined;
  publish(event: RuntimeEvent): void;
  context(): ContextLedger;
  subagents(): CheckpointSubagents | undefined;
  activeAbort(): AbortController | undefined;
  workLedger(): CheckpointWorkLedger;
};
export type CheckpointFactory = (
  accessors: CheckpointControllerAccessors,
) => CheckpointController;

export type ExpectedMutation = {
  sessionID?: string;
  episodeID?: string;
  turnID?: string;
  callID?: string;
  operationID?: string;
  toolName: string;
  authorizedPaths: string[];
  expectedOperations: WorkspaceOperation[];
  settled: boolean;
};
export interface MutationRegistry {
  register(input: Omit<ExpectedMutation, "settled">): string;
  match(input: { path: string; operation: WorkspaceOperation }):
    | {
        turnID?: string;
        callID?: string;
        operationID?: string;
        sessionID?: string;
        episodeID?: string;
        toolName: string;
      }
    | undefined;
  settle(key: string): void;
  forget(key: string): void;
  pendingCount(): number;
}
export interface WorkspaceWriteLock {
  acquire(): Promise<() => void>;
}
export interface WorkspaceFilesController {
  init(): Promise<void>;
  close(): void;
  reconcile(): Promise<ConfirmedWorkspaceChange[]>;
  observationStatus(): unknown;
  auditor: unknown;
}

/** Backend-neutral terminal port. Native registry classes never cross this boundary. */
export interface TerminalController {
  init(): Promise<void>;
  list(): Promise<RuntimeNativeTerminalSession[]>;
  reconcile(): Promise<RuntimeNativeTerminalSession[]>;
  read(
    id: string,
    options?: { maxLines?: number },
  ): Promise<{
    text: string;
    cursorX: number;
    cursorY: number;
    rows: number;
    cols: number;
  }>;
  openHub(): Promise<{ muxWindowID: number }>;
  releaseHumanControl(id: string): RuntimeNativeTerminalSession;
  beginSecureInput(id: string): RuntimeNativeTerminalSession;
  endSecureInput(id: string): RuntimeNativeTerminalSession;
  stop(
    id: string,
    actor: "model" | "human" | "system",
  ): Promise<RuntimeNativeTerminalSession>;
  start(input: {
    command: string;
    cwd: string;
    id?: string;
    sessionID?: string;
    agentID?: string;
  }): Promise<RuntimeNativeTerminalSession>;
  write(
    id: string,
    value: string,
    options?: { idempotencyKey?: string },
  ): Promise<{
    writtenBytes: number;
    delivery: "accepted" | "duplicate" | "cancelled";
  }>;
  resize(
    id: string,
    rows: number,
    cols: number,
    actor: "model" | "human",
  ): Promise<RuntimeNativeTerminalSession>;
  snapshot(id: string): ReturnType<TerminalToolService["snapshot"]>;
  observe(
    id: string,
    afterRevision: number,
    options?: { maxLines?: number; timeoutMs?: number },
  ): ReturnType<TerminalToolService["observe"]>;
  session(id: string): { lastObservedText?: string };
  markObserved(id: string, text: string, revision: number): void;
  requestHuman(
    id: string,
    reason: string,
  ): Promise<RuntimeNativeTerminalSession>;
  claimHumanInput?(id: string): Promise<RuntimeNativeTerminalSession>;
  ttyName(id: string): Promise<string | undefined>;
  setActiveSession(sessionID: string | undefined): void;
  subscribeOutput?(id: string, listener: (chunk: string) => void): () => void;
  /** Stop every running pane owned by a Natalia session. */
  stopForSession?(sessionID: string): Promise<void>;
  close(): Promise<void>;
}
export type TerminalControllerInput = {
  workspaceRoot: string;
  publish(event: RuntimeEvent): void;
  onPerformance(name: string, durationMs: number): void;
  runtimeID(): string;
  userRuntimeHome(): string | undefined;
  windowMode(): "auto" | "windowless" | "window";
  /** Provider-private native registry, interpreted only by the terminal subsystem. */
  external?: unknown;
  /** Interactive terminal host. Omitted / unknown values use in-process PTY. */
  backend?: "wezterm" | "pty";
  /** Cap on concurrent PTYs for one Natalia session. PTY backend only. */
  maxPerSession?: number;
  /** Recycle a session's idle PTY when the cap is hit. PTY backend only. */
  idleMs?: number;
};
export interface SandboxService extends SandboxToolService {
  init(): Promise<void>;
  close(): Promise<void>;
  referencedObjectIDs(): Promise<Set<string> | undefined>;
  runningResourceCount(): number;
}
export interface McpService {
  reload(): Promise<void>;
  catalog(): Promise<MCPCatalogSnapshot>;
  getPrompt(
    server: string,
    name: string,
    arguments_?: Record<string, string>,
  ): Promise<unknown>;
  readResource(server: string, uri: string): Promise<unknown>;
}

type RuntimeMethod<K extends keyof RuntimeClient> = NonNullable<
  RuntimeClient[K]
>;
export type TaskWorkflowController = {
  taskOverview: RuntimeMethod<"taskOverview">;
  flowOverview: RuntimeMethod<"flowOverview">;
  documentCatalog: RuntimeMethod<"documentCatalog">;
  saveFlowDocument: RuntimeMethod<"saveFlowDocument">;
  taskPermissionPreview: RuntimeMethod<"taskPermissionPreview">;
  deleteFlowDocument: RuntimeMethod<"deleteFlowDocument">;
  saveTaskDocument: RuntimeMethod<"saveTaskDocument">;
  deleteTaskDocument: RuntimeMethod<"deleteTaskDocument">;
  taskSchedule: RuntimeMethod<"taskSchedule">;
  taskUnschedule: RuntimeMethod<"taskUnschedule">;
  taskPermissionPreviewDocument: RuntimeMethod<"taskPermissionPreviewDocument">;
  permissionProfileUsage(input?: {
    workspaceRoot: string;
  }): Promise<Record<string, string[]>>;
};
export type TaskRunResult = {
  invocationID: string;
  status: import("@natalia/workflow").NataliaTaskInvocationStatus;
  waterlineAdvanced: boolean;
  exitCode: number;
};
export type TaskRunInput = {
  workspaceRoot: string;
  task: NataliaTaskDocument;
  flow: NataliaFlowDocument;
  config: ConfigV3;
  json: boolean;
  emit(line: string): void;
  signal?: AbortSignal;
};
export type TaskRunFromDocumentInput = {
  workspaceRoot: string;
  path?: string;
  taskID?: string;
  contributedDocuments?: ContributedNataliaDocuments;
  config: ConfigV3;
  json: boolean;
  emit(line: string): void;
  signal?: AbortSignal;
};
export type CapabilityTaskExecutionRequest = {
  workspaceRoot: string;
  path?: string;
  taskID?: string;
  config: ConfigV3;
  json?: boolean;
  executionID?: string;
  idempotencyKey?: string;
  idempotencyFingerprint?: string;
  requestedBy?: {
    transport: "local" | "worker" | "http";
    sessionID?: string;
    credentialID?: string;
  };
};
export interface WorkflowCapabilityHost {
  workspaceRoot?: string;
  view: import("@natalia/workflow").WorkflowContributionView;
  acquireExecutionLease(capabilityIDs: string[]): { release(): void };
}
export type HeadlessExecution = {
  episodeID: import("@natalia/contracts").EpisodeID;
  sessionID: SessionID;
  title: string;
  useSqliteStore: boolean;
};
export interface TaskWorkflowService extends TaskWorkflowController {
  runCommand(
    kind: "task" | "flow",
    path: string,
    signal?: AbortSignal,
  ): Promise<string>;
  runTask(input: TaskRunInput): Promise<TaskRunResult>;
  runTaskFromDocument(input: TaskRunFromDocumentInput): Promise<TaskRunResult>;
  taskPermissionPreviewFor(input: {
    task: NataliaTaskDocument;
    flow: NataliaFlowDocument;
    config: ConfigV3;
  }): ReturnType<
    typeof import("@natalia/workflow").effectiveFlowPermissions
  > & {
    taskID: string;
    permissionProfile: string;
  };
  taskPermissionPreviewForDocument(input: {
    workspaceRoot: string;
    path: string;
    config: ConfigV3;
    contributedDocuments?: ContributedNataliaDocuments;
  }): Promise<ReturnType<TaskWorkflowService["taskPermissionPreviewFor"]>>;
  permissionProfileUsage(input?: {
    workspaceRoot: string;
  }): Promise<Record<string, string[]>>;
  newHeadlessExecution(): HeadlessExecution;
  plainRuntimeEvent(event: RuntimeEvent): string | undefined;
  taskRetryMaxAttempts(retry: NataliaTaskDocument["retry"]): number;
  runCapabilityTask(input: {
    capabilities: WorkflowCapabilityHost;
    scheduler: WorkflowExecutionSchedulerService;
    request: CapabilityTaskExecutionRequest;
  }): WorkflowExecutionHandle<TaskRunResult>;
}
export interface RuntimeServiceClient extends RuntimeClient {
  service<T>(name: string): Promise<T | undefined>;
  subscribeTerminalOutput?(
    id: string,
    listener: (chunk: string) => void,
  ): () => void;
}
export type RuntimeContextLedger = ContextLedger;
export interface ContextLedgerFactory {
  create(): RuntimeContextLedger;
  restore(context: RuntimeContextLedger, events: RuntimeEvent[]): void;
}

export type InteractiveWaiterDeps = {
  publish(event: RuntimeEvent): void;
  sessionID(): SessionID;
  permissionMode(turnID?: string): "ask" | "auto" | "read_only";
  abortSignal(turnID: string): AbortSignal | undefined;
  activeTurnID(): string | undefined;
  isPending(
    sessionID: SessionID,
    id: string,
    kind: "approval" | "question",
  ): boolean;
  sessionIDForTurn(turnID: string): SessionID;
  agentIDForTurn?(turnID: string): string | undefined;
  publishForSession(sessionID: SessionID, event: RuntimeEvent): void;
  capabilityOwnerForTool?(toolName: string): string | undefined;
  workLedger(): WorkLedgerController;
};
export interface InteractiveWaiter {
  requireApproval(
    approvalID: string,
    tool: RuntimeTool,
    call: ProviderToolCall,
    turnID: string,
  ): Promise<{ reason: string } | undefined>;
  requireQuestion(
    requestID: string,
    turnID: string,
    request: {
      title: string;
      questions: Array<{
        id: string;
        header: string;
        question: string;
        options: Array<{ label: string; description?: string }>;
        multiple?: boolean;
        custom?: boolean;
      }>;
    },
  ): Promise<string[][]>;
  restoreInteractiveState(events: RuntimeEvent[]): void;
  restoreRecoveredInteractiveState(
    approvals: Array<Extract<RuntimeEvent, { type: "approval.request" }>>,
    questions: Array<Extract<RuntimeEvent, { type: "question.request" }>>,
  ): void;
  respondApproval(response: ApprovalResponse): InteractiveResponseOutcome;
  respondQuestion(response: QuestionResponse): InteractiveResponseOutcome;
  revokeTerminalApprovalScope(terminalID: string): {
    id: string;
    scope: string;
    revoked: boolean;
  };
  hasPendingWaiters(): boolean;
  requirePlanAcceptance(input: {
    approvalID: string;
    planID: string;
    title: string;
    detail: string;
    preview?: string;
    scope?: string;
    sessionID?: SessionID;
    permissionMode?: "ask" | "auto" | "read_only";
    signal?: AbortSignal;
    permissionFamily?: import("@natalia/contracts").PermissionFamily;
  }): Promise<ApprovalResponse | undefined>;
}

export type PlanLifecycleState =
  | "draft"
  | "proposed"
  | "accepted"
  | "queued_next_plan"
  | "active"
  | "completed"
  | "superseded"
  | "archived";
type ServiceOperation = (...args: any[]) => any;
export interface GovernanceLedgerController {
  seedConstitutionRules: ServiceOperation;
  recordDecision: ServiceOperation;
  boundValidationOutcome: ServiceOperation;
  buildCompletionRecorded: ServiceOperation;
  buildEvidenceRecorded: ServiceOperation;
  evidenceStatusForPlanState: ServiceOperation;
}
export interface WorkLedgerController {
  buildPlanDraftCreated: ServiceOperation;
  buildPlanTransition: ServiceOperation;
  evaluateDrift: ServiceOperation;
  buildDriftFindingUpdate: ServiceOperation;
  agentActionNode: ServiceOperation;
  approvalEdge: ServiceOperation;
  approvalNode: ServiceOperation;
  completionValidationEdge: ServiceOperation;
  checkpointNode: ServiceOperation;
  constitutionCheckEdge: ServiceOperation;
  constitutionRuleNode: ServiceOperation;
  decisionNode: ServiceOperation;
  externalWorkspaceChangeNode: ServiceOperation;
  toolCallEdge: ServiceOperation;
  toolCallNode: ServiceOperation;
  rollbackCheckpointEdge: ServiceOperation;
  workspaceChangeEdge: ServiceOperation;
  workspaceChangeNode: ServiceOperation;
}

export type ToolPolicy = RuntimeToolPolicy;
export type ToolHookEvent = RuntimeToolHookEvent;
export type ToolHookResult = RuntimeToolHookResult;
export type ToolHooks = RuntimeToolHooks;
export type ToolPolicyHookLayer = RuntimeToolPolicyHookLayer;
export interface ToolPolicyService {
  createExecutionPipeline(): ToolExecutionPipeline;
  createHookLayer(policy?: ToolPolicy, hooks?: ToolHooks): ToolPolicyHookLayer;
  evaluatePermissionRules: (...args: any[]) => any;
  workspaceWritePathForTool: (...args: any[]) => any;
  workspaceWritePathsForTool: (...args: any[]) => any;
  commandTextForTool: (...args: any[]) => any;
}

export type CompactionBudget = {
  max: number;
  thresholdPercent: number;
  reserved: number;
};
export interface CompactionService {
  compactBeforeProviderStep(input: any): Promise<any>;
  runWithContextLimitRecovery(input: any): Promise<any>;
}
