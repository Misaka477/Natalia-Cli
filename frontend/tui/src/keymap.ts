export const keymapBoundary = {
  submit: "return",
  newline: "ctrl+j / option+enter / shift+enter",
  cancel: "ctrl+c",
  exit: "ctrl+d on empty composer",
  palette: "ctrl+p",
  composer:
    "history up/down · word move/delete via OpenTUI textarea · paste limit 8 MiB",
  scrollUp: "pgup",
  scrollDown: "pgdn",
  scrollTop: "home",
  scrollBottom: "end",
};

export const moduleBoundaries = [
  "app/runtime: OpenTUI renderer lifecycle and fake backend wiring",
  "context/state: local reducer for typed frontend events",
  "prompt/editor: grapheme, paste, byte/hash integrity helpers",
  "routes/session: managed full-screen message viewport",
  "dialog: command palette, approval, question placeholders",
  "theme/keymap: local presentation constants only",
];

export type ComposerKeyEvent = {
  ctrl?: boolean;
  alt?: boolean;
  meta?: boolean;
  option?: boolean;
  shift?: boolean;
  name?: string;
  key?: string;
};

export type ComposerKeyAction =
  | "submit"
  | "newline"
  | "buffer-home"
  | "buffer-end"
  | undefined;

export function composerKeyAction(event: ComposerKeyEvent): ComposerKeyAction {
  const key = event.name ?? event.key;
  if (event.ctrl && key === "j") return "newline";
  if (key === "return" || key === "enter") {
    if (event.option || event.alt || event.meta || event.shift)
      return "newline";
    return "submit";
  }
  if (event.ctrl && key === "home") return "buffer-home";
  if (event.ctrl && key === "end") return "buffer-end";
  return undefined;
}
