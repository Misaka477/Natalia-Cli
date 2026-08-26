/**
 * Collaboration mailbox and plan drafting — runtime/collaboration/
 * mailbox-plans.ts.
 *
 * The `collab_chat` tool constructor, the durable mailbox intent queue writer,
 * and the plan draft writer. Reads live state through `RuntimeContext` at call
 * time.
 */
import {
  projectedMailboxMessages,
  projectedPlans,
  sessionRunCoordinator,
} from "@natalia/session";
import {
  buildMailboxQueued,
  buildMailboxStatus,
} from "@natalia/runtime-services";
import {
  WORK_LEDGER_CONTROLLER_SERVICE,
  type WorkLedgerController,
} from "@natalia/runtime-services";
import type { RuntimeTool } from "@natalia/tools";
import type { SessionID } from "@natalia/contracts";
import {
  COLLABORATION_SERVICE,
  type CollaborationService,
} from "@natalia/collaboration";
import type { RuntimeContext } from "../context";
import type { SessionExecutionState } from "../context";

export function createMailboxPlans(ctx: RuntimeContext) {
  return {
    createCollabChatTool,
    enqueueMailboxMessage,
    cancelMailboxMessage,
    createPlanDraft,
  };

  function collaborationMaxAutoRounds() {
    return (
      ctx.ports.getTsRuntimeConfig()?.runtime.collaboration.maxAutoRounds ?? 3
    );
  }

  function createCollabChatTool(
    sender: "main_agent" | "live_chat",
    boundExec?: SessionExecutionState,
  ): RuntimeTool {
    const {
      getExecutionBySession,
      redactToolOutput,
      requestNaviWake,
      wakeMainForCollaboration,
    } = ctx.ports;
    return {
      name: "collab_chat",
      description:
        sender === "main_agent"
          ? "Send or directly reply to an informal message with Navi. A new message has no messageID and always requests one reply; omit continueConversation. To answer a REPLY_REQUIRED message, provide its exact messageID; having that messageID means Navi already replied to you. Only on a reply, continueConversation=true requests another reply and false closes the conversation. If your reply asks a question, invites her to continue, or says you will wait for her response or follow-up, you must set it to true. Automatic exchanges are capped by runtime.collaboration.maxAutoRounds. This is never a user directive or work-state decision."
          : "Send or directly reply to an informal message with Natalia. A new message has no messageID and always requests one reply; omit continueConversation. To answer a REPLY_REQUIRED message, provide its exact messageID; having that messageID means Natalia already replied to you. Only on a reply, continueConversation=true requests another reply and false closes the conversation. If your reply asks a question, invites her to continue, or says you will wait for her response or follow-up, you must set it to true. Automatic exchanges are capped by runtime.collaboration.maxAutoRounds. Never use this instead of mailbox_send for a confirmed user directive.",
      requiresApproval: false,
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          messageID: { type: "string" },
          continueConversation: {
            type: "boolean",
            description:
              "Only for a reply with messageID. true requests another reply; false closes the conversation. Omit for a new message, which always requests one reply. Must be true when the reply text asks a question, invites continuation, or says you are waiting for more.",
          },
        },
        required: ["text"],
        additionalProperties: false,
      },
      async execute(parsed, context) {
        const args = parsed as {
          text?: string;
          messageID?: string;
          continueConversation?: boolean;
        };
        if (typeof args.text !== "string" || !args.text.trim())
          return "collab_chat requires text";
        const owner =
          boundExec ??
          (context.sessionID
            ? getExecutionBySession().get(context.sessionID as SessionID)
            : undefined);
        if (!owner) return "no session";
        const suppliedID = args.messageID?.trim();
        const wantsContinuation = args.continueConversation === true;
        const service = ctx.ports.resolveService<CollaborationService>(
          COLLABORATION_SERVICE,
        );
        if (!service) return "collaboration service unavailable";
        let result;
        try {
          result = await service.send({
            sessionID: owner.session.id as SessionID,
            kind: "chat",
            from: sender,
            text: redactToolOutput(args.text, true),
            ...(suppliedID ? { replyToID: suppliedID } : {}),
            ...(suppliedID
              ? { continueConversation: wantsContinuation }
              : args.continueConversation !== undefined
                ? { continueConversation: args.continueConversation }
                : {}),
          });
        } catch (error) {
          return error instanceof Error ? error.message : String(error);
        }
        if (result.wake.recipient === "live_chat") requestNaviWake(owner);
        else wakeMainForCollaboration(owner, result.message.id, "chat message");
        return JSON.stringify({
          sent: true,
          messageID: result.message.id,
          threadID: result.message.threadID,
          round:
            result.message.kind === "chat" ? result.message.round : undefined,
          expectsReply: result.message.expectsReply,
          receivedReply: Boolean(suppliedID),
          continuationRequested: wantsContinuation,
          conversationClosed: !result.message.expectsReply,
          ...(wantsContinuation && !result.message.expectsReply
            ? {
                autoRoundLimitReached: true,
                maxAutoRounds: collaborationMaxAutoRounds(),
              }
            : {}),
        });
      },
    } as RuntimeTool;
  }

  async function enqueueMailboxMessage(
    input: {
      source?: "user_via_live_chat" | "system";
      priority?: "normal" | "high" | "urgent";
      intent: string;
      text: string;
      safeSummary?: string;
      relatedPlanID?: string;
      deliveryPolicy?: string;
    },
    targetExec?: SessionExecutionState,
  ) {
    const {
      getReady,
      getActiveExec,
      publishForSession,
      redactToolOutput,
      nextMailboxSequence,
      scheduleInternalWake,
    } = ctx.ports;
    await getReady();
    const owner = targetExec ?? getActiveExec();
    if (!owner) return { queued: false as const };
    if (
      typeof input.intent !== "string" ||
      input.intent.trim().length === 0 ||
      typeof input.text !== "string" ||
      input.text.trim().length === 0
    )
      return { queued: false as const };
    if (input.intent === "next_plan_handoff") {
      const planID = input.relatedPlanID?.trim();
      if (!planID)
        return {
          queued: false as const,
          reason: "next_plan_handoff requires relatedPlanID",
        };
      const plan = projectedPlans(owner.session.events).find(
        (candidate) => candidate.planID === planID,
      );
      if (
        !plan ||
        plan.status === "superseded" ||
        plan.status === "completed" ||
        plan.status === "archived"
      )
        return {
          queued: false as const,
          reason: `no live plan ${planID} for next_plan_handoff`,
        };
    }
    const fingerprint = mailboxFingerprint(
      input.intent,
      input.text,
      input.relatedPlanID,
    );
    const duplicate = projectedMailboxMessages(owner.session.events).find(
      (message) =>
        (message.status === "queued" || message.status === "delivered") &&
        mailboxFingerprint(
          message.intent,
          message.text,
          message.relatedPlanID,
        ) === fingerprint,
    );
    if (duplicate)
      return {
        queued: false as const,
        messageID: duplicate.messageID,
        reason: "duplicate mailbox intent already pending",
      };
    const now = new Date();
    const messageID = `mailbox:${Date.now().toString(36)}:${nextMailboxSequence()}`;
    publishForSession(
      owner,
      buildMailboxQueued({
        id: `${messageID}:queued`,
        messageID,
        source: input.source ?? "user_via_live_chat",
        priority: input.priority ?? "normal",
        intent: input.intent as
          | "clarification"
          | "constraint"
          | "reprioritize"
          | "pause"
          | "cancel"
          | "request_report"
          | "proposed_change"
          | "next_plan_handoff",
        text: redactToolOutput(input.text, true),
        safeSummary:
          redactToolOutput(input.safeSummary ?? input.text, true).slice(
            0,
            500,
          ) || "mailbox message queued",
        ...(input.relatedPlanID ? { relatedPlanID: input.relatedPlanID } : {}),
        deliveryPolicy: (input.deliveryPolicy ?? "next_safe_boundary") as
          | "next_safe_boundary"
          | "before_next_tool"
          | "before_next_side_effect"
          | "immediate_control",
        createdAt: now.toISOString(),
      }),
    );
    // Wake the main agent when it is idle: a directive sent through the Live
    // Work Chat must reach it without waiting for the next manual turn, so it
    // is simulated as a direct submission (P8 §7 — the Chat is the steering
    // channel, not a queue that idles silently until the user types again).
    const coordinator = sessionRunCoordinator(owner.session.id as SessionID);
    if (!coordinator.active) {
      scheduleInternalWake(owner, {
        id: `turn_mailbox_${messageID.replace(/[^a-zA-Z0-9]/gu, "_")}`,
        text: `(internal mailbox wake: read pending user intents, including message ${messageID}. This is not a user message.)`,
        delivery: "steer",
      });
    }
    return { queued: true as const, messageID };
  }

  async function cancelMailboxMessage(
    messageID: string,
    reason?: string,
    targetExec?: SessionExecutionState,
  ) {
    const owner = targetExec ?? ctx.ports.getActiveExec();
    if (!owner || !messageID.trim()) return { cancelled: false as const };
    const message = projectedMailboxMessages(owner.session.events).find(
      (candidate) => candidate.messageID === messageID,
    );
    if (
      !message ||
      (message.status !== "queued" && message.status !== "delivered")
    )
      return { cancelled: false as const };
    ctx.ports.publishForSession(
      owner,
      buildMailboxStatus({
        id: `${messageID}:superseded:${ctx.ports.nextMailboxSequence()}`,
        messageID,
        status: "superseded",
        at: new Date().toISOString(),
        reason:
          ctx.ports
            .redactToolOutput(reason ?? "cancelled by live chat", true)
            .slice(0, 500) || "cancelled by live chat",
      }),
    );
    return { cancelled: true as const, messageID };
  }

  async function createPlanDraft(
    input: {
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
    },
    targetExec: SessionExecutionState | undefined = ctx.ports.getActiveExec(),
  ) {
    const { publishForSession, nextPlanSequence } = ctx.ports;
    const workLedgerController = ctx.ports.resolveService<WorkLedgerController>(
      WORK_LEDGER_CONTROLLER_SERVICE,
    );
    if (!workLedgerController)
      throw new Error("work ledger unavailable (natalia-work-ledger)");
    if (!targetExec) return { created: false as const };
    if (
      typeof input.title !== "string" ||
      input.title.trim().length === 0 ||
      typeof input.objective !== "string" ||
      input.objective.trim().length === 0 ||
      !Array.isArray(input.steps) ||
      input.steps.length === 0
    )
      return { created: false as const };
    const now = new Date();
    const planID = `plan:${Date.now().toString(36)}:${nextPlanSequence()}`;
    publishForSession(
      targetExec,
      workLedgerController.buildPlanDraftCreated({
        id: `${planID}:draft:0`,
        planID,
        version: 1,
        title: input.title,
        author: input.author ?? "live_chat",
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
        createdAt: now.toISOString(),
      }),
    );
    return { created: true as const, planID };
  }
}

function mailboxFingerprint(
  intent: string,
  text: string,
  relatedPlanID?: string,
) {
  return `${intent}\n${relatedPlanID ?? ""}\n${text.trim()}`;
}
