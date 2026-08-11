import { watchWorkspaceFiles } from "@natalia/client";

/**
 * The workspace-files watcher controller — cut of the resource controllers
 * split (mainline plan §15). It owns the workspace watcher's lifecycle: the
 * runtime starts it at initialize and closes it at dispose, and nothing else
 * touches it. The watcher is per-workspace today; when sessions become
 * per-session maps, the watch set becomes per-session too and only this
 * module's `init` changes.
 */
export function createWorkspaceFilesController(input: {
  workspaceRoot: string;
}) {
  let cleanup: (() => void) | undefined;

  async function init() {
    // Idempotent: re-running init must not leak the previous watcher. A
    // leaked watcher keeps the process alive on Windows (ReadDirectoryChangesW
    // holds the event loop) and duplicates change events everywhere.
    close();
    cleanup = await watchWorkspaceFiles(
      input.workspaceRoot,
      () => undefined,
    ).catch(() => undefined);
  }

  function close() {
    cleanup?.();
    cleanup = undefined;
  }

  return { init, close };
}
