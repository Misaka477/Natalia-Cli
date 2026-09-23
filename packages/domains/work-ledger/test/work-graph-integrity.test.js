"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var work_graph_1 = require("../src/work-graph");
var ses = "ses_1";
(0, bun_test_1.test)("a well-formed graph is stable with no dangling edges or incomplete nodes", function () {
    var events = [
        (0, work_graph_1.toolCallNode)({
            turnID: "turn_1",
            callID: "call_1",
            toolName: "fs-write",
            status: "succeeded",
            sessionID: ses,
        }),
        (0, work_graph_1.workspaceChangeNode)({
            turnID: "turn_1",
            path: "src/a.ts",
            toolName: "fs-write",
            sessionID: ses,
        }),
        (0, work_graph_1.workspaceChangeEdge)({
            turnID: "turn_1",
            callID: "call_1",
            path: "src/a.ts",
        }),
    ];
    var report = (0, work_graph_1.verifyWorkGraphIntegrity)(events);
    (0, bun_test_1.expect)(report.nodeCount).toBe(2);
    (0, bun_test_1.expect)(report.edgeCount).toBe(1);
    (0, bun_test_1.expect)(report.danglingEdges).toEqual([]);
    (0, bun_test_1.expect)(report.incompleteNodes).toEqual([]);
    (0, bun_test_1.expect)(report.duplicateNodeIDs).toEqual([]);
    (0, bun_test_1.expect)(report.stable).toBe(true);
});
(0, bun_test_1.test)("an edge to a missing node is a dangling edge and the graph is not stable", function () {
    var events = [
        (0, work_graph_1.workspaceChangeNode)({
            turnID: "turn_1",
            path: "src/a.ts",
            toolName: "fs-write",
            sessionID: ses,
        }),
        // The tool_call node this edge points from was never recorded (the change
        // node it targets does exist).
        (0, work_graph_1.workspaceChangeEdge)({
            turnID: "turn_1",
            callID: "call_missing",
            path: "src/a.ts",
        }),
    ];
    var report = (0, work_graph_1.verifyWorkGraphIntegrity)(events);
    (0, bun_test_1.expect)(report.danglingEdges).toHaveLength(1);
    (0, bun_test_1.expect)(report.danglingEdges[0]).toMatchObject({ missing: "source" });
    (0, bun_test_1.expect)(report.stable).toBe(false);
});
(0, bun_test_1.test)("a node with no session correlation is incomplete, not silently attributed", function () {
    var events = [
        {
            type: "workgraph.node_added",
            id: "wg:decision:x",
            nodeID: "wg:decision:x",
            kind: "decision",
            summary: "a decision with no session",
        },
    ];
    var report = (0, work_graph_1.verifyWorkGraphIntegrity)(events);
    (0, bun_test_1.expect)(report.incompleteNodes).toHaveLength(1);
    (0, bun_test_1.expect)(report.incompleteNodes[0]).toMatchObject({
        nodeID: "wg:decision:x",
        kind: "decision",
    });
});
(0, bun_test_1.test)("a re-emitted node id is a duplicate that breaks stability", function () {
    var node = (0, work_graph_1.toolCallNode)({
        turnID: "turn_1",
        callID: "call_1",
        toolName: "fs-write",
        status: "succeeded",
        sessionID: ses,
    });
    var report = (0, work_graph_1.verifyWorkGraphIntegrity)([node, node]);
    (0, bun_test_1.expect)(report.duplicateNodeIDs).toEqual([node.nodeID]);
    (0, bun_test_1.expect)(report.stable).toBe(false);
});
(0, bun_test_1.test)("unattributedChangeNodes surfaces only external workspace changes with no turn", function () {
    var events = [
        // Attributed change (has a turnID) — not unattributed.
        (0, work_graph_1.workspaceChangeNode)({
            turnID: "turn_1",
            path: "src/a.ts",
            toolName: "fs-write",
            sessionID: ses,
        }),
        // External change (no turn identity) — the unattributed one.
        (0, work_graph_1.externalWorkspaceChangeNode)({
            confirmedChangeID: "chg_1",
            path: "src/b.ts",
            sessionID: ses,
        }),
        (0, work_graph_1.externalWorkspaceChangeNode)({
            confirmedChangeID: "chg_2",
            path: "src/c.ts",
            sessionID: ses,
        }),
    ];
    var unattributed = (0, work_graph_1.unattributedChangeNodes)(events);
    (0, bun_test_1.expect)(unattributed.map(function (node) { return node.target; })).toEqual([
        "src/b.ts",
        "src/c.ts",
    ]);
    (0, bun_test_1.expect)(unattributed.every(function (node) { return node.actor === "external" && !node.turnID; })).toBe(true);
});
