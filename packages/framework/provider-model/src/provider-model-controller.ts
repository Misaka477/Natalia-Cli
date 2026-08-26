import type { RuntimeEvent, SessionID } from "@natalia/contracts";
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
  const chatAborts = new Map<SessionID, AbortController>();
  const chatTasks = new Map<SessionID, Promise<void>>();
  const chatWakePending = new Set<SessionID>();
  const chatWakeTasks = new Map<SessionID, Promise<void>>();
  let disposed = false;

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
    if (!input.chat.available(turn.sessionID))
      throw new Error("provider unavailable for live work chat");
    if (chatAborts.has(turn.sessionID)) {
      if (turn.internal) return;
      throw new Error("live work chat is already busy for this session");
    }

    const startedAt = Date.now();
    input.chat.publish(turn.sessionID, {
      type: "chat.turn.started",
      id: `${turn.responseMessageID}:started`,
      messageID: turn.responseMessageID,
      startedAt,
      ...(turn.internal ? { internal: true } : {}),
    });
    const abort = new AbortController();
    chatAborts.set(turn.sessionID, abort);
    const task = input.chat.runBody(turn, abort.signal);
    chatTasks.set(turn.sessionID, task);
    try {
      await task;
      input.chat.publish(turn.sessionID, {
        type: "chat.turn.finished",
        id: `${turn.responseMessageID}:finished`,
        messageID: turn.responseMessageID,
        stopReason: "done",
        startedAt,
        endedAt: Date.now(),
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
      });
      throw cause;
    } finally {
      if (chatTasks.get(turn.sessionID) === task)
        chatTasks.delete(turn.sessionID);
      if (chatAborts.get(turn.sessionID) === abort)
        chatAborts.delete(turn.sessionID);
    }
  }

  function requestChatWake(sessionID: SessionID) {
    if (disposed) return;
    chatWakePending.add(sessionID);
    if (chatWakeTasks.has(sessionID)) return;
    const task = (async () => {
      while (chatWakePending.delete(sessionID) && !disposed) {
        await chatTasks.get(sessionID)?.catch(() => undefined);
        if (!disposed && input.chat.available(sessionID))
          await input.chat.wake(sessionID);
      }
    })().finally(() => {
      if (chatWakeTasks.get(sessionID) === task)
        chatWakeTasks.delete(sessionID);
      if (chatWakePending.has(sessionID) && !disposed)
        requestChatWake(sessionID);
    });
    chatWakeTasks.set(sessionID, task);
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

  function chatBusy(sessionID: SessionID) {
    return chatAborts.has(sessionID);
  }

  function abortChat(sessionID: SessionID) {
    const abort = chatAborts.get(sessionID);
    if (!abort) return false;
    abort.abort(new Error("live work chat aborted"));
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
