import { expect, test } from "bun:test";
import type { RuntimeEvent } from "@natalia/contracts";
import {
  createRuntimeDiagnostics,
  type DiagnosticsReporter,
  type Invariant,
  type InvariantCheckInput,
} from "../src/index";

/**
 * An in-memory reporter double: the layer's DiagnosticsReporter is a
 * two-method seam by design (decoupling from the log package keeps the
 * composite graph acyclic), so the test doubles THAT — and asserting on
 * lines is stricter than asserting on files.
 */
function reporter(): { log: DiagnosticsReporter; lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    log: {
      component: (name) => ({
        error: (message, fields) =>
          lines.push(
            JSON.stringify({
              component: name,
              level: "error",
              message,
              fields,
            }),
          ),
        info: (message, fields) =>
          lines.push(
            JSON.stringify({ component: name, level: "info", message, fields }),
          ),
      }),
    },
  };
}

const always: Invariant = {
  id: "test.always",
  statement: "trips every time",
  check: () => [{ code: "test.trip", detail: "tripped" }],
};

const crasher: Invariant = {
  id: "test.crasher",
  statement: "throws instead of checking",
  check: () => {
    throw new Error("checker blew up");
  },
};

const input: InvariantCheckInput = {
  sessions: [
    {
      sessionID: "ses_a",
      events: [] as RuntimeEvent[],
      factStateComplete: true,
    },
  ],
};

test("a violating invariant becomes an attributed finding in the report", () => {
  const out = reporter();
  const diagnostics = createRuntimeDiagnostics({
    sets: [{ owner: "test-domain", invariants: [always] }],
    log: out.log,
  });
  const findings = diagnostics.tick(input);
  expect(findings).toHaveLength(1);
  expect(findings[0]).toMatchObject({
    owner: "test-domain",
    invariant: "test.always",
    code: "test.trip",
  });
  expect(diagnostics.state()).toMatchObject({ ticks: 1, findings: 1 });
  expect(diagnostics.state().byInvariant["test-domain"]).toEqual({
    "test.always": 1,
  });
  const line = out.lines.find((entry) => entry.includes("test.trip"));
  expect(line).toBeDefined();
  expect(line).toContain('"component":"invariants"');
  expect(line).toContain('"owner":"test-domain"');
});

test("the global switch silences checks without undeploying them", () => {
  const out = reporter();
  const diagnostics = createRuntimeDiagnostics({
    sets: [{ owner: "test-domain", invariants: [always] }],
    log: out.log,
  });
  diagnostics.setEnabled(false);
  expect(diagnostics.tick(input)).toHaveLength(0);
  expect(diagnostics.state().enabled).toBe(false);
  diagnostics.setEnabled(true);
  expect(diagnostics.tick(input)).toHaveLength(1);
});

test("owner filtering: block wins, allow narrows", () => {
  const out = reporter();
  const diagnostics = createRuntimeDiagnostics({
    sets: [
      { owner: "kept", invariants: [always] },
      { owner: "blocked", invariants: [always] },
    ],
    log: out.log,
  });
  diagnostics.setOwnerFilter({
    allow: ["kept", "blocked"],
    block: ["blocked"],
  });
  expect(diagnostics.tick(input).map((finding) => finding.owner)).toEqual([
    "kept",
  ]);
  diagnostics.setOwnerFilter({ allow: ["blocked"] });
  expect(diagnostics.tick(input).map((finding) => finding.owner)).toEqual([
    "blocked",
  ]);
});

test("a crashing checker is recorded as a finding, never as a crash", () => {
  const out = reporter();
  const diagnostics = createRuntimeDiagnostics({
    sets: [{ owner: "test-domain", invariants: [crasher] }],
    log: out.log,
  });
  const findings = diagnostics.tick(input);
  expect(findings).toHaveLength(1);
  expect(findings[0]!.code).toBe("test.crasher.checker_crashed");
  expect(findings[0]!.detail).toContain("checker blew up");
});

test("the interval runner ticks and stops", async () => {
  const out = reporter();
  const diagnostics = createRuntimeDiagnostics({
    sets: [{ owner: "test-domain", invariants: [always] }],
    log: out.log,
  });
  diagnostics.start(10, () => input);
  await new Promise((resolve) => setTimeout(resolve, 60));
  diagnostics.stop();
  const ticks = diagnostics.state().ticks;
  expect(ticks).toBeGreaterThan(0);
  await new Promise((resolve) => setTimeout(resolve, 40));
  expect(diagnostics.state().ticks).toBe(ticks); // stopped for real
});
