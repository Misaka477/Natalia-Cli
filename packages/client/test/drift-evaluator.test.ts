import { expect, test } from "bun:test";
import {
  buildDriftFindingUpdate,
  createDriftEvaluator,
} from "../src/drift-evaluator";
import { DRIFT_FINDING_WRITER_OWNER } from "../src/workspace-observation";

function makeEvaluator(open: ReadonlySet<string> = new Set()) {
  return createDriftEvaluator({ openFindingIDs: () => open });
}

test("the drift finding writer owner is fixed", () => {
  expect(DRIFT_FINDING_WRITER_OWNER).toBe("DriftEvaluator");
});

test("no drift when activity overlaps the objective", () => {
  const evaluator = makeEvaluator();
  const findings = evaluator.evaluate({
    sessionID: "ses_1",
    turnID: "t_1",
    objective: "add a typed HTTP client",
    currentActivity: "adding a typed HTTP client",
    applicableConstraints: [],
    changes: [
      { action: "modified", path: "src/http.ts", summary: "typed client" },
    ],
    evidenceRefs: ["validated"],
  });
  expect(findings).toEqual([]);
});

test("objective/activity mismatch opens an advisory finding", () => {
  const evaluator = makeEvaluator();
  const findings = evaluator.evaluate({
    sessionID: "ses_1",
    turnID: "t_1",
    objective: "implement user authentication",
    currentActivity: "refactoring the css theme",
    applicableConstraints: [],
    changes: [{ action: "modified", path: "src/theme.css" }],
    evidenceRefs: [],
  });
  expect(findings).toHaveLength(1);
  const finding = findings[0]!;
  expect(finding.type).toBe("drift.finding_opened");
  expect(finding.severity).toBe("advisory");
  expect(finding.confidence).toBeGreaterThan(0.4);
  expect(finding.originalObjective).toContain("authentication");
  expect(finding.currentActivity).toContain("css theme");
  expect(finding.evidence.some((entry) => entry.startsWith("activity:"))).toBe(
    true,
  );
});

test("a forbidden activity signal opens a high finding with the constraint", () => {
  const evaluator = makeEvaluator();
  const findings = evaluator.evaluate({
    sessionID: "ses_1",
    turnID: "t_1",
    objective: "finish the docs",
    currentActivity: "commit the generated files to the repo",
    applicableConstraints: ["never commit generated files"],
    changes: [{ action: "added", path: "dist/out.js" }],
    evidenceRefs: [],
  });
  expect(findings.length).toBeGreaterThan(0);
  const finding = findings.find((f) => f.severity === "high");
  expect(finding).toBeDefined();
  expect(finding?.severity).toBe("high");
  expect(finding?.applicableConstraints[0]).toContain("never commit");
  expect(
    finding?.evidence.some((entry) => entry.startsWith("constraint:")),
  ).toBe(true);
});

test("a verify objective with no evidence and changed files opens a warning", () => {
  const evaluator = makeEvaluator();
  const findings = evaluator.evaluate({
    sessionID: "ses_1",
    turnID: "t_1",
    objective: "verify the build passes",
    currentActivity: "verify the build passes",
    applicableConstraints: [],
    changes: [{ action: "modified", path: "src/lib.ts" }],
    evidenceRefs: [],
  });
  const finding = findings.find((f) => f.severity === "warning");
  expect(finding).toBeDefined();
  expect(finding?.evidence).toContain("completion:no_evidence_refs");
});

test("an already-open finding is not reopened", () => {
  const findingID = "drift:objective_activity_mismatch:t_1:ses_1";
  const evaluator = makeEvaluator(new Set([findingID]));
  const findings = evaluator.evaluate({
    sessionID: "ses_1",
    turnID: "t_1",
    objective: "implement authentication",
    currentActivity: "refactoring css",
    applicableConstraints: [],
    changes: [{ action: "modified", path: "src/theme.css" }],
    evidenceRefs: [],
  });
  expect(findings.some((f) => f.findingID === findingID)).toBe(false);
});

test("drift findings carry no secrets", () => {
  const evaluator = makeEvaluator();
  const findings = evaluator.evaluate({
    sessionID: "ses_1",
    turnID: "t_1",
    objective: "implement authentication",
    currentActivity: "commit api_key=supersecret to the repo",
    applicableConstraints: ["never commit secrets"],
    changes: [{ action: "added", path: "config.json" }],
    evidenceRefs: [],
  });
  const serialized = JSON.stringify(findings);
  expect(serialized).not.toContain("supersecret");
});

test("buildDriftFindingUpdate records the rationale acknowledgement", () => {
  const event = buildDriftFindingUpdate({
    id: "drift:abc:drift:x",
    findingID: "drift:x",
    status: "explained",
    rationale: "the css refactor was a prerequisite",
  });
  expect(event).toMatchObject({
    type: "drift.finding_updated",
    findingID: "drift:x",
    status: "explained",
    rationale: "the css refactor was a prerequisite",
  });
});

test("buildDriftFindingUpdate redacts secrets from the rationale", () => {
  const event = buildDriftFindingUpdate({
    id: "drift:abc:drift:y",
    findingID: "drift:y",
    status: "dismissed",
    rationale: "api_key=supersecret is not involved",
  });
  expect(JSON.stringify(event)).not.toContain("supersecret");
  expect(event.rationale).toContain("[REDACTED]");
});
