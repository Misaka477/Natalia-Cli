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
var interactive_waiter_1 = require("../src/interactive-waiter");
var work_ledger_1 = require("@natalia/work-ledger");
var tool = function (name) { return ({
    name: name,
    description: name,
    requiresApproval: true,
    parameters: { type: "object", properties: {} },
    execute: function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, "ok"];
            });
        });
    },
}); };
var call = function (id, name, args) {
    if (args === void 0) { args = {}; }
    return ({
        id: id,
        name: name,
        arguments: JSON.stringify(args),
    });
};
function harness(initialSession) {
    if (initialSession === void 0) { initialSession = "ses_a"; }
    var session = initialSession;
    var events = [];
    var decision = "session";
    var waiter;
    waiter = (0, interactive_waiter_1.createInteractiveWaiter)({
        publish: function (event) { return events.push(event); },
        publishForSession: function (_session, event) {
            events.push(event);
            if (event.type === "approval.request")
                waiter.respondApproval({ requestID: event.id, decision: decision });
        },
        sessionID: function () { return session; },
        sessionIDForTurn: function () { return session; },
        permissionMode: function () { return "ask"; },
        abortSignal: function () { return undefined; },
        activeTurnID: function () { return undefined; },
        isPending: function () { return false; },
        workLedger: function () {
            return (0, work_ledger_1.createWorkLedgerController)({ openFindingIDs: function () { return new Set(); } });
        },
    });
    return {
        waiter: waiter,
        events: events,
        setSession: function (value) {
            session = value;
        },
        setDecision: function (value) {
            decision = value;
        },
        approvalCount: function () {
            return events.filter(function (event) { return event.type === "approval.request"; }).length;
        },
    };
}
(0, bun_test_1.test)("session approval grants two distinct tools in one family only", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, approval;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                h = harness();
                return [4 /*yield*/, h.waiter.requireApproval("a", tool("write_file"), call("a", "write_file"), "turn_a")];
            case 1:
                _d.sent();
                return [4 /*yield*/, h.waiter.requireApproval("b", tool("edit_file"), call("b", "edit_file"), "turn_b")];
            case 2:
                _d.sent();
                (0, bun_test_1.expect)(h.approvalCount()).toBe(1);
                h.setDecision("reject");
                return [4 /*yield*/, h.waiter.requireApproval("c", tool("run_shell"), call("c", "run_shell"), "turn_c")];
            case 3:
                _d.sent();
                (0, bun_test_1.expect)(h.approvalCount()).toBe(2);
                approval = h.events.find(function (event) {
                    return event.type === "approval.request";
                });
                (0, bun_test_1.expect)((_a = approval === null || approval === void 0 ? void 0 : approval.permissionFamily) === null || _a === void 0 ? void 0 : _a.id).toBe("filesystem-write");
                (0, bun_test_1.expect)((_b = approval === null || approval === void 0 ? void 0 : approval.permissionFamily) === null || _b === void 0 ? void 0 : _b.label).toBe("Filesystem writes");
                (0, bun_test_1.expect)(typeof ((_c = approval === null || approval === void 0 ? void 0 : approval.permissionFamily) === null || _c === void 0 ? void 0 : _c.scope)).toBe("string");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("session grants are isolated by session and runtime instance", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, restarted;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                h = harness();
                return [4 /*yield*/, h.waiter.requireApproval("a", tool("write_file"), call("a", "write_file"), "turn_a")];
            case 1:
                _a.sent();
                h.setSession("ses_b");
                return [4 /*yield*/, h.waiter.requireApproval("b", tool("edit_file"), call("b", "edit_file"), "turn_b")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(h.approvalCount()).toBe(2);
                restarted = harness("ses_a");
                return [4 /*yield*/, restarted.waiter.requireApproval("restart", tool("edit_file"), call("restart", "edit_file"), "turn_restart")];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(restarted.approvalCount()).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("terminal family spans IDs and risk levels and can be revoked", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                h = harness();
                return [4 /*yield*/, h.waiter.requireApproval("low", tool("interactive_terminal_write"), call("low", "interactive_terminal_write", { id: "tty_1", input: "ls" }), "turn_low")];
            case 1:
                _a.sent();
                return [4 /*yield*/, h.waiter.requireApproval("high", tool("interactive_terminal_keys"), call("high", "interactive_terminal_keys", {
                        id: "tty_2",
                        key: "Control-C",
                    }), "turn_high")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(h.approvalCount()).toBe(1);
                (0, bun_test_1.expect)(h.waiter.revokeTerminalApprovalScope("tty_1").revoked).toBe(true);
                return [4 /*yield*/, h.waiter.requireApproval("again", tool("interactive_terminal_send_line"), call("again", "interactive_terminal_send_line", {
                        id: "tty_3",
                        text: "pwd",
                    }), "turn_again")];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(h.approvalCount()).toBe(2);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("allow-session plan acceptance skips later plan prompts", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                h = harness();
                _a = bun_test_1.expect;
                return [4 /*yield*/, h.waiter.requirePlanAcceptance({
                        approvalID: "plan-a",
                        planID: "plan_1",
                        title: "Accept Navi's plan",
                        detail: "details",
                    })];
            case 1:
                _a.apply(void 0, [_c.sent()]).toMatchObject({ decision: "session" });
                _b = bun_test_1.expect;
                return [4 /*yield*/, h.waiter.requirePlanAcceptance({
                        approvalID: "plan-b",
                        planID: "plan_2",
                        title: "Accept Navi's plan",
                        detail: "details",
                    })];
            case 2:
                _b.apply(void 0, [_c.sent()]).toMatchObject({ decision: "session" });
                (0, bun_test_1.expect)(h.approvalCount()).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plan acceptance never grants a tool family", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                h = harness();
                return [4 /*yield*/, h.waiter.requirePlanAcceptance({
                        approvalID: "plan",
                        planID: "plan_1",
                        title: "Accept",
                        detail: "details",
                    })];
            case 1:
                _a.sent();
                return [4 /*yield*/, h.waiter.requireApproval("shell", tool("run_shell"), call("shell", "run_shell"), "turn_shell")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(h.approvalCount()).toBe(2);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("responding to an approval does not write runtime state to stderr", function () { return __awaiter(void 0, void 0, void 0, function () {
    var originalError, writes, h;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                originalError = console.error;
                writes = [];
                console.error = function () {
                    var args = [];
                    for (var _i = 0; _i < arguments.length; _i++) {
                        args[_i] = arguments[_i];
                    }
                    return writes.push(args);
                };
                _a.label = 1;
            case 1:
                _a.trys.push([1, , 3, 4]);
                h = harness();
                return [4 /*yield*/, h.waiter.requireApproval("shell", tool("run_shell"), call("shell", "run_shell"), "turn_shell")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(writes).toEqual([]);
                return [3 /*break*/, 4];
            case 3:
                console.error = originalError;
                return [7 /*endfinally*/];
            case 4: return [2 /*return*/];
        }
    });
}); });
