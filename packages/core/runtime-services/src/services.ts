import type { TokenMeter } from "@natalia/runtime";
import type { AgentDefinition, AgentRegistry } from "@natalia/agent";
import type {
  ApprovalResponse,
  ChatModelProfile,
  CheckpointResourcePolicy,
  ConfigV3,
  ConfirmedWorkspaceChange,
  GoalSnapshot,
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
  RuntimeReasoningEffort,
  RuntimeSessionSummary,
  SessionID,
  WorkspaceOperation,
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
  AdmittedSessionInput,
} from "@natalia/session";
import type { ProjectDocumentSnapshot } from "./project-documents";
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
  goal?: GoalSnapshot & {
    roundsStarted: number;
    activation: "armed" | "disarmed";
    createdAt?: string;
    updatedAt?: string;
  };
  approvals: Array<Extract<RuntimeEvent, { type: "approval.request" }>>;
  questions: Array<Extract<RuntimeEvent, { type: "question.request" }>>;
  interactives: Array<Extract<RuntimeEvent, { type: "interactive.request" }>>;
  selectedAgent?: string;
  selectedModel?: { modelID?: string; variant?: string };
  reasoningEffort?: RuntimeReasoningEffort;
  chatModelProfile?: Record<string, ChatModelProfile>;
  permissionMode?: "ask" | "auto" | "read_only";
  permissionProfile?: string;
  attachments: Map<string, LocalAttachment[]>;
  diagnostics: Array<Extract<RuntimeEvent, { type: "diagnostic" }>>;
};

export interface SessionStoreController {
  init(): Promise<void>;
  status(): { initialized: boolean; mode: "sqlite" | "json" };
  load(
    id: SessionID,
    options?: {
      title?: string;
      create?: boolean;
      indexedRecovery?: boolean;
      /** Load only events the live execution projection needs. */
      runtimeEvents?: boolean;
    },
  ): Promise<{
    session: SessionRecord;
    contextEpoch?: StoredContextEpoch;
    recovery?: SessionStoreRecoveryView;
  }>;
  saveInbox(session: SessionRecord): Promise<void>;
  /**
   * Cheap read of the fast-restore recovery projection (no full event load).
   * Used to re-seed live projections — e.g. the goal status bar — on attach.
   */
  loadRecoveryProjection(id: SessionID): SessionStoreRecoveryView | undefined;
  appendEvent(session: SessionRecord, event: RuntimeEvent): Promise<void>;
  appendEvents(session: SessionRecord, events: RuntimeEvent[]): Promise<void>;
  updateMetadata(
    session: SessionRecord | SessionID,
    partial: Partial<SessionMetadata>,
  ): Promise<void>;
  contextEventsAfter(
    id: SessionID,
    epoch?: StoredContextEpoch,
  ): RuntimeEvent[] | undefined;
  writeContextEpoch(
    id: SessionID,
    snapshot: import("@natalia/contracts").DurableContextCheckpointRecord,
  ): void;
  ensureMessageIndex(id: SessionID): void;
  ensureMessageIndexAsync(id: SessionID): Promise<void>;
  prewarmMessagePage(id: SessionID): Promise<void>;
  loadFullAsync(
    id: SessionID,
    options?: { runtimeEvents?: boolean },
  ): Promise<SessionRecord>;
  referencedAttachments(): Promise<LocalAttachment[]>;
  /** Durable event count for one session, independent of the live window. */
  eventCount(id: SessionID): Promise<number>;
  history(
    id: SessionID,
    fallback: RuntimeEvent[],
    options?: { after?: number; offset?: number; limit?: number },
  ): Promise<{
    events: Array<{
      seq: number;
      sessionSeq?: number;
      event: RuntimeEvent;
    }>;
    hasMore: boolean;
  }>;
  eventWindow(
    id: SessionID,
    fallback: RuntimeEvent[],
    options?: { beforeSeq?: number; limit?: number },
  ): Promise<{
    events: Array<{
      seq: number;
      sessionSeq?: number;
      event: RuntimeEvent;
    }>;
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
  ): Promise<{ id: string; rolledBackTo: string; safetyCheckpointID?: string }>;
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
  /** Removes a not-yet-promoted inbox input. Returns the removed input. */
  removeInput(
    sessionID: string,
    id: string,
  ): Promise<AdmittedSessionInput | undefined>;
  /** Replaces the text of a not-yet-promoted inbox input. */
  replaceInput(
    sessionID: string,
    id: string,
    text: string,
  ): Promise<AdmittedSessionInput | undefined>;
  /** Promotes a queued `next-turn` input to `next-step` in place. */
  promoteInput(
    sessionID: string,
    id: string,
  ): Promise<AdmittedSessionInput | undefined>;
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
  model?: { modelID?: string; variant?: string };
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

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  /** Anthropic cache metrics (ADR E): prefix written / prefix reused. */
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
};
export type ProviderRunnerInput = {
  provider(): StreamingProvider | undefined;
  session(): SessionRecord | undefined;
  context(): RuntimeContextLedgerInput;
  tokenMeter?(): TokenMeter;
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
  /**
   * The project documents (AGENTS.md / .natalia/constitution.md) loaded for
   * the workspace, or undefined when none are present. Injected as a
   * `<runtime_context source="project">` block (ADR D2 / EI §8.5) — user-tier
   * authority, never in the static system prompt.
   */
  projectDocuments?(): ProjectDocumentSnapshot | undefined;
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
    from: import("@natalia/contracts").CollaborationParticipant;
    to: import("@natalia/contracts").CollaborationParticipant;
    text: string;
    round: number;
    expectsReply: boolean;
    status: string;
  }>;
  naviIntro(): boolean;
  niaChats?(): Array<{
    id: string;
    threadID: string;
    from: import("@natalia/contracts").CollaborationParticipant;
    to: import("@natalia/contracts").CollaborationParticipant;
    text: string;
    round: number;
    expectsReply: boolean;
    status: string;
  }>;
  niaIntro?(): boolean;
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
    reasoning?: {
      content?: string;
      field?: string;
      signature?: string;
      redacted?: boolean;
      blocks?: import("@natalia/contracts").ProviderReasoningBlock[];
      parts?: import("@natalia/contracts").ProviderContentPart[];
      providerMetadata?: Record<string, unknown>;
      textSignature?: string;
    },
  ): Promise<import("@natalia/runtime").ProviderMessage[]>;
  takeLiveUserMessages?(): Array<{ source: "user" | "navi"; text: string }>;
  /** Claims un-promoted `next-step` inputs for one provider step. */
  takeStepInputs?(step: number): Array<{ id: string; text: string }>;
  /** Whether any `next-step` input is still waiting to be claimed. */
  hasPendingStepInputs?(): boolean;
  /** O(1) "was turn.submitted already published for this id" check. */
  isTurnAnnounced?(id: string): boolean;
  /** Records that `turn.submitted` was published for this turn. */
  markTurnAnnounced?(id: string): void;
  reloadConfig(): Promise<{ providerReconfigured: boolean }>;
  runtimeStatusSnapshot(): Promise<RuntimeEvent>;
  effectiveMaxSteps(): number;
  waitIfPaused(): Promise<void>;
  waitingHuman(): { terminalID: string; reason: string } | undefined;
};

export type ProviderChatStreamInput = {
  available(sessionID: SessionID): boolean;
  publish(sessionID: SessionID, event: RuntimeEvent): void;
  runBody(input: ProviderChatTurnInput, signal: AbortSignal): Promise<void>;
  wake(sessionID: SessionID): Promise<void>;
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
  navi: ProviderChatStreamInput;
  nia: ProviderChatStreamInput;
};
export interface ProviderModelController {
  runTurn(sessionID: SessionID, turn: ProviderTurnInput): Promise<void>;
  runNaviChatTurn(turn: ProviderChatTurnInput): Promise<void>;
  runNiaChatTurn(turn: ProviderChatTurnInput): Promise<void>;
  requestNaviWake(sessionID: SessionID): void;
  requestNiaWake(sessionID: SessionID): void;
  naviBusy(sessionID: SessionID): boolean;
  niaBusy(sessionID: SessionID): boolean;
  abortNavi(sessionID: SessionID): boolean;
  abortNia(sessionID: SessionID): boolean;
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
  rename(id: string, name: string): ReturnType<CheckpointStore["rename"]>;
  workspaceDiff(): ReturnType<CheckpointStore["workspaceDiff"]>;
  listCheckpointsByKind(
    kind?: import("@natalia/contracts").CheckpointKind,
  ): ReturnType<CheckpointStore["listCheckpointsByKind"]>;
  listAuditRounds(
    planID?: string,
  ): ReturnType<CheckpointStore["listAuditRounds"]>;
  createAuditRoundCheckpoint(
    input: Parameters<CheckpointStore["createAuditRoundCheckpoint"]>[0],
  ): ReturnType<CheckpointStore["createAuditRoundCheckpoint"]>;
  diffCheckpoints(
    from: import("@natalia/contracts").CheckpointRef,
    to: import("@natalia/contracts").CheckpointRef,
    options?: import("@natalia/contracts").DiffCheckpointsOptions,
  ): ReturnType<CheckpointStore["diffCheckpoints"]>;
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
export type WorkspaceWriteActivity = {
  sessionID?: string;
  paths: string[];
  acquiredAt: number;
  queuedAt: number;
  active: boolean;
};

export interface WorkspaceWriteLock {
  acquire(sessionID?: string, paths?: string[]): Promise<() => void>;
  snapshot(): WorkspaceWriteActivity[];
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
  list(sessionID?: string): Promise<RuntimeNativeTerminalSession[]>;
  reconcile(): Promise<RuntimeNativeTerminalSession[]>;
  read(
    id: string,
    options?: { maxLines?: number; sessionID?: string },
  ): Promise<{
    text: string;
    cursorX: number;
    cursorY: number;
    rows: number;
    cols: number;
  }>;
  openHub(): Promise<{ muxWindowID: number }>;
  releaseHumanControl(
    id: string,
    sessionID?: string,
  ): RuntimeNativeTerminalSession;
  beginSecureInput(
    id: string,
    sessionID?: string,
  ): RuntimeNativeTerminalSession;
  endSecureInput(id: string, sessionID?: string): RuntimeNativeTerminalSession;
  stop(
    id: string,
    actor: "model" | "human" | "system",
    sessionID?: string,
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
    options?: {
      idempotencyKey?: string;
      sessionID?: string;
    },
  ): Promise<{
    writtenBytes: number;
    delivery: "accepted" | "duplicate" | "cancelled";
  }>;
  resize(
    id: string,
    rows: number,
    cols: number,
    actor: "model" | "human",
    sessionID?: string,
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
    sessionID?: string,
  ): Promise<RuntimeNativeTerminalSession>;
  claimHumanInput?(
    id: string,
    sessionID?: string,
  ): Promise<RuntimeNativeTerminalSession>;
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
  isPending(sessionID: SessionID, id: string, kind: string): boolean;
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
    options?: { force?: boolean; reason?: string },
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
    interactives?: Array<
      Extract<RuntimeEvent, { type: "interactive.request" }>
    >,
  ): void;
  respondApproval(response: ApprovalResponse): InteractiveResponseOutcome;
  respondQuestion(response: QuestionResponse): InteractiveResponseOutcome;
  /**
   * Issues a generic interactive request and waits for its response. The
   * `validate` callback is the in-process business authority; the runtime only
   * checks the envelope, and the returned promise carries the raw response.
   */
  requireInteractive(input: {
    requestID: string;
    turnID: string;
    kind: string;
    title: string;
    payload: import("@natalia/contracts").JsonValue;
    responseSchema?: import("@natalia/contracts").JsonSchema;
    expiresAt?: string;
    priority?: number;
    validate?(
      response: import("@natalia/contracts").JsonValue,
    ): string[] | void;
  }): Promise<{
    response: import("@natalia/contracts").JsonValue;
    rejected?: boolean;
  }>;
  respondInteractive(
    response: import("@natalia/contracts").InteractiveResponse,
  ): InteractiveResponseOutcome;
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
  | "marked"
  | "handed_off"
  | "executing"
  | "awaiting_audit"
  | "auditing"
  | "audit_passed"
  | "audit_gaps"
  | "completed";
type ServiceOperation = (...args: any[]) => any;
export interface GovernanceLedgerController {
  seedConstitutionRules: ServiceOperation;
  recordDecision: ServiceOperation;
  boundValidationOutcome: ServiceOperation;
  buildCompletionRecorded: ServiceOperation;
  buildEvidenceRecorded: ServiceOperation;
  evidenceStatusForPlanState: ServiceOperation;
  validateConstitutionRuleProposal: ServiceOperation;
  buildProposedConstitutionRule: ServiceOperation;
  buildConstitutionRuleEnabledChange: ServiceOperation;
  buildConstitutionRuleRemoved: ServiceOperation;
}
export interface WorkLedgerController {
  buildPlanDocCreated: ServiceOperation;
  buildPlanDocUpdated: ServiceOperation;
  buildPlanDocMarked: ServiceOperation;
  buildPlanDocDeleted: ServiceOperation;
  buildPlanDocStatus: ServiceOperation;
  buildAuditRequested: ServiceOperation;
  evaluateDrift: ServiceOperation;
  buildDriftFindingUpdate: ServiceOperation;
  buildWorkContractDrafted: ServiceOperation;
  buildWorkContractAccepted: ServiceOperation;
  validateWorkContractFields: ServiceOperation;
  evaluateCompletionCard: ServiceOperation;
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
