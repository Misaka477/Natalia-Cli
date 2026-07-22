import { createMockKeys } from "@opentui/core/testing";
import type { RuntimeClient } from "@natalia/contracts";
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
keys.pressKey("x", { ctrl: true });
await Bun.sleep(30);
keys.pressKey("n");
await Bun.sleep(150);

if (sessions.length !== 1)
  throw new Error(`expected leader new session command, got ${sessions.length}`);

handle.stop();
console.log("leader keyboard smoke passed");

function backend(): RuntimeClient {
  return {
    start(onEvent) {
      onEvent({
        type: "session.created",
        sessionID: "ses_leader_smoke" as never,
        title: "Leader smoke",
      });
      onEvent({ type: "session.ready", sessionID: "ses_leader_smoke" as never });
    },
    async submit() {
      throw new Error("leader smoke does not submit prompts");
    },
    cancel() {},
    snapshot() {
      return { type: "snapshot.created", id: "leader", files: [] };
    },
    diagnostic() {},
    lastSubmission: () => undefined,
    respondApproval() {},
    respondQuestion() {},
  };
}
