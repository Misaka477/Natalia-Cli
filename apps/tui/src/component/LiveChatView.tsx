"use client";
import {
  InputRenderable,
  ScrollBoxRenderable,
  TextAttributes,
} from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import { useBindings } from "@opentui/keymap/solid";
import { For, Show, createEffect, createSignal, onMount } from "solid-js";
import type { RuntimeClient, ChatMessageRow } from "@natalia/contracts";
import { darkTheme } from "../theme/theme";

/**
 * Live Work Chat (P8 C2) as a docked, always-available conversation. The user
 * talks to a Chat collaborator that shares the safe project/execution context
 * (the runtime injects it per turn), streams its reply, drafts plans and sends
 * user-confirmed mailbox intents. This view only sends chat messages and reads
 * the durable conversation — every write to the project goes through the main
 * agent, never through here (§2.2 boundary).
 *
 * The conversation comes from the shared projection (`chat.message.added` /
 * `chat.message.delta` / `chat.rollback`), so streaming replies appear live and
 * the view never drifts from the journal (§8.3).
 */

export function LiveChatView(props: {
  backend: RuntimeClient;
  /** The durable conversation, projected by the app shell. */
  messages: () => ChatMessageRow[];
  /** Whether this pane owns keyboard focus (host pane-focus signal). */
  focused: () => boolean;
  /** The host routes Enter/Escape to the pane that owns focus. */
  onRequestFocus(): void;
  /** Esc in the chat pane returns focus to the main feed. */
  onEscape(): void;
  /** Closes the docked view entirely. */
  onClose(): void;
  /** Registers the message input with the host for focus routing. */
  onInputRef(value: InputRenderable | undefined): void;
  /** Sends the message into the Chat conversation. */
  onSend(text: string): void;
  /** Rolls the conversation back to a message boundary. */
  onRollback(toMessageID: string): void;
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
        hasPTY: boolean;
        hasSandbox: boolean;
      }
    | undefined
  >();
  const [inputTarget, setInputTarget] = createSignal<InputRenderable>();
  let input: InputRenderable | undefined;
  let chatScroll: ScrollBoxRenderable | undefined;

  const lastUserMessage = () => {
    const messages = props.messages();
    for (let index = messages.length - 1; index >= 0; index--)
      if (messages[index]?.role === "user") return messages[index];
    return undefined;
  };

  onMount(() => {
    void (props.backend.sessionSnapshot?.() ?? Promise.resolve(undefined)).then(
      (snapshot) => setAgentStatus(snapshot ?? undefined),
      () => undefined,
    );
  });
  createEffect(() => {
    if (!props.focused()) return;
    queueMicrotask(() => {
      if (!input || input.isDestroyed) return;
      input.focus();
    });
  });
  createEffect(() => {
    // A streaming reply settles with the final `chat.message.added`; stay at
    // the bottom while the conversation grows.
    if (props.messages().length > 0)
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
          props.onSend(text);
        },
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
      gap={1}
      backgroundColor={darkTheme.background}
      onMouseUp={() => {
        if (renderer.getSelection()?.getSelectedText()) return;
        props.onRequestFocus();
      }}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={darkTheme.accent}>
          Live Work Chat
        </text>
        <box flexDirection="row" gap={2}>
          <Show when={lastUserMessage()}>
            {(message) => (
              <text
                fg={darkTheme.muted}
                onMouseUp={() => props.onRollback(message().messageID)}
              >
                ↩ rollback
              </text>
            )}
          </Show>
          <text fg={darkTheme.muted} onMouseUp={() => props.onClose()}>
            × close
          </text>
        </box>
      </box>
      <Show when={agentStatus()}>
        {(status) => (
          <text fg={darkTheme.muted}>
            Main agent: {status().agentStatus}
            {status().currentStep ? ` · ${status().currentStep}` : ""}
            {status().activeTool ? ` · ${status().activeTool}` : ""} ·{" "}
            {status().changedFiles} changed · {status().unvalidatedChanges}{" "}
            unvalidated
          </text>
        )}
      </Show>
      <Show
        when={props.messages().length > 0}
        fallback={
          <box flexDirection="column" gap={1} paddingLeft={1} paddingTop={1}>
            <text fg={darkTheme.muted}>
              Chat with the collaborator about the main agent's work — what it
              is doing, why, changed files, risk, or a lower-risk route.
            </text>
            <text fg={darkTheme.muted}>
              Decided something? Chat can queue a mailbox intent for the main
              agent or draft a plan for your review.
            </text>
          </box>
        }
      >
        <scrollbox
          height={20}
          maxHeight={20}
          border={["left"]}
          borderColor={darkTheme.muted}
          ref={(value: ScrollBoxRenderable) => (chatScroll = value)}
        >
          <For each={props.messages()}>
            {(message) => (
              <box
                flexDirection="column"
                paddingBottom={1}
                paddingLeft={message.role === "chat" ? 1 : 2}
              >
                <text
                  fg={
                    message.role === "user" ? darkTheme.accent : darkTheme.text
                  }
                  attributes={
                    message.role === "user" ? TextAttributes.BOLD : undefined
                  }
                >
                  {message.role === "user" ? "You" : "Chat"}
                </text>
                <text fg={darkTheme.text} wrapMode="word">
                  {message.text}
                </text>
              </box>
            )}
          </For>
        </scrollbox>
      </Show>
      <box flexDirection="column" gap={1}>
        <input
          placeholder="Ask the Chat about the main agent's work..."
          placeholderColor={darkTheme.muted}
          textColor={darkTheme.text}
          focusedTextColor={darkTheme.text}
          onInput={(value: string) => setDraft(value)}
          ref={(value: InputRenderable) => {
            input = value;
            setInputTarget(value);
            props.onInputRef(value);
          }}
        />
        <text fg={darkTheme.muted}>
          Enter send · Esc to feed · ↩ rollback undoes the last exchange
        </text>
      </box>
    </box>
  );
}
