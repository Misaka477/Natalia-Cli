import { createMockKeys } from "@opentui/core/testing";
import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import { lineCount, makeDigest } from "@natalia/testing";
import { runTuiShell } from "../src/app/runtime";

let decision: string | undefined;
const handle = await runTuiShell({
  backend: backend(),
  rendererSize: { width: 110, height: 34 },
  closeAfterInitialTurn: false,
});
const keys = createMockKeys(handle.renderer, { kittyKeyboard: true });
await Bun.sleep(80);
await keys.typeText("show approval");
keys.pressEnter();
await Bun.sleep(100);
keys.pressArrow("right");
keys.pressEnter();
await Bun.sleep(100);
if (decision !== "session")
  throw new Error(`expected session approval, got ${decision ?? "none"}`);
handle.stop();
console.log("Approval overlay smoke passed!");

function backend(): RuntimeClient {
  let sink: ((event: RuntimeEvent) => void) | undefined;
  return {
    start(onEvent) {
      sink = onEvent;
      sink({
        type: "session.created",
        sessionID: "ses_approval_overlay" as never,
        title: "Approval overlay",
      });
      sink({
        type: "session.ready",
        sessionID: "ses_approval_overlay" as never,
      });
    },
    async submit(text) {
      const event = {
        type: "turn.submitted" as const,
        id: "turn_approval_overlay",
        text,
        byteLength: Buffer.byteLength(text),
        lineCount: lineCount(text),
        sha256: makeDigest(text),
      };
      sink?.(event);
      sink?.({
        type: "approval.request",
        id: "approval_overlay",
        title: "Approve run_shell: Run command: pwd",
        preview: "pwd",
        keyArguments: ["tool=run_shell", "command=pwd"],
      });
      return event;
    },
    respondApproval(response) {
      decision = response.decision;
      sink?.({
        type: "approval.response",
        id: response.requestID,
        decision: response.decision,
      });
    },
    cancel() {},
    snapshot() {
      return { type: "snapshot.created", id: "snapshot", files: [] };
    },
    diagnostic() {},
    lastSubmission() {
      return undefined;
    },
    respondQuestion() {},
  };
}
