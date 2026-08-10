import type {
  CheckpointResourcePolicy,
  ConfigV2,
  RuntimeEvent,
  SessionID,
} from "@natalia/contracts";
import {
  CheckpointStore,
  type DurableContextCheckpoint,
} from "@natalia/runtime";
import type { SubagentRegistry } from "@natalia/subagent";

/**
 * The checkpoint resource controller — third cut of the resource controllers
 * split (mainline plan §15). It owns the `CheckpointStore` and its lifecycle
 * (open, baseline, rollback options). Every dependency is an accessor, never
 * a captured value (plan §41.9): `sessionID()`, `context()`, `subagents()`,
 * `activeAbort()` are the runtime closure's single-valued lets today, and
 * when sessions become per-session maps only the accessors change — this
 * module does not.
 */
export function createCheckpointController(input: {
  sessionID(): SessionID;
  workspaceRoot: string;
  checkpoint(): ConfigV2["checkpoint"] | undefined;
  workspace(): ConfigV2["workspace"] | undefined;
  publish(event: RuntimeEvent): void;
  context(): import("@natalia/runtime").ContextLedger;
  subagents(): SubagentRegistry | undefined;
  activeAbort(): AbortController | undefined;
}) {
  let store: CheckpointStore | undefined;

  async function init() {
    const checkpoint = input.checkpoint();
    store = await CheckpointStore.open({
      sessionID: input.sessionID(),
      workspaceRoot: input.workspaceRoot,
      enabled: checkpoint?.enabled,
      maxFiles: checkpoint?.maxFiles,
      maxBytes: checkpoint?.maxBytes,
      ignore: checkpoint?.ignore,
      additionalDirs: [
        ...(checkpoint?.additionalDirs ?? []),
        ...(input.workspace()?.additionalDirs ?? []),
      ],
      onEvent: input.publish,
    });
    if (store.isEnabled()) await store.ensureBaseline(input.context(), 0);
  }

  function get(): CheckpointStore {
    if (!store) throw new Error("checkpoint store is not initialized");
    return store;
  }

  function isEnabled() {
    return store?.isEnabled() ?? false;
  }

  function resources(): Array<{
    kind: "subagent" | "tool";
    id: string;
    status: "running" | "waiting" | "stopped";
    summary: string;
  }> {
    return [
      ...(input
        .subagents()
        ?.list()
        .map((agent) => ({
          kind: "subagent" as const,
          id: agent.id,
          status:
            agent.status === "running"
              ? ("running" as const)
              : agent.status === "paused"
                ? ("waiting" as const)
                : ("stopped" as const),
          summary: agent.task,
        })) ?? []),
      ...(input.activeAbort()
        ? [
            {
              kind: "tool" as const,
              id: "active_turn",
              status: "running" as const,
              summary: "active provider turn",
            },
          ]
        : []),
    ];
  }

  function rollbackOptions() {
    return {
      resources: resources(),
      onResourcePolicy: async (policy: CheckpointResourcePolicy) => {
        if (policy.action !== "stop" && policy.action !== "cancel") return;
        if (policy.kind === "subagent")
          await input.subagents()?.stop(policy.id);
        if (policy.kind === "tool")
          input.activeAbort()?.abort(new Error("checkpoint rollback"));
      },
      onContextRestored: async (snapshot: DurableContextCheckpoint) =>
        input.publish({
          type: "context.checkpoint",
          id: `rollback:${snapshot.journalOffset}`,
          snapshot,
        }),
    };
  }

  return { init, get, isEnabled, resources, rollbackOptions };
}
