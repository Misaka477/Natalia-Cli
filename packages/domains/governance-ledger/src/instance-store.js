"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveGovernanceRoot = resolveGovernanceRoot;
exports.loadInstanceGovernance = loadInstanceGovernance;
exports.appendInstanceEvent = appendInstanceEvent;
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
function resolveGovernanceRoot(workspaceRoot) {
    if (process.env.NATALIA_TEST_GOVERNANCE_ROOT)
        return (0, node_path_1.resolve)(process.env.NATALIA_TEST_GOVERNANCE_ROOT);
    if (!workspaceRoot)
        return undefined;
    // Workspace-tier governance lives under the workspace it belongs to. The
    // plugin store is process/instance infrastructure and must never be the
    // shared bucket that leaks decisions or rules across workspaces.
    return (0, node_path_1.resolve)(workspaceRoot, ".natalia", "governance");
}
function parseJsonl(path) {
    var raw;
    try {
        raw = (0, node_fs_1.readFileSync)(path, "utf8");
    }
    catch (error) {
        if (error.code === "ENOENT")
            return [];
        throw error;
    }
    var events = [];
    for (var _i = 0, _a = raw.split("\n"); _i < _a.length; _i++) {
        var line = _a[_i];
        if (!line.trim())
            continue;
        events.push(JSON.parse(line));
    }
    return events;
}
function loadInstanceGovernance(root) {
    if (!root)
        return { events: [], degraded: false };
    try {
        return {
            events: __spreadArray(__spreadArray([], parseJsonl((0, node_path_1.join)(root, "constitution.jsonl")), true), parseJsonl((0, node_path_1.join)(root, "decisions.jsonl")), true),
            degraded: false,
        };
    }
    catch (_a) {
        return { events: [], degraded: true };
    }
}
function appendInstanceEvent(root, file, event) {
    if (!root)
        return;
    var path = (0, node_path_1.join)(root, file);
    (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(path), { recursive: true });
    (0, node_fs_1.appendFileSync)(path, "".concat(JSON.stringify(event), "\n"));
}
