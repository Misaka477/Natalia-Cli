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
var node_worker_threads_1 = require("node:worker_threads");
var plugin_1 = require("@natalia/plugin");
var port = node_worker_threads_1.parentPort;
if (!port)
    throw new Error("secondary worker requires parentPort");
port.on("message", function (request) {
    try {
        var result = void 0;
        if (request.op === "configClone") {
            result = structuredClone(request.config);
        }
        else if (request.op === "subagentList") {
            result = request.records.map(function (_a) {
                var record = _a.record, health = _a.health;
                var value = record;
                return __assign(__assign(__assign(__assign(__assign({ type: "subagent.update", id: value.id, status: value.status, attached: value.attached, event: "status", task: value.task }, (value.parentSessionID !== undefined
                    ? { parentSessionID: value.parentSessionID }
                    : {})), (value.parentAgentID !== undefined
                    ? { parentAgentID: value.parentAgentID }
                    : {})), (value.continuation !== undefined
                    ? { continuation: value.continuation }
                    : {})), { phase: value.phase, activityDetail: value.activityDetail, health: health, lastActivityAt: value.lastActivityAt, startedAt: value.startedAt }), (value.endedAt !== undefined ? { endedAt: value.endedAt } : {}));
            });
        }
        else {
            result = request.plugins.map(function (plugin) {
                var value = plugin;
                return {
                    id: value.id,
                    version: value.version,
                    name: value.name,
                    description: value.description,
                    capabilities: (0, plugin_1.manifestIntegrationPoints)(plugin),
                };
            });
        }
        var response = {
            id: request.id,
            ok: true,
            result: result,
        };
        port.postMessage(response);
    }
    catch (error) {
        var response = {
            id: request.id,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
        port.postMessage(response);
    }
});
