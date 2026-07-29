import { TextAttributes } from "@opentui/core";
import { Show } from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";
import { useAppState, type MessageBlock } from "../../context/state";
import { roleColor, themeTokens as darkTheme } from "../../theme/theme";
import type { TuiPreferences } from "../../settings";
import { markdownSyntax, ToolBlockView } from "./tool-views";
import { InlineInteractiveBlock } from "./interactive-rows";

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
  const isUser = props.block.role === "user";
  const isThinking = props.block.role === "thinking";
  const isAssistant = props.block.role === "assistant";
  const isCopyable = isUser || isThinking || isAssistant;
  return (
    <box
      flexDirection="column"
      marginTop={props.density === "comfortable" ? 1 : 0}
      border={isThinking || isAssistant ? ["left"] : []}
      borderColor={isThinking ? darkTheme.muted : darkTheme.accent}
      paddingLeft={isThinking || isAssistant ? 1 : 0}
    >
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
                : props.block.role === "subagent"
                  ? " Subagent"
                  : ` ${props.block.role.charAt(0).toUpperCase()}${props.block.role.slice(1)}`}
        </text>
        {props.block.status ? (
          <text fg={darkTheme.muted}>[{props.block.status}]</text>
        ) : null}
        {props.block.role === "thinking" &&
        props.block.providerPolicy === "hidden" ? (
          <text fg={darkTheme.warning}>provider-safe</text>
        ) : null}
        <Show when={isCopyable && (props.onCopy || (isUser && props.onFork))}>
          <box flexDirection="row" gap={1}>
            <Show when={props.onCopy}>
              <text
                fg={darkTheme.muted}
                onMouseUp={() => props.onCopy?.(props.block.text)}
              >
                copy
              </text>
            </Show>
            <Show when={isUser && props.onFork}>
              <text
                fg={darkTheme.muted}
                onMouseUp={() =>
                  props.onFork?.(props.block.id, props.block.text)
                }
              >
                fork
              </text>
            </Show>
          </box>
        </Show>
      </box>
      <BlockBody block={props.block} toolDetails={props.toolDetails} />
    </box>
  );
}

function BlockBody(props: {
  block: MessageBlock;
  toolDetails: TuiPreferences["toolDetails"];
}) {
  if (props.block.role === "assistant") {
    return (
      <box flexDirection="column">
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
      </box>
    );
  }
  if (props.block.role === "thinking") {
    return (
      <box flexDirection="column">
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
    <text
      fg={roleColor(props.block.role, darkTheme)}
      wrapMode="word"
      paddingLeft={1}
    >
      {props.block.text}
    </text>
  );
}
