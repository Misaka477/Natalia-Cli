export interface ToolCall {
  name: string;
  output?: string;
  status?: string;
  summary?: string;
}

export interface MessageAction {
  label: string;
  primary?: boolean;
  onClick: () => void;
}

export interface Attachment {
  id?: string;
  path: string;
  name: string;
  mediaType?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  status?: "running" | "completed" | "error" | "done" | "failed";
  /** A user input injected into a running turn rather than starting one. */
  steering?: boolean;
  thinking?: boolean;
  streaming?: boolean;
  toolCalls?: ToolCall[];
  actions?: MessageAction[];
  attachments?: Attachment[];
}
