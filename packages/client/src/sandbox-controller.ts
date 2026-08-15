import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  WorktreeSandboxManager,
  WorkspaceSandboxManager,
} from "@natalia/sandbox";

/**
 * The sandbox resource controller — second cut of the resource controllers
 * split (mainline plan §15). It owns the sandbox manager and its lifecycle;
 * the runtime's members and tool contexts reach the manager through `get()`,
 * and authorization stays in the shared pre-execute funnel
 * (`toolLayer.preExecute`), so there is exactly one policy path.
 *
 * The production backend is the worktree-based manager (P9): a sandbox is a
 * git worktree on a candidate branch, so an agent's changes are commits that
 * diff, preview and promote, and a failed activation rolls back to
 * last-known-good. Workspaces that are not git repos fall back to the
 * directory-copy manager — worktree semantics require git.
 *
 * Multi-session shape (plan §41.9): the controller exposes the manager by
 * accessor, and today it installs exactly one instance. When sessions become
 * per-session maps (D3 forces background sessions into sandboxes), only this
 * module's `init`/`get` implementations change.
 */
export function createSandboxController(input: { workspaceRoot: string }) {
  let manager: WorkspaceSandboxManager | undefined;

  async function init() {
    if (manager) return;
    // Worktree semantics need a git repo; everything else uses the copy
    // backend. Both share the operational surface the sandbox tools call.
    const isGitRepo =
      existsSync(join(input.workspaceRoot, ".git")) ||
      existsSync(join(input.workspaceRoot, ".git", "HEAD"));
    const next = isGitRepo
      ? new WorktreeSandboxManager(input.workspaceRoot)
      : new WorkspaceSandboxManager(
          join(input.workspaceRoot, ".natalia", "sandboxes"),
        );
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
