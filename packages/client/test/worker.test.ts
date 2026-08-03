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

test("a failing notification is reported instead of crashing the host", async () => {
  const channel = new MessageChannel();
  let sink: ((event: RuntimeEvent) => void) | undefined;
  const host: RuntimeClient = {
    start(handler) {
      sink = handler;
    },
    async submit(text) {
      return {
        type: "turn.submitted",
        id: "turn_reject",
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "test",
      } satisfies SubmittedTurn;
    },
    // The real failure this reproduces is a teardown error surfacing through a
    // notification, which used to become an unhandled rejection.
    cancel() {
      throw new Error("kill() failed: ESRCH: No such process");
    },
    snapshot: () => ({
      type: "snapshot.created",
      id: "snapshot_reject",
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

  const rejections: unknown[] = [];
  const onRejection = (reason: unknown) => rejections.push(reason);
  process.on("unhandledRejection", onRejection);
  try {
    client.cancel("stop");
    await Bun.sleep(50);
  } finally {
    process.off("unhandledRejection", onRejection);
  }

  expect(rejections).toEqual([]);
  expect(
    events.filter(
      (event) =>
        event.type === "diagnostic" && event.message.includes("cancel failed"),
    ).length,
  ).toBeGreaterThan(0);
});
