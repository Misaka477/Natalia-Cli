import type {
  InitializeOptions,
  RuntimeContext,
  RuntimeTool,
  SessionID,
} from "../context";
import { createInitializeRuntime } from "./runtime";

export async function registerCollaborationTools(
  ctx: RuntimeContext,
  _options: InitializeOptions,
) {
  const scope = createInitializeRuntime(ctx);
  // P8 C3: the main agent acknowledges delivered mailbox intents it acted
  // on; acknowledged messages stop being re-injected as pending intents.
  scope.tools.set(
    "mailbox_acknowledge",
    scope.createMailboxAcknowledgeTool({
      onAcknowledge: async (messageIDs, context) => {
        const owner = context.sessionID
          ? scope.executionBySession.get(context.sessionID as SessionID)
          : undefined;
        if (!owner) return;
        const at = new Date().toISOString();
        for (const messageID of messageIDs) {
          const message = scope
            .projectedMailboxMessages(owner.session.events)
            .find(
              (candidate) =>
                candidate.messageID === messageID &&
                candidate.status === "delivered",
            );
          if (!message) continue;
          scope.publishForSession(
            owner,
            scope.buildMailboxStatus({
              id: `${messageID}:acknowledged:${ctx.ports.nextMailboxSequence()}`,
              messageID,
              status: "acknowledged",
              at,
            }),
          );
        }
      },
    }),
  );
  // P8 §56.62 collaboration channel: the main agent responds to Navi's
  // suggestions (adopt/reject/defer) and may ask her a question — she sees
  // both in her next turn's context, so neither agent waits for the user.
  // Agent-team: the main agent orchestrates a fan-out via these scope.tools and
  // acts as the lead reviewer. The team scope.tools register through the
  // `natalia-team` built-in plugin, gated on the same extension switch.
  scope.tools.set("collab_respond", {
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
      const owner = context.sessionID
        ? scope.executionBySession.get(context.sessionID as SessionID)
        : undefined;
      if (!owner) return "no session";
      const messageID = args.messageID;
      // Models routinely truncate the id to its tail; accept an exact id or
      // a unique suffix of it.
      const target = scope
        .projectedCollabMessages(owner.session.events)
        .find(
          (message) =>
            message.kind === "suggestion" &&
            message.status === "proposed" &&
            (message.id === messageID ||
              message.id.endsWith(messageID) ||
              messageID.endsWith(message.id)),
        );
      if (!target) return `no suggestion ${messageID}`;
      scope.publishForSession(owner, {
        type: "collab.response",
        id: `collab:response:${Date.now().toString(36)}:${ctx.ports.nextCollabSequence()}`,
        // Publish with the matched message's real id, not the (possibly
        // truncated) args id, so the projection can fold the decision back.
        messageID: target.id,
        from: "main_agent",
        decision: args.decision as "adopted" | "rejected" | "deferred",
        ...(args.reason
          ? { reason: scope.redactToolOutput(args.reason, true) }
          : {}),
        at: new Date().toISOString(),
      });
      scope.requestNaviWake(owner);
      return JSON.stringify({ responded: true });
    },
  } as RuntimeTool);
  scope.tools.set("collab_inbox", {
    name: "collab_inbox",
    description:
      "Read the collaboration channel with Navi (the Live Work Chat, your younger sister): her answers to your questions, her pending suggestions and their outcomes. Call it whenever you are unsure whether she replied or what she said.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    async execute(_parsed, context) {
      const owner = context.sessionID
        ? scope.executionBySession.get(context.sessionID as SessionID)
        : undefined;
      if (!owner) return "[]";
      const messages = scope.projectedCollabMessages(owner.session.events);
      return JSON.stringify(
        messages.slice(-10).map((message) => ({
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
  } as RuntimeTool);
  scope.tools.set(
    "collab_chat",
    scope.createCollabChatTool("main_agent", undefined),
  );
  scope.tools.set("collab_ask", {
    name: "collab_ask",
    description:
      "Ask Navi, the Live Work Chat collaborator (your younger sister), a question about the work — a second opinion on an approach, risk or tradeoff. She sees it in her next turn and answers with collab_answer. Use it when an outside read would genuinely help, not for trivia.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        question: { type: "string" },
      },
      required: ["question"],
      additionalProperties: false,
    },
    async execute(parsed, context) {
      const args = parsed as { question?: string };
      if (typeof args.question !== "string" || !args.question.trim())
        return "collab_ask requires question";
      const exec = context.sessionID
        ? scope.executionBySession.get(context.sessionID as SessionID)
        : undefined;
      if (!exec) return "no session";
      scope.publishForSession(exec, {
        type: "collab.question",
        id: `collab:question:${Date.now().toString(36)}:${ctx.ports.nextCollabSequence()}`,
        from: "main_agent",
        to: "live_chat",
        question: scope.redactToolOutput(args.question, true),
        at: new Date().toISOString(),
      });
      // If Navi is not mid-conversation with the user, wake her to answer
      // immediately; if she is chatting, the question waits for her next
      // turn boundary (the queued path).
      scope.requestNaviWake(exec);
      return JSON.stringify({ asked: true });
    },
  } as RuntimeTool);
}
