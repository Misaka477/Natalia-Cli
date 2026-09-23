"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORK_GRAPH_EDGE_KIND = exports.WORK_GRAPH_KIND = void 0;
exports.agentActionNodeID = agentActionNodeID;
exports.toolCallNodeID = toolCallNodeID;
exports.approvalNodeID = approvalNodeID;
exports.agentActionNode = agentActionNode;
exports.toolCallNode = toolCallNode;
exports.toolCallEdge = toolCallEdge;
exports.approvalNode = approvalNode;
exports.approvalEdge = approvalEdge;
exports.constitutionRuleNode = constitutionRuleNode;
exports.decisionNode = decisionNode;
exports.checkpointNode = checkpointNode;
exports.rollbackCheckpointEdge = rollbackCheckpointEdge;
exports.workspaceChangeNodeID = workspaceChangeNodeID;
exports.workspaceChangeNode = workspaceChangeNode;
exports.externalWorkspaceChangeNode = externalWorkspaceChangeNode;
exports.workspaceChangeEdge = workspaceChangeEdge;
exports.completionNode = completionNode;
exports.completionValidationEdge = completionValidationEdge;
exports.constitutionCheckEdge = constitutionCheckEdge;
exports.verifyWorkGraphIntegrity = verifyWorkGraphIntegrity;
exports.unattributedChangeNodes = unattributedChangeNodes;
/**
 * The WG1 node vocabulary, taken from `workGraphNodeSchema` in
 * `@natalia/contracts` rather than invented here. The event type declares
 * `kind: string`, so nothing would have stopped this writer from choosing its own
 * names — and a second vocabulary is the same failure as a second id system:
 * every consumer would have to know which spelling it is looking at.
 * `work-graph.test.ts` validates emitted facts against those schemas, so the
 * vocabulary is enforced rather than merely documented.
 */
exports.WORK_GRAPH_KIND = {
    agentAction: "agent_action",
    toolCall: "tool_call",
    approval: "approval",
    checkpoint: "checkpoint",
    workspaceChange: "workspace_change",
    constraint: "constraint",
    decision: "decision",
};
/** Edge vocabulary, likewise from `workGraphEdgeSchema`. */
exports.WORK_GRAPH_EDGE_KIND = {
    caused: "caused",
    approvedBy: "approved_by",
    rejectedBy: "rejected_by",
    modified: "modified",
    rolledBackBy: "rolled_back_by",
    validatedBy: "validated_by",
    constrainedBy: "constrained_by",
};
function agentActionNodeID(turnID) {
    return "wg:action:".concat(turnID);
}
function toolCallNodeID(turnID, callID) {
    return "wg:tool:".concat(turnID, ":").concat(callID);
}
function approvalNodeID(approvalID) {
    return "wg:approval:".concat(approvalID);
}
/**
 * The only summary builder. Keeps free text out of the graph: a caller cannot
 * pass a command line or a tool result through it.
 */
function workGraphSummary(parts) {
    return parts
        .filter(function (part) { return Boolean(part); })
        .map(function (part) { return part.replaceAll(/\s+/gu, " ").trim(); })
        .join(" · ")
        .slice(0, 200);
}
/** One node per turn: the agent acted. */
function agentActionNode(input) {
    var _a;
    return {
        type: "workgraph.node_added",
        id: agentActionNodeID(input.turnID),
        nodeID: agentActionNodeID(input.turnID),
        kind: exports.WORK_GRAPH_KIND.agentAction,
        // Deliberately not the prompt text: a prompt can contain anything.
        summary: workGraphSummary(["turn", input.agent]),
        actor: (_a = input.agent) !== null && _a !== void 0 ? _a : "agent",
        sessionID: input.sessionID,
        turnID: input.turnID,
    };
}
/**
 * One node per settled tool call, plus the edge to the turn that caused it. Only
 * settled calls are recorded, because an in-flight call is not yet a fact.
 */
function toolCallNode(input) {
    return {
        type: "workgraph.node_added",
        id: toolCallNodeID(input.turnID, input.callID),
        nodeID: toolCallNodeID(input.turnID, input.callID),
        kind: exports.WORK_GRAPH_KIND.toolCall,
        summary: workGraphSummary([input.toolName, input.status]),
        actor: input.toolName,
        sessionID: input.sessionID,
        turnID: input.turnID,
    };
}
function toolCallEdge(input) {
    return {
        type: "workgraph.edge_added",
        id: "wg:edge:action-tool:".concat(input.turnID, ":").concat(input.callID),
        sourceID: agentActionNodeID(input.turnID),
        targetID: toolCallNodeID(input.turnID, input.callID),
        kind: exports.WORK_GRAPH_EDGE_KIND.caused,
    };
}
/**
 * One node per resolved approval. The decision is a fact worth keeping; the
 * preview text is not, because it can contain a command line.
 */
function approvalNode(input) {
    return {
        type: "workgraph.node_added",
        id: approvalNodeID(input.approvalID),
        nodeID: approvalNodeID(input.approvalID),
        kind: exports.WORK_GRAPH_KIND.approval,
        summary: workGraphSummary([input.toolName, input.decision]),
        actor: "user",
        sessionID: input.sessionID,
        turnID: input.turnID,
    };
}
/** Links an approval to the tool call it authorized, when that is known. */
function approvalEdge(input) {
    return {
        type: "workgraph.edge_added",
        id: "wg:edge:tool-approval:".concat(input.turnID, ":").concat(input.callID),
        sourceID: toolCallNodeID(input.turnID, input.callID),
        targetID: approvalNodeID(input.approvalID),
        // A refusal is as much a fact as an approval, and calling it `approved_by`
        // would make the graph answer "who authorized this" with someone who
        // refused. `rejected_by` is a deliberate addition to the WG1 edge
        // vocabulary, not a second vocabulary.
        kind: input.decision === "reject"
            ? exports.WORK_GRAPH_EDGE_KIND.rejectedBy
            : exports.WORK_GRAPH_EDGE_KIND.approvedBy,
    };
}
/**
 * One node per constitution rule (CST4 Work Graph linkage). A rule is a
 * `constraint` in the graph — the durable "this may not happen" fact that
 * tool calls and drift findings relate to. The statement is safe prose; the
 * rule id is the identity.
 */
function constitutionRuleNode(input) {
    return {
        type: "workgraph.node_added",
        id: "wg:constraint:".concat(input.ruleID),
        nodeID: "wg:constraint:".concat(input.ruleID),
        kind: exports.WORK_GRAPH_KIND.constraint,
        summary: workGraphSummary(["constraint", input.ruleID]),
        actor: input.scope === "release" ? "runtime" : "constitution",
        target: input.ruleID,
        sessionID: input.sessionID,
    };
}
/**
 * One node per recorded decision (CST4 Work Graph linkage). A decision is a
 * `decision` node in the graph. The decision text is safe prose; the decision
 * id is the identity.
 */
function decisionNode(input) {
    return {
        type: "workgraph.node_added",
        id: "wg:decision:".concat(input.decisionID),
        nodeID: "wg:decision:".concat(input.decisionID),
        kind: exports.WORK_GRAPH_KIND.decision,
        summary: workGraphSummary(["decision", input.decisionID]),
        actor: "decision",
        target: input.decisionID,
        sessionID: input.sessionID,
    };
}
function checkpointNode(input) {
    var nodeID = "wg:checkpoint:".concat(input.sessionID, ":").concat(input.checkpointID);
    return __assign({ type: "workgraph.node_added", id: nodeID, nodeID: nodeID, kind: exports.WORK_GRAPH_KIND.checkpoint, summary: workGraphSummary(["checkpoint", input.reason]), actor: "checkpoint", target: input.checkpointID, sessionID: input.sessionID, turnID: input.turnID }, (input.planID ? { planID: input.planID } : {}));
}
function rollbackCheckpointEdge(input) {
    return {
        type: "workgraph.edge_added",
        id: "wg:edge:rollback:".concat(input.sessionID, ":").concat(input.checkpointID, ":").concat(input.safetyCheckpointID),
        sourceID: checkpointNode({
            checkpointID: input.checkpointID,
            reason: "rollback",
            sessionID: input.sessionID,
        }).nodeID,
        targetID: checkpointNode({
            checkpointID: input.safetyCheckpointID,
            reason: "rollback_safety",
            sessionID: input.sessionID,
        }).nodeID,
        kind: exports.WORK_GRAPH_EDGE_KIND.rolledBackBy,
    };
}
function workspaceChangeNodeID(identityID, path) {
    return "wg:change:".concat(identityID, ":").concat(path);
}
/**
 * One node per workspace file a call changed.
 *
 * The path is recorded here, unlike everywhere else in this module, because it is
 * the fact: a graph that cannot say which file changed cannot answer the question
 * it exists for. What stays out is still everything sensitive — the content
 * written, the arguments, the diff and the output. A workspace-relative path is
 * the identity of the changed thing, not its contents.
 */
function workspaceChangeNode(input) {
    var _a, _b, _c;
    var identityID = (_b = (_a = input.turnID) !== null && _a !== void 0 ? _a : input.operationID) !== null && _b !== void 0 ? _b : input.externalID;
    if (!identityID)
        throw new Error("workspace change requires an identity");
    var actor = ((_c = input.turnID) !== null && _c !== void 0 ? _c : input.operationID)
        ? input.toolName
        : input.externalID
            ? "external"
            : input.toolName;
    return {
        type: "workgraph.node_added",
        id: workspaceChangeNodeID(identityID, input.path),
        nodeID: workspaceChangeNodeID(identityID, input.path),
        kind: exports.WORK_GRAPH_KIND.workspaceChange,
        summary: workGraphSummary([actor, "changed"]),
        target: input.path,
        actor: actor,
        sessionID: input.sessionID,
        turnID: input.turnID,
    };
}
/**
 * A confirmed external change with no reliable identity becomes an isolated
 * `workspace_change` node (§56.9: "确认的外部变化可以生成孤立 workspace_change 节点…
 * 没有可靠 turnID/callID 时不建立因果边"). The identity is the confirmed-change
 * id, so replay stays stable; no `tool_call --modified-->` edge is created.
 */
function externalWorkspaceChangeNode(input) {
    return workspaceChangeNode({
        externalID: "external:".concat(input.confirmedChangeID),
        path: input.path,
        toolName: "external",
        sessionID: input.sessionID,
    });
}
/** Links the tool call to the file it changed. */
function workspaceChangeEdge(input) {
    return {
        type: "workgraph.edge_added",
        id: "wg:edge:tool-change:".concat(input.turnID, ":").concat(input.callID, ":").concat(input.path),
        sourceID: toolCallNodeID(input.turnID, input.callID),
        targetID: workspaceChangeNodeID(input.turnID, input.path),
        kind: exports.WORK_GRAPH_EDGE_KIND.modified,
    };
}
/**
 * One node per recorded completion card (P2 E4). The completion is a
 * validation-class fact in the graph: it is the durable "this task reached a
 * judge-able state" answer that workspace changes link to through
 * `validated_by`. The summary never carries the completion prose.
 */
function completionNode(input) {
    return __assign({ type: "workgraph.node_added", id: "wg:completion:".concat(input.completionID), nodeID: "wg:completion:".concat(input.completionID), kind: "validation", summary: workGraphSummary(["completion", input.taskID]), actor: "completion", target: input.completionID, sessionID: input.sessionID }, (input.turnID ? { turnID: input.turnID } : {}));
}
/**
 * A completion card validates a workspace change (P2 E4): the change node is
 * connected to a validation-node-style fact through a `validated_by` edge. The
 * edge exists in `workGraphEdgeSchema`; this is the writer that emits it. The
 * target is the workspace-change node the completion rests on.
 */
function completionValidationEdge(input) {
    return {
        type: "workgraph.edge_added",
        id: "wg:edge:completion-validated:".concat(input.completionID, ":").concat(input.path),
        sourceID: workspaceChangeNodeID(input.changeID, input.path),
        targetID: "wg:completion:".concat(input.completionID),
        kind: exports.WORK_GRAPH_EDGE_KIND.validatedBy,
    };
}
/**
 * A constitution preflight that blocked a tool call connects the call to the
 * rule that constrained it (CST4: the `constrained_by` edge kind in
 * `workGraphEdgeSchema`, previously never emitted). Only a conflict is an edge:
 * a rule a call merely passed is not news, so a passing check does not spam the
 * graph with "constrained by" relations on every tool call. The target is the
 * `constraint` node the runtime seeds for each rule at startup (§56.37).
 */
function constitutionCheckEdge(input) {
    return {
        type: "workgraph.edge_added",
        id: "wg:edge:tool-constraint:".concat(input.turnID, ":").concat(input.callID, ":").concat(input.ruleID),
        sourceID: toolCallNodeID(input.turnID, input.callID),
        targetID: "wg:constraint:".concat(input.ruleID),
        kind: exports.WORK_GRAPH_EDGE_KIND.constrainedBy,
    };
}
/**
 * Rebuilds the Work Graph from the event stream and verifies its integrity
 * (EI WG4 / Phase 3 D). Pure: the same events always rebuild the same graph,
 * so this doubles as the replay check — a non-deterministic writer (e.g. a
 * `Date.now()` node id) would surface as a duplicate id or a dangling edge.
 */
function verifyWorkGraphIntegrity(events) {
    var nodeEvents = events.filter(function (event) {
        return event.type === "workgraph.node_added";
    });
    var edgeEvents = events.filter(function (event) {
        return event.type === "workgraph.edge_added";
    });
    var nodeIDs = new Set(nodeEvents.map(function (node) { return node.nodeID; }));
    var seen = new Set();
    var duplicateNodeIDs = [];
    for (var _i = 0, nodeEvents_1 = nodeEvents; _i < nodeEvents_1.length; _i++) {
        var node = nodeEvents_1[_i];
        if (seen.has(node.nodeID))
            duplicateNodeIDs.push(node.nodeID);
        else
            seen.add(node.nodeID);
    }
    var danglingEdges = [];
    for (var _a = 0, edgeEvents_1 = edgeEvents; _a < edgeEvents_1.length; _a++) {
        var edge = edgeEvents_1[_a];
        var missingSource = !nodeIDs.has(edge.sourceID);
        var missingTarget = !nodeIDs.has(edge.targetID);
        if (missingSource || missingTarget)
            danglingEdges.push({
                edgeID: edge.id,
                sourceID: edge.sourceID,
                targetID: edge.targetID,
                missing: missingSource && missingTarget
                    ? "both"
                    : missingSource
                        ? "source"
                        : "target",
            });
    }
    var incompleteNodes = nodeEvents
        .filter(function (node) { return !node.sessionID; })
        .map(function (node) { return ({
        nodeID: node.nodeID,
        kind: node.kind,
        summary: node.summary,
    }); });
    return {
        nodeCount: nodeEvents.length,
        edgeCount: edgeEvents.length,
        danglingEdges: danglingEdges,
        incompleteNodes: incompleteNodes,
        duplicateNodeIDs: duplicateNodeIDs,
        stable: danglingEdges.length === 0 && duplicateNodeIDs.length === 0,
    };
}
/**
 * The unattributed workspace changes in a graph (EI WG4 / Phase 3 D): the
 * `workspace_change` nodes an external reconcile produced with no reliable
 * turn identity (`actor: "external"`, no `turnID`). These are the changes the
 * runtime could not attribute to a tool call — surfaced for diagnosis, never
 * silently folded into the causal chain.
 */
function unattributedChangeNodes(events) {
    return events.filter(function (event) {
        return event.type === "workgraph.node_added" &&
            event.kind === exports.WORK_GRAPH_KIND.workspaceChange &&
            event.actor === "external" &&
            !event.turnID;
    });
}
