"use client";
import {
  InputRenderable,
  MouseEvent,
  ScrollBoxRenderable,
  TextAttributes,
  TextareaRenderable,
} from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import { useBindings } from "@opentui/keymap/solid";
import {
  For,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";
import type { ModalRequest } from "@natalia/ui-model";
import { PermissionPrompt } from "../routes/session/permission";
import type {
  ChatActivityView,
  SessionIntelligenceView,
} from "@natalia/view-store";
import { themeTokens as theme } from "../theme/theme";
import { MessageBlockView } from "../routes/session/message-rows";
import type { MessageBlock, PendingRollback } from "../context/state";
import {
  PROMPT_BOTTOM_BORDER,
  PROMPT_FRAME_BORDER,
  promptTextareaRows,
} from "../prompt-border";
import type { TuiPreferences } from "../settings";

/**
 * Live Work Chat (P8 C2) as a docked, always-available conversation. The user
 * talks to a Chat collaborator that shares the safe project/execution context
 * (the runtime injects it per turn), streams its reply, drafts plans and sends
 * user-confirmed mailbox intents. This view only sends chat messages and reads
 * durable state — every write to the project goes through the main agent,
 * never through here (§2.2 boundary).
 *
 * The conversation renders the shared projection (`state.facts.chatMessages`)
 * through the same `MessageBlockView` the main feed uses: the view-store
 * projects the chat events with the exact streaming/segment/retry machinery as
 * the transcript, so the Chat looks and behaves like the main feed, not a
 * second hand-written renderer (§8.3).
 */

function chatMessageIDFromBlock(blockID: string): string {
  // Chat messageIDs themselves contain colons (chat:<timestamp>:<seq>), so a
  // plain split cannot extract the id. Strip the leading `chat:` and the
  // trailing row kind (`:user`, `:assistant`, `:collab`, `:tool`, or a
  // streamed segment suffix) to recover the full durable message id.
  const match = blockID.match(
    /^chat:(.+):(?:user|assistant|collab|tool)(?::.*)?$/u,
  );
  return match?.[1] ?? "";
}

type PlanRow = {
  planID: string;
  title: string;
  objective: string;
  status: string;
  author: string;
  taskID?: string;
  mailboxMessageID?: string;
};

export function LiveChatView(props: {
  backend: RuntimeClient;
  /** The projected Chat conversation, mapped through the shared adapter. */
  messages: () => MessageBlock[];
  activity: () => ChatActivityView | undefined;
  /** Live main-agent snapshot projected from the shared runtime event stream. */
  intelligence?: () => SessionIntelligenceView | undefined;
  /** Whether this pane owns keyboard focus (host pane-focus signal). */
  focused: () => boolean;
  onRequestFocus(): void;
  onEscape(): void;
  onInputRef(value: InputRenderable | undefined): void;
  onSend(text: string): void;
  onStop?(): void;
  onCopy?(text: string): void;
  onChatRollback?(toMessageID: string): void;
  pendingRollback?: () => PendingRollback | undefined;
  onUndoRollback?: () => void;
  onPlanRollback?(mailboxMessageID: string): void;
  onPlanAccept(planID: string): void;
  onPlanReject(planID: string): void;
  approvalRequest?: () =>
    | Extract<ModalRequest, { kind: "approval" }>
    | undefined;
  selectedTaskID?: () => string | undefined;
  /** The composer's max height, matching the reference TUI's `max(6, h/3)`. */
  promptMaxHeight: number;
  contentWidth: number;
  density: TuiPreferences["density"];
  toolDetails: TuiPreferences["toolDetails"];
  reasoning: TuiPreferences["reasoning"];
  diffStyle: TuiPreferences["diffStyle"];
  toolPreviewLines: number;
}) {
  const renderer = useRenderer();
  const [draft, setDraft] = createSignal("");
  const [textareaRows, setTextareaRows] = createSignal(1);
  const [scanPosition, setScanPosition] = createSignal(0);
  const [elapsedMs, setElapsedMs] = createSignal(0);
  const [agentStatus, setAgentStatus] = createSignal<
    | {
        agentStatus: string;
        currentStep?: string;
        activeTool?: string;
        changedFiles: number;
        unvalidatedChanges: number;
      }
    | undefined
  >();
  const [plans, setPlans] = createSignal<PlanRow[]>([]);
  const [inputTarget, setInputTarget] = createSignal<InputRenderable>();
  let input: TextareaRenderable | undefined;
  let chatScroll: ScrollBoxRenderable | undefined;
  const proposedPlan = () => plans().find((plan) => plan.status === "proposed");
  const handoffPlan = () =>
    plans().find(
      (plan) =>
        plan.mailboxMessageID &&
        plan.status !== "proposed" &&
        plan.status !== "superseded" &&
        plan.status !== "completed",
    );
  const alignedPlan = () => {
    const taskID = props.selectedTaskID?.();
    if (!taskID) return undefined;
    return plans().find((plan) => plan.taskID === taskID);
  };
  const liveAgentStatus = () => props.intelligence?.() ?? agentStatus();

  const submitDraft = () => {
    const text = draft().trim();
    if (!text) return;
    setDraft("");
    if (input) input.setText("");
    props.onSend(text);
  };

  const refresh = async () => {
    const [snapshot, planRows, mailboxRows] = await Promise.all([
      props.backend.sessionSnapshot?.() ?? Promise.resolve(undefined),
      props.backend.planList?.() ?? Promise.resolve([]),
      props.backend.mailboxList?.() ?? Promise.resolve([]),
    ]);
    setAgentStatus(snapshot ?? undefined);
    const mailboxes = mailboxRows as Array<{
      messageID: string;
      intent?: string;
      relatedPlanID?: string;
      status?: string;
    }>;
    setPlans(
      (planRows as PlanRow[]).map((plan) => ({
        ...plan,
        mailboxMessageID: mailboxes.find(
          (message) =>
            message.intent === "next_plan_handoff" &&
            message.relatedPlanID === plan.planID &&
            (message.status === "queued" || message.status === "delivered"),
        )?.messageID,
      })),
    );
  };

  onMount(() => void refresh());
  createEffect(() => {
    if (props.approvalRequest?.()) {
      input?.blur();
      return;
    }
    if (!props.focused()) return;
    queueMicrotask(() => {
      if (!input || input.isDestroyed) return;
      input.focus();
    });
  });
  createEffect(() => {
    if (props.messages().length > 0)
      queueMicrotask(() => chatScroll?.scrollTo(chatScroll.scrollHeight ?? 0));
  });
  createEffect(() => {
    props.contentWidth;
    props.promptMaxHeight;
    queueMicrotask(() =>
      setTextareaRows(promptTextareaRows(input, props.promptMaxHeight)),
    );
  });
  createEffect(() => {
    if (!props.activity()) {
      setScanPosition(0);
      return;
    }
    const timer = setInterval(
      () => setScanPosition((current) => current + 1),
      140,
    );
    onCleanup(() => clearInterval(timer));
  });
  createEffect(() => {
    const activity = props.activity();
    if (!activity) {
      setElapsedMs(0);
      return;
    }
    const update = () => setElapsedMs(Date.now() - activity.startedAt);
    update();
    const timer = setInterval(update, 1_000);
    onCleanup(() => clearInterval(timer));
  });
  useBindings(() => ({
    mode: "base",
    target: inputTarget,
    enabled:
      props.focused() &&
      inputTarget() !== undefined &&
      !props.approvalRequest?.(),
    priority: 1,
    bindings: [
      {
        key: "return",
        desc: "Send the message to the Chat",
        group: "Live Work Chat",
        cmd: submitDraft,
      },
      {
        key: "escape",
        desc: "Return focus to the main feed",
        group: "Live Work Chat",
        cmd: props.onEscape,
      },
    ],
  }));
  return (
    <box
      position="relative"
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={theme.background}
      onMouseUp={() => {
        if (renderer.getSelection()?.getSelectedText()) return;
        props.onRequestFocus();
      }}
    >
      <box
        flexShrink={0}
        flexDirection="row"
        justifyContent="space-between"
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={2}
      >
        <text attributes={TextAttributes.BOLD} fg={theme.accent}>
          Live Work Chat
        </text>
      </box>
      <Show when={liveAgentStatus()}>
        {(status) => (
          <box
            flexShrink={0}
            paddingLeft={2}
            paddingRight={2}
            paddingBottom={1}
          >
            <text fg={theme.muted} wrapMode="word">
              Main: {status().agentStatus}
              {status().currentStep ? ` · ${status().currentStep}` : ""}
              {status().activeTool ? ` · ${status().activeTool}` : ""}
            </text>
          </box>
        )}
      </Show>
      <Show when={props.pendingRollback?.()?.kind === "chat"}>
        <box
          flexShrink={0}
          flexDirection="row"
          justifyContent="space-between"
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          border={["left"]}
          borderColor={theme.warning}
        >
          <text fg={theme.warning} wrapMode="word">
            Chat rollback pending — edit the restored message and send, or undo.
          </text>
          <text fg={theme.warning} onMouseUp={props.onUndoRollback}>
            undo
          </text>
        </box>
      </Show>
      <Show when={alignedPlan()}>
        {(plan) => (
          <Show when={plan().planID !== proposedPlan()?.planID}>
            <box
              flexShrink={0}
              flexDirection="row"
              justifyContent="space-between"
              paddingLeft={2}
              paddingRight={2}
              paddingBottom={1}
              border={["left"]}
              borderColor={theme.accent}
            >
              <text fg={theme.accent} wrapMode="word">
                Plan · {plan().title} · {plan().status}
              </text>
              <Show when={plan().mailboxMessageID && props.onPlanRollback}>
                <text
                  fg={theme.warning}
                  onMouseUp={() =>
                    props.onPlanRollback?.(plan().mailboxMessageID!)
                  }
                >
                  restore...
                </text>
              </Show>
            </box>
          </Show>
        )}
      </Show>
      <Show when={handoffPlan()}>
        {(plan) => (
          <Show when={plan().planID !== alignedPlan()?.planID}>
            <box
              flexShrink={0}
              flexDirection="row"
              justifyContent="space-between"
              paddingLeft={2}
              paddingRight={2}
              paddingBottom={1}
              border={["left"]}
              borderColor={theme.warning}
            >
              <text fg={theme.warning} wrapMode="word">
                Navi handoff · {plan().title} · {plan().status}
              </text>
              <Show when={props.onPlanRollback}>
                <text
                  fg={theme.warning}
                  onMouseUp={() =>
                    props.onPlanRollback?.(plan().mailboxMessageID!)
                  }
                >
                  restore...
                </text>
              </Show>
            </box>
          </Show>
        )}
      </Show>
      <Show when={proposedPlan()}>
        {(plan) => (
          <box
            flexShrink={0}
            flexDirection="column"
            gap={1}
            paddingLeft={2}
            paddingRight={2}
            paddingTop={1}
            paddingBottom={1}
            border={["left"]}
            borderColor={
              alignedPlan()?.planID === plan().planID
                ? theme.success
                : theme.accent
            }
          >
            <text attributes={TextAttributes.BOLD} fg={theme.text}>
              Navi proposed a plan
            </text>
            <text fg={theme.text} wrapMode="word">
              {plan().title} — {plan().objective}
            </text>
            <text fg={theme.muted} wrapMode="word">
              Confirm with Natalia's approval card: Allow once, Allow session,
              or Reject.
            </text>
          </box>
        )}
      </Show>
      <scrollbox
        flexGrow={1}
        minHeight={0}
        stickyScroll={true}
        stickyStart="bottom"
        paddingLeft={2}
        paddingRight={2}
        ref={(value: ScrollBoxRenderable) => (chatScroll = value)}
      >
        <Show
          when={props.messages().length > 0}
          fallback={
            <box
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              minHeight={8}
            >
              <text fg={theme.muted} wrapMode="word">
                Ask about the work, inspect progress, or draft a plan.
              </text>
            </box>
          }
        >
          <For each={props.messages()}>
            {(block) => (
              <MessageBlockView
                block={block}
                onCopy={props.onCopy}
                onRestoreBlock={(blockID) =>
                  props.onChatRollback?.(chatMessageIDFromBlock(blockID))
                }
                density={props.density}
                toolDetails={props.toolDetails}
                reasoning={props.reasoning}
                diffStyle={props.diffStyle}
                terminalWidth={props.contentWidth}
                toolPreviewLines={props.toolPreviewLines}
              />
            )}
          </For>
        </Show>
      </scrollbox>
      <box width="100%" flexShrink={0} backgroundColor={theme.background}>
        <box
          width="100%"
          border={["left"]}
          borderColor={props.approvalRequest?.() ? theme.warning : theme.accent}
          customBorderChars={PROMPT_FRAME_BORDER}
        >
          <Show
            when={props.approvalRequest?.()}
            fallback={
              <box
                paddingLeft={2}
                paddingRight={2}
                paddingTop={1}
                flexShrink={0}
                backgroundColor={theme.panel}
                flexGrow={1}
                width="100%"
              >
                <box width="100%" flexDirection="row" alignItems="flex-end">
                  <textarea
                    ref={(value: TextareaRenderable) => {
                      input = value;
                      setInputTarget(value as unknown as InputRenderable);
                      props.onInputRef(value as unknown as InputRenderable);
                      if (draft()) queueMicrotask(() => value.setText(draft()));
                    }}
                    height={textareaRows()}
                    minHeight={1}
                    maxHeight={props.promptMaxHeight}
                    flexGrow={1}
                    minWidth={0}
                    placeholder="Ask the Chat..."
                    placeholderColor={theme.muted}
                    textColor={theme.text}
                    focusedTextColor={theme.text}
                    focusedBackgroundColor={theme.panel}
                    cursorColor={theme.text}
                    onMouseDown={(event: MouseEvent) => {
                      event.target?.focus();
                    }}
                    onContentChange={() => {
                      setDraft(input?.plainText ?? "");
                      setTextareaRows(
                        promptTextareaRows(input, props.promptMaxHeight),
                      );
                    }}
                  />
                </box>
                <box
                  flexDirection="row"
                  flexShrink={0}
                  paddingTop={1}
                  justifyContent="flex-end"
                >
                  <text
                    fg={props.activity() ? theme.danger : theme.accent}
                    onMouseUp={() => {
                      if (props.activity()) {
                        props.onStop?.();
                        return;
                      }
                      submitDraft();
                    }}
                  >
                    {props.activity() ? "■ Stop" : "↑ Send"}
                  </text>
                </box>
              </box>
            }
          >
            {(request) => (
              <PermissionPrompt
                request={request()}
                backend={props.backend}
                onExit={props.onEscape}
                compact
              />
            )}
          </Show>
        </box>
        <box
          height={1}
          width="100%"
          border={["left"]}
          borderColor={props.approvalRequest?.() ? theme.warning : theme.accent}
          customBorderChars={PROMPT_BOTTOM_BORDER}
        />
      </box>
      <box
        height={1}
        flexShrink={0}
        flexDirection="row"
        justifyContent="flex-end"
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={props.activity() ? theme.muted : theme.text}>
          <span
            style={{ fg: props.activity() ? theme.warning : theme.success }}
          >
            {props.activity()
              ? [".  ", " . ", "  .", " . "][scanPosition() % 4]
              : "•"}
          </span>{" "}
          {chatActivityLabel(props.activity())}
          <Show when={props.activity()}>
            {` · ${formatElapsed(elapsedMs())}`}
          </Show>
        </text>
      </box>
    </box>
  );
}

function chatActivityLabel(activity: ChatActivityView | undefined) {
  if (!activity) return "Ready";
  if (activity.phase === "thinking") return "Thinking";
  if (activity.phase === "generating") return "Generating";
  if (activity.phase === "using_tool")
    return activity.toolName ? `Using ${activity.toolName}` : "Using a tool";
  return "Working";
}

function formatElapsed(elapsedMs: number) {
  const elapsedSeconds = Math.floor(elapsedMs / 1_000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = String(elapsedSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds} elapsed`;
}
