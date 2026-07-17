import { Show } from "solid-js";
import { TextAttributes } from "@opentui/core";
import { useAppState } from "../context/state";
import { darkTheme } from "../theme/theme";

export function DialogLayer() {
  const { state } = useAppState();
  return (
    <Show when={state.dialog}>
      <box
        position="absolute"
        left={4}
        top={3}
        width="70%"
        border
        borderColor={darkTheme.accent}
        backgroundColor={darkTheme.panel}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
      >
        <text attributes={TextAttributes.BOLD} fg={darkTheme.accent}>
          {state.dialog === "palette"
            ? "Command / Palette Placeholder"
            : state.dialog === "approval"
              ? "Approval Placeholder"
              : "Question Placeholder"}
        </text>
        <text fg={darkTheme.text}>
          {state.dialog === "palette"
            ? "Type in the editor below and press Enter to run"
            : "Placeholder – full routing in M5-M7"}
        </text>
        <text fg={darkTheme.muted}>
          Escape to close dialog and resume normal input
        </text>
      </box>
    </Show>
  );
}
