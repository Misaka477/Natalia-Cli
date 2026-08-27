import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  PROVIDER_MODEL_CONTROLLER_SERVICE,
  type ProviderModelController,
} from "@natalia/runtime-services";
import { providerForModel } from "@natalia/runtime";
import type { RuntimeReasoningEffort, SessionID } from "@natalia/contracts";
import { projectedChatMessages } from "@natalia/session";
import type { RuntimeContext } from "../context";
type Surface = Pick<
  RuntimeServiceClient,
  | "chatSubmit"
  | "chatAbort"
  | "chatMessages"
  | "chatRollback"
  | "chatModelProfile"
  | "setChatModelProfile"
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
      if (process.env.NATALIA_DEBUG_CHAT_ROLLBACK)
        console.error("[chatRollback] published", {
          toMessageID: input.toMessageID,
          removed,
        });
      ctx.ports.publish({
        type: "chat.rollback",
        id: `chat:rollback:${Date.now().toString(36)}:${ctx.ports.nextChatSequence()}`,
        toMessageID: input.toMessageID,
        removed,
        at: new Date().toISOString(),
      });
      return { rolledBackTo: input.toMessageID, removed };
    },
    async chatModelProfile() {
      const exec = ctx.ports.getActiveExec();
      return exec?.chatModelProfile ?? {};
    },
    async setChatModelProfile(profile) {
      const exec = ctx.ports.getActiveExec();
      if (!exec) return { saved: false };
      exec.chatModelProfile = profile;
      return { saved: true };
    },
    async chatAbort() {
      const exec = ctx.ports.getActiveExec();
      const controller = ctx.ports.resolveService<ProviderModelController>(
        PROVIDER_MODEL_CONTROLLER_SERVICE,
      );
      if (!exec || !controller?.abortChat) return { aborted: false as const };
      return {
        aborted: controller.abortChat(exec.session.id as SessionID),
      };
    },
    async chatSubmit(input: {
      text: string;
      model?: { modelID?: string; variant?: string };
      reasoningEffort?: RuntimeReasoningEffort;
    }) {
      await ctx.ports.getReady();
      const text = typeof input.text === "string" ? input.text.trim() : "";
      const exec = ctx.ports.getActiveExec();
      const controller = ctx.ports.resolveService<ProviderModelController>(
        PROVIDER_MODEL_CONTROLLER_SERVICE,
      );
      if (!text || !exec?.provider || !controller) return { messageID: "" };
      let provider = exec.provider;
      if (input.model?.modelID) {
        const config = ctx.ports.getTsRuntimeConfig();
        provider =
          (config &&
            providerForModel(config, input.model.modelID, input.model.variant, {
              reasoningEffort: input.reasoningEffort,
            })) ||
          provider;
      }
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
      if (controller.chatBusy?.(exec.session.id as SessionID)) {
        exec.pendingChatUserMessages.push({
          messageID: userMessageID,
          text: redactToolOutput(text, true),
        });
        return { messageID: userMessageID };
      }
      try {
        await controller.runChatTurn({
          sessionID: exec.session.id as SessionID,
          text,
          responseMessageID,
          provider,
          reasoningEffort: input.reasoningEffort,
        });
      } catch (cause) {
        const detail = cause instanceof Error ? cause.message : String(cause);
        ctx.ports.publishForSession(exec, {
          type: "chat.message.added",
          id: `${responseMessageID}:chat`,
          messageID: responseMessageID,
          role: "chat",
          text: `Chat could not finish this turn: ${detail.split("\n")[0]!.slice(0, 240)}`,
          at: new Date().toISOString(),
        });
      }
      return { messageID: responseMessageID };
    },
  };
}
