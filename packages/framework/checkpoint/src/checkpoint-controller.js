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
exports.createCheckpointController = createCheckpointController;
var runtime_1 = require("@natalia/runtime");
/** Owns one session's durable checkpoint store and rollback policy. */
function createCheckpointController(input) {
    var store;
    var initPromise;
    function init() {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        initPromise !== null && initPromise !== void 0 ? initPromise : (initPromise = (function () { return __awaiter(_this, void 0, void 0, function () {
                            var checkpoint;
                            var _a, _b, _c;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0:
                                        checkpoint = input.checkpoint();
                                        return [4 /*yield*/, runtime_1.CheckpointStore.open({
                                                sessionID: input.sessionID(),
                                                workspaceRoot: input.workspaceRoot,
                                                storeDir: input.storeDir,
                                                enabled: checkpoint === null || checkpoint === void 0 ? void 0 : checkpoint.enabled,
                                                maxFiles: checkpoint === null || checkpoint === void 0 ? void 0 : checkpoint.maxFiles,
                                                maxBytes: checkpoint === null || checkpoint === void 0 ? void 0 : checkpoint.maxBytes,
                                                ignore: checkpoint === null || checkpoint === void 0 ? void 0 : checkpoint.ignore,
                                                additionalDirs: __spreadArray(__spreadArray([], ((_a = checkpoint === null || checkpoint === void 0 ? void 0 : checkpoint.additionalDirs) !== null && _a !== void 0 ? _a : []), true), ((_c = (_b = input.workspace()) === null || _b === void 0 ? void 0 : _b.additionalDirs) !== null && _c !== void 0 ? _c : []), true),
                                                onEvent: function (event) {
                                                    if (event.type === "rollback.begin" ||
                                                        event.type === "rollback.end" ||
                                                        event.type === "rollback.failed")
                                                        event = __assign(__assign({}, event), { sessionID: input.sessionID() });
                                                    input.publish(event);
                                                    if (event.type === "checkpoint.created")
                                                        input.publish(input.workLedger().checkpointNode({
                                                            checkpointID: event.id,
                                                            reason: event.reason,
                                                            sessionID: input.sessionID(),
                                                            turnID: event.turnID,
                                                        }));
                                                    if (event.type === "rollback.end")
                                                        input.publish(input.workLedger().rollbackCheckpointEdge({
                                                            checkpointID: event.checkpointID,
                                                            safetyCheckpointID: event.safetyCheckpointID,
                                                            sessionID: input.sessionID(),
                                                        }));
                                                },
                                            })];
                                    case 1:
                                        store = _d.sent();
                                        if (!store.isEnabled()) return [3 /*break*/, 3];
                                        return [4 /*yield*/, store.ensureBaseline(input.context(), 0)];
                                    case 2:
                                        _d.sent();
                                        _d.label = 3;
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); })());
                        return [4 /*yield*/, initPromise];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function get() {
        if (!store)
            throw new Error("checkpoint store is not initialized");
        return store;
    }
    function isEnabled() {
        var _a;
        return (_a = store === null || store === void 0 ? void 0 : store.isEnabled()) !== null && _a !== void 0 ? _a : false;
    }
    function list() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, get().list()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function preview(id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, get().previewRollback(id, input.context(), resources(), true)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function rollback(id, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, get().rollbackTo(id, __assign({ context: input.context(), dryRun: options.dryRun }, rollbackOptions()))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function createCheckpoint(checkpoint) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, get().createCheckpoint(checkpoint)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function rename(id, name) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, get().rename(id, name)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function workspaceDiff() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, get().workspaceDiff()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function listCheckpointsByKind(kind) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, get().listCheckpointsByKind(kind)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function listAuditRounds(planID) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, get().listAuditRounds(planID)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function createAuditRoundCheckpoint(input) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, get().createAuditRoundCheckpoint(input)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function diffCheckpoints(from, to, options) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, get().diffCheckpoints(from, to, options)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function resources() {
        var _a, _b;
        return __spreadArray(__spreadArray([], ((_b = (_a = input
            .subagents()) === null || _a === void 0 ? void 0 : _a.list().map(function (agent) { return ({
            kind: "subagent",
            id: agent.id,
            status: agent.status === "running"
                ? "running"
                : agent.status === "paused"
                    ? "waiting"
                    : "stopped",
            summary: agent.task,
        }); })) !== null && _b !== void 0 ? _b : []), true), (input.activeAbort()
            ? [
                {
                    kind: "tool",
                    id: "active_turn",
                    status: "running",
                    summary: "active provider turn",
                },
            ]
            : []), true);
    }
    function rollbackOptions() {
        var _this = this;
        return {
            resources: resources(),
            onResourcePolicy: function (policy) { return __awaiter(_this, void 0, void 0, function () {
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            if (policy.action !== "stop" && policy.action !== "cancel")
                                return [2 /*return*/];
                            if (!(policy.kind === "subagent")) return [3 /*break*/, 2];
                            return [4 /*yield*/, ((_a = input.subagents()) === null || _a === void 0 ? void 0 : _a.stop(policy.id))];
                        case 1:
                            _c.sent();
                            _c.label = 2;
                        case 2:
                            if (policy.kind === "tool")
                                (_b = input.activeAbort()) === null || _b === void 0 ? void 0 : _b.abort(new Error("checkpoint rollback"));
                            return [2 /*return*/];
                    }
                });
            }); },
            onContextRestored: function (snapshot) { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    return [2 /*return*/, input.publish({
                            type: "context.checkpoint",
                            id: "rollback:".concat(snapshot.journalOffset),
                            snapshot: snapshot,
                        })];
                });
            }); },
        };
    }
    return {
        init: init,
        get: get,
        list: list,
        preview: preview,
        rollback: rollback,
        createCheckpoint: createCheckpoint,
        rename: rename,
        workspaceDiff: workspaceDiff,
        listCheckpointsByKind: listCheckpointsByKind,
        listAuditRounds: listAuditRounds,
        createAuditRoundCheckpoint: createAuditRoundCheckpoint,
        diffCheckpoints: diffCheckpoints,
        isEnabled: isEnabled,
        resources: resources,
        rollbackOptions: rollbackOptions,
    };
}
