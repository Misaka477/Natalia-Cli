/**
 * Model-facing Work Graph query tool — runtime/work-graph-tools.ts.
 *
 * The minimal read surface (EI §8.4): query the session's work graph by
 * planID (or a plan document path, resolved to its planID) with cursor
 * pagination. The full version (filter by kind/direction/depth, checkpoint
 * provenance) lands with the B7 graph batch; this slice gives the model the
 * basic "what has this plan touched" read with bounded output.
 */
import {
  projectedWorkGraphNodes,
  projectedWorkGraphEdges,
} from "@natalia/session";
import type { WorkGraphEdge, WorkGraphNode } from "@natalia/contracts";
import type { RuntimeContext } from "./context";

const WORK_GRAPH_PAGE_LIMIT = 20;

function resolveExec(
  ctx: RuntimeContext,
  sessionID?: string,
): import("./context").SessionExecutionState | undefined {
  const exec = sessionID
    ? ctx.ports
        .getExecutionBySession()
        .get(sessionID as import("@natalia/contracts").SessionID)
    : undefined;
  return exec ?? ctx.ports.getActiveExec();
}

export function createWorkGraphQueryTool(
  ctx: RuntimeContext,
): import("@natalia/tools").RuntimeTool {
  return {
    name: "work_graph_query",
    description:
      "Query the session's Work Graph — the recorded fact graph of plans, decisions, tool calls, approvals, checkpoints, validations and workspace changes. Filter by planID (or a plan document path). Returns matching nodes and the edges between them, paginated with a cursor.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        planID: {
          type: "string",
          description: "The planID to filter the graph by.",
        },
        path: {
          type: "string",
          description:
            "A plan document path (resolved to its planID, alternative to planID).",
        },
        cursor: {
          type: "string",
          description:
            "Opaque pagination cursor from a previous work_graph_query result.",
        },
        limit: {
          type: "number",
          description: `Maximum nodes per page (default ${WORK_GRAPH_PAGE_LIMIT}).`,
        },
        direction: {
          type: "string",
          enum: ["out", "in", "both"],
          description:
            "Which edge direction to traverse from the matched nodes (default both).",
        },
        depth: {
          type: "number",
          description:
            "How many edge hops to expand from the matched nodes (default 1, 0 = no traversal).",
        },
      },
      additionalProperties: false,
    },
    async execute(parsed, context) {
      const args = parsed as {
        planID?: string;
        path?: string;
        cursor?: string;
        limit?: number;
        direction?: "out" | "in" | "both";
        depth?: number;
      };
      const exec = resolveExec(ctx, context.sessionID);
      if (!exec) return "no session";
      let planID = args.planID?.trim();
      if (!planID && args.path?.trim()) {
        const plans = ctx.ports.planDocRuntime.planDocSnapshot();
        const normalized = args.path
          .trim()
          .replace(/^\.?\/?natalia\/plans\//u, "");
        const match = plans.find(
          (plan) =>
            plan.documentPath === normalized ||
            plan.documentPath.endsWith(normalized) ||
            plan.planID === normalized,
        );
        planID = match?.planID;
      }
      const nodes = projectedWorkGraphNodes(exec.session.events);
      const edges = projectedWorkGraphEdges(exec.session.events);
      // B7: exact planID provenance when the node carries it; the summary/
      // target substring match stays for nodes whose provenance is only
      // implicit (the graph predates planID tracking).
      const filtered = planID
        ? nodes.filter(
            (node) =>
              node.planID === planID ||
              node.target === planID ||
              node.target?.includes(planID) === true ||
              node.summary.includes(planID),
          )
        : nodes;
      const limit = Math.min(
        Math.max(args.limit ?? WORK_GRAPH_PAGE_LIMIT, 1),
        100,
      );
      const offset = Number(args.cursor ?? "0");
      if (!Number.isFinite(offset) || offset < 0)
        return "invalid cursor; pass the exact cursor from a previous result";
      // B7: optional edge traversal (direction + depth) expands the matched
      // set through the graph before pagination, so "what does this plan
      // touch" can reach the checkpoints, validations and changes behind it.
      const direction = args.direction ?? "both";
      const depth = Math.max(Math.min(args.depth ?? 1, 5), 0);
      let expanded = filtered;
      if (depth > 0) {
        const adjacency = new Map<
          string,
          Array<{ to: string; kind: string }>
        >();
        for (const edge of edges) {
          if (direction !== "in")
            (
              adjacency.get(edge.sourceID) ??
              adjacency.set(edge.sourceID, []).get(edge.sourceID)!
            ).push({ to: edge.targetID, kind: edge.kind });
          if (direction !== "out")
            (
              adjacency.get(edge.targetID) ??
              adjacency.set(edge.targetID, []).get(edge.targetID)!
            ).push({ to: edge.sourceID, kind: edge.kind });
        }
        const reached = new Set(filtered.map((node) => node.id));
        let frontier = [...reached];
        for (let hop = 0; hop < depth; hop += 1) {
          const next: string[] = [];
          for (const id of frontier)
            for (const link of adjacency.get(id) ?? [])
              if (!reached.has(link.to)) {
                reached.add(link.to);
                next.push(link.to);
              }
          if (!next.length) break;
          frontier = next;
        }
        expanded = nodes.filter((node) => reached.has(node.id));
      }
      const page = expanded.slice(offset, offset + limit);
      const nodeIDs = new Set(page.map((node) => node.id));
      const pageEdges = edges.filter(
        (edge) => nodeIDs.has(edge.sourceID) && nodeIDs.has(edge.targetID),
      );
      const nextCursor =
        offset + limit < expanded.length ? String(offset + limit) : undefined;
      return JSON.stringify({
        ...(planID ? { planID } : {}),
        total: expanded.length,
        nodes: page,
        edges: pageEdges,
        ...(nextCursor ? { nextCursor } : {}),
      } satisfies {
        planID?: string;
        total: number;
        nodes: WorkGraphNode[];
        edges: WorkGraphEdge[];
        nextCursor?: string;
      });
    },
  };
}
