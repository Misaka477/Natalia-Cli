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
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
var SESSION = "ses_e2e_workgraph_query";
(0, bun_test_1.test)("Phase 3 E2E: work_graph_query filters by nodeKind and reports truncation", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, results, client, whole, decisions;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workgraph-query-e2e")];
            case 1:
                root = _b.sent();
                results = [];
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_1() {
                                var toolResult;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            toolResult = request.messages
                                                .filter(function (message) {
                                                var _a;
                                                return message.role === "tool" &&
                                                    String((_a = message.toolCallID) !== null && _a !== void 0 ? _a : "").startsWith("call_graph");
                                            })
                                                .at(-1);
                                            if (!toolResult) return [3 /*break*/, 24];
                                            results.push(String((_a = toolResult.content) !== null && _a !== void 0 ? _a : ""));
                                            if (!(results.length === 1)) return [3 /*break*/, 6];
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "call_graph",
                                                            name: "work_graph_query",
                                                            arguments: JSON.stringify({
                                                                nodeKind: "decision",
                                                                limit: 50,
                                                            }),
                                                        },
                                                    ],
                                                })];
                                        case 1: 
                                        // nodeKind filter — only decision nodes.
                                        return [4 /*yield*/, _b.sent()];
                                        case 2:
                                            // nodeKind filter — only decision nodes.
                                            _b.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _b.sent()];
                                        case 4:
                                            _b.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 5: return [2 /*return*/, _b.sent()];
                                        case 6:
                                            if (!(results.length === 2)) return [3 /*break*/, 12];
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "call_graph",
                                                            name: "work_graph_query",
                                                            arguments: JSON.stringify({
                                                                path: "plans/x.md",
                                                                findingID: "DF-1",
                                                            }),
                                                        },
                                                    ],
                                                })];
                                        case 7: 
                                        // Two precise queries at once — a usage error.
                                        return [4 /*yield*/, _b.sent()];
                                        case 8:
                                            // Two precise queries at once — a usage error.
                                            _b.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 9: return [4 /*yield*/, _b.sent()];
                                        case 10:
                                            _b.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 11: return [2 /*return*/, _b.sent()];
                                        case 12:
                                            if (!(results.length === 3)) return [3 /*break*/, 18];
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "call_graph",
                                                            name: "work_graph_query",
                                                            arguments: JSON.stringify({ cursor: "not-a-number" }),
                                                        },
                                                    ],
                                                })];
                                        case 13: 
                                        // Invalid cursor — a usage error.
                                        return [4 /*yield*/, _b.sent()];
                                        case 14:
                                            // Invalid cursor — a usage error.
                                            _b.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 15: return [4 /*yield*/, _b.sent()];
                                        case 16:
                                            _b.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 17: return [2 /*return*/, _b.sent()];
                                        case 18: return [4 /*yield*/, __await({ type: "content", text: "graph queried" })];
                                        case 19: return [4 /*yield*/, _b.sent()];
                                        case 20:
                                            _b.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 21: return [4 /*yield*/, _b.sent()];
                                        case 22:
                                            _b.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 23: return [2 /*return*/, _b.sent()];
                                        case 24: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_graph",
                                                        name: "work_graph_query",
                                                        arguments: JSON.stringify({ limit: 1 }),
                                                    },
                                                ],
                                            })];
                                        case 25: 
                                        // First: a limit-1 query over the whole graph -> truncated + nextCursor.
                                        return [4 /*yield*/, _b.sent()];
                                        case 26:
                                            // First: a limit-1 query over the whole graph -> truncated + nextCursor.
                                            _b.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 27: return [4 /*yield*/, _b.sent()];
                                        case 28:
                                            _b.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach(SESSION)];
            case 2:
                _b.sent();
                // A decision node in the graph.
                return [4 /*yield*/, client.recordDecision({ decision: "append runtime context" }, SESSION)];
            case 3:
                // A decision node in the graph.
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("query the graph")];
            case 4:
                _b.sent();
                (0, bun_test_1.expect)(results.length).toBeGreaterThanOrEqual(4);
                whole = JSON.parse(results[0]);
                (0, bun_test_1.expect)(whole.total).toBeGreaterThan(1);
                (0, bun_test_1.expect)(whole.nodes).toHaveLength(1);
                (0, bun_test_1.expect)(whole.truncated).toBe(true);
                (0, bun_test_1.expect)(whole.nextCursor).toBe("1");
                decisions = JSON.parse(results[1]);
                (0, bun_test_1.expect)(decisions.nodes.length).toBeGreaterThan(0);
                (0, bun_test_1.expect)(decisions.nodes.every(function (node) { return node.kind === "decision"; })).toBe(true);
                // 3. Two precise queries -> usage error string (not a JSON result).
                (0, bun_test_1.expect)(results[2]).toContain("fill exactly one precise query");
                // 4. Invalid cursor -> usage error string.
                (0, bun_test_1.expect)(results[3]).toContain("invalid cursor");
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 5:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase 3 E2E: work_graph_query returns an empty (not error) result for a non-matching query", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, results, client, byKind, byFinding;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workgraph-query-empty")];
            case 1:
                root = _b.sent();
                results = [];
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_2() {
                                var messages, graphResult;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            messages = request.messages;
                                            graphResult = messages
                                                .filter(function (message) {
                                                var _a;
                                                return message.role === "tool" &&
                                                    String((_a = message.toolCallID) !== null && _a !== void 0 ? _a : "").startsWith("call_graph");
                                            })
                                                .at(-1);
                                            if (!graphResult) return [3 /*break*/, 12];
                                            results.push(String((_a = graphResult.content) !== null && _a !== void 0 ? _a : ""));
                                            if (!(results.length === 1)) return [3 /*break*/, 6];
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "call_graph",
                                                            name: "work_graph_query",
                                                            arguments: JSON.stringify({ findingID: "DF-nonexistent" }),
                                                        },
                                                    ],
                                                })];
                                        case 1: 
                                        // A findingID precise query with no matching chain.
                                        return [4 /*yield*/, _b.sent()];
                                        case 2:
                                            // A findingID precise query with no matching chain.
                                            _b.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _b.sent()];
                                        case 4:
                                            _b.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 5: return [2 /*return*/, _b.sent()];
                                        case 6: return [4 /*yield*/, __await({ type: "content", text: "queried" })];
                                        case 7: return [4 /*yield*/, _b.sent()];
                                        case 8:
                                            _b.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 9: return [4 /*yield*/, _b.sent()];
                                        case 10:
                                            _b.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 11: return [2 /*return*/, _b.sent()];
                                        case 12: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_graph",
                                                        name: "work_graph_query",
                                                        arguments: JSON.stringify({ nodeKind: "goal" }),
                                                    },
                                                ],
                                            })];
                                        case 13: 
                                        // First: a nodeKind with no nodes in this session.
                                        return [4 /*yield*/, _b.sent()];
                                        case 14:
                                            // First: a nodeKind with no nodes in this session.
                                            _b.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 15: return [4 /*yield*/, _b.sent()];
                                        case 16:
                                            _b.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach(SESSION)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("query the graph")];
            case 3:
                _b.sent();
                (0, bun_test_1.expect)(results.length).toBeGreaterThanOrEqual(2);
                byKind = JSON.parse(results[0]);
                (0, bun_test_1.expect)(byKind).toMatchObject({ total: 0, truncated: false, nodes: [] });
                byFinding = JSON.parse(results[1]);
                (0, bun_test_1.expect)(byFinding).toMatchObject({ total: 0, truncated: false, nodes: [] });
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 4:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase 3 E2E: an unfiltered work_graph_query defaults to the active plan's chain", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sessionID, results, planID, client, marked, unfiltered, byKind;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("workgraph-query-active-plan")];
            case 1:
                root = _b.sent();
                sessionID = "ses_e2e_wgq_active";
                results = [];
                planID = "";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_3() {
                                var toolResult;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            toolResult = request.messages
                                                .filter(function (message) {
                                                var _a;
                                                return message.role === "tool" &&
                                                    String((_a = message.toolCallID) !== null && _a !== void 0 ? _a : "").startsWith("call_graph");
                                            })
                                                .at(-1);
                                            if (!toolResult) return [3 /*break*/, 12];
                                            results.push(String((_a = toolResult.content) !== null && _a !== void 0 ? _a : ""));
                                            if (!(results.length === 1)) return [3 /*break*/, 6];
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "call_graph",
                                                            name: "work_graph_query",
                                                            arguments: JSON.stringify({ nodeKind: "decision" }),
                                                        },
                                                    ],
                                                })];
                                        case 1: 
                                        // Then: the decision node by kind (proves it exists in the graph).
                                        return [4 /*yield*/, _b.sent()];
                                        case 2:
                                            // Then: the decision node by kind (proves it exists in the graph).
                                            _b.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _b.sent()];
                                        case 4:
                                            _b.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 5: return [2 /*return*/, _b.sent()];
                                        case 6: return [4 /*yield*/, __await({ type: "content", text: "queried" })];
                                        case 7: return [4 /*yield*/, _b.sent()];
                                        case 8:
                                            _b.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 9: return [4 /*yield*/, _b.sent()];
                                        case 10:
                                            _b.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 11: return [2 /*return*/, _b.sent()];
                                        case 12: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    { id: "call_graph", name: "work_graph_query", arguments: "{}" },
                                                ],
                                            })];
                                        case 13: 
                                        // First: no args -> should default to the ACTIVE plan's chain, not the
                                        // whole session graph.
                                        return [4 /*yield*/, _b.sent()];
                                        case 14:
                                            // First: no args -> should default to the ACTIVE plan's chain, not the
                                            // whole session graph.
                                            _b.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 15: return [4 /*yield*/, _b.sent()];
                                        case 16:
                                            _b.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach(sessionID)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/wgq-active.md",
                        content: "# Active plan\n\n- one step\n",
                        title: "Active plan",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/wgq-active.md",
                        title: "Active plan",
                    })];
            case 4:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(planID)];
            case 5:
                _b.sent();
                // A plain decision: its work-graph node carries no planID, so it is NOT part
                // of the active plan's chain.
                return [4 /*yield*/, client.recordDecision({ decision: "an unrelated session-scoped choice" }, sessionID)];
            case 6:
                // A plain decision: its work-graph node carries no planID, so it is NOT part
                // of the active plan's chain.
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("query the graph")];
            case 7:
                _b.sent();
                unfiltered = JSON.parse(results[0]);
                byKind = JSON.parse(results[1]);
                // The decision node exists in the session graph...
                (0, bun_test_1.expect)(byKind.nodes.some(function (node) { return node.kind === "decision"; })).toBe(true);
                // ...but the unfiltered query defaults to the active plan and excludes it.
                (0, bun_test_1.expect)(unfiltered.nodes.some(function (node) { return node.kind === "decision"; })).toBe(false);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 8:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
