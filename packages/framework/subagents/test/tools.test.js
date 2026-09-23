"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
var EXPECTED_TOOL_NAMES = [
    "agent_spawn",
    "agent_list",
    "agent_status",
    "agent_output",
    "agent_wait",
    "agent_stop",
    "agent_resume",
    "agent_retry",
    "agent_message",
    "agent_attach",
    "agent_detach",
    "agent_cleanup",
    "agent_audit",
];
(0, bun_test_1.test)("the subagent family describes the tools it ships", function () {
    var family = (0, src_1.agentToolFamily)();
    (0, bun_test_1.expect)(family.id).toBe("agent");
    (0, bun_test_1.expect)(family.scope).toBe("session");
    (0, bun_test_1.expect)(family.tools.map(function (tool) { return tool.name; })).toEqual((0, src_1.agentTools)().map(function (tool) { return tool.name; }));
});
(0, bun_test_1.test)("every agent_* tool declares presentCall and presentResult", function () {
    var _a, _b;
    var tools = (0, src_1.agentTools)();
    (0, bun_test_1.expect)(tools.map(function (t) { return t.name; })).toEqual(EXPECTED_TOOL_NAMES);
    for (var _i = 0, tools_1 = tools; _i < tools_1.length; _i++) {
        var tool = tools_1[_i];
        (0, bun_test_1.expect)((_a = tool.output) === null || _a === void 0 ? void 0 : _a.presentCall).toBeDefined();
        (0, bun_test_1.expect)((_b = tool.output) === null || _b === void 0 ? void 0 : _b.presentResult).toBeDefined();
    }
});
(0, bun_test_1.test)("agent_spawn projects task title and spawns taskID in result meta", function () {
    var spawn = (0, src_1.agentTools)().find(function (t) { return t.name === "agent_spawn"; });
    var call = spawn.output.presentCall({ task: "Inspect renderer" });
    (0, bun_test_1.expect)(call).toEqual({
        kind: "generic",
        title: "Inspect renderer",
        summary: "spawn",
    });
    var result = spawn.output.presentResult({}, '{"id":"a1","task":"Inspect renderer"}');
    (0, bun_test_1.expect)(result).toEqual({
        kind: "generic",
        title: "subagent",
        summary: "spawned a1",
        meta: [["taskID", "a1"]],
    });
});
(0, bun_test_1.test)("agent_status projects checking action and status result", function () {
    var tool = (0, src_1.agentTools)().find(function (t) { return t.name === "agent_status"; });
    var call = tool.output.presentCall({ id: "a1" });
    (0, bun_test_1.expect)(call).toEqual({
        kind: "generic",
        title: "a1",
        summary: "check",
        meta: [["collapsible", "true"]],
    });
    var result = tool.output.presentResult({ id: "a1" }, "a1 [running] attached=true Inspect renderer");
    (0, bun_test_1.expect)(result.title).toBe("a1");
    (0, bun_test_1.expect)(result.summary).toBe("status running");
});
(0, bun_test_1.test)("agent_stop projects stopping and stopped/not-running result", function () {
    var tool = (0, src_1.agentTools)().find(function (t) { return t.name === "agent_stop"; });
    (0, bun_test_1.expect)(tool.parameters.required).toEqual(["id", "reason"]);
    var call = tool.output.presentCall({ id: "a1", reason: "stalled" });
    (0, bun_test_1.expect)(call).toEqual({ kind: "generic", title: "a1", summary: "stop" });
    var stopped = tool.output.presentResult({ id: "a1", reason: "stalled" }, "Stopped a1");
    (0, bun_test_1.expect)(stopped.summary).toBe("stopped");
    var protectedResult = tool.output.presentResult({ id: "a1", reason: "still active" }, "Protected a1");
    (0, bun_test_1.expect)(protectedResult.summary).toBe("protected · agent still active");
    var forced = tool.output.presentResult({ id: "a1", reason: "override", force: true }, "Stopped a1 (force interrupted an active agent)");
    (0, bun_test_1.expect)(forced.summary).toBe("force stopped · interrupted active agent");
    var notRunning = tool.output.presentResult({ id: "a1", reason: "stalled" }, "Agent is not running");
    (0, bun_test_1.expect)(notRunning.summary).toBe("not running");
});
(0, bun_test_1.test)("agent_output projects reading action and output result", function () {
    var tool = (0, src_1.agentTools)().find(function (t) { return t.name === "agent_output"; });
    var call = tool.output.presentCall({ id: "a1" });
    (0, bun_test_1.expect)(call.summary).toBe("read output");
    (0, bun_test_1.expect)(call.meta).toEqual([["collapsible", "true"]]);
    var result = tool.output.presentResult({ id: "a1" }, "some output");
    (0, bun_test_1.expect)(result.summary).toBe("output read");
});
(0, bun_test_1.test)("agent_retry projects retry action and continuation result", function () {
    var tool = (0, src_1.agentTools)().find(function (t) { return t.name === "agent_retry"; });
    var call = tool.output.presentCall({ id: "a1" });
    (0, bun_test_1.expect)(call.summary).toBe("retry");
    var result = tool.output.presentResult({ id: "a1" }, "started continuation 2");
    (0, bun_test_1.expect)(result.summary).toBe("continuation 2");
});
(0, bun_test_1.test)("agent_cleanup projects cleanup count", function () {
    var tool = (0, src_1.agentTools)().find(function (t) { return t.name === "agent_cleanup"; });
    var call = tool.output.presentCall({});
    (0, bun_test_1.expect)(call.summary).toBe("cleanup");
    var result = tool.output.presentResult({}, '{"removed":["a1","a2"]}');
    (0, bun_test_1.expect)(result.summary).toBe("removed 2");
});
(0, bun_test_1.test)("agent_list and agent_audit project list/audit labels", function () {
    var list = (0, src_1.agentTools)().find(function (t) { return t.name === "agent_list"; });
    (0, bun_test_1.expect)(list.output.presentCall({}).summary).toBe("list");
    var listResult = list.output.presentResult({}, "no subagents");
    (0, bun_test_1.expect)(listResult.summary).toBe("listed 0");
    var audit = (0, src_1.agentTools)().find(function (t) { return t.name === "agent_audit"; });
    (0, bun_test_1.expect)(audit.output.presentCall({}).summary).toBe("audit");
});
(0, bun_test_1.test)("agent tools refuse without the subagent registry", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tool;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tool = (0, src_1.agentToolFamily)().tools.find(function (candidate) { return candidate.name === "agent_spawn"; });
                return [4 /*yield*/, (0, bun_test_1.expect)(tool.execute({ prompt: "hi" }, { workspaceRoot: "/tmp" })).rejects.toThrow(/subagent runtime unavailable/u)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("agent_retry is exposed as an explicit continuation tool", function () {
    var tool = (0, src_1.agentTools)().find(function (candidate) { return candidate.name === "agent_retry"; });
    (0, bun_test_1.expect)(tool.requiresApproval).toBe(true);
    (0, bun_test_1.expect)(tool.description).toContain("continuation");
});
var AGENT_TYPES = [
    {
        name: "explore",
        description: "read-only search",
        mode: "subagent",
        excludedTools: ["write_file"],
    },
    {
        name: "implementer",
        description: "edits files",
        mode: "subagent",
        allowedTools: ["read_file", "write_file"],
    },
    { name: "build", description: "primary agent", mode: "primary" },
];
(0, bun_test_1.test)("agent_spawn advertises the configured subagent types with their tools", function () { return __awaiter(void 0, void 0, void 0, function () {
    var spawn;
    return __generator(this, function (_a) {
        spawn = (0, src_1.agentTools)(AGENT_TYPES).find(function (t) { return t.name === "agent_spawn"; });
        // The one distinction the choice turns on: a read-only explorer is not a full
        // implementer, and nothing else in the description says which is which.
        (0, bun_test_1.expect)(spawn.description).toContain("explore: read-only search (tools: all except write_file)");
        (0, bun_test_1.expect)(spawn.description).toContain("implementer: edits files (tools: read_file, write_file)");
        // A primary agent is the main runner, not a spawn target.
        (0, bun_test_1.expect)(spawn.description).not.toContain("build");
        (0, bun_test_1.expect)(spawn.description).toContain("Pass one of these as `type`");
        return [2 /*return*/];
    });
}); });
(0, bun_test_1.test)("agent_spawn accepts a type parameter", function () {
    var spawn = (0, src_1.agentTools)(AGENT_TYPES).find(function (t) { return t.name === "agent_spawn"; });
    var properties = spawn.parameters.properties;
    (0, bun_test_1.expect)(properties.type).toEqual({ type: "string" });
});
(0, bun_test_1.test)("with no configured types the description stays a single line", function () {
    // A section listing nothing reads as "there are types and they are
    // undocumented".
    var spawn = (0, src_1.agentTools)().find(function (t) { return t.name === "agent_spawn"; });
    (0, bun_test_1.expect)(spawn.description).toBe("Spawn an isolated TS/Bun subagent task.");
});
(0, bun_test_1.test)("spawning as a type applies its tool restrictions", function () { return __awaiter(void 0, void 0, void 0, function () {
    var spawned, spawn;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                spawn = (0, src_1.agentTools)(AGENT_TYPES).find(function (t) { return t.name === "agent_spawn"; });
                return [4 /*yield*/, spawn.execute({ task: "find it", type: "explore" }, {
                        workspaceRoot: "/tmp",
                        subagents: {
                            spawn: function (_task, options) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    spawned = options;
                                    return [2 /*return*/, { id: "a1", task: "find it", status: "idle" }];
                                });
                            }); },
                        },
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(spawned === null || spawned === void 0 ? void 0 : spawned.agentType).toBe("explore");
                (0, bun_test_1.expect)(spawned === null || spawned === void 0 ? void 0 : spawned.excludeTools).toEqual(["write_file"]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an explicit allow-list overrides the type's restrictions", function () { return __awaiter(void 0, void 0, void 0, function () {
    var spawned, spawn;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                spawn = (0, src_1.agentTools)(AGENT_TYPES).find(function (t) { return t.name === "agent_spawn"; });
                return [4 /*yield*/, spawn.execute({
                        task: "fix it",
                        type: "explore",
                        allowedTools: ["read_file", "write_file"],
                    }, {
                        workspaceRoot: "/tmp",
                        subagents: {
                            spawn: function (_task, options) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    spawned = options;
                                    return [2 /*return*/, { id: "a1", task: "fix it", status: "idle" }];
                                });
                            }); },
                        },
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(spawned === null || spawned === void 0 ? void 0 : spawned.agentType).toBe("explore");
                (0, bun_test_1.expect)(spawned === null || spawned === void 0 ? void 0 : spawned.allowedTools).toEqual(["read_file", "write_file"]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an unknown type is rejected instead of spawning a general subagent", function () { return __awaiter(void 0, void 0, void 0, function () {
    var spawn, spawns;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                spawn = (0, src_1.agentTools)(AGENT_TYPES).find(function (t) { return t.name === "agent_spawn"; });
                spawns = 0;
                return [4 /*yield*/, (0, bun_test_1.expect)(spawn.execute({ task: "go", type: "nope" }, {
                        workspaceRoot: "/tmp",
                        subagents: {
                            spawn: function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    spawns += 1;
                                    return [2 /*return*/, { id: "a1", task: "go", status: "idle" }];
                                });
                            }); },
                        },
                    })).rejects.toThrow(/unknown subagent type "nope"/)];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(spawns).toBe(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("omitting the type spawns a general subagent", function () { return __awaiter(void 0, void 0, void 0, function () {
    var spawned, spawn;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                spawn = (0, src_1.agentTools)(AGENT_TYPES).find(function (t) { return t.name === "agent_spawn"; });
                return [4 /*yield*/, spawn.execute({ task: "just work" }, {
                        workspaceRoot: "/tmp",
                        subagents: {
                            spawn: function (_task, options) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    spawned = options;
                                    return [2 /*return*/, { id: "a1", task: "just work", status: "idle" }];
                                });
                            }); },
                        },
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(spawned === null || spawned === void 0 ? void 0 : spawned.agentType).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("agent_spawn accepts a context choice between fresh and fork", function () {
    var spawn = (0, src_1.agentTools)().find(function (t) { return t.name === "agent_spawn"; });
    var properties = spawn.parameters.properties;
    // Without this the model cannot choose whether the child inherits the
    // conversation, and a fork would have to be the only behaviour.
    (0, bun_test_1.expect)(properties.context).toEqual({
        type: "string",
        enum: ["fresh", "fork"],
    });
});
(0, bun_test_1.test)("spawning with fork threads the choice through to the record", function () { return __awaiter(void 0, void 0, void 0, function () {
    var spawned, spawn;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                spawn = (0, src_1.agentTools)().find(function (t) { return t.name === "agent_spawn"; });
                return [4 /*yield*/, spawn.execute({ task: "continue the work", context: "fork" }, {
                        workspaceRoot: "/tmp",
                        subagents: {
                            spawn: function (_task, options) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    spawned = options;
                                    return [2 /*return*/, { id: "a1", task: "continue the work", status: "idle" }];
                                });
                            }); },
                        },
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(spawned === null || spawned === void 0 ? void 0 : spawned.context).toBe("fork");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("omitting context leaves the subagent fresh", function () { return __awaiter(void 0, void 0, void 0, function () {
    var spawned, spawn;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                spawn = (0, src_1.agentTools)().find(function (t) { return t.name === "agent_spawn"; });
                return [4 /*yield*/, spawn.execute({ task: "start over" }, {
                        workspaceRoot: "/tmp",
                        subagents: {
                            spawn: function (_task, options) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    spawned = options;
                                    return [2 /*return*/, { id: "a1", task: "start over", status: "idle" }];
                                });
                            }); },
                        },
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(spawned === null || spawned === void 0 ? void 0 : spawned.context).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("agent_message is registered and takes an id plus a message", function () {
    var tools = (0, src_1.agentTools)();
    var message = tools.find(function (t) { return t.name === "agent_message"; });
    (0, bun_test_1.expect)(message).toBeDefined();
    var properties = message.parameters.properties;
    (0, bun_test_1.expect)(properties.id).toEqual({ type: "string" });
    (0, bun_test_1.expect)(properties.message).toEqual({ type: "string" });
    // Steering another agent changes what it will do next, so it is not read-only.
    (0, bun_test_1.expect)(message.requiresApproval).toBe(true);
});
(0, bun_test_1.test)("a stranger session cannot steer another session's subagent", function () { return __awaiter(void 0, void 0, void 0, function () {
    var message;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                message = (0, src_1.agentTools)().find(function (t) { return t.name === "agent_message"; });
                return [4 /*yield*/, (0, bun_test_1.expect)(message.execute({ id: "a1", message: "do something else" }, {
                        workspaceRoot: "/tmp",
                        sessionID: "ses_stranger",
                        subagents: {
                            get: function (id) { return ({
                                id: id,
                                task: "t",
                                status: "running",
                                parentSessionID: "ses_owner",
                            }); },
                            sendMessage: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, ({ route: "delivered" })];
                            }); }); },
                        },
                    })).rejects.toThrow(/only its parent may steer/)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
