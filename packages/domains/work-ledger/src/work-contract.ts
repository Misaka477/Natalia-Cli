/**
 * WorkContract source facts (EI §8.2, Phase -1.b).
 *
 * The WorkContract is R — the reference frame drift is judged against (§3.0):
 * without a user-tier commitment, "偏移" has no definition. It is produced at
 * the existing user-confirmation points (plan handoff / activate gate): the
 * model drafts scope/verification/constraints extracted from the plan document
 * it just wrote (grounding, not invention), the runtime validates the draft,
 * and the user approves it once through the plan-acceptance gate.
 *
 * Two rules shape this module:
 *
 * 1. **Placeholders are rejected, not guessed.** A field that is a single
 *    character or a pure generic word ("all", "everything", "相关") carries no
 *    commitment and must never reach the journal as one; the proposer gets the
 *    rejection as feedback and re-drafts.
 * 2. **A plan document edit invalidates the draft, never the acceptance.**
 *    `drafted` carries the planVersion it was extracted from; the projection
 *    marks a draft stale when the document changed after it. An accepted
 *    contract is the user's promise and stays current until a new one is
 *    approved — nothing replaces it silently.
 */
import type { RuntimeEvent } from "@natalia/contracts";

export type WorkContractDraftedEvent = Extract<
  RuntimeEvent,
  { type: "work_contract.drafted" }
>;
export type WorkContractAcceptedEvent = Extract<
  RuntimeEvent,
  { type: "work_contract.accepted" }
>;

export type WorkContractFields = {
  scope?: string[];
  verification?: string[];
  constraints?: string[];
};

/** Pure generic words that carry no commitment, in either language. */
const GENERIC_PLACEHOLDERS = new Set([
  "all",
  "everything",
  "anything",
  "any",
  "none",
  "n/a",
  "na",
  "tbd",
  "todo",
  "misc",
  "various",
  "stuff",
  "things",
  "everything else",
  "all files",
  "全部",
  "所有",
  "任何",
  "一切",
  "相关",
  "待定",
  "未定",
  "略",
]);

/** True when a single field value carries no real commitment. */
export function isPlaceholderContractValue(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length <= 1) return true;
  return GENERIC_PLACEHOLDERS.has(trimmed.toLowerCase());
}

/**
 * Validates a proposed draft's fields (EI §8.2 runtime validation):
 *
 * - a provided field must be a non-empty array (an empty array provided means
 *   the proposer did not actually extract anything);
 * - no value may be a placeholder (single character or a pure generic word).
 *
 * Returns the rejection reasons; an empty array means the draft is valid.
 * An all-empty draft is NOT invalid — it produces an `unverifiable` acceptance
 * (advisory-only judgment), per EI §3.8 P-1.b.
 */
export function validateWorkContractFields(
  fields: WorkContractFields,
): string[] {
  const problems: string[] = [];
  for (const field of ["scope", "verification", "constraints"] as const) {
    const values = fields[field];
    if (values === undefined) continue;
    if (!Array.isArray(values) || values.length === 0) {
      problems.push(
        `${field} was provided but is empty; omit it or extract concrete entries`,
      );
      continue;
    }
    for (const value of values) {
      if (typeof value !== "string" || !value.trim()) {
        problems.push(`${field} contains an empty entry`);
        continue;
      }
      if (isPlaceholderContractValue(value))
        problems.push(
          `${field} entry "${value.trim().slice(0, 40)}" is a placeholder; extract concrete entries`,
        );
    }
  }
  return problems;
}

/** True when the draft extracted no structured fields at all. */
export function isUnverifiableContract(fields: WorkContractFields): boolean {
  return (
    !(fields.scope?.length ?? false) &&
    !(fields.verification?.length ?? false) &&
    !(fields.constraints?.length ?? false)
  );
}

/**
 * Builds a `work_contract.drafted` event. Repeatable: a rejected draft is
 * re-proposed with the user's feedback folded in, and the projection keeps the
 * latest draft per plan. Empty field arrays are omitted rather than emitted as
 * `[]` so a consumer can tell "nothing extracted" from "empty extraction".
 */
export function buildWorkContractDrafted(input: {
  id: string;
  planID: string;
  planVersion: number;
  scope?: string[];
  verification?: string[];
  constraints?: string[];
  draftedAt: string;
}): WorkContractDraftedEvent {
  return {
    type: "work_contract.drafted",
    id: input.id,
    planID: input.planID,
    planVersion: input.planVersion,
    ...(input.scope && input.scope.length ? { scope: input.scope } : {}),
    ...(input.verification && input.verification.length
      ? { verification: input.verification }
      : {}),
    ...(input.constraints && input.constraints.length
      ? { constraints: input.constraints }
      : {}),
    draftedAt: input.draftedAt,
    source: "model",
  };
}

/**
 * Builds the user-approved `work_contract.accepted` event — the R drift is
 * judged against. `acceptedBy` is always "user": only a user confirmation
 * makes a contract judge-able (EI §3.3 铁律). `unverifiable` marks a plan
 * approved with no extractable fields (advisory-only judgment).
 */
export function buildWorkContractAccepted(input: {
  id: string;
  planID: string;
  planVersion: number;
  scope?: string[];
  verification?: string[];
  constraints?: string[];
  acceptedAt: string;
  unverifiable?: boolean;
}): WorkContractAcceptedEvent {
  return {
    type: "work_contract.accepted",
    id: input.id,
    planID: input.planID,
    planVersion: input.planVersion,
    ...(input.scope && input.scope.length ? { scope: input.scope } : {}),
    ...(input.verification && input.verification.length
      ? { verification: input.verification }
      : {}),
    ...(input.constraints && input.constraints.length
      ? { constraints: input.constraints }
      : {}),
    acceptedBy: "user",
    acceptedAt: input.acceptedAt,
    ...(input.unverifiable ? { unverifiable: true } : {}),
  };
}
