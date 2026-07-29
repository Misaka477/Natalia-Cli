import type { RuntimeEvent, RuntimeProjectedMessage, SubmittedTurn } from "@natalia/contracts";

export type MessageBlock = {
  id: string;
  role: string;
  text: string;
  pendingText: string;
  status?: string;
  interactive?: {
    kind: "approval" | "question";
    request: { id: string; title: string; preview?: string; questions?: any[] };
    response?: { decision?: string; answers?: string[][] };
  };
  tool?: {
    name: string;
    kind: string;
    status: string;
    summary: string;
    elapsed?: string;
    redactedArguments?: string;
    keyArguments: string[];
    argumentsComplete: boolean;
    result?: { summary: string; preview: string; detail: string; truncated?: boolean };
    detailAvailable: boolean;
    metadata: Record<string, unknown>;
  };
  providerPolicy?: "hidden" | "visible";
};

export type AppState = {
  messages: MessageBlock[];
  streams: Record<string, StreamState>;
  streamPhases: Record<string, "thinking" | "assistant">;
  activeTurn?: string;
  tools: Record<string, any>;
  subagents: Record<string, any>;
  subagentHistory: Record<string, any[]>;
  terminals: Record<string, any>;
  terminalTimeline: Record<string, any[]>;
  sandboxes: Record<string, any>;
  mcp: Record<string, any>;
  checkpoints: any[];
  workspaceResources: any[];
  interactive: any[];
  pendingApprovals: any[];
  pendingQuestions: any[];
  statusSegments: string[];
  lastSubmission?: SubmittedTurn;
  lastAgentSelection?: { name?: string; pending: boolean };
  lastModelSelection?: { modelID?: string; variant?: string };
};

export type StreamState = {
  committed: string;
  tail: string;
  retrySkip: string;
  attempt: number;
  segmentIndex: number;
  segmentText: string;
  deferVisible: boolean;
};

export function newStream(): StreamState {
  return {
    committed: "",
    tail: "",
    retrySkip: "",
    attempt: 1,
    segmentIndex: 0,
    segmentText: "",
    deferVisible: false,
  };
}

export function segmentID(baseID: string, index: number) {
  if (index === 0) return baseID;
  return `${baseID}:segment:${index}`;
}

export function streamID(turnID: string, role: "thinking" | "assistant") {
  return `${turnID}:${role}`;
}

export function toolStateID(event: { id: string; name: string; callID?: string }) {
  return `${event.id}:tool:${event.callID ?? event.name}`;
}

export function upsertBlock(
  state: AppState,
  id: string,
  role: string,
  text: string,
  status?: string,
  extra?: Partial<MessageBlock>,
) {
  const block = state.messages.find((item) => item.id === id);
  if (block) {
    if (block.text !== text) block.text = text;
    if (status && block.status !== status) block.status = status;
    if (extra) Object.assign(block, extra);
    return;
  }
  state.messages.push({ id, role, text, pendingText: "", status, ...extra });
}
