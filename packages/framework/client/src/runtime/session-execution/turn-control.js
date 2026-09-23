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
exports.createTurnControlSurface = createTurnControlSurface;
var session_1 = require("@anthelia/session");
var turn_orchestration_1 = require("@anthelia/turn-orchestration");
function targetSessionID(ctx, sessionID) {
    return (sessionID !== null && sessionID !== void 0 ? sessionID : ctx.ports.getSessionID());
}
function requireTurnController(ctx) {
    return ctx.state.serviceDirectory.get(turn_orchestration_1.turnController);
}
function pendingInput(ctx, sessionID, id) {
    var _a, _b;
    return (_b = (_a = ctx.ports
        .getExecutionBySession()
        .get(sessionID)) === null || _a === void 0 ? void 0 : _a.session.inbox) === null || _b === void 0 ? void 0 : _b.find(function (item) { return item.id === id; });
}
function toResult(input, reason) {
    if (!input)
        return { ok: false, reason: reason };
    return {
        ok: true,
        input: __assign({ id: input.id, text: input.text, delivery: input.delivery }, (input.promotedAt ? { promotedAt: input.promotedAt } : {})),
    };
}
function publishInputEvent(ctx, sessionID, event) {
    var exec = ctx.ports.getExecutionBySession().get(sessionID);
    if (exec)
        ctx.ports.publishForSession(exec, event);
}
/** Refusal is a value: callers learn an input was already claimed or is gone. */
function refuseIfNotPending(existing) {
    if (!existing)
        return { ok: false, reason: "input-not-found" };
    if (existing.promotedAt)
        return { ok: false, reason: "already-claimed" };
    return undefined;
}
function createTurnControlSurface(ctx, options) {
    return {
        pause: function (reason, sessionID) {
            if (reason === void 0) { reason = "user pause"; }
            // Refusing is a value: a caller that gets `paused: true` when nothing was
            // paused has been told the turn is held when it is not.
            var exec = sessionID
                ? ctx.ports
                    .getExecutionBySession()
                    .get(sessionID)
                : ctx.ports.getActiveExec();
            var turnID = exec === null || exec === void 0 ? void 0 : exec.activeTurnID;
            if (!turnID)
                return { paused: false, reason: "no turn is running" };
            if (exec.paused)
                return { paused: true, reason: "already paused" };
            exec.paused = true;
            ctx.ports.setPaused(true);
            ctx.ports.publishForSession(exec, {
                type: "turn.paused",
                id: turnID,
                reason: reason,
            });
            ctx.ports.publishForSession(exec, {
                type: "status.update",
                status: "paused",
                detail: reason,
            });
            return { paused: true };
        },
        resume: function (sessionID) {
            var exec = sessionID
                ? ctx.ports
                    .getExecutionBySession()
                    .get(sessionID)
                : ctx.ports.getActiveExec();
            var turnID = exec === null || exec === void 0 ? void 0 : exec.activeTurnID;
            if (!turnID)
                return { resumed: false, reason: "no turn is running" };
            if (!exec.paused)
                return { resumed: false, reason: "the turn is not paused" };
            exec.paused = false;
            ctx.ports.setPaused(false);
            var waiters = exec.pauseWaiters;
            exec.pauseWaiters = [];
            for (var _i = 0, waiters_1 = waiters; _i < waiters_1.length; _i++) {
                var resolveWaiter = waiters_1[_i];
                resolveWaiter();
            }
            ctx.ports.publishForSession(exec, {
                type: "turn.resumed",
                id: turnID,
            });
            ctx.ports.publishForSession(exec, {
                type: "status.update",
                status: "running",
                detail: "resumed",
            });
            return { resumed: true };
        },
        removeInput: function (_a) {
            return __awaiter(this, arguments, void 0, function (_b) {
                var target, refusal, controller, result, _c;
                var id = _b.id, sessionID = _b.sessionID;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            target = targetSessionID(ctx, sessionID);
                            refusal = refuseIfNotPending(pendingInput(ctx, target, id));
                            if (refusal)
                                return [2 /*return*/, refusal];
                            controller = requireTurnController(ctx);
                            _c = toResult;
                            return [4 /*yield*/, controller.removeInput(target, id)];
                        case 1:
                            result = _c.apply(void 0, [_d.sent(), "input-not-found"]);
                            if (result.ok)
                                publishInputEvent(ctx, target, { type: "input.removed", id: id });
                            return [2 /*return*/, result];
                    }
                });
            });
        },
        replaceInput: function (_a) {
            return __awaiter(this, arguments, void 0, function (_b) {
                var target, refusal, controller, result, _c;
                var id = _b.id, text = _b.text, sessionID = _b.sessionID;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            target = targetSessionID(ctx, sessionID);
                            refusal = refuseIfNotPending(pendingInput(ctx, target, id));
                            if (refusal)
                                return [2 /*return*/, refusal];
                            controller = requireTurnController(ctx);
                            _c = toResult;
                            return [4 /*yield*/, controller.replaceInput(target, id, text)];
                        case 1:
                            result = _c.apply(void 0, [_d.sent(), "input-not-found"]);
                            if (result.ok)
                                publishInputEvent(ctx, target, (0, session_1.buildInputUpdated)(id, text));
                            return [2 /*return*/, result];
                    }
                });
            });
        },
        promoteInput: function (_a) {
            return __awaiter(this, arguments, void 0, function (_b) {
                var target, existing, refusal, controller, result, _c;
                var id = _b.id, sessionID = _b.sessionID;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            target = targetSessionID(ctx, sessionID);
                            existing = pendingInput(ctx, target, id);
                            refusal = refuseIfNotPending(existing);
                            if (refusal)
                                return [2 /*return*/, refusal];
                            // Only a queued `next-turn` can be promoted; an already-`next-step` input
                            // is waiting for a claim and has nothing to promote.
                            if ((existing === null || existing === void 0 ? void 0 : existing.delivery) !== "next-turn")
                                return [2 /*return*/, { ok: false, reason: "already-step" }];
                            controller = requireTurnController(ctx);
                            _c = toResult;
                            return [4 /*yield*/, controller.promoteInput(target, id)];
                        case 1:
                            result = _c.apply(void 0, [_d.sent(), "input-not-found"]);
                            if (result.ok)
                                publishInputEvent(ctx, target, { type: "input.promoted", id: id });
                            // A running turn claims it at the next provider step. An idle session has
                            // no loop to claim it, so wake a drain that will run it as a turn.
                            if (result.ok && !(0, session_1.sessionRunCoordinator)(target).active)
                                void (0, session_1.sessionRunCoordinator)(target).wake(ctx.ports.drainSessionFor(target));
                            return [2 /*return*/, result];
                    }
                });
            });
        },
    };
}
