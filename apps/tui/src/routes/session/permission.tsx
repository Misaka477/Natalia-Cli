import { TextareaRenderable, TextAttributes } from "@opentui/core";
import { useBindings } from "@opentui/keymap/solid";
import type { PermissionFamily, RuntimeClient } from "@natalia/contracts";
import type { ModalRequest } from "@natalia/ui-model";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { useToast } from "../../context/toast";
import { themeTokens as darkTheme } from "../../theme/theme";
import { useModeStack } from "../../modal/mode-stack";
import { isLiveChatPlanApproval } from "./live-chat-plan-approval";

export { isLiveChatPlanApproval };

const MODE = "approval";

export function PermissionPrompt(props: {
  request: Extract<ModalRequest, { kind: "approval" }>;
  backend: RuntimeClient;
  onExit(): void;
  compact?: boolean;
}) {
  // The prompt is an inline bottom card, not an overlay: it registers the mode
  // that gates its keys for as long as it is mounted and releases it when it
  // goes away, leaving the timeline visible and scrollable above it.
  const modes = useModeStack();
  onMount(() => {
    const release = modes.push(MODE);
    onCleanup(release);
  });
  const [stage, setStage] = createSignal<"prompt" | "reject">("prompt");
  const toast = useToast();
  const [selected, setSelected] = createSignal(0);
  const [expanded, setExpanded] = createSignal(false);
  const [submitting, setSubmitting] = createSignal(false);
  const actions = ["once", "session", "reject"] as const;
  const family = () =>
    (
      props.request as typeof props.request & {
        permissionFamily?: PermissionFamily;
      }
    ).permissionFamily;
  const sessionLabel = () =>
    family()?.sessionAction ??
    (family()?.label
      ? `Allow ${family()!.label} for session`
      : "Allow session");
  let input: TextareaRenderable | undefined;

  function reply(decision: (typeof actions)[number], feedback?: string) {
    if (submitting()) return;
    setSubmitting(true);
    // The runtime worker can exit underneath the TUI; a delivery that fails
    // must never become an unhandled rejection that takes the process down.
    const outcome = props.backend.respondApproval?.({
      requestID: props.request.id,
      decision,
      feedback:
        decision === "reject" ? feedback?.trim() || undefined : undefined,
    });
    if (outcome instanceof Promise)
      void outcome.catch((error: unknown) => {
        setSubmitting(false);
        const detail = error instanceof Error ? error.message : String(error);
        toast.show({
          variant: "error",
          message: `Your decision could not be delivered: ${detail}`.slice(
            0,
            160,
          ),
        });
      });
  }

  useBindings(() => ({
    mode: MODE,
    enabled: stage() === "reject" && !submitting(),
    bindings: [
      {
        key: "escape",
        desc: "Cancel permission rejection",
        group: "Permission",
        cmd: () => setStage("prompt"),
      },
      {
        key: "return",
        desc: "Confirm permission rejection",
        group: "Permission",
        cmd: () => reply("reject", input?.plainText?.trim() || undefined),
      },
    ],
  }));

  useBindings(() => ({
    mode: MODE,
    enabled: stage() === "prompt" && !submitting(),
    bindings: [
      ...(props.compact
        ? (["up", "k"] as const)
        : (["left", "h"] as const)
      ).map((key) => ({
        key,
        desc: "Previous permission option",
        group: "Permission",
        cmd: () =>
          setSelected((selected() + actions.length - 1) % actions.length),
      })),
      ...(props.compact
        ? (["down", "j"] as const)
        : (["right", "l"] as const)
      ).map((key) => ({
        key,
        desc: "Next permission option",
        group: "Permission",
        cmd: () => setSelected((selected() + 1) % actions.length),
      })),
      {
        key: "return",
        desc: "Select permission option",
        group: "Permission",
        cmd: () => select(),
      },
      {
        key: "escape",
        // Escape must never answer on its own. A modal can appear while the
        // user is reaching for another surface, and an immediate rejection
        // there would fail the whole turn. This only opens the rejection
        // stage, which still requires an explicit confirmation.
        desc: "Start rejecting permission",
        group: "Permission",
        cmd: () => select(actions.indexOf("reject")),
      },
      {
        key: "alt+d",
        desc: "Toggle permission detail",
        group: "Permission",
        cmd: () => setExpanded((value) => !value),
      },
      ...actions.map((action, index) => ({
        key: String(index + 1),
        desc: `Select ${action}`,
        group: "Permission",
        cmd: () => select(index),
      })),
    ],
  }));

  function select(index = selected()) {
    const action = actions[index]!;
    setSelected(index);
    if (action !== "reject") return reply(action);
    setStage("reject");
    queueMicrotask(() => input?.focus());
  }

  const card = (
    <box
      flexShrink={0}
      marginLeft={props.compact ? 0 : 2}
      marginRight={props.compact ? 0 : 2}
      marginTop={props.compact ? 0 : 1}
      backgroundColor={darkTheme.panel}
      border={props.compact ? false : true}
      borderColor={props.compact ? undefined : darkTheme.warning}
      flexDirection="column"
      paddingLeft={props.compact ? 1 : 2}
      paddingRight={props.compact ? 1 : 2}
      paddingTop={1}
      paddingBottom={1}
      gap={1}
    >
      <box flexDirection="row" justifyContent="space-between" gap={2}>
        <text attributes={TextAttributes.BOLD} fg={darkTheme.warning}>
          Permission required
        </text>
        <text fg={darkTheme.muted}>
          {family()?.label ?? props.request.title}
        </text>
      </box>
      <text
        fg={darkTheme.text}
        attributes={TextAttributes.BOLD}
        wrapMode="word"
      >
        {props.request.preview}
      </text>
      <Show when={family()?.scope ?? props.request.scope}>
        <text fg={darkTheme.muted} wrapMode="word">
          {family()?.scope ?? props.request.scope}
          {props.request.expiresAt
            ? ` · expires ${props.request.expiresAt}`
            : ""}
          {props.request.revocable ? " · revocable" : ""}
        </text>
      </Show>
      <Show when={props.request.detail && expanded()}>
        <scrollbox
          maxHeight={8}
          border={["left"]}
          borderColor={darkTheme.muted}
          paddingLeft={1}
        >
          <text fg={darkTheme.text} wrapMode="word">
            {props.request.detail}
          </text>
        </scrollbox>
      </Show>
      <Show
        when={stage() === "reject"}
        fallback={
          <Actions
            selected={selected()}
            sessionLabel={sessionLabel()}
            submitting={submitting()}
            compact={props.compact}
            onSelect={select}
          />
        }
      >
        <box
          flexDirection="column"
          gap={1}
          backgroundColor={darkTheme.background}
          paddingLeft={1}
          paddingRight={1}
          paddingTop={1}
          paddingBottom={1}
        >
          <textarea
            ref={(value: TextareaRenderable) => {
              input = value;
              value.traits = { status: "REJECT" };
            }}
            focused
            placeholder="Optional: tell Natalia or Navi what to do differently"
            placeholderColor={darkTheme.muted}
            textColor={darkTheme.text}
            focusedTextColor={darkTheme.text}
            cursorColor={darkTheme.warning}
          />
          <text fg={darkTheme.muted}>
            Enter confirm rejection · Esc cancel · reason optional
          </text>
        </box>
      </Show>
      <Show when={stage() === "prompt" && !submitting()}>
        <text fg={darkTheme.muted}>
          {props.compact ? "↑ ↓ select" : "← → select"} · Enter confirm · Esc
          reject
          {props.request.detail
            ? ` · Alt+d ${expanded() ? "hide plan" : "show full plan"}`
            : ""}
        </text>
      </Show>
    </box>
  );
  return card;
}

function Actions(props: {
  selected: number;
  sessionLabel: string;
  submitting: boolean;
  compact?: boolean;
  onSelect(index: number): void;
}) {
  return (
    <box flexDirection={props.compact ? "column" : "row"} gap={1}>
      <For
        each={
          props.submitting
            ? ["Applying decision..."]
            : ["Allow once", props.sessionLabel, "Reject"]
        }
      >
        {(label, index) => (
          <box
            flexShrink={props.compact ? undefined : 0}
            backgroundColor={
              index() === props.selected
                ? darkTheme.warning
                : darkTheme.background
            }
            paddingLeft={1}
            paddingRight={1}
            onMouseUp={() => props.onSelect(index())}
          >
            <text
              wrapMode={props.compact ? "word" : undefined}
              fg={
                index() === props.selected
                  ? darkTheme.background
                  : darkTheme.text
              }
              attributes={
                index() === props.selected ? TextAttributes.BOLD : undefined
              }
            >
              {index() + 1} {label}
            </text>
          </box>
        )}
      </For>
    </box>
  );
}
