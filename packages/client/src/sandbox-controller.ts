import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  SnapshotSandboxManager,
  WorktreeSandboxManager,
  WorkspaceSandboxManager,
} from "@natalia/sandbox";
import type { SandboxBackend } from "@natalia/contracts";

/**
 * The sandbox resource controller — second cut of the resource controllers
 * split (mainline plan §15). It owns the sandbox manager and its lifecycle;
 * the runtime's members and tool contexts reach the manager through `get()`,
 * and authorization stays in the shared pre-execute funnel
 * (`toolLayer.preExecute`), so there is exactly one policy path.
 *
 * The default backend is our own git-free snapshot manager: a sandbox is an
 * isolated copy with candidate/promote/rollback against a content-addressed
 * snapshot of the host — no external git needed. When the workspace is a git
 * repo and `sandbox.backend: "worktree"` is set, the worktree-based manager
 * (P9) is used instead, so a promoted sandbox change lands as a commit in the
 * user's own git history.
 *
 * Multi-session shape (plan §41.9): the controller exposes the manager by
 * accessor, and today it installs exactly one instance. When sessions become
 * per-session maps (D3 forces background sessions into sandboxes), only this
 * module's `init`/`get` implementations change.
 */
export function createSandboxController(input: {
  workspaceRoot: string;
  /** Backend from `sandbox.backend`; absent defaults to our own snapshot. */
  backend?(): SandboxBackend | undefined;
}) {
  let manager: WorkspaceSandboxManager | undefined;

  async function init() {
    if (manager) return;
    // Our own git-free snapshot backend is the default; the worktree backend
    // (real git, for history integration) is a per-project opt-in that needs a
    // git repo. Both extend the shared operational surface the sandbox tools
    // call.
    const isGitRepo =
      existsSync(join(input.workspaceRoot, ".git")) ||
      existsSync(join(input.workspaceRoot, ".git", "HEAD"));
    const next =
      input.backend?.() === "worktree" && isGitRepo
        ? new WorktreeSandboxManager(input.workspaceRoot)
        : new SnapshotSandboxManager(input.workspaceRoot);
    await next.initialize();
    manager = next;
  }

  function get(): WorkspaceSandboxManager {
    if (!manager) throw new Error("sandbox manager is not initialized");
    return manager;
  }

  return {
    init,
    get,
    runningResourceCount() {
      return manager?.runningResourceCount() ?? 0;
    },
  };
}
