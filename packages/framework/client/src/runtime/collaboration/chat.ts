import {
  ATTACHMENT_SERVICE,
  PROVIDER_MODEL_CONTROLLER_SERVICE,
} from "@natalia/runtime-services";
import type {
  AttachmentService,
  ProviderModelController,
  RuntimeServiceClient,
} from "@natalia/runtime-services";
import { providerForModel } from "@natalia/runtime";
import type { ChatChannel, ChatModelProfile, RuntimeReasoningEffort, SessionID } from "@natalia/contracts";
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
    async chatMessages(channel?: ChatChannel) {
      if (!ctx.ports.getSession()) return [];
      return projectedChatMessages(ctx.ports.getSession()!.events)
        .filter((message) => (message.channel ?? "navi") === (channel ?? "navi"))
        .map((message) => ({
          messageID: message.messageID,
          role: message.role,
          text: message.text,
          at: message.at,
        }));
    },
    async chatRollback(input: { toMessageID: string }, channel?: ChatChannel) {
      if (!ctx.ports.getSession())
        return { rolledBackTo: input.toMessageID, removed: 0 };
      const channelKey = channel ?? "navi";
      const history = projectedChatMessages(ctx.ports.getSession()!.events).filter(
        (message) => (message.channel ?? "navi") === channelKey,
      );
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
        ...(channel ? { channel } : {}),
      });
      return { rolledBackTo: input.toMessageID, removed };
    },
    async chatModelProfile(channel?: ChatChannel) {
      const exec = ctx.ports.getActiveExec();
      if (!exec) return {};
      const profiles = exec.chatModelProfile as Record<string, ChatModelProfile> | undefined;
      return (profiles?.[channel ?? "navi"] as ChatModelProfile) ?? {};
    },
    async setChatModelProfile(profile, channel?: ChatChannel) {
      const exec = ctx.ports.getActiveExec();
      if (!exec) return { saved: false };
      const profiles = { ...(exec.chatModelProfile as Record<string, ChatModelProfile> | undefined) };
      profiles[channel ?? "navi"] = profile;
      (exec as { chatModelProfile?: unknown }).chatModelProfile = profiles;
      return { saved: true };
    },
    async chatAbort(channel?: ChatChannel) {
      const exec = ctx.ports.getActiveExec();
      const controller = ctx.ports.resolveService<ProviderModelController>(
        PROVIDER_MODEL_CONTROLLER_SERVICE,
      );
      if (!exec || !controller?.abortChat) return { aborted: false as const };
      return {
        aborted: controller.abortChat(exec.session.id as SessionID, channel),
      };
    },
    async chatSubmit(input: {
      text: string;
      model?: { modelID?: string; variant?: string };
      reasoningEffort?: RuntimeReasoningEffort;
      attachments?: string[];
      channel?: ChatChannel;
    }) {
      const channel = input.channel ?? "navi";
      console.log("[chat] chatSubmit received", {
        text: input.text,
        model: input.model,
        attachments: input.attachments,
        channel,
      });
      const storedAttachments = input.attachments?.length
        ? await ctx.ports
            .resolveService<AttachmentService>(ATTACHMENT_SERVICE)
            ?.store(input.attachments)
        : undefined;
      await ctx.ports.getReady();
      const text = typeof input.text === "string" ? input.text.trim() : "";
      const exec = ctx.ports.getActiveExec();
      const controller = ctx.ports.resolveService<ProviderModelController>(
        PROVIDER_MODEL_CONTROLLER_SERVICE,
      );
      let provider = exec?.provider;
      if (!provider) {
        const config = ctx.ports.getTsRuntimeConfig();
        provider =
          (config?.defaultModel &&
            providerForModel(config, config.defaultModel)) ||
          ctx.ports.providerFromEnvironment?.();
        if (provider && exec) exec.provider = provider;
      }
      console.log("[chat] chatSubmit state", {
        text,
        hasExec: !!exec,
        hasProvider: !!provider,
        hasController: !!controller,
        sessionID: exec?.session.id,
      });
      if (!text || !exec || !provider || !controller) {
        console.warn("[chat] chatSubmit rejected: missing text/exec/provider/controller");
        return { messageID: "" };
      }
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
        ...(channel ? { channel } : {}),
      });
      const responseMessageID = `chat:${Date.now().toString(36)}:${ctx.ports.nextChatSequence()}`;
      if (controller.chatBusy?.(exec.session.id as SessionID, channel)) {
        console.log("[chat] chatSubmit queued while busy", {
          userMessageID,
          text,
        });
        exec.pendingChatUserMessages.push({
          messageID: userMessageID,
          text: redactToolOutput(text, true),
        });
        return { messageID: userMessageID };
      }
      console.log("[chat] chatSubmit running turn", {
        userMessageID,
        responseMessageID,
        text,
      });
      try {
        await controller.runChatTurn({
          sessionID: exec.session.id as SessionID,
          text,
          responseMessageID,
          provider,
          reasoningEffort: input.reasoningEffort,
          attachments: storedAttachments,
          channel,
        });
        console.log("[chat] chatSubmit turn finished", responseMessageID);
      } catch (cause) {
        const detail = cause instanceof Error ? cause.message : String(cause);
        console.error("[chat] chatSubmit turn failed", detail);
        ctx.ports.publishForSession(exec, {
          type: "chat.message.added",
          id: `${responseMessageID}:chat`,
          messageID: responseMessageID,
          role: "chat",
          text: `Chat could not finish this turn: ${detail.split("\n")[0]!.slice(0, 240)}`,
          at: new Date().toISOString(),
          ...(channel ? { channel } : {}),
        });
      }
      return { messageID: responseMessageID };
    },
  };
}
