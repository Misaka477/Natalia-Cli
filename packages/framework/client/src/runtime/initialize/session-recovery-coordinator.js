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
exports.SessionRecoveryCoordinator = void 0;
var runtime_1 = require("@natalia/runtime");
var substrate_1 = require("@anthelia/substrate");
var substrate_2 = require("@anthelia/substrate");
var substrate_3 = require("@anthelia/substrate");
var runtime_services_1 = require("@natalia/runtime-services");
var session_store_1 = require("@anthelia/session-store");
var attachments_1 = require("@anthelia/attachments");
var runtime_services_2 = require("@natalia/runtime-services");
var runtime_2 = require("@natalia/runtime");
var context_ledger_1 = require("@natalia/context-ledger");
var operation_log_1 = require("@natalia/operation-log");
/**
 * Session recovery split into a small state machine.
 *
 * The heavyweight projection/event-selection work lives in the session worker;
 * this coordinator only owns:
 *   - service calls (SQLite, sandbox, terminal, attachment, context ledger)
 *   - runtime state writes (diagnostics, attachment references, active exec)
 *   - phase scheduling and fallback to the main thread
 */
var SessionRecoveryCoordinator = /** @class */ (function () {
    function SessionRecoveryCoordinator(options, scope) {
        this.interrupted = [];
        this.scope = scope;
        this.options = options;
        var sessionStore = scope.serviceDirectory.getOptional(session_store_1.sessionStoreController);
        if (!sessionStore)
            throw new Error("session store unavailable (natalia-session-store)");
        this.sessionStore = sessionStore;
        // Resolution is fail-fast by construction.
        this.attachmentService = scope.serviceDirectory.get(attachments_1.attachmentService);
        this.contextLedgerFactory =
            scope.serviceDirectory.get(context_ledger_1.contextLedgerFactory);
    }
    SessionRecoveryCoordinator.prototype.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var start, mark;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        start = performance.now();
                        mark = function (name) {
                            return (0, runtime_services_2.perfLog)("[perf] recovery.".concat(name, " +").concat((performance.now() - start).toFixed(1), "ms"));
                        };
                        return [4 /*yield*/, this.phase0Load()];
                    case 1:
                        _a.sent();
                        mark("phase0.load");
                        return [4 /*yield*/, this.phase1Projection()];
                    case 2:
                        _a.sent();
                        mark("phase1.projection");
                        return [4 /*yield*/, this.phase2ApplyProjection()];
                    case 3:
                        _a.sent();
                        mark("phase2.applyProjection");
                        return [4 /*yield*/, this.phase3PrepareContext()];
                    case 4:
                        _a.sent();
                        mark("phase3.prepareContext");
                        return [4 /*yield*/, this.phase4ApplyServices()];
                    case 5:
                        _a.sent();
                        mark("phase4.applyServices");
                        return [4 /*yield*/, this.phase5Publish()];
                    case 6:
                        _a.sent();
                        mark("phase5.publish");
                        return [2 /*return*/, {
                                interrupted: this.interrupted,
                                sqliteRecovery: this.sqliteRecovery,
                            }];
                }
            });
        });
    };
    /**
     * Phase 0 — Load.
     *
     * All work here is host-owned service initialization/read. No heavy
     * projection or event filtering happens on the runtime thread.
     */
    SessionRecoveryCoordinator.prototype.phase0Load = function () {
        return __awaiter(this, void 0, void 0, function () {
            var scope, terminal, fastPathEnabled, storedSession, session, durableEventCount, sessionDate, initialExec, restoreEvents, _a, _b;
            var _this = this;
            var _c, _d, _e, _f;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        scope = this.scope;
                        (0, runtime_1.memoryTrace)("recovery.phase0.start", { sessionID: scope.sessionID });
                        if (scope.tsRuntimeConfig && scope.extensionEnabled("mcp")) {
                            (_c = scope.serviceDirectory.getOptional(runtime_services_1.mcpService)) === null || _c === void 0 ? void 0 : _c.reload();
                        }
                        terminal = scope.serviceDirectory.getOptional(runtime_services_1.terminalController);
                        return [4 /*yield*/, (terminal === null || terminal === void 0 ? void 0 : terminal.init())];
                    case 1:
                        _g.sent();
                        terminal === null || terminal === void 0 ? void 0 : terminal.setActiveSession(scope.sessionID);
                        return [4 /*yield*/, ((_d = scope.serviceDirectory.getOptional(runtime_services_1.sandboxService)) === null || _d === void 0 ? void 0 : _d.init())];
                    case 2:
                        _g.sent();
                        fastPathEnabled = process.env.NATALIA_FAST_EXECUTION_LOAD === "1";
                        (0, runtime_1.memoryTrace)("recovery.load.start", { sessionID: scope.sessionID });
                        return [4 /*yield*/, this.sessionStore.load(scope.sessionID, {
                                title: this.options.title,
                                create: true,
                                indexedRecovery: fastPathEnabled || scope.replayMode === "none",
                                runtimeEvents: true,
                            })];
                    case 3:
                        storedSession = _g.sent();
                        scope.session = storedSession === null || storedSession === void 0 ? void 0 : storedSession.session;
                        (0, runtime_1.memoryTrace)("recovery.load.done", {
                            sessionID: scope.sessionID,
                            events: (_e = scope.session) === null || _e === void 0 ? void 0 : _e.events.length,
                        });
                        session = scope.session;
                        if (!session)
                            throw new Error("session initialization did not complete");
                        this.session = session;
                        if (!(this.options.title && !((_f = session.metadata) === null || _f === void 0 ? void 0 : _f.titleSource))) return [3 /*break*/, 5];
                        session.metadata = __assign(__assign({}, session.metadata), { titleSource: "manual" });
                        return [4 /*yield*/, this.sessionStore.updateMetadata(session, {
                                titleSource: "manual",
                            })];
                    case 4:
                        _g.sent();
                        _g.label = 5;
                    case 5: return [4 /*yield*/, this.sessionStore
                            .eventCount(scope.sessionID)
                            .catch(function () { return session.events.length; })];
                    case 6:
                        durableEventCount = _g.sent();
                        sessionDate = (0, runtime_2.today)();
                        initialExec = {
                            session: session,
                            context: scope.runtimeContext,
                            sessionStartedAt: sessionDate,
                            currentDate: sessionDate,
                            attachmentReferences: scope.attachmentReferences,
                            toolCalls: scope.toolCalls,
                            provider: scope.provider,
                            runtimeContextConfig: scope.runtimeContextConfig,
                            permissionMode: scope.permissionMode,
                            permissionProfile: scope.selectedPermissionProfile,
                            paused: false,
                            pauseWaiters: [],
                            injectedMailboxIDs: new Set(),
                            announcedTurnIDs: (0, substrate_1.announcedTurnIDsFrom)(session),
                            naviChatLedger: new runtime_1.ContextLedger(),
                            niaChatLedger: new runtime_1.ContextLedger(),
                            tokenMeter: new runtime_1.TokenMeter(),
                            naviTokenMeter: new runtime_1.TokenMeter(),
                            niaTokenMeter: new runtime_1.TokenMeter(),
                            naviPendingQueue: [],
                            niaPendingQueue: [],
                            naviAbortWakePending: false,
                            eventCount: durableEventCount,
                            nextSessionSeq: durableEventCount + 1,
                            niaAbortWakePending: false,
                        };
                        scope.activeExec = initialExec;
                        scope.executionBySession.set(scope.sessionID, initialExec);
                        this.sqliteRecovery = storedSession.recovery;
                        this.sqliteEpoch = storedSession.contextEpoch;
                        // The startup exec was created before durable recovery replaced the
                        // scope.session record. Point it at the recovered record, or per-scope
                        // session reads through the exec would see the pre-recovery shell.
                        if (scope.activeExec)
                            scope.activeExec.session = session;
                        restoreEvents = fastPathEnabled
                            ? this.sessionStore.contextEventsAfter(scope.sessionID, storedSession.contextEpoch)
                            : undefined;
                        if (restoreEvents && storedSession.contextEpoch) {
                            session.events = restoreEvents;
                            if (scope.activeExec) {
                                scope.activeExec.session.events = restoreEvents;
                                // The base log is now the post-epoch tail, so a fact state seeded from
                                // the earlier record is stale; re-seed and mark it incomplete.
                                (0, substrate_2.reseedSessionFactState)(scope.activeExec, false);
                            }
                        }
                        if (fastPathEnabled) {
                            // Prewarm the message index in a worker thread so the first
                            // session.messages RPC does not build it on the critical path.
                            void this.sessionStore
                                .ensureMessageIndexAsync(scope.sessionID)
                                .catch(function (error) {
                                (0, operation_log_1.logOf)(scope.serviceDirectory).warn("perf", "recovery message-index prewarm failed session=".concat(scope.sessionID, ": ").concat(error instanceof Error ? error.message : String(error)));
                            });
                            void this.sessionStore
                                .prewarmMessagePage(scope.sessionID)
                                .catch(function (error) {
                                (0, operation_log_1.logOf)(scope.serviceDirectory).warn("perf", "recovery message-page prewarm failed session=".concat(scope.sessionID, ": ").concat(error instanceof Error ? error.message : String(error)));
                            });
                            // Prewarm the latest message page for every session so the UI can
                            // attach to any recent session without paying the projection cost on
                            // the first messages RPC.
                            void this.sessionStore
                                .list()
                                .then(function (sessions) {
                                var _loop_1 = function (session_1) {
                                    void _this.sessionStore
                                        .prewarmMessagePage(session_1.id)
                                        .catch(function (error) {
                                        (0, operation_log_1.logOf)(scope.serviceDirectory).warn("perf", "recovery message-page prewarm failed session=".concat(session_1.id, ": ").concat(error instanceof Error ? error.message : String(error)));
                                    });
                                };
                                for (var _i = 0, sessions_1 = sessions; _i < sessions_1.length; _i++) {
                                    var session_1 = sessions_1[_i];
                                    _loop_1(session_1);
                                }
                            })
                                .catch(function () { return undefined; });
                        }
                        _b = (_a = this.attachmentService)
                            .cleanup;
                        return [4 /*yield*/, this.sessionStore.referencedAttachments()];
                    case 7: return [4 /*yield*/, _b.apply(_a, [_g.sent()])
                            .catch(function (error) {
                            return scope.publish({
                                type: "diagnostic",
                                level: "warning",
                                message: "attachment cleanup failed: ".concat(error instanceof Error ? error.message : String(error)),
                            });
                        })];
                    case 8:
                        _g.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Phase 1 — Pure Projection.
     *
     * The runtime serializes the session record into the worker, gets back the
     * projected durable events, and stores the projection in memory. Interrupted
     * turn settlement is intentionally kept here because it must be persisted
     * before the runtime publishes the diagnosis; the expensive event scanning
     * still happens on the worker.
     */
    SessionRecoveryCoordinator.prototype.phase1Projection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var scope, interruptedOperation, interrupted, operationTurnWasInterrupted, _a;
            var _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        scope = this.scope;
                        interruptedOperation = (_b = this.session.metadata) === null || _b === void 0 ? void 0 : _b.inFlightOperation;
                        interrupted = this.sqliteRecovery
                            ? scope.settleInterruptedTurnIDs(this.sqliteRecovery.activeTurnIDs, this.sqliteRecovery.approvals.map(function (request) { return request.id; }), this.sqliteRecovery.questions.map(function (request) { return request.id; }))
                            : scope.settleInterruptedTurns(this.session);
                        this.interrupted = interrupted;
                        operationTurnWasInterrupted = Boolean(interruptedOperation &&
                            interrupted.some(function (event) {
                                return event.type === "turn.finished" &&
                                    event.id === interruptedOperation.turnID;
                            }));
                        if (!interruptedOperation) return [3 /*break*/, 2];
                        (_c = this.session.metadata) === null || _c === void 0 ? true : delete _c.inFlightOperation;
                        return [4 /*yield*/, this.sessionStore.updateMetadata(this.session, {
                                inFlightOperation: undefined,
                            })];
                    case 1:
                        _e.sent();
                        _e.label = 2;
                    case 2:
                        if (!(interrupted.length || interruptedOperation)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.sessionStore.appendEvents(this.session, interrupted)];
                    case 3:
                        _e.sent();
                        scope.publish({
                            type: "diagnostic",
                            level: "warning",
                            message: operationTurnWasInterrupted
                                ? "previous process stopped during ".concat(interruptedOperation.kind === "provider_dispatch" ? "provider dispatch" : "tool execution", "; the operation was safely settled as an error and cannot be replayed without an idempotency contract")
                                : "previous process stopped during ".concat(interrupted.filter(function (event) { return event.type === "turn.finished"; }).length, " active turn(s); unresolved interactive requests were rejected because incomplete provider work cannot be replayed"),
                        });
                        _e.label = 4;
                    case 4:
                        _a = this;
                        return [4 /*yield*/, (0, substrate_3.projectSessionInWorker)(this.session).catch(function () { return undefined; })];
                    case 5:
                        _a.projection =
                            (_d = (_e.sent())) !== null && _d !== void 0 ? _d : scope.projectSession(this.session);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Phase 2 — Apply projection snapshot to the runtime memory.
     *
     * Still cheap: diagnostics, attachment references and the agent/model flags
     * are plain state writes. Any expensive reconstruction has already been done
     * by the worker.
     */
    SessionRecoveryCoordinator.prototype.phase2ApplyProjection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var scope, projection, initialDiagnostics, _i, _a, event_1, _b, _c, event_2, _d, _e, event_3, selectedAgentName, restored, recoveredModel, recoveredReasoning, recoveredChatProfile, recoveredPermissionMode;
            var _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
            return __generator(this, function (_y) {
                scope = this.scope;
                projection = this.projection;
                if (!projection)
                    throw new Error("session projection was not computed");
                initialDiagnostics = (_f = scope.runtimeDiagnosticsBySession.get(this.session.id)) !== null && _f !== void 0 ? _f : [];
                for (_i = 0, _a = (_h = (_g = this.sqliteRecovery) === null || _g === void 0 ? void 0 : _g.diagnostics) !== null && _h !== void 0 ? _h : []; _i < _a.length; _i++) {
                    event_1 = _a[_i];
                    initialDiagnostics.push(__assign(__assign({}, event_1), { at: (_j = event_1.at) !== null && _j !== void 0 ? _j : this.session.createdAt }));
                }
                for (_b = 0, _c = projection.replayableEvents; _b < _c.length; _b++) {
                    event_2 = _c[_b];
                    if (event_2.type === "diagnostic")
                        initialDiagnostics.push(__assign(__assign({}, event_2), { at: (_k = event_2.at) !== null && _k !== void 0 ? _k : this.session.createdAt }));
                }
                scope.runtimeDiagnosticsBySession.set(this.session.id, initialDiagnostics);
                for (_d = 0, _e = projection.replayableEvents; _d < _e.length; _d++) {
                    event_3 = _e[_d];
                    if (event_3.type === "turn.submitted" && ((_l = event_3.attachments) === null || _l === void 0 ? void 0 : _l.length))
                        scope.attachmentReferences.set("".concat(event_3.id, ":user"), event_3.attachments);
                }
                selectedAgentName = (_o = (_m = this.sqliteRecovery) === null || _m === void 0 ? void 0 : _m.selectedAgent) !== null && _o !== void 0 ? _o : projection.selectedAgent;
                if (selectedAgentName) {
                    restored = (_p = scope.agentRegistry) === null || _p === void 0 ? void 0 : _p.select(selectedAgentName);
                    if (restored) {
                        scope.selectedAgent = restored;
                        scope.applyAgentPolicy();
                        scope.applyAgentProvider(scope.activeExec);
                    }
                    else {
                        scope.publish({
                            type: "diagnostic",
                            level: "warning",
                            message: "persisted agent is no longer configured: ".concat(selectedAgentName),
                        });
                    }
                }
                recoveredModel = (_r = (_q = this.sqliteRecovery) === null || _q === void 0 ? void 0 : _q.selectedModel) !== null && _r !== void 0 ? _r : projection.selectedModel;
                if (recoveredModel) {
                    scope.selectedModel = recoveredModel;
                    scope.applyAgentProvider(scope.activeExec);
                }
                recoveredReasoning = (_t = (_s = this.sqliteRecovery) === null || _s === void 0 ? void 0 : _s.reasoningEffort) !== null && _t !== void 0 ? _t : projection.reasoningEffort;
                if (recoveredReasoning && scope.activeExec)
                    scope.activeExec.reasoningEffort = recoveredReasoning;
                recoveredChatProfile = (_v = (_u = this.sqliteRecovery) === null || _u === void 0 ? void 0 : _u.chatModelProfile) !== null && _v !== void 0 ? _v : projection.chatModelProfile;
                if (recoveredChatProfile && scope.activeExec) {
                    scope.activeExec.naviChatModelProfile = recoveredChatProfile.navi;
                    scope.activeExec.niaChatModelProfile = recoveredChatProfile.nia;
                }
                recoveredPermissionMode = (_x = (_w = this.sqliteRecovery) === null || _w === void 0 ? void 0 : _w.permissionMode) !== null && _x !== void 0 ? _x : projection.permissionMode;
                if (recoveredPermissionMode && scope.activeExec)
                    scope.activeExec.permissionMode = recoveredPermissionMode;
                return [2 /*return*/];
            });
        });
    };
    /**
     * Phase 3 — Context event preparation (pure event filtering).
     *
     * The worker computes the latest checkpoint, whether it has a summary, and
     * the model-visible restore list. SQLite `contextEventsAfter` is a service
     * read and remains in Phase 4, where the context ledger is restored.
     */
    SessionRecoveryCoordinator.prototype.phase3PrepareContext = function () {
        return __awaiter(this, void 0, void 0, function () {
            var projection, _a;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        projection = this.projection;
                        if (!projection)
                            throw new Error("session projection was not computed");
                        _a = this;
                        return [4 /*yield*/, (0, substrate_3.prepareSessionRecoveryContextInWorker)(projection.replayableEvents).catch(function () { return undefined; })];
                    case 1:
                        _a.preparedContext =
                            (_b = (_c.sent())) !== null && _b !== void 0 ? _b : computeRecoveryContextFallback(projection.replayableEvents, this.scope.modelVisibleEvents);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Phase 4 — Apply services.
     *
     * Everything that touches a runtime service (checkpoint restore, context
     * ledger, tool output cleanup) stays on this thread.
     */
    SessionRecoveryCoordinator.prototype.phase4ApplyServices = function () {
        return __awaiter(this, void 0, void 0, function () {
            var scope, projection, prepared, recoveryRestoreEvents;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        scope = this.scope;
                        projection = this.projection;
                        prepared = this.preparedContext;
                        if (!projection || !prepared)
                            throw new Error("session recovery context was not prepared");
                        return [4 /*yield*/, scope.cleanupToolOutput(scope.workspaceRoot).catch(function (error) {
                                return scope.publish({
                                    type: "diagnostic",
                                    level: "warning",
                                    message: "tool output cleanup failed: ".concat(error instanceof Error ? error.message : String(error)),
                                });
                            })];
                    case 1:
                        _a.sent();
                        if (this.sqliteEpoch)
                            scope.runtimeContext.restoreDurableCheckpoint(this.sqliteEpoch.snapshot);
                        else if (prepared.checkpointHasSummary && prepared.latestContextCheckpoint)
                            scope.runtimeContext.restoreDurableCheckpoint(prepared.latestContextCheckpoint.snapshot);
                        recoveryRestoreEvents = this.sqliteEpoch
                            ? this.sessionStore.contextEventsAfter(scope.sessionID, this.sqliteEpoch)
                            : prepared.restoreEvents;
                        this.contextLedgerFactory.restore(scope.runtimeContext, recoveryRestoreEvents);
                        (0, operation_log_1.logOf)(scope.serviceDirectory).warn("context-restore", "session-recovery", {
                            sessionID: scope.sessionID,
                            replayableEvents: projection.replayableEvents.length,
                            restoreEvents: recoveryRestoreEvents.length,
                            contextEntries: scope.runtimeContext.snapshot().entries.length,
                            hasEpoch: this.sqliteEpoch !== undefined,
                            checkpointHasSummary: prepared.checkpointHasSummary,
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Phase 5 — Publish remaining durable references and wake queued work.
     */
    SessionRecoveryCoordinator.prototype.phase5Publish = function () {
        return __awaiter(this, void 0, void 0, function () {
            var scope, projection, _i, _a, _b, turnID, attachments, queued, activeSkillEntry, qualifiedName;
            var _c, _d, _e;
            return __generator(this, function (_f) {
                scope = this.scope;
                projection = this.projection;
                if (!projection)
                    throw new Error("session projection was not computed");
                for (_i = 0, _a = (_d = (_c = this.sqliteRecovery) === null || _c === void 0 ? void 0 : _c.attachments) !== null && _d !== void 0 ? _d : []; _i < _a.length; _i++) {
                    _b = _a[_i], turnID = _b[0], attachments = _b[1];
                    scope.attachmentReferences.set("".concat(turnID, ":user"), attachments);
                }
                queued = projection.pendingInputs.filter(function (input) { return input.delivery === "next-turn"; })[0];
                if (queued)
                    void scope.turnCoordinator().wake(scope.drainSession);
                activeSkillEntry = __spreadArray([], scope.runtimeContext.snapshot().entries, true).reverse()
                    .find(function (entry) { return entry.role === "system" && entry.id.startsWith("skill:"); });
                qualifiedName = (_e = activeSkillEntry === null || activeSkillEntry === void 0 ? void 0 : activeSkillEntry.id.match(/^skill:((?:project|remote|user):[^:]+):/u)) === null || _e === void 0 ? void 0 : _e[1];
                if (qualifiedName && scope.skillService()) {
                    try {
                        scope.activeSkill = scope.skillService().resolve(qualifiedName);
                    }
                    catch (_g) {
                        // A removed skill must not prevent durable scope.session recovery.
                    }
                }
                return [2 /*return*/];
            });
        });
    };
    return SessionRecoveryCoordinator;
}());
exports.SessionRecoveryCoordinator = SessionRecoveryCoordinator;
function computeRecoveryContextFallback(events, modelVisibleEvents) {
    var latestContextCheckpoint;
    var checkpointHasSummary = false;
    for (var index = events.length - 1; index >= 0; index--) {
        var event_4 = events[index];
        if ((event_4 === null || event_4 === void 0 ? void 0 : event_4.type) === "context.checkpoint") {
            latestContextCheckpoint = event_4;
            checkpointHasSummary = event_4.snapshot.entries.some(function (entry) { return entry.role === "summary"; });
            break;
        }
    }
    return {
        latestContextCheckpoint: latestContextCheckpoint,
        checkpointHasSummary: checkpointHasSummary,
        restoreEvents: checkpointHasSummary && latestContextCheckpoint
            ? modelVisibleEvents(events)
            : events,
    };
}
