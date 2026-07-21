import { expect, test } from "bun:test";
import {
  admitInput,
  createSessionRecord,
  promoteNextQueued,
  promoteSteers,
  SessionInputConflictError,
} from "../src";

test("session inbox exact retry is idempotent and conflicting reuse is rejected", () => {
  const session = createSessionRecord("ses_inbox", "Inbox");
  const input = { id: "turn_one", text: "hello", delivery: "steer" as const };
  const first = admitInput(session, input, new Date("2026-07-21T00:00:00.000Z"));
  expect(admitInput(session, input)).toEqual(first);
  expect(() => admitInput(session, { ...input, text: "different" })).toThrow(SessionInputConflictError);
  expect(() => admitInput(session, { ...input, delivery: "queue" })).toThrow(SessionInputConflictError);
});

test("session inbox promotes all steers but one queued input at an idle boundary", () => {
  const session = createSessionRecord("ses_promote", "Promote");
  admitInput(session, { id: "steer_a", text: "a", delivery: "steer" });
  admitInput(session, { id: "queue_a", text: "b", delivery: "queue" });
  admitInput(session, { id: "steer_b", text: "c", delivery: "steer" });
  admitInput(session, { id: "queue_b", text: "d", delivery: "queue" });

  expect(promoteSteers(session).map((item) => item.id)).toEqual(["steer_a", "steer_b"]);
  expect(promoteNextQueued(session).map((item) => item.id)).toEqual(["queue_a"]);
  expect(promoteNextQueued(session).map((item) => item.id)).toEqual(["queue_b"]);
  expect(promoteNextQueued(session)).toEqual([]);
});
