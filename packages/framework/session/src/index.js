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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
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
exports.foldProjection = exports.viewProjection = exports.applyProjection = exports.initProjection = exports.PROJECTION_STATE_VERSION = exports.projectSession = exports.normalizeCollaborationEvent = exports.projectedCollabMessages = exports.projectedNiaChatMessages = exports.projectedNaviChatMessages = exports.projectedChatMessages = exports.projectedPlanDocs = exports.projectedGoal = exports.projectedMailboxMessages = exports.projectedWorkGraphEdges = exports.projectedWorkGraphNodes = exports.projectedCompletions = exports.projectedEvidenceRecords = exports.projectedCapabilities = exports.projectedDriftFindings = exports.projectedCanonicalTools = exports.latestSessionSnapshot = exports.projectedDecisionRecords = exports.nextContextInstructionsRevision = exports.projectedRuntimeNotices = exports.projectedWorkContracts = exports.projectedConstitutionOverrides = exports.projectedConstitutionRules = exports.projectSessionMessages = exports.modelVisibleEvents = exports.SessionInputConflictError = exports.replaceAdmittedInput = exports.removeAdmittedInput = exports.promoteNextTurn = exports.promoteNextSteps = exports.promoteInputToStep = exports.normalizeInbox = exports.normalizeDelivery = exports.claimNextSteps = exports.admittedInputs = exports.buildSubmittedTurn = exports.buildInputUpdated = exports.buildInputAdmission = exports.admissionCutoff = exports.admitInput = exports.sessionRunCoordinator = exports.SessionRunCoordinator = exports.releaseSessionRunCoordinator = exports.SqliteSessionStore = exports.JsonSessionStore = void 0;
exports.requestsForSession = exports.projectInteractiveRequests = exports.isCollaborationStreamEvent = exports.sessionFactCollaborationEvents = exports.sessionFactNiaChatMessages = exports.sessionFactNaviChatMessages = exports.sessionIntelligenceFactsFromEvents = exports.sessionIntelligenceFactsFrom = exports.sessionFactIntelligenceFacts = exports.sessionFactCollabMessages = exports.sessionFactLatestSnapshot = exports.sessionFactDecisionRecords = exports.sessionFactMailboxMessages = exports.FACT_TERMINAL_LIMIT = exports.evictTerminalFacts = exports.sessionFactHumanValidation = exports.sessionFactCompletions = exports.sessionFactEvidenceRecords = exports.sessionFactDriftFindings = exports.sessionWorkContractsFrom = exports.applySessionWorkContractFact = exports.emptySessionWorkContractFactState = exports.sessionFactWorkContracts = exports.sessionFactConstitutionOverrides = exports.sessionFactConstitutionRules = exports.sessionFactActiveTurnIDs = exports.sessionFactStateFromEvents = exports.applySessionFactEvent = exports.emptySessionFactState = exports.selectedModelFromEvents = exports.selectedAgentFromEvents = exports.settleInterruptedTurnIDs = exports.settleInterruptedTurns = exports.restoreProjection = exports.deserializeProjectionState = exports.serializeProjectionState = void 0;
exports.createSessionRecord = createSessionRecord;
exports.appendSessionEvent = appendSessionEvent;
__exportStar(require("./invariants"), exports);
var inbox_1 = require("./inbox");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
function createSessionRecord(id, title, now) {
    if (now === void 0) { now = new Date(); }
    return {
        id: id,
        title: title,
        createdAt: now.toISOString(),
        events: [],
        cancelled: false,
        resumable: true,
    };
}
function appendSessionEvent(session, event) {
    session.events.push(event);
    if (event.type === "turn.cancelled")
        session.cancelled = true;
}
var JsonSessionStore = /** @class */ (function () {
    function JsonSessionStore(dir) {
        if (dir === void 0) { dir = ".natalia/sessions"; }
        this.writeQueue = Promise.resolve();
        this.dir = (0, node_path_1.resolve)(dir);
    }
    JsonSessionStore.prototype.load = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var session, _a, _b, error_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 2, , 3]);
                        _b = (_a = JSON).parse;
                        return [4 /*yield*/, (0, promises_1.readFile)(this.path(id), "utf8")];
                    case 1:
                        session = _b.apply(_a, [_c.sent()]);
                        (0, inbox_1.normalizeInbox)(session);
                        return [2 /*return*/, session];
                    case 2:
                        error_1 = _c.sent();
                        if (error_1.code === "ENOENT")
                            return [2 /*return*/, undefined];
                        throw error_1;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    JsonSessionStore.prototype.save = function (session) {
        return __awaiter(this, void 0, void 0, function () {
            var snapshot, write, queued;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        snapshot = structuredClone(session);
                        write = function () { return _this.writeSnapshot(snapshot); };
                        queued = this.writeQueue.then(write, write);
                        this.writeQueue = queued.catch(function () { return undefined; });
                        return [4 /*yield*/, queued];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    JsonSessionStore.prototype.loadOrCreate = function (id, title) {
        return __awaiter(this, void 0, void 0, function () {
            var existing, session;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.load(id)];
                    case 1:
                        existing = _a.sent();
                        if (existing)
                            return [2 /*return*/, existing];
                        session = createSessionRecord(id, title);
                        return [4 /*yield*/, this.save(session)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, session];
                }
            });
        });
    };
    JsonSessionStore.prototype.list = function () {
        return __awaiter(this, void 0, void 0, function () {
            var entries, sessions, _i, entries_1, entry, session, _a, _b, _c, error_2;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _d.trys.push([0, 8, , 9]);
                        return [4 /*yield*/, (0, promises_1.readdir)(this.dir, { withFileTypes: true })];
                    case 1:
                        entries = _d.sent();
                        sessions = [];
                        _i = 0, entries_1 = entries;
                        _d.label = 2;
                    case 2:
                        if (!(_i < entries_1.length)) return [3 /*break*/, 7];
                        entry = entries_1[_i];
                        if (!entry.isFile() || !entry.name.endsWith(".json"))
                            return [3 /*break*/, 6];
                        _d.label = 3;
                    case 3:
                        _d.trys.push([3, 5, , 6]);
                        _b = (_a = JSON).parse;
                        return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(this.dir, entry.name), "utf8")];
                    case 4:
                        session = _b.apply(_a, [_d.sent()]);
                        if (session.id && session.title && Array.isArray(session.events))
                            sessions.push(session);
                        return [3 /*break*/, 6];
                    case 5:
                        _c = _d.sent();
                        return [3 /*break*/, 6];
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7: 
                    // Pinned first, then by lastAccessedAt descending, then by createdAt descending
                    return [2 /*return*/, sessions.sort(function (left, right) {
                            var _a, _b, _c, _d, _e, _f;
                            var lp = ((_a = left.metadata) === null || _a === void 0 ? void 0 : _a.pinned) ? 1 : 0;
                            var rp = ((_b = right.metadata) === null || _b === void 0 ? void 0 : _b.pinned) ? 1 : 0;
                            if (lp !== rp)
                                return rp - lp;
                            var la = (_d = (_c = left.metadata) === null || _c === void 0 ? void 0 : _c.lastAccessedAt) !== null && _d !== void 0 ? _d : "";
                            var ra = (_f = (_e = right.metadata) === null || _e === void 0 ? void 0 : _e.lastAccessedAt) !== null && _f !== void 0 ? _f : "";
                            if (la !== ra)
                                return ra.localeCompare(la);
                            return right.createdAt.localeCompare(left.createdAt);
                        })];
                    case 8:
                        error_2 = _d.sent();
                        if (error_2.code === "ENOENT")
                            return [2 /*return*/, []];
                        throw error_2;
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    JsonSessionStore.prototype.rename = function (id, title) {
        return __awaiter(this, void 0, void 0, function () {
            var session, trimmed;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.load(id)];
                    case 1:
                        session = _a.sent();
                        if (!session)
                            throw new Error("session not found: ".concat(id));
                        trimmed = title.trim();
                        if (!trimmed)
                            throw new Error("session title cannot be empty");
                        session.title = trimmed;
                        session.metadata = __assign(__assign({}, session.metadata), { titleSource: "manual" });
                        return [4 /*yield*/, this.save(session)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, session];
                }
            });
        });
    };
    JsonSessionStore.prototype.delete = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, promises_1.rm)(this.path(id), { force: true })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    JsonSessionStore.prototype.updateMetadata = function (id, partial) {
        return __awaiter(this, void 0, void 0, function () {
            var session;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.load(id)];
                    case 1:
                        session = _a.sent();
                        if (!session)
                            throw new Error("session not found: ".concat(id));
                        session.metadata = __assign(__assign({}, session.metadata), partial);
                        return [4 /*yield*/, this.save(session)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, session];
                }
            });
        });
    };
    JsonSessionStore.prototype.setAutoTitle = function (id, title, source) {
        return __awaiter(this, void 0, void 0, function () {
            var result, write, queued;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        write = function () { return __awaiter(_this, void 0, void 0, function () {
                            var session;
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0: return [4 /*yield*/, this.load(id)];
                                    case 1:
                                        session = _b.sent();
                                        if (!session)
                                            throw new Error("session not found: ".concat(id));
                                        if (((_a = session.metadata) === null || _a === void 0 ? void 0 : _a.titleSource) === "manual") {
                                            result = session;
                                            return [2 /*return*/];
                                        }
                                        session.title = title;
                                        session.metadata = __assign(__assign({}, session.metadata), { titleSource: source });
                                        result = session;
                                        return [4 /*yield*/, this.writeSnapshot(session)];
                                    case 2:
                                        _b.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); };
                        queued = this.writeQueue.then(write, write);
                        this.writeQueue = queued.catch(function () { return undefined; });
                        return [4 /*yield*/, queued];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, result];
                }
            });
        });
    };
    JsonSessionStore.prototype.writeSnapshot = function (snapshot) {
        return __awaiter(this, void 0, void 0, function () {
            var temporary;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, (0, promises_1.mkdir)(this.dir, { recursive: true, mode: 448 })];
                    case 1:
                        _a.sent();
                        temporary = "".concat(this.path(snapshot.id), ".").concat(crypto.randomUUID(), ".tmp");
                        return [4 /*yield*/, (0, promises_1.writeFile)(temporary, "".concat(JSON.stringify(snapshot, null, 2), "\n"), {
                                mode: 384,
                            })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, renameSessionFile(temporary, this.path(snapshot.id))];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    JsonSessionStore.prototype.duplicate = function (id, newID, newTitle) {
        return __awaiter(this, void 0, void 0, function () {
            var session, targetID, copy;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.load(id)];
                    case 1:
                        session = _a.sent();
                        if (!session)
                            throw new Error("session not found: ".concat(id));
                        targetID = newID !== null && newID !== void 0 ? newID : "ses_".concat(crypto.randomUUID().replace(/-/gu, "").slice(0, 16));
                        copy = __assign(__assign({}, structuredClone(session)), { id: targetID, title: newTitle !== null && newTitle !== void 0 ? newTitle : "".concat(session.title, " (copy)"), metadata: __assign(__assign({}, session.metadata), { lastAccessedAt: new Date().toISOString() }) });
                        return [4 /*yield*/, this.save(copy)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, copy];
                }
            });
        });
    };
    JsonSessionStore.prototype.fork = function (id, turnID, newID, newTitle) {
        return __awaiter(this, void 0, void 0, function () {
            var session, boundary, targetID, includedTurns, fork;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.load(id)];
                    case 1:
                        session = _b.sent();
                        if (!session)
                            throw new Error("session not found: ".concat(id));
                        boundary = session.events.findIndex(function (event) { return event.type === "turn.submitted" && event.id === turnID; });
                        if (boundary < 0)
                            throw new Error("turn not found: ".concat(turnID));
                        targetID = newID !== null && newID !== void 0 ? newID : "ses_".concat(crypto.randomUUID().replace(/-/gu, "").slice(0, 16));
                        includedTurns = new Set(session.events
                            .slice(0, boundary)
                            .flatMap(function (event) {
                            return event.type === "turn.submitted" ? [event.id] : [];
                        }));
                        fork = __assign(__assign({}, structuredClone(session)), { id: targetID, title: newTitle !== null && newTitle !== void 0 ? newTitle : "".concat(session.title, " (fork)"), events: structuredClone(session.events.slice(0, boundary)), inbox: (_a = session.inbox) === null || _a === void 0 ? void 0 : _a.filter(function (input) { return includedTurns.has(input.id); }).map(function (input) { return (__assign(__assign({}, structuredClone(input)), { sessionID: targetID })); }), metadata: __assign(__assign({}, session.metadata), { lastAccessedAt: new Date().toISOString() }) });
                        return [4 /*yield*/, this.save(fork)];
                    case 2:
                        _b.sent();
                        return [2 /*return*/, fork];
                }
            });
        });
    };
    JsonSessionStore.prototype.path = function (id) {
        return (0, node_path_1.join)(this.dir, "".concat(id, ".json"));
    };
    return JsonSessionStore;
}());
exports.JsonSessionStore = JsonSessionStore;
/**
 * Atomically replaces the session file. POSIX rename is atomic and this returns
 * on the first attempt. Windows rejects the rename while another client holds
 * the target open for reading (its handle lacks FILE_SHARE_DELETE), so the
 * overwrite is retried with a short backoff, and a direct overwrite is used as
 * a last resort once the lock clears. Writers are already serialized by the
 * per-store queue, so the fallback cannot interleave two updates.
 */
function renameSessionFile(source, target) {
    return __awaiter(this, void 0, void 0, function () {
        var attempt, error_3, code, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    attempt = 0;
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 9]);
                    return [4 /*yield*/, (0, promises_1.rename)(source, target)];
                case 2:
                    _c.sent();
                    return [2 /*return*/];
                case 3:
                    error_3 = _c.sent();
                    code = error_3.code;
                    if (code !== "EPERM" &&
                        code !== "EBUSY" &&
                        code !== "EACCES" &&
                        code !== "EEXIST")
                        throw error_3;
                    if (!(attempt >= 4)) return [3 /*break*/, 7];
                    _a = promises_1.writeFile;
                    _b = [target];
                    return [4 /*yield*/, (0, promises_1.readFile)(source, "utf8")];
                case 4: return [4 /*yield*/, _a.apply(void 0, _b.concat([_c.sent(), {
                            mode: 384,
                        }]))];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, (0, promises_1.rm)(source, { force: true }).catch(function () { return undefined; })];
                case 6:
                    _c.sent();
                    return [2 /*return*/];
                case 7: return [4 /*yield*/, Bun.sleep(25 * (attempt + 1))];
                case 8:
                    _c.sent();
                    return [3 /*break*/, 9];
                case 9:
                    attempt++;
                    return [3 /*break*/, 1];
                case 10: return [2 /*return*/];
            }
        });
    });
}
var sqlite_store_1 = require("./sqlite-store");
Object.defineProperty(exports, "SqliteSessionStore", { enumerable: true, get: function () { return sqlite_store_1.SqliteSessionStore; } });
var run_coordinator_1 = require("./run-coordinator");
Object.defineProperty(exports, "releaseSessionRunCoordinator", { enumerable: true, get: function () { return run_coordinator_1.releaseSessionRunCoordinator; } });
Object.defineProperty(exports, "SessionRunCoordinator", { enumerable: true, get: function () { return run_coordinator_1.SessionRunCoordinator; } });
Object.defineProperty(exports, "sessionRunCoordinator", { enumerable: true, get: function () { return run_coordinator_1.sessionRunCoordinator; } });
var inbox_2 = require("./inbox");
Object.defineProperty(exports, "admitInput", { enumerable: true, get: function () { return inbox_2.admitInput; } });
Object.defineProperty(exports, "admissionCutoff", { enumerable: true, get: function () { return inbox_2.admissionCutoff; } });
Object.defineProperty(exports, "buildInputAdmission", { enumerable: true, get: function () { return inbox_2.buildInputAdmission; } });
Object.defineProperty(exports, "buildInputUpdated", { enumerable: true, get: function () { return inbox_2.buildInputUpdated; } });
Object.defineProperty(exports, "buildSubmittedTurn", { enumerable: true, get: function () { return inbox_2.buildSubmittedTurn; } });
Object.defineProperty(exports, "admittedInputs", { enumerable: true, get: function () { return inbox_2.admittedInputs; } });
Object.defineProperty(exports, "claimNextSteps", { enumerable: true, get: function () { return inbox_2.claimNextSteps; } });
Object.defineProperty(exports, "normalizeDelivery", { enumerable: true, get: function () { return inbox_2.normalizeDelivery; } });
Object.defineProperty(exports, "normalizeInbox", { enumerable: true, get: function () { return inbox_2.normalizeInbox; } });
Object.defineProperty(exports, "promoteInputToStep", { enumerable: true, get: function () { return inbox_2.promoteInputToStep; } });
Object.defineProperty(exports, "promoteNextSteps", { enumerable: true, get: function () { return inbox_2.promoteNextSteps; } });
Object.defineProperty(exports, "promoteNextTurn", { enumerable: true, get: function () { return inbox_2.promoteNextTurn; } });
Object.defineProperty(exports, "removeAdmittedInput", { enumerable: true, get: function () { return inbox_2.removeAdmittedInput; } });
Object.defineProperty(exports, "replaceAdmittedInput", { enumerable: true, get: function () { return inbox_2.replaceAdmittedInput; } });
Object.defineProperty(exports, "SessionInputConflictError", { enumerable: true, get: function () { return inbox_2.SessionInputConflictError; } });
var projector_1 = require("./projector");
Object.defineProperty(exports, "modelVisibleEvents", { enumerable: true, get: function () { return projector_1.modelVisibleEvents; } });
Object.defineProperty(exports, "projectSessionMessages", { enumerable: true, get: function () { return projector_1.projectSessionMessages; } });
Object.defineProperty(exports, "projectedConstitutionRules", { enumerable: true, get: function () { return projector_1.projectedConstitutionRules; } });
Object.defineProperty(exports, "projectedConstitutionOverrides", { enumerable: true, get: function () { return projector_1.projectedConstitutionOverrides; } });
Object.defineProperty(exports, "projectedWorkContracts", { enumerable: true, get: function () { return projector_1.projectedWorkContracts; } });
Object.defineProperty(exports, "projectedRuntimeNotices", { enumerable: true, get: function () { return projector_1.projectedRuntimeNotices; } });
Object.defineProperty(exports, "nextContextInstructionsRevision", { enumerable: true, get: function () { return projector_1.nextContextInstructionsRevision; } });
Object.defineProperty(exports, "projectedDecisionRecords", { enumerable: true, get: function () { return projector_1.projectedDecisionRecords; } });
Object.defineProperty(exports, "latestSessionSnapshot", { enumerable: true, get: function () { return projector_1.latestSessionSnapshot; } });
Object.defineProperty(exports, "projectedCanonicalTools", { enumerable: true, get: function () { return projector_1.projectedCanonicalTools; } });
Object.defineProperty(exports, "projectedDriftFindings", { enumerable: true, get: function () { return projector_1.projectedDriftFindings; } });
Object.defineProperty(exports, "projectedCapabilities", { enumerable: true, get: function () { return projector_1.projectedCapabilities; } });
Object.defineProperty(exports, "projectedEvidenceRecords", { enumerable: true, get: function () { return projector_1.projectedEvidenceRecords; } });
Object.defineProperty(exports, "projectedCompletions", { enumerable: true, get: function () { return projector_1.projectedCompletions; } });
Object.defineProperty(exports, "projectedWorkGraphNodes", { enumerable: true, get: function () { return projector_1.projectedWorkGraphNodes; } });
Object.defineProperty(exports, "projectedWorkGraphEdges", { enumerable: true, get: function () { return projector_1.projectedWorkGraphEdges; } });
Object.defineProperty(exports, "projectedMailboxMessages", { enumerable: true, get: function () { return projector_1.projectedMailboxMessages; } });
Object.defineProperty(exports, "projectedGoal", { enumerable: true, get: function () { return projector_1.projectedGoal; } });
Object.defineProperty(exports, "projectedPlanDocs", { enumerable: true, get: function () { return projector_1.projectedPlanDocs; } });
Object.defineProperty(exports, "projectedChatMessages", { enumerable: true, get: function () { return projector_1.projectedChatMessages; } });
Object.defineProperty(exports, "projectedNaviChatMessages", { enumerable: true, get: function () { return projector_1.projectedNaviChatMessages; } });
Object.defineProperty(exports, "projectedNiaChatMessages", { enumerable: true, get: function () { return projector_1.projectedNiaChatMessages; } });
Object.defineProperty(exports, "projectedCollabMessages", { enumerable: true, get: function () { return projector_1.projectedCollabMessages; } });
Object.defineProperty(exports, "normalizeCollaborationEvent", { enumerable: true, get: function () { return projector_1.normalizeCollaborationEvent; } });
Object.defineProperty(exports, "projectSession", { enumerable: true, get: function () { return projector_1.projectSession; } });
Object.defineProperty(exports, "PROJECTION_STATE_VERSION", { enumerable: true, get: function () { return projector_1.PROJECTION_STATE_VERSION; } });
Object.defineProperty(exports, "initProjection", { enumerable: true, get: function () { return projector_1.initProjection; } });
Object.defineProperty(exports, "applyProjection", { enumerable: true, get: function () { return projector_1.applyProjection; } });
Object.defineProperty(exports, "viewProjection", { enumerable: true, get: function () { return projector_1.viewProjection; } });
Object.defineProperty(exports, "foldProjection", { enumerable: true, get: function () { return projector_1.foldProjection; } });
Object.defineProperty(exports, "serializeProjectionState", { enumerable: true, get: function () { return projector_1.serializeProjectionState; } });
Object.defineProperty(exports, "deserializeProjectionState", { enumerable: true, get: function () { return projector_1.deserializeProjectionState; } });
Object.defineProperty(exports, "restoreProjection", { enumerable: true, get: function () { return projector_1.restoreProjection; } });
Object.defineProperty(exports, "settleInterruptedTurns", { enumerable: true, get: function () { return projector_1.settleInterruptedTurns; } });
Object.defineProperty(exports, "settleInterruptedTurnIDs", { enumerable: true, get: function () { return projector_1.settleInterruptedTurnIDs; } });
Object.defineProperty(exports, "selectedAgentFromEvents", { enumerable: true, get: function () { return projector_1.selectedAgentFromEvents; } });
Object.defineProperty(exports, "selectedModelFromEvents", { enumerable: true, get: function () { return projector_1.selectedModelFromEvents; } });
Object.defineProperty(exports, "emptySessionFactState", { enumerable: true, get: function () { return projector_1.emptySessionFactState; } });
Object.defineProperty(exports, "applySessionFactEvent", { enumerable: true, get: function () { return projector_1.applySessionFactEvent; } });
Object.defineProperty(exports, "sessionFactStateFromEvents", { enumerable: true, get: function () { return projector_1.sessionFactStateFromEvents; } });
Object.defineProperty(exports, "sessionFactActiveTurnIDs", { enumerable: true, get: function () { return projector_1.sessionFactActiveTurnIDs; } });
Object.defineProperty(exports, "sessionFactConstitutionRules", { enumerable: true, get: function () { return projector_1.sessionFactConstitutionRules; } });
Object.defineProperty(exports, "sessionFactConstitutionOverrides", { enumerable: true, get: function () { return projector_1.sessionFactConstitutionOverrides; } });
Object.defineProperty(exports, "sessionFactWorkContracts", { enumerable: true, get: function () { return projector_1.sessionFactWorkContracts; } });
Object.defineProperty(exports, "emptySessionWorkContractFactState", { enumerable: true, get: function () { return projector_1.emptySessionWorkContractFactState; } });
Object.defineProperty(exports, "applySessionWorkContractFact", { enumerable: true, get: function () { return projector_1.applySessionWorkContractFact; } });
Object.defineProperty(exports, "sessionWorkContractsFrom", { enumerable: true, get: function () { return projector_1.sessionWorkContractsFrom; } });
Object.defineProperty(exports, "sessionFactDriftFindings", { enumerable: true, get: function () { return projector_1.sessionFactDriftFindings; } });
Object.defineProperty(exports, "sessionFactEvidenceRecords", { enumerable: true, get: function () { return projector_1.sessionFactEvidenceRecords; } });
Object.defineProperty(exports, "sessionFactCompletions", { enumerable: true, get: function () { return projector_1.sessionFactCompletions; } });
Object.defineProperty(exports, "sessionFactHumanValidation", { enumerable: true, get: function () { return projector_1.sessionFactHumanValidation; } });
Object.defineProperty(exports, "evictTerminalFacts", { enumerable: true, get: function () { return projector_1.evictTerminalFacts; } });
Object.defineProperty(exports, "FACT_TERMINAL_LIMIT", { enumerable: true, get: function () { return projector_1.FACT_TERMINAL_LIMIT; } });
Object.defineProperty(exports, "sessionFactMailboxMessages", { enumerable: true, get: function () { return projector_1.sessionFactMailboxMessages; } });
Object.defineProperty(exports, "sessionFactDecisionRecords", { enumerable: true, get: function () { return projector_1.sessionFactDecisionRecords; } });
Object.defineProperty(exports, "sessionFactLatestSnapshot", { enumerable: true, get: function () { return projector_1.sessionFactLatestSnapshot; } });
Object.defineProperty(exports, "sessionFactCollabMessages", { enumerable: true, get: function () { return projector_1.sessionFactCollabMessages; } });
Object.defineProperty(exports, "sessionFactIntelligenceFacts", { enumerable: true, get: function () { return projector_1.sessionFactIntelligenceFacts; } });
Object.defineProperty(exports, "sessionIntelligenceFactsFrom", { enumerable: true, get: function () { return projector_1.sessionIntelligenceFactsFrom; } });
Object.defineProperty(exports, "sessionIntelligenceFactsFromEvents", { enumerable: true, get: function () { return projector_1.sessionIntelligenceFactsFromEvents; } });
Object.defineProperty(exports, "sessionFactNaviChatMessages", { enumerable: true, get: function () { return projector_1.sessionFactNaviChatMessages; } });
Object.defineProperty(exports, "sessionFactNiaChatMessages", { enumerable: true, get: function () { return projector_1.sessionFactNiaChatMessages; } });
Object.defineProperty(exports, "sessionFactCollaborationEvents", { enumerable: true, get: function () { return projector_1.sessionFactCollaborationEvents; } });
Object.defineProperty(exports, "isCollaborationStreamEvent", { enumerable: true, get: function () { return projector_1.isCollaborationStreamEvent; } });
var interactive_1 = require("./interactive");
Object.defineProperty(exports, "projectInteractiveRequests", { enumerable: true, get: function () { return interactive_1.projectInteractiveRequests; } });
Object.defineProperty(exports, "requestsForSession", { enumerable: true, get: function () { return interactive_1.requestsForSession; } });
