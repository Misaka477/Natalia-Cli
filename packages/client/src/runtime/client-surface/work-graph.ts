import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  projectedWorkGraphEdges,
  projectedWorkGraphNodes,
} from "@natalia/session";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
type Surface = Pick<RuntimeServiceClient, "workGraphNodes" | "workGraphEdges">;
export function createWorkGraphSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    async workGraphNodes() {
      if (!ctx.ports.getSession()) return [];
      return projectedWorkGraphNodes(ctx.ports.getSession()!.events).map(
        (r) => ({
          nodeID: r.nodeID,
          kind: r.kind,
          summary: r.summary,
          actor: r.actor,
          target: r.target,
          sessionID: r.sessionID,
          turnID: r.turnID,
          episodeID: r.episodeID,
        }),
      );
    },
    async workGraphEdges() {
      if (!ctx.ports.getSession()) return [];
      return projectedWorkGraphEdges(ctx.ports.getSession()!.events).map(
        (r) => ({
          sourceID: r.sourceID,
          targetID: r.targetID,
          kind: r.kind,
          reason: r.reason,
          episodeID: r.episodeID,
        }),
      );
    },
  };
}
