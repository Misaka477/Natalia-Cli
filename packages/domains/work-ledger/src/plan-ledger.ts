/**
 * Live Work Chat plan ledger — the durable half of P8 Phase C4.
 *
 * P8 §6 defines a versioned plan state machine: draft → proposed → accepted →
 * queued_next_plan → active → completed/superseded/archived. Chat drafts and
 * proposes plans; the user accepts; the accepted plan becomes queued next and
 * activates when the current work reaches a safe finish; the main agent gets a
 * structured NextPlanHandoff (the injection half is future work — this module
 * owns the durable journal and lifecycle).
 *
 * Following the work-graph / session-intelligence / constitution-ledger /
 * evidence-ledger / mailbox-ledger writers: event construction lives here, the
 * runtime owns delivery timing and the tests cover the pure functions without a
 * runtime. Plan content is safe prose (objective, steps, constraints,
 * verification, risk notes) that may reach the journal — never tool output,
 * file content or secrets.
 */
import type { RuntimeEvent } from "@natalia/contracts";

export type PlanAuthor = "user" | "live_chat" | "main_agent";

export type PlanStep = {
  id: string;
  title: string;
  detail?: string;
  verification?: string;
};

export type PlanDraftInput = {
  id: string;
  planID: string;
  version: number;
  title: string;
  author: PlanAuthor;
  objective: string;
  steps: PlanStep[];
  constraints?: string[];
  verification?: string[];
  riskNotes?: string[];
  relatedMailboxMessageID?: string;
  /** The task this plan verifies (E3 task contract). The task's evidence
   *  records are the completion evidence for this plan. */
  taskID?: string;
  supersedesPlanID?: string;
  createdAt: string;
  reason?: string;
};

export function buildPlanDraftCreated(
  input: PlanDraftInput,
): Extract<RuntimeEvent, { type: "plan.draft.created" }> {
  return {
    type: "plan.draft.created",
    id: input.id,
    planID: input.planID,
    version: input.version,
    title: input.title,
    author: input.author,
    objective: input.objective,
    steps: input.steps,
    ...(input.constraints && input.constraints.length
      ? { constraints: input.constraints }
      : {}),
    ...(input.verification && input.verification.length
      ? { verification: input.verification }
      : {}),
    ...(input.riskNotes && input.riskNotes.length
      ? { riskNotes: input.riskNotes }
      : {}),
    ...(input.relatedMailboxMessageID
      ? { relatedMailboxMessageID: input.relatedMailboxMessageID }
      : {}),
    ...(input.taskID ? { taskID: input.taskID } : {}),
    ...(input.supersedesPlanID
      ? { supersedesPlanID: input.supersedesPlanID }
      : {}),
    createdAt: input.createdAt,
    ...(input.reason ? { reason: input.reason } : {}),
  };
}

/**
 * The plan lifecycle transitions. Each carries the plan id, the bumped version
 * and a safe reason. `version` is the plan's own version (not the event's):
 * every transition after creation bumps it so a consumer can tell which version
 * of the plan reached each state.
 */
export function buildPlanTransition(input: {
  id: string;
  planID: string;
  version: number;
  transition:
    | "draft_updated"
    | "proposed"
    | "accepted"
    | "queued"
    | "activated"
    | "superseded"
    | "completed"
    | "archived";
  at: string;
  acceptedBy?: "user";
  reason?: string;
}): Extract<
  RuntimeEvent,
  {
    type:
      | "plan.draft.updated"
      | "plan.proposed"
      | "plan.accepted"
      | "plan.queued"
      | "plan.activated"
      | "plan.superseded"
      | "plan.completed"
      | "plan.archived";
  }
> {
  switch (input.transition) {
    case "draft_updated":
      return {
        type: "plan.draft.updated",
        id: input.id,
        planID: input.planID,
        version: input.version,
        updatedAt: input.at,
        ...(input.reason ? { reason: input.reason } : {}),
      };
    case "proposed":
      return {
        type: "plan.proposed",
        id: input.id,
        planID: input.planID,
        version: input.version,
        proposedAt: input.at,
      };
    case "accepted":
      return {
        type: "plan.accepted",
        id: input.id,
        planID: input.planID,
        version: input.version,
        acceptedBy: input.acceptedBy ?? "user",
        acceptedAt: input.at,
      };
    case "queued":
      return {
        type: "plan.queued",
        id: input.id,
        planID: input.planID,
        version: input.version,
        queuedAt: input.at,
      };
    case "activated":
      return {
        type: "plan.activated",
        id: input.id,
        planID: input.planID,
        version: input.version,
        activatedAt: input.at,
      };
    case "superseded":
      return {
        type: "plan.superseded",
        id: input.id,
        planID: input.planID,
        version: input.version,
        reason: input.reason ?? "superseded by a newer plan",
        supersededAt: input.at,
      };
    case "completed":
      return {
        type: "plan.completed",
        id: input.id,
        planID: input.planID,
        version: input.version,
        completedAt: input.at,
      };
    case "archived":
      return {
        type: "plan.archived",
        id: input.id,
        planID: input.planID,
        version: input.version,
        archivedAt: input.at,
      };
  }
}
