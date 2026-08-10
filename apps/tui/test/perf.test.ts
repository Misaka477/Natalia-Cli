import { expect, test } from "bun:test";
import { EditorBuffer } from "../src/prompt/editor";
import { initialState, reduceState } from "../src/context/state";
import { chinese10000, paste100KiB, paste1MiB } from "@natalia/testing";

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

test("stream projection stays within a frame budget for a long response", () => {
  let state = structuredClone(initialState);
  state = reduceState(state, {
    type: "turn.submitted",
    id: "turn_perf_stream",
    text: "stream test",
    byteLength: 11,
    lineCount: 1,
    sha256: "test",
  });
  const samples = Array.from({ length: 120 }, (_, index) => {
    const start = performance.now();
    state = reduceState(state, {
      type: "content.delta",
      id: "turn_perf_stream",
      text: `token ${index}\n`,
    });
    return performance.now() - start;
  });
  expect(p95(samples)).toBeLessThan(16);
});

test("deriving the transcript stays within a frame budget for a long session", () => {
  // The transcript is reconciled from the shared projection on every event, which
  // is work proportional to its length, and tool rows are the expensive part to
  // derive. A long session with many tool calls is therefore the case that has to
  // stay inside a frame — the derived tool views are cached on the projected fact
  // they came from precisely so that it does.
  let state = structuredClone(initialState);
  for (let turn = 0; turn < 40; turn++) {
    state = reduceState(state, {
      type: "turn.submitted",
      id: `turn_${turn}`,
      text: `question ${turn}`,
      byteLength: 12,
      lineCount: 1,
      sha256: "test",
    });
    state = reduceState(state, {
      type: "tool.update",
      id: `turn_${turn}:call_${turn}`,
      name: "read_file",
      callID: `call_${turn}`,
      status: "succeeded",
      summary: `read ${turn} lines`,
      argumentsDelta: JSON.stringify({ path: `src/file_${turn}.ts`, limit: 5 }),
      result: Array.from({ length: 30 }, (_, line) => `line ${line}`).join(
        "\n",
      ),
      startedAt: 1000,
      endedAt: 2500,
    });
    state = reduceState(state, {
      type: "content.done",
      id: `turn_${turn}`,
      text: `answer ${turn}\n\n`,
    });
    state = reduceState(state, {
      type: "turn.finished",
      id: `turn_${turn}`,
      stopReason: "done",
    });
  }
  expect(state.messages.length).toBeGreaterThan(100);
  expect(state.messages.filter((block) => block.tool)).toHaveLength(40);

  state = reduceState(state, {
    type: "turn.submitted",
    id: "turn_live",
    text: "one more",
    byteLength: 8,
    lineCount: 1,
    sha256: "test",
  });
  const samples = Array.from({ length: 120 }, (_, index) => {
    const start = performance.now();
    state = reduceState(state, {
      type: "content.delta",
      id: "turn_live",
      text: `token ${index}\n`,
    });
    return performance.now() - start;
  });
  expect(p95(samples)).toBeLessThan(16);
});
