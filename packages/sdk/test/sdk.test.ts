import { expect, test } from "bun:test";
import type {
  RuntimeClient,
  RuntimeEvent,
  SubmittedTurn,
} from "@natalia/contracts";
import { createRuntimeHttpServer } from "@natalia/transport";
import { createNataliaSDK } from "../src";

test("SDK uses the TS RPC transport rather than runtime internals", async () => {
  let sink: ((event: RuntimeEvent) => void) | undefined;
  const approvalResponses: unknown[] = [];
  const questionResponses: unknown[] = [];
  const prompts: string[] = [];
  const client: RuntimeClient = {
    start(handler) {
      sink = handler;
    },
    async submit(text) {
      prompts.push(text);
      const event = {
        type: "turn.submitted",
        id: "turn_sdk",
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "sdk",
      } satisfies SubmittedTurn;
      sink?.(event);
      return event;
    },
    cancel() {},
    pause() {},
    resume() {},
    snapshot: () => ({ type: "snapshot.created", id: "snap_sdk", files: [] }),
    diagnostic() {},
    lastSubmission: () => undefined,
    respondApproval(response) {
      approvalResponses.push(response);
    },
    respondQuestion(response) {
      questionResponses.push(response);
    },
  };
  const server = createRuntimeHttpServer({ client, token: "sdk-token" });
  const sdk = createNataliaSDK({ baseURL: server.url, token: "sdk-token" });
  expect(await sdk.health()).toEqual({ ok: true });
  expect(await sdk.prompt("sdk prompt")).toMatchObject({
    id: "turn_sdk",
    text: "sdk prompt",
  });
  expect(await sdk.snapshot()).toMatchObject({ id: "snap_sdk" });
  await sdk.pause("sdk pause");
  await sdk.resume();
  await sdk.respondApproval({ requestID: "approval_1", decision: "once" });
  await sdk.respondQuestion({ requestID: "question_1", answers: [["yes"]] });
  await sdk.checkpoint();
  await sdk.checkpoints(2);
  await sdk.rollback("checkpoint_1", { dryRun: true });
  expect(approvalResponses).toContainEqual({
    requestID: "approval_1",
    decision: "once",
  });
  expect(questionResponses).toContainEqual({
    requestID: "question_1",
    answers: [["yes"]],
    rejected: false,
  });
  expect(prompts).toEqual(
    expect.arrayContaining([
      "/checkpoint",
      "/checkpoints --limit 2",
      "/rollback checkpoint_1 --dry-run",
    ]),
  );
  const events = sdk.events({ since: 4 });
  await sdk.prompt("event prompt");
  const first = await events[Symbol.asyncIterator]().next();
  expect(first.value).toMatchObject({
    type: "turn.submitted",
    text: "event prompt",
  });
  server.stop(true);
});
