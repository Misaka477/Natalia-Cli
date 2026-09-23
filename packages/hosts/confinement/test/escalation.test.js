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
var escalation_1 = require("../src/escalation");
(0, bun_test_1.test)("the escalation targets are exactly the modes above the floor", function () {
    (0, bun_test_1.expect)(__spreadArray([], escalation_1.ESCALATION_TARGETS, true)).toEqual([
        "workspace-write",
        "danger-full-access",
    ]);
    (0, bun_test_1.expect)(escalation_1.WIDER_MODES["danger-full-access"]).toEqual([]);
    (0, bun_test_1.expect)(escalation_1.WIDER_MODES["read-only"]).toContain("workspace-write");
    // Strictly wider only: danger is never reachable from workspace-write and
    // back.
    (0, bun_test_1.expect)(escalation_1.WIDER_MODES["workspace-write"]).not.toContain("read-only");
});
(0, bun_test_1.test)("sandbox_permissions and justification travel together", function () {
    (0, bun_test_1.expect)(function () { return (0, escalation_1.validateEscalationArgs)("danger-full-access", undefined); }).toThrow(/requires a justification/);
    (0, bun_test_1.expect)(function () { return (0, escalation_1.validateEscalationArgs)(undefined, "because"); }).toThrow(/only valid together/);
    (0, bun_test_1.expect)(function () { return (0, escalation_1.validateEscalationArgs)("danger-full-access", "   "); }).toThrow(/non-empty sentence/);
    (0, bun_test_1.expect)(function () {
        return (0, escalation_1.validateEscalationArgs)("danger-full-access", "need /etc for the audit");
    }).not.toThrow();
    (0, bun_test_1.expect)(function () { return (0, escalation_1.validateEscalationArgs)(undefined, undefined); }).not.toThrow();
});
(0, bun_test_1.test)("repeating the effective mode needs no approval", function () { return __awaiter(void 0, void 0, void 0, function () {
    var asked, granted;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                asked = 0;
                return [4 /*yield*/, (0, escalation_1.approveEscalation)({
                        requestedMode: "workspace-write",
                        justification: "same as current",
                        effectiveMode: "workspace-write",
                        subject: "command",
                    }, {
                        approver: {
                            request: function () {
                                return __awaiter(this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        asked += 1;
                                        return [2 /*return*/, "allowed-once"];
                                    });
                                });
                            },
                        },
                        toolName: "run_shell",
                    })];
            case 1:
                granted = _a.sent();
                (0, bun_test_1.expect)(granted).toBe("workspace-write");
                (0, bun_test_1.expect)(asked).toBe(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a strictly wider mode asks once and grants for this call", function () { return __awaiter(void 0, void 0, void 0, function () {
    var asks, granted;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                asks = [];
                return [4 /*yield*/, (0, escalation_1.approveEscalation)({
                        requestedMode: "danger-full-access",
                        justification: "the audit tool must read /etc/hosts",
                        effectiveMode: "workspace-write",
                        subject: "command",
                    }, {
                        approver: {
                            request: function (input) {
                                return __awaiter(this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        asks.push(input);
                                        return [2 /*return*/, "allowed-once"];
                                    });
                                });
                            },
                        },
                        toolName: "run_shell",
                    })];
            case 1:
                granted = _a.sent();
                (0, bun_test_1.expect)(granted).toBe("danger-full-access");
                (0, bun_test_1.expect)(asks).toEqual([
                    {
                        requestedMode: "danger-full-access",
                        justification: "the audit tool must read /etc/hosts",
                    },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a refusal throws before anything executes (dsh texts)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var refusal;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                refusal = function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                    return [2 /*return*/, "rejected"];
                }); }); };
                return [4 /*yield*/, (0, bun_test_1.expect)((0, escalation_1.approveEscalation)({
                        requestedMode: "danger-full-access",
                        justification: "trust me",
                        effectiveMode: "workspace-write",
                        subject: "command",
                    }, { approver: { request: refusal }, toolName: "run_shell" })).rejects.toThrow('the user rejected escalating this command to "danger-full-access"')];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("no approval channel fails closed as unavailable", function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, escalation_1.approveEscalation)({
                    requestedMode: "danger-full-access",
                    justification: "trust me",
                    effectiveMode: "workspace-write",
                    subject: "command",
                }, { approver: undefined, toolName: "run_shell" })).rejects.toThrow(/no approval channel is available/u)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("narrowing is not escalation", function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, escalation_1.approveEscalation)({
                    requestedMode: "workspace-write",
                    justification: "narrower",
                    effectiveMode: "danger-full-access",
                    subject: "command",
                }, { approver: undefined, toolName: "run_shell" })).rejects.toThrow(/not strictly wider/u)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an unknown future outcome fails with a named error (fallback discipline)", function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, bun_test_1.expect)((0, escalation_1.approveEscalation)({
                    requestedMode: "danger-full-access",
                    justification: "future channel",
                    effectiveMode: "workspace-write",
                    subject: "command",
                }, {
                    approver: {
                        request: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, "quantum-granted"];
                        }); }); },
                    },
                    toolName: "run_shell",
                })).rejects.toThrow(/unknown escalation outcome: quantum-granted/u)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the model-facing markers keep the reference wording", function () {
    (0, bun_test_1.expect)((0, escalation_1.sandboxDenialMarker)("workspace-write")).toBe("[sandbox: file access denied under workspace-write mode]");
    (0, bun_test_1.expect)((0, escalation_1.escalationHintMarker)("command")).toContain("retry this exact command once with sandbox_permissions");
    (0, bun_test_1.expect)((0, escalation_1.escalationHintMarker)("command")).toContain("the approval prompt asks the user");
});
