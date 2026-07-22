import { createMockKeys } from "@opentui/core/testing";
import type { RuntimeClient, SubmittedTurn } from "@natalia/contracts";
import { runTuiShell } from "../src/app/runtime";

const sessions: Array<string | undefined> = [];
let diagnosticsLoaded = 0;
const handle = await runTuiShell({
  backend: backend(),
  closeAfterInitialTurn: false,
  rendererSize: { width: 100, height: 28 },
  onSessionChange: (sessionID) => sessions.push(sessionID),
});
const keys = createMockKeys(handle.renderer, { kittyKeyboard: true });

await Bun.sleep(100);

// Open palette, type "settings", press Enter
keys.pressKey("p", { ctrl: true });
await Bun.sleep(80);
await keys.typeText("settings");
await Bun.sleep(80);
keys.pressEnter();
await Bun.sleep(200);

// Close Settings with Escape
keys.pressEscape();
await Bun.sleep(80);
if (diagnosticsLoaded !== 1)
  throw new Error(`expected diagnostics dialog load, got ${diagnosticsLoaded}`);

// Open runtime diagnostics, copy the report, then close the dialog.
keys.pressKey("p", { ctrl: true });
await Bun.sleep(80);
await keys.typeText("diagnostics");
await Bun.sleep(80);
keys.pressEnter();
await Bun.sleep(160);
keys.pressEnter();
await Bun.sleep(80);
keys.pressEscape();
await Bun.sleep(80);

// Open palette again and create a new session
keys.pressKey("p", { ctrl: true });
await Bun.sleep(80);
// Base-mode leader bindings must not escape through the modal input layer.
keys.pressKey("x", { ctrl: true });
await Bun.sleep(30);
keys.pressKey("n");
await Bun.sleep(80);
if (sessions.length !== 0)
  throw new Error("leader command escaped the command palette modal");
const sessionCountBeforePaletteSubmit = sessions.length;
keys.pressEnter();
await Bun.sleep(200);

if (sessions.length !== sessionCountBeforePaletteSubmit + 1)
  throw new Error(`expected 1 session, got ${sessions.length}`);

handle.stop();
console.log("palette keyboard smoke passed");

function backend(): RuntimeClient {
  return {
    start(onEvent) {
      onEvent({
        type: "session.created",
        sessionID: "ses_palette_smoke" as never,
        title: "Palette smoke",
      });
      onEvent({
        type: "session.ready",
        sessionID: "ses_palette_smoke" as never,
      });
    },
    async submit(text) {
      return {
        type: "turn.submitted",
        id: "turn_palette_smoke",
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "palette-smoke",
      } as SubmittedTurn;
    },
    cancel() {},
    snapshot() {
      return { type: "snapshot.created", id: "palette-smoke", files: [] };
    },
    diagnostic() {},
    async diagnostics() {
      diagnosticsLoaded++;
      return [
        {
          type: "diagnostic",
          level: "warning",
          message: "palette diagnostic",
          at: "2026-07-23T00:00:00.000Z",
        },
      ];
    },
    lastSubmission: () => undefined,
    respondApproval() {},
    respondQuestion() {},
  };
}
