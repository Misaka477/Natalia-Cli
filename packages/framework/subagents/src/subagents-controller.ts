import { SubagentRegistry } from "./registry";
import type {
  SubagentRunnerContext,
  SubagentToolService,
} from "@natalia/tools";
import type { SubagentsService } from "@natalia/runtime-services";

type SubagentRunner = (
  task: string,
  context: SubagentRunnerContext,
) => void | Promise<void>;

type SubagentsController = SubagentsService;

export function createSubagentsController(input: {
  workDir: string;
  sessionID?: () => string | undefined;
  /** Milliseconds one run may take; 0 disables the budget. */
  wallClockBudgetMs?: number;
}): SubagentsController {
  let registry: SubagentRegistry | undefined;
  /**
   * Live-delivery hooks keyed by subagent id, supplied by the runtime that owns
   * the subagent's ledger. Only a hook can reach a running child, so a target
   * without one is the queued case — never a silently dropped message.
   */
  const steerHooks = new Map<
    string,
    (message: string) => "delivered" | "resumed" | undefined
  >();

  async function init(runner: SubagentRunner) {
    const next = new SubagentRegistry({
      workDir: input.workDir,
      runner,
      sessionID: input.sessionID?.(),
      wallClockBudgetMs: input.wallClockBudgetMs,
    });
    await next.load();
    registry = next;
  }

  /**
   * Install or clear the live-delivery hook for one subagent.
   *
   * The runtime that owns the child's ledger is the only thing that can reach
   * it, so it installs the hook for the duration of the child's run and clears
   * it when the run ends — after which a message queues instead of vanishing.
   */
  function setSteerHook(
    id: string,
    hook:
      | ((message: string) => "delivered" | "resumed" | undefined)
      | undefined,
  ) {
    if (hook) steerHooks.set(id, hook);
    else steerHooks.delete(id);
  }

  function enabled() {
    return registry !== undefined;
  }

  function requireRegistry(): SubagentRegistry {
    if (!registry) throw new Error("subagent registry is not initialized");
    return registry;
  }

  function runningCount() {
    return registry?.runningCount() ?? 0;
  }

  return {
    init,
    enabled,
    spawn: async (task, options) =>
      await requireRegistry().spawn(task, options),
    list: () => requireRegistry().list(),
    runningCount,
    get: (id) => requireRegistry().get(id),
    status: (id) => requireRegistry().status(id),
    health: (id) => requireRegistry().health(id),
    requestStop: (id, reason, force) =>
      requireRegistry().requestStop(id, reason, force),
    stop: (id) => requireRegistry().stop(id),
    resume: async (id) => await requireRegistry().resume(id),
    setPendingMessages: (id, messages) =>
      requireRegistry().setPendingMessages(id, messages),
    setSteerHook,
    sendMessage: async (id, message, callerSession) => {
      const registry = requireRegistry();
      const record = registry.get(id);
      if (!record) return { route: "not_found" };
      // Only the parent may steer: a spawner is recorded on the record, and
      // anything else is a stranger that has no business redirecting this child.
      if (
        record.parentSessionID !== undefined &&
        callerSession !== undefined &&
        record.parentSessionID !== callerSession
      )
        throw new Error(
          `subagent ${id} belongs to another session; only its parent may steer it`,
        );
      // The client supplies the live-ledger routing through this hook; absent
      // one the message is queued rather than dropped, so the parent is never
      // told it steered when it did not.
      const routed = steerHooks.get(id)?.(message);
      if (routed) return { route: routed };
      registry.setPendingMessages(id, [
        ...(record.pendingMessages ?? []),
        message,
      ]);
      return { route: "queued" };
    },
    retry: async (id) => await requireRegistry().retry(id),
    attach: (id) => requireRegistry().attach(id),
    detach: (id) => requireRegistry().detach(id),
    cleanup: (dryRun) => requireRegistry().cleanup(dryRun),
    audit: (tail, format) => requireRegistry().audit(tail, format),
    subscribe: (fn) => requireRegistry().subscribe(fn),
    formatList: async () => await requireRegistry().formatList(),
    formatOutput: async (id, verbose) =>
      await requireRegistry().formatOutput(id, verbose),
    formatStatus: async (id) => await requireRegistry().formatStatus(id),
    wait: async (ids, until, timeoutMs, signal) =>
      await requireRegistry().wait(ids, until, timeoutMs, signal),
  } satisfies SubagentsController;
}
