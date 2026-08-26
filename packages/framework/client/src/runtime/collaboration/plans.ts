import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  WORK_LEDGER_CONTROLLER_SERVICE,
  type WorkLedgerController,
} from "@natalia/runtime-services";
import { PERMISSION_FAMILIES } from "@natalia/contracts";
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

export function createPlansRuntime(ctx: RuntimeContext): PlansRuntime {
  function requireWorkLedger() {
    const ledger = ctx.ports.resolveService<WorkLedgerController>(
      WORK_LEDGER_CONTROLLER_SERVICE,
    );
    if (!ledger)
      throw new Error("work ledger unavailable (natalia-work-ledger)");
    return ledger;
  }

  function notifyPlanRejected(planID: string, title: string, reason?: string) {
    const owner = ctx.ports.getActiveExec();
    if (!owner) return;
    const detail = reason?.trim();
    const notice = detail
      ? `[user] rejected plan ${planID} (${title}): ${detail}. Do not hand it off. Continue helping without that plan.`
      : `[user] rejected plan ${planID} (${title}). Do not hand it off. Continue helping without that plan.`;
    ctx.ports.publishForSession(owner, {
      type: "chat.message.added",
      id: `chat:plan-reject:${planID}:${Date.now().toString(36)}`,
      messageID: `chat:plan-reject:${planID}`,
      role: "user",
      text: notice,
      at: new Date().toISOString(),
    });
    owner.pendingChatUserMessages.push({
      messageID: `chat:plan-reject:${planID}`,
      text: notice,
    });
    ctx.ports.requestNaviWake(owner);
  }

  async function acceptProposedPlan(planID: string) {
    const owner = ctx.ports.getActiveExec();
    if (!owner || typeof planID !== "string" || !planID)
      return { accepted: false as const };
    const plan = projectedPlans(owner.session.events).find(
      (candidate) =>
        candidate.planID === planID && candidate.status === "proposed",
    );
    if (!plan) return { accepted: false as const };
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
    const queued = projectedPlans(owner.session.events).find(
      (candidate) => candidate.planID === planID,
    );
    if (queued?.status === "accepted") {
      ctx.ports.publishForSession(
        owner,
        requireWorkLedger().buildPlanTransition({
          id: `${planID}:queued:${queued.version + 1}`,
          planID,
          version: queued.version + 1,
          transition: "queued",
          at: new Date().toISOString(),
        }),
      );
    }
    const notice = `[user] accepted plan ${planID} (${plan.title}). Send next_plan_handoff with this relatedPlanID now so Natalia can start.`;
    ctx.ports.publishForSession(owner, {
      type: "chat.message.added",
      id: `chat:plan-accept:${planID}:${Date.now().toString(36)}`,
      messageID: `chat:plan-accept:${planID}`,
      role: "user",
      text: notice,
      at: new Date().toISOString(),
    });
    owner.pendingChatUserMessages.push({
      messageID: `chat:plan-accept:${planID}`,
      text: notice,
    });
    ctx.ports.requestNaviWake(owner);
    return { accepted: true as const };
  }

  async function supersedePlan(planID: string, reason?: string) {
    const session = ctx.ports.getSession();
    if (!session || typeof planID !== "string" || !planID)
      return { superseded: false as const };
    const plan = projectedPlans(session.events).find(
      (candidate) =>
        candidate.planID === planID &&
        candidate.status !== "completed" &&
        candidate.status !== "archived",
    );
    if (!plan) return { superseded: false as const };
    const owner = ctx.ports.getActiveExec();
    const safeReason = redactReason(reason);
    ctx.ports.publishForSession(
      owner,
      requireWorkLedger().buildPlanTransition({
        id: `${planID}:superseded:${plan.version + 1}`,
        planID,
        version: plan.version + 1,
        transition: "superseded",
        at: new Date().toISOString(),
        reason: safeReason,
      }),
    );
    notifyPlanRejected(planID, plan.title, safeReason);
    return { superseded: true as const };
  }

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
        ...(plan.taskID ? { taskID: plan.taskID } : {}),
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
      const owner = ctx.ports.getActiveExec();
      ctx.ports.publishForSession(
        owner,
        requireWorkLedger().buildPlanTransition({
          id: `${planID}:proposed:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "proposed",
          at: new Date().toISOString(),
        }),
      );
      if (owner) {
        const approvalID = `${planID}:accept:${plan.version + 1}:${crypto.randomUUID().replace(/-/gu, "").slice(0, 8)}`;
        void ctx.ports
          .getInteractive()
          .requirePlanAcceptance({
            approvalID,
            planID,
            title: "Accept Navi's plan",
            preview: plan.title,
            detail: `${plan.title}\n${plan.objective}`,
            sessionID: owner.session.id,
            permissionMode: owner.permissionMode,
            permissionFamily: PERMISSION_FAMILIES.planning,
          })
          .then(async (response) => {
            if (!response || response.decision === "reject") {
              await supersedePlan(planID, response?.feedback?.trim());
              return;
            }
            await acceptProposedPlan(planID);
          })
          .catch(() => undefined);
      }
      return { proposed: true };
    },
    async planAccept(planID) {
      return await acceptProposedPlan(planID);
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
      return await supersedePlan(planID, reason);
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
