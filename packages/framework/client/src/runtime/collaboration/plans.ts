import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  WORK_LEDGER_CONTROLLER_SERVICE,
  type WorkLedgerController,
} from "@natalia/runtime-services";
import { PERMISSION_FAMILIES } from "@natalia/contracts";
import { projectedPlans, type ProjectedPlan } from "@natalia/session";
import type { RuntimeContext } from "../context";

type PlanProposeOutcome = {
  proposed: boolean;
  decision?: "once" | "session" | "reject" | "cancelled";
  feedback?: string;
};

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
> & {
  proposeAndWait(
    planID: string,
    options?: { signal?: AbortSignal; blockingCaller?: boolean },
  ): Promise<PlanProposeOutcome>;
};

export function createPlansRuntime(ctx: RuntimeContext): PlansRuntime {
  function requireWorkLedger() {
    const ledger = ctx.ports.resolveService<WorkLedgerController>(
      WORK_LEDGER_CONTROLLER_SERVICE,
    );
    if (!ledger)
      throw new Error("work ledger unavailable (natalia-work-ledger)");
    return ledger;
  }

  function notifyPlanRejected(
    planID: string,
    title: string,
    reason?: string,
    notifyChat = true,
  ) {
    if (!notifyChat) return;
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

  async function acceptProposedPlan(
    planID: string,
    options?: { notifyChat?: boolean },
  ) {
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
    if (options?.notifyChat === false) return { accepted: true as const };
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

  async function supersedePlan(
    planID: string,
    reason?: string,
    options?: { notifyChat?: boolean },
  ) {
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
    notifyPlanRejected(
      planID,
      plan.title,
      safeReason,
      options?.notifyChat !== false,
    );
    return { superseded: true as const };
  }

  function formatPlanApprovalDetail(plan: ProjectedPlan) {
    const lines = [
      `Plan ${plan.planID}`,
      `Title: ${plan.title}`,
      `Objective: ${plan.objective}`,
    ];
    if (plan.steps.length) {
      lines.push("Steps:");
      for (const step of plan.steps) {
        const extras = [
          step.detail,
          step.verification ? `verify: ${step.verification}` : undefined,
        ].filter(Boolean);
        lines.push(
          extras.length
            ? `- ${step.id}: ${step.title} (${extras.join("; ")})`
            : `- ${step.id}: ${step.title}`,
        );
      }
    }
    if (plan.constraints.length)
      lines.push("Constraints:", ...plan.constraints.map((item) => `- ${item}`));
    if (plan.verification.length)
      lines.push(
        "Verification:",
        ...plan.verification.map((item) => `- ${item}`),
      );
    if (plan.riskNotes.length)
      lines.push("Risks:", ...plan.riskNotes.map((item) => `- ${item}`));
    if (plan.taskID) lines.push(`Task: ${plan.taskID}`);
    return lines.join("\n");
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

  async function proposeAndWait(
    planID: string,
    options?: { signal?: AbortSignal; blockingCaller?: boolean },
  ): Promise<PlanProposeOutcome> {
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
    if (!owner) return { proposed: true };
    const approvalID = `${planID}:accept:${plan.version + 1}:${crypto.randomUUID().replace(/-/gu, "").slice(0, 8)}`;
    let response:
      | Awaited<
          ReturnType<
            ReturnType<typeof ctx.ports.getInteractive>["requirePlanAcceptance"]
          >
        >
      | undefined;
    try {
      response = await ctx.ports.getInteractive().requirePlanAcceptance({
        approvalID,
        planID,
        title: "Accept Navi's plan",
        preview: plan.title,
        detail: formatPlanApprovalDetail(plan),
        sessionID: owner.session.id,
        permissionMode: owner.permissionMode,
        permissionFamily: PERMISSION_FAMILIES.planning,
        signal: options?.signal,
      });
    } catch {
      return { proposed: true, decision: "cancelled" as const };
    }
    if (!response || response.decision === "reject") {
      await supersedePlan(planID, response?.feedback?.trim(), {
        notifyChat: !options?.blockingCaller,
      });
      return {
        proposed: true,
        decision: "reject" as const,
        ...(response?.feedback?.trim()
          ? { feedback: response.feedback.trim() }
          : {}),
      };
    }
    await acceptProposedPlan(planID, { notifyChat: !options?.blockingCaller });
    return { proposed: true, decision: response.decision };
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
      const outcome = await proposeAndWait(planID);
      return { proposed: outcome.proposed };
    },
    proposeAndWait,
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
