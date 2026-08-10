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
export function createTurnController(input: {
  session(): SessionRecord | undefined;
  activeAbort(): AbortController | undefined;
  /** Queues a persistence step on the runtime's durable-write chain. */
  persist(fn: () => Promise<void>): Promise<void>;
  /** Persists the promoted inbox state (sqlite vs JSON decided by the runtime). */
  saveInbox(snapshot: SessionRecord): Promise<void>;
  /** Waits for all queued persistence steps to land. */
  flush(): Promise<void>;
  runCommand(id: string, text: string): Promise<boolean>;
  runTurn(input: {
    id: string;
    text: string;
    attachments: LocalAttachment[];
    resources: PromptResourceMention[];
    agents: PromptAgentMention[];
  }): Promise<void>;
}) {
  async function persistInboxPromotion() {
    const session = input.session();
    if (!session) return;
    const snapshot = structuredClone(session);
    await input.persist(() => input.saveInbox(snapshot));
  }

  async function drain(signal: AbortSignal) {
    const session = input.session();
    if (!session) return;
    const abort = () => input.activeAbort()?.abort(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    try {
      if (signal.aborted) throw signal.reason;
      const inputs = promoteSteers(session, admissionCutoff(session));
      if (inputs.length) await persistInboxPromotion();
      for (const item of inputs) {
        if (signal.aborted) throw signal.reason;
        await admit(
          item.id,
          item.text,
          item.attachments,
          item.resources,
          item.agents,
        );
      }
      if (
        !admittedInputs(session).some(
          (entry) => !entry.promotedAt && entry.delivery === "steer",
        )
      )
        await drainQueue(signal);
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }

  async function drainQueue(signal?: AbortSignal) {
    const session = input.session();
    if (!session) return;
    if (signal?.aborted) throw signal.reason;
    const [next] = promoteNextQueued(session);
    if (!next) return;
    await persistInboxPromotion();
    await admit(
      next.id,
      next.text,
      next.attachments,
      next.resources,
      next.agents,
    );
  }

  async function admit(
    id: string,
    text: string,
    attachments: LocalAttachment[] = [],
    resources: PromptResourceMention[] = [],
    agents: PromptAgentMention[] = [],
  ) {
    if (await input.runCommand(id, text)) {
      await input.flush();
      return;
    }
    await input.runTurn({ id, text, attachments, resources, agents });
  }

  return { drain, drainQueue, admit };
}
