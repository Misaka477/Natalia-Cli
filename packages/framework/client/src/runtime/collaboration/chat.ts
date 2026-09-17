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
  ChatMessageRow,
  ChatModelProfile,
  RuntimeEvent,
  RuntimeReasoningEffort,
  SessionID,
} from "@natalia/contracts";
import {
  projectedNaviChatMessages,
  projectedNiaChatMessages,
} from "@natalia/session";
import type { RuntimeContext, SessionExecutionState } from "../context";
import { ensureSessionFullEvents } from "../session-full-events";
import { scanSessionWindowNewestFirst } from "../session-event-window";
import { paginateTranscript } from "../transcript-page";

/**
 * Find `toMessageID` from the newest event backwards across the shared window
 * and return the number of projected rows after it. `undefined` means the
 * message does not exist. A page that cannot be stitched falls back to the
 * explicit full-history escape hatch.
 */
async function removedAfterMessage(
  ctx: RuntimeContext,
  exec: SessionExecutionState,
  project: (events: RuntimeEvent[]) => Array<{ messageID: string }>,
  toMessageID: string,
): Promise<number | undefined> {
  const scan = await scanSessionWindowNewestFirst(
    ctx,
    exec,
    project,
    (message) => message.messageID === toMessageID,
  );
  if (scan.kind === "found") return scan.newerCount;
  if (scan.kind === "exhausted") return undefined;
  await ensureSessionFullEvents(ctx, exec);
  const history = project(exec.session.events);
  const index = history.findIndex(
    (message) => message.messageID === toMessageID,
  );
  return index === -1 ? undefined : history.length - index - 1;
}
import { streamEvent } from "./chat-turn-common";

type Surface = Pick<
  RuntimeServiceClient,
  | "chatSubmit"
  | "chatAbort"
  | "chatMessages"
  | "chatMessagesPage"
  | "chatRollback"
  | "chatModelProfile"
  | "setChatModelProfile"
>;
type SubmitInput = {
  text: string;
  model?: { modelID?: string; variant?: string };
  reasoningEffort?: RuntimeReasoningEffort;
  attachments?: string[];
  sessionID?: string;
};
type StreamSurface = {
  messages(
    sessionID?: string,
  ): ReturnType<NonNullable<RuntimeClientSurface["chatMessages"]>>;
  rollback(
    input: { toMessageID: string },
    sessionID?: string,
  ): ReturnType<NonNullable<RuntimeClientSurface["chatRollback"]>>;
  modelProfile(
    sessionID?: string,
  ): ReturnType<NonNullable<RuntimeClientSurface["chatModelProfile"]>>;
  setModelProfile(
    profile: ChatModelProfile,
    sessionID?: string,
  ): ReturnType<NonNullable<RuntimeClientSurface["setChatModelProfile"]>>;
  abort(
    sessionID?: string,
  ): ReturnType<NonNullable<RuntimeClientSurface["chatAbort"]>>;
  submit(input: SubmitInput): Promise<{ messageID: string }>;
};
type RuntimeClientSurface = RuntimeServiceClient;

function redactToolOutput(output: string) {
  return output.replace(
    /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s]+/giu,
    (match) =>
      `${match.slice(0, match.indexOf("=") >= 0 ? match.indexOf("=") + 1 : match.indexOf(":") + 1)}[REDACTED]`,
  );
}

async function streamExec(ctx: RuntimeContext, sessionID?: string) {
  // `start()` only kicks initialization off in the background. Chat read
  // surfaces may be the first routed call on a workspace proxy, so wait for
  // the composition root before `ensureExecution` touches runtime services.
  await ctx.ports.getReady();
  if (sessionID)
    return (
      ctx.ports.getExecutionBySession().get(sessionID as SessionID) ??
      (await ctx.ports.ensureExecution(sessionID as SessionID))
    );
  return ctx.ports.getActiveExec();
}

/** Project one channel's durable chat rows from raw session events. */
function projectChatRows(
  channel: ChatChannel,
  events: RuntimeEvent[],
): ChatMessageRow[] {
  const projected =
    channel === "nia"
      ? projectedNiaChatMessages(events)
      : projectedNaviChatMessages(events);
  return projected.map((message) => ({
    messageID: message.messageID,
    role: message.role,
    text: message.text,
    at: message.at,
    ...(message.kind ? { kind: message.kind } : {}),
    ...(message.tool ? { tool: message.tool } : {}),
    ...(message.attachments ? { attachments: message.attachments } : {}),
    channel,
  }));
}

function scheduleChatTitle(
  ctx: RuntimeContext,
  exec: SessionExecutionState,
  text: string,
) {
  ctx.ports.rememberTitleInput(exec.session.id, text);
  ctx.state.initialize?.scheduleTitleGeneration?.(exec.session.id);
}

async function prepareSubmit(ctx: RuntimeContext, input: SubmitInput) {
  const attachments = input.attachments?.length
    ? await ctx.ports
        .resolveService<AttachmentService>(ATTACHMENT_SERVICE)
        ?.store(input.attachments)
    : undefined;
  await ctx.ports.getReady();
  return {
    text: typeof input.text === "string" ? input.text.trim() : "",
    attachments,
    exec: await streamExec(ctx, input.sessionID),
    controller: ctx.ports.resolveService<ProviderModelController>(
      PROVIDER_MODEL_CONTROLLER_SERVICE,
    ),
  };
}

export function createNaviChatSurface(ctx: RuntimeContext): StreamSurface {
  return {
    async messages(sessionID) {
      const exec = await streamExec(ctx, sessionID);
      if (!exec) return [];
      // Chat has no paging UI yet, so project the complete durable log. The
      // shared event window only holds the newest page and can silently drop
      // older chat once the session tail is tool/turn traffic.
      await ensureSessionFullEvents(ctx, exec);
      return projectChatRows("navi", exec.session.events);
    },
    async rollback(input, sessionID) {
      const exec = await streamExec(ctx, sessionID);
      if (!exec) return { rolledBackTo: input.toMessageID, removed: 0 };
      const removed = await removedAfterMessage(
        ctx,
        exec,
        projectedNaviChatMessages,
        input.toMessageID,
      );
      if (removed === undefined)
        return { rolledBackTo: input.toMessageID, removed: 0 };
      ctx.ports.publishForSession(
        exec,
        streamEvent({
          type: "navi.chat.rollback",
          id: `navi:rollback:${Date.now().toString(36)}:${ctx.ports.nextChatSequence()}`,
          toMessageID: input.toMessageID,
          removed,
          at: new Date().toISOString(),
        }),
      );
      return { rolledBackTo: input.toMessageID, removed };
    },
    async modelProfile(sessionID) {
      return (await streamExec(ctx, sessionID))?.naviChatModelProfile ?? {};
    },
    async setModelProfile(profile, sessionID) {
      const exec = await streamExec(ctx, sessionID);
      if (!exec) return { saved: false };
      exec.naviChatModelProfile = profile;
      ctx.ports.publishForSession(
        exec,
        streamEvent({ type: "navi.chat.model.profile", profile }),
      );
      return { saved: true };
    },
    async abort(sessionID) {
      const exec = await streamExec(ctx, sessionID);
      const controller = ctx.ports.resolveService<ProviderModelController>(
        PROVIDER_MODEL_CONTROLLER_SERVICE,
      );
      if (!exec || !controller) return { aborted: false as const };
      const ownerSessionID = exec.session.id as SessionID;
      const aborted = controller.abortNavi(ownerSessionID);
      if (aborted) {
        exec.naviAbortWakePending = true;
        if (exec.naviPendingQueue.length) {
          exec.naviAbortWakePending = false;
          controller.requestNaviWake(ownerSessionID);
        }
      }
      return { aborted };
    },
    async submit(input) {
      const { text, attachments, exec, controller } = await prepareSubmit(
        ctx,
        input,
      );
      if (!text || !exec || !controller) return { messageID: "" };
      scheduleChatTitle(ctx, exec, text);
      const safeText = redactToolOutput(text);
      const userMessageID = `navi-chat:${Date.now().toString(36)}:${ctx.ports.nextChatSequence()}`;
      ctx.ports.publishForSession(
        exec,
        streamEvent({
          type: "navi.chat.message.new",
          id: `${userMessageID}:user`,
          messageID: userMessageID,
          role: "user",
          text: safeText,
          at: new Date().toISOString(),
          ...(attachments ? { attachments } : {}),
        }),
      );
      const responseMessageID = `navi-chat:${Date.now().toString(36)}:${ctx.ports.nextChatSequence()}`;
      if (controller.naviBusy(exec.session.id as SessionID)) {
        exec.naviPendingQueue.push({
          messageID: userMessageID,
          text: safeText,
          attachments,
        });
        if (exec.naviAbortWakePending) {
          exec.naviAbortWakePending = false;
          controller.requestNaviWake(exec.session.id as SessionID);
        }
        return { messageID: userMessageID };
      }
      exec.naviAbortWakePending = false;
      try {
        await controller.runNaviChatTurn({
          sessionID: exec.session.id as SessionID,
          text,
          responseMessageID,
          model: input.model,
          reasoningEffort: input.reasoningEffort,
          attachments,
        });
      } catch (cause) {
        const detail = cause instanceof Error ? cause.message : String(cause);
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
    },
  };
}

export function createNiaChatSurface(ctx: RuntimeContext): StreamSurface {
  return {
    async messages(sessionID) {
      const exec = await streamExec(ctx, sessionID);
      if (!exec) return [];
      // Chat has no paging UI yet, so project the complete durable log. The
      // shared event window only holds the newest page and can silently drop
      // older chat once the session tail is tool/turn traffic.
      await ensureSessionFullEvents(ctx, exec);
      return projectChatRows("nia", exec.session.events);
    },
    async rollback(input, sessionID) {
      const exec = await streamExec(ctx, sessionID);
      if (!exec) return { rolledBackTo: input.toMessageID, removed: 0 };
      const removed = await removedAfterMessage(
        ctx,
        exec,
        projectedNiaChatMessages,
        input.toMessageID,
      );
      if (removed === undefined)
        return { rolledBackTo: input.toMessageID, removed: 0 };
      ctx.ports.publishForSession(
        exec,
        streamEvent({
          type: "nia.chat.rollback",
          id: `nia:rollback:${Date.now().toString(36)}:${ctx.ports.nextChatSequence()}`,
          toMessageID: input.toMessageID,
          removed,
          at: new Date().toISOString(),
        }),
      );
      return { rolledBackTo: input.toMessageID, removed };
    },
    async modelProfile(sessionID) {
      return (await streamExec(ctx, sessionID))?.niaChatModelProfile ?? {};
    },
    async setModelProfile(profile, sessionID) {
      const exec = await streamExec(ctx, sessionID);
      if (!exec) return { saved: false };
      exec.niaChatModelProfile = profile;
      ctx.ports.publishForSession(
        exec,
        streamEvent({ type: "nia.chat.model.profile", profile }),
      );
      return { saved: true };
    },
    async abort(sessionID) {
      const exec = await streamExec(ctx, sessionID);
      const controller = ctx.ports.resolveService<ProviderModelController>(
        PROVIDER_MODEL_CONTROLLER_SERVICE,
      );
      if (!exec || !controller) return { aborted: false as const };
      const ownerSessionID = exec.session.id as SessionID;
      const aborted = controller.abortNia(ownerSessionID);
      if (aborted) {
        exec.niaAbortWakePending = true;
        if (exec.niaPendingQueue.length) {
          exec.niaAbortWakePending = false;
          controller.requestNiaWake(ownerSessionID);
        }
      }
      return { aborted };
    },
    async submit(input) {
      const { text, attachments, exec, controller } = await prepareSubmit(
        ctx,
        input,
      );
      if (!text || !exec || !controller) return { messageID: "" };
      scheduleChatTitle(ctx, exec, text);
      const safeText = redactToolOutput(text);
      const userMessageID = `nia-chat:${Date.now().toString(36)}:${ctx.ports.nextChatSequence()}`;
      ctx.ports.publishForSession(
        exec,
        streamEvent({
          type: "nia.chat.message.new",
          id: `${userMessageID}:user`,
          messageID: userMessageID,
          role: "user",
          text: safeText,
          at: new Date().toISOString(),
          ...(attachments ? { attachments } : {}),
        }),
      );
      const responseMessageID = `nia-chat:${Date.now().toString(36)}:${ctx.ports.nextChatSequence()}`;
      if (controller.niaBusy(exec.session.id as SessionID)) {
        exec.niaPendingQueue.push({
          messageID: userMessageID,
          text: safeText,
          attachments,
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
          attachments,
        });
      } catch (cause) {
        const detail = cause instanceof Error ? cause.message : String(cause);
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
    },
  };
}

export function createChatSurface(ctx: RuntimeContext): Surface {
  const navi = createNaviChatSurface(ctx);
  const nia = createNiaChatSurface(ctx);
  return {
    chatSubmit: ({ channel, ...input }) =>
      channel === "nia" ? nia.submit(input) : navi.submit(input),
    chatAbort: (channel, sessionID) =>
      channel === "nia" ? nia.abort(sessionID) : navi.abort(sessionID),
    chatMessages: (channel, sessionID) =>
      channel === "nia" ? nia.messages(sessionID) : navi.messages(sessionID),
    async chatMessagesPage(input) {
      const exec = await streamExec(ctx, input.sessionID);
      if (!exec) return { data: [], cursor: {} };
      await ensureSessionFullEvents(ctx, exec);
      return paginateTranscript(
        projectChatRows(input.channel ?? "navi", exec.session.events),
        input.cursor,
        input.limit,
        "chat",
      );
    },
    chatRollback: (input, channel, sessionID) =>
      channel === "nia"
        ? nia.rollback(input, sessionID)
        : navi.rollback(input, sessionID),
    chatModelProfile: (channel, sessionID) =>
      channel === "nia"
        ? nia.modelProfile(sessionID)
        : navi.modelProfile(sessionID),
    setChatModelProfile: (profile, channel, sessionID) =>
      channel === "nia"
        ? nia.setModelProfile(profile, sessionID)
        : navi.setModelProfile(profile, sessionID),
  };
}
