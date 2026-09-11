import type {
  LocalAttachment,
  PromptAgentMention,
  PromptResourceMention,
} from "@natalia/contracts";
import {
  admissionCutoff,
  admittedInputs,
  promoteNextSteps,
  promoteNextTurn,
  type SessionRecord,
} from "@natalia/session";
import type {
  TurnController,
  TurnControllerInput,
} from "@natalia/runtime-services";

export function createTurnController(
  input: TurnControllerInput,
): TurnController {
  let disposed = false;

  function assertActive() {
    if (disposed) throw new Error("turn orchestration controller disposed");
  }

  async function persistInboxPromotion(sessionID: string) {
    assertActive();
    const session = input.sessionFor(sessionID);
    if (!session) return;
    const snapshot = structuredClone(session);
    await input.persist(() => input.saveInbox(snapshot));
  }

  async function drain(signal: AbortSignal, sessionID: string) {
    assertActive();
    const session = input.sessionFor(sessionID);
    if (!session) return;
    const abort = () => input.activeAbortFor(sessionID)?.abort(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    try {
      if (signal.aborted) throw signal.reason;
      const inputs = promoteNextSteps(session, admissionCutoff(session));
      if (inputs.length) await persistInboxPromotion(sessionID);
      for (const item of inputs) {
        if (signal.aborted) throw signal.reason;
        await admit(
          sessionID,
          item.id,
          item.text,
          item.attachments,
          item.resources,
          item.agents,
          item.internal,
          signal,
        );
      }
      if (
        !admittedInputs(session).some(
          (entry) => !entry.promotedAt && entry.delivery === "next-step",
        )
      )
        await drainQueue(signal, sessionID);
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }

  async function drainQueue(
    signal: AbortSignal | undefined,
    sessionID: string,
  ) {
    assertActive();
    const session = input.sessionFor(sessionID);
    if (!session) return;
    while (true) {
      if (signal?.aborted) throw signal.reason;
      if (
        admittedInputs(session).some(
          (entry) => !entry.promotedAt && entry.delivery === "next-step",
        )
      )
        return;
      const [next] = promoteNextTurn(session);
      if (!next) return;
      await persistInboxPromotion(sessionID);
      if (signal?.aborted) throw signal.reason;
      await admit(
        sessionID,
        next.id,
        next.text,
        next.attachments,
        next.resources,
        next.agents,
        next.internal,
        signal,
      );
    }
  }

  async function admit(
    sessionID: string,
    id: string,
    text: string,
    attachments: LocalAttachment[] = [],
    resources: PromptResourceMention[] = [],
    agents: PromptAgentMention[] = [],
    internal?: boolean,
    signal?: AbortSignal,
  ) {
    assertActive();
    if (await input.runCommand(id, text, signal, sessionID)) {
      await input.flush();
      return;
    }
    await input.runTurn({
      id,
      text,
      sessionID,
      attachments,
      resources,
      agents,
      internal,
    });
  }

  async function persistPromotion(sessionID = input.session()?.id ?? "") {
    await persistInboxPromotion(sessionID);
  }

  function dispose() {
    disposed = true;
  }

  return { drain, drainQueue, admit, persistPromotion, dispose };
}
