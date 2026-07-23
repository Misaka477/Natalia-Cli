import { expect, test } from "bun:test";
import {
  TimelineVirtualizer,
  groupTimelineBlocks,
} from "../src/routes/session/timeline-virtualizer";

test("timeline virtualizer groups a complete turn and ranges measured rows", () => {
  const groups = groupTimelineBlocks([
    { id: "turn_1", role: "user" },
    { id: "turn_1:thinking", role: "thinking" },
    { id: "turn_1:tool:read", role: "tool" },
    { id: "turn_2", role: "user" },
    { id: "turn_2:assistant", role: "assistant" },
  ]);
  expect(groups.map((group) => group.items.length)).toEqual([3, 2]);

  const virtualizer = new TimelineVirtualizer(4);
  virtualizer.replace(groups, 0, 4);
  virtualizer.measure("turn:turn_1", 12, 0, 4);
  const range = virtualizer.range(12, 4);
  expect(range.items.map((group) => group.key)).toContain("turn:turn_2");
  expect(range.total).toBe(16);
});

test("timeline virtualizer preserves the visible anchor when prepending history", () => {
  const virtualizer = new TimelineVirtualizer(5);
  virtualizer.replace(
    [
      { key: "turn:two", items: ["two"] },
      { key: "turn:three", items: ["three"] },
    ],
    5,
    5,
  );
  const result = virtualizer.replace(
    [
      { key: "turn:one", items: ["one"] },
      { key: "turn:two", items: ["two"] },
      { key: "turn:three", items: ["three"] },
    ],
    5,
    5,
  );
  expect(result.adjustment).toBe(5);
});

test("timeline virtualizer pins the active group and corrects pre-viewport measurements", () => {
  const virtualizer = new TimelineVirtualizer(4);
  virtualizer.replace(
    Array.from({ length: 12 }, (_, index) => ({
      key: `turn:${index}`,
      items: [index],
    })),
    20,
    4,
  );
  const measured = virtualizer.measure("turn:1", 10, 20, 4);
  expect(measured.adjustment).toBe(6);
  const range = virtualizer.range(26, 4, ["turn:11"]);
  expect(range.items.map((group) => group.key)).toContain("turn:11");
});

test("timeline virtualizer keeps a bounded measured range across a large projected history", () => {
  const virtualizer = new TimelineVirtualizer(3);
  const history = Array.from({ length: 2_000 }, (_, index) => ({
    key: `turn:${index}`,
    // Each turn stays atomic even when it contains a live reasoning/tool row.
    items: [`user:${index}`, `assistant:${index}`, `tool:${index}`],
  }));
  virtualizer.replace(history, 3_000, 20);
  virtualizer.measure("turn:10", 11, 3_000, 20);
  virtualizer.measure("turn:1_000", 8, 3_008, 20);

  const range = virtualizer.range(3_008, 20, ["turn:1999"]);
  expect(range.total).toBeGreaterThan(6_000);
  expect(range.items.length).toBeLessThan(40);
  expect(range.items.map((group) => group.key)).toContain("turn:1999");
  expect(range.items.flatMap((group) => group.items)).toContain("tool:1000");

  const prepended = virtualizer.replace(
    [{ key: "turn:older", items: ["older"] }, ...history],
    3_008,
    20,
  );
  expect(prepended.adjustment).toBe(3);
});
