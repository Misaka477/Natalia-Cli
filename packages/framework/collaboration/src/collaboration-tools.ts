import type { RuntimeEvent, SessionID } from "@natalia/contracts";
import { projectedMailboxMessages } from "@natalia/session";
import {
  buildMailboxStatus,
  createMailboxAcknowledgeTool,
} from "@natalia/runtime-services";
import type { RuntimeTool } from "@natalia/tools";
import type { CollaborationService } from "./collaboration-service";

export type CollaborationToolPorts = {
  events(sessionID: SessionID): RuntimeEvent[] | undefined;
  publish(sessionID: SessionID, event: RuntimeEvent): void;
  redact(text: string): string;
  nextMailboxSequence(): number;
  requestWake(sessionID: SessionID): void;
  maxAutoRounds(): number;
  service: CollaborationService;
};

export function collaborationTools(
  ports: CollaborationToolPorts,
): RuntimeTool[] {
  const sessionEvents = (sessionID: string | undefined) =>
    sessionID ? ports.events(sessionID as SessionID) : undefined;

  const mailboxAcknowledge = createMailboxAcknowledgeTool({
    async onAcknowledge(messageIDs, context) {
      const sessionID = context.sessionID as SessionID | undefined;
      const events = sessionEvents(sessionID);
      if (!sessionID || !events) return;
      const at = new Date().toISOString();
      for (const messageID of messageIDs) {
        const message = projectedMailboxMessages(events).find(
          (candidate) =>
            candidate.messageID === messageID &&
            candidate.status === "delivered",
        );
        if (!message) continue;
        ports.publish(
          sessionID,
          buildMailboxStatus({
            id: `${messageID}:acknowledged:${ports.nextMailboxSequence()}`,
            messageID,
            status: "acknowledged",
            at,
          }),
        );
      }
    },
  });

  const respond: RuntimeTool = {
    name: "collab_respond",
    description:
      "Respond to a suggestion from Navi, the Live Work Chat collaborator: adopt it, reject it, or defer it with a reason. The message id comes from the <navi_collaborations> context block.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        messageID: { type: "string" },
        decision: {
          type: "string",
          enum: ["adopted", "rejected", "deferred"],
        },
        reason: { type: "string" },
      },
      required: ["messageID", "decision"],
      additionalProperties: false,
    },
    async execute(parsed, context) {
      const args = parsed as {
        messageID?: string;
        decision?: string;
        reason?: string;
      };
      if (
        typeof args.messageID !== "string" ||
        typeof args.decision !== "string"
      )
        return "collab_respond requires messageID and decision";
      const sessionID = context.sessionID as SessionID | undefined;
      if (!sessionID || !sessionEvents(sessionID)) return "no session";
      try {
        await ports.service.send({
          sessionID,
          kind: "response",
          from: "main_agent",
          replyToID: args.messageID,
          decision: args.decision as "adopted" | "rejected" | "deferred",
          text: ports.redact(args.reason ?? args.decision),
          ...(args.reason ? { reason: ports.redact(args.reason) } : {}),
        });
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
      ports.requestWake(sessionID);
      return JSON.stringify({ responded: true });
    },
  };

  const inbox: RuntimeTool = {
    name: "collab_inbox",
    description:
      "Read the collaboration channel with Navi: her answers, pending suggestions, and their outcomes.",
    requiresApproval: false,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_parsed, context) {
      const events = sessionEvents(context.sessionID);
      if (!events) return "[]";
      return JSON.stringify(
        ports.service
          .list(context.sessionID as SessionID)
          .slice(-10)
          .map((message) => ({
            id: message.id,
            kind: message.kind,
            from: message.from,
            to: message.to,
            text: message.text,
            status: message.status,
            ...(message.questionID ? { questionID: message.questionID } : {}),
            ...(message.threadID ? { threadID: message.threadID } : {}),
            ...(message.replyToID ? { replyToID: message.replyToID } : {}),
            ...(message.kind === "chat" ? { round: message.round } : {}),
            ...(message.expectsReply !== undefined
              ? { expectsReply: message.expectsReply }
              : {}),
          })),
      );
    },
  };

  const chat = createMainAgentChatTool(ports, sessionEvents);
  const ask: RuntimeTool = {
    name: "collab_ask",
    description:
      "Ask Navi, the Live Work Chat collaborator, for a second opinion on an approach, risk, or tradeoff.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: { question: { type: "string" } },
      required: ["question"],
      additionalProperties: false,
    },
    async execute(parsed, context) {
      const question = (parsed as { question?: string }).question;
      if (typeof question !== "string" || !question.trim())
        return "collab_ask requires question";
      const sessionID = context.sessionID as SessionID | undefined;
      if (!sessionID || !sessionEvents(sessionID)) return "no session";
      await ports.service.send({
        sessionID,
        kind: "question",
        from: "main_agent",
        text: ports.redact(question),
      });
      ports.requestWake(sessionID);
      return JSON.stringify({ asked: true });
    },
  };

  return [mailboxAcknowledge, respond, inbox, chat, ask];
}

function createMainAgentChatTool(
  ports: CollaborationToolPorts,
  sessionEvents: (sessionID: string | undefined) => RuntimeEvent[] | undefined,
): RuntimeTool {
  return {
    name: "collab_chat",
    description:
      "Send or directly reply to an informal message with Navi. A new message has no messageID and always requests one reply; omit continueConversation. To answer a REPLY_REQUIRED message, provide its exact messageID; having that messageID means Navi already replied to you. Only on a reply, continueConversation=true requests another reply and false closes the conversation. If your reply asks a question, invites her to continue, or says you will wait for her response or follow-up, you must set it to true.",
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
      const sessionID = context.sessionID as SessionID | undefined;
      const events = sessionEvents(sessionID);
      if (!sessionID || !events) return "no session";
      const suppliedID = args.messageID?.trim();
      const wantsContinuation = args.continueConversation === true;
      let result;
      try {
        result = await ports.service.send({
          sessionID,
          kind: "chat",
          from: "main_agent",
          text: ports.redact(args.text),
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
      ports.requestWake(sessionID);
      return JSON.stringify({
        sent: true,
        messageID: result.message.id,
        threadID: result.message.threadID,
        round: result.message.kind === "chat" ? result.message.round : 1,
        expectsReply: result.message.expectsReply,
        receivedReply: Boolean(suppliedID),
        continuationRequested: wantsContinuation,
        conversationClosed: !result.message.expectsReply,
        ...(wantsContinuation && !result.message.expectsReply
          ? {
              autoRoundLimitReached: true,
              maxAutoRounds: ports.maxAutoRounds(),
            }
          : {}),
      });
    },
  };
}
