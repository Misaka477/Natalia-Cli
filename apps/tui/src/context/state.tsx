import {
  batch,
  createContext,
  onCleanup,
  onMount,
  useContext,
  type JSX,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { retryDisplayLine } from "@natalia/client";
import { TuiPerformanceTrace } from "../performance-trace";
import type {
  RuntimeEvent,
  RuntimeProjectedMessage,
  ToolStatus,
} from "@natalia/contracts";
import {
  checkpointProgressView,
  type ToolKind,
  type ToolResultView,
} from "@natalia/ui-model";
import { boundHistoryCache } from "../history-page-cache";
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
import {
  applyConversationEvent,
  applyResourceEvent,
  applyStatusEvent,
  initialState as initialFacts,
  streamID,
  type AppState as ViewAppState,
  applyChatEvent,
} from "@natalia/view-store";
import { messageBlockFromProjection } from "./view-store-adapter";

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
  /**
   * Which layer owns this row.
   *
   * `projection` rows are derived from `facts` on every event and are removed
   * when the projection drops them. `ui` rows are the TUI's own narration —
   * inline approvals, resource summaries, localised turn outcomes — which the
   * shared layer deliberately exposes structurally instead. The narration layer
   * may also claim a projected row by writing over it, which is how a localised
   * or friendlier wording survives the next reconcile; see `syncProjectedRows`.
   */
  owner: "projection" | "ui";
  interactive?:
    | {
        kind: "approval";
        request: Extract<RuntimeEvent, { type: "approval.request" }>;
        response?: Extract<RuntimeEvent, { type: "approval.response" }>;
      }
    | {
        kind: "question";
        request: Extract<RuntimeEvent, { type: "question.request" }>;
        response?: Extract<RuntimeEvent, { type: "question.response" }>;
      };
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

export type SubagentView = ViewAppState["subagents"][string];

const eventBatchMs = 16;

export type AppState = {
  /**
   * Session status and footer text.
   *
   * Kept by the TUI rather than read from `facts` because they are localised and
   * carry TUI wording: the shared layer states a turn's outcome in English and
   * leaves `status` alone, and silently adopting that would change what a user
   * reads. Localisation is a UI concern.
   */
  status: string;
  footer: string;
  statusSegments: string[];
  /**
   * The rendered transcript: rows derived from `facts.messages` merged with the
   * TUI's own narration rows, in arrival order. Written only by
   * `syncProjectedRows` and the narration layer.
   */
  messages: MessageBlock[];
  dialog?:
    | "palette"
    | "approval"
    | "question"
    | "sessions"
    | "settings"
    | "status";
  modal: ModalControllerState;
  /**
   * Banners live in `facts` (`Banner{text,kind}`), not here: the shared
   * projection is their single writer and this string-shaped duplicate is the
   * E3 Step 3 removal. The TUI only renders them.
   */
  /**
   * The session's facts as projected by `@natalia/view-store`: the conversation
   * core (turns, streaming text, tool cards, todos, pending requests) and the
   * resources whose state the TUI reads (terminals, their timelines, sandboxes,
   * subagents, MCP servers).
   *
   * There is one implementation of a session fact, in the layer every consumer
   * shares, instead of two that may drift. What stays in the TUI is presentation:
   * the terminal pane selection, the modal queue, localised status and footer
   * text, and the transcript rows it narrates itself.
   */
  facts: ViewAppState;
  terminalPane: { selectedID?: string; focus: "chat" | "terminal" };
  /** The Chat conversation rows, kept in object identity like the transcript. */
  chatMessages: MessageBlock[];
};

/**
 * A fresh state.
 *
 * A factory rather than a shared value because `createStore` wraps the object it
 * is given and writes through to it: handing it one shared constant means the
 * first session mutates the constant every later reader starts from.
 */
export function createInitialState(): AppState {
  return {
    status: "booting",
    footer: "Ready",
    statusSegments: [
      "mode:runtime",
      "model:not-connected",
      "provider:not-connected",
    ],
    modal: structuredClone(initialModalState),
    facts: initialFacts(),
    terminalPane: { focus: "chat" },
    chatMessages: [],
    messages: [],
  };
}

/**
 * A template to fold events onto. Callers must not mutate it — `reduceState`
 * copies first, and anything holding state for real should call
 * `createInitialState()`.
 */
export const initialState: AppState = createInitialState();

export function reduceState(state: AppState, event: RuntimeEvent): AppState {
  const next = structuredClone(state) as AppState;
  applyEvent(next, event);
  return next;
}

export function StateProvider(props: {
  children: JSX.Element;
  onReady?: (bridge: {
    dispatch: (event: RuntimeEvent) => void;
    hydrateMessages: (
      messages: RuntimeProjectedMessage[],
      direction?: "older" | "newer",
    ) => boolean;
  }) => void;
}) {
  const [state, setState] = createStore<AppState>(createInitialState());
  const performanceTrace = new TuiPerformanceTrace();
  const pendingEvents: RuntimeEvent[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | undefined;
  let lastFlush = 0;
  const flush = () => {
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = undefined;
    if (!pendingEvents.length) return;
    const events = pendingEvents.splice(0);
    const startedAt = performance.now();
    lastFlush = performance.now();
    batch(() => {
      setState(
        produce((draft) => {
          for (const event of events) applyEvent(draft, event);
        }),
      );
    });
    performanceTrace.batch(events.length, performance.now() - startedAt);
  };
  const dispatch = (event: RuntimeEvent) => {
    pendingEvents.push(event);
    performanceTrace.enqueue(event, pendingEvents.length);
    const elapsed = performance.now() - lastFlush;
    if (elapsed >= eventBatchMs || isUrgentEvent(event)) {
      flush();
      return;
    }
    if (!flushTimer) flushTimer = setTimeout(flush, eventBatchMs - elapsed);
  };
  const hydrateMessages = (
    messages: RuntimeProjectedMessage[],
    direction: "older" | "newer" = "older",
  ) => {
    flush();
    const projected = createInitialState();
    const existingTurnIDs = new Set(
      state.messages
        .filter((message) => message.role === "user")
        .map((message) => message.id.replace(/:user$/u, "")),
    );
    for (const message of messages)
      if (!existingTurnIDs.has(message.turnID))
        for (const row of message.rows) applyEvent(projected, row.event);
    // Replayed history is a finished record, so the rows are handed over as the
    // TUI's own. The live projection knows nothing about those turns, and a row it
    // does not know is a row the reconcile would delete.
    const incoming = projected.messages.map((row) => ({
      ...row,
      owner: "ui" as const,
    }));
    if (!incoming.length) return false;
    const incomingIDs = new Set(incoming.map((message) => message.id));
    let evicted = false;
    setState(
      produce((draft) => {
        const retained = draft.messages.filter(
          (message) => !incomingIDs.has(message.id),
        );
        const merged =
          direction === "older"
            ? [...incoming, ...retained]
            : [...retained, ...incoming];
        const bounded = boundHistoryCache(merged, direction);
        draft.messages = bounded.messages;
        evicted = bounded.evicted;
      }),
    );
    return evicted;
  };
  onCleanup(() => {
    if (flushTimer) clearTimeout(flushTimer);
    flush();
    void performanceTrace.stop();
  });
  onMount(() => props.onReady?.({ dispatch, hydrateMessages }));
  return (
    <StateContext.Provider value={{ state, dispatch, hydrateMessages }}>
      {props.children}
    </StateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(StateContext);
  if (!context) throw new Error("StateProvider missing");
  return context;
}

/**
 * Folds one event into the TUI's state.
 *
 * Three steps, in this order:
 *   1. the shared projection takes the event, so the conversation core has one
 *      implementation instead of the TUI keeping a second one;
 *   2. the transcript's projected rows are reconciled from it;
 *   3. the TUI applies what is genuinely its own — pane selection, the modal
 *      queue, localised status and footer text — and narrates the rows the shared
 *      layer exposes structurally instead.
 *
 * Narration runs last so a row it adds for this event lands after the rows the
 * projection produced for the same event, which is the order they happened in.
 */
function applyEvent(state: AppState, event: RuntimeEvent) {
  projectFacts(state, event);
  syncProjectedChat(state);
  syncProjectedRows(state);
  applyTuiEvent(state, event);
}

/**
 * Routes an event into the shared projection.
 *
 * Conversation and status events go in whole. Resource events are routed by the
 * cases in `applyTuiEvent` that read them back, because those need the state
 * before and after the update; the rest are deliberately not projected here,
 * since the TUI still narrates resources in its own wording and routing them
 * would produce two rows for one fact.
 */
function projectFacts(state: AppState, event: RuntimeEvent) {
  if (applyConversationEvent(state.facts, event)) return;
  if (applyChatEvent(state.facts, event)) return;
  applyStatusEvent(state.facts, event);
}

/**
 * Brings the transcript's projected rows in line with `facts.messages`.
 *
 * Rows are matched by id, updated in place and appended in projection order, so
 * an unchanged row keeps its object identity — the renderer reconciles rows by
 * identity and the timeline virtualizer caches measured heights by group key, so
 * rebuilding the array would remount and re-measure the visible transcript on
 * every event.
 *
 * A row the narration layer has claimed is left alone: the TUI states some
 * turn-level facts in its own wording, and the projection must not overwrite that
 * on the next event.
 */
function syncProjectedRows(state: AppState) {
  const projected = state.facts.messages;
  const index = new Map<string, number>();
  for (let position = 0; position < state.messages.length; position++)
    index.set(state.messages[position]!.id, position);
  for (const source of projected) {
    const position = index.get(source.id);
    if (position === undefined) {
      state.messages.push(messageBlockFromProjection(source));
      index.set(source.id, state.messages.length - 1);
      continue;
    }
    const target = state.messages[position]!;
    if (target.owner !== "projection") continue;
    updateProjectedRow(target, messageBlockFromProjection(source));
  }
  // A superseded attempt removes its blocks from the projection, and a row the
  // projection no longer has must not linger in the transcript.
  if (projected.length >= projectedRowCount(state)) return;
  const live = new Set(projected.map((source) => source.id));
  state.messages = state.messages.filter(
    (row) => row.owner !== "projection" || live.has(row.id),
  );
}

function projectedRowCount(state: AppState) {
  let count = 0;
  for (const row of state.messages) if (row.owner === "projection") count++;
  return count;
}

/** Copies a derived row onto the rendered one, touching only what changed. */
function updateProjectedRow(target: MessageBlock, next: MessageBlock) {
  if (target.role !== next.role) target.role = next.role;
  if (target.text !== next.text) target.text = next.text;
  if (target.pendingText !== next.pendingText)
    target.pendingText = next.pendingText;
  if (target.status !== next.status) target.status = next.status;
  if (target.reasoningVisible !== next.reasoningVisible)
    target.reasoningVisible = next.reasoningVisible;
  if (target.providerPolicy !== next.providerPolicy)
    target.providerPolicy = next.providerPolicy;
  // The derived tool view is cached on the projected fact it came from, so an
  // unchanged tool is the same object and the row keeps its identity.
  if (target.tool !== next.tool) target.tool = next.tool;
}

/**
 * Brings the Chat conversation rows in line with `facts.chatMessages`, the same
 * identity-preserving way `syncProjectedRows` handles the transcript: an
 * unchanged row keeps its object identity so the renderer does not remount it
 * on every streamed event.
 */
function syncProjectedChat(state: AppState) {
  const projected = state.facts.chatMessages;
  const index = new Map<string, number>();
  for (let position = 0; position < state.chatMessages.length; position++)
    index.set(state.chatMessages[position]!.id, position);
  for (const source of projected) {
    const position = index.get(source.id);
    if (position === undefined) {
      state.chatMessages.push(messageBlockFromProjection(source));
      index.set(source.id, state.chatMessages.length - 1);
      continue;
    }
    updateProjectedRow(
      state.chatMessages[position]!,
      messageBlockFromProjection(source),
    );
  }
  if (projected.length >= state.chatMessages.length) return;
  const live = new Set(projected.map((source) => source.id));
  state.chatMessages = state.chatMessages.filter((row) => live.has(row.id));
}

function applyTuiEvent(state: AppState, event: RuntimeEvent) {
  switch (event.type) {
    case "flow.module_event":
      handleFlowModuleEvent(state, event);
      return;
    case "flow.finished": {
      // The run's formal verdict, so the transcript ends with a summary
      // instead of trailing off into the arbitration output.
      const ok = event.outcome === "succeeded";
      const reason = event.reason ? `：${event.reason}` : "";
      upsertBlock(
        state,
        "flow:finished",
        "system",
        `Flow 执行${ok ? "完成" : event.outcome === "skipped" ? "已跳过" : "失败"}${reason}`,
        ok ? "success" : event.outcome === "skipped" ? "warning" : "failed",
      );
      return;
    }
    case "flow.evaluator": {
      // The arbitration model's live output for one module. The block is keyed
      // by module so consecutive evaluations never pile into one block; the
      // module verdict (handleFlowModuleEvent) claims it afterwards.
      const id = `flow:evaluator:${event.moduleID ?? "unknown"}`;
      const previous = state.messages.find((item) => item.id === id);
      const text = (previous?.text ?? "") + event.text;
      upsertBlock(state, id, "system", text, "running");
      return;
    }
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
      // The projection owns the banner (`facts.compactionBanner`); the TUI
      // still narrates the row and the footer in its own wording.
      upsertBlock(
        state,
        event.id,
        "system",
        `Compacting after ${event.trigger} · before ${event.beforeTokens}/${event.maxTokens} · reserved ${event.reservedTokens}`,
        "compacting",
      );
      state.footer = `compacting after ${event.trigger}`;
      return;
    case "compaction.end":
      // Same row the "compacting" line above wrote, so the reader watches one row
      // reach its outcome instead of collecting a second one. The projection
      // states this too, in the same words; the row is written here because the
      // narration layer owns it from `compaction.begin` onwards.
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
    case "checkpoint.created":
    case "checkpoint.failed":
    case "checkpoint.unavailable":
    case "rollback.previewed":
    case "rollback.begin":
    case "rollback.end":
    case "rollback.failed":
      handleCheckpointEvent(state, event);
      return;
    case "terminal.update": {
      const previousTerminal = state.facts.terminals[event.id];
      applyResourceEvent(state.facts, event);
      const terminal = state.facts.terminals[event.id];
      // The projection drops a republish that changes nothing observable, and
      // then there is nothing for the pane to react to either.
      if (terminal === previousTerminal) return;
      if (
        terminal &&
        terminal.ownership === "model" &&
        (!previousTerminal || !state.terminalPane.selectedID) &&
        terminal.status !== "exited" &&
        terminal.status !== "failed"
      ) {
        state.terminalPane.selectedID = terminal.id;
      }
      if (
        terminal &&
        state.terminalPane.selectedID === terminal.id &&
        (terminal.status === "exited" || terminal.status === "failed")
      ) {
        state.terminalPane.selectedID = nextActiveTerminal(state, terminal.id);
        if (!state.terminalPane.selectedID) state.terminalPane.focus = "chat";
      }
      return;
    }
    case "terminal.pane.select":
      if (activeTerminalIDs(state).includes(event.id)) {
        state.terminalPane.selectedID = event.id;
        state.terminalPane.focus = "terminal";
      }
      return;
    case "terminal.pane.focus":
      state.terminalPane.focus = event.focus;
      state.terminalPane.selectedID ??= nextActiveTerminal(state);
      return;
    case "terminal.timeline":
      applyResourceEvent(state.facts, event);
      return;
    case "terminal.approval":
      state.footer = `Terminal ${event.id} ${event.state}: ${event.reason}`;
      return;
    case "terminal.action":
      state.footer =
        `terminal ${event.id} ${event.action} ${event.redacted ? "[redacted]" : ""}`.trim();
      return;
    case "sandbox.update":
      applyResourceEvent(state.facts, event);
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
      // Row id aligned with the shared projection's (`sandbox:<id>:<action>`)
      // so a second UI folding the same event stream renders the same id the
      // official TUI narrates; the richer text stays TUI-side.
      upsertBlock(
        state,
        `sandbox:${event.id}:${event.action}`,
        "system",
        `audit ${event.action}: ${event.message}\ntarget: ${targetLabel(event.target)}\napproval: ${event.approvalRequired ? "required" : "not required"}\ncheckpoint: ${event.checkpointPolicy}`,
        "audit",
      );
      return;
    case "mcp.status":
      applyResourceEvent(state.facts, event);
      state.footer = `MCP ${event.server}: ${event.status}`;
      return;
    case "diagnostic":
      upsertBlock(
        state,
        `diagnostic:${Date.now()}`,
        "system",
        `${event.level}: ${event.message}${event.owner ? ` [${event.owner}]` : ""}`,
      );
      state.footer = event.message;
      return;
    case "dialog.open":
      state.dialog = event.dialog;
      return;
    case "dialog.close":
      state.dialog = undefined;
      return;
    case "turn.retry":
      upsertBlockBefore(
        state,
        `${event.id}:retry:${event.attempt}`,
        streamID(event.id, "assistant"),
        "system",
        `retry ${event.attempt}/${event.maxAttempts}: ${event.reason}; waiting ${event.retryAfterMs}ms`,
        "retry",
      );
      return;
    case "step.retry": {
      const text = `Retrying after ${event.reason}${event.statusCode ? ` (${event.statusCode})` : ""} · attempt ${event.attempt}/${event.maxAttempts} · waiting ${formatWait(event.waitMs)}`;
      state.footer = text;
      upsertBlock(state, retryBlockID(event.id), "system", text, "retry");
      return;
    }
    case "step.retry.cleared":
      removeBlock(state, retryBlockID(event.id));
      state.footer = `retry recovered after ${event.attempts} attempts`;
      return;
    case "step.retry.exhausted":
      removeBlock(state, retryBlockID(event.id));
      // Claims the projected row to say the same thing in the TUI's wording,
      // which names the failure kind and what to do about it.
      upsertBlock(
        state,
        `${event.id}:retry:exhausted`,
        "system",
        retryDisplayLine(event) ?? event.message,
        "retry_exhausted",
      );
      state.footer =
        event.retryable === false
          ? `not retryable: ${event.reason}`
          : `retry exhausted: ${event.reason}`;
      return;
    case "subagent.update":
      applyResourceEvent(state.facts, event);
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
        { interactive: { kind: "approval", request: event } },
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
        interactiveApprovalText(state, event),
        event.decision,
        { interactive: resolvedApproval(state, event) },
      );
      return;
    case "question.request": {
      const normalizedQuestion = normalizeQuestionRequest(event);
      enqueueQuestion(state.modal, normalizedQuestion);
      state.dialog = activeModal(state.modal)?.kind;
      upsertBlock(
        state,
        event.id,
        "question",
        questionRequestText(normalizedQuestion),
        "awaiting",
        {
          interactive: {
            kind: "question",
            request: { ...event, questions: normalizedQuestion.questions },
          },
        },
      );
      return;
    }
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
        interactiveQuestionText(state, event),
        event.rejected ? "rejected" : "answered",
        { interactive: resolvedQuestion(state, event) },
      );
      return;
    case "snapshot.created":
      // Row id aligned with the shared projection's (`snapshot:<id>`); the
      // `snapshot` role label is a TUI rendering choice.
      upsertBlock(
        state,
        `snapshot:${event.id}`,
        "snapshot",
        `snapshot ${event.id}: ${event.files.join(", ")}`,
      );
      return;
    case "turn.cancelled":
      // The cancellation row itself comes from the projection.
      cancelPendingModals(state.modal, event.reason);
      state.dialog = undefined;
      return;
    case "turn.finished":
      state.status = event.stopReason === "done" ? "ready" : event.stopReason;
      if (event.stopReason === "done") {
        if (event.reason === "missing_final_response") {
          upsertBlock(
            state,
            `${event.id}:finished`,
            "system",
            "任务已执行完成，但模型未提供最终回复。工具执行结果已保留。",
            "completed",
          );
          state.footer = "任务已完成，模型未提供最终回复";
        } else {
          state.footer = "本轮任务已完成";
        }
      } else if (event.stopReason === "error") {
        upsertBlock(
          state,
          `${event.id}:finished`,
          "system",
          "本轮任务执行失败，请查看上方错误信息。",
          "failed",
        );
        state.footer = "本轮任务执行失败";
      }
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
  // Ids align with the shared projection where it also narrates a row
  // (checkpoint.failed / checkpoint.unavailable), so a second UI folding the
  // same stream sees the same row ids; the other five event kinds are narrated
  // only here, with stable ids that never depend on transcript length.
  const id =
    event.type === "checkpoint.created"
      ? `checkpoint:${event.id}`
      : event.type === "checkpoint.failed"
        ? `checkpoint:failed:${event.reason}`
        : event.type === "checkpoint.unavailable"
          ? "checkpoint:unavailable"
          : event.type === "rollback.previewed"
            ? `rollback:${event.preview.checkpointID}:preview`
            : `rollback:${event.checkpointID}:${event.type}`;
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

function resolvedApproval(
  state: AppState,
  response: Extract<RuntimeEvent, { type: "approval.response" }>,
) {
  const current = state.messages.find(
    (message) => message.id === response.id,
  )?.interactive;
  return current?.kind === "approval" ? { ...current, response } : undefined;
}

function resolvedQuestion(
  state: AppState,
  response: Extract<RuntimeEvent, { type: "question.response" }>,
) {
  const current = state.messages.find(
    (message) => message.id === response.id,
  )?.interactive;
  return current?.kind === "question" ? { ...current, response } : undefined;
}

function interactiveApprovalText(
  state: AppState,
  response: Extract<RuntimeEvent, { type: "approval.response" }>,
) {
  const request = state.messages.find(
    (message) => message.id === response.id,
  )?.interactive;
  const title =
    request?.kind === "approval" ? request.request.title : "Approval";
  return `${title}: ${approvalResponseText(response.decision, response.feedback)}`;
}

function interactiveQuestionText(
  state: AppState,
  response: Extract<RuntimeEvent, { type: "question.response" }>,
) {
  const request = state.messages.find(
    (message) => message.id === response.id,
  )?.interactive;
  const title =
    request?.kind === "question" ? request.request.title : "Question";
  return `${title}: ${questionResponseText(response.answers, response.rejected)}`;
}

function retryBlockID(turnID: string) {
  return `${turnID}:retry:live`;
}

function formatWait(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function targetLabel(
  target: Extract<RuntimeEvent, { type: "terminal.update" }>["target"],
) {
  if (target.kind === "host") return `host:${target.cwd}`;
  return `sandbox:${target.sandboxID}:${target.isolationLevel}`;
}

function activeTerminalIDs(state: AppState) {
  return Object.values(state.facts.terminals)
    .filter(
      (terminal) =>
        terminal.ownership === "model" &&
        terminal.status !== "exited" &&
        terminal.status !== "failed",
    )
    .map((terminal) => terminal.id);
}

function nextActiveTerminal(state: AppState, excludedID?: string) {
  return activeTerminalIDs(state).find((id) => id !== excludedID);
}

function removeBlock(state: AppState, id: string) {
  state.messages = state.messages.filter((item) => item.id !== id);
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
    // Writing a row claims it: a projected row the TUI restates in its own
    // wording must not be reverted by the next reconcile.
    if (block.owner !== "ui") block.owner = "ui";
    if (block.text !== text) block.text = text;
    if (block.status !== status) block.status = status;
    if (block.pendingText !== extra.pendingText)
      block.pendingText = extra.pendingText;
    if (block.reasoningVisible !== extra.reasoningVisible)
      block.reasoningVisible = extra.reasoningVisible;
    if (block.providerPolicy !== extra.providerPolicy)
      block.providerPolicy = extra.providerPolicy;
    if (block.tool !== extra.tool) block.tool = extra.tool;
    if (block.interactive !== extra.interactive)
      block.interactive = extra.interactive;
    return;
  }
  state.messages.push({ id, role, text, status, owner: "ui", ...extra });
}

function handleFlowModuleEvent(
  state: AppState,
  event: Extract<RuntimeEvent, { type: "flow.module_event" }>,
) {
  const id = `flow:module:${event.moduleID}`;
  const label = event.moduleType ? ` (${event.moduleType})` : "";
  // The arbitration block for this module stops streaming once a verdict
  // lands: keep its text, retire the "running" status.
  const retireEvaluator = (status: string) => {
    const evaluatorBlock = state.messages.find(
      (item) => item.id === `flow:evaluator:${event.moduleID}`,
    );
    if (evaluatorBlock && evaluatorBlock.status === "running")
      upsertBlock(
        state,
        evaluatorBlock.id,
        "system",
        evaluatorBlock.text,
        status,
      );
  };
  switch (event.kind) {
    case "activated":
      upsertBlock(state, id, "system", `Flow 模块开始执行${label}`, "running");
      return;
    case "claimed":
      upsertBlock(
        state,
        id,
        "system",
        `完成申报已提交，仲裁中…${label}`,
        "pending",
      );
      return;
    case "evaluated":
      upsertBlock(
        state,
        id,
        "system",
        event.outcome === "complete"
          ? `仲裁判定：条件满足${label}`
          : event.outcome === "incomplete"
            ? `仲裁判定：条件未完全满足，继续执行${label}`
            : `仲裁失败${label}`,
        event.outcome === "complete"
          ? "success"
          : event.outcome === "incomplete"
            ? "pending"
            : "failed",
      );
      retireEvaluator(
        event.outcome === "complete"
          ? "success"
          : event.outcome === "incomplete"
            ? "pending"
            : "failed",
      );
      return;
    case "completed":
      upsertBlock(state, id, "system", `模块完成${label}`, "success");
      retireEvaluator("success");
      return;
    case "blocked":
      upsertBlock(
        state,
        id,
        "system",
        `模块被阻断：${event.reason ?? "未知原因"}${label}`,
        "failed",
      );
      retireEvaluator("failed");
      return;
    case "stalled":
      upsertBlock(
        state,
        id,
        "system",
        `模块未收到完成申报，将重试${label}`,
        "warning",
      );
      return;
    case "continued":
      upsertBlock(state, id, "system", `模块继续执行${label}`, "pending");
      return;
  }
}

function isUrgentEvent(event: RuntimeEvent) {
  return (
    event.type === "approval.request" ||
    event.type === "question.request" ||
    event.type === "turn.finished" ||
    event.type === "turn.cancelled"
  );
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
  hydrateMessages: (messages: RuntimeProjectedMessage[]) => void;
}>();
