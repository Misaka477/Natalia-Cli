import { TextareaRenderable, TextAttributes } from "@opentui/core";
import { useBindings } from "@opentui/keymap/solid";
import type { RuntimeClient } from "@natalia/contracts";
import type { ModalRequest } from "@natalia/ui-model";
import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { usePromptRef } from "../../context/prompt";
import { useModeStack } from "../../modal/mode-stack";
import { themeTokens as darkTheme } from "../../theme/theme";

const MODE = "approval";

export function PermissionPrompt(props: {
  request: Extract<ModalRequest, { kind: "approval" }>;
  backend: RuntimeClient;
  onExit(): void;
}) {
  const [stage, setStage] = createSignal<"prompt" | "reject">("prompt");
  const [selected, setSelected] = createSignal(0);
  const [expanded, setExpanded] = createSignal(false);
  const actions = ["once", "session", "reject"] as const;
  const prompt = usePromptRef();
  const modes = useModeStack();
  let input: TextareaRenderable | undefined;

  onMount(() => {
    const pop = modes.push(MODE);
    onCleanup(pop);
  });

  function reply(decision: (typeof actions)[number], feedback?: string) {
    props.backend.respondApproval({
      requestID: props.request.id,
      decision,
      feedback:
        decision === "reject" ? feedback?.trim() || undefined : undefined,
    });
    queueMicrotask(() => prompt.focus());
  }

  useBindings(() => ({
    mode: MODE,
    enabled: stage() === "reject",
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
        cmd: () => reply("reject", input?.plainText),
      },
    ],
  }));

  useBindings(() => ({
    mode: MODE,
    enabled: stage() === "prompt",
    bindings: [
      {
        key: "left",
        desc: "Previous permission option",
        group: "Permission",
        cmd: () =>
          setSelected((selected() + actions.length - 1) % actions.length),
      },
      {
        key: "h",
        desc: "Previous permission option",
        group: "Permission",
        cmd: () =>
          setSelected((selected() + actions.length - 1) % actions.length),
      },
      {
        key: "right",
        desc: "Next permission option",
        group: "Permission",
        cmd: () => setSelected((selected() + 1) % actions.length),
      },
      {
        key: "l",
        desc: "Next permission option",
        group: "Permission",
        cmd: () => setSelected((selected() + 1) % actions.length),
      },
      {
        key: "return",
        desc: "Select permission option",
        group: "Permission",
        cmd: () => select(),
      },
      {
        key: "escape",
        desc: "Reject permission",
        group: "Permission",
        cmd: () => reply("reject"),
      },
      {
        key: "d",
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

  return (
    <box
      backgroundColor={darkTheme.panel}
      border={["left"]}
      borderColor={darkTheme.warning}
      flexDirection="column"
    >
      <box
        flexDirection="column"
        gap={1}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
      >
        <box flexDirection="row" gap={1}>
          <text fg={darkTheme.warning}>△</text>
          <text attributes={TextAttributes.BOLD} fg={darkTheme.text}>
            Permission required
          </text>
        </box>
        <text fg={darkTheme.text} wrapMode="word">
          {props.request.title}
        </text>
        <text fg={darkTheme.muted} wrapMode="word">
          {props.request.preview}
        </text>
        <Show when={props.request.keyArguments?.length}>
          <text fg={darkTheme.muted}>
            args: {props.request.keyArguments?.join(", ")}
          </text>
        </Show>
        <Show when={props.request.detail}>
          <text fg={darkTheme.muted}>
            d {expanded() ? "hide" : "show"} detail
          </text>
          <Show when={expanded()}>
            <scrollbox maxHeight={8}>
              <text fg={darkTheme.text} wrapMode="word">
                {props.request.detail}
              </text>
            </scrollbox>
          </Show>
        </Show>
      </box>
      <Show
        when={stage() === "reject"}
        fallback={<Actions selected={selected()} onSelect={select} />}
      >
        <box
          flexDirection="row"
          gap={2}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          backgroundColor={darkTheme.background}
        >
          <textarea
            ref={(value: TextareaRenderable) => {
              input = value;
              value.traits = { status: "REJECT" };
            }}
            focused
            placeholder="Tell Natalia what to do differently"
            placeholderColor={darkTheme.muted}
            textColor={darkTheme.text}
            focusedTextColor={darkTheme.text}
            cursorColor={darkTheme.warning}
          />
          <text fg={darkTheme.muted}>enter confirm · esc cancel</text>
        </box>
      </Show>
    </box>
  );
}

function Actions(props: { selected: number; onSelect(index: number): void }) {
  return (
    <box
      flexDirection="row"
      gap={1}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      backgroundColor={darkTheme.background}
    >
      <For each={["Allow once", "Allow session", "Reject"]}>
        {(label, index) => (
          <box
            paddingLeft={1}
            paddingRight={1}
            border={["left"]}
            borderColor={
              index() === props.selected ? darkTheme.warning : darkTheme.panel
            }
            onMouseUp={() => props.onSelect(index())}
          >
            <text
              fg={darkTheme.text}
              attributes={
                index() === props.selected ? TextAttributes.BOLD : undefined
              }
            >
              {index() === props.selected ? "> " : "  "}
              {label}
            </text>
          </box>
        )}
      </For>
      <text fg={darkTheme.muted}>←→ select · enter confirm · esc reject</text>
    </box>
  );
}
