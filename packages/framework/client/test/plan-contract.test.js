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
var src_1 = require("../src");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
var session_1 = require("@anthelia/session");
var e2e_harness_1 = require("./e2e-harness");
/** A provider whose first step proposes the contract, then settles. */
function proposeProvider(getProposal, settle) {
    return {
        provider: "plan-propose",
        model: "plan-propose-model",
        stream: function (request) {
            return __asyncGenerator(this, arguments, function stream_1() {
                var proposal, toolResult, _i, _a, chunk;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            proposal = getProposal();
                            toolResult = request.messages.find(function (message) {
                                return message.role === "tool" && message.toolCallID === "call_propose";
                            });
                            if (!(proposal && !toolResult)) return [3 /*break*/, 6];
                            return [4 /*yield*/, __await({
                                    type: "tool_call",
                                    calls: [
                                        {
                                            id: "call_propose",
                                            name: "plan_propose",
                                            arguments: JSON.stringify(proposal),
                                        },
                                    ],
                                })];
                        case 1: return [4 /*yield*/, _c.sent()];
                        case 2:
                            _c.sent();
                            return [4 /*yield*/, __await({ type: "done" })];
                        case 3: return [4 /*yield*/, _c.sent()];
                        case 4:
                            _c.sent();
                            return [4 /*yield*/, __await(void 0)];
                        case 5: return [2 /*return*/, _c.sent()];
                        case 6:
                            if (!toolResult) return [3 /*break*/, 13];
                            _i = 0, _a = settle(String((_b = toolResult.content) !== null && _b !== void 0 ? _b : ""));
                            _c.label = 7;
                        case 7:
                            if (!(_i < _a.length)) return [3 /*break*/, 11];
                            chunk = _a[_i];
                            return [4 /*yield*/, __await(chunk)];
                        case 8: return [4 /*yield*/, _c.sent()];
                        case 9:
                            _c.sent();
                            _c.label = 10;
                        case 10:
                            _i++;
                            return [3 /*break*/, 7];
                        case 11: return [4 /*yield*/, __await(void 0)];
                        case 12: return [2 /*return*/, _c.sent()];
                        case 13: return [4 /*yield*/, __await({ type: "content", text: "ok" })];
                        case 14: return [4 /*yield*/, _c.sent()];
                        case 15:
                            _c.sent();
                            return [4 /*yield*/, __await({ type: "done" })];
                        case 16: return [4 /*yield*/, _c.sent()];
                        case 17:
                            _c.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
    };
}
(0, bun_test_1.test)("plan_propose drafts, gates on the user, and lands the accepted contract", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, planID, settled, client, marked, drafted, accepted;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-contract-accept")];
            case 1:
                root = _b.sent();
                events = [];
                planID = "";
                settled = false;
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_contract",
                    permissionMode: "ask",
                    provider: proposeProvider(function () { return ({
                        planID: planID,
                        scope: ["packages/framework/runtime/src"],
                        verification: ["bun test packages/framework/runtime"],
                        constraints: ["no new runtime dependency"],
                    }); }, function (result) {
                        settled = true;
                        (0, bun_test_1.expect)(result).toContain('"accepted":true');
                        return [{ type: "content", text: "contract accepted" }];
                    }),
                });
                client.start(function (event) {
                    events.push(event);
                    if (event.type === "approval.request" && event.scope === "work_contract")
                        client.respondApproval({ requestID: event.id, decision: "once" });
                });
                return [4 /*yield*/, client.sessionAttach("ses_plan_contract")];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/contract-plan.md",
                        content: "# Contract plan\n\n- concrete steps\n",
                        title: "Contract plan",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/contract-plan.md",
                        title: "Contract plan",
                    })];
            case 4:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(marked.planID)];
            case 5:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("propose the contract for the plan")];
            case 6:
                _b.sent();
                (0, bun_test_1.expect)(settled).toBe(true);
                drafted = events.filter(function (event) { return event.type === "work_contract.drafted"; });
                accepted = events.filter(function (event) { return event.type === "work_contract.accepted"; });
                (0, bun_test_1.expect)(drafted).toHaveLength(1);
                (0, bun_test_1.expect)(accepted).toHaveLength(1);
                (0, bun_test_1.expect)(drafted[0]).toMatchObject({
                    type: "work_contract.drafted",
                    planID: planID,
                    scope: ["packages/framework/runtime/src"],
                    source: "model",
                });
                (0, bun_test_1.expect)(accepted[0]).toMatchObject({
                    type: "work_contract.accepted",
                    planID: planID,
                    acceptedBy: "user",
                    constraints: ["no new runtime dependency"],
                });
                // The projection reports the contract as current.
                (0, bun_test_1.expect)((0, session_1.projectedWorkContracts)(events)).toEqual([
                    {
                        planID: planID,
                        version: 1,
                        scope: ["packages/framework/runtime/src"],
                        verification: ["bun test packages/framework/runtime"],
                        constraints: ["no new runtime dependency"],
                        status: "current",
                        acceptedBy: "user",
                        acceptedAt: bun_test_1.expect.any(String),
                    },
                ]);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 7:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("plan_propose rejects placeholder fields and re-proposes after feedback", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, planID, proposed, settled, client, marked;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-contract-placeholder")];
            case 1:
                root = _b.sent();
                events = [];
                planID = "";
                proposed = 0;
                settled = false;
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_contract_ph",
                    permissionMode: "ask",
                    provider: {
                        provider: "plan-propose-retry",
                        model: "plan-propose-retry-model",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_2() {
                                var proposeResult, result;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            proposeResult = request.messages
                                                .filter(function (message) {
                                                var _a;
                                                return message.role === "tool" &&
                                                    String((_a = message.toolCallID) !== null && _a !== void 0 ? _a : "").startsWith("call_propose");
                                            })
                                                .at(-1);
                                            if (!!proposeResult) return [3 /*break*/, 6];
                                            proposed += 1;
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "call_propose",
                                                            name: "plan_propose",
                                                            arguments: JSON.stringify(proposed === 1
                                                                ? { planID: planID, scope: ["all"] }
                                                                : { planID: planID, scope: ["packages/framework/runtime/src"] }),
                                                        },
                                                    ],
                                                })];
                                        case 1: return [4 /*yield*/, _b.sent()];
                                        case 2:
                                            _b.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _b.sent()];
                                        case 4:
                                            _b.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 5: return [2 /*return*/, _b.sent()];
                                        case 6:
                                            result = String((_a = proposeResult.content) !== null && _a !== void 0 ? _a : "");
                                            if (!(proposed === 1)) return [3 /*break*/, 12];
                                            // The placeholder draft was refused before the journal and before
                                            // the gate; the model re-proposes with concrete fields.
                                            (0, bun_test_1.expect)(result).toContain('"accepted":false');
                                            (0, bun_test_1.expect)(result).toContain("placeholder");
                                            proposed = 2;
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "call_propose",
                                                            name: "plan_propose",
                                                            arguments: JSON.stringify({
                                                                planID: planID,
                                                                scope: ["packages/framework/runtime/src"],
                                                            }),
                                                        },
                                                    ],
                                                })];
                                        case 7: return [4 /*yield*/, _b.sent()];
                                        case 8:
                                            _b.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 9: return [4 /*yield*/, _b.sent()];
                                        case 10:
                                            _b.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 11: return [2 /*return*/, _b.sent()];
                                        case 12:
                                            settled = true;
                                            (0, bun_test_1.expect)(result).toContain('"accepted":true');
                                            return [4 /*yield*/, __await({ type: "content", text: "second attempt accepted" })];
                                        case 13: return [4 /*yield*/, _b.sent()];
                                        case 14:
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
                client.start(function (event) {
                    events.push(event);
                    if (event.type === "approval.request" && event.scope === "work_contract")
                        client.respondApproval({ requestID: event.id, decision: "once" });
                });
                return [4 /*yield*/, client.sessionAttach("ses_plan_contract_ph")];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/ph-plan.md",
                        content: "# Placeholder plan\n",
                        title: "Placeholder plan",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/ph-plan.md",
                        title: "Placeholder plan",
                    })];
            case 4:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(marked.planID)];
            case 5:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("propose the contract")];
            case 6:
                _b.sent();
                (0, bun_test_1.expect)(settled).toBe(true);
                // The placeholder draft never reached the journal; the re-proposal landed
                // and was accepted.
                (0, bun_test_1.expect)(events.filter(function (event) { return event.type === "work_contract.drafted"; })).toHaveLength(1);
                (0, bun_test_1.expect)(events.filter(function (event) { return event.type === "work_contract.accepted"; })).toHaveLength(1);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 7:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("plan_propose returns the rejection feedback without landing a contract", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, planID, client, marked;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-contract-reject")];
            case 1:
                root = _b.sent();
                events = [];
                planID = "";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_contract_reject",
                    permissionMode: "ask",
                    provider: proposeProvider(function () { return ({
                        planID: planID,
                        scope: ["packages/framework/runtime/src"],
                    }); }, function (result) {
                        (0, bun_test_1.expect)(result).toContain('"accepted":false');
                        (0, bun_test_1.expect)(result).toContain("rejected");
                        return [{ type: "content", text: "re-propose later" }];
                    }),
                });
                client.start(function (event) {
                    events.push(event);
                    if (event.type === "approval.request" && event.scope === "work_contract")
                        client.respondApproval({
                            requestID: event.id,
                            decision: "reject",
                            feedback: "add the constraints",
                        });
                });
                return [4 /*yield*/, client.sessionAttach("ses_plan_contract_reject")];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/reject-plan.md",
                        content: "# Reject plan\n",
                        title: "Reject plan",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/reject-plan.md",
                        title: "Reject plan",
                    })];
            case 4:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(marked.planID)];
            case 5:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("propose the contract")];
            case 6:
                _b.sent();
                // The draft stays for re-proposal; nothing is accepted.
                (0, bun_test_1.expect)(events.filter(function (event) { return event.type === "work_contract.drafted"; })).toHaveLength(1);
                (0, bun_test_1.expect)(events.filter(function (event) { return event.type === "work_contract.accepted"; })).toHaveLength(0);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 7:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("A1 E2E: a plan edit marks the draft stale in work_contract_read (re-propose required)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, readResults, planID, toolCalls, client, marked, before, after;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-contract-stale")];
            case 1:
                root = _b.sent();
                events = [];
                readResults = [];
                planID = "";
                toolCalls = 0;
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_contract_stale",
                    permissionMode: "ask",
                    provider: {
                        provider: "plan-contract-stale",
                        model: "plan-contract-stale-model",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_3() {
                                var messages, lastMessage, readResult;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            messages = request.messages;
                                            lastMessage = messages.at(-1);
                                            if (!((lastMessage === null || lastMessage === void 0 ? void 0 : lastMessage.role) === "tool")) return [3 /*break*/, 6];
                                            readResult = messages
                                                .filter(function (message) {
                                                var _a;
                                                return message.role === "tool" &&
                                                    String((_a = message.toolCallID) !== null && _a !== void 0 ? _a : "").startsWith("call_read");
                                            })
                                                .at(-1);
                                            if (readResult)
                                                readResults.push(String((_a = readResult.content) !== null && _a !== void 0 ? _a : ""));
                                            return [4 /*yield*/, __await({ type: "content", text: "done" })];
                                        case 1: return [4 /*yield*/, _b.sent()];
                                        case 2:
                                            _b.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _b.sent()];
                                        case 4:
                                            _b.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 5: return [2 /*return*/, _b.sent()];
                                        case 6:
                                            // First tool call proposes (the gate is rejected, so a draft stays);
                                            // later tool calls read the contract.
                                            toolCalls += 1;
                                            if (!(toolCalls === 1)) return [3 /*break*/, 9];
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "call_propose",
                                                            name: "plan_propose",
                                                            arguments: JSON.stringify({ planID: planID, scope: ["packages/a"] }),
                                                        },
                                                    ],
                                                })];
                                        case 7: return [4 /*yield*/, _b.sent()];
                                        case 8:
                                            _b.sent();
                                            return [3 /*break*/, 12];
                                        case 9: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_read",
                                                        name: "work_contract_read",
                                                        arguments: JSON.stringify({ planID: planID }),
                                                    },
                                                ],
                                            })];
                                        case 10: return [4 /*yield*/, _b.sent()];
                                        case 11:
                                            _b.sent();
                                            _b.label = 12;
                                        case 12: return [4 /*yield*/, __await({ type: "done" })];
                                        case 13: return [4 /*yield*/, _b.sent()];
                                        case 14:
                                            _b.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) {
                    events.push(event);
                    if (event.type === "approval.request" && event.scope === "work_contract")
                        client.respondApproval({
                            requestID: event.id,
                            decision: "reject",
                            feedback: "not yet",
                        });
                });
                return [4 /*yield*/, client.sessionAttach("ses_plan_contract_stale")];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/stale-plan.md",
                        content: "# Stale plan\n",
                        title: "Stale plan",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/stale-plan.md",
                        title: "Stale plan",
                    })];
            case 4:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(marked.planID)];
            case 5:
                _b.sent();
                // 1. Propose (rejected) -> a draft bound to plan revision 1.
                return [4 /*yield*/, client.submitAndWait("propose the contract")];
            case 6:
                // 1. Propose (rejected) -> a draft bound to plan revision 1.
                _b.sent();
                // 2. Read: the draft is current for its revision (not stale).
                return [4 /*yield*/, client.submitAndWait("read the contract")];
            case 7:
                // 2. Read: the draft is current for its revision (not stale).
                _b.sent();
                (0, bun_test_1.expect)(readResults).toHaveLength(1);
                before = JSON.parse(readResults[0]);
                (0, bun_test_1.expect)(before).toMatchObject({ planID: planID, status: "draft", version: 1 });
                (0, bun_test_1.expect)(before.stale).toBeUndefined();
                // 3. Edit the plan document -> revision bumps, plan.doc.updated published.
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/stale-plan.md",
                        content: "# Stale plan\n\n- a new step\n",
                        title: "Stale plan",
                    })];
            case 8:
                // 3. Edit the plan document -> revision bumps, plan.doc.updated published.
                _b.sent();
                // 4. Read again: the draft extracted from revision 1 is now stale.
                return [4 /*yield*/, client.submitAndWait("read the contract again")];
            case 9:
                // 4. Read again: the draft extracted from revision 1 is now stale.
                _b.sent();
                (0, bun_test_1.expect)(readResults).toHaveLength(2);
                after = JSON.parse(readResults[1]);
                (0, bun_test_1.expect)(after).toMatchObject({
                    planID: planID,
                    status: "draft",
                    version: 1,
                    stale: true,
                });
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 10:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("work_contract_read reports none for a known plan and an error for an unknown planID", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, results, planID, client, marked;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-contract-read")];
            case 1:
                root = _b.sent();
                results = [];
                planID = "";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_contract_read",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_4() {
                                var toolResults;
                                var _a, _b;
                                return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0:
                                            toolResults = request.messages.filter(function (message) {
                                                var _a;
                                                return message.role === "tool" &&
                                                    String((_a = message.toolCallID) !== null && _a !== void 0 ? _a : "").startsWith("call_read");
                                            });
                                            if (!(toolResults.length === 0)) return [3 /*break*/, 6];
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "call_read",
                                                            name: "work_contract_read",
                                                            arguments: JSON.stringify({ planID: planID }),
                                                        },
                                                    ],
                                                })];
                                        case 1: return [4 /*yield*/, _c.sent()];
                                        case 2:
                                            _c.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _c.sent()];
                                        case 4:
                                            _c.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 5: return [2 /*return*/, _c.sent()];
                                        case 6:
                                            results.push(String((_b = (_a = toolResults.at(-1)) === null || _a === void 0 ? void 0 : _a.content) !== null && _b !== void 0 ? _b : ""));
                                            if (!(toolResults.length === 1)) return [3 /*break*/, 12];
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "call_read",
                                                            name: "work_contract_read",
                                                            arguments: JSON.stringify({ planID: "plan:missing" }),
                                                        },
                                                    ],
                                                })];
                                        case 7: 
                                        // An unknown planID is an error, distinct from a real "none".
                                        return [4 /*yield*/, _c.sent()];
                                        case 8:
                                            // An unknown planID is an error, distinct from a real "none".
                                            _c.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 9: return [4 /*yield*/, _c.sent()];
                                        case 10:
                                            _c.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 11: return [2 /*return*/, _c.sent()];
                                        case 12: return [4 /*yield*/, __await({ type: "content", text: "read done" })];
                                        case 13: return [4 /*yield*/, _c.sent()];
                                        case 14:
                                            _c.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 15: return [4 /*yield*/, _c.sent()];
                                        case 16:
                                            _c.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach("ses_plan_contract_read")];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/read-none.md",
                        content: "# Read none\n",
                        title: "Read none",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/read-none.md",
                        title: "Read none",
                    })];
            case 4:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.submitAndWait("check the contract")];
            case 5:
                _b.sent();
                // A known plan with no proposal is a legitimate "none".
                (0, bun_test_1.expect)(results[0]).toContain('"status":"none"');
                // An unknown planID is an error string, not "none" (EI §3.9).
                (0, bun_test_1.expect)(results[1]).toContain("unknown planID");
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 6:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("the handoff refuses without an accepted contract (Navi mailbox_send path)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, streamCalls, planID, client, marked, toolUses, handoffResult;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-contract-handoff")];
            case 1:
                root = _c.sent();
                events = [];
                streamCalls = 0;
                planID = "";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_contract_handoff",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_5() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            streamCalls += 1;
                                            if (!(streamCalls === 1)) return [3 /*break*/, 4];
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "call_handoff",
                                                            name: "mailbox_send",
                                                            arguments: JSON.stringify({
                                                                intent: "next_plan_handoff",
                                                                text: "plan ready",
                                                                relatedPlanID: planID,
                                                            }),
                                                        },
                                                    ],
                                                })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 3: return [2 /*return*/, _a.sent()];
                                        case 4: return [4 /*yield*/, __await({ type: "content", text: "cannot hand off" })];
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
                return [4 /*yield*/, client.sessionAttach("ses_plan_contract_handoff")];
            case 2:
                _c.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/handoff-plan.md",
                        content: "# Handoff plan\n",
                        title: "Handoff plan",
                    })];
            case 3:
                _c.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/handoff-plan.md",
                        title: "Handoff plan",
                    })];
            case 4:
                marked = _c.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(marked.planID)];
            case 5:
                _c.sent();
                // Navi tries to hand off the plan without any accepted contract.
                return [4 /*yield*/, client.naviChat.submit({ text: "hand off the plan" })];
            case 6:
                // Navi tries to hand off the plan without any accepted contract.
                _c.sent();
                toolUses = events.filter(function (event) {
                    return event.type === "navi.chat.tool.used" && event.toolName === "mailbox_send";
                });
                (0, bun_test_1.expect)(toolUses).toHaveLength(1);
                handoffResult = String((_a = toolUses[0].result) !== null && _a !== void 0 ? _a : "");
                (0, bun_test_1.expect)(handoffResult).toContain("no accepted work contract");
                (0, bun_test_1.expect)(handoffResult).toContain("plan_propose");
                // Nothing was queued.
                (0, bun_test_1.expect)(events.filter(function (event) {
                    return event.type === "mailbox.queued" && event.intent === "next_plan_handoff";
                })).toHaveLength(0);
                return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 7:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("plan_doc_mark records createdBy by source", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, client, marked, list, record;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-contract-createdby")];
            case 1:
                root = _b.sent();
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_contract_createdby",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_6() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "content", text: "ok" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach("ses_plan_contract_createdby")];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/createdby.md",
                        content: "# CreatedBy plan\n",
                        title: "CreatedBy plan",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/createdby.md",
                        title: "CreatedBy plan",
                        createdBy: "main_agent",
                    })];
            case 4:
                marked = _b.sent();
                return [4 /*yield*/, client.planDocList()];
            case 5:
                list = _b.sent();
                record = list.find(function (plan) { return plan.planID === marked.planID; });
                (0, bun_test_1.expect)(record === null || record === void 0 ? void 0 : record.createdBy).toBe("main_agent");
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 6:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("work_graph_query resolves a plan path and paginates the graph", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, results, streamCalls, client, first, second;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-contract-graph")];
            case 1:
                root = _b.sent();
                results = [];
                streamCalls = 0;
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_contract_graph",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_7() {
                                var graphToolResult;
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            streamCalls += 1;
                                            graphToolResult = request.messages
                                                .filter(function (message) {
                                                var _a;
                                                return message.role === "tool" &&
                                                    String((_a = message.toolCallID) !== null && _a !== void 0 ? _a : "").startsWith("call_graph");
                                            })
                                                .at(-1);
                                            if (!graphToolResult) return [3 /*break*/, 12];
                                            results.push(String((_a = graphToolResult.content) !== null && _a !== void 0 ? _a : ""));
                                            if (!(streamCalls <= 2)) return [3 /*break*/, 6];
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "call_graph",
                                                            name: "work_graph_query",
                                                            arguments: JSON.stringify({
                                                                path: "plans/graph-plan.md",
                                                                limit: 1,
                                                            }),
                                                        },
                                                    ],
                                                })];
                                        case 1: 
                                        // Query by plan document path — resolves to the planID.
                                        return [4 /*yield*/, _b.sent()];
                                        case 2:
                                            // Query by plan document path — resolves to the planID.
                                            _b.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _b.sent()];
                                        case 4:
                                            _b.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 5: return [2 /*return*/, _b.sent()];
                                        case 6: return [4 /*yield*/, __await({ type: "content", text: "graph queried" })];
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
                                                        arguments: JSON.stringify({ limit: 1 }),
                                                    },
                                                ],
                                            })];
                                        case 13: 
                                        // First: query the whole graph (no filter) to establish the cursor.
                                        return [4 /*yield*/, _b.sent()];
                                        case 14:
                                            // First: query the whole graph (no filter) to establish the cursor.
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
                return [4 /*yield*/, client.sessionAttach("ses_plan_contract_graph")];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/graph-plan.md",
                        content: "# Graph plan\n",
                        title: "Graph plan",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/graph-plan.md",
                        title: "Graph plan",
                    })];
            case 4:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("query the graph")];
            case 5:
                _b.sent();
                (0, bun_test_1.expect)(results.length).toBeGreaterThanOrEqual(2);
                first = JSON.parse(results[0]);
                second = JSON.parse(results[1]);
                // The unfiltered query is well-formed and paginates.
                (0, bun_test_1.expect)(Array.isArray(first.nodes)).toBe(true);
                // The path query resolves to the marked plan's planID. No node references
                // the planID yet (B7 adds plan-linked node provenance), so the filter
                // honestly returns zero matches with the planID echoed.
                (0, bun_test_1.expect)(second.planID.startsWith("plan_graph-plan")).toBe(true);
                (0, bun_test_1.expect)(second.total).toBe(0);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 6:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("record_validation runs a command and writes evidence", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, git, committed, gitHead, events, client, evidence;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-contract-validation")];
            case 1:
                root = _b.sent();
                git = function (args) {
                    return Bun.spawnSync(__spreadArray(["git"], args, true), {
                        cwd: root,
                        stdout: "pipe",
                        stderr: "pipe",
                    });
                };
                git(["init", "-q"]);
                git(["config", "user.email", "test@example.com"]);
                git(["config", "user.name", "test"]);
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "refs-seed.txt"), "seed")];
            case 2:
                _b.sent();
                git(["add", "refs-seed.txt"]);
                committed = git(["commit", "-q", "-m", "seed"]).success;
                gitHead = committed
                    ? git(["rev-parse", "HEAD"]).stdout.toString().trim()
                    : undefined;
                events = [];
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_contract_validation",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_8() {
                                var toolResult;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            toolResult = request.messages.find(function (message) {
                                                return message.role === "tool" && message.toolCallID === "call_validate";
                                            });
                                            if (!toolResult) return [3 /*break*/, 6];
                                            return [4 /*yield*/, __await({ type: "content", text: "validated" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 5: return [2 /*return*/, _a.sent()];
                                        case 6: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_validate",
                                                        name: "record_validation",
                                                        arguments: JSON.stringify({
                                                            taskID: "plan:1:s1",
                                                            objective: "the runtime package typechecks",
                                                            command: "true",
                                                        }),
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
                return [4 /*yield*/, client.sessionAttach("ses_plan_contract_validation")];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("validate")];
            case 4:
                _b.sent();
                evidence = events.filter(function (event) { return event.type === "evidence.recorded"; });
                (0, bun_test_1.expect)(evidence).toHaveLength(1);
                (0, bun_test_1.expect)(evidence[0]).toMatchObject({
                    type: "evidence.recorded",
                    taskID: "plan:1:s1",
                    objective: "the runtime package typechecks",
                    status: "validated",
                });
                if (gitHead !== undefined) {
                    (0, bun_test_1.expect)(evidence[0]).toMatchObject({ commit: gitHead });
                }
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 5:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("record_completion and record_decision write durable journal facts", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, completion;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-contract-records")];
            case 1:
                root = _b.sent();
                events = [];
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_contract_records",
                    permissionMode: "auto",
                    // The completion trigger wakes Nia in parallel; per-agent cursors keep
                    // that wake from consuming the Main Agent's next scripted step.
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [
                            {
                                tool: {
                                    name: "record_completion",
                                    arguments: {
                                        taskID: "plan:1:s1",
                                        objective: "split the system prompt",
                                        changeSummary: "static persona and dynamic runtime context",
                                    },
                                },
                            },
                            {
                                tool: {
                                    name: "record_decision",
                                    arguments: {
                                        decision: "runtime context is appended, not injected",
                                        rationale: ["keeps the cacheable prefix stable"],
                                    },
                                },
                            },
                            { text: "recorded" },
                        ],
                        nia: [{ text: "audit wake observed" }],
                        navi: [{ text: "standby" }],
                    }),
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.sessionAttach("ses_plan_contract_records")];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("record it")];
            case 3:
                _b.sent();
                (0, bun_test_1.expect)(events.filter(function (event) { return event.type === "completion.recorded"; })).toHaveLength(1);
                (0, bun_test_1.expect)(events.filter(function (event) { return event.type === "decision.recorded"; })).toHaveLength(1);
                completion = events.find(function (event) { return event.type === "completion.recorded"; });
                (0, bun_test_1.expect)(completion).toMatchObject({
                    type: "completion.recorded",
                    taskID: "plan:1:s1",
                    changeSummary: "static persona and dynamic runtime context",
                });
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 4:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("audit_report writes an evidence record for every round (EI §8.1)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, planID, client, marked, evidence, auditEvidence;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-contract-audit-evidence")];
            case 1:
                root = _b.sent();
                events = [];
                planID = "";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_contract_audit",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_9() {
                                var toolResult;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            toolResult = 
                                            // The Nia turn's messages carry the audit_report tool result.
                                            arguments[0].messages.find(function (message) {
                                                return message.role === "tool" && message.toolCallID === "call_audit";
                                            });
                                            if (!toolResult) return [3 /*break*/, 6];
                                            return [4 /*yield*/, __await({ type: "content", text: "audit reported" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 5: return [2 /*return*/, _a.sent()];
                                        case 6: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_audit",
                                                        name: "audit_report",
                                                        arguments: JSON.stringify({ planID: planID, verdict: "passed" }),
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
                return [4 /*yield*/, client.sessionAttach("ses_plan_contract_audit")];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/audit-plan.md",
                        content: "# Audit plan\n",
                        title: "Audit plan",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/audit-plan.md",
                        title: "Audit plan",
                    })];
            case 4:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(marked.planID)];
            case 5:
                _b.sent();
                return [4 /*yield*/, client.niaChat.submit({ text: "audit the plan" })];
            case 6:
                _b.sent();
                evidence = events.filter(function (event) { return event.type === "evidence.recorded"; });
                (0, bun_test_1.expect)(evidence).toHaveLength(1);
                (0, bun_test_1.expect)(evidence[0]).toMatchObject({
                    type: "evidence.recorded",
                    taskID: planID,
                    status: "validated",
                });
                auditEvidence = evidence[0];
                (0, bun_test_1.expect)(auditEvidence.objective).toContain("Nia audit round 1");
                (0, bun_test_1.expect)(auditEvidence.validations[0]).toMatchObject({ result: "passed" });
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 7:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("a config reload emits a context.instructions notice with a monotonic revision", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, notices, second, contractNotices;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-contract-reload")];
            case 1:
                root = _b.sent();
                events = [];
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_contract_reload",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function () {
                            return __asyncGenerator(this, arguments, function stream_10() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, __await({ type: "content", text: "ok" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.sessionAttach("ses_plan_contract_reload")];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.reloadConfig()];
            case 3:
                _b.sent();
                notices = events.filter(function (event) { return event.type === "context.instructions"; });
                (0, bun_test_1.expect)(notices).toHaveLength(1);
                (0, bun_test_1.expect)(notices[0]).toMatchObject({
                    type: "context.instructions",
                    kind: "config_reload",
                    revision: 1,
                });
                // A second reload raises the revision; history is never mutated.
                return [4 /*yield*/, client.reloadConfig()];
            case 4:
                // A second reload raises the revision; history is never mutated.
                _b.sent();
                second = events.filter(function (event) { return event.type === "context.instructions"; });
                (0, bun_test_1.expect)(second).toHaveLength(2);
                (0, bun_test_1.expect)(second[1]).toMatchObject({ revision: 2 });
                // The projection reports the latest revision per kind.
                (0, bun_test_1.expect)((0, session_1.projectedRuntimeNotices)(second).map(function (notice) { return ({
                    kind: notice.kind,
                    revision: notice.revision,
                }); })).toEqual([{ kind: "config_reload", revision: 2 }]);
                return [4 /*yield*/, client.notices()];
            case 5:
                contractNotices = _b.sent();
                (0, bun_test_1.expect)(contractNotices).toEqual([
                    {
                        noticeID: second[1].id,
                        kind: "config_reload",
                        revision: 2,
                        at: second[1].at,
                        summary: second[1].summary,
                    },
                ]);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 6:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("the project documents inject as a user-tier runtime context block (ADR D2 / EI §8.5)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, requests, client, seen, system;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-contract-project-docs")];
            case 1:
                root = _e.sent();
                requests = [];
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_contract_docs",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_11() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            requests.push(request);
                                            return [4 /*yield*/, __await({ type: "content", text: "ok" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach("ses_plan_contract_docs")];
            case 2:
                _e.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "AGENTS.md"), "# Agents\n\n- run bun test before finishing\n")];
            case 3:
                _e.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 4:
                _e.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "constitution.md"), "# Constitution\n\n- never commit secrets\n")];
            case 5:
                _e.sent();
                return [4 /*yield*/, client.submitAndWait("follow the project instructions")];
            case 6:
                _e.sent();
                seen = ((_b = (_a = requests[0]) === null || _a === void 0 ? void 0 : _a.messages) !== null && _b !== void 0 ? _b : [])
                    .map(function (message) { return message.content; })
                    .join("\n");
                // The project documents arrive as a user-tier runtime context block, never
                // in the static system prompt.
                (0, bun_test_1.expect)(seen).toContain('<runtime_context source="project" authority="user"');
                (0, bun_test_1.expect)(seen).toContain("run bun test before finishing");
                (0, bun_test_1.expect)(seen).toContain("never commit secrets");
                system = (_c = requests[0]) === null || _c === void 0 ? void 0 : _c.messages.find(function (message) { return message.role === "system"; });
                // The document正文 never enters the static system prompt (the authority
                // model only names AGENTS.md as a tier, it does not carry its content).
                (0, bun_test_1.expect)(system === null || system === void 0 ? void 0 : system.content).not.toContain("run bun test before finishing");
                (0, bun_test_1.expect)(system === null || system === void 0 ? void 0 : system.content).not.toContain("never commit secrets");
                return [4 /*yield*/, ((_d = client.dispose) === null || _d === void 0 ? void 0 : _d.call(client))];
            case 7:
                _e.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("a project document edit changes the block hash and re-injects (EI §8.5)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, requests, client, firstHash, secondSeen, secondHash;
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    return __generator(this, function (_k) {
        switch (_k.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-contract-doc-change")];
            case 1:
                root = _k.sent();
                requests = [];
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_contract_doc_change",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_12() {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            requests.push(request);
                                            return [4 /*yield*/, __await({ type: "content", text: "ok" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    },
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach("ses_plan_contract_doc_change")];
            case 2:
                _k.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "AGENTS.md"), "- original rule\n")];
            case 3:
                _k.sent();
                return [4 /*yield*/, client.submitAndWait("first")];
            case 4:
                _k.sent();
                firstHash = (_c = /hash="([^"]+)"/u.exec(((_b = (_a = requests[0]) === null || _a === void 0 ? void 0 : _a.messages) !== null && _b !== void 0 ? _b : []).map(function (message) { return message.content; }).join("\n"))) === null || _c === void 0 ? void 0 : _c[1];
                (0, bun_test_1.expect)(firstHash).toBeTruthy();
                (0, bun_test_1.expect)(((_e = (_d = requests[0]) === null || _d === void 0 ? void 0 : _d.messages) !== null && _e !== void 0 ? _e : []).map(function (m) { return m.content; }).join("\n")).toContain("original rule");
                // The document edit is detected by hash; the new block carries the new
                // content and a new hash — appended, never mutating the earlier message.
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "AGENTS.md"), "- updated rule\n")];
            case 5:
                // The document edit is detected by hash; the new block carries the new
                // content and a new hash — appended, never mutating the earlier message.
                _k.sent();
                return [4 /*yield*/, client.submitAndWait("second")];
            case 6:
                _k.sent();
                secondSeen = ((_g = (_f = requests[1]) === null || _f === void 0 ? void 0 : _f.messages) !== null && _g !== void 0 ? _g : [])
                    .map(function (message) { return message.content; })
                    .join("\n");
                (0, bun_test_1.expect)(secondSeen).toContain("updated rule");
                secondHash = (_h = /hash="([^"]+)"/u.exec(secondSeen)) === null || _h === void 0 ? void 0 : _h[1];
                (0, bun_test_1.expect)(secondHash).not.toBe(firstHash);
                return [4 /*yield*/, ((_j = client.dispose) === null || _j === void 0 ? void 0 : _j.call(client))];
            case 7:
                _k.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("constitution_propose_rule validates and gates on the user (EI §3.8 P-1.c)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, streamCalls, client, added;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-contract-rule-propose")];
            case 1:
                root = _c.sent();
                events = [];
                streamCalls = 0;
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_contract_rule",
                    permissionMode: "ask",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_13() {
                                var toolResult;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            streamCalls += 1;
                                            toolResult = request.messages
                                                .filter(function (message) {
                                                var _a;
                                                return message.role === "tool" &&
                                                    String((_a = message.toolCallID) !== null && _a !== void 0 ? _a : "").startsWith("call_rule");
                                            })
                                                .at(-1);
                                            if (!toolResult) return [3 /*break*/, 12];
                                            if (!(streamCalls === 2)) return [3 /*break*/, 6];
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "call_rule",
                                                            name: "constitution_propose_rule",
                                                            arguments: JSON.stringify({
                                                                statement: "never force push",
                                                                enforcement: "deny",
                                                                appliesTo: {
                                                                    tools: ["run_shell"],
                                                                    commandPattern: "git push.*--force",
                                                                },
                                                                scope: "project",
                                                            }),
                                                        },
                                                    ],
                                                })];
                                        case 1: 
                                        // The first (unanchored deny) proposal was refused before the
                                        // gate; re-propose with a structured anchor.
                                        return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            // The first (unanchored deny) proposal was refused before the
                                            // gate; re-propose with a structured anchor.
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 5: return [2 /*return*/, _a.sent()];
                                        case 6: return [4 /*yield*/, __await({ type: "content", text: "rule proposed" })];
                                        case 7: return [4 /*yield*/, _a.sent()];
                                        case 8:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 9: return [4 /*yield*/, _a.sent()];
                                        case 10:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 11: return [2 /*return*/, _a.sent()];
                                        case 12: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_rule",
                                                        name: "constitution_propose_rule",
                                                        arguments: JSON.stringify({
                                                            statement: "never force push",
                                                            enforcement: "deny",
                                                        }),
                                                    },
                                                ],
                                            })];
                                        case 13: return [4 /*yield*/, _a.sent()];
                                        case 14:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 15: return [4 /*yield*/, _a.sent()];
                                        case 16:
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
                    if (event.type === "approval.request" &&
                        event.scope === "constitution_rule")
                        client.respondApproval({ requestID: event.id, decision: "once" });
                });
                return [4 /*yield*/, client.sessionAttach("ses_plan_contract_rule")];
            case 2:
                _c.sent();
                return [4 /*yield*/, client.submitAndWait("propose a rule")];
            case 3:
                _c.sent();
                added = events.filter(function (event) {
                    return event.type === "constitution.rule_added" &&
                        event.source === "agent_proposed";
                });
                // Only the approved proposal lands; the seeded rules are not agent-proposed.
                (0, bun_test_1.expect)(added).toHaveLength(1);
                (0, bun_test_1.expect)(added[0]).toMatchObject({
                    type: "constitution.rule_added",
                    source: "agent_proposed",
                    enforcement: "deny",
                    scope: "project",
                });
                (0, bun_test_1.expect)((_a = added[0].appliesTo) === null || _a === void 0 ? void 0 : _a.commandPattern).toBe("git push.*--force");
                return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 4:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("the read surfaces paginate with a cursor (B6)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, client, page, empty, all;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-contract-pagination")];
            case 1:
                root = _e.sent();
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_plan_contract_pagination",
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_14() {
                                var toolResult;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            toolResult = request.messages.find(function (message) {
                                                return message.role === "tool" && message.toolCallID === "call_record";
                                            });
                                            if (!toolResult) return [3 /*break*/, 6];
                                            return [4 /*yield*/, __await({ type: "content", text: "recorded" })];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 5: return [2 /*return*/, _a.sent()];
                                        case 6: return [4 /*yield*/, __await({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_record",
                                                        name: "record_completion",
                                                        arguments: JSON.stringify({
                                                            taskID: "plan:1:s1",
                                                            objective: "first slice",
                                                            changeSummary: "done",
                                                        }),
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
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach("ses_plan_contract_pagination")];
            case 2:
                _e.sent();
                return [4 /*yield*/, client.submitAndWait("record a completion")];
            case 3:
                _e.sent();
                return [4 /*yield*/, ((_a = client.completions) === null || _a === void 0 ? void 0 : _a.call(client, { limit: 1 }))];
            case 4:
                page = _e.sent();
                (0, bun_test_1.expect)(page).toMatchObject({ returned: 1, total: 1, truncated: false });
                (0, bun_test_1.expect)(page === null || page === void 0 ? void 0 : page.items).toHaveLength(1);
                return [4 /*yield*/, ((_b = client.completions) === null || _b === void 0 ? void 0 : _b.call(client, { limit: 1, cursor: "5" }))];
            case 5:
                empty = _e.sent();
                (0, bun_test_1.expect)(empty).toMatchObject({ returned: 0, total: 1, truncated: false });
                (0, bun_test_1.expect)(empty === null || empty === void 0 ? void 0 : empty.items).toEqual([]);
                return [4 /*yield*/, ((_c = client.completions) === null || _c === void 0 ? void 0 : _c.call(client))];
            case 6:
                all = _e.sent();
                (0, bun_test_1.expect)(all).toMatchObject({ returned: 1, total: 1, truncated: false });
                (0, bun_test_1.expect)(all === null || all === void 0 ? void 0 : all.items).toHaveLength(1);
                return [4 /*yield*/, ((_d = client.dispose) === null || _d === void 0 ? void 0 : _d.call(client))];
            case 7:
                _e.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
