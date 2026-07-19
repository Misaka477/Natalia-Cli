import { expect, test } from "bun:test";
import type {
  RuntimeClient,
  RuntimeEvent,
  SubmittedTurn,
} from "@natalia/contracts";
import {
  attachRuntimeClientWorker,
  createWorkerRuntimeClient,
} from "../src/worker";

test("worker RuntimeClient transport remains behind contracts boundary", async () => {
  const channel = new MessageChannel();
  let sink: ((event: RuntimeEvent) => void) | undefined;
  const host: RuntimeClient = {
    start(handler) {
      sink = handler;
    },
    async submit(text) {
      const event: SubmittedTurn = {
        type: "turn.submitted",
        id: "turn_worker",
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "test",
      };
      sink?.(event);
      return event;
    },
    cancel() {},
    snapshot: () => ({
      type: "snapshot.created",
      id: "snapshot_worker",
      files: [],
    }),
    diagnostic() {},
    lastSubmission: () => undefined,
    respondApproval() {},
    respondQuestion() {},
  };
  attachRuntimeClientWorker(channel.port1, host);
  const client = createWorkerRuntimeClient(channel.port2);
  const events: RuntimeEvent[] = [];
  client.start((event) => events.push(event));
  await expect(client.submit("worker prompt")).resolves.toMatchObject({
    text: "worker prompt",
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(events).toContainEqual(
    expect.objectContaining({ type: "turn.submitted", text: "worker prompt" }),
  );
});
