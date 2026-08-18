import { createSignal, Show } from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";
import type { MessageBlock } from "../../context/state";
import { roleColor, themeTokens as darkTheme } from "../../theme/theme";
import type { TuiPreferences } from "../../settings";
import { markdownSyntax, ToolBlockView } from "./tool-views";
import { InlineInteractiveBlock } from "./interactive-rows";
import { alwaysSeparate } from "./sibling-margin";

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
  reasoning: TuiPreferences["reasoning"];
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
    return (
      <ThinkingBlock
        block={props.block}
        density={props.density}
        defaultOpen={props.reasoning === "step"}
      />
    );
  if (role === "assistant")
    return (
      <AssistantBlock
        block={props.block}
        density={props.density}
        onCopy={props.onCopy}
      />
    );
  if (role === "turn_footer")
    return (
      <box paddingLeft={3} paddingTop={1}>
        <text fg={darkTheme.muted}>{props.block.text}</text>
      </box>
    );
  return (
    <box
      flexDirection="column"
      marginTop={props.density === "comfortable" ? 1 : 0}
      paddingLeft={role === "system" || role === "subagent" ? 2 : 1}
      ref={(element: any) => alwaysSeparate.add(element)}
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
  return (
    <box
      flexDirection="column"
      marginTop={props.density === "comfortable" ? 1 : 0}
      border={["left"]}
      borderColor={darkTheme.accent}
      backgroundColor={darkTheme.panel}
      paddingLeft={2}
      paddingTop={1}
      paddingBottom={1}
      ref={(element: any) => alwaysSeparate.add(element)}
      onMouseOver={() => setHover(true)}
      onMouseOut={() => setHover(false)}
    >
      <text fg={darkTheme.text} wrapMode="word">
        {props.block.text}
      </text>
      <Show when={props.block.status === "queued"}>
        <text fg={darkTheme.muted}>QUEUED</text>
      </Show>
      <Show when={props.block.pendingText}>
        <text fg={darkTheme.muted} wrapMode="word">
          {props.block.pendingText}
        </text>
      </Show>
      <Show
        when={hover() && (props.onCopy || (props.onFork && props.block.text))}
      >
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
  return (
    <box
      flexDirection="column"
      marginTop={props.density === "comfortable" ? 1 : 0}
      paddingLeft={3}
      ref={(element: any) => alwaysSeparate.add(element)}
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
      <Show when={props.onCopy}>
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
  defaultOpen: boolean;
}) {
  // Reasoning is the part of the model the user actually wants to read, so it
  // is open by default; the header collapses it when the row is long.
  const [collapsed, setCollapsed] = createSignal(!props.defaultOpen);
  const providerSafe = props.block.providerPolicy === "hidden";
  return (
    <box
      flexDirection="column"
      marginTop={props.density === "comfortable" ? 1 : 0}
      paddingLeft={3}
      ref={(element: any) => alwaysSeparate.add(element)}
      onMouseUp={() => setCollapsed((value) => !value)}
    >
      <text fg={darkTheme.warning}>
        {collapsed() ? "+ " : "- "}Thought
        {providerSafe ? " · provider-safe" : ""}
      </text>
      <Show when={!collapsed()}>
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
