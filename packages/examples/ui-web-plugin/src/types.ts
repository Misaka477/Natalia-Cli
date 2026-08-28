// Shared types for the UI plugin

export interface NavSession {
  id: string;
  title: string;
  state: "idle" | "running" | "error";
  active?: boolean;
}

export interface NavWorkspace {
  id: string;
  name: string;
  sessions: NavSession[];
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  status?: "running" | "completed" | "error" | "done" | "failed";
  thinking?: boolean;
  streaming?: boolean;
  toolCalls?: ToolCall[];
  actions?: MessageAction[];
}

export interface ToolCall {
  name: string;
  output?: string;
}

export interface MessageAction {
  label: string;
  primary?: boolean;
  onClick: () => void;
}

export interface Attachment {
  path: string;
  name: string;
}
