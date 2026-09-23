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
exports.createTitleGeneration = createTitleGeneration;
/**
 * Automatic session titles — runtime/title-generation module.
 *
 * Owns the title-generation task map and the five functions that feed, defer,
 * cancel, apply, and generate a session title. Reads everything it needs from
 * `RuntimeContext` at call time.
 */
var session_1 = require("@anthelia/session");
var runtime_1 = require("@natalia/runtime");
var session_store_1 = require("@anthelia/session-store");
var session_title_1 = require("../session-title");
function createTitleGeneration(ctx) {
    return {
        rememberTitleInput: rememberTitleInput,
        scheduleTitleGeneration: scheduleTitleGeneration,
        cancelTitleGeneration: cancelTitleGeneration,
        generateTitleForSession: generateTitleForSession,
    };
    function rememberTitleInput(id, text) {
        var titleGenerationTasks = ctx.state.titleGenerationTasks;
        var sanitized = (0, session_title_1.sanitizeSessionTitleInput)(text);
        if (sanitized.replace(/\[redacted\]|\[home path\]/gu, "").trim().length < 3)
            return;
        if (!titleGenerationTasks.has(id))
            titleGenerationTasks.set(id, { input: text });
    }
    function scheduleTitleGeneration(id) {
        var titleGenerationTasks = ctx.state.titleGenerationTasks;
        var isDisposed = ctx.ports.isDisposed;
        var task = titleGenerationTasks.get(id);
        if (!task || task.timer || task.promise || isDisposed())
            return;
        task.timer = setTimeout(function () {
            task.timer = undefined;
            if (isDisposed() || titleGenerationTasks.get(id) !== task)
                return;
            if ((0, session_1.sessionRunCoordinator)(id).active) {
                scheduleTitleGeneration(id);
                return;
            }
            var controller = new AbortController();
            task.controller = controller;
            task.promise = generateTitleForSession(id, task.input, controller.signal)
                .catch(function () { return undefined; })
                .finally(function () {
                if (titleGenerationTasks.get(id) === task)
                    titleGenerationTasks.delete(id);
            });
        }, 100);
    }
    function cancelTitleGeneration(id) {
        return __awaiter(this, void 0, void 0, function () {
            var titleGenerationTasks, task;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        titleGenerationTasks = ctx.state.titleGenerationTasks;
                        task = titleGenerationTasks.get(id);
                        if (!task)
                            return [2 /*return*/];
                        titleGenerationTasks.delete(id);
                        if (task.timer)
                            clearTimeout(task.timer);
                        (_a = task.controller) === null || _a === void 0 ? void 0 : _a.abort(new Error("session title generation cancelled"));
                        return [4 /*yield*/, ((_b = task.promise) === null || _b === void 0 ? void 0 : _b.catch(function () { return undefined; }))];
                    case 1:
                        _c.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function applyGeneratedTitle(id, updated, source) {
        var _a = ctx.ports, publishForSession = _a.publishForSession, getExecutionBySession = _a.getExecutionBySession;
        var exec = getExecutionBySession().get(id);
        if (exec) {
            exec.session.title = updated.title;
            exec.session.metadata = __assign(__assign({}, exec.session.metadata), { titleSource: source });
        }
        publishForSession(exec, {
            type: "session.title.updated",
            sessionID: id,
            title: updated.title,
        });
    }
    function generateTitleForSession(id, text, signal) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, getSessionPersistence, getProviderConcurrencyLimiter, getExecutionBySession, sanitized, sessionStoreController, loadCurrent, current, titleProvider_1, titleLimiter_1, generated, _b, title, source, updated, committed, _c, fallback, updated, committed;
            var _this = this;
            var _d, _e, _f, _g;
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        _a = ctx.ports, getSessionPersistence = _a.getSessionPersistence, getProviderConcurrencyLimiter = _a.getProviderConcurrencyLimiter, getExecutionBySession = _a.getExecutionBySession;
                        sanitized = (0, session_title_1.sanitizeSessionTitleInput)(text);
                        if (sanitized.replace(/\[redacted\]|\[home path\]/gu, "").trim().length < 3)
                            return [2 /*return*/];
                        sessionStoreController = ctx.state.serviceDirectory.get(session_store_1.sessionStoreController);
                        loadCurrent = function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, sessionStoreController.load(id)];
                                case 1: return [2 /*return*/, (_a.sent()).session];
                            }
                        }); }); };
                        _h.label = 1;
                    case 1:
                        _h.trys.push([1, 9, , 12]);
                        return [4 /*yield*/, getSessionPersistence()];
                    case 2:
                        _h.sent();
                        return [4 /*yield*/, loadCurrent()];
                    case 3:
                        current = _h.sent();
                        if (!current ||
                            (current.title !== "New session" &&
                                !(0, session_title_1.isInvalidGeneratedSessionTitle)(current.title)) ||
                            ((_d = current.metadata) === null || _d === void 0 ? void 0 : _d.titleSource) === "manual")
                            return [2 /*return*/];
                        titleProvider_1 = (_e = getExecutionBySession().get(id)) === null || _e === void 0 ? void 0 : _e.provider;
                        titleLimiter_1 = getProviderConcurrencyLimiter();
                        if (!titleProvider_1) return [3 /*break*/, 5];
                        return [4 /*yield*/, (0, session_title_1.generateSessionTitle)(titleProvider_1, sanitized, {
                                signal: signal,
                                stream: function (request) {
                                    return (0, runtime_1.withProviderConcurrency)(titleLimiter_1, titleProvider_1.provider, function () { return titleProvider_1.stream(request); }, request.signal);
                                },
                            })];
                    case 4:
                        _b = _h.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        _b = "";
                        _h.label = 6;
                    case 6:
                        generated = _b;
                        if (signal.aborted)
                            return [2 /*return*/];
                        title = generated || (0, session_title_1.fallbackSessionTitle)(sanitized);
                        source = generated ? "generated" : "fallback";
                        return [4 /*yield*/, sessionStoreController.setAutoTitle(id, title, source)];
                    case 7:
                        updated = _h.sent();
                        return [4 /*yield*/, loadCurrent()];
                    case 8:
                        committed = _h.sent();
                        if (updated.title === title &&
                            (committed === null || committed === void 0 ? void 0 : committed.title) === title &&
                            ((_f = committed.metadata) === null || _f === void 0 ? void 0 : _f.titleSource) === source)
                            applyGeneratedTitle(id, updated, source);
                        return [3 /*break*/, 12];
                    case 9:
                        _c = _h.sent();
                        if (signal.aborted)
                            return [2 /*return*/];
                        fallback = (0, session_title_1.fallbackSessionTitle)(sanitized);
                        return [4 /*yield*/, sessionStoreController
                                .setAutoTitle(id, fallback, "fallback")
                                .catch(function () { return undefined; })];
                    case 10:
                        updated = _h.sent();
                        return [4 /*yield*/, loadCurrent().catch(function () { return undefined; })];
                    case 11:
                        committed = _h.sent();
                        if ((updated === null || updated === void 0 ? void 0 : updated.title) === fallback &&
                            (committed === null || committed === void 0 ? void 0 : committed.title) === fallback &&
                            ((_g = committed.metadata) === null || _g === void 0 ? void 0 : _g.titleSource) === "fallback")
                            applyGeneratedTitle(id, updated, "fallback");
                        return [3 /*break*/, 12];
                    case 12: return [2 /*return*/];
                }
            });
        });
    }
}
