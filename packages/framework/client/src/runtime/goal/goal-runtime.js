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
exports.createGoalRuntime = createGoalRuntime;
/**
 * Client-runtime wiring for the goal round driver.
 *
 * Owns the per-runtime `GoalService` (live activation) and `GoalRoundDriver`,
 * and exposes the host interface the driver needs. The driver itself lives in
 * `@natalia/goal` and is unit-tested there; this module only adapts it to the
 * runtime context.
 */
var goal_1 = require("@natalia/goal");
var session_1 = require("@anthelia/session");
var session_store_1 = require("@anthelia/session-store");
var goal_tools_1 = require("./goal-tools");
var goal_completion_check_1 = require("./goal-completion-check");
var operation_log_1 = require("@natalia/operation-log");
function createGoalRuntime(ctx) {
    var _this = this;
    var sequence = 0;
    var goalSequence = 0;
    var now = function () { return new Date().toISOString(); };
    var nextEventId = function () { return "goal_evt_".concat(Date.now().toString(36), "_").concat(++sequence); };
    var execFor = function (sessionID) {
        return ctx.ports.getExecutionBySession().get(sessionID);
    };
    var service = new goal_1.GoalService({
        now: now,
        nextEventId: nextEventId,
        nextGoalId: function () {
            return "goal_".concat(crypto.randomUUID().replace(/-/gu, "").slice(0, 16), "_").concat(++goalSequence);
        },
    });
    var host = {
        current: function (sessionID) {
            var exec = execFor(sessionID);
            if (!exec)
                return undefined;
            return service.current(sessionID, exec.session.events);
        },
        isIdle: function (sessionID) {
            var exec = execFor(sessionID);
            if (!exec)
                return false;
            return (!exec.activeTurnID &&
                !exec.paused &&
                !exec.endTurnWaitingHuman &&
                !exec.activeAbort);
        },
        hasCompetingInput: function (sessionID) {
            var exec = execFor(sessionID);
            if (!exec)
                return true;
            // A queued human (non-internal) input outranks automatic goal work.
            return (0, session_1.admittedInputs)(exec.session).some(function (input) { return !input.promotedAt && !input.internal; });
        },
        flush: function (sessionID) { return __awaiter(_this, void 0, void 0, function () {
            var store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        store = ctx.state.serviceDirectory.getOptional(session_store_1.sessionStoreController);
                        return [4 /*yield*/, (store === null || store === void 0 ? void 0 : store.flush(sessionID))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        admit: function (sessionID, input) { return __awaiter(_this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, ctx.ports.submitInput({
                                id: input.id,
                                text: input.text,
                                delivery: "next-turn",
                                internal: true,
                                sessionID: sessionID,
                            }, sessionID)];
                    case 1:
                        _b.sent();
                        return [2 /*return*/, true];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        }); },
        publish: function (sessionID, event) {
            var exec = execFor(sessionID);
            if (exec)
                ctx.ports.publishForSession(exec, event);
        },
        // EI Open Question "goal 关联的 plan 联动" — decided: 不自动推进 / 不自动
        // 完成，只做可见性。 The round prompt is told the linked plan's live
        // lifecycle (read fresh every round); the goal's completion authority
        // stays with the model and the user.
        linkedPlanStatus: function (sessionID, planID) {
            var exec = execFor(sessionID);
            if (!exec)
                return undefined;
            var plan = ctx.ports.planDocRuntime.planDocByID(planID);
            if (!plan)
                return undefined;
            return { planID: planID, lifecycle: plan.status };
        },
        now: now,
        nextEventId: nextEventId,
        log: function (event, detail) {
            if (process.env.NATALIA_GOAL_DEBUG === "0")
                return;
            (0, operation_log_1.logOf)(ctx.state.serviceDirectory).info("goal-driver", "", {
                args: [event, detail !== null && detail !== void 0 ? detail : {}],
            });
        },
    };
    var driver = new goal_1.GoalRoundDriver(service, host);
    var requestDrive = function (exec) {
        var sessionID = exec.session.id;
        // A turn is NOT idle at the instant `turn.finished` fires: the runner still
        // clears its active-turn fields a tick later. Poll briefly for the idle edge
        // instead of giving up on the first check. Bounded: the next `turn.finished`
        // (or a create/resume) re-triggers anyway.
        var attempts = 0;
        var attempt = function () {
            attempts += 1;
            if (host.isIdle(sessionID) && !host.hasCompetingInput(sessionID)) {
                void driver.drive(sessionID).catch(function () { return undefined; });
                return;
            }
            if (attempts < 25)
                setTimeout(attempt, 200);
        };
        setTimeout(attempt, 0);
    };
    // Waits (bounded) for an already-cancelled goal round to leave the reserved
    // slot, so its `settle(cancelled)` cannot re-pause a goal we are resuming.
    var waitForGoalRoundToSettle = function (exec) { return __awaiter(_this, void 0, void 0, function () {
        var sessionID, deadline, turnID;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    sessionID = exec.session.id;
                    deadline = Date.now() + 10000;
                    _a.label = 1;
                case 1:
                    if (!(Date.now() < deadline)) return [3 /*break*/, 3];
                    turnID = exec.activeTurnID;
                    if (!turnID || !driver.isGoalRound(sessionID, turnID))
                        return [2 /*return*/];
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 100); })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 1];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var capLabel = function (cap) { return (cap === 0 ? "unlimited" : String(cap)); };
    // A `next-step` steering note, injected as a user message at the next step of
    // the running round so the model adapts without a restart.
    var renderGoalEditNote = function (previous, next) {
        var _a, _b, _c, _d;
        var changes = [];
        if (previous.objective !== next.objective)
            changes.push("- Objective: ".concat(JSON.stringify(previous.objective), " -> ").concat(JSON.stringify(next.objective)));
        if (previous.maxGoalRounds !== next.maxGoalRounds)
            changes.push("- Round cap: ".concat(capLabel(previous.maxGoalRounds), " -> ").concat(capLabel(next.maxGoalRounds)));
        if (((_a = previous.planID) !== null && _a !== void 0 ? _a : "none") !== ((_b = next.planID) !== null && _b !== void 0 ? _b : "none"))
            changes.push("- Plan: ".concat((_c = previous.planID) !== null && _c !== void 0 ? _c : "none", " -> ").concat((_d = next.planID) !== null && _d !== void 0 ? _d : "none"));
        return __spreadArray(__spreadArray([
            "[goal edited by user]",
            "The human edited the active goal. New durable goal state:",
            "Objective: ".concat(JSON.stringify(next.objective)),
            "Revision: ".concat(next.revision)
        ], changes, true), [
            "Adapt the remaining work in this round to the new objective; the next round will start from it. Call get_goal if you need the exact state.",
        ], false).join("\n");
    };
    var control = function (action, sessionID) { return __awaiter(_this, void 0, void 0, function () {
        var exec, current, result_1, activeTurnID, latest, result_2, result, error_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    exec = execFor(sessionID);
                    if (!exec)
                        return [2 /*return*/, { ok: false, action: action, message: "session not found" }];
                    current = service.current(sessionID, exec.session.events);
                    if (!current)
                        return [2 /*return*/, { ok: false, action: action, message: "there is no goal" }];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 7, , 8]);
                    if (!(action === "pause")) return [3 /*break*/, 4];
                    result_1 = service.pause(sessionID, current, {
                        code: "user-paused",
                        message: "paused from the status bar",
                    });
                    ctx.ports.publishForSession(exec, result_1.event);
                    activeTurnID = exec.activeTurnID;
                    if (!(activeTurnID && driver.isGoalRound(sessionID, activeTurnID))) return [3 /*break*/, 3];
                    return [4 /*yield*/, ((_b = (_a = ctx.ports).cancelTurn) === null || _b === void 0 ? void 0 : _b.call(_a, "goal paused", sessionID))];
                case 2:
                    _c.sent();
                    _c.label = 3;
                case 3: return [2 /*return*/, { ok: true, action: action }];
                case 4:
                    if (!(action === "resume")) return [3 /*break*/, 6];
                    // If our pause cancelled a round that is still winding down, let it
                    // settle first or its `settle(cancelled)` would re-pause this resume.
                    return [4 /*yield*/, waitForGoalRoundToSettle(exec)];
                case 5:
                    // If our pause cancelled a round that is still winding down, let it
                    // settle first or its `settle(cancelled)` would re-pause this resume.
                    _c.sent();
                    latest = service.current(sessionID, exec.session.events);
                    if (!latest)
                        return [2 /*return*/, { ok: false, action: action, message: "there is no goal" }];
                    result_2 = service.resume(sessionID, latest);
                    ctx.ports.publishForSession(exec, result_2.event);
                    requestDrive(exec);
                    return [2 /*return*/, { ok: true, action: action }];
                case 6:
                    result = service.clear(sessionID, current);
                    ctx.ports.publishForSession(exec, result.event);
                    return [2 /*return*/, { ok: true, action: action }];
                case 7:
                    error_1 = _c.sent();
                    return [2 /*return*/, {
                            ok: false,
                            action: action,
                            message: error_1 instanceof Error ? error_1.message : String(error_1),
                        }];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    var edit = function (input, sessionID) { return __awaiter(_this, void 0, void 0, function () {
        var exec, current, result, activeTurnID, error_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    exec = execFor(sessionID);
                    if (!exec)
                        return [2 /*return*/, { ok: false, action: "edit", message: "session not found" }];
                    current = service.current(sessionID, exec.session.events);
                    if (!current)
                        return [2 /*return*/, { ok: false, action: "edit", message: "there is no goal" }];
                    if (input.goalID !== current.goalID || input.revision !== current.revision)
                        return [2 /*return*/, {
                                ok: false,
                                action: "edit",
                                message: "stale goal_id/revision; refresh and retry",
                            }];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    result = service.edit(sessionID, current, __assign(__assign(__assign({}, (input.objective !== undefined
                        ? { objective: input.objective }
                        : {})), (input.maxGoalRounds !== undefined
                        ? { maxGoalRounds: input.maxGoalRounds }
                        : {})), (input.planID !== undefined ? { planID: input.planID } : {})));
                    ctx.ports.publishForSession(exec, result.event);
                    activeTurnID = exec.activeTurnID;
                    if (!(result.event.operation === "edit" &&
                        activeTurnID &&
                        driver.isGoalRound(sessionID, activeTurnID))) return [3 /*break*/, 3];
                    return [4 /*yield*/, ctx.ports
                            .submitInput({
                            id: "goal_edit_".concat(result.view.revision),
                            text: renderGoalEditNote(current, result.view),
                            delivery: "next-step",
                            internal: true,
                            sessionID: sessionID,
                        }, sessionID)
                            .catch(function () { return undefined; })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    requestDrive(exec);
                    return [2 /*return*/, { ok: true, action: "edit" }];
                case 4:
                    error_2 = _a.sent();
                    return [2 /*return*/, {
                            ok: false,
                            action: "edit",
                            message: error_2 instanceof Error ? error_2.message : String(error_2),
                        }];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var refresh = function (sessionID) { return __awaiter(_this, void 0, void 0, function () {
        var store, recovered, exec, goal;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    store = ctx.state.serviceDirectory.get(session_store_1.sessionStoreController);
                    // Any goal mutation already queued for persistence must land before the
                    // recovery row is read, or a just-cleared goal would be resurrected.
                    return [4 /*yield*/, ctx.ports
                            .getSessionPersistenceForSession(sessionID)
                            .catch(function () { return undefined; })];
                case 1:
                    // Any goal mutation already queued for persistence must land before the
                    // recovery row is read, or a just-cleared goal would be resurrected.
                    _b.sent();
                    return [4 /*yield*/, (store === null || store === void 0 ? void 0 : store.flush(sessionID).catch(function () { return undefined; }))];
                case 2:
                    _b.sent();
                    recovered = (_a = store === null || store === void 0 ? void 0 : store.loadRecoveryProjection(sessionID)) === null || _a === void 0 ? void 0 : _a.goal;
                    if (recovered)
                        service.seed(sessionID, recovered);
                    exec = execFor(sessionID);
                    if (!exec)
                        return [2 /*return*/];
                    try {
                        goal = service.current(sessionID, exec.session.events);
                    }
                    catch (_c) {
                        // A mid-history journal tail cannot be folded. The recovery seed (when
                        // present) already won above, so leave the current UI state untouched.
                        return [2 /*return*/];
                    }
                    ctx.ports.publishForSession(exec, __assign(__assign({ type: "goal.status" }, (goal ? { goal: goal } : {})), { at: now() }));
                    return [2 /*return*/];
            }
        });
    }); };
    var runtime = {
        service: service,
        driver: driver,
        tools: [],
        control: control,
        edit: edit,
        refresh: refresh,
        onTurnFinished: function (exec, event) {
            var _a, _b, _c;
            if (event.type !== "turn.finished")
                return;
            var stop = event.stopReason === "cancelled"
                ? "cancelled"
                : event.stopReason === "error"
                    ? "error"
                    : "done";
            // The turn's own report is the round's cost: input plus output tokens, and
            // its wall clock. A turn that reports neither books nothing, so a goal
            // without a budget never blocks on a figure it cannot observe.
            var tokens = event.inputTokens === undefined && event.outputTokens === undefined
                ? undefined
                : ((_a = event.inputTokens) !== null && _a !== void 0 ? _a : 0) + ((_b = event.outputTokens) !== null && _b !== void 0 ? _b : 0);
            driver.settle(exec.session.id, event.id, stop, {
                tokens: tokens !== null && tokens !== void 0 ? tokens : 0,
                durationMs: (_c = event.durationMs) !== null && _c !== void 0 ? _c : 0,
            });
            requestDrive(exec);
        },
        requestDrive: requestDrive,
        disarm: function (sessionID) {
            service.disarm(sessionID);
        },
    };
    runtime.tools = (0, goal_tools_1.goalTools)(ctx, runtime, {
        // The configured command, read at call time rather than captured here, so a
        // config reload takes effect without rebuilding the tool.
        completionCheck: function () {
            var _a;
            return (0, goal_completion_check_1.runCompletionCheck)({
                workspaceRoot: ctx.ports.getWorkspaceRoot(),
                command: (_a = ctx.ports.getTsRuntimeConfig()) === null || _a === void 0 ? void 0 : _a.goal.completionCommand,
            });
        },
    });
    return runtime;
}
