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
import type {
  ChatActivityView,
  SessionIntelligenceView,
} from "@natalia/view-store";
import { themeTokens as theme } from "../theme/theme";
import { MessageBlockView } from "../routes/session/message-rows";
import type { MessageBlock } from "../context/state";
import {
  PROMPT_BOTTOM_BORDER,
  PROMPT_FRAME_BORDER,
  promptTextareaRows,
} from "../prompt-border";
import type { TuiPreferences } from "../settings";
import { markdownSyntax } from "../routes/session/tool-views";

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

type MailboxStatusRow = {
  messageID: string;
  priority: string;
  intent: string;
  safeSummary?: string;
  status: string;
};

type PlanRow = {
  planID: string;
  title: string;
  objective: string;
  status: string;
  author: string;
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
  onClose(): void;
  onInputRef(value: InputRenderable | undefined): void;
  onSend(text: string): void;
  onRollback(toMessageID: string): void;
  onPlanAccept(planID: string): void;
  onPlanReject(planID: string): void;
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
  const [mailbox, setMailbox] = createSignal<MailboxStatusRow[]>([]);
  const [plans, setPlans] = createSignal<PlanRow[]>([]);
  const [inputTarget, setInputTarget] = createSignal<InputRenderable>();
  let input: TextareaRenderable | undefined;
  let chatScroll: ScrollBoxRenderable | undefined;

  /** The last user message id, so rollback can rewind the conversation. */
  const lastUserMessage = () => {
    for (let index = props.messages().length - 1; index >= 0; index--) {
      const block = props.messages()[index];
      if (block?.role !== "user") continue;
      // The projected id is `chat:<messageID>:user`.
      const match = /^chat:(.+):user$/u.exec(block.id);
      if (match) return match[1];
    }
    return undefined;
  };
  const proposedPlan = () => plans().find((plan) => plan.status === "proposed");
  const liveAgentStatus = () => props.intelligence?.() ?? agentStatus();
  const pendingIntents = () =>
    mailbox().filter(
      (message) =>
        message.status === "queued" || message.status === "delivered",
    );
  const acknowledgedIntents = () =>
    mailbox().filter((message) => message.status === "acknowledged");

  const submitDraft = () => {
    const text = draft().trim();
    if (!text) return;
    setDraft("");
    if (input) input.setText("");
    props.onSend(text);
  };

  const refresh = async () => {
    const [snapshot, mailboxRows, planRows] = await Promise.all([
      props.backend.sessionSnapshot?.() ?? Promise.resolve(undefined),
      props.backend.mailboxList?.() ?? Promise.resolve([]),
      props.backend.planList?.() ?? Promise.resolve([]),
    ]);
    setAgentStatus(snapshot ?? undefined);
    setMailbox(mailboxRows as MailboxStatusRow[]);
    setPlans(planRows as PlanRow[]);
  };

  onMount(() => void refresh());
  createEffect(() => {
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
    enabled: props.focused() && inputTarget() !== undefined,
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
      {
        key: "r",
        desc: "Refresh live work state",
        group: "Live Work Chat",
        cmd: () => void refresh(),
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
        <box flexDirection="row" gap={2}>
          <Show when={lastUserMessage()}>
            <text
              fg={theme.muted}
              onMouseUp={() => props.onRollback(lastUserMessage()!)}
            >
              ↩ rollback
            </text>
          </Show>
          <text fg={theme.muted} onMouseUp={() => props.onClose()}>
            × close
          </text>
        </box>
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
            borderColor={theme.accent}
          >
            <text attributes={TextAttributes.BOLD} fg={theme.text}>
              Chat drafted a plan for your review
            </text>
            <text fg={theme.text} wrapMode="word">
              {plan().title} — {plan().objective}
            </text>
            <box flexDirection="row" gap={2}>
              <text
                fg={theme.success}
                onMouseUp={() => props.onPlanAccept(plan().planID)}
              >
                accept
              </text>
              <text
                fg={theme.danger}
                onMouseUp={() => props.onPlanReject(plan().planID)}
              >
                reject
              </text>
            </box>
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
      <Show
        when={pendingIntents().length > 0 || acknowledgedIntents().length > 0}
      >
        <box
          flexShrink={0}
          flexDirection="column"
          gap={1}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
        >
          <text attributes={TextAttributes.BOLD} fg={theme.text}>
            Intents
          </text>
          <For each={[...pendingIntents(), ...acknowledgedIntents().slice(-2)]}>
            {(message) => (
              <text fg={theme.muted} wrapMode="word">
                [{message.priority}] {message.intent}:{" "}
                {message.safeSummary ?? ""} · {message.status}
              </text>
            )}
          </For>
        </box>
      </Show>
      {/* The composer box, copied line for line from the reference TUI's prompt
          (packages/tui/src/component/prompt/index.tsx): an outer anchor, a left
          frame with a rounded bottom-left corner, a padded panel box holding
          the textarea and a meta row, and a one-line bottom frame. */}
      <box visible={true} width="100%" flexShrink={0}>
        <box
          width="100%"
          border={["left"]}
          borderColor={theme.accent}
          customBorderChars={PROMPT_FRAME_BORDER}
        >
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
                syntaxStyle={markdownSyntax()}
                onMouseDown={(event: MouseEvent) => event.target?.focus()}
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
              <text fg={theme.accent} onMouseUp={submitDraft}>
                ↑ Send
              </text>
            </box>
          </box>
        </box>
        <box
          height={1}
          width="100%"
          border={["left"]}
          borderColor={theme.accent}
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
