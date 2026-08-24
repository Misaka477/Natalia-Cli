import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  WORK_LEDGER_CONTROLLER_SERVICE,
  type WorkLedgerController,
} from "@natalia/runtime-services";
import { projectedPlans } from "@natalia/session";
import type { RuntimeContext } from "../context";

type PlansRuntime = Pick<
  RuntimeServiceClient,
  | "planList"
  | "planCreate"
  | "planUpdate"
  | "planPropose"
  | "planAccept"
  | "planQueue"
  | "planActivate"
  | "planSupersede"
  | "planCompleted"
>;

function redactReason(reason: string | undefined) {
  if (!reason) return undefined;
  return (
    reason
      .replace(
        /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s]+/giu,
        (match) =>
          `${match.slice(0, match.indexOf("=") >= 0 ? match.indexOf("=") + 1 : match.indexOf(":") + 1)}[REDACTED]`,
      )
      .slice(0, 500) || undefined
  );
}

export function createPlansRuntime(ctx: RuntimeContext): PlansRuntime {
  function requireWorkLedger() {
    const ledger = ctx.ports.resolveService<WorkLedgerController>(
      WORK_LEDGER_CONTROLLER_SERVICE,
    );
    if (!ledger)
      throw new Error("work ledger unavailable (natalia-work-ledger)");
    return ledger;
  }

  return {
    async planList() {
      const session = ctx.ports.getSession();
      if (!session) return [];
      return projectedPlans(session.events).map((plan) => ({
        planID: plan.planID,
        version: plan.version,
        title: plan.title,
        author: plan.author,
        objective: plan.objective,
        steps: plan.steps,
        constraints: plan.constraints,
        verification: plan.verification,
        riskNotes: plan.riskNotes,
        ...(plan.relatedMailboxMessageID
          ? { relatedMailboxMessageID: plan.relatedMailboxMessageID }
          : {}),
        ...(plan.supersedesPlanID
          ? { supersedesPlanID: plan.supersedesPlanID }
          : {}),
        createdAt: plan.createdAt,
        status: plan.status,
        ...(plan.reason ? { reason: plan.reason } : {}),
      }));
    },
    async planCreate(input) {
      return ctx.ports.createPlanDraftForClient(input);
    },
    async planUpdate(input) {
      const session = ctx.ports.getSession();
      if (!session || typeof input.planID !== "string" || !input.planID)
        return { updated: false };
      const plan = projectedPlans(session.events).find(
        (candidate) =>
          candidate.planID === input.planID && candidate.status === "draft",
      );
      if (!plan) return { updated: false };
      ctx.ports.publishForSession(
        ctx.ports.getActiveExec(),
        requireWorkLedger().buildPlanTransition({
          id: `${input.planID}:draft:${plan.version + 1}`,
          planID: input.planID,
          version: plan.version + 1,
          transition: "draft_updated",
          at: new Date().toISOString(),
          reason: input.reason,
        }),
      );
      return { updated: true };
    },
    async planPropose(planID) {
      const session = ctx.ports.getSession();
      if (!session || typeof planID !== "string" || !planID)
        return { proposed: false };
      const plan = projectedPlans(session.events).find(
        (candidate) =>
          candidate.planID === planID && candidate.status === "draft",
      );
      if (!plan) return { proposed: false };
      ctx.ports.publishForSession(
        ctx.ports.getActiveExec(),
        requireWorkLedger().buildPlanTransition({
          id: `${planID}:proposed:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "proposed",
          at: new Date().toISOString(),
        }),
      );
      return { proposed: true };
    },
    async planAccept(planID) {
      const owner = ctx.ports.getActiveExec();
      if (!owner || typeof planID !== "string" || !planID)
        return { accepted: false };
      const plan = projectedPlans(owner.session.events).find(
        (candidate) =>
          candidate.planID === planID && candidate.status === "proposed",
      );
      if (!plan) return { accepted: false };
      const approvalID = `${planID}:accept:${plan.version + 1}:${crypto.randomUUID().replace(/-/gu, "").slice(0, 8)}`;
      const response = await ctx.ports.getInteractive().requirePlanAcceptance({
        approvalID,
        planID,
        title: "Accept plan",
        detail: `${plan.title}\n${plan.objective}`,
        sessionID: owner.session.id,
        permissionMode: owner.permissionMode,
        signal: owner.activeAbort?.signal,
      });
      if (!response || response.decision === "reject")
        return { accepted: false };
      ctx.ports.publishForSession(
        owner,
        requireWorkLedger().buildPlanTransition({
          id: `${planID}:accepted:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "accepted",
          at: new Date().toISOString(),
        }),
      );
      return { accepted: true };
    },
    async planQueue(planID) {
      const session = ctx.ports.getSession();
      if (!session || typeof planID !== "string" || !planID)
        return { queued: false };
      const plan = projectedPlans(session.events).find(
        (candidate) =>
          candidate.planID === planID && candidate.status === "accepted",
      );
      if (!plan) return { queued: false };
      ctx.ports.publishForSession(
        ctx.ports.getActiveExec(),
        requireWorkLedger().buildPlanTransition({
          id: `${planID}:queued:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "queued",
          at: new Date().toISOString(),
        }),
      );
      return { queued: true };
    },
    async planActivate(planID) {
      const session = ctx.ports.getSession();
      if (!session || typeof planID !== "string" || !planID)
        return { activated: false };
      const plan = projectedPlans(session.events).find(
        (candidate) =>
          candidate.planID === planID &&
          candidate.status === "queued_next_plan",
      );
      if (!plan) return { activated: false };
      ctx.ports.publishForSession(
        ctx.ports.getActiveExec(),
        requireWorkLedger().buildPlanTransition({
          id: `${planID}:activated:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "activated",
          at: new Date().toISOString(),
        }),
      );
      return { activated: true };
    },
    async planSupersede(planID, reason) {
      const session = ctx.ports.getSession();
      if (!session || typeof planID !== "string" || !planID)
        return { superseded: false };
      const plan = projectedPlans(session.events).find(
        (candidate) =>
          candidate.planID === planID &&
          candidate.status !== "completed" &&
          candidate.status !== "archived",
      );
      if (!plan) return { superseded: false };
      ctx.ports.publishForSession(
        ctx.ports.getActiveExec(),
        requireWorkLedger().buildPlanTransition({
          id: `${planID}:superseded:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "superseded",
          at: new Date().toISOString(),
          reason: redactReason(reason),
        }),
      );
      return { superseded: true };
    },
    async planCompleted(planID) {
      const session = ctx.ports.getSession();
      if (!session || typeof planID !== "string" || !planID)
        return { completed: false };
      const plan = projectedPlans(session.events).find(
        (candidate) =>
          candidate.planID === planID && candidate.status === "active",
      );
      if (!plan) return { completed: false };
      ctx.ports.publishForSession(
        ctx.ports.getActiveExec(),
        requireWorkLedger().buildPlanTransition({
          id: `${planID}:completed:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "completed",
          at: new Date().toISOString(),
        }),
      );
      return { completed: true };
    },
  };
}
