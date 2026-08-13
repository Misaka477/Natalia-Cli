import { watchWorkspaceFiles } from "@natalia/client";
import { createWorkspaceChangeAuditor } from "./workspace-change-auditor";

/**
 * The workspace-files watcher controller — cut of the resource controllers
 * split (mainline plan §15) and WG4's observation owner (mainline plan §56.9).
 *
 * It owns the workspace watcher's lifecycle: the runtime starts it at
 * initialize and closes it at dispose, and nothing else touches it. Every
 * fs.watch event is handed to the `WorkspaceChangeAuditor` as a hint — the
 * auditor is the only production owner of workspace observation, and this
 * controller must not write the Work Graph or generate workspace provenance.
 *
 * The watcher is per-workspace today; when sessions become per-session maps,
 * the watch set becomes per-session too and only this module's `init` changes.
 */
export function createWorkspaceFilesController(input: {
  workspaceRoot: string;
  /** Enumerate the current workspace-relative paths, for baseline/reconcile. */
  listPaths: () => Promise<string[]>;
}) {
  let cleanup: (() => void) | undefined;
  const auditor = createWorkspaceChangeAuditor({
    workspaceRoot: input.workspaceRoot,
  });

  async function init() {
    // Idempotent: re-running init must not leak the previous watcher. A
    // leaked watcher keeps the process alive on Windows (ReadDirectoryChangesW
    // holds the event loop) and duplicates change events everywhere.
    close();
    await auditor.baseline(await input.listPaths());
    cleanup = await watchWorkspaceFiles(input.workspaceRoot, (change) =>
      auditor.observe(change),
    ).catch(() => undefined);
  }

  function close() {
    cleanup?.();
    cleanup = undefined;
  }

  async function reconcile() {
    return auditor.reconcile(await input.listPaths());
  }

  function observationStatus() {
    return auditor.status();
  }

  return { init, close, reconcile, observationStatus, auditor };
}
