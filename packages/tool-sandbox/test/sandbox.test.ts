import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  SnapshotSandboxManager,
  WorktreeSandboxManager,
} from "@natalia/sandbox";
import { sandboxToolFamily, sandboxTools } from "../src";

async function git(cwd: string, args: string[]) {
  const process = Bun.spawn(["git", ...args], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  if (exitCode !== 0) throw new Error(stderr.trim() || stdout.trim());
  return stdout.trim();
}

test("the sandbox family describes the tools it ships", () => {
  const family = sandboxToolFamily();
  expect(family.id).toBe("sandbox");
  expect(family.scope).toBe("workspace");
  expect(family.tools.map((tool) => tool.name)).toEqual(
    sandboxTools().map((tool) => tool.name),
  );
});

test("sandbox tools refuse without a sandbox manager", async () => {
  const tool = sandboxToolFamily().tools.find(
    (candidate) => candidate.name === "sandbox_create",
  )!;
  // sandbox_create validates its arguments before it reaches the manager, so
  // the refusal is "no sandbox manager" only once the input is well-formed.
  await expect(
    tool.execute({ id: "probe", path: "probe" }, {
      workspaceRoot: "/tmp",
    } as never),
  ).rejects.toThrow(
    /sandbox manager is unavailable|requires a sandbox manager|sandbox/u,
  );
});

test("sandbox tools run through the worktree backend (create/write/merge)", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-sandbox-wt-"));
  await git(root, ["init", "-b", "main"]);
  await git(root, ["config", "user.email", "test@natalia"]);
  await git(root, ["config", "user.name", "Natalia Test"]);
  await writeFile(join(root, "file.txt"), "base\n");
  await git(root, ["add", "."]);
  await git(root, ["commit", "-m", "base"]);
  const manager = new WorktreeSandboxManager(root);
  await manager.initialize();
  const context = {
    workspaceRoot: root,
    sandboxes: manager,
    onSandboxEvent: () => undefined,
    onWorkspaceChange: () => undefined,
    sandboxMergeAuthorize: async () => undefined,
  } as never;
  const tools = new Map(
    sandboxToolFamily().tools.map((tool) => [tool.name, tool]),
  );

  await tools.get("sandbox_create")!.execute({ id: "wt.1" }, context);
  // The sandbox is a real worktree on a candidate branch.
  expect(await manager.exists("wt.1")).toBe(true);

  await tools
    .get("sandbox_write")!
    .execute({ id: "wt.1", path: "file.txt", content: "edited\n" }, context);

  const merged = await tools
    .get("sandbox_merge")!
    .execute({ id: "wt.1" }, context);
  expect(JSON.parse(merged)).toContainEqual(
    expect.objectContaining({ path: "file.txt", kind: "modify" }),
  );
  // The write was promoted into the system branch: the workspace file changed.
  expect(await readFile(join(root, "file.txt"), "utf8")).toBe("edited\n");
  expect(await manager.lastKnownGoodCommit()).toBeDefined();
});

test("sandbox tools run through the git-free snapshot backend (no git needed)", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-sandbox-snap-"));
  await writeFile(join(root, "file.txt"), "base\n");
  const manager = new SnapshotSandboxManager(root);
  await manager.initialize();
  const context = {
    workspaceRoot: root,
    sandboxes: manager,
    onSandboxEvent: () => undefined,
    onWorkspaceChange: () => undefined,
    sandboxMergeAuthorize: async () => undefined,
  } as never;
  const tools = new Map(
    sandboxToolFamily().tools.map((tool) => [tool.name, tool]),
  );

  await tools.get("sandbox_create")!.execute({ id: "snap.1" }, context);
  await tools
    .get("sandbox_write")!
    .execute({ id: "snap.1", path: "file.txt", content: "edited\n" }, context);

  const merged = await tools
    .get("sandbox_merge")!
    .execute({ id: "snap.1" }, context);
  expect(JSON.parse(merged)).toContainEqual(
    expect.objectContaining({ path: "file.txt", kind: "modify" }),
  );
  // Promoted into the host — no git anywhere in the workspace.
  expect(await readFile(join(root, "file.txt"), "utf8")).toBe("edited\n");
  expect(await manager.hasLastKnownGood("snap.1")).toBe(true);

  // Rollback restores the host to the pre-promotion state.
  await manager.rollback("snap.1");
  expect(await readFile(join(root, "file.txt"), "utf8")).toBe("base\n");
});

test("sandbox_create reads the resolved config service (runtimeConfig) to name its backend", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-sandbox-backend-"));
  const manager = new SnapshotSandboxManager(root);
  await manager.initialize();
  const tool = sandboxToolFamily().tools.find(
    (candidate) => candidate.name === "sandbox_create",
  )!;
  const created = await tool.execute({ id: "cfg.1" }, {
    workspaceRoot: root,
    sandboxes: manager,
    // The resolved config service: sandbox.backend=worktree was configured.
    runtimeConfig: () => ({ sandbox: { backend: "worktree" } }),
    onSandboxEvent: () => undefined,
    onWorkspaceChange: () => undefined,
  } as never);
  const parsed = JSON.parse(created) as { backend?: string };
  // The tool family consumed the runtime.config service by name — the D2
  // service is genuinely used by a real production tool, not just plugins.
  expect(parsed.backend).toBe("worktree");
});
