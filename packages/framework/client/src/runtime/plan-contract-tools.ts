/**
 * Model-facing WorkContract tools — runtime/plan-contract-tools.ts.
 *
 * `plan_propose` is the proposal half of EI §8.4: the model drafts the
 * scope/verification/constraints it extracted from the plan document it just
 * wrote (grounding, not invention), the runtime validates the draft, and the
 * user approves it once through the plan-acceptance gate. The gate is the only
 * user-tier confirmation point that matters for drift: without it, "偏移" has
 * no reference frame.
 *
 * `work_contract_read` is the read half (§8.4): the three-state view (current /
 * draft / none) projected from the journal, plus the stale marker a plan
 * document change raises on an unapproved draft.
 */
import { projectedWorkContracts } from "@natalia/session";
import { WORK_LEDGER_CONTROLLER_SERVICE } from "@natalia/runtime-services";
import type { RuntimeTool, WorkLedgerController } from "./context";
import type { RuntimeContext, SessionExecutionState } from "./context";

function resolveExec(
  ctx: RuntimeContext,
  sessionID?: string,
): SessionExecutionState | undefined {
  const exec = sessionID
    ? ctx.ports
        .getExecutionBySession()
        .get(sessionID as import("@natalia/contracts").SessionID)
    : undefined;
  return exec ?? ctx.ports.getActiveExec();
}

function requireWorkLedger(
  ctx: RuntimeContext,
): WorkLedgerController | undefined {
  return ctx.ports.resolveService<WorkLedgerController>(
    WORK_LEDGER_CONTROLLER_SERVICE,
  );
}

/**
 * The proposal tool: validate → draft → user gate → accept (EI §8.4).
 *
 * Repeatable: a rejected draft leaves the draft in the journal and returns the
 * rejection as feedback, so the model can re-propose with the user's notes
 * folded in. The acceptance is written once per approval — a plan document
 * change invalidates the *draft* (the projection marks it stale), never a
 * user-approved contract.
 */
export function createPlanProposeTool(ctx: RuntimeContext): RuntimeTool {
  return {
    name: "plan_propose",
    description:
      "Propose the WorkContract (scope/verification/constraints) for a marked plan document and request the user's approval. Extract the fields from the plan you just wrote — grounding, not invention. Placeholder entries (single characters or pure generic words like all/everything/相关) are rejected; an all-empty proposal is accepted as unverifiable (advisory-only). This tool blocks until the user Allow / Reject; on Reject you get the feedback and can re-propose. When accepted, hand the plan off with mailbox_send next_plan_handoff.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        planID: {
          type: "string",
          description:
            "The marked plan's planID (from plan_doc_list or plan_create).",
        },
        scope: {
          type: "array",
          items: { type: "string" },
          description:
            "What the plan covers, extracted from the plan document (concrete entries only).",
        },
        verification: {
          type: "array",
          items: { type: "string" },
          description:
            "How the work will be verified, extracted from the plan document (concrete entries only).",
        },
        constraints: {
          type: "array",
          items: { type: "string" },
          description:
            "Constraints the work must respect, extracted from the plan document (concrete entries only).",
        },
      },
      required: ["planID"],
      additionalProperties: false,
    },
    async execute(parsed, context) {
      const args = parsed as {
        planID?: string;
        scope?: string[];
        verification?: string[];
        constraints?: string[];
      };
      const exec = resolveExec(ctx, context.sessionID);
      if (!exec) return "no session";
      const planID = args.planID?.trim();
      if (!planID)
        return "plan_propose requires planID; use plan_doc_list to find an available plan document";
      const plan = ctx.ports.planDocRuntime.planDocByID(planID);
      if (!plan)
        return `no marked plan ${planID}; use plan_doc_list to find an available plan document`;
      const ledger = requireWorkLedger(ctx);
      if (!ledger) return "work ledger unavailable";
      const interactive = ctx.ports.getInteractive();
      const fields = {
        ...(args.scope ? { scope: args.scope } : {}),
        ...(args.verification ? { verification: args.verification } : {}),
        ...(args.constraints ? { constraints: args.constraints } : {}),
      };
      // EI §8.2 runtime validation: placeholders are rejected, not guessed.
      const problems = ledger.validateWorkContractFields(fields);
      if (problems.length)
        return JSON.stringify({
          accepted: false,
          problems,
          reason:
            "the draft carried placeholder or empty entries; re-propose with concrete entries extracted from the plan document",
        });
      // A draft with no extractable fields is still proposeable — it lands as
      // an unverifiable acceptance (advisory-only judgment).
      const unverifiable =
        !(fields.scope?.length ?? false) &&
        !(fields.verification?.length ?? false) &&
        !(fields.constraints?.length ?? false);
      const now = new Date().toISOString();
      ctx.ports.publishForSession(
        exec,
        ledger.buildWorkContractDrafted({
          id: `${planID}:work-contract:${ctx.ports.nextPlanSequence()}`,
          planID,
          // The plan document has no persisted version counter yet; the draft
          // binds to the plan's current document state and the projection
          // marks it stale when the document changes.
          planVersion: 1,
          ...fields,
          draftedAt: now,
        }),
      );
      const previewLines = [
        `scope: ${(fields.scope ?? []).join("; ") || "(unverifiable)"}`,
        `verification: ${(fields.verification ?? []).join("; ") || "(unverifiable)"}`,
        `constraints: ${(fields.constraints ?? []).join("; ") || "(unverifiable)"}`,
      ];
      const response = await interactive.requirePlanAcceptance({
        approvalID: `work_contract:${planID}:${ctx.ports.nextPlanSequence()}`,
        planID,
        title: `Approve the work contract for ${planID}`,
        preview: previewLines.join("\n"),
        detail: `${plan.title}\n\n${previewLines.join("\n")}`,
        scope: "work_contract",
        sessionID: exec.session.id,
        signal: context.signal,
      });
      if (!response || response.decision === "reject")
        return JSON.stringify({
          accepted: false,
          reason: `rejected${response?.feedback ? `: ${response.feedback}` : ""}`,
          feedback: response?.feedback,
          hint: "the draft stays on the journal; re-propose with the feedback folded in",
        });
      ctx.ports.publishForSession(
        exec,
        ledger.buildWorkContractAccepted({
          id: `${planID}:work-contract-accepted:${ctx.ports.nextPlanSequence()}`,
          planID,
          planVersion: 1,
          ...fields,
          acceptedAt: new Date().toISOString(),
          ...(unverifiable ? { unverifiable: true } : {}),
        }),
      );
      return JSON.stringify({
        accepted: true,
        planID,
        ...(unverifiable ? { unverifiable: true } : {}),
        hint: "hand the plan off with mailbox_send next_plan_handoff with this relatedPlanID",
      });
    },
  };
}

/**
 * The read half (EI §8.4): the session's projected WorkContract for a plan —
 * `current` (user-approved, the R drift is judged against), `draft` (with the
 * stale marker a plan document change raises), or `none`.
 */
export function createWorkContractReadTool(ctx: RuntimeContext): RuntimeTool {
  return {
    name: "work_contract_read",
    description:
      "Read the session's WorkContract for a plan: the user-approved contract (current), the latest draft (with a stale marker when the plan document changed after it), or none. Use it to check what the user committed to before judging drift or handing off.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        planID: {
          type: "string",
          description: "The planID to read the contract for.",
        },
      },
      required: ["planID"],
      additionalProperties: false,
    },
    async execute(parsed, context) {
      const args = parsed as { planID?: string };
      const exec = resolveExec(ctx, context.sessionID);
      if (!exec) return "no session";
      const planID = args.planID?.trim();
      if (!planID) return "work_contract_read requires planID";
      const contract = projectedWorkContracts(exec.session.events).find(
        (candidate) => candidate.planID === planID,
      );
      if (!contract) return JSON.stringify({ planID, status: "none" });
      return JSON.stringify({
        planID,
        status: contract.status,
        version: contract.version,
        ...(contract.scope ? { scope: contract.scope } : {}),
        ...(contract.verification
          ? { verification: contract.verification }
          : {}),
        ...(contract.constraints ? { constraints: contract.constraints } : {}),
        ...(contract.stale ? { stale: true } : {}),
        ...(contract.unverifiable ? { unverifiable: true } : {}),
        ...(contract.acceptedAt ? { acceptedAt: contract.acceptedAt } : {}),
      });
    },
  };
}
