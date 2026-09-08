import {
  ATTACHMENT_SERVICE,
  PROVIDER_MODEL_CONTROLLER_SERVICE,
} from "@natalia/runtime-services";
import type {
  AttachmentService,
  ProviderModelController,
  RuntimeServiceClient,
} from "@natalia/runtime-services";
import type {
  ChatChannel,
  ChatModelProfile,
  RuntimeReasoningEffort,
  SessionID,
} from "@natalia/contracts";
import { projectedChatMessages } from "@natalia/session";
import type { RuntimeContext } from "../context";
import { ensureSessionFullEvents } from "../session-full-events";
import { streamEvent } from "./chat-turn-common";
type Surface = Pick<
  RuntimeServiceClient,
  | "chatSubmit"
  | "chatAbort"
  | "chatMessages"
  | "chatRollback"
  | "chatModelProfile"
  | "setChatModelProfile"
>;
type ChatSubmitInput = {
  text: string;
  model?: { modelID?: string; variant?: string };
  reasoningEffort?: RuntimeReasoningEffort;
  attachments?: string[];
  channel?: ChatChannel;
  sessionID?: string;
};
function redactToolOutput(output: string, redact: boolean | undefined) {
  if (!redact) return output;
  return output.replace(
    /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s]+/giu,
    (match) =>
      `${match.slice(0, match.indexOf("=") >= 0 ? match.indexOf("=") + 1 : match.indexOf(":") + 1)}[REDACTED]`,
  );
}

async function chatExec(ctx: RuntimeContext, sessionID?: string) {
  if (sessionID)
    return (
      ctx.ports.getExecutionBySession().get(sessionID as SessionID) ??
      (await ctx.ports.ensureExecution(sessionID as SessionID))
    );
  return ctx.ports.getActiveExec();
}
export function createChatSurface(ctx: RuntimeContext): Surface {
  return {
    async chatMessages(channel?: ChatChannel, sessionID?: string) {
      const exec = await chatExec(ctx, sessionID);
      if (!exec) return [];
      await ensureSessionFullEvents(ctx, exec);
      return projectedChatMessages(exec.session.events)
        .filter(
          (message) => (message.channel ?? "navi") === (channel ?? "navi"),
        )
        .map((message) => ({
          messageID: message.messageID,
          role: message.role,
          text: message.text,
          at: message.at,
          ...(message.kind ? { kind: message.kind } : {}),
          ...(message.channel ? { channel: message.channel } : {}),
        }));
    },
    async chatRollback(
      input: { toMessageID: string },
      channel?: ChatChannel,
      sessionID?: string,
    ) {
      const exec = await chatExec(ctx, sessionID);
      if (!exec) return { rolledBackTo: input.toMessageID, removed: 0 };
      await ensureSessionFullEvents(ctx, exec);
      const channelKey = channel ?? "navi";
      const history = projectedChatMessages(exec.session.events).filter(
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
      ctx.ports.publishForSession(
        exec,
        streamEvent({
          type: `${channelKey}.chat.rollback`,
          id: `chat:rollback:${Date.now().toString(36)}:${ctx.ports.nextChatSequence()}`,
          toMessageID: input.toMessageID,
          removed,
          at: new Date().toISOString(),
        }),
      );
      return { rolledBackTo: input.toMessageID, removed };
    },
    async chatModelProfile(channel?: ChatChannel, sessionID?: string) {
      const exec = await chatExec(ctx, sessionID);
      if (!exec) return {};
      const profiles = exec.chatModelProfile as
        | Record<string, ChatModelProfile>
        | undefined;
      return (profiles?.[channel ?? "navi"] as ChatModelProfile) ?? {};
    },
    async setChatModelProfile(
      profile,
      channel?: ChatChannel,
      sessionID?: string,
    ) {
      const exec = await chatExec(ctx, sessionID);
      if (!exec) return { saved: false };
      const profileChannel = channel ?? "navi";
      const profiles = {
        ...(exec.chatModelProfile as
          | Record<string, ChatModelProfile>
          | undefined),
      };
      profiles[profileChannel] = profile;
      (exec as { chatModelProfile?: unknown }).chatModelProfile = profiles;
      ctx.ports.publishForSession(
        exec,
        streamEvent({
          type: `${profileChannel}.chat.model.profile`,
          profile,
        }),
      );
      return { saved: true };
    },
    async chatAbort(channel?: ChatChannel, sessionID?: string) {
      const exec = await chatExec(ctx, sessionID);
      const controller = ctx.ports.resolveService<ProviderModelController>(
        PROVIDER_MODEL_CONTROLLER_SERVICE,
      );
      if (!exec || !controller) return { aborted: false as const };
      const ownerSessionID = exec.session.id as SessionID;
      const aborted =
        channel === "nia"
          ? controller.abortNia(ownerSessionID)
          : controller.abortNavi(ownerSessionID);
      if (aborted) {
        const pending =
          channel === "nia"
            ? exec.pendingNiaChatUserMessages
            : exec.pendingNaviChatUserMessages;
        if (channel === "nia") exec.niaAbortWakePending = true;
        else exec.naviAbortWakePending = true;
        if (pending.length) {
          if (channel === "nia") {
            exec.niaAbortWakePending = false;
            controller.requestNiaWake(ownerSessionID);
          } else {
            exec.naviAbortWakePending = false;
            controller.requestNaviWake(ownerSessionID);
          }
        }
      }
      return { aborted };
    },
    async chatSubmit(input: ChatSubmitInput) {
      return input.channel === "nia"
        ? submitNiaChat(input)
        : submitNaviChat(input);
    },
  };

  async function prepareSubmit(input: ChatSubmitInput) {
    const storedAttachments = input.attachments?.length
      ? await ctx.ports
          .resolveService<AttachmentService>(ATTACHMENT_SERVICE)
          ?.store(input.attachments)
      : undefined;
    await ctx.ports.getReady();
    return {
      text: typeof input.text === "string" ? input.text.trim() : "",
      storedAttachments,
      exec: await chatExec(ctx, input.sessionID),
      controller: ctx.ports.resolveService<ProviderModelController>(
        PROVIDER_MODEL_CONTROLLER_SERVICE,
      ),
    };
  }

  async function submitNaviChat(input: ChatSubmitInput) {
    const { text, storedAttachments, exec, controller } =
      await prepareSubmit(input);
    console.log("[navi-chat] submit received", {
      text: input.text,
      model: input.model,
      attachments: input.attachments,
    });
    console.log("[navi-chat] submit state", {
      text,
      hasExec: !!exec,
      hasController: !!controller,
      sessionID: exec?.session.id,
    });
    if (!text || !exec || !controller) {
      console.warn("[navi-chat] submit rejected: missing text/exec/controller");
      return { messageID: "" };
    }
    const now = new Date();
    const userMessageID = `chat:${Date.now().toString(36)}:${ctx.ports.nextChatSequence()}`;
    ctx.ports.publishForSession(
      exec,
      streamEvent({
        type: "navi.chat.message.new",
        id: `${userMessageID}:user`,
        messageID: userMessageID,
        role: "user",
        text: redactToolOutput(text, true),
        at: now.toISOString(),
      }),
    );
    const responseMessageID = `chat:${Date.now().toString(36)}:${ctx.ports.nextChatSequence()}`;
    if (controller.naviBusy(exec.session.id as SessionID)) {
      console.log("[navi-chat] queued while busy", {
        userMessageID,
        text,
      });
      exec.pendingNaviChatUserMessages.push({
        messageID: userMessageID,
        text: redactToolOutput(text, true),
      });
      if (exec.naviAbortWakePending) {
        exec.naviAbortWakePending = false;
        controller.requestNaviWake(exec.session.id as SessionID);
      }
      return { messageID: userMessageID };
    }
    exec.naviAbortWakePending = false;
    console.log("[navi-chat] running turn", {
      userMessageID,
      responseMessageID,
      text,
    });
    try {
      await controller.runNaviChatTurn({
        sessionID: exec.session.id as SessionID,
        text,
        responseMessageID,
        model: input.model,
        reasoningEffort: input.reasoningEffort,
        attachments: storedAttachments,
      });
      console.log("[navi-chat] turn finished", responseMessageID);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      console.error("[navi-chat] turn failed", detail);
      ctx.ports.publishForSession(
        exec,
        streamEvent({
          type: "navi.chat.message.new",
          id: `${responseMessageID}:chat`,
          messageID: responseMessageID,
          role: "chat",
          text: `Chat could not finish this turn: ${detail.split("\n")[0]!.slice(0, 240)}`,
          at: new Date().toISOString(),
        }),
      );
    }
    return { messageID: responseMessageID };
  }

  async function submitNiaChat(input: ChatSubmitInput) {
    const { text, storedAttachments, exec, controller } =
      await prepareSubmit(input);
    console.log("[nia-chat] submit received", {
      text: input.text,
      model: input.model,
      attachments: input.attachments,
    });
    if (!text || !exec || !controller) {
      console.warn("[nia-chat] submit rejected: missing text/exec/controller");
      return { messageID: "" };
    }
    const userMessageID = `chat:${Date.now().toString(36)}:${ctx.ports.nextChatSequence()}`;
    const safeText = redactToolOutput(text, true);
    ctx.ports.publishForSession(
      exec,
      streamEvent({
        type: "nia.chat.message.new",
        id: `${userMessageID}:user`,
        messageID: userMessageID,
        role: "user",
        text: safeText,
        at: new Date().toISOString(),
      }),
    );
    const responseMessageID = `chat:${Date.now().toString(36)}:${ctx.ports.nextChatSequence()}`;
    if (controller.niaBusy(exec.session.id as SessionID)) {
      exec.pendingNiaChatUserMessages.push({
        messageID: userMessageID,
        text: safeText,
      });
      if (exec.niaAbortWakePending) {
        exec.niaAbortWakePending = false;
        controller.requestNiaWake(exec.session.id as SessionID);
      }
      return { messageID: userMessageID };
    }
    exec.niaAbortWakePending = false;
    try {
      await controller.runNiaChatTurn({
        sessionID: exec.session.id as SessionID,
        text,
        responseMessageID,
        model: input.model,
        reasoningEffort: input.reasoningEffort,
        attachments: storedAttachments,
      });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      console.error("[nia-chat] turn failed", detail);
      ctx.ports.publishForSession(
        exec,
        streamEvent({
          type: "nia.chat.message.new",
          id: `${responseMessageID}:chat`,
          messageID: responseMessageID,
          role: "chat",
          text: `Nia could not finish this turn: ${detail.split("\n")[0]!.slice(0, 240)}`,
          at: new Date().toISOString(),
        }),
      );
    }
    return { messageID: responseMessageID };
  }
}
