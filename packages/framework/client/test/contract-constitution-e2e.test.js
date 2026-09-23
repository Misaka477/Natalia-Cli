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
var session_1 = require("@anthelia/session");
var src_1 = require("../src");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
/**
 * EI Open Question "契约 handoff 撞 constitution" — decided: 拦在 propose /
 * detour_declare (事前). A scope entry naming a path a deny constitution rule
 * covers is refused BEFORE the user gate and before the journal draft, so the
 * model re-proposes inside the existing feedback loop and the user never sees
 * a contract that cannot be executed.
 */
(0, bun_test_1.test)("plan_propose refuses a scope naming a deny-covered path before the gate", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sessionID, events, planID, approvals, client, created, ruleID, marked, drafted, accepted;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("contract-constitution-propose")];
            case 1:
                root = _b.sent();
                sessionID = "ses_contract_constitution_propose";
                events = [];
                planID = "";
                approvals = 0;
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    permissionMode: "ask",
                    provider: {
                        provider: "plan-propose-constitution",
                        model: "plan-propose-constitution-model",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_1() {
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
                                            return [4 /*yield*/, __await({
                                                    type: "tool_call",
                                                    calls: [
                                                        {
                                                            id: "call_propose",
                                                            name: "plan_propose",
                                                            arguments: JSON.stringify({
                                                                planID: planID,
                                                                scope: ["rotate the secrets/key.pem"],
                                                            }),
                                                        },
                                                    ],
                                                })];
                                        case 1: 
                                        // The bad proposal names secrets/key.pem, which the deny rule covers.
                                        return [4 /*yield*/, _b.sent()];
                                        case 2:
                                            // The bad proposal names secrets/key.pem, which the deny rule covers.
                                            _b.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _b.sent()];
                                        case 4:
                                            _b.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 5: return [2 /*return*/, _b.sent()];
                                        case 6:
                                            result = String((_a = proposeResult.content) !== null && _a !== void 0 ? _a : "");
                                            if (!result.includes('"accepted":false')) return [3 /*break*/, 12];
                                            // The refusal names the rule and the path; re-propose within it.
                                            (0, bun_test_1.expect)(result).toContain(ruleID);
                                            (0, bun_test_1.expect)(result).toContain("secrets/key.pem");
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
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 9: return [4 /*yield*/, _b.sent()];
                                        case 10:
                                            _b.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 11: return [2 /*return*/, _b.sent()];
                                        case 12: return [4 /*yield*/, __await({ type: "content", text: "contract accepted" })];
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
                    if (event.type === "approval.request" && event.scope === "work_contract") {
                        approvals += 1;
                        client.respondApproval({ requestID: event.id, decision: "once" });
                    }
                });
                return [4 /*yield*/, client.sessionAttach(sessionID)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.createConstitutionRule({
                        statement: "never touch the secrets directory",
                        enforcement: "deny",
                        appliesTo: { paths: ["secrets/**"] },
                    }, sessionID)];
            case 3:
                created = _b.sent();
                ruleID = created.ruleID;
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/constitution-plan.md",
                        content: "# Constitution plan\n\n- one concrete step\n",
                        title: "Constitution plan",
                    })];
            case 4:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/constitution-plan.md",
                        title: "Constitution plan",
                    })];
            case 5:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(planID)];
            case 6:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("propose the contract for the plan")];
            case 7:
                _b.sent();
                // The gate fired exactly once — for the clean re-proposal only.
                (0, bun_test_1.expect)(approvals).toBe(1);
                drafted = events.filter(function (event) { return event.type === "work_contract.drafted"; });
                (0, bun_test_1.expect)(drafted).toHaveLength(1);
                (0, bun_test_1.expect)(drafted[0]).toMatchObject({
                    type: "work_contract.drafted",
                    planID: planID,
                    scope: ["packages/a"],
                });
                accepted = events.filter(function (event) { return event.type === "work_contract.accepted"; });
                (0, bun_test_1.expect)(accepted).toHaveLength(1);
                (0, bun_test_1.expect)((0, session_1.projectedWorkContracts)(events).find(function (contract) { return contract.planID === planID; })).toMatchObject({ status: "current", scope: ["packages/a"] });
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 8:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("detour_declare refuses a scopeDelta naming a deny-covered path before the gate", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sessionID, events, planID, client, created, ruleID, marked, requested;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("contract-constitution-detour")];
            case 1:
                root = _b.sent();
                sessionID = "ses_contract_constitution_detour";
                events = [];
                planID = "";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    permissionMode: "ask",
                    provider: {
                        provider: "plan-detour-constitution",
                        model: "plan-detour-constitution-model",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_2() {
                                var toolResults, call, latest, latestContent;
                                var _a, _b;
                                return __generator(this, function (_c) {
                                    switch (_c.label) {
                                        case 0:
                                            toolResults = request.messages.filter(function (message) { return message.role === "tool"; });
                                            call = function (name, args, id) { return ({
                                                type: "tool_call",
                                                calls: [{ id: id, name: name, arguments: JSON.stringify(args) }],
                                            }); };
                                            latest = toolResults.at(-1);
                                            latestContent = String((_a = latest === null || latest === void 0 ? void 0 : latest.content) !== null && _a !== void 0 ? _a : "");
                                            if (!!toolResults.length) return [3 /*break*/, 6];
                                            return [4 /*yield*/, __await(call("plan_propose", { planID: planID, scope: ["packages/a"] }, "call_propose"))];
                                        case 1: 
                                        // Clean contract first (the detour needs an accepted contract).
                                        return [4 /*yield*/, _c.sent()];
                                        case 2:
                                            // Clean contract first (the detour needs an accepted contract).
                                            _c.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _c.sent()];
                                        case 4:
                                            _c.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 5: return [2 /*return*/, _c.sent()];
                                        case 6:
                                            if (!(String((_b = latest === null || latest === void 0 ? void 0 : latest.toolCallID) !== null && _b !== void 0 ? _b : "").startsWith("call_propose") &&
                                                latestContent.includes('"accepted":true'))) return [3 /*break*/, 12];
                                            return [4 /*yield*/, __await(call("detour_declare", {
                                                    planID: planID,
                                                    currentVersion: 1,
                                                    reason: "the fix also needs the credentials file",
                                                    scopeDelta: ["rotate .env"],
                                                }, "call_detour"))];
                                        case 7: 
                                        // The bad detour names .env, which the deny rule covers.
                                        return [4 /*yield*/, _c.sent()];
                                        case 8:
                                            // The bad detour names .env, which the deny rule covers.
                                            _c.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 9: return [4 /*yield*/, _c.sent()];
                                        case 10:
                                            _c.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 11: return [2 /*return*/, _c.sent()];
                                        case 12:
                                            if (!latestContent.includes('"accepted":false')) return [3 /*break*/, 18];
                                            // The refusal names the rule and the path; re-declare within it.
                                            (0, bun_test_1.expect)(latestContent).toContain(ruleID);
                                            (0, bun_test_1.expect)(latestContent).toContain(".env");
                                            return [4 /*yield*/, __await(call("detour_declare", {
                                                    planID: planID,
                                                    currentVersion: 1,
                                                    reason: "the fix also needs the shared util package",
                                                    scopeDelta: ["packages/b"],
                                                }, "call_detour"))];
                                        case 13: return [4 /*yield*/, _c.sent()];
                                        case 14:
                                            _c.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 15: return [4 /*yield*/, _c.sent()];
                                        case 16:
                                            _c.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 17: return [2 /*return*/, _c.sent()];
                                        case 18: return [4 /*yield*/, __await({ type: "content", text: "detour absorbed" })];
                                        case 19: return [4 /*yield*/, _c.sent()];
                                        case 20:
                                            _c.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 21: return [4 /*yield*/, _c.sent()];
                                        case 22:
                                            _c.sent();
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
                        (event.scope === "work_contract" || event.scope === "detour"))
                        client.respondApproval({ requestID: event.id, decision: "once" });
                });
                return [4 /*yield*/, client.sessionAttach(sessionID)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.createConstitutionRule({
                        statement: "never touch the environment file",
                        enforcement: "deny",
                        appliesTo: { paths: ["**/.env"] },
                    }, sessionID)];
            case 3:
                created = _b.sent();
                ruleID = created.ruleID;
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/constitution-detour.md",
                        content: "# Constitution detour\n\n- one concrete step\n",
                        title: "Constitution detour",
                    })];
            case 4:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/constitution-detour.md",
                        title: "Constitution detour",
                    })];
            case 5:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(planID)];
            case 6:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("propose the contract then declare a detour")];
            case 7:
                _b.sent();
                requested = events.filter(function (event) { return event.type === "detour.requested"; });
                (0, bun_test_1.expect)(requested).toHaveLength(1);
                (0, bun_test_1.expect)(requested[0]).toMatchObject({
                    planID: planID,
                    currentVersion: 1,
                    scopeDelta: ["packages/b"],
                });
                (0, bun_test_1.expect)((0, session_1.projectedWorkContracts)(events).find(function (contract) { return contract.planID === planID; })).toMatchObject({
                    status: "current",
                    version: 2,
                    scope: ["packages/a", "packages/b"],
                });
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 8:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
