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
exports.wireTurnOrchestration = wireTurnOrchestration;
/**
 * Framework subsystem composition — initialize/framework-turn-orchestration.ts.
 *
 * Durable turn admission, promotion and dispatch ordering is a framework-
 * internal subsystem, not a plugin: this module constructs the turn controller
 * directly and contributes it as the `turn.controller` service. It depends on
 * the session-store subsystem, which is wired before it.
 */
var session_1 = require("@anthelia/session");
var turn_orchestration_1 = require("@anthelia/turn-orchestration");
var provider_model_1 = require("@anthelia/provider-model");
var session_store_1 = require("@anthelia/session-store");
var operation_log_1 = require("@natalia/operation-log");
/**
 * The `turn.submitted` fact for a turn that is actually starting, unless the
 * journal already has one (recovery/replay). The admitted input record carries
 * the attachments/resources/agents that a command otherwise never sees.
 */
function buildAnnouncedTurn(owner, id, text) {
    var _a;
    if (owner.announcedTurnIDs.has(id))
        return undefined;
    var input = (_a = owner.session.inbox) === null || _a === void 0 ? void 0 : _a.find(function (item) { return item.id === id; });
    return (0, session_1.buildSubmittedTurn)({
        id: id,
        text: text,
        attachments: input === null || input === void 0 ? void 0 : input.attachments,
        resources: input === null || input === void 0 ? void 0 : input.resources,
        agents: input === null || input === void 0 ? void 0 : input.agents,
        internal: input === null || input === void 0 ? void 0 : input.internal,
    });
}
function wireTurnOrchestration(ctx) {
    var _this = this;
    var registry = ctx.state.capabilityRegistry;
    var deps = ctx.state.initialize;
    var owner = registry.registerOwner({
        id: "natalia-turn-orchestration",
        name: "Turn Orchestration",
        version: "1.0.0",
        scope: "workspace",
        grants: ["services"],
    });
    var controller = (0, turn_orchestration_1.createTurnController)({
        session: ctx.ports.getSession,
        activeAbort: function () { var _a; return (_a = ctx.ports.getActiveExec()) === null || _a === void 0 ? void 0 : _a.activeAbort; },
        sessionFor: function (id) {
            var _a, _b;
            return (_b = (_a = ctx.state.executionBySession.get(id)) === null || _a === void 0 ? void 0 : _a.session) !== null && _b !== void 0 ? _b : ctx.ports.getSession();
        },
        activeAbortFor: function (id) { var _a; return (_a = ctx.state.executionBySession.get(id)) === null || _a === void 0 ? void 0 : _a.activeAbort; },
        persist: function (fn) {
            var persistence = ctx.ports
                .getSessionPersistence()
                .then(fn)
                .catch(function (error) {
                return ctx.ports.publish({
                    type: "diagnostic",
                    level: "warning",
                    message: "session persistence deferred/failed: ".concat(error instanceof Error ? error.message : String(error)),
                });
            });
            ctx.ports.setSessionPersistence(persistence);
            return persistence;
        },
        saveInbox: function (snapshot) { return __awaiter(_this, void 0, void 0, function () {
            var sessionStore;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        sessionStore = ctx.state.serviceDirectory.get(session_store_1.sessionStoreController);
                        return [4 /*yield*/, sessionStore.saveInbox(snapshot)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        flush: function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, ctx.ports.getSessionPersistence()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); },
        runCommand: function (id, text, signal, ownerID) { return __awaiter(_this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                // §4.5: correlation injected on the record side — everything logged
                // inside a command/turn carries session+turn without any call site
                // passing them (the Hermes record factory, ported to ALS).
                return [2 /*return*/, (0, operation_log_1.logOf)(ctx.state.serviceDirectory).runWithCorrelation({ sessionID: ownerID, turnID: id }, function () { return __awaiter(_this, void 0, void 0, function () {
                        var owner, submitted, error_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, ctx.ports.ensureExecution(ownerID)];
                                case 1:
                                    owner = _a.sent();
                                    submitted = buildAnnouncedTurn(owner, id, text);
                                    if (submitted) {
                                        ctx.ports.publishForSession(owner, submitted);
                                        owner.announcedTurnIDs.add(id);
                                    }
                                    ctx.ports.publishForSession(owner, { type: "turn.started", id: id });
                                    _a.label = 2;
                                case 2:
                                    _a.trys.push([2, 4, 5, 6]);
                                    return [4 /*yield*/, deps.handleCommand(id, text, signal, owner)];
                                case 3: return [2 /*return*/, _a.sent()];
                                case 4:
                                    error_1 = _a.sent();
                                    ctx.ports.publishForSession(owner, {
                                        type: "turn.cancelled",
                                        id: id,
                                        reason: error_1 instanceof Error ? error_1.message : String(error_1),
                                    });
                                    throw error_1;
                                case 5:
                                    deps.scheduleTitleGeneration(ownerID);
                                    return [7 /*endfinally*/];
                                case 6: return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        }); },
        runTurn: function (input) { return __awaiter(_this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, (0, operation_log_1.logOf)(ctx.state.serviceDirectory).runWithCorrelation({
                        sessionID: input.sessionID,
                        turnID: input.id,
                    }, function () { return __awaiter(_this, void 0, void 0, function () {
                        var controller_1, exec;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    deps.deliverQueuedMailboxAtBoundary(ctx.state.executionBySession.get(input.sessionID));
                                    _a.label = 1;
                                case 1:
                                    _a.trys.push([1, , 5, 6]);
                                    controller_1 = ctx.state.serviceDirectory.getOptional(provider_model_1.providerModelController);
                                    if (!controller_1) return [3 /*break*/, 3];
                                    return [4 /*yield*/, controller_1.runTurn(input.sessionID, input)];
                                case 2:
                                    _a.sent();
                                    return [3 /*break*/, 4];
                                case 3:
                                    exec = ctx.state.executionBySession.get(input.sessionID);
                                    ctx.ports.publishForSession(exec, {
                                        type: "diagnostic",
                                        level: "error",
                                        message: "Provider/model subsystem is unavailable.",
                                    });
                                    ctx.ports.publishForSession(exec, {
                                        type: "turn.finished",
                                        id: input.id,
                                        stopReason: "error",
                                    });
                                    _a.label = 4;
                                case 4: return [3 /*break*/, 6];
                                case 5:
                                    deps.scheduleTitleGeneration(input.sessionID);
                                    return [7 /*endfinally*/];
                                case 6: return [2 /*return*/];
                            }
                        });
                    }); })];
            });
        }); },
    });
    ctx.state.serviceDirectory.provide(turn_orchestration_1.turnController, controller);
    return {
        close: function () {
            controller.dispose();
        },
    };
}
