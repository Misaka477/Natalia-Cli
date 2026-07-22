import { createCliRenderer } from "@opentui/core";
import { createMockKeys } from "@opentui/core/testing";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { KeymapProvider } from "@opentui/keymap/solid";
import { render } from "@opentui/solid";
import { DialogVariant } from "../src/component/DialogVariant";
import { DialogProvider, useDialog } from "../src/dialog/provider";
import { registerNataliaKeymap } from "../src/modal/mode-stack";

let dialog: ReturnType<typeof useDialog> | undefined;
function Harness() {
  dialog = useDialog();
  return null;
}

const renderer = await createCliRenderer({
  width: 90,
  height: 24,
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

let selected: string | undefined;
dialog!.push(() => (
  <DialogVariant
    model={{
      id: "beta",
      name: "Beta",
      provider: "local",
      variants: ["fast", "careful"],
    }}
    select={async (variant) => {
      selected = variant;
    }}
  />
));
const keys = createMockKeys(renderer, { kittyKeyboard: true });
await Bun.sleep(80);
keys.pressArrow("down");
await Bun.sleep(30);
keys.pressArrow("down");
await Bun.sleep(30);
keys.pressEnter();
await Bun.sleep(80);
if (selected !== "careful")
  throw new Error(`expected careful variant, got ${String(selected)}`);

renderer.destroy();
disposeKeymap();
console.log("model variant keyboard smoke passed");
