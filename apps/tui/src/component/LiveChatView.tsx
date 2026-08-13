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
import { For, Show, createEffect, createSignal, onMount } from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";
import { darkTheme } from "../theme/theme";
import { MessageBlockView } from "../routes/session/message-rows";
import { markdownSyntax } from "../routes/session/tool-views";
import type { MessageBlock } from "../context/state";

/**
 * The prompt frame border characters, copied from opencode's ui/border:
 * `EmptyBorder` keeps the frame borderless except the vertical line, and the
 * prompt frame rounds its bottom-left corner with "╹".
 */
const PROMPT_FRAME_BORDER = {
  topLeft: "",
  bottomLeft: "╹",
  vertical: "┃",
  topRight: "",
  bottomRight: "",
  horizontal: " ",
  bottomT: "",
  topT: "",
  cross: "",
  leftT: "",
  rightT: "",
};
const PROMPT_BOTTOM_BORDER = {
  topLeft: "",
  bottomLeft: "╹",
  vertical: "",
  topRight: "",
  bottomRight: "",
  horizontal: " ",
  bottomT: "",
  topT: "",
  cross: "",
  leftT: "",
  rightT: "",
};

/**
 * Live Work Chat (P8 C2) as a docked, always-available conversation. The user
 * talks to a Chat collaborator that shares the safe project/execution context
 * (the runtime injects it per turn), streams its reply, drafts plans and sends
 * user-confirmed mailbox intents. This view only sends chat messages and reads
 * durable state — every write to the project goes through the main agent,
 * never through here (§2.2 boundary).
 *
 * The layout mirrors the main feed: the conversation fills the whole height
 * (`flexGrow`), rows render through the same `MessageBlockView`, and the
 * composer is the same bordered textarea the main feed uses. The timeline comes
 * from the shared projection (`chat.message.added` / `chat.message.delta` /
 * `chat.tool.used` / `chat.rollback`), so streamed replies and Chat's tool
 * actions appear live and in order (§8.3).
 */

type ChatEntry =
  | {
      kind: "message";
      messageID: string;
      role: "user" | "chat";
      text: string;
      at: string;
    }
  | {
      kind: "thinking";
      messageID: string;
      text: string;
    }
  | {
      kind: "action";
      id: string;
      toolName: string;
      summary: string;
      at: string;
    };

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
  /** The durable Chat timeline, projected by the app shell. */
  timeline: () => ChatEntry[];
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
  /** The composer's max height, matching opencode's `max(6, h/3)`. */
  promptMaxHeight: number;
}) {
  const renderer = useRenderer();
  const [draft, setDraft] = createSignal("");
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

  const lastUserMessage = () => {
    for (let index = props.timeline().length - 1; index >= 0; index--) {
      const entry = props.timeline()[index];
      if (entry?.kind === "message" && entry.role === "user")
        return entry.messageID;
    }
    return undefined;
  };
  const proposedPlan = () => plans().find((plan) => plan.status === "proposed");
  const pendingIntents = () =>
    mailbox().filter(
      (message) =>
        message.status === "queued" || message.status === "delivered",
    );
  const acknowledgedIntents = () =>
    mailbox().filter((message) => message.status === "acknowledged");

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
    if (props.timeline().length > 0)
      queueMicrotask(() => chatScroll?.scrollTo(chatScroll.scrollHeight ?? 0));
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
        cmd: () => {
          const text = draft().trim();
          if (!text) return;
          setDraft("");
          if (input) input.setText("");
          props.onSend(text);
        },
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
      backgroundColor={darkTheme.background}
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
        paddingLeft={2}
        paddingRight={2}
      >
        <text attributes={TextAttributes.BOLD} fg={darkTheme.accent}>
          Live Work Chat
        </text>
        <box flexDirection="row" gap={2}>
          <Show when={lastUserMessage()}>
            <text
              fg={darkTheme.muted}
              onMouseUp={() => props.onRollback(lastUserMessage()!)}
            >
              ↩ rollback
            </text>
          </Show>
          <text fg={darkTheme.muted} onMouseUp={() => props.onClose()}>
            × close
          </text>
        </box>
      </box>
      <Show when={agentStatus()}>
        {(status) => (
          <box flexShrink={0} paddingLeft={2} paddingRight={2}>
            <text fg={darkTheme.muted}>
              Main agent: {status().agentStatus}
              {status().currentStep ? ` · ${status().currentStep}` : ""}
              {status().activeTool ? ` · ${status().activeTool}` : ""} ·{" "}
              {status().changedFiles} changed · {status().unvalidatedChanges}{" "}
              unvalidated
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
            borderColor={darkTheme.accent}
          >
            <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
              Chat drafted a plan for your review
            </text>
            <text fg={darkTheme.text} wrapMode="word">
              {plan().title} — {plan().objective}
            </text>
            <box flexDirection="row" gap={2}>
              <text
                fg={darkTheme.success}
                onMouseUp={() => props.onPlanAccept(plan().planID)}
              >
                accept
              </text>
              <text
                fg={darkTheme.danger}
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
          when={props.timeline().length > 0}
          fallback={
            <box
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              minHeight={12}
              gap={1}
            >
              <text fg={darkTheme.muted}>
                Start a conversation with the Chat
              </text>
            </box>
          }
        >
          <For each={props.timeline()}>
            {(entry) => (
              <Show
                when={entry.kind === "message"}
                fallback={
                  <Show
                    when={entry.kind === "thinking"}
                    fallback={
                      <box paddingLeft={3} marginTop={1}>
                        <text fg={darkTheme.muted} wrapMode="word">
                          → {entry.kind === "action" ? entry.summary : ""}
                        </text>
                      </box>
                    }
                  >
                    {/* A Chat thinking row, like the main feed's Thought block:
                        one muted line while it streams, expandable. */}
                    <ChatThinkingRow
                      text={entry.kind === "thinking" ? entry.text : ""}
                    />
                  </Show>
                }
              >
                {/* The main feed's own row renderer: user messages get the
                    accent left rail, Chat replies the padded streaming
                    markdown. Same component, same interaction language. */}
                <MessageBlockView
                  block={
                    {
                      id:
                        entry.kind === "message" || entry.kind === "thinking"
                          ? entry.messageID
                          : entry.id,
                      role:
                        entry.kind === "message" && entry.role === "user"
                          ? "user"
                          : "assistant",
                      text: entry.kind === "message" ? entry.text : "",
                      owner: "projection",
                    } as MessageBlock
                  }
                  density="comfortable"
                  toolDetails="collapsed"
                  reasoning="step"
                  diffStyle="auto"
                  terminalWidth={120}
                  toolPreviewLines={10}
                />
              </Show>
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
          <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
            Intents
          </text>
          <For each={[...pendingIntents(), ...acknowledgedIntents().slice(-2)]}>
            {(message) => (
              <text fg={darkTheme.muted} wrapMode="word">
                [{message.priority}] {message.intent}:{" "}
                {message.safeSummary ?? ""} · {message.status}
              </text>
            )}
          </For>
        </box>
      </Show>
      {/* The composer box, copied line for line from opencode's prompt
          (packages/tui/src/component/prompt/index.tsx): an outer anchor, a left
          frame with a rounded bottom-left corner, a padded panel box holding
          the textarea and a meta row, and a one-line bottom frame. */}
      <box visible={true} width="100%" flexShrink={0}>
        <box
          width="100%"
          border={["left"]}
          borderColor={darkTheme.accent}
          customBorderChars={PROMPT_FRAME_BORDER}
        >
          <box
            paddingLeft={2}
            paddingRight={2}
            paddingTop={1}
            flexShrink={0}
            backgroundColor={darkTheme.panel}
            flexGrow={1}
            width="100%"
          >
            <textarea
              ref={(value: TextareaRenderable) => {
                input = value;
                setInputTarget(value as unknown as InputRenderable);
                props.onInputRef(value as unknown as InputRenderable);
              }}
              width="100%"
              placeholder="Ask the Chat..."
              placeholderColor={darkTheme.muted}
              textColor={darkTheme.text}
              focusedTextColor={darkTheme.text}
              minHeight={1}
              maxHeight={props.promptMaxHeight}
              focusedBackgroundColor={darkTheme.panel}
              cursorColor={darkTheme.text}
              onMouseDown={(event: MouseEvent) => event.target?.focus()}
              syntaxStyle={markdownSyntax()}
              onContentChange={() => setDraft(input?.plainText ?? "")}
            />
            <box
              flexDirection="row"
              flexShrink={0}
              paddingTop={1}
              gap={1}
              justifyContent="space-between"
            >
              <box flexDirection="row" gap={1}>
                <text fg={darkTheme.muted}>Chat · read-only</text>
              </box>
            </box>
          </box>
        </box>
        <box
          height={1}
          width="100%"
          border={["left"]}
          borderColor={darkTheme.accent}
          customBorderChars={PROMPT_BOTTOM_BORDER}
        />
      </box>
    </box>
  );
}

/** A Chat thinking row, mirroring the main feed's Thought block. */
function ChatThinkingRow(props: { text: string }) {
  const [collapsed, setCollapsed] = createSignal(false);
  return (
    <box
      flexDirection="column"
      marginTop={1}
      paddingLeft={3}
      onMouseUp={() => setCollapsed((value) => !value)}
    >
      <text fg={darkTheme.warning}>{collapsed() ? "+ " : "- "}Thought</text>
      <Show when={!collapsed()}>
        <box paddingLeft={2} paddingTop={1}>
          <text fg={darkTheme.muted} wrapMode="word">
            {props.text || "Thinking..."}
          </text>
        </box>
      </Show>
    </box>
  );
}
