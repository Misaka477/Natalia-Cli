import { createSignal, For, Show } from "solid-js";
import { SyntaxStyle, TextAttributes } from "@opentui/core";
import { useAppState, type MessageBlock } from "../../context/state";
import { keymapBoundary, moduleBoundaries } from "../../keymap";
import { darkTheme, roleColor } from "../../theme/theme";
import { useRuntimeContext } from "../../context/runtime";

const markdownSyntax = SyntaxStyle.fromStyles({
  heading: { fg: darkTheme.accent, bold: true },
  strong: { bold: true },
  code: { fg: darkTheme.warning },
  link: { fg: darkTheme.accent, underline: true },
});

export function SessionRoute(props: {
  scrollRef?: { current?: any };
  ptyScrollRef?: { current?: any };
  followBottom?: boolean;
}) {
  const { state, dispatch } = useAppState();
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
        stickyScroll={props.followBottom ?? true}
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
      <Show when={state.ptyPane.selectedID}>
        {(selectedID) => {
          const pty = () => state.pty[selectedID()];
          return (
            <Show when={pty()}>
              <ModelPTyPane
                pty={pty()!}
                timeline={state.ptyTimeline[selectedID()] ?? []}
                sessions={Object.values(state.pty).filter(
                  (item) =>
                    item.ownership === "model" &&
                    item.status !== "exited" &&
                    item.status !== "failed",
                )}
                onSelect={(id) => dispatch({ type: "pty.pane.select", id })}
                focus={state.ptyPane.focus}
                onFocus={() =>
                  dispatch({ type: "pty.pane.focus", focus: "pty" })
                }
                scrollRef={props.ptyScrollRef}
              />
            </Show>
          );
        }}
      </Show>
      <Show when={state.retryBanner}>
        {(retry) => (
          <box flexShrink={0} paddingLeft={1} backgroundColor={darkTheme.panel}>
            <text fg={darkTheme.warning}>{retry()}</text>
          </box>
        )}
      </Show>
      <Show when={state.compactionBanner}>
        {(banner) => (
          <box flexShrink={0} paddingLeft={1} backgroundColor={darkTheme.panel}>
            <text fg={darkTheme.accent}>{banner()}</text>
          </box>
        )}
      </Show>
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

function ModelPTyPane(props: {
  pty: Extract<
    ReturnType<typeof useAppState>["state"]["pty"][string],
    { type: "pty.update" }
  >;
  timeline: Extract<
    ReturnType<typeof useAppState>["state"]["ptyTimeline"][string][number],
    { type: "pty.timeline" }
  >[];
  sessions: Extract<
    ReturnType<typeof useAppState>["state"]["pty"][string],
    { type: "pty.update" }
  >[];
  onSelect(id: string): void;
  focus: "chat" | "pty";
  onFocus(): void;
  scrollRef?: { current?: any };
}) {
  const target = () =>
    props.pty.target.kind === "host"
      ? `host:${props.pty.target.cwd}`
      : `sandbox:${props.pty.target.sandboxID}:${props.pty.target.isolationLevel}`;
  return (
    <box
      flexShrink={0}
      flexDirection="column"
      border
      borderColor={props.focus === "pty" ? darkTheme.accent : darkTheme.muted}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={1}
      paddingBottom={1}
      marginTop={1}
      marginBottom={1}
      backgroundColor={darkTheme.panel}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text
          fg={props.focus === "pty" ? darkTheme.accent : darkTheme.muted}
          attributes={TextAttributes.BOLD}
        >
          PTY Pane · model control · {props.pty.status}
        </text>
        <text fg={darkTheme.muted} onMouseUp={props.onFocus}>
          {props.focus === "pty"
            ? "PTY focus · Ctrl+T chat"
            : "chat focus · Ctrl+T PTY"}
        </text>
      </box>
      <Show when={props.sessions.length > 1}>
        <box flexDirection="row" gap={1}>
          <For each={props.sessions}>
            {(session, index) => (
              <text
                fg={
                  session.id === props.pty.id
                    ? darkTheme.accent
                    : darkTheme.muted
                }
                attributes={
                  session.id === props.pty.id ? TextAttributes.BOLD : undefined
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
        {props.pty.id} · {target()} · {props.pty.cwd} · {props.pty.rows}x
        {props.pty.cols} · prompt {props.pty.prompt ?? "-"}
      </text>
      <Show when={props.pty.approvalID}>
        <text fg={darkTheme.warning}>
          Awaiting user approval: {props.pty.approvalID}. Model writes are
          paused.
        </text>
      </Show>
      <text fg={darkTheme.muted}>TRANSCRIPT</text>
      <scrollbox
        ref={(value: any) => {
          if (props.scrollRef) props.scrollRef.current = value;
        }}
        maxHeight={10}
        border={["left"]}
        borderColor={darkTheme.muted}
        paddingLeft={1}
        stickyScroll={props.focus === "pty"}
        stickyStart="bottom"
      >
        <text fg={darkTheme.text} wrapMode="word">
          {(props.pty.transcript ?? props.pty.tail) ||
            "(waiting for terminal output)"}
        </text>
      </scrollbox>
      <text fg={darkTheme.muted}>MODEL TIMELINE</text>
      <For each={props.timeline.slice(-4)}>
        {(item) => (
          <text fg={darkTheme.muted}>
            [{item.actor}] {item.action} · {item.status} · {item.summary}
          </text>
        )}
      </For>
      <text fg={darkTheme.muted}>
        User writes are not enabled in this version.
      </text>
    </box>
  );
}

function MessageBlockView(props: { block: MessageBlock }) {
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
              : props.block.role === "assistant"
                ? " Natalia"
                : ` ${props.block.role.charAt(0).toUpperCase()}${props.block.role.slice(1)}`}
        </text>
        {props.block.status ? (
          <text fg={darkTheme.muted}>[{props.block.status}]</text>
        ) : null}
        {props.block.role === "thinking" &&
        props.block.providerPolicy === "hidden" ? (
          <text fg={darkTheme.warning}>provider-safe</text>
        ) : null}
      </box>
      <BlockBody block={props.block} />
    </box>
  );
}

function BlockBody(props: { block: MessageBlock }) {
  if (props.block.tool) return <ToolBlockView block={props.block} />;
  if (props.block.role === "assistant") {
    return (
      <box paddingLeft={1} flexDirection="column">
        <markdown
          content={props.block.text}
          streaming={true}
          syntaxStyle={markdownSyntax}
          fg={darkTheme.text}
        />
        <Show when={props.block.pendingText}>
          <text fg={darkTheme.muted} wrapMode="word">
            {props.block.pendingText}
          </text>
        </Show>
      </box>
    );
  }
  if (props.block.role === "thinking") {
    return (
      <box paddingLeft={1} flexDirection="column">
        <text fg={darkTheme.muted} wrapMode="word">
          {props.block.text || "Thinking..."}
        </text>
        <Show when={props.block.pendingText}>
          <text fg={darkTheme.muted} wrapMode="word">
            {props.block.pendingText}
          </text>
        </Show>
      </box>
    );
  }
  return (
    <text fg={roleColor(props.block.role)} wrapMode="word" paddingLeft={1}>
      {props.block.text}
    </text>
  );
}

function ToolBlockView(props: { block: MessageBlock }) {
  const [expanded, setExpanded] = createSignal(false);
  const tool = () => props.block.tool!;
  return (
    <box
      flexDirection="column"
      paddingLeft={1}
      border={["left"]}
      borderColor={toolColor(tool().status)}
      onMouseUp={() => setExpanded((value) => !value)}
    >
      <text fg={toolColor(tool().status)} attributes={TextAttributes.BOLD}>
        {toolIcon(tool().kind)} {tool().name} · {tool().status}
      </text>
      <text fg={darkTheme.text} wrapMode="word">
        {props.block.text}
      </text>
      <Show when={!tool().argumentsComplete}>
        <text fg={darkTheme.muted}>arguments pending; partial JSON hidden</text>
      </Show>
      <Show when={tool().argumentsComplete && tool().redactedArguments}>
        <text fg={darkTheme.muted} wrapMode="word">
          args: {tool().keyArguments.join(", ") || "{}"}
        </text>
      </Show>
      <Show when={tool().result}>
        {(result) => (
          <box flexDirection="column">
            <text fg={darkTheme.muted}>
              result: {result().summary}
              {result().truncated ? " · collapsed for UI only" : ""}
            </text>
            <text fg={darkTheme.text} wrapMode="word">
              {expanded() ? result().detail : result().preview}
            </text>
          </box>
        )}
      </Show>
      <Show when={tool().detailAvailable}>
        <text fg={darkTheme.muted}>
          {expanded() ? "collapse details" : "expand/full detail pager entry"}
        </text>
      </Show>
    </box>
  );
}

function toolColor(status: string) {
  if (status === "succeeded") return darkTheme.success;
  if (status === "failed" || status === "rejected" || status === "cancelled")
    return darkTheme.danger;
  if (status === "awaiting_approval") return darkTheme.warning;
  return darkTheme.accent;
}

function toolIcon(kind: string) {
  if (kind === "diff") return "diff";
  if (kind === "todo") return "todo";
  if (kind === "workflow") return "flow";
  if (kind === "background") return "bg";
  if (kind === "subagent") return "agent";
  if (kind === "pty") return "pty";
  if (kind === "sandbox") return "box";
  if (kind === "skill") return "skill";
  return "tool";
}
