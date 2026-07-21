import { expect, test } from "bun:test";
import { runtimeEventDurability } from "../src";

test("runtime event durability separates deltas from durable settlements", () => {
  expect(runtimeEventDurability({ type: "content.delta", id: "turn", text: "partial" })).toBe("live");
  expect(runtimeEventDurability({ type: "tool.update", id: "turn", name: "read", status: "running", summary: "reading" })).toBe("live");
  expect(runtimeEventDurability({ type: "tool.update", id: "turn", name: "read", status: "succeeded", summary: "done" })).toBe("durable");
  expect(runtimeEventDurability({ type: "content.done", id: "turn" })).toBe("durable");
  expect(runtimeEventDurability({ type: "approval.request", id: "approval", title: "Write", preview: "file" })).toBe("durable");
});
