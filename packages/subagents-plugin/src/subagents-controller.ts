import { SubagentRegistry } from "@natalia/subagent";
import type {
  SubagentRunnerContext,
  SubagentToolService,
} from "@natalia/tools";

type SubagentRunner = (
  task: string,
  context: SubagentRunnerContext,
) => void | Promise<void>;

export interface SubagentsController extends SubagentToolService {
  init(runner: SubagentRunner): Promise<void>;
  enabled(): boolean;
}

export function createSubagentsController(input: {
  workDir: string;
  sessionID?: () => string | undefined;
}): SubagentsController {
  let registry: SubagentRegistry | undefined;

  async function init(runner: SubagentRunner) {
    const next = new SubagentRegistry({
      workDir: input.workDir,
      runner,
      sessionID: input.sessionID?.(),
    });
    await next.load();
    registry = next;
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
