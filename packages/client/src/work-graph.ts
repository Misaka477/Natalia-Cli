/**
 * Work Graph source facts.
 *
 * The Work Graph answers "why did this change happen, who approved it, what
 * validated it". WG1 shipped the schema, projector and query, but nothing in
 * production ever emitted a node, so every query returned an empty graph. This
 * module is the writer.
 *
 * Two rules shape it:
 *
 * 1. **No parallel identity system.** Node ids are derived from ids that already
 *    exist — the turn, the tool call id, the approval id — and the episode
 *    (`epi_*`) rides along as the correlation field `publish()` already stamps on
 *    every event. Nothing here invents a new way to name an execution.
 * 2. **No secrets, no reasoning, no raw output.** A summary is built from a tool
 *    name and a status, never from arguments, results, command text or thinking.
 *    The graph is replayable and shareable, so anything sensitive that reached it
 *    would be permanent. `workGraphSummary` is the only place a summary is
 *    constructed, so that rule has one enforcement point.
 */
import type { RuntimeEvent } from "@natalia/contracts";

export type WorkGraphNodeEvent = Extract<
  RuntimeEvent,
  { type: "workgraph.node_added" }
>;
export type WorkGraphEdgeEvent = Extract<
  RuntimeEvent,
  { type: "workgraph.edge_added" }
>;

/**
 * The WG1 node vocabulary, taken from `workGraphNodeSchema` in
 * `@natalia/contracts` rather than invented here. The event type declares
 * `kind: string`, so nothing would have stopped this writer from choosing its own
 * names — and a second vocabulary is the same failure as a second id system:
 * every consumer would have to know which spelling it is looking at.
 * `work-graph.test.ts` validates emitted facts against those schemas, so the
 * vocabulary is enforced rather than merely documented.
 */
export const WORK_GRAPH_KIND = {
  agentAction: "agent_action",
  toolCall: "tool_call",
  approval: "approval",
} as const;

/** Edge vocabulary, likewise from `workGraphEdgeSchema`. */
export const WORK_GRAPH_EDGE_KIND = {
  caused: "caused",
  approvedBy: "approved_by",
  rejectedBy: "rejected_by",
} as const;

export function agentActionNodeID(turnID: string): string {
  return `wg:action:${turnID}`;
}

export function toolCallNodeID(turnID: string, callID: string): string {
  return `wg:tool:${turnID}:${callID}`;
}

export function approvalNodeID(approvalID: string): string {
  return `wg:approval:${approvalID}`;
}

/**
 * The only summary builder. Keeps free text out of the graph: a caller cannot
 * pass a command line or a tool result through it.
 */
function workGraphSummary(parts: Array<string | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .map((part) => part.replaceAll(/\s+/gu, " ").trim())
    .join(" · ")
    .slice(0, 200);
}

/** One node per turn: the agent acted. */
export function agentActionNode(input: {
  turnID: string;
  sessionID: string;
  agent?: string;
}): WorkGraphNodeEvent {
  return {
    type: "workgraph.node_added",
    id: agentActionNodeID(input.turnID),
    nodeID: agentActionNodeID(input.turnID),
    kind: WORK_GRAPH_KIND.agentAction,
    // Deliberately not the prompt text: a prompt can contain anything.
    summary: workGraphSummary(["turn", input.agent]),
    actor: input.agent ?? "agent",
    sessionID: input.sessionID,
    turnID: input.turnID,
  };
}

/**
 * One node per settled tool call, plus the edge to the turn that caused it. Only
 * settled calls are recorded, because an in-flight call is not yet a fact.
 */
export function toolCallNode(input: {
  turnID: string;
  callID: string;
  toolName: string;
  status: string;
  sessionID: string;
}): WorkGraphNodeEvent {
  return {
    type: "workgraph.node_added",
    id: toolCallNodeID(input.turnID, input.callID),
    nodeID: toolCallNodeID(input.turnID, input.callID),
    kind: WORK_GRAPH_KIND.toolCall,
    summary: workGraphSummary([input.toolName, input.status]),
    actor: input.toolName,
    sessionID: input.sessionID,
    turnID: input.turnID,
  };
}

export function toolCallEdge(input: {
  turnID: string;
  callID: string;
}): WorkGraphEdgeEvent {
  return {
    type: "workgraph.edge_added",
    id: `wg:edge:action-tool:${input.turnID}:${input.callID}`,
    sourceID: agentActionNodeID(input.turnID),
    targetID: toolCallNodeID(input.turnID, input.callID),
    kind: WORK_GRAPH_EDGE_KIND.caused,
  };
}

/**
 * One node per resolved approval. The decision is a fact worth keeping; the
 * preview text is not, because it can contain a command line.
 */
export function approvalNode(input: {
  approvalID: string;
  decision: string;
  toolName?: string;
  sessionID: string;
  turnID?: string;
}): WorkGraphNodeEvent {
  return {
    type: "workgraph.node_added",
    id: approvalNodeID(input.approvalID),
    nodeID: approvalNodeID(input.approvalID),
    kind: WORK_GRAPH_KIND.approval,
    summary: workGraphSummary([input.toolName, input.decision]),
    actor: "user",
    sessionID: input.sessionID,
    turnID: input.turnID,
  };
}

/** Links an approval to the tool call it authorized, when that is known. */
export function approvalEdge(input: {
  approvalID: string;
  decision: string;
  turnID: string;
  callID: string;
}): WorkGraphEdgeEvent {
  return {
    type: "workgraph.edge_added",
    id: `wg:edge:tool-approval:${input.turnID}:${input.callID}`,
    sourceID: toolCallNodeID(input.turnID, input.callID),
    targetID: approvalNodeID(input.approvalID),
    // A refusal is as much a fact as an approval, and calling it `approved_by`
    // would make the graph answer "who authorized this" with someone who
    // refused. `rejected_by` is a deliberate addition to the WG1 edge
    // vocabulary, not a second vocabulary.
    kind:
      input.decision === "reject"
        ? WORK_GRAPH_EDGE_KIND.rejectedBy
        : WORK_GRAPH_EDGE_KIND.approvedBy,
  };
}
