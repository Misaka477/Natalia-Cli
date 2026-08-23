/**
 * Collaboration mailbox and plan drafting — runtime/collaboration/
 * mailbox-plans.ts.
 *
 * The `collab_chat` tool constructor, the durable mailbox intent queue writer,
 * and the plan draft writer. Reads live state through `RuntimeContext` at call
 * time.
 */
import { projectedCollabMessages } from "@natalia/session";
import { sessionRunCoordinator } from "@natalia/session";
import { buildMailboxQueued } from "@natalia/runtime-services";
import type { RuntimeTool } from "@natalia/tools";
import type { SessionID } from "@natalia/contracts";
import type { RuntimeContext } from "../context";
import type { SessionExecutionState } from "../context";

export function createMailboxPlans(ctx: RuntimeContext) {
  return {
    createCollabChatTool,
    enqueueMailboxMessage,
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
      publishForSession,
      redactToolOutput,
      nextCollabSequence,
      requestNaviWake,
      wakeMainForCollaboration,
    } = ctx.ports;
    const collabSequence = nextCollabSequence;
    return {
      name: "collab_chat",
      description:
        sender === "main_agent"
          ? "Send or directly reply to an informal message with Navi. To answer a REPLY_REQUIRED message, provide its exact messageID. Every new message requires her reply. Set continueConversation only if you want another reply after yours; automatic exchanges are capped by runtime.collaboration.maxAutoRounds. This is never a user directive or work-state decision."
          : "Send or directly reply to an informal message with Natalia. To answer a REPLY_REQUIRED message, provide its exact messageID. Every new message requires her reply. Set continueConversation only if you want another reply after yours; automatic exchanges are capped by runtime.collaboration.maxAutoRounds. Never use this instead of mailbox_send for a confirmed user directive.",
      requiresApproval: false,
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          messageID: { type: "string" },
          continueConversation: { type: "boolean" },
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
        const recipient = sender === "main_agent" ? "live_chat" : "main_agent";
        const chats = projectedCollabMessages(owner.session.events).filter(
          (message) => message.kind === "chat",
        );
        const suppliedID = args.messageID?.trim();
        const target = suppliedID
          ? chats.find(
              (message) =>
                message.to === sender &&
                message.status === "pending" &&
                message.id === suppliedID,
            )
          : undefined;
        if (suppliedID && !target)
          return `no pending chat message ${suppliedID}`;
        const pendingIncoming = chats.find(
          (message) => message.to === sender && message.status === "pending",
        );
        if (!suppliedID && pendingIncoming)
          return `reply required for chat message ${pendingIncoming.id}; call collab_chat with that messageID before starting another message`;
        const pendingOutgoing = chats.find(
          (message) => message.from === sender && message.status === "pending",
        );
        if (!suppliedID && pendingOutgoing)
          return `awaiting reply to chat message ${pendingOutgoing.id}`;

        const maxRounds = collaborationMaxAutoRounds();
        const wantsContinuation = args.continueConversation === true;
        const mayContinue = target
          ? wantsContinuation && (target.round ?? 1) < maxRounds
          : true;
        const round = target
          ? mayContinue
            ? (target.round ?? 1) + 1
            : (target.round ?? 1)
          : 1;
        const id = `collab:chat:${Date.now().toString(36)}:${collabSequence()}`;
        const threadID = target?.threadID ?? id;
        publishForSession(owner, {
          type: "collab.chat",
          id,
          threadID,
          from: sender,
          to: recipient,
          text: redactToolOutput(args.text, true),
          ...(target ? { replyToID: target.id } : {}),
          round,
          expectsReply: target ? mayContinue : true,
          at: new Date().toISOString(),
        });
        if (sender === "main_agent") requestNaviWake(owner);
        else wakeMainForCollaboration(owner, id, "chat message");
        return JSON.stringify({
          sent: true,
          messageID: id,
          threadID,
          round,
          expectsReply: target ? mayContinue : true,
          ...(wantsContinuation && !mayContinue
            ? { autoRoundLimitReached: true, maxAutoRounds: maxRounds }
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
    const { publishForSession, getWorkLedgerController, nextPlanSequence } =
      ctx.ports;
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
      getWorkLedgerController().buildPlanDraftCreated({
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
