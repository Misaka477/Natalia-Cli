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
exports.findGuardRoot = findGuardRoot;
exports.createProposeGenerationTool = createProposeGenerationTool;
exports.createApplyGenerationTool = createApplyGenerationTool;
exports.createRollbackGenerationTool = createRollbackGenerationTool;
/**
 * The agent-facing generation tools (NGM study §4.4, the L2 half of the
 * self-modification surface; `constitution_propose_rule` is the L1
 * precedent living beside them).
 *
 * - `propose_generation` builds and stores a content-addressed candidate
 *   (config patch + plugin toggles over the live composition) and journals
 *   the proposal. Nothing runs.
 * - `apply_generation` drives the full orchestration: four-face gate ->
 *   approval -> switch -> health (or rollback). Its `requiresApproval`
 *   floor IS the study's approval step (composition changes default to
 *   human confirmation); `now` is the hermes-style opt-in, the default
 *   defers to the next session.
 * - `rollback_generation` is the safety action: always allowed, no gate
 *   and no approval — a candidate must never be able to block its own
 *   undo (study: 回退永不被候选禁止).
 */
var node_fs_1 = require("node:fs");
var node_path_1 = require("node:path");
var object_store_1 = require("@natalia/object-store");
var config_1 = require("@natalia/config");
var composition_1 = require("@natalia/composition");
var platform_1 = require("@natalia/platform");
var collab_1 = require("@natalia/collab");
var config_reload_1 = require("./config-reload");
var verification_faces_1 = require("./verification-faces");
function activeExec(ctx) {
    return ctx.ports.getActiveExec();
}
function workspaceRoot(ctx) {
    return ctx.ports.getWorkspaceRoot();
}
function objectStore(ctx) {
    return new object_store_1.ObjectStore((0, platform_1.resolveWorkspaceObjectsRoot)(workspaceRoot(ctx)));
}
/**
 * The nearest directory above the workspace whose package.json declares the
 * guard chain — the architecture face's root. Not found means the candidate
 * cannot be checked against the architecture at all, which fails the face
 * loudly rather than passing it silently.
 */
function findGuardRoot(start) {
    var _a;
    var current = (0, node_path_1.resolve)(start);
    for (;;) {
        var manifest = joinManifest(current);
        if (manifest) {
            try {
                var parsed = JSON.parse((0, node_fs_1.readFileSync)(manifest, "utf8"));
                if ((_a = parsed.scripts) === null || _a === void 0 ? void 0 : _a["guard:imports"])
                    return current;
            }
            catch (_b) {
                /* unreadable manifest: keep walking */
            }
        }
        var parent_1 = (0, node_path_1.dirname)(current);
        if (parent_1 === current)
            return undefined;
        current = parent_1;
    }
}
function joinManifest(dir) {
    var manifest = joinSafe(dir, "package.json");
    return (0, node_fs_1.existsSync)(manifest) ? manifest : undefined;
}
function joinSafe(dir, file) {
    return (0, node_path_1.resolve)(dir, file);
}
function guardsFaceFor(ctx) {
    var _a;
    var root = (_a = findGuardRoot(workspaceRoot(ctx))) !== null && _a !== void 0 ? _a : findGuardRoot(process.cwd());
    if (!root)
        return function () { return ({
            check: "guards",
            ok: false,
            detail: "no guard root above the workspace — the candidate cannot be verified against the architecture here",
        }); };
    return (0, composition_1.guardsFace)({ repoRoot: root });
}
function niaSurfaces(ctx) {
    var planDoc = ctx.ports.planDocRuntime;
    return {
        planDocWrite: planDoc.planDocWrite.bind(planDoc),
        planDocMark: planDoc.planDocMark.bind(planDoc),
        planDocActivate: planDoc.planDocActivate.bind(planDoc),
        planDocStatus: planDoc.planDocStatus.bind(planDoc),
        niaChat: (0, collab_1.createNiaChatSurface)(ctx),
    };
}
/** The candidate's journal handle plus the pointer links a switch needs. */
function generationPointers(ctx) {
    var _a, _b;
    var events = (_b = (_a = activeExec(ctx)) === null || _a === void 0 ? void 0 : _a.session.events) !== null && _b !== void 0 ? _b : [];
    return (0, composition_1.deriveCompositionPointer)(events);
}
function createProposeGenerationTool(ctx) {
    return {
        name: "propose_generation",
        description: "Propose a composition change (L2 self-modification): a config patch and/or plugin enable/disable list, built as a content-addressed candidate and journaled as composition.proposed. Nothing changes until apply_generation passes the verification gate; the summary tells you how many live sessions the change would affect.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                configPatch: {
                    type: "object",
                    description: "Partial config overlay merged over the running config (project-scoped rows land in the workspace config; global-model rows in the user's global config).",
                },
                plugins: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            enabled: { type: "boolean" },
                        },
                        required: ["id", "enabled"],
                        additionalProperties: false,
                    },
                    description: "Desired enabled state for plugins by id.",
                },
                note: {
                    type: "string",
                    description: "One sentence: why this change is being proposed.",
                },
            },
            additionalProperties: false,
        },
        execute: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var args, live, merged, catalog, _loop_1, _i, _a, override, state_1, candidate, candidateID, sessions;
                var _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            args = input;
                            if (typeof args.note !== "string" || !args.note.trim())
                                return [2 /*return*/, "propose_generation requires a non-empty note (the journal records why)"];
                            live = ctx.ports.getTsRuntimeConfig();
                            if (!live)
                                return [2 /*return*/, "no running config to propose a change against"];
                            merged = (args.configPatch ? (0, config_1.mergeConfig)(live, args.configPatch) : live);
                            catalog = ctx.ports
                                .getPluginsController()
                                .catalog()
                                .map(function (entry) { return (__assign({}, entry)); });
                            _loop_1 = function (override) {
                                var target = catalog.find(function (entry) { return entry.id === override.id; });
                                if (!target)
                                    return { value: "unknown plugin id: ".concat(override.id, " (not in the desired catalog)") };
                                target.enabled = override.enabled;
                            };
                            for (_i = 0, _a = (_b = args.plugins) !== null && _b !== void 0 ? _b : []; _i < _a.length; _i++) {
                                override = _a[_i];
                                state_1 = _loop_1(override);
                                if (typeof state_1 === "object")
                                    return [2 /*return*/, state_1.value];
                            }
                            candidate = (0, composition_1.buildGeneration)({
                                config: merged,
                                catalog: catalog,
                                policyRows: (0, config_reload_1.activeConstitutionRows)(ctx),
                            });
                            return [4 /*yield*/, (0, composition_1.storeGeneration)(objectStore(ctx), candidate)];
                        case 1:
                            candidateID = _c.sent();
                            ctx.ports.publish({
                                type: "composition.proposed",
                                candidateID: candidateID,
                                reason: args.note,
                            });
                            sessions = __spreadArray([], ctx.ports.getExecutionBySession().values(), true).length;
                            return [2 /*return*/, JSON.stringify({
                                    candidateID: candidateID,
                                    sessionsAffected: sessions,
                                    effect: "nothing runs yet — apply_generation verifies and switches (default: effective next session; now: opt in)",
                                    note: args.note,
                                })];
                    }
                });
            });
        },
    };
}
function createApplyGenerationTool(ctx) {
    return {
        name: "apply_generation",
        description: "Apply a proposed generation: run the four-face verification gate (constitution, architecture guards, isolated smoke boot, Nia audit), then switch. This call itself requires approval at the tool floor — composition changes confirm with the human by default. Without now=true the switch is durable but takes effect at the next session; a failed post-switch health check rolls back automatically and records the incident.",
        requiresApproval: true,
        parameters: {
            type: "object",
            properties: {
                candidateID: {
                    type: "string",
                    description: "The proposed generation's content id.",
                },
                now: {
                    type: "boolean",
                    description: "Opt in to taking the switch live immediately instead of at the next session boundary.",
                },
                reason: { type: "string", description: "Why this switch is applied." },
            },
            required: ["candidateID"],
            additionalProperties: false,
        },
        execute: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var args, live, candidate, pointer, result;
                var _this = this;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            args = input;
                            if (typeof args.candidateID !== "string")
                                return [2 /*return*/, "apply_generation requires candidateID"];
                            live = ctx.ports.getTsRuntimeConfig();
                            if (!live)
                                return [2 /*return*/, "no running config to switch away from"];
                            return [4 /*yield*/, (0, composition_1.loadGeneration)(objectStore(ctx), args.candidateID)];
                        case 1:
                            candidate = _b.sent();
                            pointer = generationPointers(ctx);
                            return [4 /*yield*/, (0, composition_1.switchGeneration)(__assign(__assign({ candidateID: args.candidateID, candidate: candidate, activeRules: (0, config_reload_1.activeConstitutionRows)(ctx), faces: {
                                        guards: guardsFaceFor(ctx),
                                        smoke: (0, verification_faces_1.smokeFace)(),
                                        nia: (0, verification_faces_1.niaFace)(niaSurfaces(ctx)),
                                    }, reason: (_a = args.reason) !== null && _a !== void 0 ? _a : "apply_generation", when: args.now ? "now" : "next-session" }, (pointer.current ? { currentGenerationID: pointer.current } : {})), { currentConfig: live, 
                                    // The tool's requiresApproval floor already asked the human — the
                                    // study routes composition approval through the approval floors,
                                    // not a second bespoke channel.
                                    requestApproval: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                        return [2 /*return*/, "granted"];
                                    }); }); }, applyConfig: function (config) { return __awaiter(_this, void 0, void 0, function () {
                                        var _a, _b;
                                        return __generator(this, function (_c) {
                                            switch (_c.label) {
                                                case 0: return [4 /*yield*/, (0, config_1.updateConfigAtScope)(workspaceRoot(ctx), config, "project", {
                                                        globalPath: (_b = (_a = ctx.ports).configGlobalPath) === null || _b === void 0 ? void 0 : _b.call(_a),
                                                    })];
                                                case 1:
                                                    _c.sent();
                                                    return [2 /*return*/];
                                            }
                                        });
                                    }); }, reloadRuntime: function () { return __awaiter(_this, void 0, void 0, function () {
                                        return __generator(this, function (_a) {
                                            switch (_a.label) {
                                                case 0: return [4 /*yield*/, ctx.ports.reloadConfigFromDisk()];
                                                case 1:
                                                    _a.sent();
                                                    return [2 /*return*/];
                                            }
                                        });
                                    }); }, healthCheck: function () { return __awaiter(_this, void 0, void 0, function () {
                                        return __generator(this, function (_a) {
                                            switch (_a.label) {
                                                case 0: return [4 /*yield*/, ctx.ports.getReady()];
                                                case 1:
                                                    _a.sent();
                                                    return [2 /*return*/, { ok: Boolean(ctx.ports.getTsRuntimeConfig()) }];
                                            }
                                        });
                                    }); }, publish: function (event) { return ctx.ports.publish(event); } }))];
                        case 2:
                            result = _b.sent();
                            return [2 /*return*/, JSON.stringify(__assign(__assign(__assign({ switched: result.switched, stage: result.stage }, (result.detail ? { detail: result.detail } : {})), { verdict: {
                                        result: result.verdict.verdict,
                                        checks: result.verdict.checks,
                                    } }), (result.stage === "deferred"
                                    ? { effect: "durable now — live from the next session" }
                                    : {})))];
                    }
                });
            });
        },
    };
}
function createRollbackGenerationTool(ctx) {
    return {
        name: "rollback_generation",
        description: "Roll the composition back to a previous generation (default: the one before the current). Always allowed: no verification gate and no approval — a rollback must never be blocked by the candidate it undoes. Journals composition.switched back.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                to: {
                    type: "string",
                    description: "Target generation id; defaults to the previous generation.",
                },
                reason: {
                    type: "string",
                    description: "Why the rollback is happening.",
                },
            },
            additionalProperties: false,
        },
        execute: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var args, pointer, target, live, generation;
                var _a, _b, _c, _d;
                return __generator(this, function (_e) {
                    switch (_e.label) {
                        case 0:
                            args = input;
                            pointer = generationPointers(ctx);
                            target = (_a = args.to) !== null && _a !== void 0 ? _a : pointer.previous;
                            if (!target)
                                return [2 /*return*/, "rollback_generation: no previous generation is recorded and no target was given"];
                            if (pointer.current === target)
                                return [2 /*return*/, JSON.stringify({
                                        switched: false,
                                        reason: "already current",
                                        to: target,
                                    })];
                            live = ctx.ports.getTsRuntimeConfig();
                            if (!live)
                                return [2 /*return*/, "no running config to roll back from"];
                            return [4 /*yield*/, (0, composition_1.loadGeneration)(objectStore(ctx), target)];
                        case 1:
                            generation = _e.sent();
                            return [4 /*yield*/, (0, config_1.updateConfigAtScope)(workspaceRoot(ctx), generation.config, "project", {
                                    globalPath: (_c = (_b = ctx.ports).configGlobalPath) === null || _c === void 0 ? void 0 : _c.call(_b),
                                })];
                        case 2:
                            _e.sent();
                            return [4 /*yield*/, ctx.ports.reloadConfigFromDisk()];
                        case 3:
                            _e.sent();
                            ctx.ports.publish(__assign(__assign({ type: "composition.switched" }, (pointer.current ? { from: pointer.current } : {})), { to: target, reason: (_d = args.reason) !== null && _d !== void 0 ? _d : "rollback_generation" }));
                            return [2 /*return*/, JSON.stringify({
                                    switched: true,
                                    to: target,
                                    from: pointer.current,
                                })];
                    }
                });
            });
        },
    };
}
