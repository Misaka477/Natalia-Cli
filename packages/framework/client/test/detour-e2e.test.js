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
Object.defineProperty(exports, "__esModule", { value: true });
var bun_test_1 = require("bun:test");
var session_1 = require("@anthelia/session");
var src_1 = require("../src");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
var e2e_harness_1 = require("./e2e-harness");
var SESSION = "ses_e2e_detour";
(0, bun_test_1.test)("Phase 2 E2E: an approved detour absorbs its deltas into a new accepted contract (v+1)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, planID, client, marked, requested, accepted, detourGate, niaReview;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("detour-e2e-approve")];
            case 1:
                root = _b.sent();
                events = [];
                planID = "";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "ask",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [
                            {
                                tool: function () { return ({
                                    name: "plan_propose",
                                    arguments: {
                                        planID: planID,
                                        scope: ["packages/a"],
                                        verification: ["bun test packages/a"],
                                    },
                                }); },
                            },
                            {
                                tool: function () { return ({
                                    name: "detour_declare",
                                    arguments: {
                                        planID: planID,
                                        currentVersion: 1,
                                        reason: "the fix also needs the shared util package",
                                        scopeDelta: ["packages/b"],
                                    },
                                }); },
                            },
                            { text: "detour declared" },
                        ],
                        navi: [{ text: "s" }],
                        nia: [{ text: "s" }],
                    }),
                });
                client.start(function (event) {
                    events.push(event);
                    if (event.type === "approval.request" &&
                        (event.scope === "work_contract" || event.scope === "detour"))
                        client.respondApproval({ requestID: event.id, decision: "once" });
                });
                return [4 /*yield*/, client.sessionAttach(SESSION)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/e2e-detour.md",
                        content: "# E2E detour\n\n- one concrete step\n",
                        title: "E2E detour",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/e2e-detour.md",
                        title: "E2E detour",
                    })];
            case 4:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(planID)];
            case 5:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("propose the contract then declare a detour")];
            case 6:
                _b.sent();
                requested = events.find(function (event) {
                    return event.type === "detour.requested";
                });
                (0, bun_test_1.expect)(requested).toMatchObject({
                    planID: planID,
                    currentVersion: 1,
                    reason: "the fix also needs the shared util package",
                    scopeDelta: ["packages/b"],
                    requestedBy: "model",
                });
                accepted = (0, session_1.projectedWorkContracts)(events).find(function (contract) { return contract.planID === planID; });
                (0, bun_test_1.expect)(accepted).toMatchObject({
                    status: "current",
                    version: 2,
                    scope: ["packages/a", "packages/b"],
                    verification: ["bun test packages/a"],
                });
                detourGate = events.find(function (event) {
                    return event.type === "approval.request" && event.scope === "detour";
                });
                (0, bun_test_1.expect)(detourGate).toBeDefined();
                (0, bun_test_1.expect)(detourGate.preview).toContain("无看法批准");
                niaReview = events.find(function (event) {
                    return event.type === "detour.reviewed";
                });
                (0, bun_test_1.expect)(niaReview).toMatchObject({
                    detourID: requested.detourID,
                    verdict: "unavailable",
                    reviewedBy: "nia",
                });
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 7:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase 2 E2E: a stale detour and an overlapping scopeDelta are rejected before the gate", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, planID, client, marked, accepted;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("detour-e2e-reject")];
            case 1:
                root = _b.sent();
                events = [];
                planID = "";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "ask",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [
                            {
                                // Establish v1 with scope packages/a.
                                tool: function () { return ({
                                    name: "plan_propose",
                                    arguments: {
                                        planID: planID,
                                        scope: ["packages/a"],
                                        verification: ["bun test packages/a"],
                                    },
                                }); },
                            },
                            {
                                // Stale currentVersion (contract is v1, declare against v9).
                                tool: function () { return ({
                                    name: "detour_declare",
                                    arguments: {
                                        planID: planID,
                                        currentVersion: 9,
                                        reason: "stale lock",
                                        scopeDelta: ["packages/b"],
                                    },
                                }); },
                            },
                            {
                                // Overlapping scopeDelta (packages/a is already committed).
                                tool: function () { return ({
                                    name: "detour_declare",
                                    arguments: {
                                        planID: planID,
                                        currentVersion: 1,
                                        reason: "overlap",
                                        scopeDelta: ["packages/a"],
                                    },
                                }); },
                            },
                            { text: "done" },
                        ],
                        navi: [{ text: "s" }],
                        nia: [{ text: "s" }],
                    }),
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
                        path: "plans/e2e-detour.md",
                        content: "# E2E detour\n",
                        title: "E2E detour",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/e2e-detour.md",
                        title: "E2E detour",
                    })];
            case 4:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(planID)];
            case 5:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("propose then attempt invalid detours")];
            case 6:
                _b.sent();
                accepted = events.filter(function (event) { return event.type === "work_contract.accepted"; });
                (0, bun_test_1.expect)(accepted).toHaveLength(1);
                (0, bun_test_1.expect)(accepted[0]).toMatchObject({ planVersion: 1 });
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "detour.requested"; })).toBe(false);
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "approval.request" && event.scope === "detour"; })).toBe(false);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 7:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase 2 E2E: Nia reviews a requested detour and records detour.reviewed (reference only)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, planID, client, marked, detourID, review;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("detour-e2e-nia-review")];
            case 1:
                root = _d.sent();
                events = [];
                planID = "";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "ask",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [
                            {
                                tool: function () { return ({
                                    name: "plan_propose",
                                    arguments: {
                                        planID: planID,
                                        scope: ["packages/a"],
                                        verification: ["bun test packages/a"],
                                    },
                                }); },
                            },
                            {
                                tool: function () { return ({
                                    name: "detour_declare",
                                    arguments: {
                                        planID: planID,
                                        currentVersion: 1,
                                        reason: "the fix also needs the shared util package",
                                        scopeDelta: ["packages/b"],
                                    },
                                }); },
                            },
                            { text: "detour declared" },
                        ],
                        navi: [{ text: "s" }],
                        // The detour_declare wake prompts Nia to review the detour; her turn
                        // reads the detourID from the injected detour-review message and reviews.
                        nia: [
                            {
                                tool: function (context) {
                                    var _a;
                                    var text = context.request.messages
                                        .map(function (message) { var _a; return String((_a = message.content) !== null && _a !== void 0 ? _a : ""); })
                                        .join("\n");
                                    var match = text.match(/detour ([\w:-]+)\):/u);
                                    return {
                                        name: "detour_review",
                                        arguments: {
                                            detourID: (_a = match === null || match === void 0 ? void 0 : match[1]) !== null && _a !== void 0 ? _a : "",
                                            verdict: "approve",
                                            rationale: "the util package is a legitimate dependency",
                                        },
                                    };
                                },
                            },
                            { text: "reviewed" },
                        ],
                    }),
                });
                client.start(function (event) {
                    events.push(event);
                    if (event.type === "approval.request" &&
                        (event.scope === "work_contract" || event.scope === "detour"))
                        client.respondApproval({ requestID: event.id, decision: "once" });
                });
                return [4 /*yield*/, client.sessionAttach(SESSION)];
            case 2:
                _d.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/e2e-detour.md",
                        content: "# E2E detour\n",
                        title: "E2E detour",
                    })];
            case 3:
                _d.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/e2e-detour.md",
                        title: "E2E detour",
                    })];
            case 4:
                marked = _d.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(planID)];
            case 5:
                _d.sent();
                return [4 /*yield*/, client.submitAndWait("propose then declare a detour")];
            case 6:
                _d.sent();
                // The detour_declare wake drives Nia's review turn; wait for her verdict.
                return [4 /*yield*/, (0, e2e_harness_1.waitFor)(function () {
                        return events.some(function (event) {
                            return event.type === "detour.reviewed" && event.verdict === "approve";
                        });
                    }, { timeoutMs: 10000 })];
            case 7:
                // The detour_declare wake drives Nia's review turn; wait for her verdict.
                _d.sent();
                detourID = (_b = (_a = events.find(function (event) { return event.type === "detour.requested"; })) === null || _a === void 0 ? void 0 : _a.detourID) !== null && _b !== void 0 ? _b : "";
                review = events.find(function (event) {
                    return event.type === "detour.reviewed" &&
                        event.detourID === detourID &&
                        event.verdict === "approve";
                });
                (0, bun_test_1.expect)(review).toMatchObject({
                    planID: planID,
                    verdict: "approve",
                    reviewedBy: "nia",
                    rationale: "the util package is a legitimate dependency",
                });
                return [4 /*yield*/, ((_c = client.dispose) === null || _c === void 0 ? void 0 : _c.call(client))];
            case 8:
                _d.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase 2 E2E: a rejected detour leaves the contract at its current version and records Nia unavailable", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, planID, client, marked, accepted, contract, review;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("detour-e2e-reject-gate")];
            case 1:
                root = _b.sent();
                events = [];
                planID = "";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "ask",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [
                            {
                                tool: function () { return ({
                                    name: "plan_propose",
                                    arguments: {
                                        planID: planID,
                                        scope: ["packages/a"],
                                        verification: ["bun test packages/a"],
                                    },
                                }); },
                            },
                            {
                                tool: function () { return ({
                                    name: "detour_declare",
                                    arguments: {
                                        planID: planID,
                                        currentVersion: 1,
                                        reason: "the fix also needs the shared util package",
                                        scopeDelta: ["packages/b"],
                                    },
                                }); },
                            },
                            { text: "detour rejected" },
                        ],
                        navi: [{ text: "s" }],
                        nia: [{ text: "s" }],
                    }),
                });
                client.start(function (event) {
                    events.push(event);
                    if (event.type === "approval.request") {
                        // Accept the contract, but reject the detour gate.
                        client.respondApproval(__assign({ requestID: event.id, decision: event.scope === "detour" ? "reject" : "once" }, (event.scope === "detour" ? { feedback: "stay in scope" } : {})));
                    }
                });
                return [4 /*yield*/, client.sessionAttach(SESSION)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/e2e-detour.md",
                        content: "# E2E detour\n",
                        title: "E2E detour",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/e2e-detour.md",
                        title: "E2E detour",
                    })];
            case 4:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(planID)];
            case 5:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("propose then declare a detour to reject")];
            case 6:
                _b.sent();
                accepted = events.filter(function (event) { return event.type === "work_contract.accepted"; });
                (0, bun_test_1.expect)(accepted).toHaveLength(1);
                (0, bun_test_1.expect)(accepted[0]).toMatchObject({ planVersion: 1 });
                contract = (0, session_1.projectedWorkContracts)(events).find(function (c) { return c.planID === planID; });
                (0, bun_test_1.expect)(contract).toMatchObject({
                    status: "current",
                    version: 1,
                    scope: ["packages/a"],
                });
                // The detour was requested; Nia did not weigh in before the user rejected,
                // so her opinion is recorded as unavailable.
                (0, bun_test_1.expect)(events.some(function (event) { return event.type === "detour.requested"; })).toBe(true);
                review = events.find(function (event) {
                    return event.type === "detour.reviewed";
                });
                (0, bun_test_1.expect)(review).toMatchObject({ verdict: "unavailable", reviewedBy: "nia" });
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 7:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
