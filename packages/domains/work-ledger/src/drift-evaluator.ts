/**
 * DriftEvaluator — the sole production writer of `drift.finding_opened`
 * (mainline plan §56.9; drift plan §5/§6; EI §8.6 rewrite).
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
 *    context snapshots or raw errors. `assertSecretSafeDriftFact` enforces the
 *    boundary at one point.
 * 3. **Ordinary user edits are not drift.** Only divergence from the objective,
 *    an applicable constraint, an expected mutation or completion evidence
 *    opens a finding.
 *
 * The EI §8.6 rewrite makes the judgment explicit and the reference frame
 * first-class:
 *
 * - **The R is the accepted WorkContract.** A finding is only judge-able
 *   against a user-approved contract; without one (no contract or a stale
 *   draft), the evaluator produces at most an advisory "unverifiable" finding
 *   (EI §3.8 P-1.b: a lack of commitment is itself a fact).
 * - **CJK-aware objective overlap.** Latin word-splitting scored Chinese
 *   objectives as zero overlap, which was the single largest false-positive
 *   source; the metric now counts CJK bigrams as well as words.
 * - **contractVersion.** Every finding carries the rule-set version it was
 *   judged under, and `ruleHits` exposes which rules fired and how strongly.
 * - **The status matrix is explicit.** open → explained (agent acknowledges
 *   with rationale) → disputed (agent disagrees) / detour_declared (a
 *   sanctioned detour) → dismissed (user closes) / corrected (work realigns).
 *
 * This module is the evaluator's pure half: it takes safe signals and produces
 * findings. The runtime owns when to call it (turn-end, observation reconcile)
 * and owns publishing. The writer-owner constant is enforced by convention:
 * no other module constructs a `drift.finding_opened` event.
 */
import type { RuntimeEvent } from "@natalia/contracts";
import type { WorkspaceChangeOrigin } from "@natalia/contracts";

export const DRIFT_FINDING_WRITER_OWNER = "DriftEvaluator" as const;

/**
 * The evaluation contract version (EI §8.6). Bumped when the rule set or the
 * scoring changes, so a finding is always judge-able against the contract
 * that opened it — a contractVersion mismatch means the finding predates the
 * current rules and must not be silently re-interpreted.
 */
export const DRIFT_CONTRACT_VERSION = 2;

const FORBIDDEN_DRIFT_FACT_KEYS = new Set([
  "content",
  "diff",
  "patch",
  "command",
  "args",
  "arguments",
  "result",
  "output",
  "thinking",
  "reasoning",
  "context",
  "error",
  "stderr",
  "stdout",
]);

function assertSecretSafeDriftFact(fact: Record<string, unknown>): void {
  for (const key of Object.keys(fact)) {
    if (FORBIDDEN_DRIFT_FACT_KEYS.has(key))
      throw new Error(`drift fact carries a forbidden field: ${key}`);
  }
}

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
  /**
   * The accepted WorkContract judged against (EI §3.3 铁律): the user-tier R.
   * Absent (no contract, or only a stale draft) → at most an advisory
   * unverifiable finding — "no commitment yet" is a fact, not a drift.
   */
  contract?: {
    planID: string;
    scope?: string[];
    verification?: string[];
    constraints?: string[];
  };
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
  contractVersion?: number;
  ruleHits?: Array<{ rule: string; confidence: number }>;
  planID?: string;
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
  | "disputed"
  | "dismissed"
  | "corrected"
  | "detour_declared";

/**
 * A finding's status transition (P7 D3: rationale acknowledgement). The Main
 * Agent acknowledges a finding as explained (with a rationale), disputes it,
 * or declares a sanctioned detour; the user dismisses it or the work corrects
 * it. `rationale` is safe prose — never a command, content or secret — and is
 * redacted before journaling.
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
  assertSecretSafeDriftFact(event);
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
    contractVersion: input.contractVersion ?? DRIFT_CONTRACT_VERSION,
    ...(input.ruleHits ? { ruleHits: input.ruleHits } : {}),
    ...(input.planID ? { planID: input.planID } : {}),
  };
  assertSecretSafeDriftFact(event);
  return event;
}

/**
 * CJK-aware token extraction (EI §8.6): Latin words split on non-word
 * characters; CJK text has no word separators, so it is split into
 * overlapping bigrams (plus unigrams for single-character coverage). The old
 * word-only metric scored Chinese objectives as zero overlap — the single
 * largest false-positive source.
 */
function tokens(text: string): Set<string> {
  const set = new Set<string>();
  const words = text.toLowerCase().split(/\W+/u).filter(Boolean);
  for (const word of words) set.add(word);
  const cjkRuns = text.toLowerCase().match(/[\u4e00-\u9fff\u3040-\u30ff]+/gu);
  for (const run of cjkRuns ?? []) {
    for (let index = 0; index < run.length; index += 1) set.add(run[index]!);
    for (let index = 0; index + 1 < run.length; index += 1)
      set.add(run.slice(index, index + 2));
  }
  return set;
}

/** Token-set overlap between two strings, 0..1 (Jaccard, CJK-aware). */
function overlap(left: string, right: string): number {
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (!rightTokens.size || !leftTokens.size) return 0;
  let hits = 0;
  for (const token of rightTokens) if (leftTokens.has(token)) hits += 1;
  return hits / rightTokens.size;
}

/** A rule: name, severity, and a safe explanation of why it fired. */
type Rule = {
  name: string;
  severity: "advisory" | "warning" | "high";
  match: (
    signal: DriftSignal,
  ) => { confidence: number; evidence: string[] } | undefined;
};

/**
 * Bounds a comma-joined activity list by ITEM count, never mid-item (EI §2
 * principle 2: the finding carries refs, and a char slice would cut
 * "deleted:path" into "dele"). The list keeps its first `maxItems` entries and
 * states how many were dropped, so the card is bounded but never lies about
 * what it shows.
 */
function boundActivity(text: string, maxItems: number): string {
  const items = text
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (items.length <= 1 || items.length <= maxItems) return text;
  return `${items.slice(0, maxItems).join(", ")}, …+${items.length - maxItems} more`;
}

function objectiveActivityRule(): Rule {
  return {
    name: "objective_activity_mismatch",
    severity: "advisory",
    match: (signal) => {
      // The R's scope, when present, is what the work should touch — an
      // activity matching the committed scope is on-track even when the
      // objective sentence itself reads differently.
      const scope = signal.contract?.scope ?? [];
      const scopeMatch = scope.some(
        (entry) =>
          signal.currentActivity.includes(entry) ||
          signal.changes.some((change) => change.path?.includes(entry)),
      );
      if (scopeMatch) return undefined;
      const score = overlap(signal.objective, signal.currentActivity);
      if (score >= 0.35) return undefined;
      const activityRefs = signal.changes
        .map(
          (change) =>
            `${change.action ?? "change"}:${change.path ?? change.target ?? change.summary ?? "unknown"}`,
        )
        .filter(Boolean);
      const shownRefs = activityRefs.slice(0, 30);
      const moreRefs = activityRefs.length - shownRefs.length;
      return {
        confidence: Math.max(0.4, 1 - score),
        evidence: [
          `objective_overlap:${score.toFixed(2)}`,
          `activity_count:${activityRefs.length || 1}`,
          ...(shownRefs.length
            ? shownRefs.map((ref) => `activity:${ref}`)
            : [`activity:${boundActivity(signal.currentActivity, 30)}`]),
          ...(moreRefs > 0 ? [`activity_more:${moreRefs}`] : []),
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
      // The R's committed constraints join the session's applicable ones:
      // the user's own constraint is as binding as a seeded rule.
      const constraints = [
        ...signal.applicableConstraints,
        ...(signal.contract?.constraints ?? []),
      ].filter((constraint) =>
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
      // An objective (or committed verification) that says "verify"/"test"/
      // "check" but has collected no evidence refs and changed files is a
      // completion gap.
      const verification = [
        signal.objective,
        ...(signal.contract?.verification ?? []),
      ].join(" ");
      if (!/verify|test|check|validate/iu.test(verification)) return undefined;
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
 * quoted path segments — and the R's committed scope — are the expected
 * targets.
 */
function targetDriftRule(): Rule {
  return {
    name: "target_drift",
    severity: "advisory",
    match: (signal) => {
      const targets = [
        ...[...signal.objective.matchAll(/"([^"]+)"/gu)].map((match) =>
          match[1]!.replace(/^\.\//u, "").replace(/\/$/u, ""),
        ),
        ...(signal.contract?.scope ?? []),
      ];
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

/**
 * The advisory "no reference frame" finding (EI §3.8 P-1.b): changes exist
 * but the user has not committed to a WorkContract. It is deliberately
 * advisory-only and named, so a UI can show "no commitment yet" instead of a
 * drift score against nothing.
 */
function unverifiableRule(): Rule {
  return {
    name: "unverifiable_no_contract",
    severity: "advisory",
    match: (signal) => {
      if (signal.contract) return undefined;
      if (!signal.changes.length) return undefined;
      return {
        confidence: 0.5,
        evidence: ["reference:no_accepted_contract"],
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
    unverifiableRule(),
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
    const ruleHits: Array<{ rule: string; confidence: number }> = [];
    for (const rule of rules) {
      const result = rule.match(signal);
      if (!result) continue;
      if (result.confidence < minimumConfidence) continue;
      const findingID = `drift:${rule.name}:${signal.turnID ?? "session"}:${signal.sessionID ?? ""}`;
      if (open.has(findingID)) continue;
      ruleHits.push({ rule: rule.name, confidence: result.confidence });
      findings.push(
        buildDriftFinding({
          id: `drift:${Date.now().toString(36)}:${rule.name}`,
          findingID,
          severity: rule.severity,
          confidence: result.confidence,
          originalObjective: signal.objective.slice(0, 200),
          currentActivity: boundActivity(signal.currentActivity, 30),
          evidence: result.evidence,
          applicableConstraints: signal.applicableConstraints,
          contractVersion: DRIFT_CONTRACT_VERSION,
          ruleHits,
          ...(signal.contract?.planID
            ? { planID: signal.contract.planID }
            : {}),
        }),
      );
    }
    return findings;
  }

  return { evaluate };
}
