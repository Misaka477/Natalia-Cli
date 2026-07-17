import { expect, test } from "bun:test";
import { EditorBuffer } from "../src/prompt/editor";
import { chinese10000, paste100KiB, paste1MiB } from "../src/testing/data";

function p95(samples: number[]) {
  return (
    samples.toSorted((left, right) => left - right)[
      Math.floor(samples.length * 0.95)
    ] ?? 0
  );
}

test("M0 editor operations stay within local performance budget", () => {
  const chinese = new EditorBuffer();
  chinese.setValue(chinese10000());
  const editSamples = Array.from({ length: 120 }, () => {
    const start = performance.now();
    chinese.left();
    chinese.right();
    return performance.now() - start;
  });
  expect(p95(editSamples)).toBeLessThan(16);

  const paste = new EditorBuffer();
  paste.setValue(paste100KiB());
  const moveSamples = Array.from({ length: 120 }, () => {
    const start = performance.now();
    paste.left();
    paste.right();
    return performance.now() - start;
  });
  expect(p95(moveSamples)).toBeLessThan(33);

  const oneMiB = new EditorBuffer();
  const start = performance.now();
  oneMiB.setValue(paste1MiB());
  expect(performance.now() - start).toBeLessThan(1000);
});
