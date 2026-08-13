/**
 * DriftEvaluator — the sole production writer of `drift.finding_opened`
 * (mainline plan §56.9; drift plan §5/§6).
 *
 * A drift finding answers "the actual work diverged from the objective or a
 * constraint, and here is why" — as a scored, explainable heuristic, never a
 * guess dressed up as a fact. Three rules govern it (drift plan §5):
 *
 * 1. **Detection only, no write power.** The evaluator opens findings; it never
 *    cancels, rolls back, discards a sandbox or modifies a plan. Even a high
 *    finding only escalates to an approval/Chat/mailbox prompt unless a
 *    Constitution hard-deny conflict already exists.
 * 2. **Explainable evidence, no secrets.** `evidence` is a list of safe
 *    metadata references — path classes, action types, targets, summaries —
 *    never file content, diffs, patches, command text, tool arguments/results,
 *    context snapshots or raw errors. `assertSecretSafeObservation` enforces
 *    the boundary at one point.
 * 3. **Ordinary user edits are not drift.** Only divergence from the objective,
 *    an applicable constraint, an expected mutation or completion evidence
 *    opens a finding.
 *
 * This module is the evaluator's pure half: it takes safe signals and produces
 * findings. The runtime owns when to call it (turn-end, observation reconcile)
 * and owns publishing. The writer-owner constant (`DRIFT_FINDING_WRITER_OWNER`
 * in `workspace-observation.ts`) is enforced by convention: no other module
 * constructs a `drift.finding_opened` event.
 */
import type { RuntimeEvent } from "@natalia/contracts";
import type { WorkspaceChangeOrigin } from "@natalia/contracts";
import { assertSecretSafeObservation } from "./workspace-observation";

export type DriftSignal = {
  sessionID?: string;
  episodeID?: string;
  turnID?: string;
  objective: string;
  currentActivity: string;
  /** Applicable constraints, each a sentence. */
  applicableConstraints: string[];
  /** Safe metadata about what actually changed (path/action/target/summary refs). */
  changes: Array<{
    path?: string;
    action?: string;
    target?: string;
    summary?: string;
    origin?: WorkspaceChangeOrigin;
  }>;
  /** Completion evidence collected so far (safe refs). */
  evidenceRefs: string[];
};

export type DriftFindingInput = {
  id: string;
  findingID: string;
  severity: "advisory" | "warning" | "high";
  confidence: number;
  originalObjective: string;
  currentActivity: string;
  evidence: string[];
  applicableConstraints: string[];
};

/** Redact secret-shaped tokens from anything that crosses into a finding. */
function redact(text: string): string {
  return text.replace(
    /\b(?:api[_-]?key|token|secret|password|passwd)\s*[:=]\s*[^\s,;]+/giu,
    (match) => `${match.split(/[:=]/u)[0]}=[REDACTED]`,
  );
}

export type DriftFindingStatus =
  | "open"
  | "explained"
  | "dismissed"
  | "corrected";

/**
 * A finding's status transition (P7 D3: rationale acknowledgement). The Main
 * Agent acknowledges a finding as explained (with a rationale) or the user
 * dismisses it / the work corrects it. `rationale` is safe prose — never a
 * command, content or secret — and is redacted before journaling.
 */
export function buildDriftFindingUpdate(input: {
  id: string;
  findingID: string;
  status: DriftFindingStatus;
  rationale?: string;
}): Extract<RuntimeEvent, { type: "drift.finding_updated" }> {
  const event: Extract<RuntimeEvent, { type: "drift.finding_updated" }> = {
    type: "drift.finding_updated",
    id: input.id,
    findingID: input.findingID,
    status: input.status,
    ...(input.rationale ? { rationale: redact(input.rationale) } : {}),
  };
  assertSecretSafeObservation(event);
  return event;
}

export function buildDriftFinding(
  input: DriftFindingInput,
): Extract<RuntimeEvent, { type: "drift.finding_opened" }> {
  const event: Extract<RuntimeEvent, { type: "drift.finding_opened" }> = {
    type: "drift.finding_opened",
    id: input.id,
    findingID: input.findingID,
    severity: input.severity,
    confidence: input.confidence,
    originalObjective: redact(input.originalObjective),
    currentActivity: redact(input.currentActivity),
    evidence: input.evidence.map(redact),
    applicableConstraints: input.applicableConstraints.map(redact),
  };
  assertSecretSafeObservation(event);
  return event;
}

/** Word overlap between two lowercase strings, 0..1. */
function overlap(left: string, right: string): number {
  const leftWords = new Set(left.toLowerCase().split(/\W+/u).filter(Boolean));
  const rightWords = right.toLowerCase().split(/\W+/u).filter(Boolean);
  if (!rightWords.length || !leftWords.size) return 0;
  const hits = rightWords.filter((word) => leftWords.has(word)).length;
  return hits / rightWords.length;
}

/** A rule: name, severity, and a safe explanation of why it fired. */
type Rule = {
  name: string;
  severity: "advisory" | "warning" | "high";
  match: (
    signal: DriftSignal,
  ) => { confidence: number; evidence: string[] } | undefined;
};

function objectiveActivityRule(): Rule {
  return {
    name: "objective_activity_mismatch",
    severity: "advisory",
    match: (signal) => {
      const score = overlap(signal.objective, signal.currentActivity);
      if (score >= 0.35) return undefined;
      return {
        confidence: Math.max(0.4, 1 - score),
        evidence: [
          `activity:${signal.currentActivity.slice(0, 120)}`,
          `objective_overlap:${score.toFixed(2)}`,
        ],
      };
    },
  };
}

function constraintViolationRule(): Rule {
  // Constraint-adjacent words: when the current activity touches something a
  // constraint forbids, flag it. The constraint sentence itself is the
  // evidence, never a command or content.
  const forbiddenWords = new Set([
    "commit",
    "push",
    "delete",
    "remove",
    "rewrite",
    "ignore",
    "skip",
    "bypass",
  ]);
  return {
    name: "constraint_violation_signal",
    severity: "high",
    match: (signal) => {
      const activity = signal.currentActivity.toLowerCase();
      const constraints = signal.applicableConstraints.filter((constraint) =>
        constraint.split(/\W+/u).some((word) => forbiddenWords.has(word)),
      );
      if (!constraints.length) return undefined;
      const activityHits = [...forbiddenWords].filter((word) =>
        activity.includes(word),
      );
      if (!activityHits.length) return undefined;
      return {
        confidence: 0.75 + 0.05 * Math.min(activityHits.length, 5),
        evidence: [
          `constraint:${constraints[0]!.slice(0, 120)}`,
          `activity_signal:${activityHits.join(",")}`,
        ],
      };
    },
  };
}

function evidenceGapRule(): Rule {
  return {
    name: "evidence_gap",
    severity: "warning",
    match: (signal) => {
      // An objective that says "verify"/"test"/"check" but has collected no
      // evidence refs and changed files is a completion gap.
      if (!/verify|test|check|validate/iu.test(signal.objective))
        return undefined;
      if (signal.evidenceRefs.length > 0) return undefined;
      if (!signal.changes.length) return undefined;
      return {
        confidence: 0.7,
        evidence: ["completion:no_evidence_refs"],
      };
    },
  };
}

/**
 * D4 `dependency_signal`: a change to a dependency manifest or lockfile when
 * the objective has nothing to do with dependencies is a mild drift signal.
 */
const DEPENDENCY_MANIFESTS = [
  "package.json",
  "bun.lock",
  "pnpm-lock.yaml",
  "yarn.lock",
  "Cargo.toml",
  "Cargo.lock",
  "requirements.txt",
  "pyproject.toml",
];

function dependencyRule(): Rule {
  return {
    name: "dependency_signal",
    severity: "advisory",
    match: (signal) => {
      const depChange = signal.changes.find((change) =>
        DEPENDENCY_MANIFESTS.some(
          (manifest) =>
            change.path === manifest || change.path?.endsWith(`/${manifest}`),
        ),
      );
      if (!depChange) return undefined;
      if (
        /\bdependen\w*|install\w*|lockfile|manifest\w*/iu.test(signal.objective)
      )
        return undefined;
      return {
        confidence: 0.55,
        evidence: [`dependency:${depChange.path}`],
      };
    },
  };
}

/**
 * D4 `target_drift`: a change lands outside the directory the objective names
 * (e.g. objective says "src" but the change touched "dist"). The objective's
 * quoted path segments are the expected targets.
 */
function targetDriftRule(): Rule {
  return {
    name: "target_drift",
    severity: "advisory",
    match: (signal) => {
      const targets = [...signal.objective.matchAll(/"([^"]+)"/gu)].map(
        (match) => match[1]!.replace(/^\.\//u, "").replace(/\/$/u, ""),
      );
      if (!targets.length || !signal.changes.length) return undefined;
      const outside = signal.changes.filter(
        (change) =>
          change.path &&
          !targets.some(
            (target) =>
              change.path === target || change.path?.startsWith(`${target}/`),
          ),
      );
      if (!outside.length) return undefined;
      return {
        confidence: 0.6,
        evidence: outside.map((change) => `outside_target:${change.path}`),
      };
    },
  };
}

export function createDriftEvaluator(input: {
  /** Keep findings stable per turn: same signals do not reopen the same finding. */
  openFindingIDs: () => ReadonlySet<string>;
  /** False-positive tuning: rules below this confidence are not opened. */
  minimumConfidence?: number;
}) {
  const minimumConfidence = input.minimumConfidence ?? 0.5;
  const rules: Rule[] = [
    objectiveActivityRule(),
    constraintViolationRule(),
    evidenceGapRule(),
    dependencyRule(),
    targetDriftRule(),
  ];

  /**
   * Evaluate a turn's signals against the rules. Returns the findings to open,
   * each ready to publish. Findings already open (per `openFindingIDs`) are not
   * reopened — a finding is one fact per divergence, not one per evaluation.
   * D4: a rule result below `minimumConfidence` is not opened (false-positive
   * tuning — weak signals should not spam the ledger).
   */
  function evaluate(
    signal: DriftSignal,
  ): Array<Extract<RuntimeEvent, { type: "drift.finding_opened" }>> {
    const open = input.openFindingIDs();
    const findings: Array<
      Extract<RuntimeEvent, { type: "drift.finding_opened" }>
    > = [];
    for (const rule of rules) {
      const result = rule.match(signal);
      if (!result) continue;
      if (result.confidence < minimumConfidence) continue;
      const findingID = `drift:${rule.name}:${signal.turnID ?? "session"}:${signal.sessionID ?? ""}`;
      if (open.has(findingID)) continue;
      findings.push(
        buildDriftFinding({
          id: `drift:${Date.now().toString(36)}:${rule.name}`,
          findingID,
          severity: rule.severity,
          confidence: result.confidence,
          originalObjective: signal.objective.slice(0, 200),
          currentActivity: signal.currentActivity.slice(0, 200),
          evidence: result.evidence,
          applicableConstraints: signal.applicableConstraints,
        }),
      );
    }
    return findings;
  }

  return { evaluate };
}
