export const keymapBoundary = {
  submit: "return",
  newline: "option+enter / shift+enter",
  cancel: "ctrl+c",
  exit: "ctrl+d on empty composer",
  palette: "ctrl+p",
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
