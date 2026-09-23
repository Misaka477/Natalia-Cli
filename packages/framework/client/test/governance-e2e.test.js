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
var node_path_1 = require("node:path");
var promises_1 = require("node:fs/promises");
var session_1 = require("@anthelia/session");
var src_1 = require("../src");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
var e2e_harness_1 = require("./e2e-harness");
var MAIN_SESSION = "ses_e2e_governance_write";
(0, bun_test_1.test)("Phase 0 E2E: record tools land journal facts that agree across projections, runtime reads and view-store", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, client, decisionEvents, evidenceEvents, completionEvents, decisions, evidence, completions, state, nodes;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("governance-e2e-write")];
            case 1:
                root = _b.sent();
                events = [];
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: MAIN_SESSION,
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [
                            {
                                tool: {
                                    name: "record_decision",
                                    arguments: {
                                        decision: "append runtime context instead of mutating the system prompt",
                                        rationale: ["keeps the cacheable prefix stable"],
                                        alternatives: [
                                            {
                                                option: "rewrite the system prompt per turn",
                                                rejectedReason: "breaks prompt-cache prefix stability",
                                            },
                                        ],
                                        consequences: ["a context block is appended per turn"],
                                    },
                                },
                            },
                            {
                                tool: {
                                    name: "record_validation",
                                    arguments: {
                                        taskID: "plan:e2e:s1",
                                        objective: "the e2e workspace validation runner is wired",
                                        command: "true",
                                    },
                                },
                            },
                            {
                                tool: {
                                    name: "record_completion",
                                    arguments: {
                                        taskID: "plan:e2e:s1",
                                        objective: "record a completion card for the zero-window write path",
                                        changeSummary: "wired record_decision/validation/completion",
                                        validations: [
                                            {
                                                command: "true",
                                                result: "passed",
                                                safeSummary: "the validation runner returned success",
                                            },
                                        ],
                                        knownGaps: [],
                                        rollbackState: "clean",
                                        changePaths: [
                                            "packages/framework/client/src/runtime/record-tools.ts",
                                        ],
                                    },
                                },
                            },
                            { text: "governance facts recorded" },
                        ],
                        nia: [{ text: "audit wake observed" }],
                    }),
                });
                client.start(function (event) {
                    events.push(event);
                    if (event.type === "approval.request")
                        client.respondApproval({ requestID: event.id, decision: "once" });
                });
                return [4 /*yield*/, client.sessionAttach(MAIN_SESSION)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("record the governance facts")];
            case 3:
                _b.sent();
                return [4 /*yield*/, (0, e2e_harness_1.waitFor)(function () {
                        return events.some(function (event) { return event.type === "completion.recorded"; }) &&
                            events.some(function (event) { return event.type === "decision.recorded"; }) &&
                            events.some(function (event) { return event.type === "evidence.recorded"; });
                    }, { timeoutMs: 10000 })];
            case 4:
                _b.sent();
                decisionEvents = events.filter(function (event) { return event.type === "decision.recorded"; });
                evidenceEvents = events.filter(function (event) { return event.type === "evidence.recorded"; });
                completionEvents = events.filter(function (event) { return event.type === "completion.recorded"; });
                (0, bun_test_1.expect)(decisionEvents).toHaveLength(1);
                (0, bun_test_1.expect)(evidenceEvents).toHaveLength(1);
                (0, bun_test_1.expect)(completionEvents).toHaveLength(1);
                (0, bun_test_1.expect)(decisionEvents[0]).toMatchObject({
                    decision: "append runtime context instead of mutating the system prompt",
                    rationale: ["keeps the cacheable prefix stable"],
                });
                (0, bun_test_1.expect)(evidenceEvents[0]).toMatchObject({
                    taskID: "plan:e2e:s1",
                    status: "validated",
                });
                (0, bun_test_1.expect)(completionEvents[0]).toMatchObject({
                    taskID: "plan:e2e:s1",
                });
                // 2. Projection reaches the same facts from the journal.
                (0, bun_test_1.expect)((0, session_1.projectedDecisionRecords)(events)).toHaveLength(1);
                (0, bun_test_1.expect)((0, session_1.projectedEvidenceRecords)(events)).toHaveLength(1);
                (0, bun_test_1.expect)((0, session_1.projectedCompletions)(events)).toHaveLength(1);
                return [4 /*yield*/, client.decisionRecords(MAIN_SESSION)];
            case 5:
                decisions = _b.sent();
                return [4 /*yield*/, client.evidenceRecords({ sessionID: MAIN_SESSION })];
            case 6:
                evidence = _b.sent();
                return [4 /*yield*/, client.completions({ sessionID: MAIN_SESSION })];
            case 7:
                completions = _b.sent();
                (0, bun_test_1.expect)(decisions.items).toHaveLength(1);
                (0, bun_test_1.expect)(decisions.items[0]).toMatchObject({
                    decision: "append runtime context instead of mutating the system prompt",
                });
                (0, bun_test_1.expect)(decisions.items[0].id).toStartWith("decision:");
                (0, bun_test_1.expect)(evidence.items).toHaveLength(1);
                (0, bun_test_1.expect)(evidence.items[0]).toMatchObject({
                    taskID: "plan:e2e:s1",
                    status: "validated",
                });
                (0, bun_test_1.expect)(completions.items).toHaveLength(1);
                (0, bun_test_1.expect)(completions.items[0]).toMatchObject({
                    taskID: "plan:e2e:s1",
                    changeSummary: "wired record_decision/validation/completion",
                });
                state = (0, e2e_harness_1.reduceRuntimeEvents)(events);
                (0, bun_test_1.expect)(state.decisions.map(function (record) { return record.id; })).toEqual(decisions.items.map(function (record) { return record.id; }));
                (0, bun_test_1.expect)(state.evidence.map(function (record) { return record.taskID; })).toEqual(evidence.items.map(function (record) { return record.taskID; }));
                (0, bun_test_1.expect)(state.completions.map(function (record) { return record.taskID; })).toEqual(completions.items.map(function (record) { return record.taskID; }));
                nodes = Object.values(state.workGraphNodes);
                (0, bun_test_1.expect)(nodes.some(function (node) { return node.kind === "decision"; })).toBe(true);
                (0, bun_test_1.expect)(nodes.some(function (node) { return node.kind === "validation"; })).toBe(true);
                (0, bun_test_1.expect)(Object.values(state.workGraphEdges).some(function (edge) { return edge.kind === "validated_by"; })).toBe(true);
                (0, bun_test_1.expect)((0, session_1.projectedWorkGraphNodes)(events).some(function (node) { return node.kind === "decision"; })).toBe(true);
                (0, bun_test_1.expect)((0, session_1.projectedWorkGraphEdges)(events).some(function (edge) { return edge.kind === "validated_by"; })).toBe(true);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 8:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase -1 E2E: Navi plan_propose lands a user accepted WorkContract read by projection and view-store", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, events, planID, client, marked, contracts, state;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("governance-e2e-contract")];
            case 1:
                root = _b.sent();
                events = [];
                planID = "";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_e2e_contract",
                    permissionMode: "ask",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        navi: [
                            {
                                tool: function (context) { return ({
                                    name: "plan_propose",
                                    arguments: {
                                        planID: planID,
                                        scope: ["packages/framework/client/src/runtime"],
                                        verification: ["bun test packages/framework/client"],
                                        constraints: ["no new runtime dependency"],
                                    },
                                }); },
                            },
                            { text: "contract proposed" },
                        ],
                        main: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                client.start(function (event) {
                    events.push(event);
                    if (event.type === "approval.request" && event.scope === "work_contract")
                        client.respondApproval({ requestID: event.id, decision: "once" });
                });
                return [4 /*yield*/, client.sessionAttach("ses_e2e_contract")];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/e2e-contract.md",
                        content: "# E2E contract\n\n- one concrete step\n",
                        title: "E2E contract",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/e2e-contract.md",
                        title: "E2E contract",
                    })];
            case 4:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(planID)];
            case 5:
                _b.sent();
                return [4 /*yield*/, client.naviChat.submit({ text: "propose the contract" })];
            case 6:
                _b.sent();
                return [4 /*yield*/, (0, e2e_harness_1.waitFor)(function () { return events.some(function (event) { return event.type === "work_contract.accepted"; }); }, { timeoutMs: 10000 })];
            case 7:
                _b.sent();
                (0, bun_test_1.expect)(events.filter(function (event) { return event.type === "work_contract.drafted"; })).toHaveLength(1);
                (0, bun_test_1.expect)(events.filter(function (event) { return event.type === "work_contract.accepted"; })).toHaveLength(1);
                contracts = (0, session_1.projectedWorkContracts)(events);
                (0, bun_test_1.expect)(contracts).toHaveLength(1);
                (0, bun_test_1.expect)(contracts[0]).toMatchObject({
                    planID: planID,
                    status: "current",
                    acceptedBy: "user",
                    scope: ["packages/framework/client/src/runtime"],
                    verification: ["bun test packages/framework/client"],
                    constraints: ["no new runtime dependency"],
                });
                state = (0, e2e_harness_1.reduceRuntimeEvents)(events);
                (0, bun_test_1.expect)(state.workContracts[planID]).toMatchObject({
                    status: "current",
                    acceptedBy: "user",
                    scope: ["packages/framework/client/src/runtime"],
                });
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 8:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase 0 E2E: Nia audit_report writes evidence visible to projection and runtime reads", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, git, committed, gitHead, events, planID, client, marked, projected, evidence, state;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("governance-e2e-audit")];
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
                planID = "";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: "ses_e2e_audit",
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        nia: [
                            {
                                tool: function (context) { return ({
                                    name: "audit_report",
                                    arguments: { planID: planID, verdict: "passed" },
                                }); },
                            },
                            { text: "audit submitted" },
                        ],
                        main: [{ text: "standby" }],
                        navi: [{ text: "standby" }],
                    }),
                });
                client.start(function (event) { return events.push(event); });
                return [4 /*yield*/, client.sessionAttach("ses_e2e_audit")];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/e2e-audit.md",
                        content: "# E2E audit\n",
                        title: "E2E audit",
                    })];
            case 4:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/e2e-audit.md",
                        title: "E2E audit",
                    })];
            case 5:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(planID)];
            case 6:
                _b.sent();
                return [4 /*yield*/, client.niaChat.submit({ text: "audit the plan" })];
            case 7:
                _b.sent();
                return [4 /*yield*/, (0, e2e_harness_1.waitFor)(function () { return events.some(function (event) { return event.type === "evidence.recorded"; }); }, { timeoutMs: 10000 })];
            case 8:
                _b.sent();
                projected = (0, session_1.projectedEvidenceRecords)(events);
                (0, bun_test_1.expect)(projected).toHaveLength(1);
                (0, bun_test_1.expect)(projected[0]).toMatchObject({
                    taskID: planID,
                    status: "validated",
                });
                // EI E2: the audit evidence stamps the repository refs of the tree it audited.
                if (gitHead !== undefined) {
                    (0, bun_test_1.expect)(projected[0]).toMatchObject({ commit: gitHead });
                }
                return [4 /*yield*/, client.evidenceRecords({
                        sessionID: "ses_e2e_audit",
                    })];
            case 9:
                evidence = _b.sent();
                (0, bun_test_1.expect)(evidence.items).toHaveLength(1);
                (0, bun_test_1.expect)(evidence.items[0]).toMatchObject({
                    taskID: planID,
                    status: "validated",
                });
                if (gitHead !== undefined) {
                    (0, bun_test_1.expect)(evidence.items[0]).toMatchObject({ commit: gitHead });
                }
                state = (0, e2e_harness_1.reduceRuntimeEvents)(events);
                (0, bun_test_1.expect)(state.evidence).toHaveLength(1);
                (0, bun_test_1.expect)(state.evidence[0]).toMatchObject({ taskID: planID });
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 10:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("decisions are session-scoped unless explicitly promoted to workspace scope", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, pluginStoreRoot, first, firstSession, second, secondSession, shared, secondSessionAfter;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("governance-e2e-decision-scope")];
            case 1:
                root = _c.sent();
                pluginStoreRoot = (0, node_path_1.join)(root, "plugin-store");
                first = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    pluginStoreRoot: pluginStoreRoot,
                    sessionID: "ses_scope_a",
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [{ text: "ready a" }],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                first.start(function () { return undefined; });
                return [4 /*yield*/, first.sessionAttach("ses_scope_a")];
            case 2:
                _c.sent();
                return [4 /*yield*/, first.recordDecision({ decision: "session A private choice" })];
            case 3:
                _c.sent();
                return [4 /*yield*/, first.decisionRecords({ scope: "session" })];
            case 4:
                firstSession = _c.sent();
                (0, bun_test_1.expect)(firstSession.items).toContainEqual(bun_test_1.expect.objectContaining({
                    decision: "session A private choice",
                    scope: "session",
                }));
                second = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    pluginStoreRoot: pluginStoreRoot,
                    sessionID: "ses_scope_b",
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [{ text: "ready b" }],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                second.start(function () { return undefined; });
                return [4 /*yield*/, second.sessionAttach("ses_scope_b")];
            case 5:
                _c.sent();
                return [4 /*yield*/, second.decisionRecords({ scope: "session" })];
            case 6:
                secondSession = _c.sent();
                (0, bun_test_1.expect)(secondSession.items).not.toContainEqual(bun_test_1.expect.objectContaining({ decision: "session A private choice" }));
                // Only an explicit workspace promotion crosses the session boundary.
                return [4 /*yield*/, first.recordDecision({
                        decision: "workspace shared choice",
                        scope: "workspace",
                    })];
            case 7:
                // Only an explicit workspace promotion crosses the session boundary.
                _c.sent();
                return [4 /*yield*/, second.decisionRecords({ scope: "workspace" })];
            case 8:
                shared = _c.sent();
                (0, bun_test_1.expect)(shared.items).toContainEqual(bun_test_1.expect.objectContaining({
                    decision: "workspace shared choice",
                    scope: "workspace",
                }));
                return [4 /*yield*/, second.decisionRecords({
                        scope: "session",
                    })];
            case 9:
                secondSessionAfter = _c.sent();
                (0, bun_test_1.expect)(secondSessionAfter.items).not.toContainEqual(bun_test_1.expect.objectContaining({ decision: "workspace shared choice" }));
                return [4 /*yield*/, ((_a = first.dispose) === null || _a === void 0 ? void 0 : _a.call(first))];
            case 10:
                _c.sent();
                return [4 /*yield*/, ((_b = second.dispose) === null || _b === void 0 ? void 0 : _b.call(second))];
            case 11:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase -1 E2E: constitution doc rules are read and promoted into journal rules", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sessionID, client, docRules, forcePush, smallPRs, blockRm, refused, promoted, rules, promotedRule, promotedWarn, rulesAfterWarn, promotedWarnRule;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("governance-e2e-constitution")];
            case 1:
                root = _b.sent();
                sessionID = "ses_e2e_constitution";
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "constitution.md"), [
                        "# Project constitution",
                        "",
                        "## Never force-push",
                        "",
                        "Force-pushing rewrites shared history.",
                        "",
                        "<!-- enforcement: deny -->",
                        '<!-- appliesTo: { commandPattern: "git push --force" } -->',
                        "",
                        "## Small pull requests",
                        "",
                        "Prefer small, reviewable pull requests.",
                        "",
                        "## Block rm -rf",
                        "",
                        "<!-- enforcement: deny -->",
                    ].join("\n"), "utf8")];
            case 3:
                _b.sent();
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [{ text: "standby" }],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach(sessionID)];
            case 4:
                _b.sent();
                return [4 /*yield*/, client.constitutionDocRules(sessionID)];
            case 5:
                docRules = _b.sent();
                forcePush = docRules.find(function (rule) { return rule.section === "Never force-push"; });
                (0, bun_test_1.expect)(forcePush).toMatchObject({
                    enforcement: "deny",
                    annotated: true,
                    appliesTo: { commandPattern: "git push --force" },
                });
                smallPRs = docRules.find(function (rule) { return rule.section === "Small pull requests"; });
                (0, bun_test_1.expect)(smallPRs).toMatchObject({ enforcement: "warn", annotated: false });
                blockRm = docRules.find(function (rule) { return rule.section === "Block rm -rf"; });
                (0, bun_test_1.expect)(blockRm).toMatchObject({ enforcement: "deny", annotated: true });
                (0, bun_test_1.expect)(blockRm.appliesTo).toBeUndefined();
                return [4 /*yield*/, client.promoteConstitutionDocRule({ id: blockRm.id }, sessionID)];
            case 6:
                refused = _b.sent();
                (0, bun_test_1.expect)(refused.promoted).toBe(false);
                (0, bun_test_1.expect)(refused.reason).toContain("appliesTo");
                return [4 /*yield*/, client.promoteConstitutionDocRule({ id: forcePush.id }, sessionID)];
            case 7:
                promoted = _b.sent();
                (0, bun_test_1.expect)(promoted.promoted).toBe(true);
                (0, bun_test_1.expect)(promoted.ruleID).toStartWith("P-DOC-");
                return [4 /*yield*/, client.constitutionRules(sessionID)];
            case 8:
                rules = _b.sent();
                promotedRule = rules.find(function (rule) { return rule.ruleID === promoted.ruleID; });
                (0, bun_test_1.expect)(promotedRule).toMatchObject({
                    source: "user",
                    enforcement: "deny",
                    scope: "project",
                    appliesTo: { commandPattern: "git push --force" },
                });
                return [4 /*yield*/, client.promoteConstitutionDocRule({ id: smallPRs.id }, sessionID)];
            case 9:
                promotedWarn = _b.sent();
                (0, bun_test_1.expect)(promotedWarn.promoted).toBe(true);
                return [4 /*yield*/, client.constitutionRules(sessionID)];
            case 10:
                rulesAfterWarn = _b.sent();
                promotedWarnRule = rulesAfterWarn.find(function (rule) { return rule.ruleID === promotedWarn.ruleID; });
                (0, bun_test_1.expect)(promotedWarnRule).toMatchObject({
                    source: "user",
                    enforcement: "warn",
                    scope: "project",
                });
                (0, bun_test_1.expect)(promotedWarnRule.appliesTo).toBeUndefined();
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 11:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase -1 E2E: a user can add, edit, disable and delete a constitution rule", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sessionID, client, created, ruleID, rules, refused, edited, removed;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("governance-e2e-constitution-crud")];
            case 1:
                root = _b.sent();
                sessionID = "ses_e2e_constitution_crud";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [{ text: "standby" }],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach(sessionID)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.createConstitutionRule({
                        statement: "never force-push to shared branches",
                        enforcement: "deny",
                        appliesTo: { commandPattern: "git push --force" },
                    }, sessionID)];
            case 3:
                created = _b.sent();
                (0, bun_test_1.expect)(created.created).toBe(true);
                (0, bun_test_1.expect)(created.ruleID).toStartWith("P-USER-");
                ruleID = created.ruleID;
                return [4 /*yield*/, client.constitutionRules(sessionID)];
            case 4:
                rules = _b.sent();
                (0, bun_test_1.expect)(rules.find(function (rule) { return rule.ruleID === ruleID; })).toMatchObject({
                    statement: "never force-push to shared branches",
                    enforcement: "deny",
                    source: "user",
                    scope: "project",
                    appliesTo: { commandPattern: "git push --force" },
                });
                return [4 /*yield*/, client.createConstitutionRule({ statement: "no rm", enforcement: "deny" }, sessionID)];
            case 5:
                refused = _b.sent();
                (0, bun_test_1.expect)(refused.created).toBe(false);
                (0, bun_test_1.expect)(refused.reason).toContain("appliesTo");
                return [4 /*yield*/, client.updateConstitutionRule({
                        ruleID: ruleID,
                        statement: "never force-push, anywhere",
                        enforcement: "approval",
                        appliesTo: { commandPattern: "git push --force" },
                    }, sessionID)];
            case 6:
                edited = _b.sent();
                (0, bun_test_1.expect)(edited.updated).toBe(true);
                return [4 /*yield*/, client.constitutionRules(sessionID)];
            case 7:
                rules = _b.sent();
                (0, bun_test_1.expect)(rules.find(function (rule) { return rule.ruleID === ruleID; })).toMatchObject({
                    statement: "never force-push, anywhere",
                    enforcement: "approval",
                });
                // 4. Disable -> filtered from the effective set.
                return [4 /*yield*/, client.updateConstitutionRule({ ruleID: ruleID, enabled: false }, sessionID)];
            case 8:
                // 4. Disable -> filtered from the effective set.
                _b.sent();
                return [4 /*yield*/, client.constitutionRules(sessionID)];
            case 9:
                rules = _b.sent();
                (0, bun_test_1.expect)(rules.some(function (rule) { return rule.ruleID === ruleID; })).toBe(false);
                return [4 /*yield*/, client.removeConstitutionRule({ ruleID: ruleID }, sessionID)];
            case 10:
                removed = _b.sent();
                (0, bun_test_1.expect)(removed.removed).toBe(true);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 11:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase -1 E2E: a user edits a soft constitution doc rule and it is written back (EI §3.8 P-1.c)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sessionID, constitutionPath, client, before, smallPRs, forcePush, edited, onDisk, afterStatement, annotated, annotatedDisk, afterAnnotate, beforeRefusal, refused, _a, unknown, finalRules;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("governance-e2e-constitution-docedit")];
            case 1:
                root = _c.sent();
                sessionID = "ses_e2e_constitution_docedit";
                constitutionPath = (0, node_path_1.join)(root, ".natalia", "constitution.md");
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 2:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)(constitutionPath, [
                        "# Project constitution",
                        "",
                        "## Never force-push",
                        "",
                        "Force-pushing rewrites shared history.",
                        "",
                        "<!-- enforcement: deny -->",
                        '<!-- appliesTo: { commandPattern: "git push --force" } -->',
                        "",
                        "## Small pull requests",
                        "",
                        "Prefer small, reviewable pull requests.",
                    ].join("\n"), "utf8")];
            case 3:
                _c.sent();
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [{ text: "standby" }],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach(sessionID)];
            case 4:
                _c.sent();
                return [4 /*yield*/, client.constitutionDocRules(sessionID)];
            case 5:
                before = _c.sent();
                smallPRs = before.find(function (rule) { return rule.section === "Small pull requests"; });
                forcePush = before.find(function (rule) { return rule.section === "Never force-push"; });
                (0, bun_test_1.expect)(smallPRs.enforcement).toBe("warn");
                return [4 /*yield*/, client.updateConstitutionDocRule({
                        id: smallPRs.id,
                        statement: "Prefer small, single-purpose pull requests under 400 lines.",
                    }, sessionID)];
            case 6:
                edited = _c.sent();
                (0, bun_test_1.expect)(edited.updated).toBe(true);
                return [4 /*yield*/, (0, promises_1.readFile)(constitutionPath, "utf8")];
            case 7:
                onDisk = _c.sent();
                (0, bun_test_1.expect)(onDisk).toContain("under 400 lines");
                // The other section is untouched.
                (0, bun_test_1.expect)(onDisk).toContain("Force-pushing rewrites shared history.");
                return [4 /*yield*/, client.constitutionDocRules(sessionID)];
            case 8:
                afterStatement = _c.sent();
                (0, bun_test_1.expect)(afterStatement.find(function (rule) { return rule.section === "Small pull requests"; })
                    .statement).toBe("Prefer small, single-purpose pull requests under 400 lines.");
                return [4 /*yield*/, client.updateConstitutionDocRule({
                        id: smallPRs.id,
                        enforcement: "approval",
                        appliesTo: { tools: ["shell"] },
                    }, sessionID)];
            case 9:
                annotated = _c.sent();
                (0, bun_test_1.expect)(annotated.updated).toBe(true);
                return [4 /*yield*/, (0, promises_1.readFile)(constitutionPath, "utf8")];
            case 10:
                annotatedDisk = _c.sent();
                (0, bun_test_1.expect)(annotatedDisk).toContain("<!-- enforcement: approval -->");
                (0, bun_test_1.expect)(annotatedDisk).toContain('tools: ["shell"]');
                return [4 /*yield*/, client.constitutionDocRules(sessionID)];
            case 11:
                afterAnnotate = _c.sent();
                (0, bun_test_1.expect)(afterAnnotate.find(function (rule) { return rule.section === "Small pull requests"; })).toMatchObject({
                    enforcement: "approval",
                    annotated: true,
                    appliesTo: { tools: ["shell"] },
                });
                return [4 /*yield*/, (0, promises_1.readFile)(constitutionPath, "utf8")];
            case 12:
                beforeRefusal = _c.sent();
                return [4 /*yield*/, client.updateConstitutionDocRule({ id: smallPRs.id, statement: "x", enforcement: "deny", appliesTo: {} }, sessionID)];
            case 13:
                refused = _c.sent();
                (0, bun_test_1.expect)(refused.updated).toBe(false);
                (0, bun_test_1.expect)(refused.reason).toContain("appliesTo");
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)(constitutionPath, "utf8")];
            case 14:
                _a.apply(void 0, [_c.sent()]).toBe(beforeRefusal);
                return [4 /*yield*/, client.updateConstitutionDocRule({ id: "constitution:nope:9", statement: "x" }, sessionID)];
            case 15:
                unknown = _c.sent();
                (0, bun_test_1.expect)(unknown.updated).toBe(false);
                return [4 /*yield*/, client.constitutionDocRules(sessionID)];
            case 16:
                finalRules = _c.sent();
                (0, bun_test_1.expect)(finalRules.find(function (rule) { return rule.section === "Never force-push"; })).toMatchObject({
                    enforcement: "deny",
                    appliesTo: { commandPattern: "git push --force" },
                });
                return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 17:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase -1 E2E: hard-protected rules refuse edits, other release rules stay user-editable", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sessionID, client, seeded, termEdit, termRemove, relEdit, rules, relRemove;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("governance-e2e-constitution-protection")];
            case 1:
                root = _b.sent();
                sessionID = "ses_e2e_constitution_protection";
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [{ text: "standby" }],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach(sessionID)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.constitutionRules(sessionID)];
            case 3:
                seeded = _b.sent();
                (0, bun_test_1.expect)(seeded.find(function (rule) { return rule.ruleID === "C-TERM-001"; })).toMatchObject({
                    scope: "release",
                    enforcement: "deny",
                });
                (0, bun_test_1.expect)(seeded.find(function (rule) { return rule.ruleID === "C-REL-001"; })).toMatchObject({
                    scope: "release",
                    enforcement: "approval",
                });
                return [4 /*yield*/, client.updateConstitutionRule({ ruleID: "C-TERM-001", statement: "loosen it" }, sessionID)];
            case 4:
                termEdit = _b.sent();
                (0, bun_test_1.expect)(termEdit.updated).toBe(false);
                return [4 /*yield*/, client.removeConstitutionRule({ ruleID: "C-TERM-002" }, sessionID)];
            case 5:
                termRemove = _b.sent();
                (0, bun_test_1.expect)(termRemove.removed).toBe(false);
                return [4 /*yield*/, client.updateConstitutionRule({ ruleID: "C-REL-001", statement: "git writes need approval (edited)" }, sessionID)];
            case 6:
                relEdit = _b.sent();
                (0, bun_test_1.expect)(relEdit.updated).toBe(true);
                return [4 /*yield*/, client.constitutionRules(sessionID)];
            case 7:
                rules = _b.sent();
                (0, bun_test_1.expect)(rules.find(function (rule) { return rule.ruleID === "C-REL-001"; })).toMatchObject({
                    statement: "git writes need approval (edited)",
                });
                return [4 /*yield*/, client.removeConstitutionRule({ ruleID: "C-REL-002" }, sessionID)];
            case 8:
                relRemove = _b.sent();
                (0, bun_test_1.expect)(relRemove.removed).toBe(true);
                return [4 /*yield*/, client.constitutionRules(sessionID)];
            case 9:
                rules = _b.sent();
                (0, bun_test_1.expect)(rules.some(function (rule) { return rule.ruleID === "C-REL-002"; })).toBe(false);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 10:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
