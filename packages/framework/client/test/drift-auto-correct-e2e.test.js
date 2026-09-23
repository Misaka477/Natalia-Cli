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
var SESSION = "ses_e2e_drift_auto_correct";
/**
 * EI §3.4 auto-correction: a target_drift finding is closed as `corrected` when
 * a contract revision absorbs its flagged path — the reference frame moved to
 * meet the work, so the finding's premise is gone (same as an approved detour).
 */
(0, bun_test_1.test)("Phase 2 E2E: a contract revision auto-corrects an absorbed target_drift finding", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, planID, phase, client, marked, opened, before, targetDrift, after, corrected;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("drift-e2e-auto-correct")];
            case 1:
                root = _b.sent();
                events = [];
                planID = "";
                phase = 1;
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "ask",
                    provider: {
                        provider: "drift-auto-correct",
                        model: "drift-auto-correct-model",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_1() {
                                var proposeResults, propose;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            proposeResults = request.messages.filter(function (message) {
                                                var _a;
                                                return message.role === "tool" &&
                                                    String((_a = message.toolCallID) !== null && _a !== void 0 ? _a : "").startsWith("call_propose");
                                            });
                                            propose = function (scope) { return ({
                                                type: "tool_call",
                                                calls: [
                                                    {
                                                        id: "call_propose",
                                                        name: "plan_propose",
                                                        arguments: JSON.stringify({ planID: planID, scope: scope }),
                                                    },
                                                ],
                                            }); };
                                            if (!(proposeResults.length === 0)) return [3 /*break*/, 6];
                                            return [4 /*yield*/, __await(propose(["packages/a"]))];
                                        case 1: return [4 /*yield*/, _a.sent()];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 3: return [4 /*yield*/, _a.sent()];
                                        case 4:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 5: return [2 /*return*/, _a.sent()];
                                        case 6:
                                            if (!(phase === 2 && proposeResults.length === 1)) return [3 /*break*/, 12];
                                            return [4 /*yield*/, __await(propose(["packages/a", "packages/b"]))];
                                        case 7: 
                                        // Turn 2: extend the contract to absorb packages/b.
                                        return [4 /*yield*/, _a.sent()];
                                        case 8:
                                            // Turn 2: extend the contract to absorb packages/b.
                                            _a.sent();
                                            return [4 /*yield*/, __await({ type: "done" })];
                                        case 9: return [4 /*yield*/, _a.sent()];
                                        case 10:
                                            _a.sent();
                                            return [4 /*yield*/, __await(void 0)];
                                        case 11: return [2 /*return*/, _a.sent()];
                                        case 12: return [4 /*yield*/, __await({ type: "content", text: "contract set" })];
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
                    if (event.type === "approval.request" && event.scope === "work_contract")
                        client.respondApproval({ requestID: event.id, decision: "once" });
                });
                return [4 /*yield*/, client.sessionAttach(SESSION)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/drift-auto-correct.md",
                        content: "# Drift auto-correct\n\n- one concrete step\n",
                        title: "Drift auto-correct",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/drift-auto-correct.md",
                        title: "Drift auto-correct",
                    })];
            case 4:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(planID)];
            case 5:
                _b.sent();
                // Turn 1: accept the initial contract (scope = packages/a).
                return [4 /*yield*/, client.submitAndWait("propose the contract")];
            case 6:
                // Turn 1: accept the initial contract (scope = packages/a).
                _b.sent();
                return [4 /*yield*/, client.evaluateDrift({
                        objective: "work on packages/a",
                        currentActivity: "modify:packages/b/x.ts",
                        changes: [{ path: "packages/b/x.ts", action: "modified" }],
                    }, SESSION)];
            case 7:
                opened = _b.sent();
                (0, bun_test_1.expect)(opened.opened).toBeGreaterThan(0);
                return [4 /*yield*/, client.driftFindings({ sessionID: SESSION })];
            case 8:
                before = _b.sent();
                targetDrift = before.items.find(function (finding) {
                    return finding.status === "open" &&
                        finding.evidence.some(function (entry) { return entry.startsWith("outside_target:"); });
                });
                (0, bun_test_1.expect)(targetDrift).toBeDefined();
                (0, bun_test_1.expect)(targetDrift.status).toBe("open");
                // Turn 2: extend the contract to absorb packages/b -> auto-correction.
                phase = 2;
                return [4 /*yield*/, client.submitAndWait("extend the contract to include packages/b")];
            case 9:
                _b.sent();
                return [4 /*yield*/, client.driftFindings({ sessionID: SESSION })];
            case 10:
                after = _b.sent();
                corrected = after.items.find(function (finding) { return finding.findingID === targetDrift.findingID; });
                (0, bun_test_1.expect)(corrected.status).toBe("corrected");
                // The correction is a durable fact, not a UI-only toggle.
                (0, bun_test_1.expect)(events.some(function (event) {
                    return event.type === "drift.finding_updated" &&
                        event.findingID === targetDrift.findingID &&
                        event.status === "corrected";
                })).toBe(true);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 11:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
