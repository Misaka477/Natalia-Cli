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
var bun_test_1 = require("bun:test");
var src_1 = require("../src");
function harness(options) {
    var _this = this;
    if (options === void 0) { options = {}; }
    var events = [];
    var published = [];
    var admitted = [];
    var counter = 0;
    var now = function () { return new Date(1700000000000 + counter * 1000).toISOString(); };
    var nextEventId = function () { return "evt_".concat(++counter); };
    var nextGoalId = function () { return "goal_".concat(++counter); };
    var service = new src_1.GoalService({ now: now, nextEventId: nextEventId, nextGoalId: nextGoalId });
    var host = __assign(__assign({ current: function (sessionID) { return service.current(sessionID, events); }, isIdle: function () { var _a; return (_a = options.idle) !== null && _a !== void 0 ? _a : true; }, hasCompetingInput: function () { var _a; return (_a = options.competing) !== null && _a !== void 0 ? _a : false; }, flush: function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (options.flushFails)
                    throw new Error("flush failed");
                return [2 /*return*/];
            });
        }); }, admit: function (_sessionID, input) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                admitted.push(input);
                return [2 /*return*/, true];
            });
        }); }, publish: function (_sessionID, event) {
            published.push(event);
            events.push(event);
        } }, (options.linkedPlanStatus
        ? { linkedPlanStatus: options.linkedPlanStatus }
        : {})), { now: now, nextEventId: nextEventId });
    var driver = new src_1.GoalRoundDriver(service, host);
    var seed = function (objective, maxGoalRounds, planID, budget) {
        var result = service.create("s1", service.current("s1", events), __assign(__assign(__assign({ objective: objective }, (maxGoalRounds === undefined ? {} : { maxGoalRounds: maxGoalRounds })), (planID === undefined ? {} : { planID: planID })), (budget !== null && budget !== void 0 ? budget : {})));
        host.publish("s1", result.event);
        return result;
    };
    return { events: events, published: published, admitted: admitted, service: service, host: host, driver: driver, seed: seed };
}
(0, bun_test_1.test)("service arms creation, disarms stops, and never persists activation", function () {
    var _a;
    var h = harness();
    var created = h.seed("ship it");
    (0, bun_test_1.expect)(created.view.phase).toBe("active");
    (0, bun_test_1.expect)(created.view.activation).toBe("armed");
    (0, bun_test_1.expect)(JSON.stringify(created.event)).not.toContain("activation");
    var paused = h.service.pause("s1", h.service.current("s1", h.events));
    h.host.publish("s1", paused.event);
    var afterPause = h.service.current("s1", h.events);
    (0, bun_test_1.expect)(afterPause.phase).toBe("paused");
    (0, bun_test_1.expect)(afterPause.activation).toBe("disarmed");
    (0, bun_test_1.expect)((_a = afterPause.lastStop) === null || _a === void 0 ? void 0 : _a.code).toBe("user-paused");
    var resumed = h.service.resume("s1", afterPause);
    h.host.publish("s1", resumed.event);
    var afterResume = h.service.current("s1", h.events);
    (0, bun_test_1.expect)(afterResume.phase).toBe("active");
    (0, bun_test_1.expect)(afterResume.activation).toBe("armed");
    (0, bun_test_1.expect)(afterResume.lastStop).toBeUndefined();
});
(0, bun_test_1.test)("driver admits exactly one round and records it durably", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, created;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                h = harness();
                created = h.seed("ship it");
                return [4 /*yield*/, h.driver.drive("s1")];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(h.admitted).toHaveLength(1);
                (0, bun_test_1.expect)(h.admitted[0].text).toContain("<goal_round>");
                (0, bun_test_1.expect)(h.admitted[0].id).toBe("goal_".concat(created.view.goalID, "_round_1"));
                (0, bun_test_1.expect)(h.published.filter(function (event) { return event.type === "goal.round"; })).toHaveLength(1);
                (0, bun_test_1.expect)((_a = h.service.current("s1", h.events)) === null || _a === void 0 ? void 0 : _a.roundsStarted).toBe(1);
                // A reserved round is not re-driven until it settles.
                return [4 /*yield*/, h.driver.drive("s1")];
            case 2:
                // A reserved round is not re-driven until it settles.
                _b.sent();
                (0, bun_test_1.expect)(h.admitted).toHaveLength(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("driver yields to human work and to a non-idle session", function () { return __awaiter(void 0, void 0, void 0, function () {
    var busy, competing;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                busy = harness({ idle: false });
                busy.seed("a");
                return [4 /*yield*/, busy.driver.drive("s1")];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(busy.admitted).toHaveLength(0);
                competing = harness({ competing: true });
                competing.seed("b");
                return [4 /*yield*/, competing.driver.drive("s1")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(competing.admitted).toHaveLength(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("driver blocks the goal when the round cap is reached", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, goalID, goal;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                h = harness();
                h.seed("capped", 1);
                return [4 /*yield*/, h.driver.drive("s1")];
            case 1:
                _b.sent();
                goalID = h.service.current("s1", h.events).goalID;
                h.driver.settle("s1", "goal_".concat(goalID, "_round_1"), "done");
                return [4 /*yield*/, h.driver.drive("s1")];
            case 2:
                _b.sent();
                goal = h.service.current("s1", h.events);
                (0, bun_test_1.expect)(goal.phase).toBe("blocked");
                (0, bun_test_1.expect)((_a = goal.blockedReason) === null || _a === void 0 ? void 0 : _a.code).toBe("round-limit");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("driver disarms on flush failure without admitting work", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                h = harness({ flushFails: true });
                h.seed("x");
                return [4 /*yield*/, h.driver.drive("s1")];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(h.admitted).toHaveLength(0);
                (0, bun_test_1.expect)((_a = h.service.current("s1", h.events)) === null || _a === void 0 ? void 0 : _a.activation).toBe("disarmed");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("settlement pauses on cancellation and blocks on error", function () { return __awaiter(void 0, void 0, void 0, function () {
    var cancelled, errored, goal;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                cancelled = harness();
                cancelled.seed("x");
                return [4 /*yield*/, cancelled.driver.drive("s1")];
            case 1:
                _c.sent();
                cancelled.driver.settle("s1", cancelled.admitted[0].id, "cancelled");
                (0, bun_test_1.expect)((_a = cancelled.service.current("s1", cancelled.events)) === null || _a === void 0 ? void 0 : _a.phase).toBe("paused");
                errored = harness();
                errored.seed("y");
                return [4 /*yield*/, errored.driver.drive("s1")];
            case 2:
                _c.sent();
                errored.driver.settle("s1", errored.admitted[0].id, "error");
                goal = errored.service.current("s1", errored.events);
                (0, bun_test_1.expect)(goal.phase).toBe("blocked");
                (0, bun_test_1.expect)((_b = goal.blockedReason) === null || _b === void 0 ? void 0 : _b.code).toBe("turn-error");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("cancelling unrelated work disarms the goal so it cannot auto-restart", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, goal;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                h = harness();
                h.seed("keep going");
                // The cancelled turn is NOT one of the driver's rounds (e.g. the human's
                // /goal turn or any other turn): the goal must still stop auto-continuing.
                h.driver.settle("s1", "turn_human", "cancelled");
                goal = h.service.current("s1", h.events);
                (0, bun_test_1.expect)(goal.phase).toBe("paused");
                (0, bun_test_1.expect)(goal.activation).toBe("disarmed");
                (0, bun_test_1.expect)((_a = goal.lastStop) === null || _a === void 0 ? void 0 : _a.code).toBe("cancelled");
                return [4 /*yield*/, h.driver.drive("s1")];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(h.admitted).toHaveLength(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a recovery seed keeps current() correct without a replayed journal", function () {
    var _a, _b, _c;
    var at = "2026-01-01T00:00:00.000Z";
    var service = new src_1.GoalService({
        now: function () { return at; },
        nextEventId: function () { return "evt_seed"; },
        nextGoalId: function () { return "goal_seed"; },
    });
    // Fast path at startup: recovery_goal carries the current goal while the
    // in-memory journal is empty (the epoch baseline is the last seq).
    service.seed("s1", {
        goalID: "goal_seed",
        revision: 4,
        objective: "resume the plan",
        phase: "paused",
        maxGoalRounds: 256,
        maxGoalTokens: 0,
        maxGoalWallClockMs: 0,
        spentGoalTokens: 0,
        goalWallClockMs: 0,
        roundsStarted: 2,
        createdAt: at,
        updatedAt: at,
    });
    var seeded = service.current("s1", []);
    (0, bun_test_1.expect)(seeded.goalID).toBe("goal_seed");
    (0, bun_test_1.expect)(seeded.phase).toBe("paused");
    (0, bun_test_1.expect)(seeded.roundsStarted).toBe(2);
    // Replay never arms continuation.
    (0, bun_test_1.expect)(seeded.activation).toBe("disarmed");
    // A replayed round for the same revision still advances the count.
    var round = {
        type: "goal.round",
        id: "evt_round",
        at: at,
        goalID: "goal_seed",
        revision: 4,
        round: 3,
    };
    (0, bun_test_1.expect)((_a = service.current("s1", [round])) === null || _a === void 0 ? void 0 : _a.roundsStarted).toBe(3);
    // A live mutation updates the cache (activation included).
    service.resume("s1", service.current("s1", []));
    (0, bun_test_1.expect)((_b = service.current("s1", [])) === null || _b === void 0 ? void 0 : _b.phase).toBe("active");
    (0, bun_test_1.expect)((_c = service.current("s1", [])) === null || _c === void 0 ? void 0 : _c.activation).toBe("armed");
    // Clearing tombstones the cache so a tail-only journal cannot resurrect it.
    var cleared = service.clear("s1", service.current("s1", []));
    (0, bun_test_1.expect)(cleared.event.operation).toBe("clear");
    (0, bun_test_1.expect)(service.current("s1", [])).toBeUndefined();
});
(0, bun_test_1.test)("seed(undefined) leaves journal folding intact", function () {
    var _a;
    var at = "2026-01-01T00:00:00.000Z";
    var service = new src_1.GoalService({
        now: function () { return at; },
        nextEventId: function () { return "evt_x"; },
        nextGoalId: function () { return "goal_fold"; },
    });
    service.seed("s1", undefined);
    var event = (0, src_1.buildGoalChanged)({
        id: "evt_create",
        at: at,
        operation: "create",
        snapshot: {
            goalID: "goal_fold",
            revision: 1,
            objective: "legacy",
            phase: "active",
            maxGoalRounds: 256,
            maxGoalTokens: 0,
            maxGoalWallClockMs: 0,
            spentGoalTokens: 0,
            goalWallClockMs: 0,
        },
        roundsStarted: 0,
    });
    // No positive seed and no tombstone: `current` folds the journal instead.
    (0, bun_test_1.expect)((_a = service.current("s1", [event])) === null || _a === void 0 ? void 0 : _a.objective).toBe("legacy");
});
(0, bun_test_1.test)("edit preserves continuation authority instead of disarming", function () {
    var _a;
    var h = harness();
    h.seed("first objective");
    (0, bun_test_1.expect)(h.service.isArmed("s1")).toBe(true);
    var edited = h.service.edit("s1", h.service.current("s1", h.events), {
        objective: "second objective",
    });
    h.host.publish("s1", edited.event);
    (0, bun_test_1.expect)((_a = h.service.current("s1", h.events)) === null || _a === void 0 ? void 0 : _a.objective).toBe("second objective");
    (0, bun_test_1.expect)(edited.view.activation).toBe("armed");
    (0, bun_test_1.expect)(h.service.isArmed("s1")).toBe(true);
    // A goal that was disarmed (e.g. after a pause) stays disarmed across an edit.
    h.service.disarm("s1");
    var again = h.service.edit("s1", h.service.current("s1", h.events), {
        objective: "third objective",
    });
    (0, bun_test_1.expect)(again.view.activation).toBe("disarmed");
    (0, bun_test_1.expect)(h.service.isArmed("s1")).toBe(false);
});
(0, bun_test_1.test)("renderGoalRoundPrompt carries the linked plan's lifecycle when present", function () {
    var withPlan = (0, src_1.renderGoalRoundPrompt)({
        goalID: "g1",
        revision: 1,
        objective: "ship the feature",
        phase: "active",
        maxGoalRounds: 0,
        maxGoalTokens: 0,
        maxGoalWallClockMs: 0,
        spentGoalTokens: 0,
        goalWallClockMs: 0,
        roundsStarted: 0,
        activation: "armed",
        createdAt: "now",
        updatedAt: "now",
        planID: "plan_x",
    }, 2, { planID: "plan_x", lifecycle: "completed" });
    (0, bun_test_1.expect)(withPlan).toContain("Linked plan: plan_x");
    (0, bun_test_1.expect)(withPlan).toContain("lifecycle: completed");
    // The plan is evidence, not the objective itself: the prompt says so.
    (0, bun_test_1.expect)(withPlan).toContain("one instrument of this objective");
    var withoutPlan = (0, src_1.renderGoalRoundPrompt)({
        goalID: "g1",
        revision: 1,
        objective: "ship the feature",
        phase: "active",
        maxGoalRounds: 0,
        maxGoalTokens: 0,
        maxGoalWallClockMs: 0,
        spentGoalTokens: 0,
        goalWallClockMs: 0,
        roundsStarted: 0,
        activation: "armed",
        createdAt: "now",
        updatedAt: "now",
    }, 2);
    (0, bun_test_1.expect)(withoutPlan).not.toContain("Linked plan");
});
(0, bun_test_1.test)("driver surfaces the linked plan status into the admitted round", function () { return __awaiter(void 0, void 0, void 0, function () {
    var seen, h;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                seen = [];
                h = harness({
                    linkedPlanStatus: function (_sessionID, planID) {
                        seen.push(planID);
                        return { planID: planID, lifecycle: "executing" };
                    },
                });
                h.seed("with a plan", undefined, "plan_x");
                return [4 /*yield*/, h.driver.drive("s1")];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(seen).toEqual(["plan_x"]);
                (0, bun_test_1.expect)(h.admitted[0].text).toContain("Linked plan: plan_x");
                (0, bun_test_1.expect)(h.admitted[0].text).toContain("lifecycle: executing");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("driver omits the plan block when the goal has no planID", function () { return __awaiter(void 0, void 0, void 0, function () {
    var called, h;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                called = false;
                h = harness({
                    linkedPlanStatus: function () {
                        called = true;
                        return { planID: "unused", lifecycle: "completed" };
                    },
                });
                h.seed("no plan");
                return [4 /*yield*/, h.driver.drive("s1")];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(called).toBe(false);
                (0, bun_test_1.expect)(h.admitted[0].text).not.toContain("Linked plan");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("driver omits the plan block when the plan is gone", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                h = harness({
                    linkedPlanStatus: function () { return undefined; },
                });
                h.seed("plan vanished", undefined, "plan_gone");
                return [4 /*yield*/, h.driver.drive("s1")];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(h.admitted[0].text).not.toContain("Linked plan");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a goal over its token budget does not start another round", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, driver, events, host, service, seeded, blocked, goal;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = harness(), driver = _a.driver, events = _a.events, host = _a.host, service = _a.service;
                seeded = service.create("s1", undefined, {
                    objective: "spend carefully",
                    maxGoalRounds: 100,
                    maxGoalTokens: 1000,
                });
                host.publish("s1", seeded.event);
                // Two rounds, each spending 600 tokens, put the goal over before the third.
                return [4 /*yield*/, driver.drive("s1")];
            case 1:
                // Two rounds, each spending 600 tokens, put the goal over before the third.
                _c.sent();
                driver.settle("s1", "goal_goal_1_round_1", "done", {
                    tokens: 600,
                    durationMs: 10,
                });
                return [4 /*yield*/, driver.drive("s1")];
            case 2:
                _c.sent();
                driver.settle("s1", "goal_goal_1_round_2", "done", {
                    tokens: 600,
                    durationMs: 10,
                });
                return [4 /*yield*/, driver.drive("s1")];
            case 3:
                blocked = _c.sent();
                (0, bun_test_1.expect)(blocked).toBeUndefined();
                goal = service.current("s1", events);
                (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.phase).toBe("blocked");
                (0, bun_test_1.expect)((_b = goal === null || goal === void 0 ? void 0 : goal.blockedReason) === null || _b === void 0 ? void 0 : _b.code).toBe("token-limit");
                (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.spentGoalTokens).toBe(1200);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a goal over its wall-clock budget does not start another round", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, driver, events, host, service, seeded, goal;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = harness(), driver = _a.driver, events = _a.events, host = _a.host, service = _a.service;
                seeded = service.create("s1", undefined, {
                    objective: "be quick",
                    maxGoalRounds: 100,
                    maxGoalWallClockMs: 5000,
                });
                host.publish("s1", seeded.event);
                return [4 /*yield*/, driver.drive("s1")];
            case 1:
                _c.sent();
                driver.settle("s1", "goal_goal_1_round_1", "done", {
                    tokens: 10,
                    durationMs: 3000,
                });
                return [4 /*yield*/, driver.drive("s1")];
            case 2:
                _c.sent();
                driver.settle("s1", "goal_goal_1_round_2", "done", {
                    tokens: 10,
                    durationMs: 3000,
                });
                return [4 /*yield*/, driver.drive("s1")];
            case 3:
                _c.sent();
                goal = service.current("s1", events);
                (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.phase).toBe("blocked");
                (0, bun_test_1.expect)((_b = goal === null || goal === void 0 ? void 0 : goal.blockedReason) === null || _b === void 0 ? void 0 : _b.code).toBe("time-limit");
                (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.goalWallClockMs).toBe(6000);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a failed round still books its cost, so a goal cannot spend by failing", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, driver, events, host, service, seeded, goal, blocked;
    var _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _a = harness(), driver = _a.driver, events = _a.events, host = _a.host, service = _a.service;
                seeded = service.create("s1", undefined, {
                    objective: "fail expensively",
                    maxGoalRounds: 100,
                    maxGoalTokens: 1000,
                });
                host.publish("s1", seeded.event);
                return [4 /*yield*/, driver.drive("s1")];
            case 1:
                _d.sent();
                // The round errored, and the goal is blocked for it — so the round it did run
                // is the only one that can carry cost.
                driver.settle("s1", "goal_goal_1_round_1", "error", {
                    tokens: 400,
                    durationMs: 50,
                });
                goal = service.current("s1", events);
                (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.spentGoalTokens).toBe(400);
                (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.goalWallClockMs).toBe(50);
                (0, bun_test_1.expect)((_b = goal === null || goal === void 0 ? void 0 : goal.blockedReason) === null || _b === void 0 ? void 0 : _b.code).toBe("turn-error");
                blocked = events.find(function (event) { return event.type === "goal.changed" && event.operation === "blocked"; });
                (0, bun_test_1.expect)(blocked && blocked.type === "goal.changed"
                    ? (_c = blocked.snapshot) === null || _c === void 0 ? void 0 : _c.spentGoalTokens
                    : undefined).toBe(400);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("spend survives replay, so a restart resumes with the same figures", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, driver, events, host, service, seeded, replayed;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = harness(), driver = _a.driver, events = _a.events, host = _a.host, service = _a.service;
                seeded = service.create("s1", undefined, {
                    objective: "replay me",
                    maxGoalRounds: 100,
                    maxGoalTokens: 1000,
                });
                host.publish("s1", seeded.event);
                return [4 /*yield*/, driver.drive("s1")];
            case 1:
                _b.sent();
                driver.settle("s1", "goal_goal_1_round_1", "done", {
                    tokens: 400,
                    durationMs: 40,
                });
                replayed = (0, src_1.foldGoal)(__spreadArray([
                    seeded.event
                ], events.filter(function (event) { return event.type !== "goal.changed"; }), true));
                (0, bun_test_1.expect)(replayed === null || replayed === void 0 ? void 0 : replayed.spentGoalTokens).toBe(400);
                (0, bun_test_1.expect)(replayed === null || replayed === void 0 ? void 0 : replayed.goalWallClockMs).toBe(40);
                (0, bun_test_1.expect)(replayed === null || replayed === void 0 ? void 0 : replayed.roundsStarted).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a goal with no budget never blocks on a figure it cannot observe", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, driver, events, host, service, seeded, round, goal;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = harness(), driver = _a.driver, events = _a.events, host = _a.host, service = _a.service;
                seeded = service.create("s1", undefined, { objective: "unbounded" });
                host.publish("s1", seeded.event);
                round = 0;
                _b.label = 1;
            case 1:
                if (!(round < 3)) return [3 /*break*/, 4];
                return [4 /*yield*/, driver.drive("s1")];
            case 2:
                _b.sent();
                driver.settle("s1", "goal_goal_1_round_".concat(round + 1), "done", {
                    tokens: 10000,
                    durationMs: 60000,
                });
                _b.label = 3;
            case 3:
                round += 1;
                return [3 /*break*/, 1];
            case 4: return [4 /*yield*/, driver.drive("s1")];
            case 5:
                _b.sent();
                goal = service.current("s1", events);
                (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.phase).toBe("active");
                return [2 /*return*/];
        }
    });
}); });
