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
var bun_test_1 = require("bun:test");
var session_intelligence_1 = require("../src/session-intelligence");
(0, bun_test_1.test)("changed files count only work-graph workspace_change nodes", function () {
    var events = [
        {
            type: "workgraph.node_added",
            id: "wg:action:t1",
            nodeID: "wg:action:t1",
            kind: "agent_action",
            summary: "turn",
            sessionID: "ses_1",
        },
        {
            type: "workgraph.node_added",
            id: "wg:change:t1:src/a.ts",
            nodeID: "wg:change:t1:src/a.ts",
            kind: "workspace_change",
            summary: "write_file changed",
            target: "src/a.ts",
            actor: "write_file",
            sessionID: "ses_1",
        },
        {
            type: "workgraph.node_added",
            id: "wg:change:t1:src/b.ts",
            nodeID: "wg:change:t1:src/b.ts",
            kind: "workspace_change",
            summary: "edit_file changed",
            target: "src/b.ts",
            actor: "edit_file",
            sessionID: "ses_1",
        },
    ];
    (0, bun_test_1.expect)((0, session_intelligence_1.countChangedFiles)(events)).toBe(2);
});
(0, bun_test_1.test)("validated changes come from evidence events, none today", function () {
    var events = [
        {
            type: "evidence.recorded",
            id: "evidence_1",
            taskID: "task_1",
            objective: "objective",
            status: "validated",
            changes: [{ path: "src/a.ts", changeType: "modified", summary: "fixed" }],
        },
    ];
    (0, bun_test_1.expect)((0, session_intelligence_1.countValidatedChanges)(events)).toBe(1);
    (0, bun_test_1.expect)((0, session_intelligence_1.countChangedFiles)(events)).toBe(0);
});
(0, bun_test_1.test)("latest confirmed output is the last content.done text", function () {
    var events = [
        { type: "content.delta", id: "t1", text: "unconfirmed" },
        { type: "content.done", id: "t1", text: "confirmed one" },
        { type: "content.done", id: "t2", text: "final" },
    ];
    (0, bun_test_1.expect)((0, session_intelligence_1.latestConfirmedOutput)(events)).toBe("final");
});
(0, bun_test_1.test)("the snapshot bounds recent output to the schema's 2000-character cap", function () {
    var _a;
    var events = [
        { type: "content.done", id: "t1", text: "x".repeat(3000) },
    ];
    var snapshot = (0, session_intelligence_1.buildSessionIntelligenceSnapshot)({
        id: "snapshot:bound",
        events: events,
        live: { agentStatus: "idle" },
    });
    (0, bun_test_1.expect)((_a = snapshot.recentOutput) === null || _a === void 0 ? void 0 : _a.length).toBe(2000);
});
(0, bun_test_1.test)("PTY presence follows the last timeline action per pane", function () {
    var base = { target: { kind: "host", cwd: "/w" } };
    var started = __assign({ type: "terminal.timeline", id: "term_1", actor: "model", action: "started", status: "executed", summary: "started", at: "now" }, base);
    var wrote = __assign({ type: "terminal.timeline", id: "term_1", actor: "model", action: "write", status: "executed", summary: "write", at: "now" }, base);
    var exited = __assign({ type: "terminal.timeline", id: "term_1", actor: "model", action: "exit", status: "executed", summary: "exit", at: "now" }, base);
    (0, bun_test_1.expect)((0, session_intelligence_1.hasLivePTY)([started])).toBe(true);
    (0, bun_test_1.expect)((0, session_intelligence_1.hasLivePTY)([started, wrote])).toBe(true);
    (0, bun_test_1.expect)((0, session_intelligence_1.hasLivePTY)([started, wrote, exited])).toBe(false);
    (0, bun_test_1.expect)((0, session_intelligence_1.hasLivePTY)([exited])).toBe(false);
});
(0, bun_test_1.test)("sandbox presence follows the last status per sandbox", function () {
    var created = {
        type: "sandbox.update",
        id: "sb_1",
        status: "created",
        root: "/w/.natalia/sandboxes/sb_1",
        isolationLevel: "workspace",
        changedFiles: 0,
        runningResources: 0,
        target: {
            kind: "sandbox",
            sandboxID: "sb_1",
            root: "/r",
            isolationLevel: "workspace",
        },
        resourcePolicy: "policy",
    };
    var deleted = __assign(__assign({}, created), { status: "deleted" });
    (0, bun_test_1.expect)((0, session_intelligence_1.hasLiveSandbox)([created])).toBe(true);
    (0, bun_test_1.expect)((0, session_intelligence_1.hasLiveSandbox)([created, deleted])).toBe(false);
    (0, bun_test_1.expect)((0, session_intelligence_1.hasLiveSandbox)([])).toBe(false);
});
(0, bun_test_1.test)("snapshot builder is secret-safe and carries only derived counts", function () {
    var events = [
        {
            type: "content.done",
            id: "t1",
            text: "the model reply",
        },
        {
            type: "workgraph.node_added",
            id: "wg:change:t1:src/a.ts",
            nodeID: "wg:change:t1:src/a.ts",
            kind: "workspace_change",
            summary: "write_file changed",
            target: "src/a.ts",
            actor: "write_file",
            sessionID: "ses_1",
        },
    ];
    var snapshot = (0, session_intelligence_1.buildSessionIntelligenceSnapshot)({
        id: "snapshot:1",
        events: events,
        live: {
            agentStatus: "running",
            currentStep: "step 3",
            activeTool: "write_file",
        },
    });
    (0, bun_test_1.expect)(snapshot).toMatchObject({
        type: "session.snapshot",
        id: "snapshot:1",
        agentStatus: "running",
        currentStep: "step 3",
        activeTool: "write_file",
        changedFiles: 1,
        unvalidatedChanges: 1,
        recentOutput: "the model reply",
        hasPTY: false,
        hasSandbox: false,
    });
    // The secret-safe boundary: no file content, no tool arguments, no results.
    (0, bun_test_1.expect)(JSON.stringify(snapshot)).not.toContain("source code");
    (0, bun_test_1.expect)(JSON.stringify(snapshot)).not.toContain("command");
    (0, bun_test_1.expect)(JSON.stringify(snapshot)).not.toContain("arguments");
});
