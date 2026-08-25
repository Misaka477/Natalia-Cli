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

export function createWorkGraphRuntime(ctx: RuntimeContext): WorkGraphRuntime {
  return {
    async workGraphNodes() {
      const session = ctx.ports.getSession();
      if (!session) return [];
      return projectedWorkGraphNodes(session.events).map((record) => ({
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
      return projectedWorkGraphEdges(session.events).map((record) => ({
        sourceID: record.sourceID,
        targetID: record.targetID,
        kind: record.kind,
        reason: record.reason,
        episodeID: record.episodeID,
      }));
    },
  };
}
