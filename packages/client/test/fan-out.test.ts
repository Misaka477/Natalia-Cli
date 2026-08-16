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

test("runFanOut gates each PR with build evidence from the candidate worktree", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-fanout-evidence-"));
  const sandboxes = new SnapshotSandboxManager(root);
  await sandboxes.initialize();
  const registry = new SubagentRegistry({
    workDir: join(root, ".natalia", "subagents"),
    runner: async (task, context) => {
      const manifest = await sandboxes.create(context.agentId);
      // The "build" marker decides pass/fail per task.
      const pass = task.includes("pass");
      if (pass) await writeFile(join(manifest.root, "build-pass"), "1");
      context.log(pass ? "ok" : "broken");
      context.setStatus("done");
    },
  });

  const prs = await runFanOut({
    tasks: [
      { id: "pass-task", prompt: "pass task" },
      { id: "fail-task", prompt: "fail task" },
    ],
    subagents: registry,
    sandboxes,
    timeoutMs: 10_000,
    buildCommand: "test -f build-pass",
  });

  const passPR = prs.find((pr) => pr.id === "pass-task")!;
  const failPR = prs.find((pr) => pr.id === "fail-task")!;
  // The gate ran in each candidate's own worktree: pass builds, fail ones are
  // reported with the failing evidence for the lead to reject or fix.
  expect(passPR.buildEvidence?.ok).toBe(true);
  expect(failPR.buildEvidence?.ok).toBe(false);
  expect(failPR.buildEvidence?.exitCode).not.toBe(0);
});
