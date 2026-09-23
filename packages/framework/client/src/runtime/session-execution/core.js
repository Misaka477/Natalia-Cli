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
exports.createCoreSurface = createCoreSurface;
var turn_orchestration_1 = require("@anthelia/turn-orchestration");
var session_1 = require("@anthelia/session");
function createCoreSurface(ctx, options) {
    return {
        service: function (name) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.ensureReady()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, ctx.ports.getCapabilityRegistry().service(name)];
                    }
                });
            });
        },
        start: function (onEvent, startOptions) {
            var _a;
            ctx.ports.setSink(onEvent);
            ctx.ports.setReplayMode((_a = startOptions === null || startOptions === void 0 ? void 0 : startOptions.replay) !== null && _a !== void 0 ? _a : "all");
            // Idempotent: a second subscriber (e.g. the transport server attaching
            // its event sink after the TUI) must not re-run initialize. Re-running
            // it opened a second sqlite connection and a second workspace watcher,
            // which on Windows fails the sqlite open and leaks the first watcher,
            // keeping the process alive after dispose.
            void ctx.ports.ensureReady();
        },
        submit: function (text, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.submitInput(__assign({ text: text }, (sessionID ? { sessionID: sessionID } : {})))];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        submitAndWait: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var normalized, submitted, exec;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            normalized = typeof input === "string" ? { text: input } : input;
                            return [4 /*yield*/, ctx.ports.submitInput(normalized)];
                        case 1:
                            submitted = _b.sent();
                            exec = ctx.ports
                                .getExecutionBySession()
                                .get(((_a = normalized.sessionID) !== null && _a !== void 0 ? _a : ctx.ports.getSessionID()));
                            return [4 /*yield*/, waitForTurnSettled(submitted.id, Boolean(exec === null || exec === void 0 ? void 0 : exec.activeTurnID), normalized.sessionID)];
                        case 2:
                            _b.sent();
                            return [2 /*return*/, submitted];
                    }
                });
            });
        },
        cancel: function (reason, sessionID) {
            var _this = this;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            if (reason === void 0) { reason = "user cancel"; }
            var cancelledSessionID = (sessionID !== null && sessionID !== void 0 ? sessionID : ctx.ports.getSessionID());
            var coordinator = (0, session_1.sessionRunCoordinator)(cancelledSessionID);
            var cancelledExec = (_a = ctx.ports
                .getExecutionBySession()
                .get(cancelledSessionID)) !== null && _a !== void 0 ? _a : ctx.ports.getActiveExec();
            var runningTurnID = cancelledExec === null || cancelledExec === void 0 ? void 0 : cancelledExec.activeTurnID;
            var pendingTurnID = runningTurnID
                ? undefined
                : (_b = cancelledExec === null || cancelledExec === void 0 ? void 0 : cancelledExec.lastSubmitted) === null || _b === void 0 ? void 0 : _b.id;
            var pendingSessionID = pendingTurnID
                ? ((_c = ctx.ports.getTurnSession().get(pendingTurnID)) !== null && _c !== void 0 ? _c : cancelledSessionID)
                : undefined;
            var pendingSession = pendingTurnID
                ? ((_e = (_d = ctx.ports.getExecutionBySession().get(pendingSessionID)) === null || _d === void 0 ? void 0 : _d.session) !== null && _e !== void 0 ? _e : ctx.ports.getSession())
                : undefined;
            var pendingInput = (_f = pendingSession === null || pendingSession === void 0 ? void 0 : pendingSession.inbox) === null || _f === void 0 ? void 0 : _f.find(function (input) { return input.id === pendingTurnID && !input.promotedAt; });
            if (pendingInput && pendingSession) {
                pendingSession.inbox = (_g = pendingSession.inbox) === null || _g === void 0 ? void 0 : _g.filter(function (input) { return input.id !== pendingTurnID; });
                if (cancelledExec && ((_h = cancelledExec.lastSubmitted) === null || _h === void 0 ? void 0 : _h.id) === pendingTurnID)
                    cancelledExec.lastSubmitted = undefined;
            }
            if (cancelledExec)
                cancelledExec.paused = false;
            ctx.ports.setPaused(false);
            var waiters = (_j = cancelledExec === null || cancelledExec === void 0 ? void 0 : cancelledExec.pauseWaiters) !== null && _j !== void 0 ? _j : ctx.ports.getPauseWaiters();
            if (cancelledExec)
                cancelledExec.pauseWaiters = [];
            else
                ctx.ports.setPauseWaiters([]);
            for (var _i = 0, waiters_1 = waiters; _i < waiters_1.length; _i++) {
                var resolveWaiter = waiters_1[_i];
                resolveWaiter();
            }
            (_k = cancelledExec === null || cancelledExec === void 0 ? void 0 : cancelledExec.activeAbort) === null || _k === void 0 ? void 0 : _k.abort(reason);
            if (runningTurnID) {
                ctx.ports.publish({
                    type: "turn.cancelled",
                    id: runningTurnID,
                    reason: reason,
                });
            }
            else if (pendingInput) {
                // A pending input never started a turn, so it is removed from the queue
                // slice rather than cancelled as a turn.
                var pendingExec = pendingSessionID
                    ? ctx.ports.getExecutionBySession().get(pendingSessionID)
                    : undefined;
                if (pendingExec)
                    ctx.ports.publishForSession(pendingExec, {
                        type: "input.removed",
                        id: pendingInput.id,
                    });
            }
            else if (coordinator.active && (cancelledExec === null || cancelledExec === void 0 ? void 0 : cancelledExec.lastSubmitted)) {
                ctx.ports.publish({
                    type: "turn.cancelled",
                    id: cancelledExec.lastSubmitted.id,
                    reason: reason,
                });
            }
            void (function () { return __awaiter(_this, void 0, void 0, function () {
                var controller;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!pendingInput) return [3 /*break*/, 2];
                            controller = ctx.state.serviceDirectory.get(turn_orchestration_1.turnController);
                            return [4 /*yield*/, controller.persistPromotion(pendingSessionID)];
                        case 1:
                            _a.sent();
                            _a.label = 2;
                        case 2: return [4 /*yield*/, coordinator.interrupt()];
                        case 3:
                            _a.sent();
                            if (!pendingInput) return [3 /*break*/, 5];
                            return [4 /*yield*/, coordinator.wake(ctx.ports.drainSessionFor(pendingSessionID !== null && pendingSessionID !== void 0 ? pendingSessionID : cancelledSessionID))];
                        case 4:
                            _a.sent();
                            _a.label = 5;
                        case 5: return [2 /*return*/];
                    }
                });
            }); })().catch(function (error) {
                return ctx.ports.publishForSession(cancelledExec, {
                    type: "diagnostic",
                    level: "warning",
                    message: "session cancellation cleanup failed: ".concat(error instanceof Error ? error.message : String(error)),
                });
            });
        },
        snapshot: function () {
            var event = {
                type: "snapshot.created",
                id: "snap_".concat(Date.now().toString(36)),
                files: [],
            };
            ctx.ports.publish(event);
            return event;
        },
        diagnostic: function (message, level) {
            if (level === void 0) { level = "warning"; }
            ctx.ports.publish({ type: "diagnostic", level: level, message: message });
        },
        lastSubmission: function () {
            var _a;
            return (_a = ctx.ports.getActiveExec()) === null || _a === void 0 ? void 0 : _a.lastSubmitted;
        },
        respondApproval: function (response) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, ctx.ports.getInteractive().respondApproval(response)];
                    }
                });
            });
        },
        respondQuestion: function (response) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, ctx.ports.getInteractive().respondQuestion(response)];
                    }
                });
            });
        },
        respondInteractive: function (response) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, ctx.ports.getInteractive().respondInteractive(response)];
                    }
                });
            });
        },
    };
    function waitForTurnSettled(id, activeAtSubmit, explicitSessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var sessionID, submittedIndex, started, _loop_1, state_1;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        sessionID = (explicitSessionID !== null && explicitSessionID !== void 0 ? explicitSessionID : ctx.ports.getSessionID());
                        submittedIndex = -1;
                        started = false;
                        _loop_1 = function () {
                            var exec, events, injected_1, settled, exactFinished, exactCancelled, cancelled;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        exec = ctx.ports.getExecutionBySession().get(sessionID);
                                        events = (_a = exec === null || exec === void 0 ? void 0 : exec.session.events) !== null && _a !== void 0 ? _a : [];
                                        if (!(submittedIndex < 0)) return [3 /*break*/, 2];
                                        submittedIndex = events.findIndex(function (event) { return event.type === "turn.submitted" && event.id === id; });
                                        if (!(submittedIndex < 0)) return [3 /*break*/, 2];
                                        // A queued input removed before it ever started a turn settles here;
                                        // there is no turn event to wait for.
                                        if (events.some(function (event) { return event.type === "input.removed" && event.id === id; }))
                                            return [2 /*return*/, { value: void 0 }];
                                        injected_1 = events.find(function (event) {
                                            return event.type === "turn.input" && event.inputID === id;
                                        });
                                        if (injected_1) {
                                            settled = events.some(function (event) {
                                                return (event.type === "turn.finished" ||
                                                    event.type === "turn.cancelled") &&
                                                    event.id === injected_1.turnID;
                                            });
                                            if (settled && (exec === null || exec === void 0 ? void 0 : exec.activeTurnID) !== injected_1.turnID)
                                                return [2 /*return*/, { value: void 0 }];
                                        }
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
                                    case 1:
                                        _c.sent();
                                        return [2 /*return*/, "continue"];
                                    case 2:
                                        exactFinished = events.some(function (event) { return event.type === "turn.finished" && event.id === id; });
                                        if (exactFinished)
                                            return [2 /*return*/, { value: void 0 }];
                                        exactCancelled = events.some(function (event) { return event.type === "turn.cancelled" && event.id === id; });
                                        // A cancellation event can be published before the provider/tool actually
                                        // settles. Only treat it as complete when the turn is no longer active.
                                        if (exactCancelled && !(exec === null || exec === void 0 ? void 0 : exec.activeTurnID))
                                            return [2 /*return*/, { value: void 0 }];
                                        if (exactCancelled && (exec === null || exec === void 0 ? void 0 : exec.activeTurnID) && exec.activeTurnID !== id)
                                            return [2 /*return*/, { value: void 0 }];
                                        if (activeAtSubmit) {
                                            // A turn was already running when the blocking submit was made. Do not
                                            // be fooled by that older turn's terminal event: wait for the newly
                                            // submitted turn to actually start and then leave the active slot.
                                            if ((exec === null || exec === void 0 ? void 0 : exec.activeTurnID) === id ||
                                                events.some(function (event) { return event.type === "turn.started" && event.id === id; }))
                                                started = true;
                                            if (started && (exec === null || exec === void 0 ? void 0 : exec.activeTurnID) !== id)
                                                return [2 /*return*/, { value: void 0 }];
                                        }
                                        else {
                                            // Some collaborative/mailbox boundaries execute an internal turn and
                                            // settle the session without a terminal event carrying the caller's
                                            // submitted turn id. For an idle submission the first settlement after
                                            // this submission is the work it woke.
                                            if (events
                                                .slice(submittedIndex + 1)
                                                .some(function (event) { return event.type === "turn.finished"; }))
                                                return [2 /*return*/, { value: void 0 }];
                                            cancelled = events
                                                .slice(submittedIndex + 1)
                                                .some(function (event) { return event.type === "turn.cancelled"; });
                                            if (cancelled && !(exec === null || exec === void 0 ? void 0 : exec.activeTurnID))
                                                return [2 /*return*/, { value: void 0 }];
                                            if (cancelled && (exec === null || exec === void 0 ? void 0 : exec.activeTurnID) && exec.activeTurnID !== id)
                                                return [2 /*return*/, { value: void 0 }];
                                        }
                                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
                                    case 3:
                                        _c.sent();
                                        return [2 /*return*/];
                                }
                            });
                        };
                        _b.label = 1;
                    case 1:
                        if (!!ctx.ports.isDisposed()) return [3 /*break*/, 3];
                        return [5 /*yield**/, _loop_1()];
                    case 2:
                        state_1 = _b.sent();
                        if (typeof state_1 === "object")
                            return [2 /*return*/, state_1.value];
                        return [3 /*break*/, 1];
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
}
