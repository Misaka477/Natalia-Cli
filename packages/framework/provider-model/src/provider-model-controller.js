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
exports.createProviderModelController = createProviderModelController;
var provider_runner_1 = require("./provider-runner");
function createProviderModelController(input) {
    var runners = new Map();
    var navi = {
        aborts: new Map(),
        tasks: new Map(),
        wakePending: new Set(),
        wakeTasks: new Map(),
    };
    var nia = {
        aborts: new Map(),
        tasks: new Map(),
        wakePending: new Set(),
        wakeTasks: new Map(),
    };
    var disposed = false;
    input.initialize();
    function runTurn(sessionID, turn) {
        return __awaiter(this, void 0, void 0, function () {
            var runner;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (disposed)
                            throw new Error("provider/model controller disposed");
                        runner = runners.get(sessionID);
                        if (!runner) {
                            runner = (0, provider_runner_1.createProviderRunner)(input.runnerInput(sessionID));
                            runners.set(sessionID, runner);
                        }
                        return [4 /*yield*/, runner.runTurn(turn)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function runNaviChatTurn(turn) {
        return __awaiter(this, void 0, void 0, function () {
            var key, startedAt, abort, task, naviStop, cause_1, cancelled, naviStop;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (disposed)
                            throw new Error("provider/model controller disposed");
                        key = turn.sessionID;
                        if (!input.navi.available(key))
                            throw new Error("provider unavailable for Navi");
                        if (navi.aborts.has(key)) {
                            if (turn.internal)
                                return [2 /*return*/];
                            throw new Error("navi is already busy for this session");
                        }
                        startedAt = Date.now();
                        abort = new AbortController();
                        navi.aborts.set(key, abort);
                        console.log("[navi-turn] start", {
                            sessionID: turn.sessionID,
                            responseMessageID: turn.responseMessageID,
                            internal: turn.internal === true,
                            model: (_a = turn.model) === null || _a === void 0 ? void 0 : _a.modelID,
                        });
                        task = Promise.resolve().then(function () {
                            abort.signal.throwIfAborted();
                            return input.navi.runBody(turn, abort.signal);
                        });
                        navi.tasks.set(key, task);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, 5, 6]);
                        input.navi.publish(key, __assign({ type: "navi.chat.turn.started", id: "".concat(turn.responseMessageID, ":started"), messageID: turn.responseMessageID, startedAt: startedAt }, (turn.internal ? { internal: true } : {})));
                        return [4 /*yield*/, task];
                    case 2:
                        _b.sent();
                        naviStop = abort.signal.aborted ? "cancelled" : "done";
                        console.log("[navi-turn] finished", {
                            sessionID: turn.sessionID,
                            responseMessageID: turn.responseMessageID,
                            internal: turn.internal === true,
                            stopReason: naviStop,
                        });
                        input.navi.publish(key, {
                            type: "navi.chat.turn.finished",
                            id: "".concat(turn.responseMessageID, ":finished"),
                            messageID: turn.responseMessageID,
                            stopReason: naviStop,
                            startedAt: startedAt,
                            endedAt: Date.now(),
                        });
                        return [3 /*break*/, 6];
                    case 3:
                        cause_1 = _b.sent();
                        cancelled = abort.signal.aborted;
                        naviStop = cancelled ? "cancelled" : "error";
                        console.error("[navi-turn] finished", {
                            sessionID: turn.sessionID,
                            responseMessageID: turn.responseMessageID,
                            internal: turn.internal === true,
                            stopReason: naviStop,
                            error: cause_1 instanceof Error ? cause_1.message : String(cause_1),
                        });
                        abort.abort(cause_1);
                        return [4 /*yield*/, task.catch(function () { return undefined; })];
                    case 4:
                        _b.sent();
                        input.navi.publish(key, __assign({ type: "navi.chat.turn.finished", id: "".concat(turn.responseMessageID, ":finished"), messageID: turn.responseMessageID, stopReason: naviStop, startedAt: startedAt, endedAt: Date.now() }, (!cancelled
                            ? { error: cause_1 instanceof Error ? cause_1.message : String(cause_1) }
                            : {})));
                        throw cause_1;
                    case 5:
                        if (navi.tasks.get(key) === task)
                            navi.tasks.delete(key);
                        if (navi.aborts.get(key) === abort)
                            navi.aborts.delete(key);
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    }
    function runNiaChatTurn(turn) {
        return __awaiter(this, void 0, void 0, function () {
            var key, startedAt, abort, task, niaStop, cause_2, cancelled, niaStop;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (disposed)
                            throw new Error("provider/model controller disposed");
                        key = turn.sessionID;
                        if (!input.nia.available(key))
                            throw new Error("provider unavailable for Nia");
                        if (nia.aborts.has(key)) {
                            if (turn.internal)
                                return [2 /*return*/];
                            throw new Error("nia is already busy for this session");
                        }
                        startedAt = Date.now();
                        abort = new AbortController();
                        nia.aborts.set(key, abort);
                        console.log("[nia-turn] start", {
                            sessionID: turn.sessionID,
                            responseMessageID: turn.responseMessageID,
                            internal: turn.internal === true,
                            model: (_a = turn.model) === null || _a === void 0 ? void 0 : _a.modelID,
                        });
                        task = Promise.resolve().then(function () {
                            abort.signal.throwIfAborted();
                            return input.nia.runBody(turn, abort.signal);
                        });
                        nia.tasks.set(key, task);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, 5, 6]);
                        input.nia.publish(key, __assign({ type: "nia.chat.turn.started", id: "".concat(turn.responseMessageID, ":started"), messageID: turn.responseMessageID, startedAt: startedAt }, (turn.internal ? { internal: true } : {})));
                        return [4 /*yield*/, task];
                    case 2:
                        _b.sent();
                        niaStop = abort.signal.aborted ? "cancelled" : "done";
                        console.log("[nia-turn] finished", {
                            sessionID: turn.sessionID,
                            responseMessageID: turn.responseMessageID,
                            internal: turn.internal === true,
                            stopReason: niaStop,
                        });
                        input.nia.publish(key, {
                            type: "nia.chat.turn.finished",
                            id: "".concat(turn.responseMessageID, ":finished"),
                            messageID: turn.responseMessageID,
                            stopReason: niaStop,
                            startedAt: startedAt,
                            endedAt: Date.now(),
                        });
                        return [3 /*break*/, 6];
                    case 3:
                        cause_2 = _b.sent();
                        cancelled = abort.signal.aborted;
                        niaStop = cancelled ? "cancelled" : "error";
                        console.error("[nia-turn] finished", {
                            sessionID: turn.sessionID,
                            responseMessageID: turn.responseMessageID,
                            internal: turn.internal === true,
                            stopReason: niaStop,
                            error: cause_2 instanceof Error ? cause_2.message : String(cause_2),
                        });
                        abort.abort(cause_2);
                        return [4 /*yield*/, task.catch(function () { return undefined; })];
                    case 4:
                        _b.sent();
                        input.nia.publish(key, __assign({ type: "nia.chat.turn.finished", id: "".concat(turn.responseMessageID, ":finished"), messageID: turn.responseMessageID, stopReason: niaStop, startedAt: startedAt, endedAt: Date.now() }, (!cancelled
                            ? { error: cause_2 instanceof Error ? cause_2.message : String(cause_2) }
                            : {})));
                        throw cause_2;
                    case 5:
                        if (nia.tasks.get(key) === task)
                            nia.tasks.delete(key);
                        if (nia.aborts.get(key) === abort)
                            nia.aborts.delete(key);
                        return [7 /*endfinally*/];
                    case 6: return [2 /*return*/];
                }
            });
        });
    }
    function requestNaviWake(sessionID) {
        var _this = this;
        if (disposed)
            return;
        navi.wakePending.add(sessionID);
        if (navi.wakeTasks.has(sessionID))
            return;
        var task = Promise.resolve()
            .then(function () { return __awaiter(_this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(navi.wakePending.has(sessionID) && !disposed)) return [3 /*break*/, 4];
                        return [4 /*yield*/, ((_a = navi.tasks.get(sessionID)) === null || _a === void 0 ? void 0 : _a.catch(function () { return undefined; }))];
                    case 1:
                        _b.sent();
                        if (!navi.wakePending.delete(sessionID))
                            return [3 /*break*/, 4];
                        if (!(!disposed && input.navi.available(sessionID))) return [3 /*break*/, 3];
                        return [4 /*yield*/, input.navi.wake(sessionID)];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3: return [3 /*break*/, 0];
                    case 4: return [2 /*return*/];
                }
            });
        }); })
            .finally(function () {
            if (navi.wakeTasks.get(sessionID) === task)
                navi.wakeTasks.delete(sessionID);
            if (navi.wakePending.has(sessionID) && !disposed)
                requestNaviWake(sessionID);
        });
        navi.wakeTasks.set(sessionID, task);
        void task.catch(function () { return undefined; });
    }
    function requestNiaWake(sessionID) {
        var _this = this;
        if (disposed)
            return;
        nia.wakePending.add(sessionID);
        if (nia.wakeTasks.has(sessionID))
            return;
        var task = Promise.resolve()
            .then(function () { return __awaiter(_this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!(nia.wakePending.has(sessionID) && !disposed)) return [3 /*break*/, 4];
                        return [4 /*yield*/, ((_a = nia.tasks.get(sessionID)) === null || _a === void 0 ? void 0 : _a.catch(function () { return undefined; }))];
                    case 1:
                        _b.sent();
                        if (!nia.wakePending.delete(sessionID))
                            return [3 /*break*/, 4];
                        if (!(!disposed && input.nia.available(sessionID))) return [3 /*break*/, 3];
                        return [4 /*yield*/, input.nia.wake(sessionID)];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3: return [3 /*break*/, 0];
                    case 4: return [2 /*return*/];
                }
            });
        }); })
            .finally(function () {
            if (nia.wakeTasks.get(sessionID) === task)
                nia.wakeTasks.delete(sessionID);
            if (nia.wakePending.has(sessionID) && !disposed)
                requestNiaWake(sessionID);
        });
        nia.wakeTasks.set(sessionID, task);
        void task.catch(function () { return undefined; });
    }
    function abortNavi(sessionID) {
        var abort = navi.aborts.get(sessionID);
        if (!abort)
            return false;
        navi.wakePending.delete(sessionID);
        abort.abort(new Error("navi aborted"));
        return true;
    }
    function abortNia(sessionID) {
        var abort = nia.aborts.get(sessionID);
        if (!abort)
            return false;
        nia.wakePending.delete(sessionID);
        abort.abort(new Error("nia aborted"));
        return true;
    }
    function dispose() {
        return __awaiter(this, void 0, void 0, function () {
            var _i, _a, abort;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (disposed)
                            return [2 /*return*/];
                        disposed = true;
                        navi.wakePending.clear();
                        nia.wakePending.clear();
                        for (_i = 0, _a = __spreadArray(__spreadArray([], navi.aborts.values(), true), nia.aborts.values(), true); _i < _a.length; _i++) {
                            abort = _a[_i];
                            abort.abort(new Error("provider/model controller disposed"));
                        }
                        return [4 /*yield*/, Promise.allSettled(__spreadArray(__spreadArray(__spreadArray(__spreadArray([], navi.tasks.values(), true), nia.tasks.values(), true), navi.wakeTasks.values(), true), nia.wakeTasks.values(), true))];
                    case 1:
                        _b.sent();
                        runners.clear();
                        return [2 /*return*/];
                }
            });
        });
    }
    return {
        runTurn: runTurn,
        runNaviChatTurn: runNaviChatTurn,
        runNiaChatTurn: runNiaChatTurn,
        requestNaviWake: requestNaviWake,
        requestNiaWake: requestNiaWake,
        abortNavi: abortNavi,
        abortNia: abortNia,
        naviBusy: function (id) { return navi.aborts.has(id); },
        niaBusy: function (id) { return nia.aborts.has(id); },
        dispose: dispose,
    };
}
