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
  /**
   * Build evidence: a validation command run in the candidate worktree before
   * the PR is ready. Present when a build command was configured.
   */
  buildEvidence?: { ok: boolean; exitCode: number; output: string };
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
  /**
   * Build command run in each completed candidate's worktree — the build
   * evidence gate. A candidate that fails it is still reported as a PR, with
   * the failing output as the reason (a lead reviews or rejects on it).
   */
  buildCommand?: string;
  /** Maximum concurrent sub-agents; absent = spawn all at once. */
  maxConcurrent?: number;
}): Promise<FanOutPR[]> {
  const cap = Math.min(
    input.maxConcurrent ?? input.tasks.length,
    input.tasks.length,
  );
  const spawned = await spawnWithConcurrency(input.tasks, cap, (task) =>
    input.subagents.spawn(task.prompt, {
      mode: "sandbox",
      writePaths: task.writePaths,
      allowedTools: task.allowedTools,
      excludeTools: task.excludeTools,
    }),
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
  for (const { item: task, record } of spawned) {
    const status =
      (input.subagents.status(record.id) as FanOutPR["status"]) ?? "failed";
    // A completed candidate's worktree holds its diff for the lead to review.
    const diff =
      status === "completed"
        ? await input.sandboxes
            .previewMerge(record.id)
            .catch(() => [] as SandboxChange[])
        : [];
    const buildEvidence =
      status === "completed" && input.buildCommand
        ? await input.sandboxes
            .validate(record.id, input.buildCommand)
            .catch(() => ({
              ok: false,
              exitCode: -1,
              output: "validate failed",
            }))
        : undefined;
    prs.push({
      id: task.id,
      sandboxID: record.id,
      status,
      diff,
      result: record.outputs.map((entry) => entry.text).join("\n"),
      ...(buildEvidence ? { buildEvidence } : {}),
    });
  }
  return prs;
}

async function spawnWithConcurrency<T, R>(
  items: T[],
  limit: number,
  spawn: (item: T) => Promise<R>,
): Promise<Array<{ item: T; record: R }>> {
  const results: Array<{ item: T; record: R }> = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = {
        item: items[index]!,
        record: await spawn(items[index]!),
      };
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, limit) }, worker));
  return results;
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

/**
 * Validates a decomposed ownership map — the contract-first output's disjoint
 * guarantee. Every write domain belongs to exactly one task, and no domain is
 * a prefix of another (an overlap that would let two tasks touch the same
 * file). Decomposition quality is the fan-out's success condition; this is the
 * mechanical gate an orchestrator runs before spawning.
 */
export function validateOwnershipMap(input: { tasks: FanOutTask[] }): {
  ok: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const domains = input.tasks.flatMap((task) =>
    (task.writePaths ?? []).map((domain) => ({
      task: task.id,
      domain: domain.endsWith("/") ? domain : `${domain}/`,
    })),
  );
  for (let index = 0; index < domains.length; index++) {
    for (let other = index + 1; other < domains.length; other++) {
      const a = domains[index]!;
      const b = domains[other]!;
      if (a.task === b.task) continue;
      if (b.domain.startsWith(a.domain) || a.domain.startsWith(b.domain))
        issues.push(
          `overlapping domains: ${a.task} (${a.domain}) and ${b.task} (${b.domain})`,
        );
    }
  }
  return { ok: issues.length === 0, issues };
}

export type PRReviewDecision = {
  id: string;
  decision: "approve" | "request-changes";
  reason?: string;
};

export type PRReviewOutcome = {
  id: string;
  decision: "approve" | "request-changes";
  reason?: string;
  /** The promoted changes when approved and merged. */
  merged?: SandboxChange[];
};

/**
 * The PR review loop (T-4): a lead decides each PR one at a time — incremental,
 * so each review sees one candidate's diff and evidence, never the whole batch.
 * An approved PR is promoted into the system slot (the sandbox backend's
 * merge); a request-changes PR is returned with the reason, and its candidate
 * stays for the sub-agent to redo.
 */
export async function reviewPRs(input: {
  prs: FanOutPR[];
  sandboxes: WorkspaceSandboxManager;
  workspaceRoot: string;
  decide: (pr: FanOutPR) => Promise<PRReviewDecision> | PRReviewDecision;
  publish?: (event: RuntimeEvent) => void;
}): Promise<PRReviewOutcome[]> {
  const outcomes: PRReviewOutcome[] = [];
  for (const pr of input.prs) {
    if (pr.status !== "completed") {
      outcomes.push({
        id: pr.id,
        decision: "request-changes",
        reason: `sub-agent did not complete (${pr.status})`,
      });
      continue;
    }
    const decision = await input.decide(pr);
    if (decision.decision === "approve") {
      const merged = await input.sandboxes
        .merge(pr.sandboxID, input.workspaceRoot)
        .catch((error) => {
          throw new Error(
            `promotion of ${pr.id} failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      input.publish?.({
        type: "diagnostic",
        level: "info",
        message: `PR ${pr.id} approved and promoted (${merged.length} files)`,
      });
      outcomes.push({ id: pr.id, decision: "approve", merged });
    } else {
      input.publish?.({
        type: "diagnostic",
        level: "info",
        message: `PR ${pr.id} sent back for changes: ${decision.reason ?? "no reason"}`,
      });
      outcomes.push({
        id: pr.id,
        decision: "request-changes",
        reason: decision.reason,
      });
    }
  }
  return outcomes;
}
