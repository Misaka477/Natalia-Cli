import type { ChatChannel, RuntimeEvent, SessionID } from "@natalia/contracts";
import type {
  ProviderChatTurnInput,
  ProviderModelController,
  ProviderModelControllerInput,
  ProviderRunnerInput,
  ProviderTurnInput,
} from "@natalia/runtime-services";
import { createProviderRunner } from "./provider-runner";

export function createProviderModelController(
  input: ProviderModelControllerInput,
): ProviderModelController {
  const runners = new Map<SessionID, ReturnType<typeof createProviderRunner>>();
  const chatAborts = new Map<ChatKey, AbortController>();
  const chatTasks = new Map<ChatKey, Promise<void>>();
  const chatWakePending = new Set<ChatKey>();
  const chatWakeTasks = new Map<ChatKey, Promise<void>>();
  let disposed = false;
  type ChatKey = string;
  const chatKey = (sessionID: SessionID, channel: ChatChannel | undefined) =>
    `${sessionID}:${channel ?? "navi"}`;

  input.initialize();

  function runnerFor(sessionID: SessionID) {
    const existing = runners.get(sessionID);
    if (existing) return existing;
    const runner = createProviderRunner(input.runnerInput(sessionID));
    runners.set(sessionID, runner);
    return runner;
  }

  async function runTurn(sessionID: SessionID, turn: ProviderTurnInput) {
    if (disposed) throw new Error("provider/model controller disposed");
    await runnerFor(sessionID).runTurn(turn);
  }

  async function runChatTurn(turn: ProviderChatTurnInput) {
    if (disposed) throw new Error("provider/model controller disposed");
    const channel = turn.channel ?? "navi";
    const key = chatKey(turn.sessionID, channel);
    if (!input.chat.available(turn.sessionID))
      throw new Error("provider unavailable for live work chat");
    if (chatAborts.has(key)) {
      if (turn.internal) return;
      throw new Error(`${channel} is already busy for this session`);
    }

    const startedAt = Date.now();
    input.chat.publish(turn.sessionID, {
      type: "chat.turn.started",
      id: `${turn.responseMessageID}:started`,
      messageID: turn.responseMessageID,
      startedAt,
      ...(turn.internal ? { internal: true } : {}),
      ...(channel ? { channel } : {}),
    });
    const abort = new AbortController();
    chatAborts.set(key, abort);
    const task = input.chat.runBody(turn, abort.signal);
    chatTasks.set(key, task);
    try {
      await task;
      input.chat.publish(turn.sessionID, {
        type: "chat.turn.finished",
        id: `${turn.responseMessageID}:finished`,
        messageID: turn.responseMessageID,
        stopReason: "done",
        startedAt,
        endedAt: Date.now(),
        ...(channel ? { channel } : {}),
      });
    } catch (cause) {
      input.chat.publish(turn.sessionID, {
        type: "chat.turn.finished",
        id: `${turn.responseMessageID}:finished`,
        messageID: turn.responseMessageID,
        stopReason: abort.signal.aborted ? "cancelled" : "error",
        startedAt,
        endedAt: Date.now(),
        ...(!abort.signal.aborted
          ? { error: cause instanceof Error ? cause.message : String(cause) }
          : {}),
        ...(channel ? { channel } : {}),
      });
      throw cause;
    } finally {
      if (chatTasks.get(key) === task)
        chatTasks.delete(key);
      if (chatAborts.get(key) === abort)
        chatAborts.delete(key);
    }
  }

  function requestChatWake(sessionID: SessionID, channel?: ChatChannel) {
    if (disposed) return;
    const key = chatKey(sessionID, channel);
    chatWakePending.add(key);
    if (chatWakeTasks.has(key)) return;
    const task = (async () => {
      while (chatWakePending.delete(key) && !disposed) {
        await chatTasks.get(key)?.catch(() => undefined);
        if (!disposed && input.chat.available(sessionID))
          await input.chat.wake(sessionID);
      }
    })().finally(() => {
      if (chatWakeTasks.get(key) === task)
        chatWakeTasks.delete(key);
      if (chatWakePending.has(key) && !disposed)
        requestChatWake(sessionID, channel);
    });
    chatWakeTasks.set(key, task);
  }

  async function dispose() {
    if (disposed) return;
    disposed = true;
    chatWakePending.clear();
    for (const abort of chatAborts.values())
      abort.abort(new Error("provider/model controller disposed"));
    await Promise.allSettled([
      ...chatTasks.values(),
      ...chatWakeTasks.values(),
    ]);
    runners.clear();
  }

  function chatBusy(sessionID: SessionID, channel?: ChatChannel) {
    return chatAborts.has(chatKey(sessionID, channel));
  }

  function abortChat(sessionID: SessionID, channel?: ChatChannel) {
    const abort = chatAborts.get(chatKey(sessionID, channel));
    if (!abort) return false;
    abort.abort(new Error(`${channel ?? "navi"} aborted`));
    return true;
  }

  return {
    runTurn,
    runChatTurn,
    requestChatWake,
    chatBusy,
    abortChat,
    dispose,
  };
}
