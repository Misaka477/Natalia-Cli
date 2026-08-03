import { onCleanup, type ParentProps } from "solid-js";
import { Dialog } from "../dialog/Dialog";
import { useModeStack } from "./mode-stack";

/**
 * A runtime-initiated modal surface: an approval or a question.
 *
 * These are contract-bound and must be answered, so unlike a dialog they are
 * not dismissible. Registering the surface here rather than inside the prompt
 * keeps one entry per visible surface, which is what makes the paint order and
 * the key-dispatch order agree.
 */
export function ModalSurface(
  props: ParentProps<{
    mode: string;
    size?: "medium" | "large" | "xlarge";
  }>,
) {
  const modes = useModeStack();
  const surface = modes.pushSurface(props.mode);
  onCleanup(() => surface.release());

  return (
    <Dialog
      dismissible={false}
      size={props.size ?? "medium"}
      onClose={() => undefined}
      zIndex={surface.zIndex()}
    >
      {props.children}
    </Dialog>
  );
}
