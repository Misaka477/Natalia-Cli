export type SubagentID = string;

export type SubagentStatus =
  | "idle"
  | "running"
  | "paused"
  | "stopped"
  | "completed"
  | "failed";

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
  outputs: OutputEntry[];
  createdAt: number;
  updatedAt: number;
  parentSessionID?: string;
  parentAgentID?: SubagentID;
  continuation?: number;
}

export interface SpawnOptions {
  mode?: string;
  modelProfile?: string;
  allowedTools?: string[];
  excludeTools?: string[];
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
}

export type RunnerCallback = (
  task: string,
  context: RunnerContext,
) => void | Promise<void>;

export interface SubagentRegistryOptions {
  runner: RunnerCallback;
  workDir?: string;
}
