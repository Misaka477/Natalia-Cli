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
var goal_1 = require("@natalia/goal");
var goal_tools_1 = require("../src/runtime/goal/goal-tools");
/**
 * The smallest runtime the goal tools touch: a session in the execution map, a
 * real goal service folding that session's journal, and a driver whose only
 * consulted method is stubbed.
 *
 * The driver is stubbed because the authority layer (`canStopGoal`) is not this
 * test's subject — the completion gate is, and it only becomes reachable once
 * that layer has let the call through. Everything the gate itself does runs for
 * real.
 */
function harness(input) {
    var _a;
    var nextEvent = 0;
    var service = new goal_1.GoalService({
        now: function () { return "2026-01-01T00:00:00.000Z"; },
        nextEventId: function () { return "evt_".concat(++nextEvent); },
        nextGoalId: function () { return "goal_1"; },
    });
    // Mutations publish into the same journal the service folds, so a test can
    // assert the durable outcome rather than only that no refusal was returned.
    var journal = __spreadArray([], input.events, true);
    var exec = {
        session: {
            id: "ses_goal_gate",
            events: journal,
            inbox: (_a = input.inbox) !== null && _a !== void 0 ? _a : [{ id: input.turnID, internal: true }],
        },
        activeTurnID: input.turnID,
    };
    var executions = new Map([["ses_goal_gate", exec]]);
    var ctx = {
        ports: {
            getSessionID: function () { return "ses_goal_gate"; },
            getExecutionBySession: function () { return executions; },
            getTsRuntimeConfig: function () { return ({}); },
            publishForSession: function (_exec, event) {
                journal.push(event);
            },
        },
    };
    var goalRuntime = {
        service: service,
        driver: { isGoalRound: function () { var _a; return (_a = input.isGoalRound) !== null && _a !== void 0 ? _a : true; } },
    };
    var tools = (0, goal_tools_1.goalTools)(ctx, goalRuntime, input.completionCheck ? { completionCheck: input.completionCheck } : {});
    return {
        tools: tools,
        service: service,
        journal: journal,
        update: tool(tools, "update_goal"),
    };
}
var tool = function (tools, name) {
    return tools.find(function (candidate) { return candidate.name === name; });
};
/** A created goal, as the session journal would hold it. */
function createdGoal() {
    var service = new goal_1.GoalService({
        now: function () { return "2026-01-01T00:00:00.000Z"; },
        nextEventId: function () { return "evt_create"; },
        nextGoalId: function () { return "goal_1"; },
    });
    return service.create("ses_goal_gate", undefined, {
        objective: "ship the thing",
        maxGoalRounds: 4,
    }).event;
}
/** A model-initiated completion, on a goal-round turn. */
var completeCall = {
    goal_id: "goal_1",
    revision: 1,
    action: "complete",
};
var toolContext = { workspaceRoot: "/tmp" };
(0, bun_test_1.test)("a model completion is refused when the configured check fails", function () { return __awaiter(void 0, void 0, void 0, function () {
    var update, answer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                update = harness({
                    events: [createdGoal()],
                    turnID: "turn_goal",
                    completionCheck: function () { return ({
                        ok: false,
                        command: "false",
                        detail: "Exit code 1",
                    }); },
                }).update;
                return [4 /*yield*/, update.execute(completeCall, toolContext)];
            case 1:
                answer = _a.sent();
                (0, bun_test_1.expect)(answer).toContain("complete is refused");
                (0, bun_test_1.expect)(answer).toContain("completion check failed");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a refused completion names the command, the reason, and what to do", function () { return __awaiter(void 0, void 0, void 0, function () {
    var update, answer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                update = harness({
                    events: [createdGoal()],
                    turnID: "turn_goal",
                    completionCheck: function () { return ({
                        ok: false,
                        command: "bun run verify",
                        detail: "Exit code 1\n2 tests failed",
                    }); },
                }).update;
                return [4 /*yield*/, update.execute(completeCall, toolContext)];
            case 1:
                answer = _a.sent();
                // Handed to the model, so it must be enough to act on.
                (0, bun_test_1.expect)(answer).toContain("bun run verify");
                (0, bun_test_1.expect)(answer).toContain("2 tests failed");
                (0, bun_test_1.expect)(answer).toContain("Keep the goal active");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a model completion is accepted when the check passes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, update, journal, answer, goal;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = harness({
                    events: [createdGoal()],
                    turnID: "turn_goal",
                    completionCheck: function () { return ({ ok: true, command: "true" }); },
                }), update = _a.update, journal = _a.journal;
                return [4 /*yield*/, update.execute(completeCall, toolContext)];
            case 1:
                answer = _b.sent();
                (0, bun_test_1.expect)(answer).not.toContain("refused");
                goal = (0, goal_1.foldGoal)(journal);
                (0, bun_test_1.expect)(goal === null || goal === void 0 ? void 0 : goal.phase).toBe("complete");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a human completion is never blocked by the configured check", function () { return __awaiter(void 0, void 0, void 0, function () {
    var ran, update;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ran = 0;
                update = harness({
                    events: [createdGoal()],
                    turnID: "turn_human",
                    inbox: [{ id: "turn_human", internal: false }],
                    isGoalRound: false,
                    completionCheck: function () {
                        ran += 1;
                        return { ok: false, command: "false", detail: "should not run" };
                    },
                }).update;
                return [4 /*yield*/, update.execute(completeCall, toolContext)];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(ran).toBe(0);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("with no check configured, a completion behaves exactly as before", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, update, journal, answer;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _a = harness({
                    events: [createdGoal()],
                    turnID: "turn_goal",
                }), update = _a.update, journal = _a.journal;
                return [4 /*yield*/, update.execute(completeCall, toolContext)];
            case 1:
                answer = _c.sent();
                (0, bun_test_1.expect)(answer).not.toContain("refused");
                (0, bun_test_1.expect)((_b = (0, goal_1.foldGoal)(journal)) === null || _b === void 0 ? void 0 : _b.phase).toBe("complete");
                return [2 /*return*/];
        }
    });
}); });
