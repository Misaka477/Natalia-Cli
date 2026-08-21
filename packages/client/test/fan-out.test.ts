import { expect, test } from "bun:test";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SubagentRegistry } from "@natalia/subagents-plugin";
import { SnapshotSandboxManager } from "@natalia/sandbox-plugin";
import { reviewPRs, runFanOut, validateOwnershipMap } from "../src/fan-out";

test("runFanOut spawns sandboxed sub-agents in parallel and produces one PR each", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-fanout-"));
  await writeFile(join(root, "CONTRACT.md"), "shared contract\n");
  const sandboxes = new SnapshotSandboxManager(root);
  await sandboxes.initialize();

  // A runner that simulates a sandboxed sub-agent: it creates its own worktree
  // and writes a file in it, exactly what the host's sandboxed runner does.
  const registry = new SubagentRegistry({
    workDir: join(root, ".natalia", "subagents"),
    runner: async (task, context) => {
      const manifest = await sandboxes.create(context.agentId);
      expect(await readFile(join(manifest.root, "CONTRACT.md"), "utf8")).toBe(
        "shared contract\n",
      );
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

test("validateOwnershipMap rejects overlapping domains (T-3 close)", () => {
  const disjoint = validateOwnershipMap({
    tasks: [
      { id: "battle", prompt: "battle", writePaths: ["systems/battle"] },
      {
        id: "inventory",
        prompt: "inventory",
        writePaths: ["systems/inventory"],
      },
    ],
  });
  expect(disjoint.ok).toBe(true);

  const prefix = validateOwnershipMap({
    tasks: [
      { id: "systems", prompt: "systems", writePaths: ["systems"] },
      { id: "battle", prompt: "battle", writePaths: ["systems/battle"] },
    ],
  });
  expect(prefix.ok).toBe(false);
  expect(prefix.issues.join("\n")).toContain("overlapping domains");
});

test("reviewPRs promotes approved PRs into the system slot and sends back the rest (T-4)", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-review-"));
  await writeFile(join(root, "base.txt"), "base\n");
  const sandboxes = new SnapshotSandboxManager(root);
  await sandboxes.initialize();
  const registry = new SubagentRegistry({
    workDir: join(root, ".natalia", "subagents"),
    runner: async (task, context) => {
      const manifest = await sandboxes.create(context.agentId);
      await writeFile(join(manifest.root, "output.txt"), `from ${task}`);
      context.log("ok");
      context.setStatus("done");
    },
  });

  const prs = await runFanOut({
    tasks: [
      { id: "approved", prompt: "approved task" },
      { id: "rejected", prompt: "rejected task" },
    ],
    subagents: registry,
    sandboxes,
    timeoutMs: 10_000,
  });

  // The lead: approve the first PR, send back the second.
  const outcomes = await reviewPRs({
    prs,
    sandboxes,
    workspaceRoot: root,
    decide: (pr) =>
      pr.id === "approved"
        ? { id: pr.id, decision: "approve" as const }
        : { id: pr.id, decision: "request-changes" as const, reason: "redo" },
  });

  const approved = outcomes.find((outcome) => outcome.id === "approved")!;
  const rejected = outcomes.find((outcome) => outcome.id === "rejected")!;
  expect(approved.decision).toBe("approve");
  expect(approved.merged?.map((change) => change.path)).toContain("output.txt");
  // The approved candidate's change landed in the host workspace.
  expect(await readFile(join(root, "output.txt"), "utf8")).toBe(
    "from approved task",
  );
  expect(rejected.decision).toBe("request-changes");
  expect(rejected.reason).toBe("redo");
  // The rejected candidate was not promoted into the host.
  expect(existsSync(join(root, "output.txt"))).toBe(true); // only the approved one
});

import {
  LEAD_REVIEWER_SYSTEM_PROMPT,
  ORCHESTRATOR_SYSTEM_PROMPT,
  sandboxedSubagentSystemPrompt,
} from "../src/agent-team-prompts";

test("agent-team prompts carry the contract each role must follow", () => {
  // The orchestrator: disjoint ownership + validation are load-bearing.
  expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("ownership map");
  expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("never overlap");
  expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("validateOwnershipMap");
  // The sandboxed sub-agent: its file domain is enforced by the prompt.
  expect(sandboxedSubagentSystemPrompt()).toContain("isolated workspace");
  expect(sandboxedSubagentSystemPrompt()).toContain(
    "already checked out the repository base",
  );
  expect(sandboxedSubagentSystemPrompt()).toContain(
    "Do not create or switch worktrees",
  );
  expect(sandboxedSubagentSystemPrompt(["systems/battle"])).toContain(
    "systems/battle",
  );
  expect(sandboxedSubagentSystemPrompt(["systems/battle"])).toContain(
    "write files ONLY under these paths",
  );
  // The lead reviewer: one PR at a time, against domain + contract + evidence.
  expect(LEAD_REVIEWER_SYSTEM_PROMPT).toContain("one at a time");
  expect(LEAD_REVIEWER_SYSTEM_PROMPT).toContain("build evidence");
  expect(LEAD_REVIEWER_SYSTEM_PROMPT).toContain("outside its domain");
});

test("runFanOut caps concurrent spawns with maxConcurrent", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-fanout-cap-"));
  await mkdir(join(root, ".natalia", "subagents"), { recursive: true });
  const sandboxes = new SnapshotSandboxManager(root);
  await sandboxes.initialize();
  const registry = new SubagentRegistry({
    workDir: join(root, ".natalia", "subagents"),
    runner: async (task, context) => {
      const manifest = await sandboxes.create(context.agentId);
      await writeFile(join(manifest.root, "out.txt"), task);
      context.log("ok");
      context.setStatus("done");
    },
  });
  // Count in-flight spawn calls: maxConcurrent caps the spawn burst.
  const originalSpawn = registry.spawn.bind(registry);
  let inFlight = 0;
  let peakSpawn = 0;
  const counting = new Proxy(registry, {
    get(target, prop) {
      if (prop === "spawn")
        return async (...args: Parameters<typeof originalSpawn>) => {
          inFlight++;
          peakSpawn = Math.max(peakSpawn, inFlight);
          const result = await originalSpawn(...args);
          inFlight--;
          return result;
        };
      return (target as unknown as Record<string, unknown>)[prop as string];
    },
  });
  const prs = await runFanOut({
    tasks: [
      { id: "a", prompt: "a" },
      { id: "b", prompt: "b" },
      { id: "c", prompt: "c" },
    ],
    subagents: counting as SubagentRegistry,
    sandboxes,
    maxConcurrent: 2,
    timeoutMs: 10_000,
  });
  expect(prs).toHaveLength(3);
  // Never more than 2 spawn calls were in flight at once.
  expect(peakSpawn).toBeLessThanOrEqual(2);
});
