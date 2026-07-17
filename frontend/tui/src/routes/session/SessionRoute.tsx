import { For, Show } from "solid-js";
import { TextAttributes } from "@opentui/core";
import { useAppState } from "../../context/state";
import { keymapBoundary, moduleBoundaries } from "../../keymap";
import { darkTheme } from "../../theme/theme";
import { useRuntimeContext } from "../../context/runtime";

export function SessionRoute(props: { scrollRef?: { current?: any } }) {
  const { state } = useAppState();
  const runtime = useRuntimeContext();
  return (
    <box flexGrow={1} minHeight={0} flexDirection="column" width="100%">
      <box
        flexShrink={0}
        flexDirection="row"
        justifyContent="space-between"
        paddingLeft={1}
        paddingRight={1}
        backgroundColor={darkTheme.panel}
      >
        <text attributes={TextAttributes.BOLD} fg={darkTheme.accent}>
          {state.title}
        </text>
        <text fg={darkTheme.muted}>
          {runtime.platform} {runtime.multiplexer ?? "direct"}{" "}
          {runtime.displayServer ?? "headless"}
        </text>
      </box>
      <scrollbox
        ref={(r: any) => {
          if (props.scrollRef) props.scrollRef.current = r;
        }}
        flexGrow={1}
        stickyScroll
        stickyStart="bottom"
        paddingLeft={1}
        paddingRight={1}
      >
        <For each={state.messages}>
          {(block) => <MessageBlockView block={block} />}
        </For>
        <Show when={state.messages.length < 3}>
          <box flexDirection="column" marginTop={1}>
            <For each={moduleBoundaries}>
              {(item) => <text fg={darkTheme.muted}>- {item}</text>}
            </For>
          </box>
        </Show>
      </scrollbox>
      <box
        flexShrink={0}
        flexDirection="row"
        gap={2}
        paddingLeft={1}
        paddingRight={1}
        backgroundColor={darkTheme.panel}
      >
        <For each={state.statusSegments.slice(0, 5)}>
          {(segment) => <text fg={darkTheme.muted}>{segment}</text>}
        </For>
        <text fg={darkTheme.success}>status:{state.status}</text>
        <text fg={darkTheme.muted}>{keymapBoundary.submit} submit</text>
        <text fg={darkTheme.muted}>{keymapBoundary.palette} palette</text>
      </box>
    </box>
  );
}

function MessageBlockView(props: {
  block: { role: string; text: string; status?: string };
}) {
  const isUser = props.block.role === "user";
  return (
    <box flexDirection="column" marginTop={1}>
      <box flexDirection="row" gap={1}>
        <text
          fg={isUser ? darkTheme.accent : darkTheme.muted}
          attributes={TextAttributes.BOLD}
        >
          {isUser
            ? "▎You"
            : props.block.role === "system"
              ? " System"
              : ` ${props.block.role.charAt(0).toUpperCase()}${props.block.role.slice(1)}`}
        </text>
        {props.block.status ? (
          <text fg={darkTheme.muted}>[{props.block.status}]</text>
        ) : null}
      </box>
      <text fg={darkTheme.text} wrapMode="word" paddingLeft={1}>
        {props.block.text}
      </text>
    </box>
  );
}
