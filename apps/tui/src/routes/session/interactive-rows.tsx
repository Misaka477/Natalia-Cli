import { TextAttributes } from "@opentui/core";
import { Show } from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";
import type { MessageBlock } from "../../context/state";
import { themeTokens as darkTheme } from "../../theme/theme";

export function InlineInteractiveBlock(props: {
  block: MessageBlock;
  backend?: RuntimeClient;
}) {
  const interactive = () => props.block.interactive!;
  const resolved = () => Boolean(interactive().response);
  const approval = () => {
    const value = interactive();
    return value.kind === "approval" ? value : undefined;
  };
  const approvalFamily = () =>
    (
      approval()?.request as
        | { permissionFamily?: { label: string; scope: string } }
        | undefined
    )?.permissionFamily;
  const question = () => {
    const value = interactive();
    return value.kind === "question" ? value : undefined;
  };
  return (
    <box
      flexDirection="column"
      border={["left"]}
      borderColor={
        interactive().kind === "approval" ? darkTheme.warning : darkTheme.accent
      }
      paddingLeft={1}
      marginTop={1}
    >
      <Show when={interactive().kind === "approval"}>
        <Show
          when={resolved()}
          fallback={
            <text fg={darkTheme.warning}>
              △ {approvalFamily()?.label ?? approval()?.request.title} awaiting
              approval
            </text>
          }
        >
          <box flexDirection="column" gap={1}>
            <text fg={darkTheme.warning} attributes={TextAttributes.BOLD}>
              △ Permission {props.block.status}
            </text>
            <Show when={approvalFamily()}>
              {(family) => (
                <text fg={darkTheme.muted}>
                  {family().label} · {family().scope}
                </text>
              )}
            </Show>
            <text fg={darkTheme.text} wrapMode="word">
              {approval()?.request.title}
            </text>
            <text fg={darkTheme.muted} wrapMode="word">
              {approval()?.request.preview}
            </text>
            <text fg={darkTheme.muted}>{props.block.text}</text>
          </box>
        </Show>
      </Show>
      <Show when={interactive().kind === "question"}>
        <box flexDirection="column" gap={1}>
          <text fg={darkTheme.accent} attributes={TextAttributes.BOLD}>
            ? {resolved() ? props.block.status : "Question"}
          </text>
          <text fg={darkTheme.text} wrapMode="word">
            {question()?.request.title}
          </text>
          <Show when={!resolved()}>
            <text fg={darkTheme.muted}>Question dock active below</text>
          </Show>
          <Show when={resolved()}>
            <text fg={darkTheme.muted}>{props.block.text}</text>
          </Show>
        </box>
      </Show>
    </box>
  );
}
