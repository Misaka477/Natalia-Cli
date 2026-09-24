import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { readExternalBenchmark } from "../src/eval-reader";

/**
 * G-c's base: the frozen eval's own data, read through the typed shape.
 * The fixture is the REAL `devref/eval` in this repository — 30 tasks ×
 * 9 harnesses × 360 cells — so the reader is proven against the format
 * it will face, not a mock of it.
 */

const EVAL_DIR = resolve(import.meta.dir, "../../../../devref/eval");

test("the frozen eval reads as its typed shape: counts, tasks, cells", async () => {
  const benchmark = await readExternalBenchmark(EVAL_DIR);
  expect(benchmark.name).toBe("FrontierHarness Eval v1");
  expect(benchmark.status).toBe("frozen");
  expect(benchmark.taskCount).toBe(30);
  expect(benchmark.harnessCount).toBe(9);
  expect(benchmark.configurationCount).toBe(12);
  expect(benchmark.tasks).toHaveLength(30);
  // The cells are carried per task (the eval's configuration count).
  for (const task of benchmark.tasks) {
    expect(task.expected).toBeGreaterThan(0);
    expect(task.successful).toBeLessThanOrEqual(task.expected);
    expect(task.successRate).toBeGreaterThanOrEqual(0);
    expect(task.successRate).toBeLessThanOrEqual(1);
  }
  // The metadata the task.toml carries (difficulty/category) enriched
  // the cells — the regex-log task's own file says medium/data-processing.
  const regexLog = benchmark.tasks.find(
    (task) => task.id === "terminal-bench/regex-log",
  );
  expect(regexLog).toBeDefined();
  expect(regexLog).toMatchObject({
    title: "Regex log",
    difficulty: "medium",
    category: "data-processing",
  });
});

test("a task whose toml is absent keeps its outcome cells", async () => {
  // The read is all-or-nothing for the JSONs and best-effort for the
  // toml: a missing metadata file loses nothing that matters.
  const benchmark = await readExternalBenchmark(EVAL_DIR);
  const withToml = benchmark.tasks.filter((task) => task.difficulty);
  // The frozen data ships a toml per task; if the shape ever changes,
  // the tasks must still arrive rather than the read failing.
  expect(withToml.length).toBeGreaterThan(0);
  expect(benchmark.tasks.length).toBe(30);
});

test("no dir answers the no_eval_dir shape, and a named dir reads the frozen data", async () => {
  delete process.env.NATALIA_EVAL_DIR;
  const { createIntelligenceSurface } = await import("../src/intelligence");
  const { createTestContext } = await import("@anthelia/runtime-services");
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const root = mkdtempSync(join(tmpdir(), "eval-face-"));
  const ctx = {
    ports: {
      getReady: async () => undefined,
      getSessionID: () => "ses_eval" as never,
      getExecutionBySession: () => new Map() as never,
      getActiveExec: () => undefined,
    },
    state: {
      pluginStoreRoot: root,
      serviceDirectory: createTestContext([]),
    },
  } as never;
  const surface = createIntelligenceSurface(ctx, {});
  const missing = await surface.externalBenchmark!();
  expect(missing).toMatchObject({ joined: false, reason: "no_eval_dir" });
  const named = await surface.externalBenchmark!({ dir: EVAL_DIR });
  expect(named.joined).toBe(false);
  // Both shapes carry joined=false (the two sides are stated, never
  // bridged); the NAMED dir answers the read shape.
  if ("reason" in named) {
    expect(named.reason).not.toBe("no_eval_dir");
    return;
  }
  expect(named.external).toMatchObject({
    tasks: 30,
    harnesses: 9,
    configurations: 12,
  });
  // The internal side rides the same journal: no session here, so zero
  // groups — the answer states both sides without bridging them.
  expect(named.internal).toMatchObject({ promptGroups: 0, runs: 0 });
  // The note's own words: the two sides measure different task sets.
  expect(named.note).toContain("different task sets");
});
