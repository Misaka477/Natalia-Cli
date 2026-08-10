import { SubagentRegistry, type RunnerCallback } from "@natalia/subagent";

/**
 * The subagents resource controller — cut of the resource controllers split
 * (mainline plan §15). It owns the `SubagentRegistry` and its lifecycle
 * (construction and recovery load). The runner callback stays with the
 * runtime — it closes over provider, tools and policy — and is injected at
 * init. Multi-session shape (plan §41.9): the registry is reached by
 * accessor, and exactly one instance is installed today.
 */
export function createSubagentsController(input: { workDir: string }) {
  let registry: SubagentRegistry | undefined;

  async function init(runner: RunnerCallback) {
    const next = new SubagentRegistry({
      workDir: input.workDir,
      runner,
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
