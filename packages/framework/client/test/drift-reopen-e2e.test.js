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
var e2e_harness_1 = require("./e2e-harness");
var SESSION = "ses_e2e_drift_reopen";
function attachClient(root) {
    return __awaiter(this, void 0, void 0, function () {
        var client;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = (0, src_1.createRealRuntimeClient)({
                        workspaceRoot: root,
                        sessionID: SESSION,
                        permissionMode: "auto",
                        provider: (0, e2e_harness_1.createScriptedProvider)({
                            main: [{ text: "standby" }],
                            navi: [{ text: "standby" }],
                            nia: [{ text: "standby" }],
                        }),
                    });
                    client.start(function () { return undefined; });
                    return [4 /*yield*/, client.sessionAttach(SESSION)];
                case 1:
                    _a.sent();
                    return [2 /*return*/, client];
            }
        });
    });
}
(0, bun_test_1.test)("Phase 2 E2E: a dismissed drift finding can be reopened by the user and counts reopens", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, client, opened, before, finding, dismissed, reopened, afterReopen, reopenedFinding, secondReopen;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("drift-e2e-reopen")];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, attachClient(root)];
            case 2:
                client = _b.sent();
                return [4 /*yield*/, client.evaluateDrift({
                        objective: "refactor the parser tokenizer",
                        currentActivity: "writing cooking recipes documentation",
                        changes: [{ path: "docs/recipes.md", action: "modified" }],
                    }, SESSION)];
            case 3:
                opened = _b.sent();
                (0, bun_test_1.expect)(opened.opened).toBeGreaterThan(0);
                return [4 /*yield*/, client.driftFindings({ sessionID: SESSION })];
            case 4:
                before = _b.sent();
                finding = before.items.find(function (f) { return f.status === "open"; });
                (0, bun_test_1.expect)(finding.reopenedCount).toBe(0);
                return [4 /*yield*/, client.acknowledgeDriftFinding({ findingID: finding.findingID, status: "dismissed" }, SESSION)];
            case 5:
                dismissed = _b.sent();
                (0, bun_test_1.expect)(dismissed.acknowledged).toBe(true);
                return [4 /*yield*/, client.reopenDriftFinding({ findingID: finding.findingID }, SESSION)];
            case 6:
                reopened = _b.sent();
                (0, bun_test_1.expect)(reopened.reopened).toBe(true);
                return [4 /*yield*/, client.driftFindings({ sessionID: SESSION })];
            case 7:
                afterReopen = _b.sent();
                reopenedFinding = afterReopen.items.find(function (f) { return f.findingID === finding.findingID; });
                (0, bun_test_1.expect)(reopenedFinding.status).toBe("open");
                (0, bun_test_1.expect)(reopenedFinding.reopenedCount).toBe(1);
                return [4 /*yield*/, client.reopenDriftFinding({ findingID: finding.findingID }, SESSION)];
            case 8:
                secondReopen = _b.sent();
                (0, bun_test_1.expect)(secondReopen.reopened).toBe(false);
                (0, bun_test_1.expect)(secondReopen.reason).toContain("open");
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 9:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase 2 E2E: a corrected drift finding cannot be reopened (its premise is gone)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, client, finding, reopened;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("drift-e2e-reopen-corrected")];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, attachClient(root)];
            case 2:
                client = _b.sent();
                return [4 /*yield*/, client.evaluateDrift({
                        objective: "refactor the parser tokenizer",
                        currentActivity: "writing cooking recipes documentation",
                        changes: [{ path: "docs/recipes.md", action: "modified" }],
                    }, SESSION)];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.driftFindings({ sessionID: SESSION })];
            case 4:
                finding = (_b.sent()).items.find(function (f) { return f.status === "open"; });
                // Corrected means the contract was revised to absorb the finding; reopening
                // it is meaningless, so the reopen is refused.
                return [4 /*yield*/, client.acknowledgeDriftFinding({ findingID: finding.findingID, status: "corrected" }, SESSION)];
            case 5:
                // Corrected means the contract was revised to absorb the finding; reopening
                // it is meaningless, so the reopen is refused.
                _b.sent();
                return [4 /*yield*/, client.reopenDriftFinding({ findingID: finding.findingID }, SESSION)];
            case 6:
                reopened = _b.sent();
                (0, bun_test_1.expect)(reopened.reopened).toBe(false);
                (0, bun_test_1.expect)(reopened.reason).toContain("corrected");
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 7:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase 2 E2E: a warning/high finding is auto-injected into the main agent's next step; advisory is not", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, high, highFinding, injected, beforeAdvisory, advisoryFinding, afterAdvisory;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("drift-e2e-inject")];
            case 1:
                root = _b.sent();
                events = [];
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [{ text: "standby" }],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.sessionAttach(SESSION)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.evaluateDrift({
                        objective: "clean up the workspace",
                        currentActivity: "delete the old build artifacts",
                        applicableConstraints: ["never delete files without approval"],
                    }, SESSION)];
            case 3:
                high = _b.sent();
                (0, bun_test_1.expect)(high.opened).toBeGreaterThan(0);
                // Events flow through the async sink, so poll for the finding + injection.
                return [4 /*yield*/, (0, e2e_harness_1.waitFor)(function () {
                        return events.some(function (event) {
                            return event.type === "drift.finding_opened" && event.severity === "high";
                        }) &&
                            events.some(function (event) {
                                return event.type === "input.admitted" &&
                                    event.internal === true &&
                                    event.delivery === "next-step";
                            });
                    }, { timeoutMs: 10000 })];
            case 4:
                // Events flow through the async sink, so poll for the finding + injection.
                _b.sent();
                highFinding = events.find(function (event) {
                    return event.type === "drift.finding_opened" && event.severity === "high";
                });
                (0, bun_test_1.expect)(highFinding).toBeDefined();
                injected = events.find(function (event) {
                    return event.type === "input.admitted" &&
                        event.internal === true &&
                        event.delivery === "next-step" &&
                        event.text.includes(highFinding.findingID);
                });
                (0, bun_test_1.expect)(injected).toBeDefined();
                (0, bun_test_1.expect)(injected.text).toContain("drift_acknowledge");
                beforeAdvisory = events.filter(function (event) { return event.type === "input.admitted"; }).length;
                return [4 /*yield*/, client.evaluateDrift({
                        objective: "refactor the parser tokenizer",
                        currentActivity: "writing cooking recipes documentation",
                        changes: [{ path: "docs/recipes.md", action: "modified" }],
                    }, SESSION)];
            case 5:
                _b.sent();
                advisoryFinding = events.find(function (event) {
                    return event.type === "drift.finding_opened" && event.severity === "advisory";
                });
                (0, bun_test_1.expect)(advisoryFinding).toBeDefined();
                afterAdvisory = events.filter(function (event) { return event.type === "input.admitted"; }).length;
                // No new input.admitted for the advisory finding.
                (0, bun_test_1.expect)(afterAdvisory).toBe(beforeAdvisory);
                (0, bun_test_1.expect)(events.some(function (event) {
                    return event.type === "input.admitted" &&
                        event.text.includes(advisoryFinding.findingID);
                })).toBe(false);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 6:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase 2 E2E: reopening a warning/high finding re-injects it for re-review (EI §3.5)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, finding, injectionsForFinding, reopened, reinjection;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("drift-e2e-reopen-reinject")];
            case 1:
                root = _b.sent();
                events = [];
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [{ text: "standby" }],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.sessionAttach(SESSION)];
            case 2:
                _b.sent();
                // A high finding: the applicable constraint forbids "delete" and the current
                // activity does it — constraint_violation_signal fires at high severity, and
                // B3 auto-injects it into the main agent's next step.
                return [4 /*yield*/, client.evaluateDrift({
                        objective: "clean up the workspace",
                        currentActivity: "delete the old build artifacts",
                        applicableConstraints: ["never delete files without approval"],
                    }, SESSION)];
            case 3:
                // A high finding: the applicable constraint forbids "delete" and the current
                // activity does it — constraint_violation_signal fires at high severity, and
                // B3 auto-injects it into the main agent's next step.
                _b.sent();
                return [4 /*yield*/, (0, e2e_harness_1.waitFor)(function () {
                        return events.some(function (event) {
                            return event.type === "drift.finding_opened" && event.severity === "high";
                        });
                    }, { timeoutMs: 10000 })];
            case 4:
                _b.sent();
                return [4 /*yield*/, client.driftFindings({ sessionID: SESSION })];
            case 5:
                finding = (_b.sent()).items.find(function (f) { return f.severity === "high"; });
                injectionsForFinding = function () {
                    return events.filter(function (event) {
                        return event.type === "input.admitted" &&
                            event.internal === true &&
                            event.text.includes(finding.findingID);
                    });
                };
                // The original finding_opened already injected once.
                (0, bun_test_1.expect)(injectionsForFinding().length).toBeGreaterThanOrEqual(1);
                // Dismiss, then reopen — the reopen re-injects for re-review.
                return [4 /*yield*/, client.acknowledgeDriftFinding({ findingID: finding.findingID, status: "dismissed" }, SESSION)];
            case 6:
                // Dismiss, then reopen — the reopen re-injects for re-review.
                _b.sent();
                return [4 /*yield*/, client.reopenDriftFinding({ findingID: finding.findingID }, SESSION)];
            case 7:
                reopened = _b.sent();
                (0, bun_test_1.expect)(reopened.reopened).toBe(true);
                (0, bun_test_1.expect)(reopened.reopenedCount).toBe(1);
                return [4 /*yield*/, (0, e2e_harness_1.waitFor)(function () { return injectionsForFinding().length >= 2; }, {
                        timeoutMs: 10000,
                    })];
            case 8:
                _b.sent();
                reinjection = injectionsForFinding().at(-1);
                // The re-review note tells the agent not to repeat its last rationale, and
                // the admission id is distinct from the original injection's.
                (0, bun_test_1.expect)(reinjection.text).toContain("reopen #1");
                (0, bun_test_1.expect)(reinjection.text).toContain("do not repeat the rationale");
                (0, bun_test_1.expect)(reinjection.id).not.toBe("turn_drift_".concat(finding.findingID));
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 9:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase 2 E2E: a warning/high finding reaches the main agent's next provider request; advisory does not", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, requests, client, firstRequest;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("drift-e2e-b3-nextrequest")];
            case 1:
                root = _b.sent();
                requests = [];
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "auto",
                    provider: {
                        provider: "test",
                        model: "test",
                        stream: function (request) {
                            return __asyncGenerator(this, arguments, function stream_1() {
                                var messages;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            messages = request.messages;
                                            requests.push(messages.map(function (message) { var _a; return String((_a = message.content) !== null && _a !== void 0 ? _a : ""); }).join("\n"));
                                            return [4 /*yield*/, __await({ type: "content", text: "acknowledged" })];
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
                return [4 /*yield*/, client.sessionAttach(SESSION)];
            case 2:
                _b.sent();
                // evaluateDrift opens a high finding and injects it as a next-step input.
                return [4 /*yield*/, client.evaluateDrift({
                        objective: "clean up the workspace",
                        currentActivity: "delete the old build artifacts",
                        applicableConstraints: ["never delete files without approval"],
                    }, SESSION)];
            case 3:
                // evaluateDrift opens a high finding and injects it as a next-step input.
                _b.sent();
                // The next turn's first provider request must carry the injected finding.
                return [4 /*yield*/, client.submitAndWait("respond to the drift finding")];
            case 4:
                // The next turn's first provider request must carry the injected finding.
                _b.sent();
                (0, bun_test_1.expect)(requests.length).toBeGreaterThanOrEqual(1);
                firstRequest = requests[0];
                (0, bun_test_1.expect)(firstRequest).toContain("internal drift finding");
                (0, bun_test_1.expect)(firstRequest).toContain("constraint_violation_signal");
                (0, bun_test_1.expect)(firstRequest).toContain("drift_acknowledge");
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 5:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase 2 E2E: the main agent's drift_acknowledge moves an open finding to explained (B3 close)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, openFindingID, client, high, highFinding, findings, updated;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("drift-e2e-acknowledge")];
            case 1:
                root = _b.sent();
                events = [];
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [
                            {
                                // The Main Agent answers the injected finding by acknowledging it as
                                // explained with a rationale — the model's side of the B3 loop, the
                                // step no E2E had proven before (the tool was registered and the
                                // injection told the model to call it, but nothing exercised the
                                // call -> status transition end to end).
                                tool: function () { return ({
                                    name: "drift_acknowledge",
                                    arguments: {
                                        findingID: openFindingID,
                                        status: "explained",
                                        rationale: "the deletions were within the approved cleanup scope",
                                    },
                                }); },
                            },
                            { text: "acknowledged the drift finding" },
                        ],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                client.start(function (event) {
                    events.push(event);
                    if (event.type === "approval.request")
                        client.respondApproval({ requestID: event.id, decision: "once" });
                });
                return [4 /*yield*/, client.sessionAttach(SESSION)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.evaluateDrift({
                        objective: "clean up the workspace",
                        currentActivity: "delete the old build artifacts",
                        applicableConstraints: ["never delete files without approval"],
                    }, SESSION)];
            case 3:
                high = _b.sent();
                (0, bun_test_1.expect)(high.opened).toBeGreaterThan(0);
                return [4 /*yield*/, (0, e2e_harness_1.waitFor)(function () {
                        return events.some(function (event) {
                            return event.type === "drift.finding_opened" && event.severity === "high";
                        });
                    }, { timeoutMs: 10000 })];
            case 4:
                _b.sent();
                highFinding = events.find(function (event) {
                    return event.type === "drift.finding_opened" && event.severity === "high";
                });
                (0, bun_test_1.expect)(highFinding).toBeDefined();
                openFindingID = highFinding.findingID;
                // The next turn delivers the injected finding; the scripted Main Agent calls
                // drift_acknowledge(explained) in response — closing the B3 loop.
                return [4 /*yield*/, client.submitAndWait("respond to the drift finding")];
            case 5:
                // The next turn delivers the injected finding; the scripted Main Agent calls
                // drift_acknowledge(explained) in response — closing the B3 loop.
                _b.sent();
                // The acknowledgement is recorded as a drift.finding_updated(explained): the
                // tool executed and transitioned the finding, not just returned text.
                return [4 /*yield*/, (0, e2e_harness_1.waitFor)(function () {
                        return events.some(function (event) {
                            return event.type === "drift.finding_updated" &&
                                event.findingID === highFinding.findingID &&
                                event.status === "explained";
                        });
                    }, { timeoutMs: 10000 })];
            case 6:
                // The acknowledgement is recorded as a drift.finding_updated(explained): the
                // tool executed and transitioned the finding, not just returned text.
                _b.sent();
                return [4 /*yield*/, client.driftFindings({ sessionID: SESSION })];
            case 7:
                findings = (_b.sent())
                    .items;
                updated = findings.find(function (f) { return f.findingID === highFinding.findingID; });
                (0, bun_test_1.expect)(updated === null || updated === void 0 ? void 0 : updated.status).toBe("explained");
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 8:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase 2 E2E: evaluateDrift opens a no-progress finding from recentActions", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, result, finding;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("drift-e2e-no-progress-rpc")];
            case 1:
                root = _b.sent();
                events = [];
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [{ text: "standby" }],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.sessionAttach(SESSION)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.evaluateDrift({
                        objective: "ship the feature",
                        currentActivity: "reading files",
                        recentActions: Array.from({ length: 8 }, function () { return ({
                            kind: "tool_call",
                        }); }),
                    }, SESSION)];
            case 3:
                result = _b.sent();
                (0, bun_test_1.expect)(result.opened).toBeGreaterThan(0);
                finding = events.find(function (event) {
                    var _a;
                    return event.type === "drift.finding_opened" &&
                        ((_a = event.ruleHits) !== null && _a !== void 0 ? _a : []).some(function (hit) { return hit.rule === "no_progress"; });
                });
                (0, bun_test_1.expect)(finding).toBeDefined();
                (0, bun_test_1.expect)(finding.severity).toBe("advisory");
                (0, bun_test_1.expect)(finding.findingID).toBe("drift:no_progress:session:" + SESSION);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 4:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase 2 E2E: evaluateDrift opens a failure-loop finding from recentFailures", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, result, finding;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("drift-e2e-failure-loop")];
            case 1:
                root = _b.sent();
                events = [];
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [{ text: "standby" }],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.sessionAttach(SESSION)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.evaluateDrift({
                        objective: "fix the build",
                        currentActivity: "retrying the same command",
                        recentFailures: [
                            { toolName: "run_shell", key: "k1" },
                            { toolName: "run_shell", key: "k1" },
                            { toolName: "run_shell", key: "k1" },
                        ],
                    }, SESSION)];
            case 3:
                result = _b.sent();
                (0, bun_test_1.expect)(result.opened).toBeGreaterThan(0);
                finding = events.find(function (event) {
                    var _a;
                    return event.type === "drift.finding_opened" &&
                        ((_a = event.ruleHits) !== null && _a !== void 0 ? _a : []).some(function (hit) { return hit.rule === "failure_loop"; });
                });
                (0, bun_test_1.expect)(finding).toBeDefined();
                (0, bun_test_1.expect)(finding.severity).toBe("warning");
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 4:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
