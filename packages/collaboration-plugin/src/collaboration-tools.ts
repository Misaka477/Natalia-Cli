import type { RuntimeEvent, SessionID } from "@natalia/contracts";
import {
  projectedCollabMessages,
  projectedMailboxMessages,
} from "@natalia/session";
import {
  buildMailboxStatus,
  createMailboxAcknowledgeTool,
} from "@natalia/runtime-services";
import type { RuntimeTool } from "@natalia/tools";

export type CollaborationToolPorts = {
  events(sessionID: SessionID): RuntimeEvent[] | undefined;
  publish(sessionID: SessionID, event: RuntimeEvent): void;
  redact(text: string): string;
  nextMailboxSequence(): number;
  nextCollabSequence(): number;
  requestWake(sessionID: SessionID): void;
  maxAutoRounds(): number;
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
      const events = sessionEvents(sessionID);
      if (!sessionID || !events) return "no session";
      const target = projectedCollabMessages(events).find(
        (message) =>
          message.kind === "suggestion" &&
          message.status === "proposed" &&
          (message.id === args.messageID ||
            message.id.endsWith(args.messageID!) ||
            args.messageID!.endsWith(message.id)),
      );
      if (!target) return `no suggestion ${args.messageID}`;
      ports.publish(sessionID, {
        type: "collab.response",
        id: `collab:response:${Date.now().toString(36)}:${ports.nextCollabSequence()}`,
        messageID: target.id,
        from: "main_agent",
        decision: args.decision as "adopted" | "rejected" | "deferred",
        ...(args.reason ? { reason: ports.redact(args.reason) } : {}),
        at: new Date().toISOString(),
      });
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
        projectedCollabMessages(events)
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
            ...(message.round ? { round: message.round } : {}),
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
      ports.publish(sessionID, {
        type: "collab.question",
        id: `collab:question:${Date.now().toString(36)}:${ports.nextCollabSequence()}`,
        from: "main_agent",
        to: "live_chat",
        question: ports.redact(question),
        at: new Date().toISOString(),
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
      "Send or directly reply to an informal message with Navi. To answer a REPLY_REQUIRED message, provide its exact messageID. Every new message requires her reply.",
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
      const sessionID = context.sessionID as SessionID | undefined;
      const events = sessionEvents(sessionID);
      if (!sessionID || !events) return "no session";
      const chats = projectedCollabMessages(events).filter(
        (message) => message.kind === "chat",
      );
      const suppliedID = args.messageID?.trim();
      const target = suppliedID
        ? chats.find(
            (message) =>
              message.to === "main_agent" &&
              message.status === "pending" &&
              message.id === suppliedID,
          )
        : undefined;
      if (suppliedID && !target) return `no pending chat message ${suppliedID}`;
      const pendingIncoming = chats.find(
        (message) =>
          message.to === "main_agent" && message.status === "pending",
      );
      if (!suppliedID && pendingIncoming)
        return `reply required for chat message ${pendingIncoming.id}; call collab_chat with that messageID before starting another message`;
      const pendingOutgoing = chats.find(
        (message) =>
          message.from === "main_agent" && message.status === "pending",
      );
      if (!suppliedID && pendingOutgoing)
        return `awaiting reply to chat message ${pendingOutgoing.id}`;

      const maxRounds = ports.maxAutoRounds();
      const wantsContinuation = args.continueConversation === true;
      const mayContinue = target
        ? wantsContinuation && (target.round ?? 1) < maxRounds
        : true;
      const round = target
        ? mayContinue
          ? (target.round ?? 1) + 1
          : (target.round ?? 1)
        : 1;
      const id = `collab:chat:${Date.now().toString(36)}:${ports.nextCollabSequence()}`;
      const threadID = target?.threadID ?? id;
      ports.publish(sessionID, {
        type: "collab.chat",
        id,
        threadID,
        from: "main_agent",
        to: "live_chat",
        text: ports.redact(args.text),
        ...(target ? { replyToID: target.id } : {}),
        round,
        expectsReply: target ? mayContinue : true,
        at: new Date().toISOString(),
      });
      ports.requestWake(sessionID);
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
  };
}
