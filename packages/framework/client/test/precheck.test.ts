import { expect, test } from "bun:test";
import {
  createPrecheckMachine,
  readPrecheck,
  summarizeOutput,
  type PrecheckResult,
} from "../src/runtime/precheck";

/**
 * The deterministic pre-execution's state machine (the spec study's
 * §2.2 without the predictor): edit→verify is a RULE, and the rule's
 * only risk is staleness — which the machine makes impossible by
 * construction. A killed mid-run check leaves nothing durable behind.
 */

const result = (exitCode = 0, command = "typecheck"): PrecheckResult => ({
  command,
  exitCode,
  summary: "ok",
  finishedAt: 100,
  durationMs: 20,
});

test("idle → running → fresh, and the read answers the run's identity", () => {
  const machine = createPrecheckMachine();
  expect(readPrecheck(machine)).toEqual({ fresh: false, reason: "never_run" });
  expect(machine.begin(0)).toBe(true);
  expect(readPrecheck(machine)).toEqual({ fresh: false, reason: "running" });
  // One at a time: a second begin is refused, not queued.
  expect(machine.begin(1)).toBe(false);
  machine.complete(result(), 30);
  const read = readPrecheck(machine);
  expect(read).toMatchObject({
    fresh: true,
    result: { exitCode: 0, command: "typecheck" },
  });
});

test("a write while running discards the run's result (staleness is impossible)", () => {
  const machine = createPrecheckMachine();
  machine.begin(0);
  machine.noteWrite(); // the edit lands mid-check
  machine.complete(result(0), 30); // the check that no longer matters
  expect(readPrecheck(machine)).toEqual({
    fresh: false,
    reason: "invalidated",
  });
});

test("a write while fresh invalidates; a write while idle becomes stale-not-idle", () => {
  const machine = createPrecheckMachine();
  machine.begin(0);
  machine.complete(result(), 10);
  expect(readPrecheck(machine).fresh).toBe(true);
  machine.noteWrite();
  expect(readPrecheck(machine)).toEqual({
    fresh: false,
    reason: "invalidated",
  });
  // From stale, a new run is allowed and its result is fresh again.
  expect(machine.begin(20)).toBe(true);
  machine.complete(result(1, "typecheck"), 40);
  expect(readPrecheck(machine)).toMatchObject({
    fresh: true,
    result: { exitCode: 1 },
  });
});

test("the invalidations are counted, not hidden (the wasted work's measure)", () => {
  const machine = createPrecheckMachine();
  machine.begin(0);
  machine.noteWrite();
  machine.noteWrite();
  expect(machine.state()).toMatchObject({ kind: "running", invalidations: 2 });
  machine.complete(result(), 10);
  expect(machine.state()).toMatchObject({ kind: "stale", invalidations: 2 });
});

test("the output's summary is bounded and never the body", () => {
  expect(summarizeOutput("one\ntwo")).toBe("one\ntwo");
  const big = summarizeOutput(
    Array.from({ length: 100 }, (_, i) => `line ${i}`).join("\n"),
  );
  expect(big).toContain("line 0");
  expect(big).toContain("… (88 more lines)");
  expect(big).toContain("line 99");
  expect(big.split("\n").length).toBeLessThanOrEqual(14);
});
