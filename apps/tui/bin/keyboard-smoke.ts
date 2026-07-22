import { createMockKeys } from "@opentui/core/testing";
import type {
  RuntimeClient,
  RuntimeEvent,
  SubmittedTurn,
} from "@natalia/contracts";
import { lineCount, makeDigest } from "@natalia/testing";
import { runTuiShell } from "../src/app/runtime";

const submissions: string[] = [];
const handle = await runTuiShell({
  backend: makeBackend(),
  closeAfterInitialTurn: false,
  rendererSize: { width: 100, height: 28 },
});
const keys = createMockKeys(handle.renderer, { kittyKeyboard: true });
await Bun.sleep(100);

await keys.typeText("hello");
keys.pressEnter();
await Bun.sleep(200);

if (submissions[0] !== "hello")
  throw new Error(`Submit failed: got ${JSON.stringify(submissions[0])}`);

await keys.typeText("a");
keys.pressKey("j", { ctrl: true });
await keys.typeText("b");
keys.pressEnter();
await Bun.sleep(200);

if (submissions[1] !== "a\nb")
  throw new Error(
    `Ctrl+J newline failed: got ${JSON.stringify(submissions[1])}`,
  );

keys.pressArrow("up");
await Bun.sleep(40);
keys.pressEnter();
await Bun.sleep(200);

if (submissions[2] !== "a\nb")
  throw new Error(
    `Empty composer history failed: got ${JSON.stringify(submissions[2])}`,
  );

const destroyed = new Promise<void>((resolve) =>
  handle.renderer.once("destroy", resolve),
);
keys.pressCtrlC();
await Promise.race([
  destroyed,
  Bun.sleep(3_000).then(() => {
    throw new Error("Ctrl+C did not destroy the idle renderer");
  }),
]);

console.log("keyboard smoke passed");

function makeBackend(): RuntimeClient {
  let sink: ((event: RuntimeEvent) => void) | undefined;
  let lastSubmission: SubmittedTurn | undefined;
  return {
    start(onEvent) {
      sink = onEvent;
      sink({
        type: "session.created",
        sessionID: "ses_keyboard_smoke" as never,
        title: "Keyboard smoke",
      });
      sink({ type: "session.ready", sessionID: "ses_keyboard_smoke" as never });
    },
    async submit(text) {
      submissions.push(text);
      const id = `turn_keyboard_${submissions.length}`;
      lastSubmission = {
        type: "turn.submitted",
        id,
        text,
        byteLength: Buffer.byteLength(text),
        lineCount: lineCount(text),
        sha256: makeDigest(text),
      };
      sink?.(lastSubmission);
      sink?.({ type: "turn.finished", id, stopReason: "done" });
      return lastSubmission;
    },
    cancel() {},
    snapshot() {
      return { type: "snapshot.created", id: "keyboard", files: [] };
    },
    diagnostic() {},
    lastSubmission: () => lastSubmission,
    respondApproval() {},
    respondQuestion() {},
  };
}
