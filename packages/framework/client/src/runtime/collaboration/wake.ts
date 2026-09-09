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
import { streamEvent } from "./chat-turn-common";

export function createCollaborationWake(ctx: RuntimeContext) {
  return {
    wakeMainForCollaboration,
    scheduleInternalWake,
    requestNaviWake,
    wakeNavi,
    requestNiaWake,
    wakeNia,
  };

  function wakeMainForCollaboration(
    exec: SessionExecutionState,
    sourceID: string,
    kind: string,
    source: "Navi" | "Nia" = "Navi",
  ) {
    if (ctx.ports.isDisposed()) return;
    const coordinator = sessionRunCoordinator(exec.session.id as SessionID);
    const delivery = coordinator.active ? "queue" : "steer";
    console.log("[collab-wake-main]", {
      source,
      kind,
      sourceID,
      sessionID: exec.session.id,
      delivery,
      coordinatorActive: coordinator.active,
    });
    scheduleInternalWake(exec, {
      id: `turn_collab_${sourceID.replace(/[^a-zA-Z0-9]/gu, "_")}`,
      text:
        source === "Nia"
          ? `(internal collaboration wake: Nia sent a ${kind}; read her audit findings in <nia_collaborations>, perform the required remediation work now, then reply to Nia with what you changed. Do not acknowledge with chat alone. This is not a user message.)`
          : `(internal collaboration wake: ${source} sent a ${kind}; read the collaboration context. This is not a user message.)`,
      delivery,
    });
  }

  function scheduleInternalWake(
    exec: SessionExecutionState,
    input: SubmitInput,
  ) {
    const { isDisposed, submitInput } = ctx.ports;
    const { internalWakeTasks } = ctx.state;
    if (isDisposed()) return;
    console.log("[collab-wake-submit] scheduling", {
      id: input.id,
      sessionID: exec.session.id,
      delivery: input.delivery,
      text: input.text.slice(0, 160),
    });
    const task = submitInput(
      { ...input, internal: true },
      exec.session.id as SessionID,
    )
      .then((submitted) => {
        console.log("[collab-wake-submit] admitted", {
          id: input.id,
          sessionID: exec.session.id,
          submittedID: submitted?.id,
        });
        return submitted;
      })
      .catch((error) => {
        console.error("[collab-wake-submit] FAILED", {
          id: input.id,
          sessionID: exec.session.id,
          error: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => internalWakeTasks.delete(task));
    internalWakeTasks.add(task);
  }

  function requestNaviWake(exec: SessionExecutionState) {
    console.log("[navi-wake] requestNaviWake", { sessionID: exec.session.id });
    ctx.ports
      .resolveService<ProviderModelController>(
        PROVIDER_MODEL_CONTROLLER_SERVICE,
      )
      ?.requestNaviWake(exec.session.id as SessionID);
  }

  async function wakeNavi(exec: SessionExecutionState) {
    console.log("[navi-wake] wakeNavi start", { sessionID: exec.session.id });
    const { publishForSession, nextChatSequence } = ctx.ports;
    const controller = ctx.ports.resolveService<ProviderModelController>(
      PROVIDER_MODEL_CONTROLLER_SERVICE,
    );
    if (!controller) return;
    const responseMessageID = `chat:${Date.now().toString(36)}:${nextChatSequence()}`;
    const expert = exec.advisorPending === true;
    const expertProfile = exec.chatModelProfile?.navi?.expert;
    if (expert) {
      publishForSession(
        exec,
        streamEvent({
          type: "navi.chat.message.new",
          id: `${responseMessageID}:advisor`,
          messageID: responseMessageID,
          role: "user",
          text: "(internal advisor request: Natalia hit a problem and needs expert guidance. Read the Main context and give concise technical advice.)",
          at: new Date().toISOString(),
        }),
      );
      exec.advisorPending = false;
    }
    try {
      await controller.runNaviChatTurn({
        sessionID: exec.session.id as SessionID,
        text: "",
        responseMessageID,
        internal: true,
        ...(expert && expertProfile?.modelID
          ? {
              model: {
                modelID: expertProfile.modelID,
                variant: expertProfile.variant,
              },
            }
          : {}),
        reasoningEffort: expert ? expertProfile?.reasoningEffort : undefined,
      });
    } catch (cause) {
      publishForSession(
        exec,
        streamEvent({
          type: "navi.chat.message.new",
          id: `${responseMessageID}:chat`,
          messageID: responseMessageID,
          role: "chat",
          text: `(live work chat error: ${
            cause instanceof Error ? cause.message : String(cause)
          })`,
          at: new Date().toISOString(),
        }),
      );
    }
  }

  function requestNiaWake(exec: SessionExecutionState) {
    if (ctx.ports.isDisposed()) return;
    console.log("[nia-wake] requestNiaWake", {
      sessionID: exec.session.id,
    });
    ctx.ports
      .resolveService<ProviderModelController>(
        PROVIDER_MODEL_CONTROLLER_SERVICE,
      )
      ?.requestNiaWake(exec.session.id as SessionID);
  }

  async function wakeNia(exec: SessionExecutionState) {
    const { nextChatSequence, publishForSession } = ctx.ports;
    const controller = ctx.ports.resolveService<ProviderModelController>(
      PROVIDER_MODEL_CONTROLLER_SERVICE,
    );
    if (!controller) {
      console.warn("[nia-wake] wakeNia skipped: controller unavailable", {
        sessionID: exec.session.id,
      });
      return;
    }
    const responseMessageID = `chat:${Date.now().toString(36)}:${nextChatSequence()}`;
    console.log("[nia-wake] wakeNia start", {
      sessionID: exec.session.id,
      responseMessageID,
      model: exec.chatModelProfile?.nia?.normal?.modelID,
    });
    try {
      const normalProfile = exec.chatModelProfile?.nia?.normal;
      await controller.runNiaChatTurn({
        sessionID: exec.session.id as SessionID,
        text: "",
        responseMessageID,
        internal: true,
        ...(normalProfile?.modelID
          ? {
              model: {
                modelID: normalProfile.modelID,
                variant: normalProfile.variant,
              },
            }
          : {}),
        reasoningEffort: normalProfile?.reasoningEffort,
      });
    } catch (cause) {
      publishForSession(
        exec,
        streamEvent({
          type: "nia.chat.message.new",
          id: `${responseMessageID}:chat`,
          messageID: responseMessageID,
          role: "chat",
          text: `(Nia wake error: ${
            cause instanceof Error ? cause.message : String(cause)
          })`,
          at: new Date().toISOString(),
        }),
      );
    }
  }
}
