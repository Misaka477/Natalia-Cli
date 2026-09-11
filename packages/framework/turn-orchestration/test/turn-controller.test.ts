import { expect, test } from "bun:test";
import type { SessionRecord } from "@natalia/session";
import { createTurnController } from "../src";

function sessionWithInbox(
  inbox: Array<{
    id: string;
    text: string;
    delivery: "next-turn" | "next-step";
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
    sessionFor: (sessionID) =>
      sessionID === (session.id as unknown as string) ? session : undefined,
    activeAbortFor: () => undefined,
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
    { id: "s1", text: "first", delivery: "next-step" },
    { id: "q1", text: "queued", delivery: "next-turn" },
    { id: "s2", text: "second", delivery: "next-step" },
  ]);
  const { controller, turns } = makeController(session);
  await controller.drain(
    new AbortController().signal,
    session.id as unknown as string,
  );
  expect(turns).toEqual(["s1", "s2", "q1"]);
});

test("one drain promotes every queued input in FIFO order", async () => {
  const session = sessionWithInbox([
    { id: "q1", text: "first", delivery: "next-turn" },
    { id: "q2", text: "second", delivery: "next-turn" },
    { id: "q3", text: "third", delivery: "next-turn" },
  ]);
  const { controller, turns } = makeController(session);
  await controller.drain(
    new AbortController().signal,
    session.id as unknown as string,
  );
  expect(turns).toEqual(["q1", "q2", "q3"]);
});

test("commands short-circuit turns and flush persistence", async () => {
  const session = sessionWithInbox([
    { id: "c1", text: "/help", delivery: "next-step" },
    { id: "s1", text: "real", delivery: "next-step" },
  ]);
  const { controller, turns, commands, persisted } = makeController(session);
  await controller.drain(
    new AbortController().signal,
    session.id as unknown as string,
  );
  expect(commands).toEqual(["c1"]);
  expect(turns).toEqual(["s1"]);
  expect(persisted.length).toBeGreaterThan(0);
});

test("an aborted drain stops admitting further inputs", async () => {
  const session = sessionWithInbox([
    { id: "s1", text: "first", delivery: "next-step" },
    { id: "s2", text: "second", delivery: "next-step" },
    { id: "s3", text: "third", delivery: "next-step" },
  ]);
  const turns: string[] = [];
  const controller = createTurnController({
    session: () => session,
    activeAbort: () => undefined,
    sessionFor: (sessionID) =>
      sessionID === (session.id as unknown as string) ? session : undefined,
    activeAbortFor: () => undefined,
    persist: async () => undefined,
    saveInbox: async () => undefined,
    flush: async () => undefined,
    runCommand: async () => false,
    runTurn: async () => {
      turns.push("ran");
      throw new Error("turn aborted");
    },
  });
  await expect(
    controller.drain(
      new AbortController().signal,
      session.id as unknown as string,
    ),
  ).rejects.toThrow("turn aborted");
  expect(turns).toEqual(["ran"]);
});

test("disposed turn orchestration refuses new work", async () => {
  const session = sessionWithInbox([
    { id: "s1", text: "first", delivery: "next-step" },
  ]);
  const { controller } = makeController(session);
  controller.dispose();
  await expect(
    controller.drain(
      new AbortController().signal,
      session.id as unknown as string,
    ),
  ).rejects.toThrow("turn orchestration controller disposed");
  await expect(
    controller.admit(session.id as unknown as string, "s2", "second"),
  ).rejects.toThrow("turn orchestration controller disposed");
});
