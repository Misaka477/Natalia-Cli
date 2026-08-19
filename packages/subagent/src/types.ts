export type SubagentID = string;

export type SubagentStatus =
  | "idle"
  | "running"
  | "paused"
  | "stopped"
  | "completed"
  | "failed";

export type SubagentPhase =
  | "idle"
  | "queued"
  | "provider"
  | "tool"
  | "retrying"
  | "finalizing"
  | "waiting";

export type SubagentHealth = "active" | "quiet" | "stalled" | "terminal";

export interface OutputEntry {
  step: number;
  text: string;
  timestamp: number;
}

export interface AuditEntry {
  eventId: string;
  agentId: SubagentID;
  action: string;
  status: string;
  timestamp: number;
  attached: boolean;
  stopReason?: string;
  requestedBy?: "model" | "user" | "parent" | "runtime";
  force?: boolean;
}

export interface SubagentEvent {
  agentId: SubagentID;
  event: string;
  status: string;
  attached: boolean;
  text?: string;
  timestamp: number;
  parentSessionID?: string;
  parentAgentID?: SubagentID;
  continuation?: number;
  phase?: SubagentPhase;
  activityDetail?: string;
  stopReason?: string;
  requestedBy?: "model" | "user" | "parent" | "runtime";
  force?: boolean;
}

export interface SubagentRecord {
  id: SubagentID;
  task: string;
  mode: string;
  status: SubagentStatus;
  attached: boolean;
  modelProfile: string;
  allowedTools: string[];
  excludeTools: string[];
  writePaths?: string[];
  outputs: OutputEntry[];
  createdAt: number;
  updatedAt: number;
  parentSessionID?: string;
  parentAgentID?: SubagentID;
  continuation?: number;
  phase: SubagentPhase;
  lastActivityAt: number;
  activityDetail: string;
  startedAt: number;
  endedAt?: number;
}

export interface SpawnOptions {
  mode?: string;
  modelProfile?: string;
  allowedTools?: string[];
  excludeTools?: string[];
  writePaths?: string[];
  signal?: AbortSignal;
  parentSessionID?: string;
  parentAgentID?: SubagentID;
  maxDepth?: number;
}

export interface RunnerContext {
  agentId: SubagentID;
  log(text: string): void;
  setStatus(status: string): void;
  signal: AbortSignal;
  reportActivity(phase: SubagentPhase, detail: string): void;
}

export type RunnerCallback = (
  task: string,
  context: RunnerContext,
) => void | Promise<void>;

export interface SubagentRegistryOptions {
  runner: RunnerCallback;
  workDir?: string;
  sessionID?: string;
  /** Time source; defaults to Date.now for production. */
  clock?: () => number;
  /** Grace period before idle→stalled; 0 uses the default. */
  stallThresholdMs?: number;
}
