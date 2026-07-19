import {
  batch,
  createContext,
  onCleanup,
  onMount,
  useContext,
  type JSX,
} from "solid-js";
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
  parseTodoItems,
  providerSafeThinkingSummary,
  resultView,
  type ToolKind,
  type TodoView,
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
    | "subagent"
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
  metadata: Record<string, unknown>;
  detailAvailable: boolean;
};

export type SubagentView = Extract<RuntimeEvent, { type: "subagent.update" }>;

type StreamState = {
  committed: string;
  tail: string;
  retrySkip: string;
  attempt: number;
  segmentIndex: number;
  segmentText: string;
  deferVisible: boolean;
};

const streamSegmentChars = 6000;
const eventBatchMs = 16;
const maxPTYTranscriptChars = 12000;

export type AppState = {
  sessionID?: SessionID;
  title: string;
  status: string;
  footer: string;
  statusSegments: string[];
  messages: MessageBlock[];
  activeTurn?: string;
  lastSubmission?: SubmittedTurn;
  dialog?:
    | "palette"
    | "approval"
    | "question"
    | "sessions"
    | "settings"
    | "status";
  modal: ModalControllerState;
  streams: Record<string, StreamState>;
  tools: Record<string, ToolBlockState>;
  subagents: Record<string, SubagentView>;
  subagentHistory: Record<string, SubagentView[]>;
  todos: TodoView[];
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
  title: "New session",
  status: "booting",
  footer: "Ready",
  statusSegments: [
    "mode:runtime",
    "model:not-connected",
    "provider:not-connected",
  ],
  modal: structuredClone(initialModalState),
  streams: {},
  tools: {},
  subagents: {},
  subagentHistory: {},
  todos: [],
  pty: {},
  ptyTimeline: {},
  ptyPane: { focus: "chat" },
  sandboxes: {},
  messages: [],
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
  const pendingEvents: RuntimeEvent[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  let lastFlush = 0;
  const flush = () => {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = undefined;
    if (!pendingEvents.length) return;
    const events = pendingEvents.splice(0);
    lastFlush = performance.now();
    batch(() => {
      setState(
        produce((draft) => {
          for (const event of events) applyEvent(draft, event);
        }),
      );
    });
  };
  const dispatch = (event: RuntimeEvent) => {
    pendingEvents.push(event);
    const elapsed = performance.now() - lastFlush;
    if (elapsed >= eventBatchMs || isUrgentEvent(event)) {
      flush();
      return;
    }
    if (!flushTimer) flushTimer = setTimeout(flush, eventBatchMs - elapsed);
  };
  onCleanup(() => {
    if (flushTimer) clearTimeout(flushTimer);
    flush();
  });
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
        "mode:runtime",
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
        "mode:runtime",
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
      const ptyEvent = compactPTYEvent(event);
      const isNewPTY = !state.pty[ptyEvent.id];
      state.pty[ptyEvent.id] = ptyEvent;
      if (
        ptyEvent.ownership === "model" &&
        (isNewPTY || !state.ptyPane.selectedID) &&
        ptyEvent.status !== "exited" &&
        ptyEvent.status !== "failed"
      ) {
        state.ptyPane.selectedID = ptyEvent.id;
      }
      if (
        state.ptyPane.selectedID === ptyEvent.id &&
        (ptyEvent.status === "exited" || ptyEvent.status === "failed")
      ) {
        state.ptyPane.selectedID = nextActivePTY(state, ptyEvent.id);
        if (!state.ptyPane.selectedID) state.ptyPane.focus = "chat";
      }
      upsertBlock(
        state,
        `pty:${ptyEvent.id}`,
        "system",
        `PTY ${ptyEvent.id} ${ptyEvent.status} ${ptyEvent.activity} ${targetLabel(ptyEvent.target)} ${ptyEvent.rows}x${ptyEvent.cols}\ncmd: ${ptyEvent.command}\nprompt: ${ptyEvent.prompt ?? "-"}\nlast: ${ptyEvent.lastAction ?? "-"}\ntail: ${ptyEvent.tail}`,
        ptyEvent.status,
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
        deferVisible: event.visible !== false,
      });
      return;
    case "thinking.done":
      revealDeferredStreamBlock(state, streamID(event.id, "thinking"));
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
      // Reasoning is step-atomic: reveal the fully collected reasoning before
      // its tool card, never as token-by-token text behind that tool.
      revealDeferredStreamBlock(state, streamID(event.id, "thinking"));
      flushStreamBlock(state, streamID(event.id, "assistant"));
      beginPostToolStreamSegment(state, event.id);
      upsertTool(state, event);
      return;
    case "subagent.update":
      state.subagents[event.id] = event;
      state.subagentHistory[event.id] = [
        ...(state.subagentHistory[event.id] ?? []),
        event,
      ].slice(-100);
      upsertBlock(
        state,
        `subagent:${event.id}`,
        "subagent",
        [
          `${event.id} · ${event.status} · ${event.attached ? "attached" : "detached"}`,
          event.task ?? "",
          event.text ?? "",
        ]
          .filter(Boolean)
          .join("\n"),
        event.event,
      );
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
      revealDeferredStreamBlock(state, streamID(event.id, "thinking"));
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
    deferVisible?: boolean;
  },
) {
  const stream = (state.streams[input.id] ??= newStream());
  stream.deferVisible = input.deferVisible === true;
  stream.attempt = input.attempt ?? stream.attempt;
  const retryApplied = appendWithRetrySkip(input.text, stream.retrySkip);
  stream.retrySkip = retryApplied.retrySkip;
  if (!retryApplied.text) return;

  const split = splitMarkdownAtSafeBoundary(stream.tail + retryApplied.text);
  stream.tail = split.tail;
  if (split.committed)
    appendCommittedSegment(state, input, stream, split.committed);
  if (stream.deferVisible) return;
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

function revealDeferredStreamBlock(state: AppState, id: string) {
  const stream = state.streams[id];
  if (!stream) return;
  const flushed = flushMarkdown(stream.tail);
  if (flushed.committed)
    appendCommittedSegment(
      state,
      {
        id,
        role: "thinking",
        text: flushed.committed,
        reasoningVisible: true,
      },
      stream,
      flushed.committed,
      true,
    );
  stream.tail = flushed.tail;
  if (stream.tail) {
    stream.committed += stream.tail;
    stream.segmentText += stream.tail;
    stream.tail = "";
  }
  if (!stream.segmentText) return;
  upsertBlock(
    state,
    segmentID(id, stream.segmentIndex),
    "thinking",
    stream.segmentText,
    "completed",
    { pendingText: "", reasoningVisible: true, providerPolicy: "visible" },
  );
  stream.deferVisible = false;
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
      : stream.segmentText;
  block.pendingText = "";
}

function beginPostToolStreamSegment(state: AppState, turnID: string) {
  for (const role of ["thinking", "assistant"] as const) {
    const stream = state.streams[streamID(turnID, role)];
    if (!stream || (!stream.segmentText && !stream.tail)) continue;
    stream.segmentIndex += 1;
    stream.segmentText = "";
    stream.tail = "";
  }
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
  const id = toolStateID(event);
  const current = state.tools[id];
  const raw = (current?.argumentsRaw ?? "") + (event.argumentsDelta ?? "");
  const args = parseToolArguments(raw);
  const kind = classifyTool(event.name, event.metadata);
  const result =
    event.result === undefined
      ? current?.result
      : resultView(event.result, 8, 1200, { kind, name: event.name });
  const tool: ToolBlockState = {
    id,
    name: event.name,
    kind,
    status: event.status,
    summary: event.summary,
    argumentsRaw: raw,
    argumentsComplete: args.complete,
    keyArguments: args.keyArguments,
    redactedArguments: args.redactedJson,
    elapsed: elapsedLabel(event.startedAt, event.endedAt),
    result,
    metadata: event.metadata ?? current?.metadata ?? {},
    detailAvailable: Boolean(args.redactedJson || result?.detail),
  };
  state.tools[id] = tool;
  if (kind === "todo" && args.redactedJson) {
    try {
      const input = JSON.parse(args.redactedJson) as Record<string, unknown>;
      const todos = parseTodoItems(input.items ?? input.todos);
      if (todos.length) state.todos = todos;
    } catch {
      // Partial arguments stay hidden until valid JSON is available.
    }
  }
  upsertBlock(state, id, "tool", toolText(tool), event.status, { tool });
}

function toolStateID(event: Extract<RuntimeEvent, { type: "tool.update" }>) {
  return `${event.id}:tool:${event.callID ?? event.name}`;
}

function toolText(tool: ToolBlockState) {
  const args = tool.argumentsComplete
    ? tool.keyArguments.join(" ") || "arguments ready"
    : "receiving arguments";
  const elapsed = tool.elapsed ? ` · ${tool.elapsed}` : "";
  const summary = tool.result ? tool.result.summary : tool.summary;
  return `${tool.kind}:${tool.name} ${args} · ${summary}${elapsed}`;
}

function newStream(): StreamState {
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
  forceVisible = false,
) {
  stream.committed += text;
  stream.segmentText += text;
  const hiddenThinking = input.role === "thinking" && !input.reasoningVisible;
  if (stream.deferVisible && !forceVisible) return;
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
    if (block.text !== text) block.text = text;
    if (block.status !== status) block.status = status;
    if (block.pendingText !== extra.pendingText)
      block.pendingText = extra.pendingText;
    if (block.reasoningVisible !== extra.reasoningVisible)
      block.reasoningVisible = extra.reasoningVisible;
    if (block.providerPolicy !== extra.providerPolicy)
      block.providerPolicy = extra.providerPolicy;
    if (block.tool !== extra.tool) block.tool = extra.tool;
    return;
  }
  state.messages.push({ id, role, text, status, ...extra });
}

function isUrgentEvent(event: RuntimeEvent) {
  return (
    event.type === "approval.request" ||
    event.type === "question.request" ||
    event.type === "turn.finished" ||
    event.type === "turn.cancelled"
  );
}

function compactPTYEvent(event: Extract<RuntimeEvent, { type: "pty.update" }>) {
  const transcript = event.transcript;
  if (!transcript || transcript.length <= maxPTYTranscriptChars) return event;
  return {
    ...event,
    transcript: `... ${transcript.length - maxPTYTranscriptChars} earlier chars omitted from live pane ...\n${transcript.slice(-maxPTYTranscriptChars)}`,
  };
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
