import { createContext, onMount, useContext, type JSX } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type {
  RuntimeEvent,
  SessionID,
  SubmittedTurn,
  ToolStatus,
} from "../fake/contract";
import {
  appendWithRetrySkip,
  flushMarkdown,
  splitMarkdownAtSafeBoundary,
} from "../stream/markdown";
import {
  classifyTool,
  elapsedLabel,
  parseToolArguments,
  providerSafeThinkingSummary,
  resultView,
  type ToolKind,
  type ToolResultView,
} from "../tools/display";

export type MessageBlock = {
  id: string;
  role:
    | "system"
    | "user"
    | "thinking"
    | "assistant"
    | "tool"
    | "approval"
    | "question"
    | "snapshot";
  text: string;
  status?: string;
  pendingText?: string;
  reasoningVisible?: boolean;
  providerPolicy?: "visible" | "hidden";
  tool?: ToolBlockState;
};

export type ToolBlockState = {
  id: string;
  name: string;
  kind: ToolKind;
  status: ToolStatus;
  summary: string;
  argumentsRaw: string;
  argumentsComplete: boolean;
  keyArguments: string[];
  redactedArguments?: string;
  elapsed: string;
  result?: ToolResultView;
  detailAvailable: boolean;
};

type StreamState = {
  committed: string;
  tail: string;
  retrySkip: string;
  attempt: number;
  segmentIndex: number;
  segmentText: string;
};

const streamSegmentChars = 6000;

export type AppState = {
  sessionID?: SessionID;
  title: string;
  status: string;
  footer: string;
  statusSegments: string[];
  messages: MessageBlock[];
  activeTurn?: string;
  lastSubmission?: SubmittedTurn;
  dialog?: "palette" | "approval" | "question";
  streams: Record<string, StreamState>;
  tools: Record<string, ToolBlockState>;
};

export const initialState: AppState = {
  title: "Natalia M6 TUI Blocks",
  status: "booting",
  footer: "TypeScript/Bun + Solid/OpenTUI fake backend",
  statusSegments: ["mode:fixture", "model:gpt-5.5", "provider:fake"],
  streams: {},
  tools: {},
  messages: [
    {
      id: "welcome",
      role: "system",
      text: "M6 shell: streaming markdown/thinking and structured tool blocks; legacy Go fallback frozen.",
    },
  ],
};

export function reduceState(state: AppState, event: RuntimeEvent): AppState {
  const next = structuredClone(state) as AppState;
  applyEvent(next, event);
  return next;
}

export function StateProvider(props: {
  children: JSX.Element;
  onReady?: (dispatch: (event: RuntimeEvent) => void) => void;
}) {
  const [state, setState] = createStore<AppState>(initialState);
  const dispatch = (event: RuntimeEvent) =>
    setState(produce((draft) => applyEvent(draft, event)));
  onMount(() => props.onReady?.(dispatch));
  return (
    <StateContext.Provider value={{ state, dispatch }}>
      {props.children}
    </StateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(StateContext);
  if (!context) throw new Error("StateProvider missing");
  return context;
}

function applyEvent(state: AppState, event: RuntimeEvent) {
  switch (event.type) {
    case "session.created":
      state.sessionID = event.sessionID;
      state.title = event.title;
      return;
    case "session.ready":
      state.status = "ready";
      return;
    case "status.update":
      state.status = event.status;
      state.footer = [event.status, event.detail].filter(Boolean).join(" - ");
      return;
    case "status.snapshot":
      state.statusSegments = [
        "mode:fixture",
        `model:${event.model}`,
        `provider:${event.provider}`,
        `ctx:${event.context}`,
        `step:${event.step}`,
        event.permissions,
        `bg:${event.background}`,
      ];
      return;
    case "diagnostic":
      upsertBlock(
        state,
        `diagnostic:${Date.now()}`,
        "system",
        `${event.level}: ${event.message}`,
      );
      state.footer = event.message;
      return;
    case "dialog.open":
      state.dialog = event.dialog;
      return;
    case "dialog.close":
      state.dialog = undefined;
      return;
    case "turn.submitted":
      state.activeTurn = event.id;
      state.lastSubmission = event;
      state.streams[streamID(event.id, "thinking")] = newStream();
      state.streams[streamID(event.id, "assistant")] = newStream();
      state.messages.push({
        id: `${event.id}:user`,
        role: "user",
        text: event.text,
      });
      return;
    case "turn.retry":
      handleRetry(state, event);
      return;
    case "thinking.delta":
      appendStreamBlock(state, {
        id: streamID(event.id, "thinking"),
        role: "thinking",
        text: event.text,
        attempt: event.attempt,
        reasoningVisible: event.visible !== false,
      });
      return;
    case "thinking.done":
      flushStreamBlock(state, streamID(event.id, "thinking"));
      return;
    case "content.delta":
      appendStreamBlock(state, {
        id: streamID(event.id, "assistant"),
        role: "assistant",
        text: event.text,
        attempt: event.attempt,
        reasoningVisible: true,
      });
      return;
    case "content.done":
      flushStreamBlock(state, streamID(event.id, "assistant"));
      return;
    case "tool.update":
      upsertTool(state, event);
      return;
    case "approval.request":
      state.dialog = "approval";
      upsertBlock(
        state,
        event.id,
        "approval",
        `${event.title}: ${event.preview}`,
        "awaiting_approval",
      );
      return;
    case "question.request":
      state.dialog = "question";
      upsertBlock(
        state,
        event.id,
        "question",
        `${event.title}: ${event.options.join(" / ")}`,
        "awaiting",
      );
      return;
    case "snapshot.created":
      upsertBlock(
        state,
        event.id,
        "snapshot",
        `snapshot ${event.id}: ${event.files.join(", ")}`,
      );
      return;
    case "turn.cancelled":
      removeStreamTail(state, event.id);
      upsertBlock(
        state,
        `${event.id}:cancelled`,
        "system",
        `cancelled: ${event.reason}`,
      );
      return;
    case "turn.finished":
      flushStreamBlock(state, streamID(event.id, "thinking"));
      flushStreamBlock(state, streamID(event.id, "assistant"));
      state.activeTurn = undefined;
      state.status = event.stopReason === "done" ? "ready" : event.stopReason;
      return;
  }
}

function appendStreamBlock(
  state: AppState,
  input: {
    id: string;
    role: "thinking" | "assistant";
    text: string;
    attempt?: number;
    reasoningVisible: boolean;
  },
) {
  const stream = (state.streams[input.id] ??= newStream());
  stream.attempt = input.attempt ?? stream.attempt;
  const retryApplied = appendWithRetrySkip(input.text, stream.retrySkip);
  stream.retrySkip = retryApplied.retrySkip;
  if (!retryApplied.text) return;

  const split = splitMarkdownAtSafeBoundary(stream.tail + retryApplied.text);
  stream.tail = split.tail;
  if (split.committed)
    appendCommittedSegment(state, input, stream, split.committed);
  const pendingText = input.reasoningVisible ? stream.tail : "";
  if (!stream.segmentText && !pendingText) return;
  const visibleText =
    input.role === "thinking" && !input.reasoningVisible
      ? providerSafeThinkingSummary(false, stream.committed)
      : stream.segmentText;
  upsertBlock(
    state,
    segmentID(input.id, stream.segmentIndex),
    input.role,
    visibleText,
    undefined,
    {
      pendingText,
      reasoningVisible: input.reasoningVisible,
      providerPolicy: input.reasoningVisible ? "visible" : "hidden",
    },
  );
}

function flushStreamBlock(state: AppState, id: string) {
  const stream = state.streams[id];
  if (!stream) return;
  const flushed = flushMarkdown(stream.tail);
  if (flushed.committed) {
    appendCommittedSegment(
      state,
      {
        id,
        role: id.endsWith(":thinking") ? "thinking" : "assistant",
        text: flushed.committed,
        reasoningVisible:
          state.messages.find(
            (item) => item.id === segmentID(id, stream.segmentIndex),
          )?.providerPolicy !== "hidden",
      },
      stream,
      flushed.committed,
    );
  }
  stream.tail = flushed.tail;
  const block = state.messages.find(
    (item) => item.id === segmentID(id, stream.segmentIndex),
  );
  if (!block) return;
  block.text =
    block.role === "thinking" && block.providerPolicy === "hidden"
      ? providerSafeThinkingSummary(false, stream.committed)
      : stream.committed;
  block.pendingText = "";
}

function handleRetry(
  state: AppState,
  event: Extract<RuntimeEvent, { type: "turn.retry" }>,
) {
  removeStreamTail(state, event.id);
  for (const role of ["thinking", "assistant"] as const) {
    const id = streamID(event.id, role);
    const stream = (state.streams[id] ??= newStream());
    stream.retrySkip = stream.committed;
    stream.tail = "";
    stream.attempt = event.attempt;
    const block = state.messages.find((item) => item.id === id);
    if (block) {
      block.pendingText = "";
    }
    const segment = state.messages.find(
      (item) => item.id === segmentID(id, stream.segmentIndex),
    );
    if (segment) segment.pendingText = "";
  }
  upsertBlockBefore(
    state,
    `${event.id}:retry:${event.attempt}`,
    streamID(event.id, "assistant"),
    "system",
    `retry ${event.attempt}/${event.maxAttempts}: ${event.reason}; waiting ${event.retryAfterMs}ms`,
    "retry",
  );
}

function removeStreamTail(state: AppState, turnID: string) {
  for (const role of ["thinking", "assistant"] as const) {
    const stream = state.streams[streamID(turnID, role)];
    if (stream) stream.tail = "";
    const block = state.messages.find(
      (item) => item.id === streamID(turnID, role),
    );
    if (block) block.pendingText = "";
    if (stream) {
      const segment = state.messages.find(
        (item) =>
          item.id === segmentID(streamID(turnID, role), stream.segmentIndex),
      );
      if (segment) segment.pendingText = "";
    }
  }
}

function upsertTool(
  state: AppState,
  event: Extract<RuntimeEvent, { type: "tool.update" }>,
) {
  const id = `${event.id}:tool:${event.callID ?? event.name}`;
  const current = state.tools[id];
  const raw = (current?.argumentsRaw ?? "") + (event.argumentsDelta ?? "");
  const args = parseToolArguments(raw);
  const result =
    event.result === undefined ? current?.result : resultView(event.result);
  const tool: ToolBlockState = {
    id,
    name: event.name,
    kind: classifyTool(event.name, event.metadata),
    status: event.status,
    summary: event.summary,
    argumentsRaw: raw,
    argumentsComplete: args.complete,
    keyArguments: args.keyArguments,
    redactedArguments: args.redactedJson,
    elapsed: elapsedLabel(event.startedAt, event.endedAt),
    result,
    detailAvailable: Boolean(args.redactedJson || result?.detail),
  };
  state.tools[id] = tool;
  upsertBlock(state, id, "tool", toolText(tool), event.status, { tool });
}

function toolText(tool: ToolBlockState) {
  const args = tool.argumentsComplete
    ? tool.keyArguments.join(" ") || "arguments ready"
    : "receiving arguments";
  const elapsed = tool.elapsed ? ` · ${tool.elapsed}` : "";
  const result = tool.result ? ` · ${tool.result.summary}` : "";
  return `${tool.kind}:${tool.name} ${args} · ${tool.summary}${elapsed}${result}`;
}

function newStream(): StreamState {
  return {
    committed: "",
    tail: "",
    retrySkip: "",
    attempt: 1,
    segmentIndex: 0,
    segmentText: "",
  };
}

function streamID(turnID: string, role: "thinking" | "assistant") {
  return `${turnID}:${role}`;
}

function segmentID(baseID: string, index: number) {
  if (index === 0) return baseID;
  return `${baseID}:segment:${index}`;
}

function appendCommittedSegment(
  state: AppState,
  input: {
    id: string;
    role: "thinking" | "assistant";
    text: string;
    reasoningVisible: boolean;
  },
  stream: StreamState,
  text: string,
) {
  stream.committed += text;
  stream.segmentText += text;
  const hiddenThinking = input.role === "thinking" && !input.reasoningVisible;
  upsertBlock(
    state,
    segmentID(input.id, stream.segmentIndex),
    input.role,
    hiddenThinking
      ? providerSafeThinkingSummary(false, stream.committed)
      : stream.segmentText,
    undefined,
    {
      pendingText: "",
      reasoningVisible: input.reasoningVisible,
      providerPolicy: input.reasoningVisible ? "visible" : "hidden",
    },
  );
  if (stream.segmentText.length < streamSegmentChars) return;
  stream.segmentIndex += 1;
  stream.segmentText = "";
}

function upsertBlock(
  state: AppState,
  id: string,
  role: MessageBlock["role"],
  text: string,
  status?: string,
  extra: Partial<MessageBlock> = {},
) {
  const block = state.messages.find((item) => item.id === id);
  if (block) {
    block.text = text;
    block.status = status;
    block.pendingText = extra.pendingText;
    block.reasoningVisible = extra.reasoningVisible;
    block.providerPolicy = extra.providerPolicy;
    block.tool = extra.tool;
    return;
  }
  state.messages.push({ id, role, text, status, ...extra });
}

function upsertBlockBefore(
  state: AppState,
  id: string,
  beforeID: string,
  role: MessageBlock["role"],
  text: string,
  status?: string,
  extra: Partial<MessageBlock> = {},
) {
  upsertBlock(state, id, role, text, status, extra);
  const index = state.messages.findIndex((item) => item.id === id);
  const beforeIndex = state.messages.findIndex((item) => item.id === beforeID);
  if (index === -1 || beforeIndex === -1 || index < beforeIndex) return;
  const [block] = state.messages.splice(index, 1);
  state.messages.splice(beforeIndex, 0, block);
}

const StateContext = createContext<{
  state: AppState;
  dispatch: (event: RuntimeEvent) => void;
}>();
