"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
(0, bun_test_1.test)("workspace.added and workspace.activated drive navigation state", function () {
    var _a, _b;
    var state = (0, src_1.initialState)();
    (0, src_1.applyEvent)(state, {
        type: "workspace.added",
        workspace: {
            workspaceID: "ws_a",
            root: "/tmp/a",
            title: "A",
            status: "active",
            sessionCount: 1,
            runningSessionCount: 1,
        },
        workspaceID: "ws_a",
    });
    (0, bun_test_1.expect)(state.workspaces).toHaveLength(1);
    (0, bun_test_1.expect)(state.activeWorkspaceID).toBe("ws_a");
    (0, src_1.applyEvent)(state, {
        type: "workspace.added",
        workspace: {
            workspaceID: "ws_b",
            root: "/tmp/b",
            title: "B",
            status: "idle",
            sessionCount: 0,
            runningSessionCount: 0,
        },
        workspaceID: "ws_b",
    });
    (0, src_1.applyEvent)(state, {
        type: "workspace.activated",
        workspace: {
            workspaceID: "ws_b",
            root: "/tmp/b",
            title: "B",
            status: "active",
            sessionCount: 2,
            runningSessionCount: 0,
        },
        workspaceID: "ws_b",
    });
    (0, bun_test_1.expect)(state.activeWorkspaceID).toBe("ws_b");
    (0, bun_test_1.expect)((_a = state.workspaces.find(function (entry) { return entry.workspaceID === "ws_a"; })) === null || _a === void 0 ? void 0 : _a.status).toBe("idle");
    (0, bun_test_1.expect)((_b = state.workspaces.find(function (entry) { return entry.workspaceID === "ws_b"; })) === null || _b === void 0 ? void 0 : _b.status).toBe("active");
});
(0, bun_test_1.test)("workspace.removed removes sessions from that workspace", function () {
    var state = (0, src_1.initialState)();
    (0, src_1.applyEvent)(state, {
        type: "workspace.added",
        workspace: {
            workspaceID: "ws_a",
            root: "/tmp/a",
            title: "A",
            status: "active",
            sessionCount: 1,
            runningSessionCount: 0,
        },
        workspaceID: "ws_a",
    });
    (0, src_1.applyEvent)(state, {
        type: "session.created",
        sessionID: "ses_a",
        title: "Session A",
        workspaceID: "ws_a",
    });
    (0, src_1.applyEvent)(state, {
        type: "workspace.removed",
        workspaceID: "ws_a",
    });
    (0, bun_test_1.expect)(state.workspaces).toHaveLength(0);
    (0, bun_test_1.expect)(state.sessions).toHaveLength(0);
    (0, bun_test_1.expect)(state.activeWorkspaceID).toBeUndefined();
});
(0, bun_test_1.test)("session.created keeps a synthetic session summary for the active workspace", function () {
    var state = (0, src_1.initialState)();
    (0, src_1.applyEvent)(state, {
        type: "session.created",
        sessionID: "ses_a",
        title: "Session A",
        workspaceID: "ws_a",
    });
    (0, bun_test_1.expect)(state.activeWorkspaceID).toBe("ws_a");
    (0, bun_test_1.expect)(state.activeSessionID).toBe("ses_a");
    (0, bun_test_1.expect)(state.sessions[0]).toMatchObject({
        id: "ses_a",
        workspaceID: "ws_a",
        title: "Session A",
    });
});
(0, bun_test_1.test)("cloneState copies workspace/session arrays", function () {
    var state = (0, src_1.initialState)();
    state.workspaces.push({
        workspaceID: "ws_a",
        root: "/tmp/a",
        title: "A",
        status: "active",
        sessionCount: 0,
        runningSessionCount: 0,
    });
    var next = (0, src_1.cloneState)(state);
    (0, bun_test_1.expect)(next.workspaces).not.toBe(state.workspaces);
    (0, bun_test_1.expect)(next.workspaces[0]).not.toBe(state.workspaces[0]);
});
