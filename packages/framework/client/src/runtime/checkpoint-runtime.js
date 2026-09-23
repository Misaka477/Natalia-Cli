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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckpointRuntime = createCheckpointRuntime;
/**
 * Checkpoint controllers per session — runtime/checkpoint-runtime module.
 *
 * Resolves the checkpoint plugin service at call time. The plugin owns the
 * per-session controller lifecycle; this runtime module never retains a
 * concrete plugin controller.
 */
var runtime_services_1 = require("@natalia/runtime-services");
var work_ledger_1 = require("@natalia/work-ledger");
var runtime_status_1 = require("@natalia/runtime-status");
var checkpoint_1 = require("@anthelia/checkpoint");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var operation_log_1 = require("@natalia/operation-log");
function appendCheckpointMutation(ctx, sessionID, path, operation) {
    return __awaiter(this, void 0, void 0, function () {
        var logPath, rows, _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    _e.trys.push([0, 7, , 8]);
                    logPath = (0, node_path_1.resolve)(ctx.ports.getWorkspaceRoot(), ".natalia", "workspace-mutations.json");
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.dirname)(logPath), { recursive: true })];
                case 1:
                    _e.sent();
                    rows = [];
                    _e.label = 2;
                case 2:
                    _e.trys.push([2, 4, , 5]);
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, (0, promises_1.readFile)(logPath, "utf8")];
                case 3:
                    rows = _b.apply(_a, [_e.sent()]);
                    return [3 /*break*/, 5];
                case 4:
                    _c = _e.sent();
                    rows = [];
                    return [3 /*break*/, 5];
                case 5:
                    rows.push({
                        id: "mut_".concat(Date.now().toString(36)),
                        at: new Date().toISOString(),
                        workspaceRoot: ctx.ports.getWorkspaceRoot(),
                        sessionID: sessionID,
                        path: path,
                        operation: operation,
                        origin: "checkpoint_rollback",
                    });
                    return [4 /*yield*/, (0, promises_1.writeFile)(logPath, JSON.stringify(rows, null, 2))];
                case 6:
                    _e.sent();
                    return [3 /*break*/, 8];
                case 7:
                    _d = _e.sent();
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    });
}
function createCheckpointRuntime(ctx) {
    return {
        checkpointControllerFor: checkpointControllerFor,
        initializeCheckpointController: initializeCheckpointController,
        checkpointList: checkpointList,
        checkpointListByKind: checkpointListByKind,
        auditRounds: auditRounds,
        roundDiff: roundDiff,
        checkpointPreview: checkpointPreview,
        checkpointRollback: checkpointRollback,
        checkpointRename: checkpointRename,
        createSafetyCheckpoint: createSafetyCheckpoint,
        workspaceDiff: workspaceDiff,
    };
    function requireInitializedController(sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var owner, _a, _b, controller;
            var _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, ctx.ports.getReady()];
                    case 1:
                        _d.sent();
                        if (!sessionID) return [3 /*break*/, 5];
                        if (!((_c = ctx.ports.getExecutionBySession().get(sessionID)) !== null && _c !== void 0)) return [3 /*break*/, 2];
                        _b = _c;
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, ctx.ports.ensureExecution(sessionID)];
                    case 3:
                        _b = (_d.sent());
                        _d.label = 4;
                    case 4:
                        _a = (_b);
                        return [3 /*break*/, 6];
                    case 5:
                        _a = ctx.ports.getActiveExec();
                        _d.label = 6;
                    case 6:
                        owner = _a;
                        if (!owner)
                            throw new Error("session is not initialized");
                        return [4 /*yield*/, initializeCheckpointController(owner)];
                    case 7:
                        controller = _d.sent();
                        if (!controller)
                            throw new Error("checkpoint controller unavailable (natalia-checkpoint)");
                        return [2 /*return*/, { controller: controller, owner: owner }];
                }
            });
        });
    }
    function checkpointList(sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var controller;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, requireInitializedController(sessionID)];
                    case 1:
                        controller = (_a.sent()).controller;
                        return [4 /*yield*/, controller.list()];
                    case 2: return [2 /*return*/, (_a.sent()).map(toRuntimeCheckpoint)];
                }
            });
        });
    }
    function checkpointListByKind(kind, sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var controller;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, requireInitializedController(sessionID)];
                    case 1:
                        controller = (_a.sent()).controller;
                        return [4 /*yield*/, controller.listCheckpointsByKind(kind)];
                    case 2: return [2 /*return*/, (_a.sent()).map(toRuntimeCheckpoint)];
                }
            });
        });
    }
    function auditRounds(planID) {
        return __awaiter(this, void 0, void 0, function () {
            var controller;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, requireInitializedController()];
                    case 1:
                        controller = (_a.sent()).controller;
                        return [4 /*yield*/, controller.listAuditRounds(planID)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function roundDiff(input) {
        return __awaiter(this, void 0, void 0, function () {
            var controller;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, requireInitializedController()];
                    case 1:
                        controller = (_a.sent()).controller;
                        return [4 /*yield*/, controller.diffCheckpoints(input.from, input.to, {
                                paths: input.paths,
                                includePatch: input.includePatch,
                                includeContent: input.includeContent,
                                maxFiles: input.maxFiles,
                                maxPatchChars: input.maxPatchChars,
                            })];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function checkpointPreview(id, sessionID, options) {
        return __awaiter(this, void 0, void 0, function () {
            var controller, preview;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, requireInitializedController(sessionID)];
                    case 1:
                        controller = (_a.sent()).controller;
                        return [4 /*yield*/, controller.preview(id)];
                    case 2:
                        preview = _a.sent();
                        if ((options === null || options === void 0 ? void 0 : options.includePatch) === false) {
                            return [2 /*return*/, __assign(__assign({}, preview), { changes: preview.changes.map(function (change) {
                                        var _a, _b;
                                        return (__assign(__assign(__assign(__assign({ kind: change.kind, path: change.path }, (change.oldPath ? { oldPath: change.oldPath } : {})), (change.mode ? { mode: change.mode } : {})), { additions: (_a = change.additions) !== null && _a !== void 0 ? _a : 0, deletions: (_b = change.deletions) !== null && _b !== void 0 ? _b : 0 }), (change.structured ? { structured: change.structured } : {})));
                                    }) })];
                        }
                        return [2 /*return*/, preview];
                }
            });
        });
    }
    function workspaceDiff(input) {
        return __awaiter(this, void 0, void 0, function () {
            var controller, changes;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, requireInitializedController()];
                    case 1:
                        controller = (_a.sent()).controller;
                        return [4 /*yield*/, controller.workspaceDiff()];
                    case 2:
                        changes = _a.sent();
                        if ((input === null || input === void 0 ? void 0 : input.includePatch) === false) {
                            return [2 /*return*/, changes.map(function (change) { return (__assign(__assign(__assign({ path: change.path, operation: change.operation }, (change.oldPath ? { oldPath: change.oldPath } : {})), { additions: 0, deletions: 0 }), (change.structured ? { structured: change.structured } : {}))); })];
                        }
                        return [2 /*return*/, changes];
                }
            });
        });
    }
    function checkpointRollback(input) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, controller, owner, preview, _i, _b, change, status, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0: return [4 /*yield*/, requireInitializedController(input.sessionID)];
                    case 1:
                        _a = _f.sent(), controller = _a.controller, owner = _a.owner;
                        return [4 /*yield*/, controller.rollback(input.id, {
                                dryRun: input.dryRun,
                            })];
                    case 2:
                        preview = _f.sent();
                        if (!input.dryRun) {
                            for (_i = 0, _b = preview.changes; _i < _b.length; _i++) {
                                change = _b[_i];
                                void appendCheckpointMutation(ctx, owner.session.id, change.path, change.kind === "add"
                                    ? "add"
                                    : change.kind === "delete"
                                        ? "delete"
                                        : change.kind === "rename"
                                            ? "rename"
                                            : "modify");
                            }
                        }
                        status = ctx.state.serviceDirectory.get(runtime_status_1.statusSnapshotController);
                        _d = (_c = ctx.ports).publishForSession;
                        _e = [owner];
                        return [4 /*yield*/, status.snapshotFor({
                                provider: owner.provider,
                                context: owner.context,
                                permissionMode: owner.permissionMode,
                            })];
                    case 3:
                        _d.apply(_c, _e.concat([_f.sent()]));
                        return [2 /*return*/, preview];
                }
            });
        });
    }
    function checkpointRename(input) {
        return __awaiter(this, void 0, void 0, function () {
            var controller, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, requireInitializedController(input.sessionID)];
                    case 1:
                        controller = (_b.sent()).controller;
                        _a = toRuntimeCheckpoint;
                        return [4 /*yield*/, controller.rename(input.id, input.name)];
                    case 2: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
                }
            });
        });
    }
    function createSafetyCheckpoint() {
        return __awaiter(this, void 0, void 0, function () {
            var _a, controller, owner, record;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, requireInitializedController()];
                    case 1:
                        _a = _b.sent(), controller = _a.controller, owner = _a.owner;
                        if (!controller.isEnabled())
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, controller.createCheckpoint({
                                reason: "rollback_safety",
                                context: owner.context,
                                step: owner.context.journalStatus().messageCount,
                                status: "rollback_safety",
                            })];
                    case 2:
                        record = _b.sent();
                        if (!record.complete)
                            throw new Error("rollback safety checkpoint is incomplete; refusing message rollback");
                        return [2 /*return*/, record.id];
                }
            });
        });
    }
    function toRuntimeCheckpoint(record) {
        return __assign(__assign({ id: record.id, sequence: record.sequence, turnID: record.turnID, stepID: record.stepID, step: record.step, reason: record.reason }, (record.name ? { name: record.name } : {})), { createdAt: record.createdAt, complete: record.complete, errors: record.errors, files: record.manifestMeta.entryCount, changes: record.changes.length, 
            // `list()` omits the ledger entries; the scalar header carries the token
            // estimate so the list surface stays cheap.
            tokenEstimate: record.contextMeta.tokenEstimate, diskUsageBytes: record.diskUsageBytes });
    }
    function checkpointControllerFor(exec) {
        var _a = ctx.ports, getTsRuntimeConfig = _a.getTsRuntimeConfig, publishForSession = _a.publishForSession;
        var id = exec.session.id;
        var factory = ctx.state.serviceDirectory.getOptional(checkpoint_1.checkpointFactory);
        if (!factory)
            return undefined;
        ctx.state.serviceDirectory.get(work_ledger_1.workLedgerController);
        return factory({
            sessionID: function () { return id; },
            checkpoint: function () { var _a; return (_a = getTsRuntimeConfig()) === null || _a === void 0 ? void 0 : _a.checkpoint; },
            workspace: function () { var _a; return (_a = getTsRuntimeConfig()) === null || _a === void 0 ? void 0 : _a.workspace; },
            publish: function (event) { return publishForSession(exec, event); },
            context: function () { return exec.context; },
            subagents: function () {
                var subagents = ctx.state.serviceDirectory.getOptional(runtime_services_1.subagentsService);
                return (subagents === null || subagents === void 0 ? void 0 : subagents.enabled()) ? subagents : undefined;
            },
            activeAbort: function () { return exec.activeAbort; },
            workLedger: function () { return ctx.state.serviceDirectory.get(work_ledger_1.workLedgerController); },
        });
    }
    function initializeCheckpointController(exec) {
        return __awaiter(this, void 0, void 0, function () {
            var controller, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        controller = checkpointControllerFor(exec);
                        if (!controller)
                            return [2 /*return*/, undefined];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, controller.init()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _a.sent();
                        // A missing or corrupt checkpoint chunk must not take the whole runtime
                        // ready path down: transcript, model selection, session attach and the
                        // UI do not depend on checkpointing. Keep the session usable and surface
                        // the checkpoint failure instead of failing every RPC.
                        (0, operation_log_1.logOf)(ctx.state.serviceDirectory).warn("checkpoint", "controller init failed; continuing without checkpoints", { detail: error_1 instanceof Error ? error_1.message : String(error_1) });
                        return [2 /*return*/, undefined];
                    case 4: return [2 /*return*/, controller];
                }
            });
        });
    }
}
