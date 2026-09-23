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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
exports.SUBAGENT_WAIT_UNTIL = void 0;
exports.agentTools = agentTools;
exports.agentToolFamily = agentToolFamily;
/**
 * Tools that spawn and supervise subagents.
 */
/**
 * Tools that spawn and supervise subagents.
 *
 * A subagent is another turn-taking runtime with its own budget, so spawning,
 * stopping and retrying all require approval while observing does not. Depth is
 * bounded by the execution context rather than by these tools, because the limit
 * has to hold across a chain of agents, not per call.
 */
var tools_1 = require("@anthelia/tools");
var agent_types_1 = require("./agent-types");
exports.SUBAGENT_WAIT_UNTIL = ["all_terminal", "any_terminal"];
function requireSubagents(context) {
    if (!context.subagents)
        throw new Error("subagent runtime unavailable");
    return context.subagents;
}
function agentSpawnTool(agentTypes) {
    // Rendered once at registration and refreshed on config reload: the request
    // builder reads `description` per step, so updating it in place keeps the
    // advertised types current without disturbing the tool's identity.
    var description = [
        "Spawn an isolated TS/Bun subagent task.",
        (0, agent_types_1.renderSubagentTypes)(agentTypes),
    ]
        .filter(Boolean)
        .join("\n");
    return {
        name: "agent_spawn",
        description: description,
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: {
                task: { type: "string" },
                // A configured agent type; its tool restrictions apply unless the call
                // overrides them explicitly.
                type: { type: "string" },
                // Whether the child inherits this conversation. `fork` seeds it with the
                // completed turns only; `fresh` gives it nothing but the task.
                context: { type: "string", enum: ["fresh", "fork"] },
                mode: { type: "string" },
                modelProfile: { type: "string" },
                allowedTools: { type: "array", items: { type: "string" } },
                excludeTools: { type: "array", items: { type: "string" } },
                writePaths: { type: "array", items: { type: "string" } },
            },
            required: ["task"],
            additionalProperties: false,
        },
        output: {
            schema: {
                type: "object",
                properties: { taskID: { type: "string" } },
                required: ["taskID"],
                additionalProperties: false,
            },
            presentCall: function (args) {
                return {
                    kind: "generic",
                    title: (0, tools_1.requireObject)(args).task,
                    summary: "spawn",
                };
            },
            presentResult: function (_args, value) {
                var _a;
                var result = JSON.parse(value);
                var taskID = (_a = result === null || result === void 0 ? void 0 : result.taskID) !== null && _a !== void 0 ? _a : result === null || result === void 0 ? void 0 : result.id;
                return {
                    kind: "generic",
                    title: "subagent",
                    summary: taskID ? "spawned ".concat(taskID) : "spawned",
                    meta: taskID ? [["taskID", taskID]] : [],
                };
            },
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, array, requestedType, agentType, record;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            array = function (value) {
                                return Array.isArray(value) ? value.map(function (item) { return String(item); }) : undefined;
                            };
                            requestedType = (0, tools_1.optionalString)(args.type);
                            agentType = requestedType
                                ? (0, agent_types_1.resolveSubagentType)(requestedType, agentTypes)
                                : undefined;
                            return [4 /*yield*/, requireSubagents(context).spawn((0, tools_1.requireString)(args.task, "task"), __assign(__assign({ mode: (0, tools_1.optionalString)(args.mode) }, (agentType ? { agentType: agentType.name } : {})), { context: args.context === "fork"
                                        ? "fork"
                                        : args.context === "fresh"
                                            ? "fresh"
                                            : undefined, modelProfile: (0, tools_1.optionalString)(args.modelProfile), 
                                    // The type's restrictions are the default; an explicit argument still
                                    // wins, so a caller can widen a type deliberately.
                                    allowedTools: (_a = array(args.allowedTools)) !== null && _a !== void 0 ? _a : (_b = agentType === null || agentType === void 0 ? void 0 : agentType.allowedTools) === null || _b === void 0 ? void 0 : _b.slice(), excludeTools: (_c = array(args.excludeTools)) !== null && _c !== void 0 ? _c : ((agentType === null || agentType === void 0 ? void 0 : agentType.excludedTools)
                                        ? agentType.excludedTools.slice()
                                        : undefined), writePaths: array(args.writePaths), signal: context.signal, parentSessionID: context.parentSessionID, parentAgentID: context.parentAgentID, maxDepth: context.maxSubagentDepth }))];
                        case 1:
                            record = _d.sent();
                            // Only the id: that is what the declared output says, and it is all the
                            // caller needs to act on the spawn. Returning the whole record instead
                            // would make the declaration false, and the execution boundary checks it.
                            // The full state is one `agent_status` away.
                            return [2 /*return*/, JSON.stringify({ taskID: record.id }, null, 2)];
                    }
                });
            });
        },
    };
}
function agentListTool() {
    var _this = this;
    return agentRegistryTool("agent_list", "List TS/Bun subagents.", false, function (registry) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, registry.formatList()];
            case 1: return [2 /*return*/, _a.sent()];
        }
    }); }); }, false, {}, function () { return ({
        kind: "generic",
        title: "subagents",
        summary: "list",
        meta: [["collapsible", "true"]],
    }); }, function (_args, value) { return ({
        kind: "generic",
        title: "subagents",
        summary: "listed ".concat(subagentListCount(value)),
    }); });
}
function agentStatusTool() {
    var _this = this;
    return agentRegistryTool("agent_status", "Show TS/Bun subagent status.", false, function (registry, args) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, registry.formatStatus((0, tools_1.requireString)(args.id, "id"))];
            case 1: return [2 /*return*/, _a.sent()];
        }
    }); }); }, true, {}, idCall("check", true), function (args, value) {
        var _a, _b;
        return ({
            kind: "generic",
            title: (0, tools_1.requireString)((0, tools_1.requireObject)(args).id, "id"),
            summary: "status ".concat((_b = (_a = /\[([^\]]+)\]/u.exec(value)) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : "unknown"),
        });
    });
}
function agentOutputTool() {
    var _this = this;
    return agentRegistryTool("agent_output", "Show the concise final result of a TS/Bun subagent. Set verbose=true only when the full audit log is required.", false, function (registry, args) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, registry.formatOutput((0, tools_1.requireString)(args.id, "id"), args.verbose === true)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); }, true, { verbose: { type: "boolean" } }, idCall("read output", true), function (args) { return ({
        kind: "generic",
        title: (0, tools_1.requireString)((0, tools_1.requireObject)(args).id, "id"),
        summary: "output read",
    }); });
}
function agentStopTool() {
    var _this = this;
    return agentRegistryTool("agent_stop", "Stop a running TS/Bun subagent.", true, function (registry, args) { return __awaiter(_this, void 0, void 0, function () {
        var id, force, result;
        return __generator(this, function (_a) {
            id = (0, tools_1.requireString)(args.id, "id");
            force = args.force === true;
            result = registry.requestStop(id, (0, tools_1.requireString)(args.reason, "reason"), force);
            switch (result.outcome) {
                case "stopped":
                    return [2 /*return*/, force
                            ? "Stopped ".concat(id, " (force interrupted an active agent)")
                            : "Stopped ".concat(id)];
                case "protected":
                    return [2 /*return*/, "Protected ".concat(id)];
                case "not_found":
                    return [2 /*return*/, "Agent not found"];
                case "not_running":
                    return [2 /*return*/, "Agent is not running"];
            }
            return [2 /*return*/];
        });
    }); }, true, {
        reason: { type: "string" },
        force: { type: "boolean" },
    }, idCall("stop"), function (args, value) { return ({
        kind: "generic",
        title: (0, tools_1.requireString)((0, tools_1.requireObject)(args).id, "id"),
        summary: value.startsWith("Stopped ")
            ? value.includes("force interrupted")
                ? "force stopped · interrupted active agent"
                : "stopped"
            : value.startsWith("Protected ")
                ? "protected · agent still active"
                : value === "Agent not found"
                    ? "not found"
                    : "not running",
    }); }, ["id", "reason"]);
}
function agentResumeTool() {
    var _this = this;
    return agentRegistryTool("agent_resume", "Resume a paused subagent only while its owning runtime remains active.", false, function (registry, args) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, registry.resume((0, tools_1.requireString)(args.id, "id"))];
                case 1: return [2 /*return*/, (_a.sent())
                        ? "resumed"
                        : "subagent is not paused"];
            }
        });
    }); }, true, {}, idCall("resume"), function (args, value) { return ({
        kind: "generic",
        title: (0, tools_1.requireString)((0, tools_1.requireObject)(args).id, "id"),
        summary: value === "resumed" ? "resumed" : "not paused",
    }); });
}
function agentRetryTool() {
    var _this = this;
    return agentRegistryTool("agent_retry", "Retry a stopped or failed subagent as an explicit new continuation.", true, function (registry, args) { return __awaiter(_this, void 0, void 0, function () {
        var record;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, registry.retry((0, tools_1.requireString)(args.id, "id"))];
                case 1:
                    record = _a.sent();
                    return [2 /*return*/, record
                            ? "started continuation ".concat(record.continuation)
                            : "subagent is not stopped or failed"];
            }
        });
    }); }, true, {}, idCall("retry"), function (args, value) {
        var _a, _b;
        return ({
            kind: "generic",
            title: (0, tools_1.requireString)((0, tools_1.requireObject)(args).id, "id"),
            summary: "continuation ".concat((_b = (_a = /started continuation (\d+)/u.exec(value)) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : "unavailable"),
        });
    });
}
function agentAttachTool() {
    var _this = this;
    return agentRegistryTool("agent_attach", "Attach subagent output to the current session.", false, function (registry, args) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, registry.attach((0, tools_1.requireString)(args.id, "id"))
                    ? "attached"
                    : "subagent not found"];
        });
    }); }, true, {}, idCall("attach"), function (args, value) { return ({
        kind: "generic",
        title: (0, tools_1.requireString)((0, tools_1.requireObject)(args).id, "id"),
        summary: value === "attached" ? "attached" : "not found",
    }); });
}
function agentDetachTool() {
    var _this = this;
    return agentRegistryTool("agent_detach", "Detach subagent output from the current session.", false, function (registry, args) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, registry.detach((0, tools_1.requireString)(args.id, "id"))
                    ? "detached"
                    : "subagent not found"];
        });
    }); }, true, {}, idCall("detach"), function (args, value) { return ({
        kind: "generic",
        title: (0, tools_1.requireString)((0, tools_1.requireObject)(args).id, "id"),
        summary: value === "detached" ? "detached" : "not found",
    }); });
}
function agentCleanupTool() {
    var _this = this;
    return agentRegistryTool("agent_cleanup", "Remove stopped, failed, and completed subagent records.", true, function (registry, args) { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/, JSON.stringify({ removed: registry.cleanup(args.dryRun === true) })];
    }); }); }, false, {}, function () { return ({ kind: "generic", title: "subagents", summary: "cleanup" }); }, function (_args, value) {
        var _a;
        var removed = JSON.parse(value).removed;
        return {
            kind: "generic",
            title: "subagents",
            summary: "removed ".concat((_a = removed === null || removed === void 0 ? void 0 : removed.length) !== null && _a !== void 0 ? _a : 0),
        };
    });
}
function agentWaitTool() {
    return {
        name: "agent_wait",
        description: "Wait for one or more subagents to complete. until supports all_terminal or any_terminal. Does not stop the subagent on timeout.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                ids: { type: "array", items: { type: "string" } },
                until: { type: "string", enum: __spreadArray([], exports.SUBAGENT_WAIT_UNTIL, true) },
                timeoutMs: { type: "number" },
            },
            required: ["ids", "until"],
            additionalProperties: false,
        },
        output: {
            schema: {
                type: "object",
                properties: {
                    completed: { type: "array", items: { type: "string" } },
                    pending: { type: "array", items: { type: "string" } },
                    timedOut: { type: "boolean" },
                    results: {
                        type: "object",
                        properties: {},
                        additionalProperties: true,
                    },
                },
                additionalProperties: false,
            },
            presentCall: function (args) {
                var ids = (0, tools_1.requireObject)(args).ids.map(String);
                var until = (0, tools_1.requireObject)(args).until;
                return {
                    kind: "generic",
                    title: until === "any_terminal" ? "any" : "all",
                    summary: ids.length > 2
                        ? "waiting for ".concat(ids.length, " agents")
                        : "waiting for ".concat(ids.join(", ")),
                    meta: [["collapsible", "true"]],
                };
            },
            presentResult: function (_args, value) {
                var _a, _b;
                var parsed;
                try {
                    parsed = JSON.parse(value);
                }
                catch (_c) {
                    return { kind: "generic", title: "wait", summary: "completed" };
                }
                var completed = ((_a = parsed.completed) !== null && _a !== void 0 ? _a : []).length;
                var pending = ((_b = parsed.pending) !== null && _b !== void 0 ? _b : []).length;
                var total = completed + pending;
                var summary;
                if (parsed.timedOut) {
                    summary =
                        pending > 0 ? "timed out \u00B7 ".concat(pending, " pending") : "timed out";
                }
                else if (pending === 0) {
                    summary = "".concat(completed, " completed");
                }
                else {
                    summary = "".concat(completed, "/").concat(total, " completed");
                }
                return { kind: "generic", title: "wait", summary: summary };
            },
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, ids, until, timeoutMs, registry, results, terminalStatuses, completed, pending, _i, ids_1, id, r, timedOut;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            ids = ((_a = args.ids) !== null && _a !== void 0 ? _a : []).map(function (id) { return String(id); });
                            if (ids.length === 0)
                                throw new Error("ids is required");
                            until = args.until === "any_terminal"
                                ? "any_terminal"
                                : "all_terminal";
                            timeoutMs = typeof args.timeoutMs === "number" ? args.timeoutMs : 120000;
                            registry = requireSubagents(context);
                            return [4 /*yield*/, registry.wait(ids, until, timeoutMs, context.signal)];
                        case 1:
                            results = _c.sent();
                            terminalStatuses = new Set(["completed", "failed", "stopped"]);
                            completed = [];
                            pending = [];
                            for (_i = 0, ids_1 = ids; _i < ids_1.length; _i++) {
                                id = ids_1[_i];
                                r = (_b = results[id]) !== null && _b !== void 0 ? _b : { status: "idle", phase: "idle" };
                                if (terminalStatuses.has(r.status))
                                    completed.push(id);
                                else
                                    pending.push(id);
                            }
                            timedOut = pending.length > 0;
                            return [2 /*return*/, JSON.stringify({
                                    completed: completed,
                                    pending: pending,
                                    timedOut: timedOut,
                                    results: Object.fromEntries(Object.entries(results).map(function (_a) {
                                        var id = _a[0], r = _a[1];
                                        return [
                                            id,
                                            { status: r.status, phase: r.phase },
                                        ];
                                    })),
                                })];
                    }
                });
            });
        },
    };
}
/**
 * Steer a subagent from the session that spawned it.
 *
 * The authority check is the one rule that matters: only the subagent's own
 * parent may steer it. Without it any session could redirect a child it has no
 * relationship to, and the child has no way to tell that from a legitimate
 * instruction.
 */
function agentMessageTool() {
    return {
        name: "agent_message",
        description: "Send a message to a subagent you spawned. It is delivered at the subagent's nearest step if it is running, wakes it if it is paused, and is queued for its next start otherwise.",
        // Steering another agent is not read-only: it changes what that agent will
        // do next, so it goes through the same approval gate as a spawn.
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: {
                id: { type: "string" },
                message: { type: "string" },
            },
            required: ["id", "message"],
            additionalProperties: false,
        },
        output: {
            schema: {
                type: "object",
                properties: { route: { type: "string" } },
                required: ["route"],
                additionalProperties: false,
            },
            presentCall: function (args) {
                var _a = (0, tools_1.requireObject)(args), id = _a.id, message = _a.message;
                return {
                    kind: "generic",
                    title: typeof id === "string" ? id : "subagent",
                    summary: typeof message === "string" ? message.slice(0, 80) : "message",
                };
            },
            presentResult: function (_args, value) {
                var parsed = JSON.parse(value);
                return {
                    kind: "generic",
                    title: "subagent",
                    summary: (parsed === null || parsed === void 0 ? void 0 : parsed.route) ? "message ".concat(parsed.route) : "message sent",
                };
            },
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, id, message, subagents, record, callerSession, _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            id = (0, tools_1.requireString)(args.id, "id");
                            message = (0, tools_1.requireString)(args.message, "message");
                            subagents = requireSubagents(context);
                            record = subagents.get(id);
                            if (!record)
                                return [2 /*return*/, JSON.stringify({ route: "not_found" })];
                            callerSession = context.sessionID;
                            if (record.parentSessionID !== undefined &&
                                callerSession !== undefined &&
                                record.parentSessionID !== callerSession)
                                throw new Error("subagent ".concat(id, " belongs to another session; only its parent may steer it"));
                            _b = (_a = JSON).stringify;
                            return [4 /*yield*/, subagents.sendMessage(id, message, callerSession)];
                        case 1: return [2 /*return*/, _b.apply(_a, [_c.sent(), null,
                                2])];
                    }
                });
            });
        },
    };
}
function agentAuditTool() {
    var _this = this;
    return agentRegistryTool("agent_audit", "Return the TS/Bun subagent audit trail.", false, function (registry, args) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, registry.audit((0, tools_1.numberOr)(args.tail, 0) || undefined, (0, tools_1.optionalString)(args.format))];
        });
    }); }, false, {}, function () { return ({ kind: "generic", title: "subagents", summary: "audit" }); }, function (_args, value) { return ({
        kind: "generic",
        title: "subagents",
        summary: "read ".concat(auditEntryCount(value), " audit entries"),
    }); });
}
function idCall(summary, collapsible) {
    if (collapsible === void 0) { collapsible = false; }
    return function (args) { return ({
        kind: "generic",
        title: (0, tools_1.requireString)((0, tools_1.requireObject)(args).id, "id"),
        summary: summary,
        meta: collapsible ? [["collapsible", "true"]] : undefined,
    }); };
}
function subagentListCount(value) {
    if (value === "no subagents")
        return 0;
    return value
        .split("\n")
        .filter(function (line) { return line && !line.startsWith("remaining_resources:"); }).length;
}
function auditEntryCount(value) {
    if (value === "<no agent audit entries>")
        return 0;
    try {
        var entries = JSON.parse(value);
        if (Array.isArray(entries))
            return entries.length;
    }
    catch (_a) {
        // The default audit format is one entry per line.
    }
    return value.split("\n").filter(Boolean).length;
}
function agentRegistryTool(name, description, requiresApproval, action, requiresID, extraProperties, presentCall, presentResult, requiredProperties) {
    if (requiresID === void 0) { requiresID = false; }
    if (extraProperties === void 0) { extraProperties = {}; }
    return {
        name: name,
        description: description,
        requiresApproval: requiresApproval,
        parameters: {
            type: "object",
            properties: __assign({ id: { type: "string" }, dryRun: { type: "boolean" }, tail: { type: "number" }, format: { type: "string" } }, extraProperties),
            required: requiredProperties !== null && requiredProperties !== void 0 ? requiredProperties : (requiresID ? ["id"] : undefined),
            additionalProperties: false,
        },
        output: {
            schema: { type: "object", properties: {} },
            presentCall: presentCall,
            presentResult: presentResult,
        },
        execute: function (input, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            args = (0, tools_1.requireObject)(input);
                            return [4 /*yield*/, action(requireSubagents(context), args)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
    };
}
/** Every subagent tool. */
function agentTools(agentTypes) {
    if (agentTypes === void 0) { agentTypes = []; }
    return [
        agentSpawnTool(agentTypes),
        agentListTool(),
        agentStatusTool(),
        agentOutputTool(),
        agentWaitTool(),
        agentStopTool(),
        agentResumeTool(),
        agentRetryTool(),
        agentMessageTool(),
        agentAttachTool(),
        agentDetachTool(),
        agentCleanupTool(),
        agentAuditTool(),
    ];
}
/**
 * Session scope: a subagent belongs to the session that spawned it.
 */
function agentToolFamily(agentTypes) {
    if (agentTypes === void 0) { agentTypes = []; }
    return {
        id: "agent",
        name: "Subagent Tools",
        version: "1.0.0",
        description: "Delegating work to a subagent.",
        scope: "session",
        tools: __spreadArray([], agentTools(agentTypes), true),
    };
}
