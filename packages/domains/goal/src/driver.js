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
exports.GoalRoundDriver = void 0;
exports.renderGoalRoundPrompt = renderGoalRoundPrompt;
exports.goalBudgetExhausted = goalBudgetExhausted;
/**
 * Same-session goal round driver.
 *
 * Turns an active, armed goal into sequential `<goal_round>` turns through a
 * small host interface (admission, idle/queue observation, flush, publish), so
 * it stays independent of the concrete agent loop — the same split dsh uses
 * between `goal`, `goal-round-driver` and `tool-goal`.
 *
 * This is what replaces "wake an auditor every turn to prod the model": the
 * driver itself continues the goal while work remains, and stops explicitly on
 * completion, cancellation, error, a provider budget stop or the round cap.
 */
var builders_1 = require("./builders");
/** Renders one retained goal-round instruction (dsh's `<goal_round>` block). */
function renderGoalRoundPrompt(goal, round, linkedPlan) {
    var cap = goal.maxGoalRounds === 0 ? "unlimited" : String(goal.maxGoalRounds);
    // EI Open Question "goal 关联的 plan 完成是否自动推进 goal round" — decided:
    // 不自动（plan 完成是证据不是目标本身，goal 完成权在模型+用户），只做可见性。
    // The round is told the linked plan's live lifecycle so the model decides
    // with it in view; the driver never completes the goal on the plan's behalf.
    var planBlock = linkedPlan
        ? "\nLinked plan: ".concat(linkedPlan.planID, " \u2014 lifecycle: ").concat(linkedPlan.lifecycle, ". ") +
            "The plan is one instrument of this objective, not the objective itself: " +
            "treat its completion as evidence, and mark the goal complete only when " +
            "the whole objective is achieved.\n"
        : "";
    return ("<goal_round>\n" +
        "Objective: ".concat(JSON.stringify(goal.objective), "\n") +
        "Round: ".concat(round, "/").concat(cap, "\n") +
        planBlock +
        "\n" +
        "Continue working toward the objective in this same session. Treat the current " +
        "workspace, tool results, and durable session state as authoritative; inspect them " +
        "instead of assuming earlier narration is still current. Make concrete progress and " +
        "verify the result. Before claiming completion, gather evidence that the whole " +
        "objective is achieved, read the current goal, and mark it complete. If work remains, " +
        "leave the goal active for the next round. If you must stop for a human decision, use " +
        "ask_user. Follow the goal-tool policy before reporting a blocked goal.\n" +
        "</goal_round>");
}
/**
 * Which budget, if any, the goal has exhausted.
 *
 * Round caps are checked separately at the round boundary, because a round is
 * admitted or refused rather than interrupted. Token and wall-clock caps are also
 * checked here rather than mid-round: a goal already over budget must not start
 * another round it cannot finish.
 */
function goalBudgetExhausted(goal) {
    if (goal.maxGoalTokens > 0 && goal.spentGoalTokens >= goal.maxGoalTokens)
        return {
            code: "token-limit",
            message: "Goal reached its configured limit of ".concat(goal.maxGoalTokens, " tokens ") +
                "(spent ".concat(goal.spentGoalTokens, ")."),
        };
    if (goal.maxGoalWallClockMs > 0 &&
        goal.goalWallClockMs >= goal.maxGoalWallClockMs)
        return {
            code: "time-limit",
            message: "Goal reached its configured limit of ".concat(goal.maxGoalWallClockMs, "ms of ") +
                "work (used ".concat(goal.goalWallClockMs, "ms)."),
        };
    return undefined;
}
var GoalRoundDriver = /** @class */ (function () {
    function GoalRoundDriver(service, host) {
        this.service = service;
        this.host = host;
        this.reservations = new Map();
        this.chains = new Map();
    }
    /** True when this turn id belongs to a round this driver reserved. */
    GoalRoundDriver.prototype.isGoalRound = function (sessionID, turnID) {
        var _a;
        return ((_a = this.reservations.get(sessionID)) === null || _a === void 0 ? void 0 : _a.messageID) === turnID;
    };
    /** Coalesces triggers onto one per-session serialized drive. */
    GoalRoundDriver.prototype.drive = function (sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var previous, run;
            var _this = this;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        previous = (_a = this.chains.get(sessionID)) !== null && _a !== void 0 ? _a : Promise.resolve();
                        run = previous
                            .catch(function () { return undefined; })
                            .then(function () { return _this.driveOnce(sessionID); });
                        this.chains.set(sessionID, run);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, , 3, 4]);
                        return [4 /*yield*/, run];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        if (this.chains.get(sessionID) === run)
                            this.chains.delete(sessionID);
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    GoalRoundDriver.prototype.trace = function (event, detail) {
        var _a, _b;
        if (detail === void 0) { detail = {}; }
        (_b = (_a = this.host).log) === null || _b === void 0 ? void 0 : _b.call(_a, event, detail);
    };
    GoalRoundDriver.prototype.driveOnce = function (sessionID) {
        return __awaiter(this, void 0, void 0, function () {
            var idle, competing, goal, exhausted, round, reservation, _a, latest, admitted, linkedPlan, _b;
            var _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        if (this.reservations.has(sessionID)) {
                            this.trace("skip", { sessionID: sessionID, reason: "round-already-reserved" });
                            return [2 /*return*/];
                        }
                        idle = this.host.isIdle(sessionID);
                        competing = this.host.hasCompetingInput(sessionID);
                        if (!idle || competing) {
                            this.trace("skip", {
                                sessionID: sessionID,
                                reason: !idle ? "not-idle" : "human-input-pending",
                            });
                            return [2 /*return*/];
                        }
                        goal = this.host.current(sessionID);
                        if (!goal || goal.phase !== "active" || goal.activation !== "armed") {
                            this.trace("skip", {
                                sessionID: sessionID,
                                reason: goal
                                    ? "phase=".concat(goal.phase, " activation=").concat(goal.activation)
                                    : "no-goal",
                            });
                            return [2 /*return*/];
                        }
                        this.trace("drive", {
                            sessionID: sessionID,
                            goalID: goal.goalID,
                            revision: goal.revision,
                            round: goal.roundsStarted + 1,
                        });
                        if (goal.maxGoalRounds !== 0 && goal.roundsStarted >= goal.maxGoalRounds) {
                            this.stop(sessionID, goal, {
                                code: "round-limit",
                                message: "Goal reached its configured limit of ".concat(goal.maxGoalRounds, " rounds."),
                            });
                            return [2 /*return*/];
                        }
                        exhausted = goalBudgetExhausted(goal);
                        if (exhausted) {
                            this.stop(sessionID, goal, exhausted);
                            return [2 /*return*/];
                        }
                        round = goal.roundsStarted + 1;
                        reservation = {
                            goalID: goal.goalID,
                            revision: goal.revision,
                            round: round,
                            messageID: "goal_".concat(goal.goalID, "_round_").concat(round),
                        };
                        this.reservations.set(sessionID, reservation);
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 3, , 4]);
                        // Durability obligation before reserving work, then recheck everything
                        // the await could have changed.
                        return [4 /*yield*/, this.host.flush(sessionID)];
                    case 2:
                        // Durability obligation before reserving work, then recheck everything
                        // the await could have changed.
                        _e.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _e.sent();
                        this.reservations.delete(sessionID);
                        this.service.disarm(sessionID);
                        this.trace("disarm", { sessionID: sessionID, reason: "flush-failed" });
                        return [2 /*return*/];
                    case 4:
                        if (!this.host.isIdle(sessionID) ||
                            this.host.hasCompetingInput(sessionID)) {
                            this.reservations.delete(sessionID);
                            this.trace("reservation-dropped", { sessionID: sessionID, reason: "stale-input" });
                            return [2 /*return*/];
                        }
                        latest = this.host.current(sessionID);
                        if (!latest ||
                            latest.goalID !== goal.goalID ||
                            latest.revision !== goal.revision ||
                            latest.phase !== "active" ||
                            latest.activation !== "armed") {
                            // A mutation, a human prompt or a disarm won the race: drop the
                            // reservation without charging a round.
                            this.reservations.delete(sessionID);
                            this.trace("reservation-dropped", { sessionID: sessionID, reason: "stale-goal" });
                            return [2 /*return*/];
                        }
                        this.trace("admit", {
                            sessionID: sessionID,
                            round: round,
                            messageID: reservation.messageID,
                        });
                        admitted = false;
                        _e.label = 5;
                    case 5:
                        _e.trys.push([5, 7, , 8]);
                        linkedPlan = latest.planID
                            ? (_d = (_c = this.host).linkedPlanStatus) === null || _d === void 0 ? void 0 : _d.call(_c, sessionID, latest.planID)
                            : undefined;
                        return [4 /*yield*/, this.host.admit(sessionID, {
                                id: reservation.messageID,
                                text: renderGoalRoundPrompt(latest, round, linkedPlan),
                            })];
                    case 6:
                        admitted = _e.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        _b = _e.sent();
                        admitted = false;
                        return [3 /*break*/, 8];
                    case 8:
                        if (!admitted) {
                            this.reservations.delete(sessionID);
                            this.trace("admit-failed", { sessionID: sessionID, round: round });
                            this.stop(sessionID, latest, {
                                code: "queue-failed",
                                message: "Could not queue goal round ".concat(round, "."),
                            });
                            return [2 /*return*/];
                        }
                        // The round is admitted: record it durably so replay counts it.
                        this.trace("round-admitted", { sessionID: sessionID, goalID: goal.goalID, round: round });
                        this.host.publish(sessionID, (0, builders_1.buildGoalRound)({
                            id: this.host.nextEventId(),
                            at: this.host.now(),
                            goalID: goal.goalID,
                            revision: goal.revision,
                            round: round,
                        }));
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Books one finished goal round's cost.
     *
     * The numbers come from the turn's own report, and they are published as a
     * durable event rather than added to an in-memory total: the accumulators are
     * derived by replay, so a restart resumes with exactly the figures the log
     * says instead of whatever the last process happened to know.
     */
    GoalRoundDriver.prototype.bookRoundCost = function (sessionID, goal, reservation, tokens, durationMs) {
        this.host.publish(sessionID, {
            type: "goal.round.cost",
            id: this.host.nextEventId(),
            goalID: goal.goalID,
            revision: goal.revision,
            round: reservation.round,
            at: this.host.now(),
            tokens: tokens,
            durationMs: durationMs,
        });
    };
    /** Classifies a finished turn and stops continuation when appropriate. */
    GoalRoundDriver.prototype.settle = function (sessionID, turnID, stopReason, cost) {
        var _a;
        var reservation = this.reservations.get(sessionID);
        var wasGoalRound = (reservation === null || reservation === void 0 ? void 0 : reservation.messageID) === turnID;
        if (wasGoalRound)
            this.reservations.delete(sessionID);
        // Mutable: re-read after a round's cost is booked, so a stop writes
        // the figures that include it rather than the ones loaded before it.
        var goal = this.host.current(sessionID);
        if (!goal)
            return;
        this.trace("settle", {
            sessionID: sessionID,
            turnID: turnID,
            stopReason: stopReason,
            goalRound: wasGoalRound,
        });
        if (!wasGoalRound) {
            // A broad cancellation of UNRELATED work must not let the goal
            // auto-restart: drop process-local continuation authority. The durable
            // phase is unchanged, so a human `/goal resume` re-arms it.
            if (stopReason === "cancelled") {
                // Pause (durable, visible) so the status bar shows the goal stopped,
                // and disarm so even a failed pause cannot restart it.
                this.stop(sessionID, goal, {
                    code: "cancelled",
                    message: "automatic continuation was cancelled",
                }, true);
            }
            return;
        }
        // A cancelled or errored round still consumed its tokens and its wall clock,
        // so it is booked before classification: skipping it would let a goal that
        // fails every round spend without ever hitting a budget.
        if (cost && wasGoalRound) {
            this.bookRoundCost(sessionID, goal, reservation, cost.tokens, cost.durationMs);
            // Re-read: `goal` above was loaded before the cost was booked, so stopping
            // with it would write a snapshot that says the round spent nothing.
            goal = (_a = this.host.current(sessionID)) !== null && _a !== void 0 ? _a : goal;
        }
        switch (stopReason) {
            case "cancelled":
                this.stop(sessionID, goal, { code: "cancelled", message: "the goal round was cancelled" }, true);
                return;
            case "error":
                this.stop(sessionID, goal, {
                    code: "turn-error",
                    message: "the goal round ended with an error",
                });
                return;
            default:
                // `done`: the next idle drive decides whether to continue.
                return;
        }
    };
    GoalRoundDriver.prototype.stop = function (sessionID, goal, reason, pause) {
        if (pause === void 0) { pause = false; }
        this.trace("stop", {
            sessionID: sessionID,
            action: pause ? "pause" : "block",
            code: reason.code,
        });
        try {
            var result = pause
                ? this.service.pause(sessionID, goal, reason)
                : this.service.block(sessionID, goal, reason);
            this.host.publish(sessionID, result.event);
        }
        catch (_a) {
            // A refused/failed stop must never leave cancelled work able to restart.
            this.service.disarm(sessionID);
        }
    };
    return GoalRoundDriver;
}());
exports.GoalRoundDriver = GoalRoundDriver;
