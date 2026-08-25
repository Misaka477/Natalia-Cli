/**
 * Collaboration wake scheduling — runtime/collaboration/wake.ts.
 *
 * The main-agent wake (a queued/steered internal collaboration turn), the
 * tracking of in-flight internal wake tasks, the chat-runtime wake request,
 * and Navi's own wake turn. Reads live state through `RuntimeContext` at call
 * time.
 */
import { sessionRunCoordinator } from "@natalia/session";
import {
  PROVIDER_MODEL_CONTROLLER_SERVICE,
  type ProviderModelController,
} from "@natalia/runtime-services";
import type { SessionID, SubmitInput } from "@natalia/contracts";
import type { RuntimeContext } from "../context";
import type { SessionExecutionState } from "../context";

export function createCollaborationWake(ctx: RuntimeContext) {
  return {
    wakeMainForCollaboration,
    scheduleInternalWake,
    requestNaviWake,
    wakeNavi,
  };

  function wakeMainForCollaboration(
    exec: SessionExecutionState,
    sourceID: string,
    kind: string,
  ) {
    if (ctx.ports.isDisposed()) return;
    const coordinator = sessionRunCoordinator(exec.session.id as SessionID);
    scheduleInternalWake(exec, {
      id: `turn_collab_${sourceID.replace(/[^a-zA-Z0-9]/gu, "_")}`,
      text: `(internal collaboration wake: Navi sent a ${kind}; read the collaboration context. This is not a user message.)`,
      delivery: coordinator.active ? "queue" : "steer",
    });
  }

  function scheduleInternalWake(
    exec: SessionExecutionState,
    input: SubmitInput,
  ) {
    const { isDisposed, submitInput } = ctx.ports;
    const { internalWakeTasks } = ctx.state;
    if (isDisposed()) return;
    const task = submitInput(
      { ...input, internal: true },
      exec.session.id as SessionID,
    )
      .catch(() => undefined)
      .finally(() => internalWakeTasks.delete(task));
    internalWakeTasks.add(task);
  }

  function requestNaviWake(exec: SessionExecutionState) {
    ctx.ports
      .resolveService<ProviderModelController>(
        PROVIDER_MODEL_CONTROLLER_SERVICE,
      )
      ?.requestChatWake(exec.session.id as SessionID);
  }

  async function wakeNavi(exec: SessionExecutionState) {
    const { publishForSession, nextChatSequence } = ctx.ports;
    const controller = ctx.ports.resolveService<ProviderModelController>(
      PROVIDER_MODEL_CONTROLLER_SERVICE,
    );
    if (!exec.provider || !controller) return;
    const responseMessageID = `chat:${Date.now().toString(36)}:${nextChatSequence()}`;
    try {
      await controller.runChatTurn({
        sessionID: exec.session.id as SessionID,
        text: "",
        responseMessageID,
        internal: true,
      });
    } catch (cause) {
      publishForSession(exec, {
        type: "chat.message.added",
        id: `${responseMessageID}:chat`,
        messageID: responseMessageID,
        role: "chat",
        text: `(live work chat error: ${
          cause instanceof Error ? cause.message : String(cause)
        })`,
        at: new Date().toISOString(),
      });
    }
  }
}
