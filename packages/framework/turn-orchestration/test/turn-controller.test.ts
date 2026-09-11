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

test("input mutations only touch inputs that have not been claimed", async () => {
  const session = sessionWithInbox([
    { id: "q1", text: "queued", delivery: "next-turn" },
    { id: "s1", text: "steer", delivery: "next-step" },
  ]);
  const { controller } = makeController(session);
  const sessionID = session.id as unknown as string;

  const replaced = await controller.replaceInput(sessionID, "q1", "edited");
  expect(replaced?.text).toBe("edited");
  expect(session.inbox?.find((item) => item.id === "q1")?.text).toBe("edited");

  // Promoting turns a queued turn into a step input, but it is still pending
  // until the provider claims it, so it stays editable/removable.
  const promoted = await controller.promoteInput(sessionID, "q1");
  expect(promoted?.delivery).toBe("next-step");
  expect(await controller.removeInput(sessionID, "q1")).toMatchObject({
    id: "q1",
  });

  const removed = await controller.removeInput(sessionID, "s1");
  expect(removed?.id).toBe("s1");
  expect(session.inbox?.some((item) => item.id === "s1")).toBe(false);
});

test("claimed inputs are no longer editable, removable or promotable", async () => {
  const session = sessionWithInbox([
    {
      id: "claimed",
      text: "already in",
      delivery: "next-step",
      promotedAt: new Date().toISOString(),
    },
  ]);
  const { controller } = makeController(session);
  const sessionID = session.id as unknown as string;
  expect(await controller.removeInput(sessionID, "claimed")).toBeUndefined();
  expect(
    await controller.replaceInput(sessionID, "claimed", "late"),
  ).toBeUndefined();
  expect(await controller.promoteInput(sessionID, "claimed")).toBeUndefined();
});

test("input mutations against an unknown session are refused", async () => {
  const session = sessionWithInbox([
    { id: "q1", text: "queued", delivery: "next-turn" },
  ]);
  const { controller } = makeController(session);
  expect(await controller.removeInput("ses_missing", "q1")).toBeUndefined();
  expect(
    await controller.replaceInput("ses_missing", "q1", "x"),
  ).toBeUndefined();
  expect(await controller.promoteInput("ses_missing", "q1")).toBeUndefined();
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
