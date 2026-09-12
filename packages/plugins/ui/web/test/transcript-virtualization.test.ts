import { expect, test } from "bun:test";
import { Virtualizer } from "@tanstack/solid-virtual";

function virtualizerFor(initialOffset = 0) {
  const rowHeight = 64;
  const viewportHeight = 600;
  return new Virtualizer<Element, Element>({
    count: 1_000,
    getScrollElement: () => null,
    estimateSize: () => rowHeight,
    overscan: 8,
    initialRect: { width: 800, height: viewportHeight },
    initialOffset,
    observeElementRect: (_instance, callback) => {
      callback({ width: 800, height: viewportHeight });
      return () => {};
    },
    observeElementOffset: (_instance, callback) => {
      callback(initialOffset, false);
      return () => {};
    },
    scrollToFn: () => {},
  });
}

test("transcript virtualization bounds mounted rows for 1000 messages", () => {
  const virtualizer = virtualizerFor();
  expect(virtualizer.getTotalSize()).toBe(64_000);
  const mounted = virtualizer.getVirtualItems();
  expect(mounted[0]?.index).toBe(0);
  expect(mounted.length).toBeLessThan(40);
  expect(mounted.at(-1)?.end).toBeLessThanOrEqual((64_000 / 64) * 64);
});

test("transcript virtualization moves the mounted window with scroll", () => {
  const rowHeight = 64;
  const virtualizer = virtualizerFor(20 * rowHeight);
  const mounted = virtualizer.getVirtualItems();
  expect(mounted[0]?.index).toBeGreaterThan(0);
  expect(mounted[0]?.index).toBeLessThanOrEqual(20);
  expect(mounted.at(-1)?.index).toBeGreaterThan(20);
  expect(mounted.length).toBeLessThan(40);
});
