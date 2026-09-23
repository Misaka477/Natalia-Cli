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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
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
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var node_os_1 = require("node:os");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
var session_1 = require("@anthelia/session");
var contracts_1 = require("@natalia/contracts");
var work_ledger_1 = require("@natalia/work-ledger");
/**
 * The Work Graph shipped as schema, projector, query and a TUI dialog with no
 * production writer, so every query returned an empty graph. These tests exist to
 * make that impossible to regress into: they drive a real runtime and assert the
 * graph has content, rather than asserting the projector can filter events a test
 * handed it.
 */
function workspace(name) {
    return __awaiter(this, void 0, void 0, function () {
        var root;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-wg-".concat(name, "-")))];
                case 1:
                    root = _a.sent();
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
                case 2:
                    _a.sent();
                    return [2 /*return*/, root];
            }
        });
    });
}
(0, bun_test_1.test)("a real turn with a tool call produces a connected graph", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, submitted, nodes, edges, action, tool;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, workspace("turn")];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "notes.md"), "hello\n")];
            case 2:
                _b.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_wg_turn",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_1() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 4];
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 3: return [2 /*return*/, _a.sent()];
                                        case 4: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_1",
                                                        name: "read_file",
                                                        arguments: JSON.stringify({ path: "notes.md" }),
                                                    },
                                                ],
                                            })];
                                        case 5: return [4 /*yield*/, _a.sent()];
                                        case 6:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 7: return [4 /*yield*/, _a.sent()];
                                        case 8:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("read the notes")];
            case 3:
                submitted = _b.sent();
                nodes = (0, session_1.projectedWorkGraphNodes)(events);
                edges = (0, session_1.projectedWorkGraphEdges)(events);
                // The empty pipeline is closed: production emitted nodes.
                (0, bun_test_1.expect)(nodes.length).toBeGreaterThan(0);
                action = nodes.find(function (node) { return node.nodeID === (0, work_ledger_1.agentActionNodeID)(submitted.id); });
                (0, bun_test_1.expect)(action).toMatchObject({ kind: "agent_action", turnID: submitted.id });
                tool = nodes.find(function (node) { return node.nodeID === (0, work_ledger_1.toolCallNodeID)(submitted.id, "call_1"); });
                (0, bun_test_1.expect)(tool).toMatchObject({ kind: "tool_call", actor: "read_file" });
                (0, bun_test_1.expect)(tool === null || tool === void 0 ? void 0 : tool.summary).toContain("succeeded");
                // The graph is connected: the tool call is attributable to the turn that caused
                // it, which is the whole point of recording it.
                (0, bun_test_1.expect)(edges.some(function (edge) {
                    return edge.sourceID === (0, work_ledger_1.agentActionNodeID)(submitted.id) &&
                        edge.targetID === (0, work_ledger_1.toolCallNodeID)(submitted.id, "call_1") &&
                        edge.kind === "caused";
                })).toBe(true);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 4:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("runtime startup records the effective tool catalogue as metadata", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, resolveReady, ready, registered;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, workspace("registered-tools")];
            case 1:
                root = _b.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_wg_registered_tools",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_2() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                ready = new Promise(function (resolve) {
                    resolveReady = resolve;
                });
                client.start(function (event) {
                    events.push(event);
                    if (event.type === "session.ready")
                        resolveReady();
                });
                return [4 /*yield*/, ready];
            case 2:
                _b.sent();
                registered = events.filter(function (event) {
                    return event.type === "tool.registered";
                });
                (0, bun_test_1.expect)(registered.length).toBeGreaterThan(0);
                // Built-in tools are contributed by their family capability, so the journal
                // names the family that owns a tool and the scope that family declared —
                // not an anonymous `natalia-runtime`.
                (0, bun_test_1.expect)(registered.find(function (event) { return event.name === "read_file"; })).toMatchObject({
                    owner: "natalia-tool-fs-read",
                    scope: "workspace",
                    recovery: "fail_closed",
                });
                (0, bun_test_1.expect)(registered.find(function (event) { return event.name === "todo_write"; })).toMatchObject({
                    owner: "natalia-tool-todo",
                    scope: "session",
                });
                (0, bun_test_1.expect)(registered.some(function (event) { return "description" in event; })).toBe(false);
                (0, bun_test_1.expect)(new Set(registered.map(function (event) { return event.id; })).size).toBe(registered.length);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 3:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("a failed tool call is recorded as a fact too", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, submitted, tool;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, workspace("failed")];
            case 1:
                root = _b.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_wg_failed",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_3() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 4];
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 3: return [2 /*return*/, _a.sent()];
                                        case 4: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_1",
                                                        name: "read_file",
                                                        arguments: JSON.stringify({ path: "does-not-exist.md" }),
                                                    },
                                                ],
                                            })];
                                        case 5: return [4 /*yield*/, _a.sent()];
                                        case 6:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 7: return [4 /*yield*/, _a.sent()];
                                        case 8:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("read a missing file")];
            case 2:
                submitted = _b.sent();
                tool = (0, session_1.projectedWorkGraphNodes)(events).find(function (node) { return node.nodeID === (0, work_ledger_1.toolCallNodeID)(submitted.id, "call_1"); });
                (0, bun_test_1.expect)(tool === null || tool === void 0 ? void 0 : tool.summary).toContain("failed");
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 3:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("the graph carries no arguments, output, prompt or error text", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, secretPath, events, client, graph;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, workspace("redaction")];
            case 1:
                root = _b.sent();
                secretPath = "credentials-SECRETPATH.md";
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, secretPath), "TOKEN-SECRETBODY\n")];
            case 2:
                _b.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_wg_redaction",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_4() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 4];
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 3: return [2 /*return*/, _a.sent()];
                                        case 4: return [4 /*yield*/, __await({ type: "thinking", text: "SECRETREASONING" })];
                                        case 5: return [4 /*yield*/, _a.sent()];
                                        case 6:
                                            _a.sent();
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "call_1",
                                                            name: "read_file",
                                                            arguments: JSON.stringify({ path: secretPath }),
                                                        },
                                                    ],
                                                })];
                                        case 7: return [4 /*yield*/, _a.sent()];
                                        case 8:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 9: return [4 /*yield*/, _a.sent()];
                                        case 10:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("read SECRETPROMPT now")];
            case 3:
                _b.sent();
                graph = JSON.stringify(__spreadArray(__spreadArray([], (0, session_1.projectedWorkGraphNodes)(events), true), (0, session_1.projectedWorkGraphEdges)(events), true));
                (0, bun_test_1.expect)(graph).not.toContain("SECRETPROMPT");
                (0, bun_test_1.expect)(graph).not.toContain("SECRETREASONING");
                (0, bun_test_1.expect)(graph).not.toContain("SECRETBODY");
                (0, bun_test_1.expect)(graph).not.toContain("SECRETPATH");
                // It still says something useful.
                (0, bun_test_1.expect)(graph).toContain("read_file");
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 4:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("an approval decision is recorded and attributed to the user", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, submitted, approvalRequest, approval;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, workspace("approval")];
            case 1:
                root = _b.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_wg_approval",
                    permissionMode: "ask",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_5() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 4];
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 3: return [2 /*return*/, _a.sent()];
                                        case 4: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_1",
                                                        name: "write_file",
                                                        arguments: JSON.stringify({
                                                            path: "out.txt",
                                                            content: "hello",
                                                        }),
                                                    },
                                                ],
                                            })];
                                        case 5: return [4 /*yield*/, _a.sent()];
                                        case 6:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 7: return [4 /*yield*/, _a.sent()];
                                        case 8:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) {
                    events.push(event);
                    if (event.type === "approval.request")
                        client.respondApproval({ requestID: event.id, decision: "once" });
                });
                return [4 /*yield*/, client.submitAndWait("write the file")];
            case 2:
                submitted = _b.sent();
                approvalRequest = events.find(function (event) { return event.type === "approval.request"; });
                (0, bun_test_1.expect)(approvalRequest).toBeDefined();
                approval = (0, session_1.projectedWorkGraphNodes)(events).find(function (node) {
                    return node.nodeID ===
                        (0, work_ledger_1.approvalNodeID)(approvalRequest
                            .id);
                });
                // Who authorized the side effect is exactly what the graph is for.
                (0, bun_test_1.expect)(approval).toMatchObject({ kind: "approval", actor: "user" });
                (0, bun_test_1.expect)(approval === null || approval === void 0 ? void 0 : approval.summary).toContain("once");
                (0, bun_test_1.expect)((0, session_1.projectedWorkGraphEdges)(events).some(function (edge) {
                    return edge.sourceID === (0, work_ledger_1.toolCallNodeID)(submitted.id, "call_1") &&
                        edge.targetID ===
                            (0, work_ledger_1.approvalNodeID)(approvalRequest.id) &&
                        edge.kind === "approved_by";
                })).toBe(true);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 3:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("a rejected approval links to a rejected tool-call fact", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, submitted, toolID, tool, approvalRequest;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, workspace("approval-rejected")];
            case 1:
                root = _b.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_wg_approval_rejected",
                    permissionMode: "ask",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_6() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 4];
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 3: return [2 /*return*/, _a.sent()];
                                        case 4: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_1",
                                                        name: "write_file",
                                                        arguments: JSON.stringify({
                                                            path: "out.txt",
                                                            content: "must not be written",
                                                        }),
                                                    },
                                                ],
                                            })];
                                        case 5: return [4 /*yield*/, _a.sent()];
                                        case 6:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 7: return [4 /*yield*/, _a.sent()];
                                        case 8:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) {
                    events.push(event);
                    if (event.type === "approval.request")
                        client.respondApproval({ requestID: event.id, decision: "reject" });
                });
                return [4 /*yield*/, client.submitAndWait("do not approve this")];
            case 2:
                submitted = _b.sent();
                toolID = (0, work_ledger_1.toolCallNodeID)(submitted.id, "call_1");
                tool = (0, session_1.projectedWorkGraphNodes)(events).find(function (node) { return node.nodeID === toolID; });
                (0, bun_test_1.expect)(tool === null || tool === void 0 ? void 0 : tool.summary).toContain("rejected");
                approvalRequest = events.find(function (event) {
                    return event.type === "approval.request";
                });
                (0, bun_test_1.expect)(approvalRequest).toBeDefined();
                (0, bun_test_1.expect)((0, session_1.projectedWorkGraphEdges)(events).some(function (edge) {
                    return edge.sourceID === toolID &&
                        edge.targetID === (0, work_ledger_1.approvalNodeID)(approvalRequest.id) &&
                        edge.kind === "rejected_by";
                })).toBe(true);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 3:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("read-only policy records the tool call as rejected", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, submitted, tool;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, workspace("read-only")];
            case 1:
                root = _b.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_wg_read_only",
                    permissionMode: "read_only",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_7() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 4];
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 3: return [2 /*return*/, _a.sent()];
                                        case 4: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_1",
                                                        name: "write_file",
                                                        arguments: JSON.stringify({
                                                            path: "out.txt",
                                                            content: "must not be written",
                                                        }),
                                                    },
                                                ],
                                            })];
                                        case 5: return [4 /*yield*/, _a.sent()];
                                        case 6:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 7: return [4 /*yield*/, _a.sent()];
                                        case 8:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("try a write in read-only mode")];
            case 2:
                submitted = _b.sent();
                tool = (0, session_1.projectedWorkGraphNodes)(events).find(function (node) { return node.nodeID === (0, work_ledger_1.toolCallNodeID)(submitted.id, "call_1"); });
                (0, bun_test_1.expect)(tool === null || tool === void 0 ? void 0 : tool.summary).toContain("rejected");
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 3:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("the episode id rides along as the graph's correlation field", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, nodes, edges, _i, _a, fact;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, workspace("episode")];
            case 1:
                root = _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "a.md"), "x\n")];
            case 2:
                _c.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_wg_episode",
                    episodeID: "epi_headless_1",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_8() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 4];
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 3: return [2 /*return*/, _a.sent()];
                                        case 4: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_1",
                                                        name: "read_file",
                                                        arguments: JSON.stringify({ path: "a.md" }),
                                                    },
                                                ],
                                            })];
                                        case 5: return [4 /*yield*/, _a.sent()];
                                        case 6:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 7: return [4 /*yield*/, _a.sent()];
                                        case 8:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("read it")];
            case 3:
                _c.sent();
                nodes = (0, session_1.projectedWorkGraphNodes)(events);
                edges = (0, session_1.projectedWorkGraphEdges)(events);
                (0, bun_test_1.expect)(nodes.length).toBeGreaterThan(0);
                for (_i = 0, _a = __spreadArray(__spreadArray([], nodes, true), edges, true); _i < _a.length; _i++) {
                    fact = _a[_i];
                    (0, bun_test_1.expect)(fact.episodeID).toBe("epi_headless_1");
                }
                return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 4:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("every emitted fact validates against the canonical WG1 schema", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, nodes, edges, _i, nodes_1, node, parsed, _a, edges_1, edge, parsed;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, workspace("schema")];
            case 1:
                root = _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "a.md"), "x\n")];
            case 2:
                _c.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_wg_schema",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_9() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 4];
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 3: return [2 /*return*/, _a.sent()];
                                        case 4: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_1",
                                                        name: "read_file",
                                                        arguments: JSON.stringify({ path: "a.md" }),
                                                    },
                                                ],
                                            })];
                                        case 5: return [4 /*yield*/, _a.sent()];
                                        case 6:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 7: return [4 /*yield*/, _a.sent()];
                                        case 8:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("read it")];
            case 3:
                _c.sent();
                nodes = (0, session_1.projectedWorkGraphNodes)(events);
                edges = (0, session_1.projectedWorkGraphEdges)(events);
                (0, bun_test_1.expect)(nodes.length).toBeGreaterThan(0);
                (0, bun_test_1.expect)(edges.length).toBeGreaterThan(0);
                for (_i = 0, nodes_1 = nodes; _i < nodes_1.length; _i++) {
                    node = nodes_1[_i];
                    parsed = contracts_1.workGraphNodeSchema.safeParse(__assign(__assign({}, node), { id: node.nodeID }));
                    (0, bun_test_1.expect)(parsed.success).toBe(true);
                }
                for (_a = 0, edges_1 = edges; _a < edges_1.length; _a++) {
                    edge = edges_1[_a];
                    parsed = contracts_1.workGraphEdgeSchema.safeParse(edge);
                    (0, bun_test_1.expect)(parsed.success).toBe(true);
                }
                return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 4:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("a workspace change is attributable to the call and turn that made it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, submitted, nodes, change, edges, modified, graph;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, workspace("change")];
            case 1:
                root = _b.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_wg_change",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_10() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 4];
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 3: return [2 /*return*/, _a.sent()];
                                        case 4: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_1",
                                                        name: "write_file",
                                                        arguments: JSON.stringify({
                                                            path: "notes.md",
                                                            content: "SECRETFILEBODY",
                                                        }),
                                                    },
                                                ],
                                            })];
                                        case 5: return [4 /*yield*/, _a.sent()];
                                        case 6:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 7: return [4 /*yield*/, _a.sent()];
                                        case 8:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("write the notes")];
            case 2:
                submitted = _b.sent();
                nodes = (0, session_1.projectedWorkGraphNodes)(events);
                change = nodes.find(function (node) { return node.kind === "workspace_change"; });
                (0, bun_test_1.expect)(change).toMatchObject({
                    target: "notes.md",
                    actor: "write_file",
                    turnID: submitted.id,
                });
                edges = (0, session_1.projectedWorkGraphEdges)(events);
                modified = edges.find(function (edge) { return edge.kind === "modified" && edge.targetID === change.nodeID; });
                (0, bun_test_1.expect)(modified === null || modified === void 0 ? void 0 : modified.sourceID).toBe((0, work_ledger_1.toolCallNodeID)(submitted.id, "call_1"));
                (0, bun_test_1.expect)(edges.some(function (edge) {
                    return edge.kind === "caused" &&
                        edge.sourceID === (0, work_ledger_1.agentActionNodeID)(submitted.id) &&
                        edge.targetID === modified.sourceID;
                })).toBe(true);
                graph = JSON.stringify(__spreadArray(__spreadArray([], nodes, true), edges, true));
                (0, bun_test_1.expect)(graph).toContain("notes.md");
                (0, bun_test_1.expect)(graph).not.toContain("SECRETFILEBODY");
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 3:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("a sandbox merge records only successfully landed paths", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, step, client, submitted, change, _a, graph;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, workspace("sandbox-merge-change")];
            case 1:
                root = _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify({
                        version: 3,
                        sandbox: { promoteCommand: "true" },
                    }))];
            case 2:
                _c.sent();
                events = [];
                step = 0;
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_wg_sandbox_merge",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_11() {
                                var calls;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            calls = [
                                                {
                                                    id: "create",
                                                    name: "sandbox_create",
                                                    arguments: JSON.stringify({ id: "box" }),
                                                },
                                                {
                                                    id: "write",
                                                    name: "sandbox_write",
                                                    arguments: JSON.stringify({
                                                        id: "box",
                                                        path: "merged.md",
                                                        content: "SECRETFILEBODY",
                                                    }),
                                                },
                                                {
                                                    id: "merge",
                                                    name: "sandbox_merge",
                                                    arguments: JSON.stringify({ id: "box" }),
                                                },
                                            ];
                                            if (!(step < calls.length)) return [3 /*break*/, 3];
                                            return [4 /*yield*/, __await({ type: "tool_call", calls: [calls[step++]] })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [3 /*break*/, 6];
                                        case 3: return [4 /*yield*/, __await({ type: "done" })];
                                        case 4: return [4 /*yield*/, _a.sent()];
                                        case 5:
                                            _a.sent();
                                            _a.label = 6;
                                        case 6: return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("merge the sandbox")];
            case 3:
                submitted = _c.sent();
                change = (0, session_1.projectedWorkGraphNodes)(events).find(function (node) { return node.kind === "workspace_change"; });
                (0, bun_test_1.expect)(change).toMatchObject({
                    target: "merged.md",
                    actor: "sandbox_merge",
                    turnID: submitted.id,
                });
                _a = bun_test_1.expect;
                return [4 /*yield*/, Bun.file((0, node_path_1.join)(root, "merged.md")).text()];
            case 4:
                _a.apply(void 0, [_c.sent()]).toBe("SECRETFILEBODY");
                graph = JSON.stringify(__spreadArray(__spreadArray([], (0, session_1.projectedWorkGraphNodes)(events), true), (0, session_1.projectedWorkGraphEdges)(events), true));
                (0, bun_test_1.expect)(graph).not.toContain("SECRETFILEBODY");
                return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 5:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("a successful checkpoint records a safe checkpoint fact", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, checkpoint;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, workspace("checkpoint-workgraph")];
            case 1:
                root = _b.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_wg_checkpoint",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_12() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("checkpoint the workspace")];
            case 2:
                _b.sent();
                checkpoint = (0, session_1.projectedWorkGraphNodes)(events).find(function (node) { return node.kind === "checkpoint"; });
                (0, bun_test_1.expect)(checkpoint).toMatchObject({
                    actor: "checkpoint",
                    target: "checkpoint_0",
                    sessionID: "ses_wg_checkpoint",
                });
                (0, bun_test_1.expect)(JSON.stringify(checkpoint)).not.toContain(root);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 3:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("a successful rollback links the destination to its safety checkpoint", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, nodes, edges;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, workspace("rollback-workgraph")];
            case 1:
                root = _c.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_wg_rollback",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_13() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, ((_a = client.checkpointRollback) === null || _a === void 0 ? void 0 : _a.call(client, { id: "checkpoint_0" }))];
            case 2:
                _c.sent();
                nodes = (0, session_1.projectedWorkGraphNodes)(events);
                edges = (0, session_1.projectedWorkGraphEdges)(events);
                (0, bun_test_1.expect)(edges.some(function (edge) {
                    return edge.kind === "rolled_back_by" &&
                        edge.sourceID === "wg:checkpoint:ses_wg_rollback:checkpoint_0" &&
                        edge.targetID === "wg:checkpoint:ses_wg_rollback:checkpoint_1";
                })).toBe(true);
                (0, bun_test_1.expect)(events.some(function (event) {
                    return event.type === "rollback.end" && event.sessionID === "ses_wg_rollback";
                })).toBe(true);
                (0, bun_test_1.expect)(JSON.stringify(nodes)).not.toContain(root);
                return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 3:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("a write that failed records no workspace change", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, nodes;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, workspace("change-failed")];
            case 1:
                root = _b.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_wg_change_failed",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_14() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 4];
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 3: return [2 /*return*/, _a.sent()];
                                        case 4: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_1",
                                                        name: "write_file",
                                                        arguments: JSON.stringify({
                                                            path: "../outside-the-workspace.md",
                                                            content: "nope",
                                                        }),
                                                    },
                                                ],
                                            })];
                                        case 5: return [4 /*yield*/, _a.sent()];
                                        case 6:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 7: return [4 /*yield*/, _a.sent()];
                                        case 8:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("write outside the workspace")];
            case 2:
                _b.sent();
                nodes = (0, session_1.projectedWorkGraphNodes)(events);
                (0, bun_test_1.expect)(nodes.some(function (node) { return node.kind === "workspace_change"; })).toBe(false);
                // The attempt is still recorded as a settled call.
                (0, bun_test_1.expect)(nodes.some(function (node) { return node.kind === "tool_call"; })).toBe(true);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 3:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("a write that throws during execution records no workspace change", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, submitted, nodes, tool;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, workspace("change-threw")];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, "occupied"), { recursive: true })];
            case 2:
                _b.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_wg_change_threw",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_15() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 4];
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 3: return [2 /*return*/, _a.sent()];
                                        case 4: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_1",
                                                        name: "write_file",
                                                        // A directory already occupies this path, so the write throws.
                                                        arguments: JSON.stringify({
                                                            path: "occupied",
                                                            content: "nope",
                                                        }),
                                                    },
                                                ],
                                            })];
                                        case 5: return [4 /*yield*/, _a.sent()];
                                        case 6:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 7: return [4 /*yield*/, _a.sent()];
                                        case 8:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("write onto a directory")];
            case 3:
                submitted = _b.sent();
                nodes = (0, session_1.projectedWorkGraphNodes)(events);
                tool = nodes.find(function (node) { return node.nodeID === (0, work_ledger_1.toolCallNodeID)(submitted.id, "call_1"); });
                // The call is recorded as failed, and no change is claimed.
                (0, bun_test_1.expect)(tool === null || tool === void 0 ? void 0 : tool.summary).toContain("failed");
                (0, bun_test_1.expect)(nodes.some(function (node) { return node.kind === "workspace_change"; })).toBe(false);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 4:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("a read records no workspace change", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, workspace("change-read")];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "a.md"), "x\n")];
            case 2:
                _b.sent();
                events = [];
                client = (0, plugin_test_helpers_1.createOfficialRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_wg_change_read",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_16() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (!request.messages.some(function (message) { return message.role === "tool"; })) return [3 /*break*/, 4];
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 3: return [2 /*return*/, _a.sent()];
                                        case 4: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_1",
                                                        name: "read_file",
                                                        arguments: JSON.stringify({ path: "a.md" }),
                                                    },
                                                ],
                                            })];
                                        case 5: return [4 /*yield*/, _a.sent()];
                                        case 6:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 7: return [4 /*yield*/, _a.sent()];
                                        case 8:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.submitAndWait("read it")];
            case 3:
                _b.sent();
                (0, bun_test_1.expect)((0, session_1.projectedWorkGraphNodes)(events).some(function (node) { return node.kind === "workspace_change"; })).toBe(false);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 4:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("an external confirmed change becomes an isolated workspace_change node with no edge", function () {
    var node = (0, work_ledger_1.externalWorkspaceChangeNode)({
        confirmedChangeID: "change:ext:1",
        path: "src/untracked.ts",
        sessionID: "ses_1",
    });
    (0, bun_test_1.expect)(contracts_1.workGraphNodeSchema.safeParse(node).success).toBe(true);
    (0, bun_test_1.expect)(node).toMatchObject({
        kind: "workspace_change",
        target: "src/untracked.ts",
        actor: "external",
        sessionID: "ses_1",
    });
    // No turnID — this is an isolated node with no causal edge.
    (0, bun_test_1.expect)(node.turnID).toBeUndefined();
    (0, bun_test_1.expect)(node.id).toContain("src/untracked.ts");
});
(0, bun_test_1.test)("a completion card validates a workspace change through a validated_by edge", function () {
    var edge = (0, work_ledger_1.completionValidationEdge)({
        changeID: "task_1",
        path: "src/a.ts",
        completionID: "completion:1",
    });
    (0, bun_test_1.expect)(contracts_1.workGraphEdgeSchema.safeParse(edge).success).toBe(true);
    (0, bun_test_1.expect)(edge).toMatchObject({
        kind: "validated_by",
        sourceID: "wg:change:task_1:src/a.ts",
        targetID: "wg:completion:completion:1",
    });
});
(0, bun_test_1.test)("a constitution rule is a constraint node (CST4 linkage)", function () {
    var node = (0, work_ledger_1.constitutionRuleNode)({
        ruleID: "C-TERM-001",
        statement: "禁止直接杀掉 wezterm-mux-server",
        sessionID: "ses_1",
    });
    (0, bun_test_1.expect)(contracts_1.workGraphNodeSchema.safeParse(node).success).toBe(true);
    (0, bun_test_1.expect)(node).toMatchObject({
        kind: "constraint",
        actor: "constitution",
        target: "C-TERM-001",
        sessionID: "ses_1",
    });
});
(0, bun_test_1.test)("a recorded decision is a decision node (CST4 linkage)", function () {
    var node = (0, work_ledger_1.decisionNode)({
        decisionID: "decision:abc",
        decision: "default no commit/push",
        sessionID: "ses_1",
    });
    (0, bun_test_1.expect)(contracts_1.workGraphNodeSchema.safeParse(node).success).toBe(true);
    (0, bun_test_1.expect)(node).toMatchObject({
        kind: "decision",
        actor: "decision",
        target: "decision:abc",
        sessionID: "ses_1",
    });
});
(0, bun_test_1.test)("a blocked constitution preflight links the call to the rule (CST4 constrained_by)", function () {
    var edge = (0, work_ledger_1.constitutionCheckEdge)({
        turnID: "turn_1",
        callID: "call_1",
        ruleID: "C-TERM-001",
    });
    (0, bun_test_1.expect)(contracts_1.workGraphEdgeSchema.safeParse(edge).success).toBe(true);
    (0, bun_test_1.expect)(edge).toMatchObject({
        kind: "constrained_by",
        sourceID: (0, work_ledger_1.toolCallNodeID)("turn_1", "call_1"),
        targetID: "wg:constraint:C-TERM-001",
    });
});
