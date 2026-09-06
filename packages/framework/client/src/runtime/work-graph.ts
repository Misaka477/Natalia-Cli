import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  projectedWorkGraphEdges,
  projectedWorkGraphNodes,
} from "@natalia/session";
import type { RuntimeContext } from "./context";

type WorkGraphRuntime = Pick<
  RuntimeServiceClient,
  "workGraphNodes" | "workGraphEdges"
>;

async function graphProjectionWithFallback(
  name: "workGraphNodes" | "workGraphEdges",
  events: import("@natalia/contracts").RuntimeEvent[],
) {
  try {
    const { runSessionProjectionInWorker } = await import(
      "./session-project-client"
    );
    return await runSessionProjectionInWorker(name, events);
  } catch {
    return name === "workGraphNodes"
      ? projectedWorkGraphNodes(events)
      : projectedWorkGraphEdges(events);
  }
}

export function createWorkGraphRuntime(ctx: RuntimeContext): WorkGraphRuntime {
  return {
    async workGraphNodes() {
      const session = ctx.ports.getSession();
      if (!session) return [];
      const nodes = (await graphProjectionWithFallback(
        "workGraphNodes",
        session.events,
      )) as ReturnType<typeof projectedWorkGraphNodes>;
      return nodes.map((record) => ({
        nodeID: record.nodeID,
        kind: record.kind,
        summary: record.summary,
        actor: record.actor,
        target: record.target,
        sessionID: record.sessionID,
        turnID: record.turnID,
        episodeID: record.episodeID,
      }));
    },
    async workGraphEdges() {
      const session = ctx.ports.getSession();
      if (!session) return [];
      const edges = (await graphProjectionWithFallback(
        "workGraphEdges",
        session.events,
      )) as ReturnType<typeof projectedWorkGraphEdges>;
      return edges.map((record) => ({
        sourceID: record.sourceID,
        targetID: record.targetID,
        kind: record.kind,
        reason: record.reason,
        episodeID: record.episodeID,
      }));
    },
  };
}
