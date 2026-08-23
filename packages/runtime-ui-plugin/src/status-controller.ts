import type { RuntimeEvent } from "@natalia/contracts";
import type {
  StatusContextLedger,
  StatusProvider,
  StatusSnapshotController,
} from "@natalia/runtime-services";

export type RuntimeUiPluginInput = {
  provider(): StatusProvider | undefined;
  context(): StatusContextLedger;
  workspaceRoot: string;
  permissionMode(): "ask" | "auto" | "read_only";
  runningCount(): Promise<number>;
  publish(event: RuntimeEvent): void;
};

export function createStatusSnapshotController(
  input: RuntimeUiPluginInput,
): StatusSnapshotController {
  let refreshQueued = false;
  let disposed = false;

  async function snapshotFor(overrides?: {
    provider?: StatusProvider;
    context?: StatusContextLedger;
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

export function statusSnapshot(
  provider: StatusProvider | undefined,
  context: StatusContextLedger,
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
