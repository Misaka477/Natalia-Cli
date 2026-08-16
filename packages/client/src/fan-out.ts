/**
 * Fan-out orchestration (agent-team T-3, first slice).
 *
 * Takes the decomposed tasks (contract-first output), spawns each as a
 * sandboxed sub-agent in parallel, waits for all of them, and produces one PR
 * per completed sub-agent: the diff of its own sandbox worktree plus its
 * result. The provider-concurrency limiter (T-1) bounds the actual parallel
 * streams; the sub-agents run concurrently through the registry.
 *
 * The PR queue is what T-4's lead review consumes. The decomposition itself —
 * the contract-first step that produces the ownership map and these tasks — is
 * the orchestrator's job and is driven separately; this is the mechanical
 * fan-out core.
 */
import type { RuntimeEvent } from "@natalia/contracts";
import type { SubagentRegistry } from "@natalia/subagent";
import type { WorkspaceSandboxManager, SandboxChange } from "@natalia/sandbox";

export type FanOutTask = {
  id: string;
  prompt: string;
  /** The ownership map's domain: paths (relative to the worktree) this task may write. */
  writePaths?: string[];
  allowedTools?: string[];
  excludeTools?: string[];
};

export type FanOutPR = {
  id: string;
  sandboxID: string;
  status: "completed" | "failed" | "stopped";
  /** The candidate's diff against its base — what a lead reviews. */
  diff: SandboxChange[];
  result?: string;
};

const TERMINAL = new Set(["completed", "failed", "stopped"]);

/**
 * Spawns every task as a sandboxed sub-agent, waits for all of them, and
 * returns one PR per task.
 */
export async function runFanOut(input: {
  tasks: FanOutTask[];
  subagents: SubagentRegistry;
  sandboxes: WorkspaceSandboxManager;
  publish?: (event: RuntimeEvent) => void;
  timeoutMs?: number;
}): Promise<FanOutPR[]> {
  const spawned = await Promise.all(
    input.tasks.map(async (task) => ({
      task,
      record: await input.subagents.spawn(task.prompt, {
        mode: "sandbox",
        writePaths: task.writePaths,
        allowedTools: task.allowedTools,
        excludeTools: task.excludeTools,
      }),
    })),
  );
  input.publish?.({
    type: "diagnostic",
    level: "info",
    message: `fan-out spawned ${spawned.length} sandboxed sub-agents in parallel`,
  });
  await waitForAllTerminal(
    input.subagents,
    spawned.map(({ record }) => record.id),
    input.timeoutMs ?? 120_000,
  );
  const prs: FanOutPR[] = [];
  for (const { task, record } of spawned) {
    const status =
      (input.subagents.status(record.id) as FanOutPR["status"]) ?? "failed";
    // A completed candidate's worktree holds its diff for the lead to review.
    const diff =
      status === "completed"
        ? await input.sandboxes
            .previewMerge(record.id)
            .catch(() => [] as SandboxChange[])
        : [];
    prs.push({
      id: task.id,
      sandboxID: record.id,
      status,
      diff,
      result: record.outputs.map((entry) => entry.text).join("\n"),
    });
  }
  return prs;
}

async function waitForAllTerminal(
  registry: SubagentRegistry,
  ids: string[],
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (ids.every((id) => TERMINAL.has(registry.status(id) ?? ""))) return;
    await Bun.sleep(50);
  }
  const stuck = ids.filter((id) => !TERMINAL.has(registry.status(id) ?? ""));
  throw new Error(
    `fan-out timed out waiting for sub-agents: ${stuck.join(", ")}`,
  );
}
