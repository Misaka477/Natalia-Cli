import { createMockKeys } from "@opentui/core/testing";
import type { RuntimeClient, SubmittedTurn } from "@natalia/contracts";
import { runTuiShell } from "../src/app/runtime";

const sessions: Array<string | undefined> = [];
const handle = await runTuiShell({
  backend: backend(),
  closeAfterInitialTurn: false,
  rendererSize: { width: 100, height: 28 },
  onSessionChange: (sessionID) => sessions.push(sessionID),
});
const keys = createMockKeys(handle.renderer, { kittyKeyboard: true });

await Bun.sleep(100);
keys.pressKey("p", { ctrl: true });
await Bun.sleep(50);
keys.pressEnter();
await Bun.sleep(50);

if (sessions.length !== 1)
  throw new Error("Expected the initial palette option to select New session");

handle.stop();
console.log("palette keyboard smoke passed");

function backend(): RuntimeClient {
  return {
    start(onEvent) {
      onEvent({ type: "session.created", sessionID: "ses_palette_smoke" as never, title: "Palette smoke" });
      onEvent({ type: "session.ready", sessionID: "ses_palette_smoke" as never });
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
    lastSubmission: () => undefined,
    respondApproval() {},
    respondQuestion() {},
  };
}
