import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentRegistry } from "@natalia/subagent";
import { SnapshotSandboxManager } from "@natalia/sandbox";
import { runFanOut } from "../src/fan-out";

test("runFanOut spawns sandboxed sub-agents in parallel and produces one PR each", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-fanout-"));
  const sandboxes = new SnapshotSandboxManager(root);
  await sandboxes.initialize();

  // A runner that simulates a sandboxed sub-agent: it creates its own worktree
  // and writes a file in it, exactly what the host's sandboxed runner does.
  const registry = new SubagentRegistry({
    workDir: join(root, ".natalia", "subagents"),
    runner: async (task, context) => {
      const manifest = await sandboxes.create(context.agentId);
      await writeFile(join(manifest.root, "output.txt"), `made by ${task}`);
      context.log("complete");
      context.setStatus("done");
    },
  });

  const prs = await runFanOut({
    tasks: [
      { id: "battle", prompt: "battle system" },
      { id: "inventory", prompt: "inventory system" },
    ],
    subagents: registry,
    sandboxes,
    timeoutMs: 10_000,
  });

  expect(prs).toHaveLength(2);
  for (const pr of prs) {
    expect(pr.status).toBe("completed");
    expect(pr.result).toContain("complete");
    // Each PR carries the candidate's own worktree diff for the lead to review.
    expect(pr.diff.map((change) => change.path)).toContain("output.txt");
  }
  // Each sub-agent worked in its own sandbox, disjoint by construction.
  expect(prs[0]!.sandboxID).not.toBe(prs[1]!.sandboxID);
});
