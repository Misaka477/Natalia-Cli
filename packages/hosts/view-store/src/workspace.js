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
exports.applyWorkspaceEvent = applyWorkspaceEvent;
/**
 * Multi-workspace navigation projection.
 *
 * Workspace summaries are runtime facts, not UI-local state. Projecting them
 * here lets any host/plugin render the same workspace -> session tree without
 * each UI re-implementing add/activate/remove bookkeeping.
 */
function applyWorkspaceEvent(state, event) {
    var _a, _b, _c;
    if (event.type === "workspace.added") {
        var workspace_1 = event.workspace;
        var existing = state.workspaces.find(function (entry) { return entry.workspaceID === workspace_1.workspaceID; });
        if (existing)
            Object.assign(existing, workspace_1);
        else
            state.workspaces.push(__assign({}, workspace_1));
        if (workspace_1.status === "active") {
            state.activeWorkspaceID = workspace_1.workspaceID;
            for (var _i = 0, _d = state.workspaces; _i < _d.length; _i++) {
                var entry = _d[_i];
                if (entry.workspaceID !== workspace_1.workspaceID)
                    entry.status = "idle";
            }
        }
        return true;
    }
    if (event.type === "workspace.activated") {
        var workspace_2 = event.workspace;
        var existing = state.workspaces.find(function (entry) { return entry.workspaceID === workspace_2.workspaceID; });
        if (existing)
            Object.assign(existing, workspace_2);
        else
            state.workspaces.push(__assign({}, workspace_2));
        state.activeWorkspaceID = workspace_2.workspaceID;
        for (var _e = 0, _f = state.workspaces; _e < _f.length; _e++) {
            var entry = _f[_e];
            entry.status =
                entry.workspaceID === workspace_2.workspaceID ? "active" : "idle";
        }
        return true;
    }
    if (event.type === "workspace.removed") {
        var before = state.workspaces.length;
        state.workspaces = state.workspaces.filter(function (entry) { return entry.workspaceID !== event.workspaceID; });
        if (state.activeWorkspaceID === event.workspaceID) {
            state.activeWorkspaceID =
                (_b = (_a = state.workspaces.find(function (entry) { return entry.status === "active"; })) === null || _a === void 0 ? void 0 : _a.workspaceID) !== null && _b !== void 0 ? _b : (_c = state.workspaces[0]) === null || _c === void 0 ? void 0 : _c.workspaceID;
            if (state.activeWorkspaceID) {
                var active = state.workspaces.find(function (entry) { return entry.workspaceID === state.activeWorkspaceID; });
                if (active)
                    active.status = "active";
            }
        }
        state.sessions = state.sessions.filter(function (session) { return session.workspaceID !== event.workspaceID; });
        return before !== state.workspaces.length;
    }
    if (event.type === "session.created" || event.type === "session.ready") {
        if (event.workspaceID) {
            // Keep the current routing facts in sync even before a full session list
            // refresh lands. Full summaries arrive via sessionList().
            var existing = state.sessions.find(function (session) { return session.id === event.sessionID; });
            if (!existing) {
                state.sessions.push({
                    id: event.sessionID,
                    workspaceID: event.workspaceID,
                    title: event.type === "session.created" ? event.title : "Session",
                    createdAt: new Date().toISOString(),
                    lastAccessedAt: new Date().toISOString(),
                    pinned: false,
                    events: 0,
                    pendingInputs: 0,
                    cancelled: false,
                    resumable: true,
                    status: "idle",
                });
            }
            else {
                existing.workspaceID = event.workspaceID;
            }
            if (!state.sessionID || state.sessionID === event.sessionID) {
                state.activeWorkspaceID = event.workspaceID;
                state.activeSessionID = event.sessionID;
                state.sessionID = event.sessionID;
            }
            return true;
        }
    }
    return false;
}
