import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WorktreeSandboxManager } from "../src/worktree-sandbox";

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

/** A scratch git repo with one committed file, ready to branch candidates from. */
async function scratchRepo() {
  const root = await mkdtemp(join(tmpdir(), "natalia-sandbox-advanced-"));
  await git(root, ["init", "-b", "main"]);
  await git(root, ["config", "user.email", "test@natalia"]);
  await git(root, ["config", "user.name", "Natalia Test"]);
  await writeFile(join(root, "file.txt"), "base\n");
  await git(root, ["add", "."]);
  await git(root, ["commit", "-m", "base"]);
  return root;
}

test("a sandbox is a worktree on a candidate branch off the system head", async () => {
  const root = await scratchRepo();
  const manager = new WorktreeSandboxManager(root);
  const sandbox = await manager.create("sbx.1");
  expect(sandbox.base).toBe(await manager.systemHead());
  expect(await manager.exists("sbx.1")).toBe(true);
  // The worktree starts identical to the system.
  expect(await readFile(join(sandbox.root, "file.txt"), "utf8")).toBe("base\n");
  await manager.delete("sbx.1");
  expect(await manager.exists("sbx.1")).toBe(false);
});

test("previewMerge reports the candidate's changes against its base", async () => {
  const root = await scratchRepo();
  const manager = new WorktreeSandboxManager(root);
  const sandbox = await manager.create("sbx.2");
  // The agent edits in the candidate worktree and commits there.
  await writeFile(join(sandbox.root, "file.txt"), "changed\n");
  await writeFile(join(sandbox.root, "new.txt"), "added\n");
  await git(sandbox.root, ["add", "."]);
  await git(sandbox.root, ["commit", "-m", "agent change"]);
  const changes = await manager.previewMerge("sbx.2");
  expect(changes.map((change) => change.path).sort()).toEqual([
    "file.txt",
    "new.txt",
  ]);
  expect(changes.find((change) => change.path === "file.txt")?.kind).toBe(
    "modify",
  );
  expect(changes.find((change) => change.path === "new.txt")?.kind).toBe("add");
});

test("promote merges the candidate into the system slot and records last-known-good", async () => {
  const root = await scratchRepo();
  const manager = new WorktreeSandboxManager(root);
  const sandbox = await manager.create("sbx.3");
  const base = await manager.systemHead();
  await writeFile(join(sandbox.root, "file.txt"), "promoted\n");
  await git(sandbox.root, ["add", "."]);
  await git(sandbox.root, ["commit", "-m", "promote me"]);

  const authorized: string[][] = [];
  const promotion = await manager.merge("sbx.3", root, async (paths) => {
    authorized.push(paths);
  });
  expect(promotion.lastKnownGood).toBe(base);
  expect(promotion.promoted).toBe(await manager.systemHead());
  expect(promotion.promoted).not.toBe(base);
  // The system slot now has the candidate's change.
  expect(await readFile(join(root, "file.txt"), "utf8")).toBe("promoted\n");
  // The human approval step saw the changed paths.
  expect(authorized[0]).toContain("file.txt");
  expect(await manager.lastKnownGoodCommit()).toBe(base);
});

test("rollback returns the system slot to last-known-good", async () => {
  const root = await scratchRepo();
  const manager = new WorktreeSandboxManager(root);
  const sandbox = await manager.create("sbx.4");
  await writeFile(join(sandbox.root, "file.txt"), "promoted\n");
  await git(sandbox.root, ["add", "."]);
  await git(sandbox.root, ["commit", "-m", "promote me"]);
  await manager.merge("sbx.4", root);
  expect(await readFile(join(root, "file.txt"), "utf8")).toBe("promoted\n");
  // A failed activation rolls back to last-known-good.
  const rollback = await manager.rollback();
  expect(rollback.restored).toBeDefined();
  expect(await readFile(join(root, "file.txt"), "utf8")).toBe("base\n");
});

test("promoting a candidate with no changes refuses", async () => {
  const root = await scratchRepo();
  const manager = new WorktreeSandboxManager(root);
  await manager.create("sbx.5");
  await expect(manager.merge("sbx.5", root)).rejects.toThrow(
    /has no changes to promote/u,
  );
});
