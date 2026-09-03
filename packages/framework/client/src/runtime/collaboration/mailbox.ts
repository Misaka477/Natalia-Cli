import type { RuntimeServiceClient } from "@natalia/runtime-services";
import { projectedMailboxMessages } from "@natalia/session";
import { buildMailboxStatus } from "@natalia/runtime-services";
import type { RuntimeContext } from "../context";
type Surface = Pick<
  RuntimeServiceClient,
  | "mailboxList"
  | "mailboxSend"
  | "mailboxDeliver"
  | "mailboxAcknowledge"
  | "mailboxDefer"
  | "mailboxSupersede"
>;
function redactToolOutput(output: string, redact: boolean | undefined) {
  if (!redact) return output;
  return output.replace(
    /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s]+/giu,
    (match) =>
      `${match.slice(0, match.indexOf("=") >= 0 ? match.indexOf("=") + 1 : match.indexOf(":") + 1)}[REDACTED]`,
  );
}

async function mailboxExec(ctx: RuntimeContext, sessionID?: string) {
  if (sessionID)
    return (
      ctx.ports
        .getExecutionBySession()
        .get(sessionID as import("@natalia/contracts").SessionID) ??
      (await ctx.ports.ensureExecution(
        sessionID as import("@natalia/contracts").SessionID,
      ))
    );
  return ctx.ports.getActiveExec();
}
export function createMailboxSurface(ctx: RuntimeContext): Surface {
  return {
    async mailboxList(sessionID?: string) {
      const exec = await mailboxExec(ctx, sessionID);
      if (!exec) return [];
      return projectedMailboxMessages(exec.session.events).map(
        (m) => ({
          messageID: m.messageID,
          source: m.source,
          priority: m.priority,
          intent: m.intent,
          text: m.text,
          safeSummary: m.safeSummary,
          ...(m.relatedPlanID ? { relatedPlanID: m.relatedPlanID } : {}),
          deliveryPolicy: m.deliveryPolicy,
          createdAt: m.createdAt,
          status: m.status,
          ...(m.reason ? { reason: m.reason } : {}),
        }),
      );
    },
    async mailboxSend(input: {
      source?: "user_via_live_chat" | "system";
      priority?: "normal" | "high" | "urgent";
      intent: string;
      text: string;
      safeSummary?: string;
      relatedPlanID?: string;
      deliveryPolicy?: string;
      sessionID?: string;
    }) {
      return ctx.ports.enqueueMailboxForClient(input);
    },
    async mailboxDeliver(messageID: string, sessionID?: string) {
      const exec = await mailboxExec(ctx, sessionID);
      if (!exec || typeof messageID !== "string" || !messageID)
        return { delivered: false as const };
      const message = projectedMailboxMessages(
        exec.session.events,
      ).find((m) => m.messageID === messageID && m.status === "queued");
      if (!message) return { delivered: false as const };
      ctx.ports.publishForSession(
        exec,
        buildMailboxStatus({
          id: `${messageID}:delivered:${ctx.ports.nextMailboxSequence()}`,
          messageID,
          status: "delivered",
          at: new Date().toISOString(),
        }),
      );
      return { delivered: true as const };
    },
    async mailboxAcknowledge(messageID: string, sessionID?: string) {
      const exec = await mailboxExec(ctx, sessionID);
      if (!exec || typeof messageID !== "string" || !messageID)
        return { acknowledged: false as const };
      const message = projectedMailboxMessages(
        exec.session.events,
      ).find((m) => m.messageID === messageID && m.status === "delivered");
      if (!message) return { acknowledged: false as const };
      ctx.ports.publishForSession(
        exec,
        buildMailboxStatus({
          id: `${messageID}:acknowledged:${ctx.ports.nextMailboxSequence()}`,
          messageID,
          status: "acknowledged",
          at: new Date().toISOString(),
        }),
      );
      return { acknowledged: true as const };
    },
    async mailboxDefer(messageID: string, reason?: string, sessionID?: string) {
      const exec = await mailboxExec(ctx, sessionID);
      if (!exec || typeof messageID !== "string" || !messageID)
        return { deferred: false as const };
      const message = projectedMailboxMessages(
        exec.session.events,
      ).find((m) => m.messageID === messageID && m.status === "queued");
      if (!message) return { deferred: false as const };
      ctx.ports.publishForSession(
        exec,
        buildMailboxStatus({
          id: `${messageID}:deferred:${ctx.ports.nextMailboxSequence()}`,
          messageID,
          status: "deferred",
          at: new Date().toISOString(),
          reason:
            redactToolOutput(reason ?? "", true).slice(0, 500) || undefined,
        }),
      );
      return { deferred: true as const };
    },
    async mailboxSupersede(messageID: string, reason?: string, sessionID?: string) {
      const exec = await mailboxExec(ctx, sessionID);
      if (!exec || typeof messageID !== "string" || !messageID)
        return { superseded: false as const };
      const message = projectedMailboxMessages(
        exec.session.events,
      ).find((m) => m.messageID === messageID && m.status === "queued");
      if (!message) return { superseded: false as const };
      ctx.ports.publishForSession(
        exec,
        buildMailboxStatus({
          id: `${messageID}:superseded:${ctx.ports.nextMailboxSequence()}`,
          messageID,
          status: "superseded",
          at: new Date().toISOString(),
          reason:
            redactToolOutput(reason ?? "", true).slice(0, 500) || undefined,
        }),
      );
      return { superseded: true as const };
    },
  };
}
