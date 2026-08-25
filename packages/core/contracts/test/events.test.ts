import { expect, test } from "bun:test";
import {
  runtimeEventDurability,
  type CollaborationMessage,
  type RuntimeEvent,
} from "../src";

test("runtime event durability separates deltas from durable settlements", () => {
  expect(
    runtimeEventDurability({
      type: "content.delta",
      id: "turn",
      text: "partial",
    }),
  ).toBe("live");
  expect(
    runtimeEventDurability({
      type: "tool.update",
      id: "turn",
      name: "read",
      status: "running",
      summary: "reading",
    }),
  ).toBe("live");
  expect(
    runtimeEventDurability({
      type: "tool.update",
      id: "turn",
      name: "read",
      status: "succeeded",
      summary: "done",
    }),
  ).toBe("durable");
  expect(runtimeEventDurability({ type: "content.done", id: "turn" })).toBe(
    "durable",
  );
  expect(
    runtimeEventDurability({
      type: "approval.request",
      id: "approval",
      title: "Write",
      preview: "file",
    }),
  ).toBe("durable");
  expect(
    runtimeEventDurability({
      type: "chat.turn.started",
      id: "chat:started",
      messageID: "chat:m1",
      startedAt: 1,
    }),
  ).toBe("live");
});

test("collab.message carries the strict collaboration union", () => {
  const messages: CollaborationMessage[] = [
    {
      id: "chat:1",
      threadID: "chat:1",
      kind: "chat",
      from: "main_agent",
      to: "live_chat",
      text: "hello",
      round: 1,
      expectsReply: true,
      at: "t0",
    },
    {
      id: "suggestion:1",
      threadID: "suggestion:1",
      kind: "suggestion",
      from: "live_chat",
      to: "main_agent",
      text: "use the service",
      priority: "high",
      expectsReply: true,
      at: "t0",
    },
    {
      id: "notice:1",
      threadID: "notice:1",
      kind: "notice",
      from: "main_agent",
      to: "live_chat",
      text: "blocked",
      noticeType: "blocked",
      expectsReply: false,
      at: "t0",
    },
    {
      id: "question:1",
      threadID: "question:1",
      kind: "question",
      from: "main_agent",
      to: "live_chat",
      text: "safe?",
      expectsReply: true,
      at: "t0",
    },
    {
      id: "answer:1",
      threadID: "question:1",
      replyToID: "question:1",
      kind: "answer",
      from: "live_chat",
      to: "main_agent",
      text: "yes",
      expectsReply: false,
      at: "t1",
    },
    {
      id: "response:1",
      threadID: "suggestion:1",
      replyToID: "suggestion:1",
      kind: "response",
      from: "main_agent",
      to: "live_chat",
      text: "adopted",
      decision: "adopted",
      expectsReply: false,
      at: "t1",
    },
  ];
  const events: RuntimeEvent[] = messages.map((message) => ({
    type: "collab.message",
    message,
  }));
  expect(events.map((event) => event.type)).toEqual(
    Array.from({ length: 6 }, () => "collab.message"),
  );
});
