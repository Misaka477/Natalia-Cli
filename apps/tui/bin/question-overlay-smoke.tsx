import { createMockKeys } from "@opentui/core/testing";
import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import { lineCount, makeDigest } from "@natalia/testing";
import { runTuiShell } from "../src/app/runtime";

let received: string[][] | undefined;
const handle = await runTuiShell({
  backend: backend(),
  rendererSize: { width: 110, height: 34 },
  closeAfterInitialTurn: false,
});
const keys = createMockKeys(handle.renderer, { kittyKeyboard: true });

try {
  await Bun.sleep(80);
  await keys.typeText("show question");
  keys.pressEnter();
  await Bun.sleep(100);
  keys.pressEnter(); // first answer: A
  keys.pressEnter(); // second question: A
  keys.pressArrow("down");
  keys.pressEnter(); // second question: B
  keys.pressArrow("right");
  keys.pressEnter(); // confirm
  await Bun.sleep(100);
  if (JSON.stringify(received) !== JSON.stringify([["A"], ["A", "B"]]))
    throw new Error(
      `unexpected question response: ${JSON.stringify(received)}`,
    );
  console.log("Question overlay multi-answer smoke passed!");
} finally {
  handle.stop();
}

function backend(): RuntimeClient {
  let sink: ((event: RuntimeEvent) => void) | undefined;
  return {
    start(onEvent) {
      sink = onEvent;
      sink({
        type: "session.created",
        sessionID: "ses_question_overlay" as never,
        title: "Question overlay",
      });
      sink({
        type: "session.ready",
        sessionID: "ses_question_overlay" as never,
      });
    },
    async submit(text) {
      const event = {
        type: "turn.submitted" as const,
        id: "turn_question_overlay",
        text,
        byteLength: Buffer.byteLength(text),
        lineCount: lineCount(text),
        sha256: makeDigest(text),
      };
      sink?.(event);
      sink?.({
        type: "question.request",
        id: "turn_question_overlay:question",
        title: "Choose options",
        questions: [
          {
            id: "first",
            header: "First",
            question: "Pick one",
            options: [{ label: "A" }, { label: "B" }],
            custom: false,
          },
          {
            id: "second",
            header: "Second",
            question: "Pick all",
            options: [{ label: "A" }, { label: "B" }],
            multiple: true,
            custom: false,
          },
        ],
      });
      return event;
    },
    respondQuestion(response) {
      received = response.answers;
      sink?.({
        type: "question.response",
        id: response.requestID,
        answers: response.answers,
        rejected: response.rejected,
      });
    },
    respondApproval() {},
    cancel() {},
    snapshot() {
      return { type: "snapshot.created", id: "snapshot", files: [] };
    },
    diagnostic() {},
    lastSubmission() {
      return undefined;
    },
  };
}
