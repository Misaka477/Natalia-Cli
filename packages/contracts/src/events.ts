import type {
  ApprovalResponse,
  QuestionItem,
  QuestionResponse,
} from "@natalia/ui-model";
import type { AgentPermissionRules } from "./schemas";
export type { ApprovalResponse, QuestionResponse } from "@natalia/ui-model";

export type SessionID = `ses_${string}`;

export type ErrorKind =
  | "timeout"
  | "connection"
  | "rate_limit"
  | "server"
  | "auth"
  | "invalid_request"
  | "empty_response"
  | "context_limit"
  | "cancel";

export type StepRetryOperation = "llm_step" | "compaction" | "metadata_probe";

export type ContextStatusSource =
  | "exact_checkpoint"
  | "pending_estimate"
  | "compaction_estimate"
  | "restored";

export type CompactionTrigger =
  | "ratio"
  | "reserved"
  | "manual"
  | "context_limit";

export type ExecutionTarget =
  | { kind: "host"; cwd: string }
  | {
      kind: "sandbox";
      sandboxID: string;
      root: string;
      isolationLevel: "workspace" | "container" | "vm";
    };

export type PTYStatus =
  | "starting"
  | "running"
  | "waiting"
  | "awaiting_approval"
  | "exited"
  | "failed";
export type PTYOwnership = "model" | "user" | "shared" | "detached";
export type PTYAction =
  | "write"
  | "submit"
  | "special_key"
  | "resize"
  | "exit"
  | "attach"
  | "detach";
export type SandboxStatus =
  | "created"
  | "running"
  | "changed"
  | "merge_previewed"
  | "merged"
  | "conflicted"
  | "stopped"
  | "deleted"
  | "failed";
export type SandboxDiffKind =
  | "add"
  | "modify"
  | "delete"
  | "rename"
  | "mode"
  | "conflict";

export type DurableContextCheckpointRecord = {
  entries: Array<{
    id: string;
    role:
      | "system"
      | "user"
      | "assistant"
      | "tool_call"
      | "tool_result"
      | "dynamic"
      | "resource"
      | "summary";
    content: string;
    tokens?: number;
    pairID?: string;
    artifactRef?: string;
    attachments?: LocalAttachment[];
  }>;
  checkpoint?: {
    messageCount: number;
    tokens: number;
    inputTokens?: number;
    outputTokens?: number;
    source: "provider_usage" | "estimate";
  };
  resources: Array<{
    kind:
      | "background"
      | "process"
      | "agent"
      | "pty"
      | "sandbox"
      | "workflow"
      | "skill";
    id: string;
    summary: string;
  }>;
  journalOffset: number;
  step: number;
  tokenEstimate: number;
  compactionGeneration: number;
};

export type CheckpointChangeKind =
  | "add"
  | "modify"
  | "delete"
  | "rename"
  | "mode"
  | "symlink";

export type CheckpointResourcePolicy = {
  kind:
    | "subagent"
    | "process"
    | "background"
    | "pty"
    | "sandbox"
    | "workflow"
    | "tool"
    | "pending_modal";
  id: string;
  action: "stop" | "preserve_dirty" | "cancel" | "invalidate" | "none";
  summary: string;
};

export type CheckpointPreview = {
  checkpointID: string;
  safetyCheckpointID?: string;
  dryRun: boolean;
  changes: Array<{
    kind: CheckpointChangeKind;
    path: string;
    oldPath?: string;
    mode?: string;
  }>;
  context: {
    truncateMessages: number;
    targetJournalOffset: number;
    targetStep: number;
    targetTokens: number;
    compactionGeneration: number;
  };
  resources: CheckpointResourcePolicy[];
  ignoredFiles: number;
  diskUsageBytes: number;
  complete: boolean;
  warnings: string[];
};
export type RuntimeCheckpoint = {
  id: string;
  sequence: number;
  turnID?: string;
  stepID?: string;
  step: number;
  reason:
    | "baseline"
    | "turn_begin"
    | "step_begin"
    | "manual"
    | "pre_tool"
    | "pre_compaction"
    | "rollback_safety";
  createdAt: string;
  complete: boolean;
  errors: string[];
  files: number;
  changes: number;
  tokenEstimate: number;
  diskUsageBytes: number;
};
export type RuntimeSandbox = {
  id: string;
  root: string;
  isolationLevel: "workspace" | "container" | "vm";
  changedFiles: number;
  runningResources: number;
  envAllowlist: string[];
};
export type RuntimeSandboxChange = {
  kind: SandboxDiffKind;
  path: string;
  oldPath?: string;
  mode?: string;
};
export type RuntimeSandboxResource = {
  id: string;
  sandboxID: string;
  command: string;
  pid: number;
  status: "running" | "exited" | "failed" | "stopped";
  outputPath: string;
  startedAt: string;
  endedAt?: string;
};

export type ToolStatus =
  | "receiving_arguments"
  | "queued"
  | "awaiting_approval"
  | "running"
  | "succeeded"
  | "failed"
  | "rejected"
  | "cancelled";

export type RuntimeEvent =
  | { type: "session.created"; sessionID: SessionID; title: string }
  | { type: "session.ready"; sessionID: SessionID }
  | {
      type: "turn.submitted";
      id: string;
      text: string;
      byteLength: number;
      lineCount: number;
      sha256: string;
      attachments?: LocalAttachment[];
      resources?: PromptResourceMention[];
      agents?: PromptAgentMention[];
    }
  | { type: "turn.cancelled"; id: string; reason: string }
  | { type: "turn.paused"; id: string; reason: string }
  | { type: "turn.resumed"; id: string }
  | {
      type: "thinking.delta";
      id: string;
      text: string;
      visible?: boolean;
      attempt?: number;
    }
  | {
      type: "thinking.done";
      id: string;
      text?: string;
      visible?: boolean;
      attempt?: number;
    }
  | { type: "content.delta"; id: string; text: string; attempt?: number }
  | { type: "content.done"; id: string; text?: string; attempt?: number }
  | {
      type: "turn.retry";
      id: string;
      attempt: number;
      maxAttempts: number;
      reason: string;
      retryAfterMs: number;
    }
  | {
      type: "step.retry";
      id: string;
      operation: StepRetryOperation;
      step: number;
      attempt: number;
      maxAttempts: number;
      waitMs: number;
      reason: ErrorKind;
      statusCode?: number;
    }
  | {
      type: "step.retry.cleared";
      id: string;
      operation: StepRetryOperation;
      step: number;
      attempts: number;
    }
  | {
      type: "step.retry.exhausted";
      id: string;
      operation: StepRetryOperation;
      step: number;
      attempts: number;
      maxAttempts: number;
      reason: ErrorKind;
      statusCode?: number;
      message: string;
    }
  | {
      type: "tool.update";
      id: string;
      name: string;
      callID?: string;
      status: ToolStatus;
      summary: string;
      argumentsDelta?: string;
      result?: string;
      metadata?: Record<string, unknown>;
      startedAt?: number;
      endedAt?: number;
    }
  | {
      type: "policy.decision";
      turnID: string;
      toolName: string;
      toolCallID?: string;
      decision: "allow" | "deny" | "approval_required" | "rejected";
      reason?: string;
    }
  | {
      type: "subagent.update";
      id: string;
      status:
        | "idle"
        | "running"
        | "paused"
        | "stopped"
        | "completed"
        | "failed";
      attached: boolean;
      event:
        | "created"
        | "status"
        | "log"
        | "done"
        | "stopped"
        | "resumed"
        | "attached"
        | "detached";
      task?: string;
      text?: string;
      parentSessionID?: string;
      parentAgentID?: string;
      continuation?: number;
    }
  | {
      type: "mcp.status";
      server: string;
      status: "disabled" | "connected" | "failed" | "unsupported_auth_flow";
      tools: number;
      message?: string;
    }
  | { type: "agent.selection"; name?: string; pending: boolean }
  | { type: "model.selection"; modelID?: string; variant?: string }
  | {
      type: "plugin.update";
      id: string;
      status: "loaded" | "unloaded" | "denied" | "failed";
      detail?: string;
    }
  | {
      type: "workflow.update";
      runID: string;
      workflow: string;
      status: "running" | "completed" | "failed" | "cancelled";
      event:
        | "run_started"
        | "run_completed"
        | "run_cancelled"
        | "step_started"
        | "step_completed"
        | "step_failed";
      stepID?: string;
      result?: string;
      error?: string;
    }
  | { type: "status.update"; status: string; detail?: string }
  | {
      type: "status.snapshot";
      model: string;
      provider: string;
      context: string;
      step: string;
      permissions: string;
      cwd: string;
      background: string;
    }
  | {
      type: "context.status";
      used: number;
      max: number;
      source: ContextStatusSource;
      thresholdPercent: number;
      reserved: number;
      trigger?: CompactionTrigger;
    }
  | {
      type: "compaction.begin";
      id: string;
      trigger: CompactionTrigger;
      beforeTokens: number;
      maxTokens: number;
      thresholdPercent: number;
      reservedTokens: number;
      instruction?: string;
      attempt: number;
      startedAt: string;
    }
  | {
      type: "compaction.end";
      id: string;
      trigger: CompactionTrigger;
      success: boolean;
      beforeTokens: number;
      afterTokens?: number;
      durationMs: number;
      attempts: number;
      error?: string;
    }
  | {
      type: "context.limit.recovery";
      id: string;
      step: number;
      attempted: boolean;
      compacted: boolean;
      reason: "context_limit";
    }
  | {
      type: "context.checkpoint";
      id: string;
      snapshot: DurableContextCheckpointRecord;
    }
  | {
      type: "pty.update";
      id: string;
      command: string;
      cwd: string;
      status: PTYStatus;
      attached: boolean;
      rows: number;
      cols: number;
      prompt?: string;
      activity: "waiting" | "running";
      tail: string;
      transcript?: string;
      lastAction?: PTYAction;
      target: ExecutionTarget;
      ownership?: PTYOwnership;
      approvalID?: string;
    }
  | {
      type: "pty.action";
      id: string;
      action: PTYAction;
      redacted?: boolean;
      target: ExecutionTarget;
    }
  | {
      type: "pty.timeline";
      id: string;
      actor: "model" | "user" | "system";
      action: PTYAction | "created" | "approval";
      status:
        | "requested"
        | "awaiting_approval"
        | "approved"
        | "executed"
        | "rejected";
      summary: string;
      at: string;
    }
  | {
      type: "pty.approval";
      id: string;
      approvalID: string;
      state: "awaiting" | "approved" | "rejected";
      action: PTYAction;
      reason: string;
      target: ExecutionTarget;
    }
  | { type: "pty.pane.select"; id: string }
  | { type: "pty.pane.focus"; focus: "chat" | "pty" }
  | {
      type: "sandbox.update";
      id: string;
      status: SandboxStatus;
      root: string;
      isolationLevel: "workspace" | "container" | "vm";
      changedFiles: number;
      runningResources: number;
      target: ExecutionTarget;
      resourcePolicy: string;
    }
  | {
      type: "sandbox.diff";
      id: string;
      changes: Array<{
        kind: SandboxDiffKind;
        path: string;
        oldPath?: string;
        mode?: string;
      }>;
    }
  | {
      type: "sandbox.audit";
      id: string;
      action: string;
      target: ExecutionTarget;
      approvalRequired: boolean;
      checkpointPolicy:
        | "sandbox_manifest"
        | "host_checkpoint"
        | "not_available";
      message: string;
    }
  | {
      type: "checkpoint.created";
      id: string;
      reason: string;
      sequence: number;
      complete: boolean;
      files: number;
      changes: number;
      contextJournalOffset: number;
      step: number;
      tokenEstimate: number;
      diskUsageBytes: number;
    }
  | {
      type: "checkpoint.failed";
      reason: string;
      message: string;
      incomplete?: boolean;
      errors?: string[];
    }
  | {
      type: "checkpoint.unavailable";
      reason: string;
      suggestion: string;
      disabledByConfig?: boolean;
    }
  | { type: "rollback.previewed"; preview: CheckpointPreview }
  | {
      type: "rollback.begin";
      checkpointID: string;
      safetyCheckpointID: string;
      dryRun?: boolean;
    }
  | {
      type: "rollback.end";
      checkpointID: string;
      safetyCheckpointID: string;
      restoredFiles: number;
      deletedFiles: number;
      contextJournalOffset: number;
      step: number;
    }
  | {
      type: "rollback.failed";
      checkpointID: string;
      safetyCheckpointID?: string;
      message: string;
      recovered: boolean;
    }
  | {
      type: "diagnostic";
      level: "info" | "warning" | "error";
      message: string;
      at?: string;
    }
  | {
      type: "dialog.open";
      dialog:
        | "palette"
        | "approval"
        | "question"
        | "sessions"
        | "settings"
        | "status";
    }
  | { type: "dialog.close" }
  | {
      type: "approval.request";
      id: string;
      title: string;
      preview: string;
      detail?: string;
      keyArguments?: string[];
      sensitive?: boolean;
    }
  | {
      type: "approval.response";
      id: string;
      decision: ApprovalResponse["decision"];
      feedback?: string;
    }
  | {
      type: "question.request";
      id: string;
      title: string;
      options?: string[];
      questions?: QuestionItem[];
    }
  | {
      type: "question.response";
      id: string;
      answers: string[][];
      rejected?: boolean;
    }
  | { type: "snapshot.created"; id: string; files: string[] }
  | {
      type: "turn.finished";
      id: string;
      stopReason: "done" | "cancelled" | "error";
    };

export type SubmittedTurn = Extract<RuntimeEvent, { type: "turn.submitted" }>;
export type LocalAttachment = {
  id: string;
  path: string;
  filename: string;
  mediaType:
    | "image/png"
    | "image/jpeg"
    | "application/pdf"
    | "text/plain"
    | "text/markdown"
    | "application/json"
    | "text/csv";
  byteLength: number;
  sha256: string;
};
export type PromptResourceMention = {
  server: string;
  uri: string;
  name: string;
  mimeType?: string;
};
export type PromptAgentMention = { name: string };
export type SubmitInput = {
  text: string;
  delivery?: "steer" | "queue";
  id?: string;
  attachments?: string[];
  resources?: PromptResourceMention[];
  agents?: PromptAgentMention[];
};
export type RuntimeHistoryEvent = { seq: number; event: RuntimeEvent };
export type RuntimeHistory = {
  events: RuntimeHistoryEvent[];
  hasMore: boolean;
};
export type RuntimeProjectedMessageRowKind =
  | "user"
  | "thinking"
  | "assistant"
  | "tool"
  | "approval"
  | "question"
  | "system";
export type RuntimeProjectedMessageRow = {
  id: string;
  turnID: string;
  kind: RuntimeProjectedMessageRowKind;
  event: RuntimeEvent;
};
export type RuntimeProjectedMessage = {
  id: string;
  turnID: string;
  submitted: SubmittedTurn;
  rows: RuntimeProjectedMessageRow[];
  stopReason?: Extract<RuntimeEvent, { type: "turn.finished" }>["stopReason"];
};
export type RuntimeMessageCursor = {
  previous?: string;
  next?: string;
};
export type RuntimeMessagePage = {
  data: RuntimeProjectedMessage[];
  cursor: RuntimeMessageCursor;
};
export type PendingInteractiveRequests = {
  approvals: Array<Extract<RuntimeEvent, { type: "approval.request" }>>;
  questions: Array<Extract<RuntimeEvent, { type: "question.request" }>>;
};
export type MCPPromptCatalog = {
  server: string;
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
};
export type MCPResourceCatalog = {
  server: string;
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
};
export type MCPCatalogSnapshot = {
  prompts: MCPPromptCatalog[];
  resources: MCPResourceCatalog[];
};
export type PluginStatus = {
  id: string;
  version: string;
  name: string;
  description: string;
  capabilities: string[];
};
export type WorkflowSnapshot = {
  id: string;
  workflow: string;
  status: "running" | "completed" | "failed" | "cancelled";
  completedStepIDs: string[];
  values: Record<string, string>;
};
export type RuntimeStatusSnapshot = Extract<
  RuntimeEvent,
  { type: "status.snapshot" }
>;
export type RuntimeDiagnostic = Extract<
  RuntimeEvent,
  { type: "diagnostic" }
> & { at: string };
export type RuntimeModelCatalogEntry = {
  id: string;
  name: string;
  provider: string;
  variants: string[];
};
export type RuntimeModelSelection = {
  modelID?: string;
  variant?: string;
};
export type RuntimeAgentCatalogEntry = {
  name: string;
  description: string;
  mode: "primary" | "subagent" | "all";
  hidden: boolean;
  color?: string;
  model?: string;
  variant?: string;
  maxSteps?: number;
  allowedTools?: string[];
  excludedTools?: string[];
  mcpServers?: string[];
  permissions?: AgentPermissionRules;
};
export type RuntimeSkillCatalogEntry = {
  name: string;
  qualifiedName: string;
  description: string;
  source: "project" | "user" | "remote";
  requireApproval: boolean;
  sandboxRequired: boolean;
};
export type RuntimeSlashCommand = {
  name: string;
  description: string;
  acceptsArguments?: boolean;
};
export type RuntimeWorkspaceFileEntry = {
  path: string;
  type: "file" | "directory";
};
export type RuntimeWorkspaceListPage = {
  entries: RuntimeWorkspaceFileEntry[];
  truncated: boolean;
  next?: number;
};
export type RuntimeWorkspaceMatch = {
  path: string;
  line: number;
  text: string;
};
export type RuntimeWorkspaceContent = {
  path: string;
  content: string;
  encoding: "utf8" | "base64";
  mime: string;
  offset?: number;
  truncated?: boolean;
  next?: number;
};
export type RuntimePTYSession = {
  id: string;
  command: string;
  cwd: string;
  status: PTYStatus;
  attached: boolean;
  rows: number;
  cols: number;
  transcript: string;
  tail: string;
  startedAt: string;
  endedAt?: string;
  secretAudit: Array<{
    at: string;
    action: "write" | "prompt_detected";
    summary: string;
    sha256?: string;
  }>;
};
export type RuntimeSessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  lastAccessedAt?: string;
  pinned: boolean;
  events: number;
  pendingInputs: number;
  cancelled: boolean;
  resumable: boolean;
};
// Keep TUI completion and runtime command handling on one local vocabulary.
export const runtimeSlashCommands: RuntimeSlashCommand[] = [
  { name: "help", description: "Show runtime command help" },
  { name: "doctor", description: "Inspect runtime and provider health" },
  { name: "status", description: "Show the runtime status snapshot" },
  {
    name: "diagnostics",
    description: "Show durable runtime diagnostics",
    acceptsArguments: true,
  },
  { name: "sessions", description: "List durable sessions" },
  {
    name: "files",
    description: "Find workspace files",
    acceptsArguments: true,
  },
  {
    name: "search",
    description: "Search workspace file content",
    acceptsArguments: true,
  },
  { name: "agents", description: "List selectable agents" },
  {
    name: "agent",
    description: "Select the next-turn agent",
    acceptsArguments: true,
  },
  { name: "models", description: "List selectable models" },
  {
    name: "model",
    description: "Select model and variant",
    acceptsArguments: true,
  },
  { name: "skills", description: "List discovered skills" },
  { name: "skill", description: "Activate a skill", acceptsArguments: true },
  {
    name: "skill-resource",
    description: "Read an active skill resource",
    acceptsArguments: true,
  },
  {
    name: "skill-script",
    description: "Run an active skill script",
    acceptsArguments: true,
  },
  {
    name: "attach",
    description: "Submit a workspace attachment",
    acceptsArguments: true,
  },
  {
    name: "editor",
    description: "Open the composer draft in an external editor",
    acceptsArguments: true,
  },
  { name: "checkpoint", description: "Create a workspace checkpoint" },
  { name: "checkpoints", description: "List workspace checkpoints" },
  {
    name: "rollback",
    description: "Restore a checkpoint",
    acceptsArguments: true,
  },
  { name: "pause", description: "Pause at a safe runtime boundary" },
  { name: "resume", description: "Resume runtime execution" },
];

/** Streaming fragments are transport-live; their completed settlements are durable. */
export function runtimeEventDurability(
  event: RuntimeEvent,
): "durable" | "live" {
  switch (event.type) {
    case "content.delta":
    case "thinking.delta":
    case "context.status":
    case "status.update":
    case "pty.update":
      return "live";
    case "tool.update":
      return ["succeeded", "failed", "rejected", "cancelled"].includes(
        event.status,
      )
        ? "durable"
        : "live";
    default:
      return "durable";
  }
}

export type RuntimeClient = {
  start(onEvent: (event: RuntimeEvent) => void): void;
  submit(text: string): Promise<SubmittedTurn>;
  submitInput?(input: SubmitInput): Promise<SubmittedTurn>;
  history?(options?: {
    after?: number;
    limit?: number;
  }): Promise<RuntimeHistory>;
  messages?(options?: {
    limit?: number;
    order?: "asc" | "desc";
    cursor?: string;
  }): Promise<RuntimeMessagePage>;
  pendingInteractive?(): Promise<PendingInteractiveRequests>;
  dispose?(): Promise<void>;
  cancel(reason?: string): void;
  pause?(reason?: string): void;
  resume?(): void;
  selectAgent?(name?: string): void;
  agents?(): Promise<RuntimeAgentCatalogEntry[]>;
  modelCatalog?(): Promise<RuntimeModelCatalogEntry[]>;
  modelSelection?(): Promise<RuntimeModelSelection>;
  selectModel?(modelID?: string, variant?: string): Promise<void>;
  skills?(): Promise<RuntimeSkillCatalogEntry[]>;
  workspaceFiles?(input?: {
    query?: string;
    type?: "file" | "directory";
    limit?: number;
  }): Promise<RuntimeWorkspaceFileEntry[]>;
  workspaceSearch?(input: {
    query: string;
    include?: string;
    limit?: number;
  }): Promise<RuntimeWorkspaceMatch[]>;
  workspaceList?(input?: {
    path?: string;
    offset?: number;
    limit?: number;
  }): Promise<RuntimeWorkspaceListPage>;
  workspaceRead?(input: {
    path: string;
    offset?: number;
    limit?: number;
  }): Promise<RuntimeWorkspaceContent>;
  workspaceGlob?(input: {
    pattern: string;
    path?: string;
    limit?: number;
  }): Promise<RuntimeWorkspaceFileEntry[]>;
  ptyList?(): Promise<RuntimePTYSession[]>;
  ptyRead?(input: { id: string; offset?: number; maxChars?: number }): Promise<
    RuntimePTYSession & {
      offset: number;
      nextOffset: number;
      totalChars: number;
      truncated: boolean;
    }
  >;
  ptyWrite?(input: {
    id: string;
    text: string;
    submit?: boolean;
    sensitive?: boolean;
  }): Promise<RuntimePTYSession>;
  ptyKey?(input: {
    id: string;
    key: "enter" | "ctrl-c" | "ctrl-d" | "tab" | "esc";
  }): Promise<RuntimePTYSession>;
  ptyResize?(input: {
    id: string;
    rows: number;
    cols: number;
  }): Promise<RuntimePTYSession>;
  ptyAttach?(id: string): Promise<RuntimePTYSession>;
  ptyDetach?(id: string): Promise<RuntimePTYSession>;
  ptyStop?(id: string): Promise<RuntimePTYSession>;
  checkpointList?(): Promise<RuntimeCheckpoint[]>;
  checkpointPreview?(id: string): Promise<CheckpointPreview>;
  checkpointRollback?(input: {
    id: string;
    dryRun?: boolean;
  }): Promise<CheckpointPreview>;
  sandboxList?(): Promise<RuntimeSandbox[]>;
  sandboxDiff?(id: string): Promise<RuntimeSandboxChange[]>;
  sandboxResources?(id: string): Promise<RuntimeSandboxResource[]>;
  sandboxResourceOutput?(input: {
    id: string;
    resourceID: string;
    maxBytes?: number;
  }): Promise<string>;
  sandboxMerge?(id: string): Promise<RuntimeSandboxChange[]>;
  sandboxDelete?(id: string): Promise<{
    pendingChanges: RuntimeSandboxChange[];
    runningResources: string[];
  }>;
  sandboxResourceStop?(input: {
    id: string;
    resourceID: string;
  }): Promise<RuntimeSandboxResource>;
  sessionList?(): Promise<RuntimeSessionSummary[]>;
  sessionTouch?(id: string): Promise<void>;
  sessionRename?(id: string, title: string): Promise<RuntimeSessionSummary>;
  sessionPin?(id: string, pinned: boolean): Promise<RuntimeSessionSummary>;
  sessionDuplicate?(id: string, title?: string): Promise<RuntimeSessionSummary>;
  sessionFork?(
    id: string,
    turnID: string,
    title?: string,
  ): Promise<RuntimeSessionSummary>;
  sessionDelete?(
    id: string,
  ): Promise<{ id: string; removedAttachments: number }>;
  mcpCatalog?(): Promise<MCPCatalogSnapshot>;
  getMcpPrompt?(
    server: string,
    name: string,
    arguments_?: Record<string, string>,
  ): Promise<unknown>;
  readMcpResource?(server: string, uri: string): Promise<unknown>;
  plugins?(): Promise<PluginStatus[]>;
  runWorkflow?(input: {
    workflow: string;
    runID?: string;
  }): Promise<WorkflowSnapshot>;
  workflowStatus?(runID: string): Promise<WorkflowSnapshot | undefined>;
  runtimeStatus?(): Promise<RuntimeStatusSnapshot>;
  diagnostics?(limit?: number): Promise<RuntimeDiagnostic[]>;
  snapshot(): RuntimeEvent;
  diagnostic(message: string, level?: "info" | "warning" | "error"): void;
  lastSubmission(): SubmittedTurn | undefined;
  respondApproval(response: ApprovalResponse): void;
  respondQuestion(response: QuestionResponse): void;
};

export type FakeBackend = RuntimeClient;
