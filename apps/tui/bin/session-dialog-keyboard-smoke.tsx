import { createCliRenderer } from "@opentui/core";
import { createMockKeys } from "@opentui/core/testing";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { KeymapProvider } from "@opentui/keymap/solid";
import { render } from "@opentui/solid";
import type { RuntimeSessionSummary } from "@natalia/contracts";
import { DialogSessionList } from "../src/dialog/DialogLayer";
import { DialogProvider, useDialog } from "../src/dialog/provider";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

let open: (() => void) | undefined;
function Harness() {
  const dialog = useDialog();
  open = () =>
    dialog.push(() => (
      <DialogSessionList
        backend={backend}
        onSelect={(id) => selected.push(id)}
      />
    ));
  return null;
}

const sessions: RuntimeSessionSummary[] = [
  {
    id: "ses_smoke",
    title: "Smoke session",
    createdAt: "2026-01-01T00:00:00.000Z",
    pinned: false,
    events: 1,
    pendingInputs: 0,
    cancelled: false,
    resumable: true,
  },
  ...Array.from({ length: 30 }, (_, index) => ({
    id: `ses_long_${index}`,
    title: `Long session ${index} ${"detail ".repeat(8)}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    pinned: false,
    events: index + 2,
    pendingInputs: 0,
    cancelled: false,
    resumable: true,
  })),
];
const selected: Array<string | undefined> = [];
const backend = {
  async list() {
    return [...sessions];
  },
  async touch(id: string) {
    touched.push(id);
  },
  async rename(id: string, title: string) {
    const session = requireSession(id);
    session.title = title;
    return session;
  },
  async pin(id: string, pinned: boolean) {
    const session = requireSession(id);
    session.pinned = pinned;
    return session;
  },
  async duplicate(id: string) {
    const source = requireSession(id);
    const copy = {
      ...source,
      id: "ses_smoke_copy",
      title: `${source.title} (copy)`,
    };
    sessions.push(copy);
    return copy;
  },
  async delete(id: string) {
    const index = sessions.findIndex((session) => session.id === id);
    if (index >= 0) sessions.splice(index, 1);
    return { id, removedAttachments: 0 };
  },
};
const touched: string[] = [];

const renderer = await createCliRenderer({
  width: 100,
  height: 30,
  targetFps: 60,
  exitOnCtrlC: false,
  useKittyKeyboard: {},
  autoFocus: true,
});
const keymap = createDefaultOpenTuiKeymap(renderer);
const disposeKeymap = registerNataliaKeymap(keymap, renderer);
await render(
  () => (
    <KeymapProvider keymap={keymap}>
      <DialogProvider>
        <Harness />
      </DialogProvider>
    </KeymapProvider>
  ),
  renderer,
);

open!();
const keys = createMockKeys(renderer, { kittyKeyboard: true });
await Bun.sleep(100);
keys.pressKey("p");
await Bun.sleep(80);
if (!sessions[0]!.pinned)
  throw new Error("session pin action did not use backend");
keys.pressKey("r");
await Bun.sleep(80);
for (let index = 0; index < "Smoke session".length; index++)
  keys.pressBackspace();
await keys.pasteBracketedText("Renamed session");
keys.pressEnter();
await Bun.sleep(100);
if (sessions[0]!.title !== "Renamed session")
  throw new Error("session rename action did not use backend");
keys.pressKey("c");
await Bun.sleep(80);
if (!sessions.some((session) => session.id === "ses_smoke_copy"))
  throw new Error("session duplicate action did not use backend");
keys.pressEnter();
await Bun.sleep(80);
if (
  selected[0] !== "ses_smoke_copy" ||
  touched[0] !== "ses_smoke" ||
  selected.at(-1) !== "ses_smoke"
)
  throw new Error("session select did not touch and select through backend");

open!();
await Bun.sleep(80);
for (let index = 0; index < 24; index++) keys.pressArrow("down");
await Bun.sleep(100);
keys.pressEnter();
await Bun.sleep(80);
if (selected.at(-1) !== "ses_long_23")
  throw new Error(
    "long session dialog did not keep the keyboard selection visible",
  );

renderer.destroy();
disposeKeymap();
console.log("session dialog keyboard smoke passed");

function requireSession(id: string) {
  const session = sessions.find((item) => item.id === id);
  if (!session) throw new Error(`missing fixture session ${id}`);
  return session;
}
