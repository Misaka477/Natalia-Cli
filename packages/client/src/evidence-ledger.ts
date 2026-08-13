/**
 * Evidence ledger writer — the production half of P2 (E2 起步).
 *
 * The `evidence.recorded` schema, projection and query have existed since E1,
 * but nothing in production ever published the event, so `evidenceRecords()`
 * answered empty and the availability report named it unimplemented. This
 * module is the writer's pure half, following the work-graph, session-
 * intelligence and constitution-ledger writers: event construction lives here,
 * the runtime supplies the executed validation facts, and the tests cover the
 * pure functions without building a runtime.
 *
 * Secret-safe boundary (from the plan §4/§7): a validation result records the
 * command, the outcome, a bounded safe summary and a duration. The raw output
 * that produced the summary never enters the journal — the runtime redacts
 * secrets and truncates before calling this builder, and the summary is prose,
 * not a paste of the tool result.
 */
import type { RuntimeEvent } from "@natalia/contracts";

export type ValidationOutcome = {
  command: string;
  result: "passed" | "failed" | "skipped";
  safeSummary: string;
  durationMs?: number;
};

export type EvidenceInput = {
  id: string;
  taskID: string;
  objective: string;
  status:
    | "planned"
    | "implemented"
    | "validated"
    | "accepted"
    | "promoted"
    | "blocked"
    | "failed"
    | "partial";
  changes?: Array<{
    path: string;
    changeType: "added" | "modified" | "deleted";
    summary: string;
  }>;
  validations?: ValidationOutcome[];
  knownGaps?: string[];
};

/**
 * Builds an `evidence.recorded` event. `validations` entries are bounded to a
 * command + outcome + safe summary; nothing else about the run may enter the
 * journal. Empty validation lists are omitted rather than emitted as `[]` so a
 * consumer can tell "no validation recorded" from "recorded as skipped".
 */
export function buildEvidenceRecorded(
  input: EvidenceInput,
): Extract<RuntimeEvent, { type: "evidence.recorded" }> {
  return {
    type: "evidence.recorded",
    id: input.id,
    taskID: input.taskID,
    objective: input.objective,
    status: input.status,
    ...(input.changes && input.changes.length
      ? { changes: input.changes }
      : {}),
    ...(input.validations && input.validations.length
      ? { validations: input.validations }
      : {}),
    ...(input.knownGaps && input.knownGaps.length
      ? { knownGaps: input.knownGaps }
      : {}),
  };
}

/**
 * Bounds a validation outcome to its safe, journal-safe shape: the command,
 * the result, a truncated safe summary and an optional duration. The summary is
 * capped at 2000 characters so a chatty runner cannot bloat the journal, and
 * secret redaction is the caller's job before this runs.
 */
export function boundValidationOutcome(input: {
  command: string;
  result: "passed" | "failed" | "skipped";
  safeSummary: string;
  durationMs?: number;
}): ValidationOutcome {
  return {
    command: input.command,
    result: input.result,
    safeSummary: input.safeSummary.slice(0, 2000),
    ...(input.durationMs !== undefined
      ? { durationMs: Math.max(0, Math.round(input.durationMs)) }
      : {}),
  };
}
