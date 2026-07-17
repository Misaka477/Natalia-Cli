import { expect, test } from "bun:test";
import { EventBatcher, ProjectionCache, shouldLazyRenderDetail } from "../src";

test("projection cache reuses long markdown and tool projections", () => {
  const cache = new ProjectionCache();
  const text = "# title\n\n" + "内容🙂e\u0301\n".repeat(2000);
  const first = cache.markdownSegment("m", 1, text);
  const second = cache.markdownSegment("m", 1, text);
  expect(second).toBe(first);
  expect(cache.stats.markdownHits).toBe(1);

  const tool = cache.toolResult("tool", 1, "line\n".repeat(100));
  expect(cache.toolResult("tool", 1, "line\n".repeat(100))).toBe(tool);
  expect(cache.stats.toolHits).toBe(1);
  expect(shouldLazyRenderDetail("x".repeat(5000))).toBe(true);
});

test("event batcher throttles background projection while modal is active", () => {
  const batcher = new EventBatcher<string>();
  batcher.push("a");
  expect(batcher.shouldFlush({ now: 0, modalActive: true })).toBe(true);
  batcher.flush(0);
  batcher.push("b");
  expect(batcher.shouldFlush({ now: 50, modalActive: true })).toBe(false);
  expect(batcher.shouldFlush({ now: 120, modalActive: true })).toBe(true);
});
