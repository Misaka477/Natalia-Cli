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
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
var e2e_harness_1 = require("./e2e-harness");
var SESSION = "ses_e2e_plan_tasks";
(0, bun_test_1.test)("Phase 4 E2E: plan checkboxes project to evidence-first task states", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, client, marked, planID, states, byText;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-tasks-e2e")];
            case 1:
                root = _b.sent();
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
            case 2:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/e2e-tasks.md",
                        content: [
                            "# E2E tasks",
                            "",
                            "- [x] add the parser",
                            "- [x] wire the runtime client",
                            "- [ ] ship the docs",
                            "- [ ] refactor the tokenizer",
                            "- [~] legacy cleanup",
                        ].join("\n"),
                        title: "E2E tasks",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/e2e-tasks.md",
                        title: "E2E tasks",
                    })];
            case 4:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.planDocActivate(planID)];
            case 5:
                _b.sent();
                // Record a completion whose objective references "add the parser" — the fact
                // source that backs that one checked task.
                return [4 /*yield*/, client.recordCompletion({
                        taskID: "plan:e2e:tasks",
                        objective: "add the parser tests",
                        changeSummary: "added parser unit tests",
                        validations: [
                            { command: "bun test", result: "passed", safeSummary: "green" },
                        ],
                        knownGaps: [],
                        rollbackState: "clean",
                    }, SESSION)];
            case 6:
                // Record a completion whose objective references "add the parser" — the fact
                // source that backs that one checked task.
                _b.sent();
                // A second completion backs an OPEN task — work has started but is not
                // declared done.
                return [4 /*yield*/, client.recordCompletion({
                        taskID: "plan:e2e:tasks",
                        objective: "refactor the tokenizer",
                        changeSummary: "started the tokenizer refactor",
                        validations: [
                            { command: "bun test", result: "passed", safeSummary: "green" },
                        ],
                        knownGaps: [],
                        rollbackState: "clean",
                    }, SESSION)];
            case 7:
                // A second completion backs an OPEN task — work has started but is not
                // declared done.
                _b.sent();
                return [4 /*yield*/, client.planTaskStates({ planID: planID }, SESSION)];
            case 8:
                states = _b.sent();
                byText = new Map(states.map(function (task) { return [task.text, task.state]; }));
                // Checked + evidence -> verified.
                (0, bun_test_1.expect)(byText.get("add the parser")).toBe("verified");
                // Checked + no evidence -> gap (never verified without backing).
                (0, bun_test_1.expect)(byText.get("wire the runtime client")).toBe("gap");
                // Open + no evidence -> pending.
                (0, bun_test_1.expect)(byText.get("ship the docs")).toBe("pending");
                // Open + evidence -> in_progress (work started, not declared done).
                (0, bun_test_1.expect)(byText.get("refactor the tokenizer")).toBe("in_progress");
                // Skipped stays visible.
                (0, bun_test_1.expect)(byText.get("legacy cleanup")).toBe("skipped");
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 9:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase 4 E2E: the main agent's plan_doc_tick declares a step done and can retract it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, client, planID, marked, doc;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-tick-e2e")];
            case 1:
                root = _b.sent();
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        // The planID is minted by planDocMark, so the scripted tool calls read it
                        // from a closure set after the plan is marked.
                        main: [
                            {
                                tool: function () { return ({
                                    name: "plan_doc_tick",
                                    arguments: { planID: planID, task: "add the parser", done: true },
                                }); },
                            },
                            {
                                tool: function () { return ({
                                    name: "plan_doc_tick",
                                    arguments: { planID: planID, task: "add the parser", done: false },
                                }); },
                            },
                            { text: "ticked then retracted" },
                        ],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach(SESSION)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/tick-e2e.md",
                        content: [
                            "# Tick E2E",
                            "",
                            "- [ ] add the parser",
                            "- [ ] ship the docs",
                        ].join("\n"),
                        title: "Tick E2E",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/tick-e2e.md",
                        title: "Tick E2E",
                    })];
            case 4:
                marked = _b.sent();
                planID = marked.planID;
                // The main agent's turn ticks then retracts the step via plan_doc_tick.
                return [4 /*yield*/, client.submitAndWait("mark the parser step done, then retract")];
            case 5:
                // The main agent's turn ticks then retracts the step via plan_doc_tick.
                _b.sent();
                return [4 /*yield*/, client.planDocRead({ planID: planID })];
            case 6:
                doc = _b.sent();
                // After tick-then-retract the marker is back to open, and the label is intact.
                (0, bun_test_1.expect)(doc.content).toContain("- [ ] add the parser");
                (0, bun_test_1.expect)(doc.content).toContain("- [ ] ship the docs");
                // No fabricated lines, no landing log (this plan has checkboxes).
                (0, bun_test_1.expect)(doc.content).not.toContain("落地日志");
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 7:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("Phase 4 E2E: plan_doc_tick appends a 落地日志 section to a checkbox-less plan", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, client, planID, marked, doc;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("plan-tick-log-e2e")];
            case 1:
                root = _b.sent();
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: SESSION,
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [
                            {
                                tool: function () { return ({
                                    name: "plan_doc_tick",
                                    arguments: {
                                        planID: planID,
                                        task: "wired the parser",
                                        done: true,
                                    },
                                }); },
                            },
                            { text: "logged the step" },
                        ],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                client.start(function () { return undefined; });
                return [4 /*yield*/, client.sessionAttach(SESSION)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.planDocWrite({
                        path: "plans/log-e2e.md",
                        content: [
                            "# Prose plan",
                            "",
                            "A design note with no checkboxes at all.",
                            "",
                        ].join("\n"),
                        title: "Prose plan",
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.planDocMark({
                        path: "plans/log-e2e.md",
                        title: "Prose plan",
                    })];
            case 4:
                marked = _b.sent();
                planID = marked.planID;
                return [4 /*yield*/, client.submitAndWait("record that the parser is wired")];
            case 5:
                _b.sent();
                return [4 /*yield*/, client.planDocRead({ planID: planID })];
            case 6:
                doc = _b.sent();
                (0, bun_test_1.expect)(doc.content).toContain("## 落地日志");
                (0, bun_test_1.expect)(doc.content).toContain("- [x] wired the parser");
                // The original prose is preserved.
                (0, bun_test_1.expect)(doc.content).toContain("A design note with no checkboxes at all.");
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 7:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
