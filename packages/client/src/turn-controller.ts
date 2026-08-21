import {
  admissionCutoff,
  admittedInputs,
  promoteNextQueued,
  promoteSteers,
} from "@natalia/session";
import type {
  LocalAttachment,
  PromptAgentMention,
  PromptResourceMention,
} from "@natalia/contracts";
import type { SessionRecord } from "@natalia/session";

/**
 * The turn orchestration controller — the scheduling seam of the split
 * (mainline plan §15, knives 6-7). It owns the admit/drain/queue ordering:
 * steer inputs promote in admission order, each promoted input runs one turn,
 * queued inputs drain only when no steer is pending, and a successor drain is
 * woken after a boundary. The heavy machinery (command handling, the provider
 * turn, persistence) is injected as callbacks, so this module is the part
 * that becomes per-session scheduling when multi-session lands (D2: one turn
 * per session, sessions in parallel, workspace writes serialised — the
 * coordinator `sessionRunCoordinator` already keys by session id).
 *
 * Plan §41.9: `session()`, `activeAbort()`, the persistence chain and the
 * command/turn runners are accessors and callbacks, never captured values.
 */
export type TurnControllerInput = {
  session(): SessionRecord | undefined;
  activeAbort(): AbortController | undefined;
  /** D2: the session a drain belongs to — parallel sessions have their own. */
  sessionFor(sessionID: string): SessionRecord | undefined;
  activeAbortFor(sessionID: string): AbortController | undefined;
  /** Queues a persistence step on the runtime's durable-write chain. */
  persist(fn: () => Promise<void>): Promise<void>;
  /** Persists the promoted inbox state (sqlite vs JSON decided by the runtime). */
  saveInbox(snapshot: SessionRecord): Promise<void>;
  /** Waits for all queued persistence steps to land. */
  flush(): Promise<void>;
  runCommand(
    id: string,
    text: string,
    signal: AbortSignal | undefined,
    sessionID: string,
  ): Promise<boolean>;
  runTurn(input: {
    id: string;
    text: string;
    sessionID: string;
    attachments: LocalAttachment[];
    resources: PromptResourceMention[];
    agents: PromptAgentMention[];
    internal?: boolean;
  }): Promise<void>;
};

export function createTurnController(input: TurnControllerInput) {
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
      const inputs = promoteSteers(session, admissionCutoff(session));
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
          (entry) => !entry.promotedAt && entry.delivery === "steer",
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
          (entry) => !entry.promotedAt && entry.delivery === "steer",
        )
      )
        return;
      const [next] = promoteNextQueued(session);
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

  /** Persists the promoted-inbox snapshot (used by the runtime's own submit path). */
  async function persistPromotion(sessionID = input.session()?.id ?? "") {
    await persistInboxPromotion(sessionID);
  }

  function dispose() {
    disposed = true;
  }

  return { drain, drainQueue, admit, persistPromotion, dispose };
}

export type TurnController = ReturnType<typeof createTurnController>;
