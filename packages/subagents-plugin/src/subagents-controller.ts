import { SubagentRegistry, type RunnerCallback } from "@natalia/subagent";

export function createSubagentsController(input: {
  workDir: string;
  sessionID?: () => string | undefined;
}) {
  let registry: SubagentRegistry | undefined;

  async function init(runner: RunnerCallback) {
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

  function get(): SubagentRegistry {
    if (!registry) throw new Error("subagent registry is not initialized");
    return registry;
  }

  function runningCount() {
    return registry?.runningCount() ?? 0;
  }

  return { init, enabled, get, runningCount };
}

export type SubagentsController = ReturnType<typeof createSubagentsController>;
