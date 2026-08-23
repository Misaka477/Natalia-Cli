import type { RuntimeServiceClient } from "@natalia/runtime-services";
import { projectedPlans } from "@natalia/session";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
import { redactToolOutput } from "./helpers";
type Surface = Pick<
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
export function createPlansSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    async planList() {
      if (!ctx.ports.getSession()) return [];
      return projectedPlans(ctx.ports.getSession()!.events).map((plan) => ({
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
    async planCreate(input: {
      title: string;
      author?: "user" | "live_chat" | "main_agent";
      objective: string;
      steps: Array<{
        id: string;
        title: string;
        detail?: string;
        verification?: string;
      }>;
      constraints?: string[];
      verification?: string[];
      riskNotes?: string[];
      relatedMailboxMessageID?: string;
      supersedesPlanID?: string;
      taskID?: string;
    }) {
      return ctx.ports.createPlanDraftForClient(input);
    },
    async planUpdate(input: {
      planID: string;
      objective?: string;
      steps?: Array<{
        id: string;
        title: string;
        detail?: string;
        verification?: string;
      }>;
      constraints?: string[];
      verification?: string[];
      riskNotes?: string[];
      reason?: string;
    }) {
      if (
        !ctx.ports.getSession() ||
        typeof input.planID !== "string" ||
        !input.planID
      )
        return { updated: false as const };
      const plan = projectedPlans(ctx.ports.getSession()!.events).find(
        (p) => p.planID === input.planID && p.status === "draft",
      );
      if (!plan) return { updated: false as const };
      ctx.ports.publishForSession(
        ctx.ports.getActiveExec(),
        ctx.ports.getWorkLedgerController().buildPlanTransition({
          id: `${input.planID}:draft:${plan.version + 1}`,
          planID: input.planID,
          version: plan.version + 1,
          transition: "draft_updated",
          at: new Date().toISOString(),
          reason: input.reason,
        }),
      );
      return { updated: true as const };
    },
    async planPropose(planID: string) {
      if (!ctx.ports.getSession() || typeof planID !== "string" || !planID)
        return { proposed: false as const };
      const plan = projectedPlans(ctx.ports.getSession()!.events).find(
        (p) => p.planID === planID && p.status === "draft",
      );
      if (!plan) return { proposed: false as const };
      ctx.ports.publishForSession(
        ctx.ports.getActiveExec(),
        ctx.ports.getWorkLedgerController().buildPlanTransition({
          id: `${planID}:proposed:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "proposed",
          at: new Date().toISOString(),
        }),
      );
      return { proposed: true as const };
    },
    async planAccept(planID: string) {
      const owner = ctx.ports.getActiveExec();
      if (!owner || typeof planID !== "string" || !planID)
        return { accepted: false as const };
      const plan = projectedPlans(owner.session.events).find(
        (p) => p.planID === planID && p.status === "proposed",
      );
      if (!plan) return { accepted: false as const };
      // Acceptance is the user's decision (§6.2: "accepted = 用户接受计划内容").
      // It goes through the same approval request/response machinery as tools:
      // the runtime waits for a human approve before recording the acceptance,
      // so a proposed plan cannot be silently accepted by the caller. A reject
      // leaves the plan proposed.
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
        return { accepted: false as const };
      ctx.ports.publishForSession(
        owner,
        ctx.ports.getWorkLedgerController().buildPlanTransition({
          id: `${planID}:accepted:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "accepted",
          at: new Date().toISOString(),
        }),
      );
      return { accepted: true as const };
    },
    async planQueue(planID: string) {
      if (!ctx.ports.getSession() || typeof planID !== "string" || !planID)
        return { queued: false as const };
      const plan = projectedPlans(ctx.ports.getSession()!.events).find(
        (p) => p.planID === planID && p.status === "accepted",
      );
      if (!plan) return { queued: false as const };
      ctx.ports.publishForSession(
        ctx.ports.getActiveExec(),
        ctx.ports.getWorkLedgerController().buildPlanTransition({
          id: `${planID}:queued:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "queued",
          at: new Date().toISOString(),
        }),
      );
      return { queued: true as const };
    },
    async planActivate(planID: string) {
      if (!ctx.ports.getSession() || typeof planID !== "string" || !planID)
        return { activated: false as const };
      const plan = projectedPlans(ctx.ports.getSession()!.events).find(
        (p) => p.planID === planID && p.status === "queued_next_plan",
      );
      if (!plan) return { activated: false as const };
      ctx.ports.publishForSession(
        ctx.ports.getActiveExec(),
        ctx.ports.getWorkLedgerController().buildPlanTransition({
          id: `${planID}:activated:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "activated",
          at: new Date().toISOString(),
        }),
      );
      return { activated: true as const };
    },
    async planSupersede(planID: string, reason?: string) {
      if (!ctx.ports.getSession() || typeof planID !== "string" || !planID)
        return { superseded: false as const };
      const plan = projectedPlans(ctx.ports.getSession()!.events).find(
        (p) =>
          p.planID === planID &&
          p.status !== "completed" &&
          p.status !== "archived",
      );
      if (!plan) return { superseded: false as const };
      ctx.ports.publishForSession(
        ctx.ports.getActiveExec(),
        ctx.ports.getWorkLedgerController().buildPlanTransition({
          id: `${planID}:superseded:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "superseded",
          at: new Date().toISOString(),
          reason:
            redactToolOutput(reason ?? "", true).slice(0, 500) || undefined,
        }),
      );
      return { superseded: true as const };
    },
    async planCompleted(planID: string) {
      if (!ctx.ports.getSession() || typeof planID !== "string" || !planID)
        return { completed: false as const };
      const plan = projectedPlans(ctx.ports.getSession()!.events).find(
        (candidate) =>
          candidate.planID === planID && candidate.status === "active",
      );
      if (!plan) return { completed: false as const };
      ctx.ports.publishForSession(
        ctx.ports.getActiveExec(),
        ctx.ports.getWorkLedgerController().buildPlanTransition({
          id: `${planID}:completed:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "completed",
          at: new Date().toISOString(),
        }),
      );
      return { completed: true as const };
    },
  };
}
