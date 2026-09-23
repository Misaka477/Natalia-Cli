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
/**
 * EI §3.7.1/§3.7.2: a rule-class change is confirmed per item by the human —
 * `auto` permission mode must NOT auto-grant it and must NOT offer
 * "Allow … for session". Only an explicit per-item Allow lands the rule.
 */
(0, bun_test_1.test)("a proposed constitution rule still gates in auto mode (no auto-grant)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sessionID, events, approvals, client, approval, rules, proposed;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("constitution-rule-gate-auto")];
            case 1:
                root = _b.sent();
                sessionID = "ses_rule_gate_auto";
                events = [];
                approvals = 0;
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [
                            {
                                tool: function () { return ({
                                    name: "constitution_propose_rule",
                                    arguments: {
                                        statement: "never run rm -rf on the repo root",
                                        enforcement: "deny",
                                        appliesTo: { commandPattern: "rm -rf" },
                                    },
                                }); },
                            },
                            { text: "rule proposed" },
                        ],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                client.start(function (event) {
                    events.push(event);
                    if (event.type === "approval.request" &&
                        event.scope === "constitution_rule") {
                        approvals += 1;
                        client.respondApproval({ requestID: event.id, decision: "once" });
                    }
                });
                return [4 /*yield*/, client.sessionAttach(sessionID)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("propose a rule")];
            case 3:
                _b.sent();
                approval = events.find(function (event) {
                    return event.type === "approval.request" && event.scope === "constitution_rule";
                });
                (0, bun_test_1.expect)(approval).toBeDefined();
                (0, bun_test_1.expect)(approvals).toBe(1);
                (0, bun_test_1.expect)(approval.allowSession).toBe(false);
                return [4 /*yield*/, client.constitutionRules(sessionID)];
            case 4:
                rules = _b.sent();
                proposed = rules.find(function (rule) { return rule.source === "agent_proposed"; });
                (0, bun_test_1.expect)(proposed).toMatchObject({
                    enforcement: "deny",
                    source: "agent_proposed",
                    // EI §3.7.5 provenance: the rule is agent-proposed and user-approved.
                    proposedBy: "agent",
                    approvedBy: "user",
                });
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 5:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
(0, bun_test_1.test)("a rejected constitution rule never lands", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, sessionID, events, client, rules;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("constitution-rule-gate-reject")];
            case 1:
                root = _b.sent();
                sessionID = "ses_rule_gate_reject";
                events = [];
                client = (0, src_1.createRealRuntimeClient)({
                    workspaceRoot: root,
                    sessionID: sessionID,
                    permissionMode: "auto",
                    provider: (0, e2e_harness_1.createScriptedProvider)({
                        main: [
                            {
                                tool: function () { return ({
                                    name: "constitution_propose_rule",
                                    arguments: {
                                        statement: "never run tests",
                                        enforcement: "deny",
                                        appliesTo: { tools: ["run_tests"] },
                                    },
                                }); },
                            },
                            { text: "rule rejected" },
                        ],
                        navi: [{ text: "standby" }],
                        nia: [{ text: "standby" }],
                    }),
                });
                client.start(function (event) {
                    events.push(event);
                    if (event.type === "approval.request" &&
                        event.scope === "constitution_rule")
                        client.respondApproval({ requestID: event.id, decision: "reject" });
                });
                return [4 /*yield*/, client.sessionAttach(sessionID)];
            case 2:
                _b.sent();
                return [4 /*yield*/, client.submitAndWait("propose a rule")];
            case 3:
                _b.sent();
                return [4 /*yield*/, client.constitutionRules(sessionID)];
            case 4:
                rules = _b.sent();
                (0, bun_test_1.expect)(rules.some(function (rule) { return rule.source === "agent_proposed"; })).toBe(false);
                return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
            case 5:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); }, 30000);
