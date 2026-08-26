import type { AppState, WorkGraphEdgeView, WorkGraphNodeView } from "./state";

export type WorkGraphSlice = {
  focusID: string;
  nodes: WorkGraphNodeView[];
  edges: WorkGraphEdgeView[];
  unattributed: WorkGraphNodeView[];
};

/**
 * A bounded neighbourhood around one node for an external graph navigator.
 * Depth 0 is the focus only; each increment walks one edge hop.
 */
export function selectWorkGraphNeighborhood(
  state: AppState,
  focusID: string,
  depth = 1,
): WorkGraphSlice {
  const hops = Math.max(0, Math.min(depth, 4));
  const included = new Set<string>();
  if (state.workGraphNodes[focusID]) included.add(focusID);
  let frontier = new Set(included);
  for (let hop = 0; hop < hops; hop += 1) {
    const next = new Set<string>();
    for (const edge of Object.values(state.workGraphEdges)) {
      if (frontier.has(edge.sourceID) && state.workGraphNodes[edge.targetID])
        next.add(edge.targetID);
      if (frontier.has(edge.targetID) && state.workGraphNodes[edge.sourceID])
        next.add(edge.sourceID);
    }
    for (const id of next) included.add(id);
    frontier = next;
  }
  const nodes = [...included]
    .map((id) => state.workGraphNodes[id])
    .filter((node): node is WorkGraphNodeView => Boolean(node));
  const edges = Object.values(state.workGraphEdges).filter(
    (edge) => included.has(edge.sourceID) && included.has(edge.targetID),
  );
  return {
    focusID,
    nodes,
    edges,
    unattributed: selectUnattributedWorkGraphNodes(state),
  };
}

/**
 * Workspace changes with no inbound edge remain unattributed so a navigator can
 * mark unknown provenance instead of inventing a cause.
 */
export function selectUnattributedWorkGraphNodes(
  state: AppState,
): WorkGraphNodeView[] {
  const inbound = new Set(
    Object.values(state.workGraphEdges).map((edge) => edge.targetID),
  );
  return Object.values(state.workGraphNodes).filter(
    (node) => node.kind === "workspace_change" && !inbound.has(node.nodeID),
  );
}
