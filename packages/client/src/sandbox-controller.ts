import { join } from "node:path";
import { WorkspaceSandboxManager } from "@natalia/sandbox";

/**
 * The sandbox resource controller — second cut of the resource controllers
 * split (mainline plan §15). It owns the `WorkspaceSandboxManager` and its
 * lifecycle; the runtime's members and tool contexts reach the manager
 * through `get()`, and authorization stays in the shared pre-execute funnel
 * (`toolLayer.preExecute`), so there is exactly one policy path.
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
    const next = new WorkspaceSandboxManager(
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
