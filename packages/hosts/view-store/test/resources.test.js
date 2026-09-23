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
var src_1 = require("../src");
// These cover the surfaces beyond the conversation core, so a UI can render
// terminals, sandboxes, checkpoints, subagents and status without reading raw
// events. Each assertion is about a fact the runtime produced, never about how a
// particular UI chooses to draw it.
var terminalUpdate = function (id, overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ type: "terminal.update", id: id, command: "bash", cwd: "/work", status: "running", attached: true, rows: 24, cols: 80, activity: "running", tail: "", transcript: "", target: { kind: "host", cwd: "/work" } }, overrides));
};
(0, bun_test_1.test)("the latest terminal state is kept per pane", function () {
    var state = (0, src_1.projectEvents)([
        terminalUpdate("t_a"),
        terminalUpdate("t_b", { command: "vim" }),
        terminalUpdate("t_a", { status: "exited", activity: "waiting" }),
    ]);
    (0, bun_test_1.expect)(Object.keys(state.terminals).sort()).toEqual(["t_a", "t_b"]);
    (0, bun_test_1.expect)(state.terminals.t_a).toMatchObject({ status: "exited" });
    (0, bun_test_1.expect)(state.terminals.t_b).toMatchObject({ command: "vim" });
});
(0, bun_test_1.test)("terminal timeline is per pane and bounded", function () {
    var _a;
    var events = [];
    for (var index = 0; index < src_1.terminalTimelineLimit + 40; index += 1)
        events.push({
            type: "terminal.timeline",
            id: "t_a",
            actor: "model",
            action: "created",
            status: "executed",
            summary: "entry ".concat(index),
            at: new Date(index).toISOString(),
        });
    var state = (0, src_1.projectEvents)(events);
    // A projection that grows without limit is a leak in every consumer.
    (0, bun_test_1.expect)(state.terminalTimeline.t_a).toHaveLength(src_1.terminalTimelineLimit);
    (0, bun_test_1.expect)((_a = state.terminalTimeline.t_a) === null || _a === void 0 ? void 0 : _a.at(-1)).toMatchObject({
        summary: "entry ".concat(src_1.terminalTimelineLimit + 39),
    });
});
(0, bun_test_1.test)("terminal approvals are keyed by approval, not by pane", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "terminal.approval",
            id: "t_a",
            approvalID: "ap_1",
            state: "awaiting",
            action: "write",
            reason: "risky",
            target: { kind: "host", cwd: "/work" },
        },
        {
            type: "terminal.approval",
            id: "t_a",
            approvalID: "ap_2",
            state: "approved",
            action: "write",
            reason: "second",
            target: { kind: "host", cwd: "/work" },
        },
    ]);
    // One pane can accumulate several approvals; a UI must resolve the right one.
    (0, bun_test_1.expect)(Object.keys(state.terminalApprovals).sort()).toEqual(["ap_1", "ap_2"]);
    (0, bun_test_1.expect)(state.terminalApprovals.ap_1).toMatchObject({ state: "awaiting" });
});
(0, bun_test_1.test)("sandbox state and diffs project separately", function () {
    var _a;
    var state = (0, src_1.projectEvents)([
        {
            type: "sandbox.update",
            id: "box",
            status: "created",
            root: "/work/.natalia/sandboxes/box",
            isolationLevel: "workspace",
            changedFiles: 2,
            runningResources: 0,
            target: {
                kind: "sandbox",
                sandboxID: "box",
                root: "/work/.natalia/sandboxes/box",
                isolationLevel: "workspace",
            },
            resourcePolicy: "sandbox_manifest",
        },
        {
            type: "sandbox.diff",
            id: "box",
            changes: [{ kind: "add", path: "a.txt" }],
        },
    ]);
    (0, bun_test_1.expect)(state.sandboxes.box).toMatchObject({ changedFiles: 2 });
    (0, bun_test_1.expect)((_a = state.sandboxDiffs.box) === null || _a === void 0 ? void 0 : _a.changes).toHaveLength(1);
});
(0, bun_test_1.test)("a sandbox audit that requires approval is visible in the transcript", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "sandbox.audit",
            id: "box",
            action: "merge",
            target: {
                kind: "sandbox",
                sandboxID: "box",
                root: "/work/.natalia/sandboxes/box",
                isolationLevel: "workspace",
            },
            approvalRequired: true,
            checkpointPolicy: "sandbox_manifest",
            message: "merge needs approval",
        },
    ]);
    var block = state.messages.find(function (item) { return item.role === "system"; });
    (0, bun_test_1.expect)(block === null || block === void 0 ? void 0 : block.text).toBe("merge needs approval");
    (0, bun_test_1.expect)(block === null || block === void 0 ? void 0 : block.status).toBe("approval_required");
});
(0, bun_test_1.test)("subagents keep a current state and full stable history", function () {
    var events = [];
    for (var index = 0; index < 110; index += 1)
        events.push({
            type: "subagent.update",
            id: "child",
            status: index === 109 ? "completed" : "running",
            attached: false,
            event: "status",
            continuation: index,
        });
    var state = (0, src_1.projectEvents)(events);
    (0, bun_test_1.expect)(state.subagents.child).toMatchObject({ status: "completed" });
    (0, bun_test_1.expect)(state.subagentHistory.child).toHaveLength(110);
});
(0, bun_test_1.test)("subagent history pagination prepends older and appends newer", function () {
    var _a, _b;
    var state = (0, src_1.initialState)();
    var event = function (continuation) { return ({
        type: "subagent.update",
        id: "child",
        status: "running",
        attached: false,
        event: "status",
        continuation: continuation,
    }); };
    (0, src_1.hydrateSubagentHistory)(state, [event(1), event(2)], {
        replace: true,
        subagentID: "child",
    });
    (0, src_1.hydrateSubagentHistory)(state, [event(0)], {
        direction: "older",
        subagentID: "child",
    });
    (0, bun_test_1.expect)((_a = state.subagentHistory.child) === null || _a === void 0 ? void 0 : _a.map(function (row) { return row.continuation; })).toEqual([
        0, 1, 2,
    ]);
    (0, src_1.hydrateSubagentHistory)(state, [event(3)], {
        direction: "newer",
        subagentID: "child",
    });
    (0, bun_test_1.expect)((_b = state.subagentHistory.child) === null || _b === void 0 ? void 0 : _b.map(function (row) { return row.continuation; })).toEqual([
        0, 1, 2, 3,
    ]);
});
(0, bun_test_1.test)("checkpoints accumulate and rollback tracks one operation", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "checkpoint.created",
            id: "cp_1",
            reason: "turn_begin",
            sequence: 1,
            complete: true,
            files: 3,
            changes: 1,
            contextJournalOffset: 0,
            step: 1,
            tokenEstimate: 10,
            diskUsageBytes: 100,
        },
    ]);
    (0, bun_test_1.expect)(state.checkpoints).toHaveLength(1);
    state = (0, src_1.projectEvents)([
        {
            type: "rollback.begin",
            checkpointID: "cp_1",
            safetyCheckpointID: "cp_safety",
        },
    ], state);
    (0, bun_test_1.expect)(state.rollback).toMatchObject({ state: "running" });
    state = (0, src_1.projectEvents)([
        {
            type: "rollback.end",
            checkpointID: "cp_1",
            safetyCheckpointID: "cp_safety",
            restoredFiles: 3,
            deletedFiles: 1,
            contextJournalOffset: 0,
            step: 1,
        },
    ], state);
    (0, bun_test_1.expect)(state.rollback).toMatchObject({
        state: "completed",
        restoredFiles: 3,
        deletedFiles: 1,
    });
});
(0, bun_test_1.test)("an incomplete checkpoint is reported, not silently dropped", function () {
    // Rollback safety depends on knowing a checkpoint did not finish.
    var state = (0, src_1.projectEvents)([
        {
            type: "checkpoint.failed",
            reason: "disk_full",
            message: "no space",
            incomplete: true,
        },
    ]);
    (0, bun_test_1.expect)(state.messages.some(function (block) { return block.text.includes("incomplete"); })).toBe(true);
});
(0, bun_test_1.test)("a failed rollback records whether it recovered", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "rollback.failed",
            checkpointID: "cp_1",
            message: "conflict",
            recovered: false,
        },
    ]);
    (0, bun_test_1.expect)(state.rollback).toMatchObject({ state: "failed", recovered: false });
});
(0, bun_test_1.test)("mcp, plugin and capability states project by identity", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "mcp.status",
            server: "docs",
            status: "connected",
            tools: 4,
        },
        { type: "plugin.update", id: "p1", status: "loaded" },
        {
            type: "capability.loaded",
            id: "cap:natalia-terminal",
            apiVersion: 1,
            name: "Terminal",
            version: "1.0.0",
            scope: "session",
            grants: ["tools"],
        },
    ]);
    (0, bun_test_1.expect)(state.mcp.docs).toMatchObject({ tools: 4 });
    (0, bun_test_1.expect)(state.plugins.p1).toMatchObject({ status: "loaded" });
    (0, bun_test_1.expect)(state.capabilities["cap:natalia-terminal"]).toMatchObject({
        name: "Terminal",
    });
});
(0, bun_test_1.test)("an unloaded capability is removed rather than left as loaded", function () {
    var loaded = {
        type: "capability.loaded",
        id: "cap:x",
        apiVersion: 1,
        name: "X",
        version: "1.0.0",
        scope: "session",
        grants: ["tools"],
    };
    var state = (0, src_1.projectEvents)([
        loaded,
        { type: "capability.unloaded", id: "cap:x" },
    ]);
    (0, bun_test_1.expect)(state.capabilities).toEqual({});
});
(0, bun_test_1.test)("context status and compaction banner follow the runtime", function () {
    var _a;
    var state = (0, src_1.projectEvents)([
        {
            type: "context.status",
            used: 100,
            max: 200,
            source: "exact_checkpoint",
            thresholdPercent: 80,
            reserved: 20,
        },
        {
            type: "compaction.begin",
            id: "c1",
            trigger: "manual",
            beforeTokens: 100,
            maxTokens: 200,
            thresholdPercent: 80,
            reservedTokens: 20,
            attempt: 1,
            startedAt: "now",
        },
    ]);
    (0, bun_test_1.expect)(state.context).toMatchObject({ used: 100, max: 200 });
    (0, bun_test_1.expect)((_a = state.compactionBanner) === null || _a === void 0 ? void 0 : _a.kind).toBe("compacting");
    state = (0, src_1.projectEvents)([
        {
            type: "compaction.end",
            id: "c1",
            trigger: "manual",
            success: true,
            beforeTokens: 100,
            afterTokens: 40,
            durationMs: 30,
            attempts: 1,
        },
    ], state);
    // The banner clears, but the outcome stays in the transcript because
    // compaction changed what the model can still see.
    (0, bun_test_1.expect)(state.compactionBanner).toBeUndefined();
    (0, bun_test_1.expect)(state.messages.some(function (block) { return block.text.includes("100 -> 40 tokens"); })).toBe(true);
});
(0, bun_test_1.test)("retry banner appears and clears, exhaustion is recorded", function () {
    var _a;
    var state = (0, src_1.projectEvents)([
        {
            type: "step.retry",
            id: "t1",
            operation: "llm_step",
            step: 1,
            attempt: 2,
            maxAttempts: 3,
            waitMs: 300,
            reason: "timeout",
        },
    ]);
    (0, bun_test_1.expect)((_a = state.retryBanner) === null || _a === void 0 ? void 0 : _a.text).toContain("attempt 2/3");
    state = (0, src_1.projectEvents)([
        {
            type: "step.retry.cleared",
            id: "t1",
            operation: "llm_step",
            step: 1,
            attempts: 2,
        },
    ], state);
    (0, bun_test_1.expect)(state.retryBanner).toBeUndefined();
    var exhausted = (0, src_1.projectEvents)([
        {
            type: "step.retry.exhausted",
            id: "t1",
            operation: "llm_step",
            step: 1,
            attempts: 3,
            maxAttempts: 3,
            reason: "timeout",
            message: "gave up after 3 attempts",
            retryable: false,
        },
    ]);
    (0, bun_test_1.expect)(exhausted.retryBanner).toBeUndefined();
    (0, bun_test_1.expect)(exhausted.messages.some(function (block) { return block.status === "retry_exhausted"; })).toBe(true);
    (0, bun_test_1.expect)(exhausted.footer).toContain("not retryable");
});
(0, bun_test_1.test)("pause and resume are reflected and cleared by a terminal turn", function () {
    var state = (0, src_1.projectEvents)([
        { type: "turn.paused", id: "t1", reason: "user pause" },
    ]);
    (0, bun_test_1.expect)(state.paused).toBe(true);
    state = (0, src_1.projectEvents)([{ type: "turn.resumed", id: "t1" }], state);
    (0, bun_test_1.expect)(state.paused).toBe(false);
    // A turn that ends while paused must not leave the UI showing "paused".
    var stuck = (0, src_1.projectEvents)([
        { type: "turn.paused", id: "t1", reason: "user pause" },
        { type: "turn.finished", id: "t1", stopReason: "done" },
    ]);
    (0, bun_test_1.expect)(stuck.paused).toBe(false);
});
(0, bun_test_1.test)("policy decisions are retained so a UI can explain a refusal", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "policy.decision",
            turnID: "t1",
            toolName: "write_file",
            decision: "deny",
            reason: "protected path",
        },
    ]);
    (0, bun_test_1.expect)(state.policyDecisions).toHaveLength(1);
    (0, bun_test_1.expect)(state.policyDecisions[0]).toMatchObject({
        decision: "deny",
        reason: "protected path",
    });
});
(0, bun_test_1.test)("agent and model selections project", function () {
    var state = (0, src_1.projectEvents)([
        { type: "agent.selection", name: "review", pending: true },
        {
            type: "model.selection",
            modelID: "m1",
            variant: "high",
        },
    ]);
    (0, bun_test_1.expect)(state.agentSelection).toEqual({ name: "review", pending: true });
    (0, bun_test_1.expect)(state.modelSelection).toEqual({ modelID: "m1", variant: "high" });
});
(0, bun_test_1.test)("plugin projection contributions project and clear", function () {
    var contributed = (0, src_1.projectEvents)([
        {
            type: "projections.updated",
            contributions: [
                {
                    name: "demo.card",
                    title: "Demo card",
                    placement: "sidebar",
                    text: "hello",
                },
            ],
        },
    ]);
    (0, bun_test_1.expect)(contributed.pluginProjections).toEqual([
        {
            name: "demo.card",
            title: "Demo card",
            placement: "sidebar",
            text: "hello",
        },
    ]);
    var cleared = (0, src_1.projectEvents)([
        {
            type: "projections.updated",
            contributions: [],
        },
    ], contributed);
    (0, bun_test_1.expect)(cleared.pluginProjections).toEqual([]);
});
(0, bun_test_1.test)("evidence.recorded projects a message carrying its task", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "evidence.recorded",
            id: "evidence:1",
            taskID: "task_build",
            objective: "verify the build",
            status: "promoted",
        },
    ]);
    (0, bun_test_1.expect)(state.messages[0]).toMatchObject({
        id: "evidence:1",
        taskID: "task_build",
    });
});
(0, bun_test_1.test)("streamed tool arguments are reassembled in generic tool state", function () {
    var args = JSON.stringify({ items: [{ content: "x", status: "pending" }] });
    var half = Math.floor(args.length / 2);
    var state = (0, src_1.projectEvents)([
        {
            type: "turn.submitted",
            id: "t1",
            text: "plan",
            byteLength: 4,
            lineCount: 1,
            sha256: "x",
        },
        {
            type: "tool.update",
            id: "t1",
            name: "todo_write",
            callID: "c1",
            status: "running",
            summary: "…",
            argumentsDelta: args.slice(0, half),
        },
        {
            type: "tool.update",
            id: "t1",
            name: "todo_write",
            callID: "c1",
            status: "succeeded",
            summary: "1 todo",
            argumentsDelta: args.slice(half),
        },
    ]);
    // A half-received argument string must not be parsed or discarded.
    var tool = Object.values(state.tools)[0];
    (0, bun_test_1.expect)(tool === null || tool === void 0 ? void 0 : tool.argumentsRaw).toBe(args);
    (0, bun_test_1.expect)(tool === null || tool === void 0 ? void 0 : tool.status).toBe("succeeded");
});
(0, bun_test_1.test)("session intelligence snapshot projects", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "session.snapshot",
            id: "s1",
            agentStatus: "working",
            changedFiles: 3,
            unvalidatedChanges: 1,
            hasPTY: true,
            hasSandbox: false,
        },
    ]);
    (0, bun_test_1.expect)(state.intelligence).toMatchObject({
        agentStatus: "working",
        changedFiles: 3,
    });
});
(0, bun_test_1.test)("Work Graph events project into stable node and edge indexes", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "workgraph.node_added",
            id: "wg:action:t1",
            nodeID: "wg:action:t1",
            kind: "agent_action",
            summary: "turn",
            sessionID: "ses_1",
            turnID: "t1",
            episodeID: "epi_1",
        },
        {
            type: "workgraph.node_added",
            id: "wg:tool:t1:c1",
            nodeID: "wg:tool:t1:c1",
            kind: "tool_call",
            summary: "read_file · succeeded",
            actor: "read_file",
            sessionID: "ses_1",
            turnID: "t1",
            episodeID: "epi_1",
        },
        {
            type: "workgraph.edge_added",
            id: "wg:edge:t1:c1",
            sourceID: "wg:action:t1",
            targetID: "wg:tool:t1:c1",
            kind: "caused",
            episodeID: "epi_1",
        },
    ]);
    (0, bun_test_1.expect)(Object.keys(state.workGraphNodes).sort()).toEqual([
        "wg:action:t1",
        "wg:tool:t1:c1",
    ]);
    (0, bun_test_1.expect)(state.workGraphNodes["wg:tool:t1:c1"]).toMatchObject({
        kind: "tool_call",
        episodeID: "epi_1",
    });
    (0, bun_test_1.expect)(state.workGraphEdges["wg:edge:t1:c1"]).toMatchObject({
        kind: "caused",
        episodeID: "epi_1",
    });
});
(0, bun_test_1.test)("constitution, plans, mailbox and evidence project as host-agnostic facts", function () {
    var _a, _b, _c, _d, _e;
    var state = (0, src_1.projectEvents)([
        {
            type: "constitution.rule_added",
            id: "constitution:c-rel-001",
            ruleID: "C-REL-001",
            statement: "默认不 commit/push",
            scope: "release",
            priority: "critical",
            source: "policy",
            enforcement: "deny",
            overridePolicy: "user_scoped",
        },
        {
            type: "constitution.check",
            id: "check:1",
            ruleID: "C-REL-001",
            statement: "默认不 commit/push",
            priority: "critical",
            enforcement: "deny",
            action: "run_shell",
            resource: "global",
            conflict: true,
        },
        {
            type: "decision.recorded",
            id: "decision:1",
            decision: "ship from a sandbox",
            status: "accepted",
        },
        {
            type: "evidence.recorded",
            id: "evidence:1",
            taskID: "task_build",
            objective: "verify the build",
            status: "promoted",
        },
        {
            type: "completion.recorded",
            id: "completion:1",
            taskID: "task_build",
            objective: "verify the build",
            changeSummary: "1 files promoted from sandbox box",
            validations: [],
            recordedAt: "2026-08-26T00:00:00.000Z",
        },
        {
            type: "mailbox.queued",
            id: "mbq:1",
            messageID: "mb:1",
            source: "user_via_live_chat",
            priority: "normal",
            intent: "constraint",
            text: "keep it small",
            safeSummary: "keep it small",
            deliveryPolicy: "next_safe_boundary",
            createdAt: "2026-08-26T00:00:00.000Z",
        },
        {
            type: "mailbox.acknowledged",
            id: "mba:1",
            messageID: "mb:1",
            acknowledgedAt: "2026-08-26T00:00:01.000Z",
        },
        {
            type: "plan.doc.created",
            id: "plan:1:created",
            planID: "plan:1",
            title: "Build plan",
            documentPath: ".natalia/plans/build-plan.md",
            createdBy: "main_agent",
            status: "marked",
            createdAt: "2026-08-26T00:00:00.000Z",
        },
        {
            type: "plan.doc.status",
            id: "plan:1:status",
            planID: "plan:1",
            status: "executing",
            at: "2026-08-26T00:00:02.000Z",
        },
    ]);
    (0, bun_test_1.expect)((_a = state.constitutionRules["C-REL-001"]) === null || _a === void 0 ? void 0 : _a.enforcement).toBe("deny");
    (0, bun_test_1.expect)(state.constitutionConflicts).toHaveLength(1);
    (0, bun_test_1.expect)((_b = state.decisions[0]) === null || _b === void 0 ? void 0 : _b.decision).toBe("ship from a sandbox");
    (0, bun_test_1.expect)((_c = state.evidence[0]) === null || _c === void 0 ? void 0 : _c.taskID).toBe("task_build");
    (0, bun_test_1.expect)((_d = state.completions[0]) === null || _d === void 0 ? void 0 : _d.id).toBe("completion:1");
    (0, bun_test_1.expect)((_e = state.mailbox["mb:1"]) === null || _e === void 0 ? void 0 : _e.status).toBe("acknowledged");
    (0, bun_test_1.expect)(state.plans["plan:1"]).toMatchObject({
        status: "executing",
        documentPath: ".natalia/plans/build-plan.md",
    });
});
(0, bun_test_1.test)("work graph neighbourhood and unattributed changes are selectable", function () {
    var state = (0, src_1.projectEvents)([
        {
            type: "workgraph.node_added",
            id: "wg:action:t1",
            nodeID: "wg:action:t1",
            kind: "agent_action",
            summary: "turn",
        },
        {
            type: "workgraph.node_added",
            id: "wg:tool:t1:c1",
            nodeID: "wg:tool:t1:c1",
            kind: "tool_call",
            summary: "write · succeeded",
        },
        {
            type: "workgraph.node_added",
            id: "wg:change:orphan",
            nodeID: "wg:change:orphan",
            kind: "workspace_change",
            summary: "external.txt",
            target: "external.txt",
        },
        {
            type: "workgraph.edge_added",
            id: "wg:edge:t1:c1",
            sourceID: "wg:action:t1",
            targetID: "wg:tool:t1:c1",
            kind: "caused",
        },
    ]);
    var slice = (0, src_1.selectWorkGraphNeighborhood)(state, "wg:action:t1", 1);
    (0, bun_test_1.expect)(slice.nodes.map(function (node) { return node.nodeID; }).sort()).toEqual([
        "wg:action:t1",
        "wg:tool:t1:c1",
    ]);
    (0, bun_test_1.expect)(slice.edges).toHaveLength(1);
    (0, bun_test_1.expect)((0, src_1.selectUnattributedWorkGraphNodes)(state).map(function (node) { return node.nodeID; })).toEqual(["wg:change:orphan"]);
    (0, bun_test_1.expect)(slice.unattributed.map(function (node) { return node.nodeID; })).toEqual([
        "wg:change:orphan",
    ]);
});
(0, bun_test_1.test)("UI-only events are ignored, because they are not runtime facts", function () {
    // Dialog stacks and pane focus belong to whichever UI renders them. Projecting
    // them here would create UI-only durable truth in a shared layer.
    var state = (0, src_1.initialState)();
    var before = JSON.stringify(state);
    for (var _i = 0, _a = [
        { type: "dialog.open", id: "d1" },
        { type: "dialog.close", id: "d1" },
        { type: "terminal.pane.select", id: "t_a" },
    ]; _i < _a.length; _i++) {
        var event_1 = _a[_i];
        (0, src_1.applyEvent)(state, event_1);
    }
    (0, bun_test_1.expect)(JSON.stringify(state)).toBe(before);
});
(0, bun_test_1.test)("reduceState does not mutate the resource slices it copies", function () {
    var before = (0, src_1.projectEvents)([terminalUpdate("t_a")]);
    var snapshot = JSON.stringify(before);
    var after = (0, src_1.projectEvents)([terminalUpdate("t_b")], before);
    (0, bun_test_1.expect)(JSON.stringify(before)).toBe(snapshot);
    (0, bun_test_1.expect)(after.terminals).not.toBe(before.terminals);
    (0, bun_test_1.expect)(Object.keys(after.terminals).sort()).toEqual(["t_a", "t_b"]);
});
(0, bun_test_1.test)("initialState has every slice a consumer will read", function () {
    // A consumer indexing into an undefined slice is a crash, so the shape must be
    // complete from the start rather than appearing with the first event.
    var state = (0, src_1.initialState)();
    (0, bun_test_1.expect)(state.terminals).toEqual({});
    (0, bun_test_1.expect)(state.terminalTimeline).toEqual({});
    (0, bun_test_1.expect)(state.terminalApprovals).toEqual({});
    (0, bun_test_1.expect)(state.sandboxes).toEqual({});
    (0, bun_test_1.expect)(state.sandboxDiffs).toEqual({});
    (0, bun_test_1.expect)(state.subagents).toEqual({});
    (0, bun_test_1.expect)(state.subagentHistory).toEqual({});
    (0, bun_test_1.expect)(state.mcp).toEqual({});
    (0, bun_test_1.expect)(state.plugins).toEqual({});
    (0, bun_test_1.expect)(state.capabilities).toEqual({});
    (0, bun_test_1.expect)(state.checkpoints).toEqual([]);
    (0, bun_test_1.expect)(state.policyDecisions).toEqual([]);
    (0, bun_test_1.expect)(state.workGraphNodes).toEqual({});
    (0, bun_test_1.expect)(state.workGraphEdges).toEqual({});
    (0, bun_test_1.expect)(state.paused).toBe(false);
    (0, bun_test_1.expect)(state.rollback).toBeUndefined();
    (0, bun_test_1.expect)(state.context).toBeUndefined();
});
(0, bun_test_1.test)("a terminal transcript is bounded and says what was dropped", function () {
    var _a, _b;
    // A pane's scrollback grows for the life of the session. Keeping it whole would
    // grow the projection without limit in every consumer that holds it.
    var long = "x".repeat(src_1.terminalTranscriptChars + 5000);
    var state = (0, src_1.projectEvents)([terminalUpdate("t_a", { transcript: long })]);
    var stored = (_b = (_a = state.terminals.t_a) === null || _a === void 0 ? void 0 : _a.transcript) !== null && _b !== void 0 ? _b : "";
    (0, bun_test_1.expect)(stored.length).toBeLessThan(long.length);
    // A consumer must not render a truncated scrollback as though it were complete.
    (0, bun_test_1.expect)(stored).toContain("earlier chars omitted");
    (0, bun_test_1.expect)(stored).toContain("5000");
    // The visible part is the most recent output, which is what a pane shows.
    (0, bun_test_1.expect)(stored.endsWith("x".repeat(100))).toBe(true);
});
(0, bun_test_1.test)("a short transcript is kept exactly as published", function () {
    var _a;
    var state = (0, src_1.projectEvents)([
        terminalUpdate("t_a", { transcript: "short output" }),
    ]);
    (0, bun_test_1.expect)((_a = state.terminals.t_a) === null || _a === void 0 ? void 0 : _a.transcript).toBe("short output");
});
(0, bun_test_1.test)("a republished terminal update that changes nothing is dropped", function () {
    var _a;
    // Panes republish on every keystroke; an identical update must not churn the
    // projection and force consumers to re-render.
    var state = (0, src_1.projectEvents)([terminalUpdate("t_a", { tail: "$ ls" })]);
    var before = state.terminals;
    (0, src_1.applyEvent)(state, terminalUpdate("t_a", { tail: "$ ls" }));
    // Same identity: the no-op update did not rebuild the record.
    (0, bun_test_1.expect)(state.terminals).toBe(before);
    (0, src_1.applyEvent)(state, terminalUpdate("t_a", { tail: "$ ls -l" }));
    (0, bun_test_1.expect)(state.terminals).not.toBe(before);
    (0, bun_test_1.expect)((_a = state.terminals.t_a) === null || _a === void 0 ? void 0 : _a.tail).toBe("$ ls -l");
});
(0, bun_test_1.test)("a terminal update that only hands input to a viewer is kept", function () {
    var _a;
    // Who holds the keyboard is rendered ("user control (…)" in the TUI's pane), so
    // dropping this update would tell the reader the model is typing while a person
    // actually is. Nothing else about the pane changes on a takeover.
    var state = (0, src_1.projectEvents)([
        terminalUpdate("t_a", {
            ownership: "model",
            inputOwner: { type: "model" },
            geometryOwner: { type: "model" },
            viewers: [
                {
                    id: "v1",
                    kind: "embedded",
                    connectedAt: "2026-08-09T00:00:00.000Z",
                    lastSeenAt: "2026-08-09T00:00:00.000Z",
                },
            ],
        }),
    ]);
    var before = state.terminals.t_a;
    (0, src_1.applyEvent)(state, terminalUpdate("t_a", {
        ownership: "model",
        inputOwner: { type: "viewer", viewerID: "v1" },
        geometryOwner: { type: "model" },
        viewers: [
            {
                id: "v1",
                kind: "embedded",
                connectedAt: "2026-08-09T00:00:00.000Z",
                lastSeenAt: "2026-08-09T00:00:00.000Z",
            },
        ],
    }));
    (0, bun_test_1.expect)(state.terminals.t_a).not.toBe(before);
    (0, bun_test_1.expect)((_a = state.terminals.t_a) === null || _a === void 0 ? void 0 : _a.inputOwner).toEqual({
        type: "viewer",
        viewerID: "v1",
    });
});
(0, bun_test_1.test)("a terminal update that only changes the viewer list is kept", function () {
    var _a;
    var viewer = function (id) { return ({
        id: id,
        kind: "external",
        connectedAt: "2026-08-09T00:00:00.000Z",
        lastSeenAt: "2026-08-09T00:00:00.000Z",
    }); };
    var state = (0, src_1.projectEvents)([
        terminalUpdate("t_a", { viewers: [viewer("v1")] }),
    ]);
    var before = state.terminals.t_a;
    (0, src_1.applyEvent)(state, terminalUpdate("t_a", { viewers: [viewer("v1"), viewer("v2")] }));
    (0, bun_test_1.expect)(state.terminals.t_a).not.toBe(before);
    (0, bun_test_1.expect)((_a = state.terminals.t_a) === null || _a === void 0 ? void 0 : _a.viewers).toHaveLength(2);
    // Structural, not by identity: an equal list republished is still a no-op.
    var kept = state.terminals.t_a;
    (0, src_1.applyEvent)(state, terminalUpdate("t_a", { viewers: [viewer("v1"), viewer("v2")] }));
    (0, bun_test_1.expect)(state.terminals.t_a).toBe(kept);
});
(0, bun_test_1.test)("a terminal update that only changes the pending approval is kept", function () {
    var _a;
    var state = (0, src_1.projectEvents)([terminalUpdate("t_a")]);
    var before = state.terminals.t_a;
    (0, src_1.applyEvent)(state, terminalUpdate("t_a", { approvalID: "apr_1" }));
    (0, bun_test_1.expect)(state.terminals.t_a).not.toBe(before);
    (0, bun_test_1.expect)((_a = state.terminals.t_a) === null || _a === void 0 ? void 0 : _a.approvalID).toBe("apr_1");
});
(0, bun_test_1.test)("transcript eviction cuts on a user turn boundary, not at the watermark", function () {
    var _a, _b, _c;
    // Turns are 7 rows long so the naive cutoff (exactly `excess` rows) lands on an
    // assistant row. A cut there would leave a reply with no prompt above it, which
    // reads as the assistant answering nothing. The layout is chosen so a correct
    // implementation and a naive one give different answers.
    var period = 7;
    var messages = Array.from({ length: src_1.transcriptLimit + 40 }, function (_, index) { return ({
        id: "m".concat(index),
        role: index % period === 0 ? "user" : "assistant",
        text: "x",
        pendingText: "",
    }); });
    var naiveKept = src_1.transcriptWatermark;
    (0, bun_test_1.expect)((_a = messages[naiveKept]) === null || _a === void 0 ? void 0 : _a.role).toBe("assistant");
    var older = (0, src_1.boundTranscript)(messages, "older");
    (0, bun_test_1.expect)(older.evicted).toBe(true);
    // The row just past the kept slice begins a turn, so nothing was cut mid-turn.
    (0, bun_test_1.expect)((_b = messages[older.messages.length]) === null || _b === void 0 ? void 0 : _b.role).toBe("user");
    (0, bun_test_1.expect)(older.messages.length).not.toBe(naiveKept);
    var newer = (0, src_1.boundTranscript)(messages, "newer");
    (0, bun_test_1.expect)(newer.evicted).toBe(true);
    (0, bun_test_1.expect)((_c = newer.messages[0]) === null || _c === void 0 ? void 0 : _c.role).toBe("user");
    (0, bun_test_1.expect)(newer.messages.length).not.toBe(naiveKept);
});
(0, bun_test_1.test)("a transcript under the limit is returned untouched", function () {
    var messages = [
        { id: "a", role: "user", text: "q", pendingText: "" },
    ];
    var result = (0, src_1.boundTranscript)(messages, "older");
    (0, bun_test_1.expect)(result.evicted).toBe(false);
    (0, bun_test_1.expect)(result.messages).toBe(messages);
});
(0, bun_test_1.test)("replaying a terminal timeline entry does not duplicate it", function () {
    // A reconnecting consumer replays durable history, so it receives entries it may
    // already hold. Counting those twice would make the timeline grow on every
    // reconnect and show each action repeatedly.
    var entry = {
        type: "terminal.timeline",
        id: "t_a",
        actor: "model",
        action: "created",
        status: "executed",
        summary: "started bash",
        at: "2026-08-09T00:00:00.000Z",
    };
    var state = (0, src_1.projectEvents)([entry, entry, entry]);
    (0, bun_test_1.expect)(state.terminalTimeline.t_a).toHaveLength(1);
    // A genuinely later entry still appends, so dedupe is not swallowing history.
    var later = (0, src_1.projectEvents)([__assign(__assign({}, entry), { at: "2026-08-09T00:00:01.000Z" })], state);
    (0, bun_test_1.expect)(later.terminalTimeline.t_a).toHaveLength(2);
    // Same instant but a different outcome is a different fact.
    var other = (0, src_1.projectEvents)([__assign(__assign({}, entry), { status: "denied" })], state);
    (0, bun_test_1.expect)(other.terminalTimeline.t_a).toHaveLength(2);
});
