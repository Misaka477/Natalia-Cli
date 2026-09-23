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
var node_path_1 = require("node:path");
var object_store_1 = require("@natalia/object-store");
var config_1 = require("@natalia/config");
var contracts_1 = require("@natalia/contracts");
var composition_1 = require("@natalia/composition");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
var e2e_harness_1 = require("./e2e-harness");
var main_1 = require("../src/runtime/main");
var verification_faces_1 = require("../src/runtime/verification-faces");
/**
 * The P2 acceptance (master plan §3): one candidate build -> verify ->
 * switch -> rollback, journal-observable end to end, with ALL FOUR gate
 * faces real — the repo's guard chain actually spawned, a nested runtime
 * actually booted, Nia actually audited through the live chat surface.
 */
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
var RULE = {
    id: "C-P2-001",
    statement: "世代切换必须过验证闸",
    scope: "release",
    priority: "critical",
    source: "master_plan",
    enforcement: "deny",
    overridePolicy: "forbidden",
    evidenceRefs: [],
};
function acceptance(name, 
// The client is passed IN (the caller's own destructuring would still be
// in its temporal dead zone when the health check runs).
health) {
    return __awaiter(this, void 0, void 0, function () {
        var root, globalPath, events, capture, client, store, currentConfig, currentID, candidate, candidateID, result;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("p2-acceptance-".concat(name))];
                case 1:
                    root = _a.sent();
                    globalPath = (0, node_path_1.join)(root, ".natalia", "global-config.json");
                    events = [];
                    capture = { planID: "" };
                    client = (0, main_1.createRealRuntimeClient)({
                        workspaceRoot: root,
                        sessionID: "ses_p2_acceptance_".concat(name),
                        permissionMode: "auto",
                        provider: (0, e2e_harness_1.createScriptedProvider)({
                            nia: [
                                {
                                    // select only while no audit result has come back — the script
                                    // provider's call counter starts at 1, so an index check would
                                    // never fire ("model repeatedly ended without audit report").
                                    when: function (context) {
                                        return !context.toolResults.some(function (result) { return result.toolCallID === "call_audit"; });
                                    },
                                    tool: function () { return ({
                                        id: "call_audit",
                                        name: "audit_report",
                                        // arguments are built at yield time, after the face reported
                                        // its plan through onAuditPlan.
                                        arguments: JSON.stringify({
                                            planID: capture.planID,
                                            verdict: "passed",
                                        }),
                                    }); },
                                },
                                { text: "done" },
                            ],
                        }),
                    });
                    client.start(function (event) { return events.push(event); });
                    return [4 /*yield*/, client.sessionAttach("ses_p2_acceptance_".concat(name))];
                case 2:
                    _a.sent();
                    store = new object_store_1.ObjectStore((0, node_path_1.join)(root, ".acceptance-objects"));
                    currentConfig = contracts_1.configV3Schema.parse({ version: 3 });
                    return [4 /*yield*/, (0, composition_1.storeGeneration)(store, (0, composition_1.buildGeneration)({
                            config: currentConfig,
                            catalog: [],
                            policyRows: [RULE],
                        }))];
                case 3:
                    currentID = _a.sent();
                    candidate = (0, composition_1.buildGeneration)({
                        // A PROJECT-scoped marker: global-model keys (defaultModel, catalog…)
                        // would route part of the write to ~/.natalia/config.json, which this
                        // harness's read-only home refuses — and the product rule is that the
                        // workspace's own file is where a workspace-scoped switch lands.
                        config: contracts_1.configV3Schema.parse({
                            version: 3,
                            checkpoint: { maxFiles: 12345 },
                        }),
                        catalog: [],
                        policyRows: [RULE],
                    });
                    return [4 /*yield*/, (0, composition_1.storeGeneration)(store, candidate)];
                case 4:
                    candidateID = _a.sent();
                    return [4 /*yield*/, (0, composition_1.switchGeneration)({
                            candidateID: candidateID,
                            candidate: candidate,
                            activeRules: [RULE],
                            faces: {
                                guards: (0, composition_1.guardsFace)({ repoRoot: process.cwd() }),
                                smoke: (0, verification_faces_1.smokeFace)(),
                                nia: (0, verification_faces_1.niaFace)(client, {
                                    timeoutMs: 30000,
                                    onAuditPlan: function (planID) {
                                        capture.planID = planID;
                                    },
                                }),
                            },
                            reason: "p2 acceptance ".concat(name),
                            when: "now",
                            currentGenerationID: currentID,
                            currentConfig: currentConfig,
                            requestApproval: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/, "granted"];
                            }); }); },
                            applyConfig: function (config) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: 
                                        // An explicit globalPath keeps every write inside the workspace: the
                                        // default global config lives under the user's home, which this
                                        // harness mounts read-only (a real user's home is writable — the
                                        // product path is unchanged).
                                        return [4 /*yield*/, (0, config_1.updateConfigAtScope)(root, config, "project", { globalPath: globalPath })];
                                        case 1:
                                            // An explicit globalPath keeps every write inside the workspace: the
                                            // default global config lives under the user's home, which this
                                            // harness mounts read-only (a real user's home is writable — the
                                            // product path is unchanged).
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); },
                            reloadRuntime: function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, client.reloadConfig()];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            }); },
                            healthCheck: function () { return health(client, root); },
                            publish: function (event) { return events.push(event); },
                        })];
                case 5:
                    result = _a.sent();
                    return [2 /*return*/, { root: root, client: client, events: events, result: result, candidateID: candidateID, currentID: currentID }];
            }
        });
    });
}
function orchestratorSwitches(events, reason) {
    return events.filter(function (event) {
        return event.type === "composition.switched" && event.reason.startsWith(reason);
    });
}
(0, bun_test_1.test)("P2 acceptance: build -> verify -> switch, journal-observable", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, root, client, events, result, candidateID, currentID, verified, switched, resolved;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, acceptance("apply", function (running) { return __awaiter(void 0, void 0, void 0, function () {
                    var _a;
                    var _b;
                    var _c;
                    return __generator(this, function (_d) {
                        switch (_d.label) {
                            case 0:
                                _b = {};
                                _a = Boolean;
                                return [4 /*yield*/, ((_c = running.runtimeStatus) === null || _c === void 0 ? void 0 : _c.call(running))];
                            case 1: return [2 /*return*/, (_b.ok = _a.apply(void 0, [_d.sent()]),
                                    _b)];
                        }
                    });
                }); })];
            case 1:
                _a = _c.sent(), root = _a.root, client = _a.client, events = _a.events, result = _a.result, candidateID = _a.candidateID, currentID = _a.currentID;
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 4, 6]);
                verified = events.find(function (event) { return event.type === "composition.verified"; });
                (0, bun_test_1.expect)(verified).toMatchObject({
                    verdict: "passed",
                    checks: [
                        { check: "constitution", ok: true },
                        { check: "guards", ok: true },
                        { check: "smoke", ok: true },
                        { check: "nia", ok: true },
                    ],
                });
                (0, bun_test_1.expect)(result.stage).toBe("applied");
                (0, bun_test_1.expect)(result.switched).toBe(true);
                switched = orchestratorSwitches(events, "p2 acceptance apply");
                (0, bun_test_1.expect)(switched).toHaveLength(1);
                (0, bun_test_1.expect)(switched[0]).toMatchObject({ from: currentID, to: candidateID });
                return [4 /*yield*/, (0, config_1.resolveConfig)({
                        workspaceRoot: root,
                        globalPath: (0, node_path_1.join)(root, ".natalia", "global-config.json"),
                    })];
            case 3:
                resolved = _c.sent();
                (0, bun_test_1.expect)(resolved.config.checkpoint.maxFiles).toBe(12345);
                // The live runtime reloaded it (the reload producer's own notice).
                (0, bun_test_1.expect)(events.some(function (event) {
                    return event.type === "context.instructions" &&
                        event.kind === "config_reload";
                })).toBe(true);
                // Nia's audit evidence is in the stream.
                (0, bun_test_1.expect)(events.filter(function (event) { return event.type === "evidence.recorded"; })).toHaveLength(1);
                return [3 /*break*/, 6];
            case 4: return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 5:
                _c.sent();
                return [7 /*endfinally*/];
            case 6: return [2 /*return*/];
        }
    });
}); }, 120000);
(0, bun_test_1.test)("P2 acceptance: a failed health check rolls back, journal-observable", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, root, client, events, result, out, back, resolved;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, acceptance("rollback", function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        return [2 /*return*/, ({
                                ok: false,
                                detail: "acceptance: simulated post-switch fault",
                            })];
                    });
                }); })];
            case 1:
                _a = _c.sent(), root = _a.root, client = _a.client, events = _a.events, result = _a.result;
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 4, 6]);
                (0, bun_test_1.expect)(result.stage).toBe("rolled-back");
                (0, bun_test_1.expect)(result.switched).toBe(false);
                out = orchestratorSwitches(events, "p2 acceptance rollback")[0];
                back = orchestratorSwitches(events, "health-check-failed: automatic rollback")[0];
                (0, bun_test_1.expect)(out).toBeDefined();
                (0, bun_test_1.expect)(back).toBeDefined();
                // Out to the candidate, straight back to the current generation.
                (0, bun_test_1.expect)(back.from).toBeDefined();
                (0, bun_test_1.expect)(back.reason).toContain("automatic rollback");
                // The error-level incident names the candidate that was reverted.
                (0, bun_test_1.expect)(events.find(function (event) { return event.type === "diagnostic" && event.level === "error"; })).toMatchObject({
                    message: bun_test_1.expect.stringContaining("rolled back to the previous composition"),
                });
                return [4 /*yield*/, (0, config_1.resolveConfig)({
                        workspaceRoot: root,
                        globalPath: (0, node_path_1.join)(root, ".natalia", "global-config.json"),
                    })];
            case 3:
                resolved = _c.sent();
                (0, bun_test_1.expect)(resolved.config.checkpoint.maxFiles).not.toBe(12345);
                void out;
                return [3 /*break*/, 6];
            case 4: return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 5:
                _c.sent();
                return [7 /*endfinally*/];
            case 6: return [2 /*return*/];
        }
    });
}); }, 120000);
