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
var contracts_1 = require("@natalia/contracts");
var composition_1 = require("@natalia/composition");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
var main_1 = require("../src/runtime/main");
var verification_faces_1 = require("../src/runtime/verification-faces");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
/**
 * The Nia audit face (study §4.3): the candidate becomes a plan document,
 * Nia audits it through the existing chat surface, her audit_report flips
 * the plan's status — and the evidence she files lands in the journal
 * whether or not the face is watching.
 *
 * The scripted provider cannot close over the planID (the FACE creates the
 * plan), so it extracts the id from the face's own message: exactly what a
 * reading Nia does.
 */
var CONFIG = contracts_1.configV3Schema.parse({
    version: 3,
    providers: {
        nia: {
            name: "Nia",
            driver: "openai-compatible",
            connection: { apiKey: "test-secret" },
        },
    },
    catalog: { providers: { nia: { models: { model: { name: "model" } } } } },
});
var RULE = {
    id: "C-NIA-001",
    statement: "审计结论必须附证据",
    scope: "release",
    priority: "critical",
    source: "policy",
    enforcement: "deny",
    overridePolicy: "forbidden",
    evidenceRefs: [],
};
function candidate() {
    return (0, composition_1.buildGeneration)({
        config: CONFIG,
        catalog: [
            { id: "natalia-tool-shell", enabled: true, fingerprint: "fp-shell" },
        ],
        policyRows: [RULE],
    });
}
function auditProvider(verdict, capture) {
    return {
        provider: "test-nia-audit",
        model: "test-nia-audit-model",
        stream: function (request) {
            return __asyncGenerator(this, arguments, function stream_1() {
                var reported;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            reported = request.messages.some(function (message) {
                                return message.role === "tool" && message.toolCallID === "call_audit";
                            });
                            if (!reported) return [3 /*break*/, 6];
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
                        case 6:
                            if (!(verdict === "silent")) return [3 /*break*/, 12];
                            return [4 /*yield*/, __await({ type: "content", text: "declining to audit" })];
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
                                        id: "call_audit",
                                        name: "audit_report",
                                        // The face reports its plan through onAuditPlan before Nia is
                                        // woken (planDocMark generates the id), exactly how the
                                        // plan-contract test captures it from the mark's return.
                                        arguments: JSON.stringify({ planID: capture.planID, verdict: verdict }),
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
    };
}
function attach(verdict) {
    return __awaiter(this, void 0, void 0, function () {
        var root, events, capture, client;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("verification-nia-".concat(verdict))];
                case 1:
                    root = _a.sent();
                    events = [];
                    capture = { planID: "" };
                    client = (0, main_1.createRealRuntimeClient)({
                        workspaceRoot: root,
                        sessionID: "ses_verification_nia_".concat(verdict),
                        permissionMode: "auto",
                        provider: auditProvider(verdict, capture),
                    });
                    client.start(function (event) { return events.push(event); });
                    return [4 /*yield*/, client.sessionAttach("ses_verification_nia_".concat(verdict))];
                case 2:
                    _a.sent();
                    return [2 /*return*/, {
                            events: events,
                            client: client,
                            capture: capture,
                            // Disposal here; workspace + plugin-store removal is the registered
                            // sweep's job (useWorkspaceCleanup) — the plugin store is a sibling
                            // directory a manual rm(workspace) would miss.
                            cleanup: function () { return __awaiter(_this, void 0, void 0, function () {
                                var _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0: return [4 /*yield*/, ((_a = client.dispose) === null || _a === void 0 ? void 0 : _a.call(client))];
                                        case 1:
                                            _b.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); },
                        }];
            }
        });
    });
}
(0, bun_test_1.test)("a passed audit turns the face green and files its evidence", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, events, client, capture, cleanup, check, evidence;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, attach("passed")];
            case 1:
                _a = _b.sent(), events = _a.events, client = _a.client, capture = _a.capture, cleanup = _a.cleanup;
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 4, 6]);
                return [4 /*yield*/, (0, verification_faces_1.niaFace)(client, {
                        timeoutMs: 20000,
                        onAuditPlan: function (planID) {
                            capture.planID = planID;
                        },
                    })(candidate())];
            case 3:
                check = _b.sent();
                (0, bun_test_1.expect)(check.check).toBe("nia");
                (0, bun_test_1.expect)(check.ok).toBe(true);
                evidence = events.filter(function (event) { return event.type === "evidence.recorded"; });
                (0, bun_test_1.expect)(evidence).toHaveLength(1);
                (0, bun_test_1.expect)(evidence[0]).toMatchObject({ status: "validated" });
                return [3 /*break*/, 6];
            case 4: return [4 /*yield*/, cleanup()];
            case 5:
                _b.sent();
                return [7 /*endfinally*/];
            case 6: return [2 /*return*/];
        }
    });
}); }, 40000);
(0, bun_test_1.test)("audit_gaps fails the face and names where the evidence is", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, client, capture, cleanup, check;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, attach("gaps")];
            case 1:
                _a = _b.sent(), client = _a.client, capture = _a.capture, cleanup = _a.cleanup;
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 4, 6]);
                return [4 /*yield*/, (0, verification_faces_1.niaFace)(client, {
                        timeoutMs: 20000,
                        onAuditPlan: function (planID) {
                            capture.planID = planID;
                        },
                    })(candidate())];
            case 3:
                check = _b.sent();
                (0, bun_test_1.expect)(check.ok).toBe(false);
                (0, bun_test_1.expect)(check.detail).toContain("audit_gaps");
                return [3 /*break*/, 6];
            case 4: return [4 /*yield*/, cleanup()];
            case 5:
                _b.sent();
                return [7 /*endfinally*/];
            case 6: return [2 /*return*/];
        }
    });
}); }, 40000);
(0, bun_test_1.test)("a Nia who never reports fails with a timeout, never a hang", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, client, capture, cleanup, check;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, attach("silent")];
            case 1:
                _a = _b.sent(), client = _a.client, capture = _a.capture, cleanup = _a.cleanup;
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 4, 6]);
                return [4 /*yield*/, (0, verification_faces_1.niaFace)(client, { timeoutMs: 1500 })(candidate())];
            case 3:
                check = _b.sent();
                (0, bun_test_1.expect)(check.ok).toBe(false);
                (0, bun_test_1.expect)(check.detail).toContain("no audit_report verdict");
                return [3 /*break*/, 6];
            case 4: return [4 /*yield*/, cleanup()];
            case 5:
                _b.sent();
                return [7 /*endfinally*/];
            case 6: return [2 /*return*/];
        }
    });
}); }, 40000);
