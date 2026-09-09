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
  projectedPlanDocs,
  sessionRunCoordinator,
} from "@natalia/session";
import {
  buildMailboxQueued,
  buildMailboxStatus,
} from "@natalia/runtime-services";
import type { RuntimeTool } from "@natalia/tools";
import type { CollaborationParticipant, SessionID } from "@natalia/contracts";
import {
  COLLABORATION_SERVICE,
  type CollaborationService,
} from "@natalia/collaboration";
import type { RuntimeContext } from "../context";
import { ensureSessionFullEvents } from "../session-full-events";
import type { SessionExecutionState } from "../context";

export function createMailboxPlans(ctx: RuntimeContext) {
  function planDocsFor(exec: SessionExecutionState | undefined) {
    const snapshot = exec?.collabSnapshot;
    if (snapshot && snapshot.eventCount === (exec?.session.events.length ?? -1))
      return snapshot.planDocs;
    return projectedPlanDocs(exec?.session.events ?? []);
  }

  return {
    createCollabChatTool,
    enqueueMailboxMessage,
    cancelMailboxMessage,
  };

  function collaborationMaxAutoRounds() {
    return (
      ctx.ports.getTsRuntimeConfig()?.runtime.collaboration.maxAutoRounds ?? 3
    );
  }

  function createCollabChatTool(
    sender: CollaborationParticipant,
    boundExec?: SessionExecutionState,
  ): RuntimeTool {
    console.log("[collab-chat-tool] create", {
      sender,
      hasExec: Boolean(boundExec),
    });
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
          : sender === "nia"
            ? 'Send or directly reply to an informal message with Natalia or Navi. Use to report audit findings, request continuation, or ask for context. A new message has no messageID and always requests one reply; omit continueConversation. To answer a REPLY_REQUIRED message, provide its exact messageID. Reply example: { "text": "具体缺口...", "messageID": "collab:chat:...", "continueConversation": true }. If you do not pass the exact messageID, collab_chat will refuse the new chat.'
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
          return "collab_chat requires a non-empty text";
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
        const cleanText = redactToolOutput(args.text, true);
        let result;
        try {
          result = await service.send({
            sessionID: owner.session.id as SessionID,
            kind: "chat",
            from: sender,
            text: cleanText,
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
        console.log("[collab-chat-tool] result", {
          sender,
          messageID: result.message.id,
          threadID: result.message.threadID,
          recipient: result.wake.recipient,
          messageTo: result.message.to,
          expectsReply: result.message.expectsReply,
          text: args.text.slice(0, 120),
        });
        if (result.wake.recipient === "live_chat") {
          console.log("[navi-wake-trigger] collab_chat to live_chat", {
            sender,
            messageID: result.message.id,
            recipient: result.wake.recipient,
          });
          requestNaviWake(owner);
        } else if (result.wake.recipient === "nia") {
          console.log("[nia-wake-trigger] collab_chat to nia", {
            sender,
            messageID: result.message.id,
          });
          ctx.ports.requestNiaWake(owner);
        } else
          wakeMainForCollaboration(
            owner,
            result.message.id,
            "chat message",
            sender === "nia" ? "Nia" : "Navi",
          );
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
    await ensureSessionFullEvents(ctx, owner);
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
      const plan = planDocsFor(owner).find(
        (candidate) => candidate.planID === planID,
      );
      if (!plan)
        return {
          queued: false as const,
          reason: `no marked plan ${planID} for next_plan_handoff`,
        };
      if (plan.status === "completed")
        return {
          queued: false as const,
          reason: `plan ${planID} is already completed`,
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
    // E2: a next_plan_handoff is a formal Main Agent handoff. Capture a
    // checkpoint before the mailbox is queued/woken so the user can restore
    // the exact pre-handoff Main Agent context and workspace state.
    if (input.intent === "next_plan_handoff") {
      try {
        const checkpointController =
          await ctx.ports.initializeCheckpointController(owner);
        if (checkpointController?.isEnabled()) {
          await checkpointController.createCheckpoint({
            reason: "manual",
            context: owner.context,
            step: owner.context.journalStatus().messageCount,
            stepID: `mailbox:${messageID}`,
            model: owner.provider?.model,
            status: "next_plan_handoff",
          });
        }
      } catch (error) {
        ctx.ports.publishForSession(owner, {
          type: "diagnostic",
          level: "warning",
          message: `plan handoff checkpoint failed for ${messageID}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        });
      }
    }
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
    if (input.intent === "next_plan_handoff" && input.relatedPlanID) {
      await ctx.ports.planDocRuntime.planDocUpdateStatus({
        planID: input.relatedPlanID,
        status: "handed_off",
        sessionID: owner.session.id,
      });
    }
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
    await ensureSessionFullEvents(ctx, owner);
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
}

function mailboxFingerprint(
  intent: string,
  text: string,
  relatedPlanID?: string,
) {
  return `${intent}\n${relatedPlanID ?? ""}\n${text.trim()}`;
}
