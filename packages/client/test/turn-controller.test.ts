import { expect, test } from "bun:test";
import type { SessionRecord } from "@natalia/session";
import { createTurnController } from "../src/turn-controller";

function sessionWithInbox(
  inbox: Array<{
    id: string;
    text: string;
    delivery: "steer" | "queue";
    promotedAt?: string;
  }>,
): SessionRecord {
  return {
    id: "ses_turn" as never,
    title: "t",
    createdAt: new Date().toISOString(),
    events: [],
    inbox,
  } as unknown as SessionRecord;
}

function makeController(session: SessionRecord) {
  const turns: string[] = [];
  const commands: string[] = [];
  const persisted: number[] = [];
  const controller = createTurnController({
    session: () => session,
    activeAbort: () => undefined,
    persist: async (fn) => {
      await fn();
      persisted.push(persisted.length);
    },
    saveInbox: async () => undefined,
    flush: async () => undefined,
    runCommand: async (id, text) => {
      if (text.startsWith("/")) {
        commands.push(id);
        return true;
      }
      return false;
    },
    runTurn: async (input) => {
      turns.push(input.id);
    },
  });
  return { controller, turns, commands, persisted };
}

test("steer inputs drain in admission order, queued only after steers", async () => {
  const session = sessionWithInbox([
    { id: "s1", text: "first", delivery: "steer" },
    { id: "q1", text: "queued", delivery: "queue" },
    { id: "s2", text: "second", delivery: "steer" },
  ]);
  const { controller, turns } = makeController(session);
  await controller.drain(new AbortController().signal);
  expect(turns).toEqual(["s1", "s2", "q1"]);
});

test("commands short-circuit turns and flush persistence", async () => {
  const session = sessionWithInbox([
    { id: "c1", text: "/help", delivery: "steer" },
    { id: "s1", text: "real", delivery: "steer" },
  ]);
  const { controller, turns, commands, persisted } = makeController(session);
  await controller.drain(new AbortController().signal);
  expect(commands).toEqual(["c1"]);
  expect(turns).toEqual(["s1"]);
  expect(persisted.length).toBeGreaterThan(0);
});

test("an aborted drain stops admitting further inputs", async () => {
  const session = sessionWithInbox([
    { id: "s1", text: "first", delivery: "steer" },
    { id: "s2", text: "second", delivery: "steer" },
    { id: "s3", text: "third", delivery: "steer" },
  ]);
  const { controller, turns } = makeController(session);
  const controller2 = createTurnController({
    session: () => session,
    activeAbort: () => undefined,
    persist: async () => undefined,
    saveInbox: async () => undefined,
    flush: async () => undefined,
    runCommand: async () => false,
    runTurn: async () => {
      turns.push("ran");
      throw new Error("turn aborted");
    },
  });
  await expect(controller2.drain(new AbortController().signal)).rejects.toThrow(
    "turn aborted",
  );
  // Only the first input ran; the loop stops at the first failure.
  expect(turns).toEqual(["ran"]);
});
