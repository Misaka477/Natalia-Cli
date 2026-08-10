import { expect, test } from "bun:test";
import {
  boundHistoryCache,
  historyCacheLimit,
  historyCacheWatermark,
} from "../src/history-page-cache";
import type { MessageBlock } from "../src/context/state";

function turn(id: number): MessageBlock[] {
  return [
    { id: `turn_${id}:user`, role: "user", text: `user ${id}`, owner: "ui" },
    {
      id: `turn_${id}:assistant`,
      role: "assistant",
      text: `assistant ${id}`,
      owner: "ui",
    },
  ];
}

test("history cache evicts newest complete turns after older prepend", () => {
  const messages = Array.from(
    { length: historyCacheLimit / 2 + 20 },
    (_, index) => turn(index),
  ).flat();
  const result = boundHistoryCache(messages, "older");
  expect(result.evicted).toBe(true);
  expect(result.messages.length).toBeLessThanOrEqual(historyCacheWatermark);
  expect(result.messages.at(-1)?.role).toBe("assistant");
  expect(result.messages[0]?.id).toBe("turn_0:user");
});

test("history cache evicts oldest complete turns after newer reload", () => {
  const messages = Array.from(
    { length: historyCacheLimit / 2 + 20 },
    (_, index) => turn(index),
  ).flat();
  const result = boundHistoryCache(messages, "newer");
  expect(result.evicted).toBe(true);
  expect(result.messages.length).toBeLessThanOrEqual(historyCacheWatermark);
  expect(result.messages[0]?.role).toBe("user");
  expect(result.messages.at(-1)?.id).toBe(
    `turn_${historyCacheLimit / 2 + 19}:assistant`,
  );
});

test("history cache leaves a bounded turn sequence unchanged", () => {
  const messages = [...turn(1), ...turn(2)];
  expect(boundHistoryCache(messages, "older")).toEqual({
    messages,
    evicted: false,
  });
});
