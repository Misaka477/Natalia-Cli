import type { RuntimeEvent } from "@natalia/contracts";
import type { StreamingProvider } from "@natalia/runtime";

/**
 * The runtime status snapshot controller — the first cut of the resource
 * controllers split (mainline plan §15). It owns the status snapshot and its
 * refresh queue, and it is deliberately shaped for multi-session:
 *
 *   - every dependency is an *accessor* (a function), never a captured value,
 *     exactly like the interactive waiter: `provider()`, `context()`,
 *     `permissionMode()` are the single-valued lets of the runtime closure
 *     today, and when sessions become per-session maps only the accessor
 *     implementations change — this module's lines do not.
 *   - it holds exactly one piece of state, `refreshQueued`, which is
 *     scheduler state (one per controller), not session state.
 */
export function createStatusSnapshotController(input: {
  provider(): StreamingProvider | undefined;
  context(): ContextLedger;
  workspaceRoot: string;
  permissionMode(): "ask" | "auto" | "read_only";
  runningCount(): Promise<number>;
  publish(event: RuntimeEvent): void;
}) {
  let refreshQueued = false;
  let disposed = false;

  async function snapshotFor(overrides?: {
    provider?: StreamingProvider;
    context?: ContextLedger;
    permissionMode?: "ask" | "auto" | "read_only";
  }) {
    const running = await input.runningCount();
    return statusSnapshot(
      overrides?.provider ?? input.provider(),
      overrides?.context ?? input.context(),
      input.workspaceRoot,
      overrides?.permissionMode ?? input.permissionMode(),
      running,
    );
  }

  async function snapshot() {
    return await snapshotFor();
  }

  function schedule() {
    if (refreshQueued || disposed) return;
    refreshQueued = true;
    queueMicrotask(() => {
      refreshQueued = false;
      if (disposed) return;
      void snapshot()
        .then((event) => {
          if (!disposed) input.publish(event);
        })
        .catch((error) =>
          !disposed
            ? input.publish({
                type: "diagnostic",
                level: "warning",
                message: `runtime status refresh failed: ${error instanceof Error ? error.message : String(error)}`,
              })
            : undefined,
        );
    });
  }

  return {
    snapshot,
    snapshotFor,
    schedule,
    dispose() {
      disposed = true;
    },
  };
}

export type StatusSnapshotController = ReturnType<
  typeof createStatusSnapshotController
>;

export type ContextLedger = {
  journalStatus(): { tokenEstimate: number; messageCount: number };
};

export function statusSnapshot(
  provider: StreamingProvider | undefined,
  context: ContextLedger,
  cwd: string,
  permissionMode: "ask" | "auto" | "read_only",
  running: number,
): Extract<RuntimeEvent, { type: "status.snapshot" }> {
  const status = context.journalStatus();
  return {
    type: "status.snapshot",
    model: provider?.model ?? "not-configured",
    provider: provider?.provider ?? "not-configured",
    context: `${status.tokenEstimate} tokens`,
    step: `${status.messageCount}`,
    permissions: permissionMode,
    cwd,
    background: `${running} running`,
  };
}
