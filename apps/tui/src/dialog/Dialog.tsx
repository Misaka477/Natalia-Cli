import type { ParentProps } from "solid-js";
import { useRenderer, useTerminalDimensions } from "@opentui/solid";
import { RGBA } from "@opentui/core";
import { darkTheme } from "../theme/theme";

export function Dialog(
  props: ParentProps<{
    size?: "medium" | "large" | "xlarge";
    onClose: () => void;
    dismissible?: boolean;
  }>,
) {
  const dimensions = useTerminalDimensions();
  const renderer = useRenderer();

  let dismiss = false;
  const width = () => {
    if (props.size === "xlarge") return 116;
    if (props.size === "large") return 88;
    return 60;
  };

  return (
    <box
      onMouseDown={() => {
        dismiss = !!renderer.getSelection();
      }}
      onMouseUp={() => {
        if (dismiss) {
          dismiss = false;
          return;
        }
        if (props.dismissible !== false) props.onClose?.();
      }}
      width={dimensions().width}
      height={dimensions().height}
      alignItems="center"
      position="absolute"
      zIndex={3000}
      paddingTop={dimensions().height / 4}
      left={0}
      top={0}
      backgroundColor={RGBA.fromInts(0, 0, 0, 150)}
    >
      <box
        onMouseUp={(e: { stopPropagation(): void }) => {
          if (renderer.getSelection()?.getSelectedText()) return;
          dismiss = false;
          e.stopPropagation();
        }}
        width={width()}
        maxWidth={dimensions().width - 2}
        maxHeight={Math.max(8, dimensions().height - 4)}
        backgroundColor={darkTheme.panel}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        flexShrink={1}
      >
        {props.children}
      </box>
    </box>
  );
}
