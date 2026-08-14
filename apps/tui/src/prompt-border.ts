/**
 * The composer frame border characters, copied from the reference TUI's ui/border
 * (packages/tui/src/ui/border.ts): `EmptyBorder` keeps the frame borderless
 * except the vertical line, and the prompt frame rounds its bottom-left corner
 * with "╹". Shared by the main composer and the Live Work Chat composer.
 */
export const PROMPT_FRAME_BORDER = {
  topLeft: "",
  bottomLeft: "╹",
  vertical: "┃",
  topRight: "",
  bottomRight: "",
  horizontal: " ",
  bottomT: "",
  topT: "",
  cross: "",
  leftT: "",
  rightT: "",
};

export const PROMPT_BOTTOM_BORDER = {
  topLeft: "",
  bottomLeft: "╹",
  vertical: "",
  topRight: "",
  bottomRight: "",
  horizontal: " ",
  bottomT: "",
  topT: "",
  cross: "",
  leftT: "",
  rightT: "",
};
