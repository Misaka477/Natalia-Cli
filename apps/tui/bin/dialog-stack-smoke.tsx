import { createCliRenderer, type CliRenderer } from "@opentui/core";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { KeymapProvider } from "@opentui/keymap/solid";
import { render } from "@opentui/solid";
import { createMockKeys } from "@opentui/core/testing";
import {
  DialogProvider,
  useDialog,
  type DialogContext,
} from "../src/dialog/provider";
import { DialogConfirm } from "../src/dialog/DialogConfirm";
import { DialogPrompt } from "../src/dialog/DialogPrompt";
import { DialogSelect } from "../src/dialog/DialogSelect";
import { getOrCreateModeStack, registerNataliaKeymap } from "../src/modal/mode-stack";

let globalDialog: DialogContext | undefined;

function DialogTestHarness() {
  const dialog = useDialog();
  globalDialog = dialog;
  return null;
}

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
        <DialogTestHarness />
        <box padding={2} flexDirection="column" gap={1}>
          <text>Dialog Stack Smoke Test</text>
          <text fg="#8991a5">Testing DialogConfirm.show() → DialogPrompt.show() → DialogSelect.show()</text>
          <text fg="#8991a5">Escape should close, Ctrl+C should close, focus should restore</text>
        </box>
      </DialogProvider>
    </KeymapProvider>
  ),
  renderer,
);

const keys = createMockKeys(renderer, { kittyKeyboard: true });
await Bun.sleep(100);

// ---- Test 1: Confirm dialog ----
const confirmPromise = DialogConfirm.show(globalDialog!, "Confirm Test", "Do you want to continue?");
await Bun.sleep(50);
if (getOrCreateModeStack(keymap).current() !== "modal")
  throw new Error("Dialog stack did not activate modal keymap mode");

// Arrow left switches to "cancel"
keys.pressArrow("left");
await Bun.sleep(50);
// Arrow right switches back to "confirm"
keys.pressArrow("right");
await Bun.sleep(50);
// Enter confirms
keys.pressEnter();
await Bun.sleep(100);

const confirmResult = await confirmPromise;
if (confirmResult !== true) throw new Error(`Confirm test failed: expected true, got ${confirmResult}`);
if (getOrCreateModeStack(keymap).current() !== "base")
  throw new Error("Dialog stack did not restore base keymap mode");

// ---- Test 2: Prompt dialog ----
const promptPromise = DialogPrompt.show(globalDialog!, "Enter name", { placeholder: "Your name" });
await Bun.sleep(50);

// Type some text
await keys.typeText("Natalia");
await Bun.sleep(50);
// Enter submits
keys.pressEnter();
await Bun.sleep(100);

const promptResult = await promptPromise;
if (promptResult !== "Natalia") throw new Error(`Prompt test failed: expected "Natalia", got ${JSON.stringify(promptResult)}`);

// ---- Test 3: Select dialog ----
const selectPromise = new Promise<string>((resolve) => {
  const dialog = globalDialog!;
  dialog.replace(
    () => (
      <DialogSelect
        title="Choose option"
        options={[
          { title: "Option A", value: "a", description: "First option" },
          { title: "Option B", value: "b", description: "Second option", category: "Group 1" },
          { title: "Option C", value: "c", description: "Third option", category: "Group 1" },
          { title: "Option D", value: "d", description: "Fourth option", category: "Group 2" },
        ]}
        onSelect={(opt) => resolve(opt.value as string)}
      />
    ),
    () => resolve(""),
  );
});
await Bun.sleep(100);

// Navigate down twice to reach Option C
keys.pressArrow("down");
await Bun.sleep(30);
keys.pressArrow("down");
await Bun.sleep(30);
// Enter selects
keys.pressEnter();
await Bun.sleep(100);

const selectResult = await selectPromise;
if (selectResult !== "c") throw new Error(`Select test failed: expected "c", got ${JSON.stringify(selectResult)}`);

// ---- Test 4: Nested dialogs ----
async function testNestedDialogs() {
  // Open confirm
  const nestedConfirm = DialogConfirm.show(globalDialog!, "Nested", "Open prompt?");
  await Bun.sleep(50);
  keys.pressEnter();
  await Bun.sleep(50);
  const confirmOk = await nestedConfirm;
  if (confirmOk !== true) throw new Error("Nested confirm failed");

  // Now open another confirm (should push on stack)
  const secondConfirm = DialogConfirm.show(globalDialog!, "Second level", "Go deeper?");
  await Bun.sleep(50);
  // Escape should close this one
  keys.pressEscape();
  await Bun.sleep(50);
  const secondResult = await secondConfirm;
  if (secondResult !== undefined) throw new Error("Escape should return undefined");

  // The first dialog should be back? Actually after escape, the stack is cleared
  // because DialogConfirm calls dialog.clear() on escape via the binding.
  // Actually, onClose is called with resolve(undefined), and clear() pops everything.
  // So after escape, the stack is empty.
  // Let's verify by checking there are no dialogs.
  if (globalDialog!.stack.length !== 0) throw new Error("Stack should be empty after escape on nested dialog");
}

await testNestedDialogs();

// ---- Test 5: Escape closes dialog ----
const escPromise = DialogConfirm.show(globalDialog!, "Escape Test", "Press Escape to close");
await Bun.sleep(50);
keys.pressEscape();
await Bun.sleep(100);

const escResult = await escPromise;
if (escResult !== undefined) throw new Error("Escape test failed: expected undefined");

// ---- Test 6: Ctrl+C closes dialog ----
const ctrlCPromise = DialogConfirm.show(globalDialog!, "Ctrl+C Test", "Press Ctrl+C to close");
await Bun.sleep(50);
keys.pressCtrlC();
await Bun.sleep(100);

const ctrlCResult = await ctrlCPromise;
if (ctrlCResult !== undefined) throw new Error("Ctrl+C test failed: expected undefined");

// ---- Done ----
renderer.destroy();
disposeKeymap();
console.log("All dialog stack smoke tests passed!");
