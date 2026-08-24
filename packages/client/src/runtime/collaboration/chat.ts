import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  PROVIDER_MODEL_CONTROLLER_SERVICE,
  type ProviderModelController,
} from "@natalia/runtime-services";
import type { SessionID } from "@natalia/contracts";
import { projectedChatMessages } from "@natalia/session";
import type { RuntimeContext } from "../context";
type Surface = Pick<
  RuntimeServiceClient,
  "chatSubmit" | "chatMessages" | "chatRollback"
>;
function redactToolOutput(output: string, redact: boolean | undefined) {
  if (!redact) return output;
  return output.replace(
    /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s]+/giu,
    (match) =>
      `${match.slice(0, match.indexOf("=") >= 0 ? match.indexOf("=") + 1 : match.indexOf(":") + 1)}[REDACTED]`,
  );
}
export function createChatSurface(ctx: RuntimeContext): Surface {
  return {
    async chatMessages() {
      if (!ctx.ports.getSession()) return [];
      return projectedChatMessages(ctx.ports.getSession()!.events).map(
        (message) => ({
          messageID: message.messageID,
          role: message.role,
          text: message.text,
          at: message.at,
        }),
      );
    },
    async chatRollback(input: { toMessageID: string }) {
      if (!ctx.ports.getSession())
        return { rolledBackTo: input.toMessageID, removed: 0 };
      const history = projectedChatMessages(ctx.ports.getSession()!.events);
      const index = history.findIndex(
        (message) => message.messageID === input.toMessageID,
      );
      if (index === -1) return { rolledBackTo: input.toMessageID, removed: 0 };
      const removed = history.length - (index + 1);
      ctx.ports.publish({
        type: "chat.rollback",
        id: `chat:rollback:${Date.now().toString(36)}:${ctx.ports.nextChatSequence()}`,
        toMessageID: input.toMessageID,
        removed,
        at: new Date().toISOString(),
      });
      return { rolledBackTo: input.toMessageID, removed };
    },
    async chatSubmit(input: { text: string }) {
      await ctx.ports.getReady();
      const text = typeof input.text === "string" ? input.text.trim() : "";
      const exec = ctx.ports.getActiveExec();
      const controller = ctx.ports.resolveService<ProviderModelController>(
        PROVIDER_MODEL_CONTROLLER_SERVICE,
      );
      if (!text || !exec?.provider || !controller) return { messageID: "" };
      const now = new Date();
      const userMessageID = `chat:${Date.now().toString(36)}:${ctx.ports.nextChatSequence()}`;
      ctx.ports.publishForSession(exec, {
        type: "chat.message.added",
        id: `${userMessageID}:user`,
        messageID: userMessageID,
        role: "user",
        text: redactToolOutput(text, true),
        at: now.toISOString(),
      });
      const responseMessageID = `chat:${Date.now().toString(36)}:${ctx.ports.nextChatSequence()}`;
      try {
        await controller.runChatTurn({
          sessionID: exec.session.id as SessionID,
          text,
          responseMessageID,
        });
      } catch (cause) {
        ctx.ports.publishForSession(exec, {
          type: "chat.message.added",
          id: `${responseMessageID}:chat`,
          messageID: responseMessageID,
          role: "chat",
          text: `(live work chat error: ${cause instanceof Error ? cause.message : String(cause)})`,
          at: new Date().toISOString(),
        });
      }
      return { messageID: responseMessageID };
    },
  };
}
