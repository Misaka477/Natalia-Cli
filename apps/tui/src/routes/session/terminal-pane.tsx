import { TextAttributes } from "@opentui/core";
import { For, Show } from "solid-js";
import type { TerminalView } from "@natalia/view-store";
import { themeTokens as darkTheme } from "../../theme/theme";
import { terminalPreview } from "../../terminal-preview";

export function ModelTerminalPane(props: {
  terminal: TerminalView;
  sessions: TerminalView[];
  onSelect(id: string): void;
}) {
  const target = () =>
    props.terminal.target.kind === "host"
      ? `host:${props.terminal.target.cwd}`
      : `sandbox:${props.terminal.target.sandboxID}:${props.terminal.target.isolationLevel}`;
  return (
    <box
      flexShrink={0}
      flexDirection="column"
      border
      borderColor={darkTheme.muted}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      marginTop={1}
      marginBottom={1}
      backgroundColor={darkTheme.panel}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text fg={darkTheme.muted} attributes={TextAttributes.BOLD}>
          Terminal Preview · model control · {props.terminal.status}
        </text>
      </box>
      <Show when={props.sessions.length > 1}>
        <box flexDirection="row" gap={1}>
          <For each={props.sessions}>
            {(session, index) => (
              <text
                fg={
                  session.id === props.terminal.id
                    ? darkTheme.accent
                    : darkTheme.muted
                }
                attributes={
                  session.id === props.terminal.id
                    ? TextAttributes.BOLD
                    : undefined
                }
                onMouseUp={() => props.onSelect(session.id)}
              >
                {index() + 1}:{session.id} {session.status}
              </text>
            )}
          </For>
        </box>
      </Show>
      <text fg={darkTheme.muted}>
        {props.terminal.id} · {target()} · {props.terminal.cwd} ·{" "}
        {props.terminal.rows}x{props.terminal.cols} · prompt{" "}
        {props.terminal.prompt ?? "-"}
        {" · "}
        {props.terminal.inputOwner?.type === "viewer"
          ? `user control (${props.terminal.inputOwner.viewerID})`
          : "model control"}
        {` · ${props.terminal.viewers?.length ?? 0} viewer(s)`}
      </text>
      <Show when={props.terminal.approvalID}>
        <text fg={darkTheme.warning}>
          Awaiting user approval: {props.terminal.approvalID}. Model writes are
          paused.
        </text>
      </Show>
      <For
        each={terminalPreview(
          props.terminal.screen?.text ?? props.terminal.tail,
        )}
      >
        {(line) => (
          <text fg={darkTheme.muted} wrapMode="none">
            {line}
          </text>
        )}
      </For>
      <text fg={darkTheme.muted}>
        Preview is read-only and never resizes the terminal.
      </text>
    </box>
  );
}
