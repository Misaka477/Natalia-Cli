import { createSignal, Show } from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";
import type { MessageBlock } from "../../context/state";
import { roleColor, themeTokens as darkTheme } from "../../theme/theme";
import type { TuiPreferences } from "../../settings";
import { markdownSyntax, ToolBlockView } from "./tool-views";
import { InlineInteractiveBlock } from "./interactive-rows";

/**
 * Renders one transcript row against the reference interaction language:
 * content first, chrome last. A user message is a coloured left rail with no
 * label, an assistant reply is plain indented content, and a thinking row is a
 * single "Thought" line until opened. Consecutive rows separate by a hairline,
 * not by a per-row toolbar.
 */
export function MessageBlockView(props: {
  block: MessageBlock;
  backend?: RuntimeClient;
  onCopy?: (text: string) => void;
  onFork?: (turnID: string, prompt: string) => void;
  density: TuiPreferences["density"];
  toolDetails: TuiPreferences["toolDetails"];
  diffStyle: TuiPreferences["diffStyle"];
  terminalWidth: number;
  toolPreviewLines: number;
}) {
  if (props.block.interactive)
    return (
      <InlineInteractiveBlock block={props.block} backend={props.backend} />
    );
  if (props.block.tool)
    return (
      <ToolBlockView
        block={props.block}
        toolDetails={props.toolDetails}
        diffStyle={props.diffStyle}
        terminalWidth={props.terminalWidth}
        toolPreviewLines={props.toolPreviewLines}
      />
    );
  const role = props.block.role;
  if (role === "user")
    return (
      <UserBlock
        block={props.block}
        density={props.density}
        onCopy={props.onCopy}
        onFork={props.onFork}
      />
    );
  if (role === "thinking")
    return <ThinkingBlock block={props.block} density={props.density} />;
  if (role === "assistant")
    return (
      <AssistantBlock
        block={props.block}
        density={props.density}
        onCopy={props.onCopy}
      />
    );
  return (
    <box
      flexDirection="column"
      marginTop={props.density === "comfortable" ? 1 : 0}
      paddingLeft={role === "system" || role === "subagent" ? 2 : 1}
    >
      <text fg={roleColor(role, darkTheme)} wrapMode="word">
        {props.block.text}
      </text>
    </box>
  );
}

function UserBlock(props: {
  block: MessageBlock;
  density: TuiPreferences["density"];
  onCopy?: (text: string) => void;
  onFork?: (turnID: string, prompt: string) => void;
}) {
  const [hover, setHover] = createSignal(false);
  const actionable = Boolean(
    props.onCopy || (props.onFork && props.block.text),
  );
  return (
    <box
      flexDirection="column"
      marginTop={props.density === "comfortable" ? 1 : 0}
      border={["left"]}
      borderColor={darkTheme.accent}
      paddingLeft={2}
      paddingTop={1}
      paddingBottom={1}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
    >
      <text fg={darkTheme.text} wrapMode="word">
        {props.block.text}
      </text>
      <Show when={props.block.pendingText}>
        <text fg={darkTheme.muted} wrapMode="word">
          {props.block.pendingText}
        </text>
      </Show>
      <Show when={hover() && actionable}>
        <box flexDirection="row" gap={2} paddingTop={1}>
          <Show when={props.onCopy}>
            <text
              fg={darkTheme.muted}
              onMouseUp={() => props.onCopy?.(props.block.text)}
            >
              copy
            </text>
          </Show>
          <Show when={props.onFork}>
            <text
              fg={darkTheme.muted}
              onMouseUp={() => props.onFork?.(props.block.id, props.block.text)}
            >
              fork
            </text>
          </Show>
        </box>
      </Show>
    </box>
  );
}

function AssistantBlock(props: {
  block: MessageBlock;
  density: TuiPreferences["density"];
  onCopy?: (text: string) => void;
}) {
  const [hover, setHover] = createSignal(false);
  return (
    <box
      flexDirection="column"
      marginTop={props.density === "comfortable" ? 1 : 0}
      paddingLeft={3}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
    >
      <markdown
        content={props.block.text}
        streaming={true}
        syntaxStyle={markdownSyntax()}
        fg={darkTheme.text}
      />
      <Show when={props.block.pendingText}>
        <text fg={darkTheme.muted} wrapMode="word">
          {props.block.pendingText}
        </text>
      </Show>
      <Show when={hover() && props.onCopy}>
        <text
          fg={darkTheme.muted}
          paddingTop={1}
          onMouseUp={() => props.onCopy?.(props.block.text)}
        >
          copy
        </text>
      </Show>
    </box>
  );
}

function ThinkingBlock(props: {
  block: MessageBlock;
  density: TuiPreferences["density"];
}) {
  const [expanded, setExpanded] = createSignal(false);
  const providerSafe = props.block.providerPolicy === "hidden";
  return (
    <box
      flexDirection="column"
      marginTop={props.density === "comfortable" ? 1 : 0}
      paddingLeft={3}
      onMouseUp={() => setExpanded((value) => !value)}
    >
      <text fg={darkTheme.warning}>
        {expanded() ? "- " : "+ "}Thought
        {providerSafe ? " · provider-safe" : ""}
      </text>
      <Show when={expanded()}>
        <box paddingLeft={2} paddingTop={1}>
          <text fg={darkTheme.muted} wrapMode="word">
            {props.block.text || "Thinking..."}
          </text>
          <Show when={props.block.pendingText}>
            <text fg={darkTheme.muted} wrapMode="word">
              {props.block.pendingText}
            </text>
          </Show>
        </box>
      </Show>
    </box>
  );
}
