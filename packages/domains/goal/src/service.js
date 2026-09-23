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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoalService = exports.DEFAULT_MAX_GOAL_ROUNDS = void 0;
var builders_1 = require("./builders");
var fold_1 = require("./fold");
exports.DEFAULT_MAX_GOAL_ROUNDS = 256;
function stopCode(code, message, at) {
    return { code: code, at: at, message: message };
}
/**
 * Copies only the durable snapshot fields (never `activation` / timestamps,
 * which belong to the live view and must not be persisted in the event).
 */
function snapshotOf(view, phase) {
    return __assign({ goalID: view.goalID, revision: view.revision + 1, objective: view.objective, phase: phase, maxGoalRounds: view.maxGoalRounds, 
        // Budget and spend carry forward with the snapshot, so a later mutation
        // cannot silently reset what the goal has already consumed.
        maxGoalTokens: view.maxGoalTokens, maxGoalWallClockMs: view.maxGoalWallClockMs, spentGoalTokens: view.spentGoalTokens, goalWallClockMs: view.goalWallClockMs }, (view.planID ? { planID: view.planID } : {}));
}
var GoalService = /** @class */ (function () {
    function GoalService(ports) {
        this.ports = ports;
        this.activation = new Map();
        /**
         * Per-session view cache. A live mutation or a recovery seed makes this the
         * authority so `current()` stays correct while the fast-path journal is only
         * a tail (or still empty). `null` is a tombstone: the goal was cleared.
         */
        this.views = new Map();
        /**
         * Cost events already applied to the cached view, per session.
         *
         * `current()` is called repeatedly against a growing journal tail, so charging
         * by scanning would bill the same round twice. Keying on the event id makes
         * the accounting idempotent without needing to reason about where the tail
         * starts.
         */
        this.chargedCosts = new Map();
    }
    /**
     * Seeds the current view from the durable recovery projection. Positive
     * views only: a goal-less session keeps folding its journal (which may still
     * hold a goal that predates the recovery table).
     */
    GoalService.prototype.seed = function (sessionID, view) {
        var _a, _b, _c;
        if (!view)
            return;
        // A recovery row read mid-batch can lag a live mutation; never let it
        // downgrade a newer cached revision/round count.
        var existing = this.views.get(sessionID);
        if (existing &&
            existing.goalID === view.goalID &&
            (existing.revision > view.revision ||
                (existing.revision === view.revision &&
                    existing.roundsStarted > view.roundsStarted)))
            return;
        var at = this.ports.now();
        this.views.set(sessionID, __assign(__assign({}, view), { createdAt: (_a = view.createdAt) !== null && _a !== void 0 ? _a : at, updatedAt: (_c = (_b = view.updatedAt) !== null && _b !== void 0 ? _b : view.createdAt) !== null && _c !== void 0 ? _c : at, activation: "disarmed" }));
    };
    GoalService.prototype.withActivation = function (sessionID, view) {
        var _a;
        if (!view)
            return undefined;
        return __assign(__assign({}, view), { activation: (_a = this.activation.get(sessionID)) !== null && _a !== void 0 ? _a : "disarmed" });
    };
    /** Current goal for the session, from the cache, journal, or recovery seed. */
    GoalService.prototype.current = function (sessionID, events) {
        var _a, _b;
        if (!this.views.has(sessionID))
            return this.withActivation(sessionID, (0, fold_1.foldGoal)(events));
        // Mutable because settled costs are charged into it below.
        var cached = (_a = this.views.get(sessionID)) !== null && _a !== void 0 ? _a : undefined;
        if (!cached)
            return undefined;
        // Admitted rounds and settled costs are appended to the journal before the
        // cache is told (unit callers publish directly), so charge them here — the
        // same accounting `foldGoal` does from scratch, applied incrementally.
        var roundsStarted = cached.roundsStarted;
        var charged = (_b = this.chargedCosts.get(sessionID)) !== null && _b !== void 0 ? _b : new Set();
        this.chargedCosts.set(sessionID, charged);
        for (var _i = 0, events_1 = events; _i < events_1.length; _i++) {
            var event_1 = events_1[_i];
            if (event_1.type !== "goal.round" && event_1.type !== "goal.round.cost")
                continue;
            // A cost for a superseded revision belongs to the goal it was billed
            // against, not to the current one.
            if (event_1.goalID !== cached.goalID || event_1.revision !== cached.revision)
                continue;
            if (event_1.type === "goal.round") {
                if (event_1.round > roundsStarted)
                    roundsStarted = event_1.round;
                continue;
            }
            if (charged.has(event_1.id))
                continue;
            charged.add(event_1.id);
            cached = __assign(__assign({}, cached), { spentGoalTokens: cached.spentGoalTokens + event_1.tokens, goalWallClockMs: cached.goalWallClockMs + event_1.durationMs });
        }
        // The round count is charged into the cache too, or the next call would
        // re-derive it from a journal that has not grown.
        if (roundsStarted !== cached.roundsStarted)
            cached = __assign(__assign({}, cached), { roundsStarted: roundsStarted });
        this.views.set(sessionID, cached);
        return this.withActivation(sessionID, cached);
    };
    /** Removes process-local continuation authority without touching the log. */
    GoalService.prototype.disarm = function (sessionID) {
        this.activation.set(sessionID, "disarmed");
    };
    GoalService.prototype.arm = function (sessionID) {
        this.activation.set(sessionID, "armed");
    };
    GoalService.prototype.isArmed = function (sessionID) {
        var _a;
        return ((_a = this.activation.get(sessionID)) !== null && _a !== void 0 ? _a : "disarmed") === "armed";
    };
    GoalService.prototype.emit = function (sessionID, operation, next, roundsStarted, current, at) {
        var event = (0, builders_1.buildGoalChanged)({
            id: this.ports.nextEventId(),
            at: at,
            operation: operation,
            snapshot: next,
            roundsStarted: roundsStarted,
        });
        // Lifecycle stops disarm; create/resume arm. An edit is a modification, not
        // a stop, so it preserves the current continuation authority — otherwise a
        // mid-flight edit would silently prevent the next round from running.
        var armed = operation === "create" || operation === "resume"
            ? true
            : operation === "edit"
                ? this.isArmed(sessionID)
                : false;
        this.activation.set(sessionID, armed ? "armed" : "disarmed");
        var createdAt = current && current.goalID === next.goalID ? current.createdAt : at;
        var view = __assign(__assign({}, next), { roundsStarted: roundsStarted, createdAt: createdAt, updatedAt: at, activation: armed ? "armed" : "disarmed" });
        this.views.set(sessionID, view);
        return { event: event, view: view };
    };
    GoalService.prototype.create = function (sessionID, current, input) {
        var _a, _b, _c;
        if (current && current.phase !== "complete")
            throw new Error("cannot create a goal while ".concat(current.goalID, " is ").concat(current.phase));
        var objective = input.objective.trim();
        if (!objective)
            throw new Error("goal objective must not be empty");
        var at = this.ports.now();
        var snapshot = __assign({ goalID: this.ports.nextGoalId(), revision: 1, objective: objective, phase: "active", maxGoalRounds: (_a = input.maxGoalRounds) !== null && _a !== void 0 ? _a : exports.DEFAULT_MAX_GOAL_ROUNDS, 
            // A fresh goal has spent nothing and, unless asked otherwise, has no
            // budget beyond its round cap.
            maxGoalTokens: (_b = input.maxGoalTokens) !== null && _b !== void 0 ? _b : 0, maxGoalWallClockMs: (_c = input.maxGoalWallClockMs) !== null && _c !== void 0 ? _c : 0, spentGoalTokens: 0, goalWallClockMs: 0 }, (input.planID ? { planID: input.planID } : {}));
        return this.emit(sessionID, "create", snapshot, 0, current, at);
    };
    /** Edits objective / cap / plan. Editing a completed goal starts a new one. */
    GoalService.prototype.edit = function (sessionID, current, input) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (!current)
            throw new Error("there is no goal to edit");
        if (current.phase === "complete") {
            return this.create(sessionID, current, {
                objective: (_a = input.objective) !== null && _a !== void 0 ? _a : current.objective,
                maxGoalRounds: input.maxGoalRounds,
                planID: input.planID,
            });
        }
        if (input.objective === undefined &&
            input.maxGoalRounds === undefined &&
            input.planID === undefined)
            throw new Error("goal edit requires at least one field");
        var at = this.ports.now();
        var objective = ((_b = input.objective) !== null && _b !== void 0 ? _b : current.objective).trim();
        if (!objective)
            throw new Error("goal objective must not be empty");
        var snapshot = __assign(__assign(__assign(__assign({ goalID: current.goalID, revision: current.revision + 1, objective: objective, phase: current.phase }, (current.blockedReason
            ? { blockedReason: current.blockedReason }
            : {})), (current.lastStop ? { lastStop: current.lastStop } : {})), { maxGoalRounds: (_c = input.maxGoalRounds) !== null && _c !== void 0 ? _c : current.maxGoalRounds, 
            // Budgets are editable alongside the round cap; spend always carries
            // forward, because an edit revising the objective cannot unspend it.
            maxGoalTokens: (_d = input.maxGoalTokens) !== null && _d !== void 0 ? _d : current.maxGoalTokens, maxGoalWallClockMs: (_e = input.maxGoalWallClockMs) !== null && _e !== void 0 ? _e : current.maxGoalWallClockMs, spentGoalTokens: current.spentGoalTokens, goalWallClockMs: current.goalWallClockMs }), (((_f = input.planID) !== null && _f !== void 0 ? _f : current.planID)
            ? { planID: (_g = input.planID) !== null && _g !== void 0 ? _g : current.planID }
            : {}));
        return this.emit(sessionID, "edit", snapshot, current.roundsStarted, current, at);
    };
    GoalService.prototype.pause = function (sessionID, current, reason) {
        var _a, _b;
        if (!current || current.phase !== "active")
            throw new Error("goal pause requires an active goal");
        var at = this.ports.now();
        var snapshot = __assign(__assign({}, snapshotOf(current, "paused")), { lastStop: stopCode((_a = reason === null || reason === void 0 ? void 0 : reason.code) !== null && _a !== void 0 ? _a : "user-paused", (_b = reason === null || reason === void 0 ? void 0 : reason.message) !== null && _b !== void 0 ? _b : "automatic continuation was paused", Date.parse(at)) });
        return this.emit(sessionID, "pause", snapshot, current.roundsStarted, current, at);
    };
    GoalService.prototype.resume = function (sessionID, current) {
        if (!current)
            throw new Error("there is no goal to resume");
        if (current.phase !== "paused" && current.phase !== "blocked")
            throw new Error("goal resume requires a paused or blocked goal");
        if (current.maxGoalRounds !== 0 &&
            current.roundsStarted >= current.maxGoalRounds)
            throw new Error("cannot resume: the round cap is exhausted");
        var at = this.ports.now();
        var snapshot = snapshotOf(current, "active");
        return this.emit(sessionID, "resume", snapshot, current.roundsStarted, current, at);
    };
    GoalService.prototype.complete = function (sessionID, current) {
        if (!current)
            throw new Error("there is no goal to complete");
        if (current.phase === "complete")
            throw new Error("the goal is already complete");
        var at = this.ports.now();
        var snapshot = __assign(__assign({}, snapshotOf(current, "complete")), { lastStop: stopCode("completed", "the objective was reported complete", Date.parse(at)) });
        return this.emit(sessionID, "complete", snapshot, current.roundsStarted, current, at);
    };
    GoalService.prototype.block = function (sessionID, current, reason) {
        if (!current || current.phase !== "active")
            throw new Error("goal block requires an active goal");
        if (!reason.code.trim() || !reason.message.trim())
            throw new Error("goal block requires a code and a message");
        var at = this.ports.now();
        var snapshot = __assign(__assign({}, snapshotOf(current, "blocked")), { blockedReason: reason, lastStop: stopCode(reason.code, reason.message, Date.parse(at)) });
        return this.emit(sessionID, "blocked", snapshot, current.roundsStarted, current, at);
    };
    GoalService.prototype.clear = function (sessionID, current) {
        if (!current)
            throw new Error("there is no goal to clear");
        var at = this.ports.now();
        this.activation.set(sessionID, "disarmed");
        // Tombstone the cache so a tail-only journal cannot resurrect the goal.
        this.views.set(sessionID, null);
        return {
            event: (0, builders_1.buildGoalChanged)({
                id: this.ports.nextEventId(),
                at: at,
                operation: "clear",
                cleared: { goalID: current.goalID, revision: current.revision + 1 },
                roundsStarted: current.roundsStarted,
            }),
        };
    };
    return GoalService;
}());
exports.GoalService = GoalService;
