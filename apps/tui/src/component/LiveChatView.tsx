"use client";
import {
  InputRenderable,
  ScrollBoxRenderable,
  TextAttributes,
} from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import { useBindings } from "@opentui/keymap/solid";
import { For, Show, createEffect, createSignal, onMount } from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";
import { darkTheme } from "../theme/theme";
import { useDialog } from "../dialog/provider";
import { DialogSelect } from "../dialog/DialogSelect";

/**
 * Live Work Chat (P8 Phase C2) as a docked view: a read-only collaboration
 * surface over the main agent's real state. It answers "what is the agent
 * doing, what does the plan say, what intents are queued, is anything drifting"
 * from the durable read models and turns the user's message into a durable
 * mailbox intent the main agent receives at the next safe boundary.
 *
 * The boundary from P8 §2.2 is structural: this surface only calls the read
 * queries and `mailboxSend`; it never writes files, runs shells, writes the
 * terminal or approves actions.
 *
 * Unlike the dialog shell it replaced, this view is docked beside the feed:
 * `focused()` is the host's single pane-focus signal, so Enter sends here only
 * while this pane owns the keyboard and Escape hands focus back to the feed.
 */

const MAILBOX_INTENTS = [
  "clarification",
  "constraint",
  "reprioritize",
  "pause",
  "cancel",
  "request_report",
  "proposed_change",
  "next_plan_handoff",
] as const;

type MailboxIntent = (typeof MAILBOX_INTENTS)[number];

type SentIntent = {
  messageID: string;
  intent: string;
  text: string;
};

type SnapshotRow = NonNullable<
  Awaited<ReturnType<NonNullable<RuntimeClient["sessionSnapshot"]>>>
>;
type PlanRow = NonNullable<
  Awaited<ReturnType<NonNullable<RuntimeClient["planList"]>>>
>[number];
type MailboxRow = NonNullable<
  Awaited<ReturnType<NonNullable<RuntimeClient["mailboxList"]>>>
>[number];
type DriftRow = NonNullable<
  Awaited<ReturnType<NonNullable<RuntimeClient["driftFindings"]>>>
>[number];
type CompletionRow = NonNullable<
  Awaited<ReturnType<NonNullable<RuntimeClient["completions"]>>>
>[number];

export function LiveChatView(props: {
  backend: RuntimeClient;
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
}) {
  const dialog = useDialog();
  const renderer = useRenderer();
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string>();
  const [snapshot, setSnapshot] = createSignal<SnapshotRow | undefined>();
  const [plans, setPlans] = createSignal<PlanRow[]>([]);
  const [mailbox, setMailbox] = createSignal<MailboxRow[]>([]);
  const [drift, setDrift] = createSignal<DriftRow[]>([]);
  const [completions, setCompletions] = createSignal<CompletionRow[]>([]);
  const [draft, setDraft] = createSignal("");
  const [intent, setIntent] = createSignal<MailboxIntent>("clarification");
  const [sent, setSent] = createSignal<SentIntent[]>([]);
  const [inputTarget, setInputTarget] = createSignal<InputRenderable>();
  let input: InputRenderable | undefined;
  let chatScroll: ScrollBoxRenderable | undefined;

  const activePlan = () => {
    const plansList = plans();
    return (
      plansList.find((plan) => plan.status === "active") ??
      plansList.find((plan) => plan.status === "queued_next_plan")
    );
  };
  const pendingIntents = () =>
    mailbox().filter(
      (message) =>
        message.status === "queued" || message.status === "delivered",
    );
  const openFindings = () =>
    drift().filter((finding) => finding.status === "open");

  const refresh = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const [nextSnapshot, nextPlans, nextMailbox, nextDrift, nextCompletions] =
        await Promise.all([
          props.backend.sessionSnapshot?.() ?? Promise.resolve(undefined),
          props.backend.planList?.() ?? Promise.resolve([]),
          props.backend.mailboxList?.() ?? Promise.resolve([]),
          props.backend.driftFindings?.() ?? Promise.resolve([]),
          props.backend.completions?.() ?? Promise.resolve([]),
        ]);
      setSnapshot(nextSnapshot);
      setPlans(nextPlans as PlanRow[]);
      setMailbox(nextMailbox as MailboxRow[]);
      setDrift(nextDrift as DriftRow[]);
      setCompletions(nextCompletions as CompletionRow[]);
    } catch {
      setError("Unable to load the live work state");
    } finally {
      setLoading(false);
    }
  };

  const chooseIntent = () => {
    if (draft().trim().length === 0) {
      setError("Type a message first");
      return;
    }
    dialog.push(() => (
      <DialogSelect<MailboxIntent>
        title="Send intent to the main agent"
        skipFilter
        current={intent()}
        options={MAILBOX_INTENTS.map((value) => ({
          title: value,
          value,
          description: value === intent() ? "current intent" : undefined,
        }))}
        onSelect={(option) => setIntent(option.value)}
      />
    ));
  };

  const send = async () => {
    const text = draft().trim();
    if (text.length === 0 || !props.backend.mailboxSend) {
      setError(
        !props.backend.mailboxSend
          ? "This runtime transport does not serve a mailbox"
          : "Type a message first",
      );
      return;
    }
    setLoading(true);
    setError(undefined);
    try {
      const outcome = await props.backend.mailboxSend({
        intent: intent(),
        text,
        // The safe summary is the bounded, redacted prose the runtime records;
        // the runtime redacts secret-shaped tokens before anything reaches the
        // journal (§56.18).
        safeSummary: text.slice(0, 500),
        priority: "normal",
        deliveryPolicy: "next_safe_boundary",
      });
      if (outcome.queued && outcome.messageID) {
        setSent((current) => [
          ...current,
          { messageID: outcome.messageID!, intent: intent(), text },
        ]);
        setDraft("");
        queueMicrotask(() =>
          chatScroll?.scrollTo(chatScroll.scrollHeight ?? 0),
        );
      }
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The intent was not queued",
      );
    } finally {
      setLoading(false);
    }
  };

  onMount(() => {
    void refresh();
  });
  // While this pane owns focus its input takes the keyboard; on first mount it
  // is focused so the pane is usable the moment it opens.
  createEffect(() => {
    if (!props.focused()) return;
    queueMicrotask(() => {
      if (!input || input.isDestroyed) return;
      input.focus();
    });
  });
  useBindings(() => ({
    mode: "base",
    target: inputTarget,
    enabled: props.focused() && inputTarget() !== undefined && !loading(),
    priority: 1,
    bindings: [
      {
        key: "return",
        desc: "Send the message as an intent",
        group: "Live Work Chat",
        cmd: () => void send(),
      },
      {
        key: "t",
        desc: "Choose the intent type",
        group: "Live Work Chat",
        cmd: chooseIntent,
      },
      {
        key: "escape",
        desc: "Return focus to the main feed",
        group: "Live Work Chat",
        cmd: props.onEscape,
      },
    ],
  }));
  useBindings(() => ({
    mode: "base",
    enabled: true,
    priority: -1,
    bindings: [
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
        <text fg={darkTheme.muted} onMouseUp={() => props.onClose()}>
          × close
        </text>
      </box>
      <text fg={darkTheme.muted}>
        Chat: read-only · writes routed through the main-agent mailbox only
      </text>
      <Show when={error()}>
        <text fg={darkTheme.danger}>{error()}</text>
      </Show>
      <Show
        when={!loading()}
        fallback={<text fg={darkTheme.muted}>Loading live work state...</text>}
      >
        <scrollbox
          height={18}
          maxHeight={18}
          border={["left"]}
          borderColor={darkTheme.muted}
          ref={(value: ScrollBoxRenderable) => (chatScroll = value)}
        >
          <Show when={snapshot()}>
            {(current) => (
              <box flexDirection="column" paddingBottom={1}>
                <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
                  Main agent: {current().agentStatus}
                </text>
                <Show when={current().currentStep}>
                  <text fg={darkTheme.muted}>
                    Step: {current().currentStep}
                  </text>
                </Show>
                <Show when={current().activeTool}>
                  <text fg={darkTheme.muted}>Tool: {current().activeTool}</text>
                </Show>
                <text fg={darkTheme.muted}>
                  Changed files: {current().changedFiles} · Unvalidated:{" "}
                  {current().unvalidatedChanges}
                </text>
                <text fg={darkTheme.muted}>
                  PTY: {current().hasPTY ? "attached" : "none"} · Sandbox:{" "}
                  {current().hasSandbox ? "active" : "none"}
                </text>
              </box>
            )}
          </Show>
          <Show when={activePlan()}>
            {(plan) => (
              <box flexDirection="column" paddingBottom={1}>
                <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
                  Plan {plan().status}: {plan().title} (v{plan().version})
                </text>
                <text fg={darkTheme.text} wrapMode="word">
                  {plan().objective}
                </text>
                <text fg={darkTheme.muted}>
                  {plan().steps.length} step(s) · {plan().constraints.length}{" "}
                  constraint(s) · {plan().verification.length} verification(s)
                </text>
              </box>
            )}
          </Show>
          <Show when={openFindings().length > 0}>
            <box flexDirection="column" paddingBottom={1}>
              <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
                Drift findings
              </text>
              <For each={openFindings()}>
                {(finding) => (
                  <text
                    fg={
                      finding.severity === "high"
                        ? darkTheme.danger
                        : finding.severity === "warning"
                          ? darkTheme.warning
                          : darkTheme.muted
                    }
                    wrapMode="word"
                  >
                    {finding.severity} · {finding.originalObjective} ·{" "}
                    {finding.currentActivity}
                  </text>
                )}
              </For>
            </box>
          </Show>
          <Show when={completions().length > 0}>
            <box flexDirection="column" paddingBottom={1}>
              <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
                Completion card
              </text>
              <text fg={darkTheme.text} wrapMode="word">
                {completions().at(-1)!.changeSummary}
              </text>
              <text fg={darkTheme.muted}>
                {completions()
                  .at(-1)!
                  .validations.filter(
                    (validation) => validation.result === "passed",
                  ).length === completions().at(-1)!.validations.length
                  ? "All validations passed"
                  : "Some validations pending"}{" "}
                · {completions().at(-1)!.knownGaps.length} gap(s)
              </text>
            </box>
          </Show>
          <Show when={pendingIntents().length > 0}>
            <box flexDirection="column" paddingBottom={1}>
              <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
                Pending intents
              </text>
              <For each={pendingIntents()}>
                {(message) => (
                  <text fg={darkTheme.text} wrapMode="word">
                    [{message.priority}] {message.intent}: {message.text} ·{" "}
                    {message.status}
                  </text>
                )}
              </For>
            </box>
          </Show>
          <Show when={sent().length > 0}>
            <box flexDirection="column" paddingBottom={1}>
              <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
                Sent to the main agent
              </text>
              <For each={sent()}>
                {(message) => (
                  <text fg={darkTheme.muted} wrapMode="word">
                    [{message.intent}] {message.text}
                  </text>
                )}
              </For>
            </box>
          </Show>
        </scrollbox>
      </Show>
      <box flexDirection="column" gap={1}>
        <input
          placeholder="Type a message for the main agent..."
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
          Enter send as {intent()} · T choose intent · R refresh · Esc to feed
        </text>
      </box>
    </box>
  );
}
