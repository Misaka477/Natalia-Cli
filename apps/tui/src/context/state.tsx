import { createContext, onMount, useContext, type JSX } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type {
  RuntimeEvent,
  SessionID,
  SubmittedTurn,
  ToolStatus,
} from "@natalia/contracts";
import {
  appendWithRetrySkip,
  checkpointProgressView,
  flushMarkdown,
  splitMarkdownAtSafeBoundary,
} from "@natalia/ui-model";
import {
  classifyTool,
  elapsedLabel,
  parseToolArguments,
  providerSafeThinkingSummary,
  resultView,
  type ToolKind,
  type ToolResultView,
} from "@natalia/ui-model";
import {
  activeModal,
  cancelPendingModals,
  enqueueApproval,
  enqueueQuestion,
  initialModalState,
  normalizeQuestionRequest,
  resolveApproval,
  resolveQuestion,
  type ModalControllerState,
} from "@natalia/ui-model";

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
  modal: ModalControllerState;
  streams: Record<string, StreamState>;
  tools: Record<string, ToolBlockState>;
  retryBanner?: string;
  compactionBanner?: string;
  pty: Record<string, Extract<RuntimeEvent, { type: "pty.update" }>>;
  ptyTimeline: Record<
    string,
    Extract<RuntimeEvent, { type: "pty.timeline" }>[]
  >;
  ptyPane: { selectedID?: string; focus: "chat" | "pty" };
  sandboxes: Record<string, Extract<RuntimeEvent, { type: "sandbox.update" }>>;
};

export const initialState: AppState = {
  title: "Natalia M7 TUI Modals",
  status: "booting",
  footer: "TypeScript/Bun + Solid/OpenTUI fake backend",
  statusSegments: ["mode:fixture", "model:gpt-5.5", "provider:fake"],
  modal: structuredClone(initialModalState),
  streams: {},
  tools: {},
  pty: {},
  ptyTimeline: {},
  ptyPane: { focus: "chat" },
  sandboxes: {},
  messages: [
    {
      id: "welcome",
      role: "system",
      text: "M7 shell: approval/question modal framework; legacy Go fallback frozen.",
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
    case "context.status":
      state.statusSegments = [
        "mode:fixture",
        ...state.statusSegments.filter(
          (segment) =>
            !segment.startsWith("ctx:") &&
            !segment.startsWith("threshold:") &&
            !segment.startsWith("reserved:"),
        ),
        `ctx:${event.used}/${event.max} ${Math.round((event.used / event.max) * 100)}%`,
        `threshold:${event.thresholdPercent}%`,
        `reserved:${event.reserved}`,
      ].slice(0, 7);
      state.footer = `context ${event.used}/${event.max} source=${event.source}${event.trigger ? ` trigger=${event.trigger}` : ""}`;
      return;
    case "compaction.begin":
      state.compactionBanner = `Compacting after ${event.trigger} · before ${event.beforeTokens}/${event.maxTokens} · reserved ${event.reservedTokens}`;
      state.footer = state.compactionBanner;
      upsertBlock(
        state,
        event.id,
        "system",
        state.compactionBanner,
        "compacting",
      );
      return;
    case "compaction.end":
      state.compactionBanner = undefined;
      upsertBlock(
        state,
        event.id,
        "system",
        event.success
          ? `compaction complete: ${event.beforeTokens} -> ${event.afterTokens} tokens in ${event.durationMs}ms`
          : `compaction failed atomically: ${event.error ?? "unknown"}`,
        event.success ? "compacted" : "failed",
      );
      state.footer = event.success
        ? "compaction complete"
        : "compaction failed";
      return;
    case "context.limit.recovery":
      upsertBlock(
        state,
        `${event.id}:context-limit`,
        "system",
        event.compacted
          ? "context-limit recovery compacted once; retrying original step"
          : "context-limit recovery requested",
        "context_limit",
      );
      return;
    case "checkpoint.created":
    case "checkpoint.failed":
    case "checkpoint.unavailable":
    case "rollback.previewed":
    case "rollback.begin":
    case "rollback.end":
    case "rollback.failed":
      handleCheckpointEvent(state, event);
      return;
    case "pty.update":
      const isNewPTY = !state.pty[event.id];
      state.pty[event.id] = event;
      if (
        event.ownership === "model" &&
        (isNewPTY || !state.ptyPane.selectedID) &&
        event.status !== "exited" &&
        event.status !== "failed"
      ) {
        state.ptyPane.selectedID = event.id;
      }
      if (
        state.ptyPane.selectedID === event.id &&
        (event.status === "exited" || event.status === "failed")
      ) {
        state.ptyPane.selectedID = nextActivePTY(state, event.id);
        if (!state.ptyPane.selectedID) state.ptyPane.focus = "chat";
      }
      upsertBlock(
        state,
        `pty:${event.id}`,
        "system",
        `PTY ${event.id} ${event.status} ${event.activity} ${targetLabel(event.target)} ${event.rows}x${event.cols}\ncmd: ${event.command}\nprompt: ${event.prompt ?? "-"}\nlast: ${event.lastAction ?? "-"}\ntail: ${event.tail}`,
        event.status,
      );
      return;
    case "pty.pane.select":
      if (activePTYIDs(state).includes(event.id)) {
        state.ptyPane.selectedID = event.id;
        state.ptyPane.focus = "pty";
      }
      return;
    case "pty.pane.focus":
      state.ptyPane.focus = event.focus;
      state.ptyPane.selectedID ??= nextActivePTY(state);
      return;
    case "pty.timeline":
      const timeline = (state.ptyTimeline[event.id] ??= []);
      if (
        !timeline.some(
          (item) =>
            item.at === event.at &&
            item.action === event.action &&
            item.status === event.status &&
            item.actor === event.actor,
        )
      ) {
        timeline.push(event);
        state.ptyTimeline[event.id] = timeline.slice(-40);
      }
      return;
    case "pty.approval":
      state.footer = `PTY ${event.id} ${event.state}: ${event.reason}`;
      return;
    case "pty.action":
      state.footer =
        `pty ${event.id} ${event.action} ${event.redacted ? "[redacted]" : ""}`.trim();
      return;
    case "sandbox.update":
      state.sandboxes[event.id] = event;
      upsertBlock(
        state,
        `sandbox:${event.id}`,
        "system",
        `Sandbox ${event.id} ${event.status} isolation=${event.isolationLevel}\nroot: ${event.root}\nchanged: ${event.changedFiles} running: ${event.runningResources}\ntarget: ${targetLabel(event.target)}\npolicy: ${event.resourcePolicy}`,
        event.status,
      );
      return;
    case "sandbox.diff":
      upsertBlock(
        state,
        `sandbox:${event.id}:diff`,
        "system",
        event.changes
          .map(
            (change) =>
              `${change.kind}: ${change.oldPath ? `${change.oldPath} -> ` : ""}${change.path}${change.mode ? ` mode=${change.mode}` : ""}`,
          )
          .join("\n"),
        "diff",
      );
      return;
    case "sandbox.audit":
      upsertBlock(
        state,
        `sandbox:${event.id}:audit:${event.action}`,
        "system",
        `audit ${event.action}: ${event.message}\ntarget: ${targetLabel(event.target)}\napproval: ${event.approvalRequired ? "required" : "not required"}\ncheckpoint: ${event.checkpointPolicy}`,
        "audit",
      );
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
    case "step.retry":
      handleStepRetry(state, event);
      return;
    case "step.retry.cleared":
      removeBlock(state, retryBlockID(event.id));
      state.retryBanner = undefined;
      state.footer = `retry recovered after ${event.attempts} attempts`;
      return;
    case "step.retry.exhausted":
      removeBlock(state, retryBlockID(event.id));
      state.retryBanner = undefined;
      upsertBlock(
        state,
        `${event.id}:retry:exhausted`,
        "system",
        `retry exhausted after ${event.attempts}/${event.maxAttempts}: ${event.message}`,
        "retry_exhausted",
      );
      state.footer = `retry exhausted: ${event.reason}`;
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
      enqueueApproval(state.modal, event);
      state.dialog = activeModal(state.modal)?.kind;
      upsertBlock(
        state,
        event.id,
        "approval",
        `${event.title}: ${event.preview}`,
        "awaiting_approval",
      );
      return;
    case "approval.response":
      resolveApproval(state.modal, {
        requestID: event.id,
        decision: event.decision,
        feedback: event.feedback,
      });
      state.dialog = activeModal(state.modal)?.kind;
      upsertBlock(
        state,
        event.id,
        "approval",
        approvalResponseText(event.decision, event.feedback),
        event.decision,
      );
      return;
    case "question.request":
      enqueueQuestion(state.modal, normalizeQuestionRequest(event));
      state.dialog = activeModal(state.modal)?.kind;
      upsertBlock(
        state,
        event.id,
        "question",
        questionRequestText(normalizeQuestionRequest(event)),
        "awaiting",
      );
      return;
    case "question.response":
      resolveQuestion(state.modal, {
        requestID: event.id,
        answers: event.answers,
        rejected: event.rejected,
      });
      state.dialog = activeModal(state.modal)?.kind;
      upsertBlock(
        state,
        event.id,
        "question",
        questionResponseText(event.answers, event.rejected),
        event.rejected ? "rejected" : "answered",
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
      cancelPendingModals(state.modal, event.reason);
      state.dialog = undefined;
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

function handleCheckpointEvent(
  state: AppState,
  event: Extract<
    RuntimeEvent,
    {
      type:
        | "checkpoint.created"
        | "checkpoint.failed"
        | "checkpoint.unavailable"
        | "rollback.previewed"
        | "rollback.begin"
        | "rollback.end"
        | "rollback.failed";
    }
  >,
) {
  const view = checkpointProgressView(event);
  const sequence = state.messages.length;
  const id =
    event.type === "checkpoint.created"
      ? `checkpoint:${event.id}:${sequence}`
      : event.type === "rollback.previewed"
        ? `rollback:${event.preview.checkpointID}:preview:${sequence}`
        : event.type === "rollback.begin" ||
            event.type === "rollback.end" ||
            event.type === "rollback.failed"
          ? `rollback:${event.checkpointID}:${event.type}:${sequence}`
          : `checkpoint:${event.type}:${sequence}`;
  const detail = checkpointEventDetail(event, view?.detail ?? event.type);
  upsertBlock(
    state,
    id,
    "system",
    `${view?.title ?? event.type}\n${detail}`,
    view?.severity ?? "info",
  );
  state.footer = view?.detail ?? event.type;
  if (event.type === "checkpoint.created") {
    state.statusSegments = [
      ...state.statusSegments.filter((segment) => !segment.startsWith("chk:")),
      `chk:${event.id}`,
    ].slice(-7);
  }
}

function checkpointEventDetail(
  event: Extract<
    RuntimeEvent,
    {
      type:
        | "checkpoint.created"
        | "checkpoint.failed"
        | "checkpoint.unavailable"
        | "rollback.previewed"
        | "rollback.begin"
        | "rollback.end"
        | "rollback.failed";
    }
  >,
  fallback: string,
) {
  if (event.type !== "rollback.previewed") return fallback;
  const changes = event.preview.changes
    .map(
      (change) =>
        `${change.kind}: ${change.oldPath ? `${change.oldPath} -> ` : ""}${change.path}${change.mode ? ` mode=${change.mode}` : ""}`,
    )
    .join("\n");
  const resources = event.preview.resources
    .map((resource) => `${resource.kind}:${resource.id} ${resource.action}`)
    .join("\n");
  return [fallback, changes, resources].filter(Boolean).join("\n");
}

function approvalResponseText(decision: string, feedback?: string) {
  if (decision === "once") return "approved once";
  if (decision === "session") return "approved for session";
  return ["rejected", feedback].filter(Boolean).join(": ");
}

function questionRequestText(
  request: ReturnType<typeof normalizeQuestionRequest>,
) {
  return `${request.title}: ${request.questions
    .map((question) => question.header)
    .join(" / ")}`;
}

function questionResponseText(answers: string[][], rejected?: boolean) {
  if (rejected) return "question rejected";
  return `answered: ${answers.map((answer) => answer.join(", ") || "(empty)").join("; ")}`;
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

function handleStepRetry(
  state: AppState,
  event: Extract<RuntimeEvent, { type: "step.retry" }>,
) {
  removeStreamTail(state, event.id);
  for (const role of ["thinking", "assistant"] as const) {
    const id = streamID(event.id, role);
    const stream = (state.streams[id] ??= newStream());
    stream.retrySkip = stream.committed;
    stream.tail = "";
    stream.attempt = event.attempt;
    const segment = state.messages.find(
      (item) => item.id === segmentID(id, stream.segmentIndex),
    );
    if (segment) segment.pendingText = "";
  }
  const text = `Retrying after ${event.reason}${event.statusCode ? ` (${event.statusCode})` : ""} · attempt ${event.attempt}/${event.maxAttempts} · waiting ${formatWait(event.waitMs)}`;
  state.retryBanner = text;
  state.footer = text;
  upsertBlock(state, retryBlockID(event.id), "system", text, "retry");
}

function retryBlockID(turnID: string) {
  return `${turnID}:retry:live`;
}

function formatWait(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function targetLabel(
  target: Extract<RuntimeEvent, { type: "pty.update" }>["target"],
) {
  if (target.kind === "host") return `host:${target.cwd}`;
  return `sandbox:${target.sandboxID}:${target.isolationLevel}`;
}

function activePTYIDs(state: AppState) {
  return Object.values(state.pty)
    .filter(
      (pty) =>
        pty.ownership === "model" &&
        pty.status !== "exited" &&
        pty.status !== "failed",
    )
    .map((pty) => pty.id);
}

function nextActivePTY(state: AppState, excludedID?: string) {
  return activePTYIDs(state).find((id) => id !== excludedID);
}

function removeBlock(state: AppState, id: string) {
  state.messages = state.messages.filter((item) => item.id !== id);
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
