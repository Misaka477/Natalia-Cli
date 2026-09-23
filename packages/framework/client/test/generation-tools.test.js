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
var object_store_1 = require("@natalia/object-store");
var config_1 = require("@natalia/config");
var contracts_1 = require("@natalia/contracts");
var composition_1 = require("@natalia/composition");
var platform_1 = require("@natalia/platform");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
var e2e_harness_1 = require("./e2e-harness");
var main_1 = require("../src/runtime/main");
/**
 * The L2 tool surface (NGM study §4.4) end to end through the real
 * runtime: propose -> apply (four-face gate, the tool floor asking the
 * human) -> rollback (always allowed). All gates run their real faces;
 * the scripted Nia reports on whatever plan the audit face files.
 */
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
var globalPathFor = function (root) {
    // eslint-disable-next-line no-restricted-syntax -- mirrors the tool's apply seam
    return "".concat(root, "/.natalia/global-config.json");
};
function makeWorkspace(name) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, plugin_test_helpers_1.officialPluginWorkspace)("generation-tools-".concat(name))];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
function bootOn(root_1, sessionName_1, steps_1) {
    return __awaiter(this, arguments, void 0, function (root, sessionName, steps, audits) {
        var events, client;
        if (audits === void 0) { audits = 0; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    events = [];
                    client = (0, main_1.createRealRuntimeClient)({
                        workspaceRoot: root,
                        sessionID: "ses_generation_tools_".concat(sessionName),
                        permissionMode: "auto",
                        // Hermetic config source: the tool's apply seam writes through the
                        // runtime's own global path, which must not be the (read-only here)
                        // user home.
                        globalConfigPath: (0, node_path_1.join)(root, ".natalia", "global-config.json"),
                        provider: (0, e2e_harness_1.createScriptedProvider)({
                            main: steps,
                            nia: __spreadArray(__spreadArray([], Array.from({ length: audits }, function () { return ({
                                tool: function (context) {
                                    var _a, _b;
                                    // The tool path builds its audit face internally, so there is
                                    // no capture seam to read — the plan id lives in Nia's own
                                    // context (the face's message anchors it as planID=<id>; the
                                    // runtime context's Active plan line is the fallback — a bare
                                    // /plan_/ matches the TOOL names in her persona prompt, which
                                    // is how `plan_doc_write` was once reported as the plan id).
                                    var text = JSON.stringify((_a = context.request.messages) !== null && _a !== void 0 ? _a : []);
                                    // LAST match wins: a reopened thread carries the PREVIOUS
                                    // session's audit messages too, and auditing the stale id
                                    // leaves the live plan unreported (the face then times out).
                                    var anchored = __spreadArray([], text.matchAll(/planID=(plan_[A-Za-z0-9_.:-]+)/gu), true);
                                    var active = __spreadArray([], text.matchAll(/Active plan: (plan_[^ \u00b7\n"]+)/gu), true);
                                    var match = (_b = anchored.at(-1)) !== null && _b !== void 0 ? _b : active.at(-1);
                                    // The face's sentence ends with a period — a phantom id like
                                    // "...tq." updates nothing and the runner then reports she
                                    // "ended without audit report".
                                    var planID = match === null || match === void 0 ? void 0 : match[1].replace(/\.$/u, "");
                                    if (!planID)
                                        return {
                                            id: "call_audit",
                                            name: "audit_report",
                                            arguments: JSON.stringify({
                                                planID: "probe-no-plan-id:".concat(text.slice(0, 400)),
                                                verdict: "passed",
                                            }),
                                        };
                                    return {
                                        id: "call_audit",
                                        name: "audit_report",
                                        arguments: JSON.stringify({ planID: planID, verdict: "passed" }),
                                    };
                                },
                            }); }), true), [
                                { text: "done" },
                            ], false),
                        }),
                    });
                    client.start(function (event) { return events.push(event); });
                    return [4 /*yield*/, client.sessionAttach("ses_generation_tools_".concat(sessionName))];
                case 1:
                    _a.sent();
                    // One submit drives the whole linear script — a boot without a turn
                    // would run nothing at all.
                    return [4 /*yield*/, client.submitAndWait("run the scripted generation flow")];
                case 2:
                    // One submit drives the whole linear script — a boot without a turn
                    // would run nothing at all.
                    _a.sent();
                    return [2 /*return*/, { client: client, events: events }];
            }
        });
    });
}
function boot(name_1, steps_1) {
    return __awaiter(this, arguments, void 0, function (name, steps, audits) {
        var root, resolved, _a, _b, client, events;
        if (audits === void 0) { audits = 0; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, makeWorkspace(name)];
                case 1:
                    root = _c.sent();
                    if (!(typeof steps === "function")) return [3 /*break*/, 3];
                    return [4 /*yield*/, steps(root)];
                case 2:
                    _a = _c.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _a = steps;
                    _c.label = 4;
                case 4:
                    resolved = _a;
                    return [4 /*yield*/, bootOn(root, name, resolved, audits)];
                case 5:
                    _b = _c.sent(), client = _b.client, events = _b.events;
                    return [2 /*return*/, { root: root, client: client, events: events }];
            }
        });
    });
}
function toolResults(events) {
    return events.filter(function (event) {
        return event.type === "tool.update" &&
            event.status === "succeeded" &&
            typeof event.result === "string";
    });
}
function switched(events) {
    return events.filter(function (event) { return event.type === "composition.switched"; });
}
(0, bun_test_1.test)("the generation tools register with their governance declared", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, client, events, registered, byName;
    var _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, boot("registered", [{ text: "hello" }])];
            case 1:
                _a = _f.sent(), client = _a.client, events = _a.events;
                _f.label = 2;
            case 2:
                _f.trys.push([2, , 3, 5]);
                registered = events.filter(function (event) {
                    return event.type === "tool.registered" &&
                        [
                            "propose_generation",
                            "apply_generation",
                            "rollback_generation",
                        ].includes(event.name);
                });
                (0, bun_test_1.expect)(registered).toHaveLength(3);
                byName = new Map(registered.map(function (event) { return [event.name, event]; }));
                // The study's governance: apply confirms with the human (floor),
                // propose proposes, rollback is always allowed.
                (0, bun_test_1.expect)((_b = byName.get("apply_generation")) === null || _b === void 0 ? void 0 : _b.requiresApproval).toBe(true);
                (0, bun_test_1.expect)((_c = byName.get("propose_generation")) === null || _c === void 0 ? void 0 : _c.requiresApproval).toBe(false);
                (0, bun_test_1.expect)((_d = byName.get("rollback_generation")) === null || _d === void 0 ? void 0 : _d.requiresApproval).toBe(false);
                return [3 /*break*/, 5];
            case 3: return [4 /*yield*/, ((_e = client.dispose) === null || _e === void 0 ? void 0 : _e.call(client))];
            case 4:
                _f.sent();
                return [7 /*endfinally*/];
            case 5: return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("propose stores the candidate, journals the proposal, reports impact", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, root, client, events, proposal, candidateID, store, generation, result;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, boot("propose", [
                    {
                        tool: function () { return ({
                            id: "propose",
                            name: "propose_generation",
                            arguments: {
                                configPatch: { checkpoint: { maxFiles: 4321 } },
                                plugins: [],
                                note: "raise the checkpoint file ceiling for large workspaces",
                            },
                        }); },
                    },
                    { text: "done" },
                ])];
            case 1:
                _a = _c.sent(), root = _a.root, client = _a.client, events = _a.events;
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 4, 6]);
                proposal = events.find(function (event) { return event.type === "composition.proposed"; });
                (0, bun_test_1.expect)(proposal).toMatchObject({
                    reason: "raise the checkpoint file ceiling for large workspaces",
                });
                candidateID = proposal.candidateID;
                store = new object_store_1.ObjectStore((0, platform_1.resolveWorkspaceObjectsRoot)(root));
                return [4 /*yield*/, (0, composition_1.loadGeneration)(store, candidateID)];
            case 3:
                generation = _c.sent();
                (0, bun_test_1.expect)(generation.config.checkpoint.maxFiles).toBe(4321);
                result = toolResults(events).find(function (entry) { return entry.name === "propose_generation"; });
                (0, bun_test_1.expect)(JSON.parse(result.result)).toMatchObject({
                    candidateID: candidateID,
                    effect: bun_test_1.expect.stringContaining("next session"),
                });
                return [3 /*break*/, 6];
            case 4: return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 5:
                _c.sent();
                return [7 /*endfinally*/];
            case 6: return [2 /*return*/];
        }
    });
}); }, 60000);
(0, bun_test_1.test)("apply defaults to the next session: durable, not live, not switched", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, root, client, events, result, parsed, resolved;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, boot("deferred", [
                    {
                        tool: function () { return ({
                            id: "propose",
                            name: "propose_generation",
                            arguments: {
                                configPatch: { checkpoint: { maxFiles: 4321 } },
                                note: "deferred apply candidate",
                            },
                        }); },
                    },
                    {
                        tool: function (context) {
                            var proposed = context.toolResults.find(function (entry) { return entry.toolName === "propose_generation"; });
                            if (!proposed)
                                return undefined;
                            var candidateID = JSON.parse(proposed.content).candidateID;
                            return {
                                id: "apply",
                                name: "apply_generation",
                                arguments: { candidateID: candidateID },
                            };
                        },
                    },
                    { text: "done" },
                ], 1)];
            case 1:
                _a = _c.sent(), root = _a.root, client = _a.client, events = _a.events;
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 4, 6]);
                result = toolResults(events).find(function (entry) { return entry.name === "apply_generation"; });
                (0, bun_test_1.expect)(result).toBeDefined();
                parsed = JSON.parse(result.result);
                (0, bun_test_1.expect)(parsed.verdict.result).toBe("passed"); // all four real faces
                (0, bun_test_1.expect)(parsed.stage).toBe("deferred");
                return [4 /*yield*/, (0, config_1.resolveConfig)({
                        workspaceRoot: root,
                        globalPath: globalPathFor(root),
                    })];
            case 3:
                resolved = _c.sent();
                (0, bun_test_1.expect)(resolved.config.checkpoint.maxFiles).toBe(4321);
                // Not live yet: no switch was claimed.
                (0, bun_test_1.expect)(switched(events)).toHaveLength(0);
                return [3 /*break*/, 6];
            case 4: return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 5:
                _c.sent();
                return [7 /*endfinally*/];
            case 6: return [2 /*return*/];
        }
    });
}); }, 120000);
(0, bun_test_1.test)("propose -> apply now -> apply now -> rollback restores the first candidate", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, open, proposeStep, applyStep, first, appliedA, aSwitch, second, appliedB, bSwitch, third, rollback, back, resolved, _i, open_1, client;
    var _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, makeWorkspace("flow")];
            case 1:
                root = _f.sent();
                open = [];
                _f.label = 2;
            case 2:
                _f.trys.push([2, , 9, 14]);
                proposeStep = function (marker, note, id) { return ({
                    tool: function () { return ({
                        id: id,
                        name: "propose_generation",
                        arguments: {
                            configPatch: { checkpoint: { maxFiles: marker } },
                            note: note,
                        },
                    }); },
                }); };
                applyStep = function (proposeID, applyID, reason) { return ({
                    tool: function (context) {
                        var proposed = context.toolResults.find(function (entry) { return entry.toolName === "propose_generation"; });
                        if (!proposed)
                            return undefined;
                        var candidateID = JSON.parse(proposed.content).candidateID;
                        return {
                            id: applyID,
                            name: "apply_generation",
                            arguments: { candidateID: candidateID, now: true, reason: reason },
                        };
                    },
                }); };
                void proposeStep;
                void applyStep;
                return [4 /*yield*/, bootOn(root, "flow", [
                        {
                            tool: function () { return ({
                                id: "propose-a",
                                name: "propose_generation",
                                arguments: {
                                    configPatch: { checkpoint: { maxFiles: 4321 } },
                                    note: "first candidate",
                                },
                            }); },
                        },
                        {
                            tool: function (context) {
                                var proposed = context.toolResults.find(function (entry) { return entry.toolName === "propose_generation"; });
                                if (!proposed)
                                    return undefined;
                                var candidateID = JSON.parse(proposed.content).candidateID;
                                return {
                                    id: "apply-a",
                                    name: "apply_generation",
                                    arguments: { candidateID: candidateID, now: true, reason: "flow apply a" },
                                };
                            },
                        },
                        { text: "done" },
                    ], 1)];
            case 3:
                first = _f.sent();
                appliedA = JSON.parse(toolResults(first.events)
                    .filter(function (entry) { return entry.name === "apply_generation"; })
                    .at(-1).result);
                (0, bun_test_1.expect)(appliedA.stage).toBe("applied");
                aSwitch = switched(first.events).find(function (event) { return event.reason === "flow apply a"; });
                (0, bun_test_1.expect)(aSwitch).toBeDefined();
                // Disposing flushes the session journal to the store — the reopened
                // session below must SEE this switch, so the flush happens before the
                // next attach (the finally-dispose is only the failure safety net).
                return [4 /*yield*/, ((_b = (_a = first.client).dispose) === null || _b === void 0 ? void 0 : _b.call(_a))];
            case 4:
                // Disposing flushes the session journal to the store — the reopened
                // session below must SEE this switch, so the flush happens before the
                // next attach (the finally-dispose is only the failure safety net).
                _f.sent();
                open.splice(open.indexOf(first.client), 1);
                return [4 /*yield*/, bootOn(root, "flow", [
                        {
                            tool: function () { return ({
                                id: "propose-b",
                                name: "propose_generation",
                                arguments: {
                                    configPatch: { checkpoint: { maxFiles: 8765 } },
                                    note: "second candidate",
                                },
                            }); },
                        },
                        {
                            tool: function (context) {
                                var proposed = context.toolResults.find(function (entry) { return entry.toolName === "propose_generation"; });
                                if (!proposed)
                                    return undefined;
                                var candidateID = JSON.parse(proposed.content).candidateID;
                                return {
                                    id: "apply-b",
                                    name: "apply_generation",
                                    arguments: { candidateID: candidateID, now: true, reason: "flow apply b" },
                                };
                            },
                        },
                        { text: "done" },
                    ], 1)];
            case 5:
                second = _f.sent();
                appliedB = JSON.parse(toolResults(second.events)
                    .filter(function (entry) { return entry.name === "apply_generation"; })
                    .at(-1).result);
                (0, bun_test_1.expect)(appliedB.stage).toBe("applied");
                bSwitch = switched(second.events).find(function (event) { return event.reason === "flow apply b"; });
                (0, bun_test_1.expect)(bSwitch).toBeDefined();
                (0, bun_test_1.expect)(bSwitch.from).toBe(aSwitch.to);
                return [4 /*yield*/, ((_d = (_c = second.client).dispose) === null || _d === void 0 ? void 0 : _d.call(_c))];
            case 6:
                _f.sent();
                open.splice(open.indexOf(second.client), 1);
                return [4 /*yield*/, bootOn(root, "flow", [
                        {
                            tool: { id: "rollback", name: "rollback_generation", arguments: {} },
                        },
                        { text: "done" },
                    ], 0)];
            case 7:
                third = _f.sent();
                rollback = JSON.parse(toolResults(third.events).find(function (entry) { return entry.name === "rollback_generation"; }).result);
                (0, bun_test_1.expect)(rollback.switched).toBe(true);
                (0, bun_test_1.expect)(rollback.to).toBe(aSwitch.to);
                (0, bun_test_1.expect)(rollback.from).toBe(bSwitch.to);
                back = switched(third.events).find(function (event) {
                    return event.reason.includes("rollback");
                });
                (0, bun_test_1.expect)(back).toMatchObject({
                    from: bSwitch.to,
                    to: aSwitch.to,
                });
                return [4 /*yield*/, (0, config_1.resolveConfig)({
                        workspaceRoot: root,
                        globalPath: globalPathFor(root),
                    })];
            case 8:
                resolved = _f.sent();
                (0, bun_test_1.expect)(resolved.config.checkpoint.maxFiles).toBe(4321);
                return [3 /*break*/, 14];
            case 9:
                _i = 0, open_1 = open;
                _f.label = 10;
            case 10:
                if (!(_i < open_1.length)) return [3 /*break*/, 13];
                client = open_1[_i];
                return [4 /*yield*/, ((_e = client.dispose) === null || _e === void 0 ? void 0 : _e.call(client))];
            case 11:
                _f.sent();
                _f.label = 12;
            case 12:
                _i++;
                return [3 /*break*/, 10];
            case 13: return [7 /*endfinally*/];
            case 14: return [2 /*return*/];
        }
    });
}); }, 240000);
(0, bun_test_1.test)("a candidate that drops a forbidden rule fails the gate at the tool", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, root, client, events, result, resolved;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, boot("gate-teeth", function (workspace) { return __awaiter(void 0, void 0, void 0, function () {
                    var store, id;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                store = new object_store_1.ObjectStore((0, platform_1.resolveWorkspaceObjectsRoot)(workspace));
                                return [4 /*yield*/, (0, composition_1.storeGeneration)(store, (0, composition_1.buildGeneration)({
                                        config: contracts_1.configV3Schema.parse({
                                            version: 3,
                                            checkpoint: { maxFiles: 1111 },
                                        }),
                                        catalog: [],
                                        policyRows: [], // drops every active forbidden rule
                                    }))];
                            case 1:
                                id = _a.sent();
                                return [2 /*return*/, [
                                        {
                                            tool: function () { return ({
                                                id: "apply-bad",
                                                name: "apply_generation",
                                                arguments: { candidateID: id, now: true },
                                            }); },
                                        },
                                        { text: "done" },
                                    ]];
                        }
                    });
                }); }, 1)];
            case 1:
                _a = _c.sent(), root = _a.root, client = _a.client, events = _a.events;
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 4, 6]);
                result = toolResults(events).find(function (entry) { return entry.name === "apply_generation"; });
                (0, bun_test_1.expect)(result).toBeDefined();
                (0, bun_test_1.expect)(JSON.parse(result.result)).toMatchObject({
                    switched: false,
                    stage: "gate-failed",
                });
                (0, bun_test_1.expect)(switched(events)).toHaveLength(0);
                return [4 /*yield*/, (0, config_1.resolveConfig)({
                        workspaceRoot: root,
                        globalPath: globalPathFor(root),
                    })];
            case 3:
                resolved = _c.sent();
                (0, bun_test_1.expect)(resolved.config.checkpoint.maxFiles).not.toBe(1111);
                return [3 /*break*/, 6];
            case 4: return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 5:
                _c.sent();
                return [7 /*endfinally*/];
            case 6: return [2 /*return*/];
        }
    });
}); }, 120000);
(0, bun_test_1.test)("rollback with no history says so instead of inventing a target", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, client, events, result;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, boot("no-history", [
                    { tool: { id: "rollback", name: "rollback_generation", arguments: {} } },
                    { text: "done" },
                ])];
            case 1:
                _a = _c.sent(), client = _a.client, events = _a.events;
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 3, 5]);
                result = toolResults(events).find(function (entry) { return entry.name === "rollback_generation"; });
                (0, bun_test_1.expect)(result).toBeDefined();
                (0, bun_test_1.expect)(result.result).toContain("no previous generation");
                (0, bun_test_1.expect)(switched(events)).toHaveLength(0);
                return [3 /*break*/, 5];
            case 3: return [4 /*yield*/, ((_b = client.dispose) === null || _b === void 0 ? void 0 : _b.call(client))];
            case 4:
                _c.sent();
                return [7 /*endfinally*/];
            case 5: return [2 /*return*/];
        }
    });
}); }, 60000);
