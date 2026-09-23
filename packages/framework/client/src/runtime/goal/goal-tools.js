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
exports.goalTools = goalTools;
/**
 * A model-reported block from a goal round is mechanically refused until the
 * same condition has had at least this many consecutive admitted rounds. Humans
 * may stop a goal immediately, and `ask_user` remains the escape hatch.
 */
var BLOCKED_AFTER_CONSECUTIVE_ROUNDS = 3;
function stringArg(value) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
}
function numberArg(value) {
    return typeof value === "number" && Number.isInteger(value) && value >= 0
        ? value
        : undefined;
}
function goalTools(ctx, goalRuntime, options) {
    if (options === void 0) { options = {}; }
    var sessionID = function (context) { var _a; return ((_a = context.sessionID) !== null && _a !== void 0 ? _a : ctx.ports.getSessionID()); };
    var execFor = function (id) {
        return id === undefined ? undefined : ctx.ports.getExecutionBySession().get(id);
    };
    function isHumanTurn(exec) {
        var _a;
        var turnID = exec.activeTurnID;
        if (!turnID)
            return false;
        var input = (_a = exec.session.inbox) === null || _a === void 0 ? void 0 : _a.find(function (item) { return item.id === turnID; });
        return input !== undefined && input.internal !== true;
    }
    function canStopGoal(exec) {
        if (isHumanTurn(exec))
            return true;
        var turnID = exec.activeTurnID;
        return Boolean(turnID && goalRuntime.driver.isGoalRound(exec.session.id, turnID));
    }
    function currentView(exec) {
        return goalRuntime.service.current(exec.session.id, exec.session.events);
    }
    function publish(exec, event) {
        ctx.ports.publishForSession(exec, event);
    }
    var getGoal = {
        name: "get_goal",
        description: "Read the current same-session goal: id, revision, objective, phase, blockedReason, rounds started/max, and whether automatic continuation is armed. Returns { goal: null } when there is none.",
        requiresApproval: false,
        parameters: { type: "object", properties: {}, additionalProperties: false },
        execute: function (_parsed, context) {
            return __awaiter(this, void 0, void 0, function () {
                var exec, goal;
                return __generator(this, function (_a) {
                    exec = execFor(sessionID(context));
                    if (!exec)
                        return [2 /*return*/, JSON.stringify({ goal: null })];
                    goal = currentView(exec);
                    if (!goal)
                        return [2 /*return*/, JSON.stringify({ goal: null })];
                    return [2 /*return*/, JSON.stringify({
                            goal: __assign(__assign(__assign(__assign(__assign({ id: goal.goalID, revision: goal.revision, objective: goal.objective, phase: goal.phase }, (goal.blockedReason ? { blockedReason: goal.blockedReason } : {})), (goal.lastStop ? { lastStop: goal.lastStop } : {})), { roundsStarted: goal.roundsStarted, maxGoalRounds: goal.maxGoalRounds }), (goal.planID ? { planID: goal.planID } : {})), { activation: goal.activation }),
                        })];
                });
            });
        },
    };
    var createGoal = {
        name: "create_goal",
        description: "Create one long-running same-session goal. Confirm with the user via ask_user before calling this. Do not create a goal for routine single-turn work. max_goal_rounds=0 means unlimited.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                objective: { type: "string" },
                max_goal_rounds: { type: "number" },
                plan_id: { type: "string" },
            },
            required: ["objective"],
            additionalProperties: false,
        },
        execute: function (parsed, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, objective, exec, result;
                return __generator(this, function (_a) {
                    args = (parsed !== null && parsed !== void 0 ? parsed : {});
                    objective = stringArg(args.objective);
                    if (!objective)
                        return [2 /*return*/, "create_goal requires an objective"];
                    exec = execFor(sessionID(context));
                    if (!exec)
                        return [2 /*return*/, "create_goal: session is not initialized"];
                    if (!isHumanTurn(exec))
                        return [2 /*return*/, "create_goal requires a direct human request in the current turn"];
                    try {
                        result = goalRuntime.service.create(exec.session.id, currentView(exec), __assign(__assign({ objective: objective }, (numberArg(args.max_goal_rounds) !== undefined
                            ? { maxGoalRounds: numberArg(args.max_goal_rounds) }
                            : {})), (stringArg(args.plan_id)
                            ? { planID: stringArg(args.plan_id) }
                            : {})));
                        publish(exec, result.event);
                        goalRuntime.requestDrive(exec);
                        return [2 /*return*/, JSON.stringify({
                                goal: {
                                    id: result.view.goalID,
                                    revision: result.view.revision,
                                    phase: result.view.phase,
                                },
                            })];
                    }
                    catch (cause) {
                        return [2 /*return*/, cause instanceof Error ? cause.message : String(cause)];
                    }
                    return [2 /*return*/];
                });
            });
        },
    };
    var updateGoal = {
        name: "update_goal",
        description: "Mutate the current goal. Call get_goal first and pass its exact goal_id and revision. actions: edit | pause | resume | complete | blocked. edit replaces objective/max_goal_rounds/plan_id; blocked requires blocked_reason. Mark complete only when the objective is actually achieved.",
        requiresApproval: false,
        parameters: {
            type: "object",
            properties: {
                goal_id: { type: "string" },
                revision: { type: "number" },
                action: { type: "string" },
                objective: { type: "string" },
                max_goal_rounds: { type: "number" },
                plan_id: { type: "string" },
                blocked_reason: { type: "string" },
            },
            required: ["goal_id", "revision", "action"],
            additionalProperties: false,
        },
        execute: function (parsed, context) {
            return __awaiter(this, void 0, void 0, function () {
                var args, action, exec, service, current, needsHuman, event_1, check, message, reason;
                var _a, _b;
                return __generator(this, function (_c) {
                    args = (parsed !== null && parsed !== void 0 ? parsed : {});
                    action = stringArg(args.action);
                    exec = execFor(sessionID(context));
                    if (!exec)
                        return [2 /*return*/, "update_goal: session is not initialized"];
                    service = goalRuntime.service;
                    current = currentView(exec);
                    if (!current)
                        return [2 /*return*/, "update_goal: there is no current goal"];
                    if (stringArg(args.goal_id) !== current.goalID ||
                        numberArg(args.revision) !== current.revision)
                        return [2 /*return*/, "update_goal: stale goal_id/revision; call get_goal and retry"];
                    needsHuman = action === "edit" || action === "pause" || action === "resume";
                    if (needsHuman && !isHumanTurn(exec))
                        return [2 /*return*/, "update_goal ".concat(action, " requires a direct human request in the current turn")];
                    if (!needsHuman && !canStopGoal(exec))
                        return [2 /*return*/, "update_goal ".concat(action, " requires a human turn or the current goal round")];
                    try {
                        switch (action) {
                            case "edit":
                                event_1 = service.edit(exec.session.id, current, __assign(__assign(__assign({}, (stringArg(args.objective) !== undefined
                                    ? { objective: stringArg(args.objective) }
                                    : {})), (numberArg(args.max_goal_rounds) !== undefined
                                    ? { maxGoalRounds: numberArg(args.max_goal_rounds) }
                                    : {})), (stringArg(args.plan_id) !== undefined
                                    ? { planID: stringArg(args.plan_id) }
                                    : {}))).event;
                                break;
                            case "pause":
                                event_1 = service.pause(exec.session.id, current).event;
                                break;
                            case "resume":
                                event_1 = service.resume(exec.session.id, current).event;
                                break;
                            case "complete": {
                                check = !isHumanTurn(exec)
                                    ? (_a = options.completionCheck) === null || _a === void 0 ? void 0 : _a.call(options)
                                    : undefined;
                                if (check && !check.ok)
                                    return [2 /*return*/, [
                                            "update_goal complete is refused: the configured completion check failed.",
                                            check.command ? "Command: ".concat(check.command) : undefined,
                                            (_b = check.detail) !== null && _b !== void 0 ? _b : "The check reported failure without detail.",
                                            "The objective is not demonstrably met. Keep the goal active and continue, or use ask_user if this needs a human decision.",
                                        ]
                                            .filter(Boolean)
                                            .join("\n")];
                                event_1 = service.complete(exec.session.id, current).event;
                                break;
                            }
                            case "blocked": {
                                message = stringArg(args.blocked_reason);
                                if (!message)
                                    return [2 /*return*/, "update_goal blocked requires blocked_reason"];
                                // Hard lower bound: a goal round cannot self-block before the
                                // condition has persisted across enough rounds. A human may stop
                                // immediately, and ask_user is the escape hatch for a real decision.
                                if (!isHumanTurn(exec) &&
                                    current.roundsStarted < BLOCKED_AFTER_CONSECUTIVE_ROUNDS)
                                    return [2 /*return*/, "update_goal blocked is refused until the same condition has persisted for at least ".concat(BLOCKED_AFTER_CONSECUTIVE_ROUNDS, " goal rounds (currently ").concat(current.roundsStarted, "). If work remains, keep the goal active and continue; if you need a human decision, use ask_user.")];
                                reason = {
                                    code: "model-reported",
                                    message: message,
                                };
                                event_1 = service.block(exec.session.id, current, reason).event;
                                break;
                            }
                            default:
                                return [2 /*return*/, "update_goal: unknown action ".concat(String(action))];
                        }
                        publish(exec, event_1);
                        if (action === "resume")
                            goalRuntime.requestDrive(exec);
                        return [2 /*return*/, JSON.stringify({ updated: true, action: action })];
                    }
                    catch (cause) {
                        return [2 /*return*/, cause instanceof Error ? cause.message : String(cause)];
                    }
                    return [2 /*return*/];
                });
            });
        },
    };
    return [getGoal, createGoal, updateGoal];
}
