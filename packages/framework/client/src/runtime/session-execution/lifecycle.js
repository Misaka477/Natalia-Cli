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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLifecycleSurface = createLifecycleSurface;
var session_store_1 = require("@anthelia/session-store");
var checkpoint_1 = require("@anthelia/checkpoint");
var runtime_services_1 = require("@natalia/runtime-services");
var config_1 = require("@natalia/config");
var secondary_worker_client_1 = require("../secondary-worker-client");
var session_1 = require("@anthelia/session");
var operation_log_1 = require("@natalia/operation-log");
/** How long one dispose sub-step may take before the next one runs. */
var DISPOSE_STEP_TIMEOUT_MS = Math.max(500, Number((_a = process.env.NATALIA_DISPOSE_STEP_TIMEOUT_MS) !== null && _a !== void 0 ? _a : 2000));
/**
 * Runs one dispose sub-step under a timeout and logs its duration. A hung
 * sub-step must not stop the ones that follow it — the durable session flush in
 * particular has to run even if an earlier worker/wake never settles.
 */
function shutdownStep(label, work, log) {
    return __awaiter(this, void 0, void 0, function () {
        var started, timer, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    started = Date.now();
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, Promise.race([
                            Promise.resolve().then(work),
                            new Promise(function (resolve) {
                                var _a;
                                timer = setTimeout(function () {
                                    log.debug("shutdown", "dispose.".concat(label, " stuck >").concat(DISPOSE_STEP_TIMEOUT_MS, "ms; continuing"));
                                    resolve();
                                }, DISPOSE_STEP_TIMEOUT_MS);
                                (_a = timer.unref) === null || _a === void 0 ? void 0 : _a.call(timer);
                            }),
                        ])];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 3:
                    error_1 = _a.sent();
                    log.debug("shutdown", "dispose.".concat(label, " failed: ").concat(error_1 instanceof Error ? error_1.message : String(error_1)));
                    return [3 /*break*/, 5];
                case 4:
                    if (timer)
                        clearTimeout(timer);
                    log.debug("shutdown", "dispose.".concat(label, " +").concat(Date.now() - started, "ms"));
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function createLifecycleSurface(ctx, options) {
    var log = (0, operation_log_1.logOf)(ctx.state.serviceDirectory);
    return {
        configGet: function () {
            return __awaiter(this, void 0, void 0, function () {
                var config, _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _b.sent();
                            config = ctx.ports.getTsRuntimeConfig();
                            if (!config)
                                throw new Error("runtime configuration is not initialized");
                            _b.label = 2;
                        case 2:
                            _b.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, (0, secondary_worker_client_1.cloneConfigInWorker)(config)];
                        case 3: return [2 /*return*/, _b.sent()];
                        case 4:
                            _a = _b.sent();
                            return [2 /*return*/, structuredClone(config)];
                        case 5: return [2 /*return*/];
                    }
                });
            });
        },
        dispose: function () {
            return __awaiter(this, void 0, void 0, function () {
                var flushStart, _i, _a, exec, _b, _c, resolveWaiter, sessionStore, checkpointClose;
                var _d, _e, _f, _g, _h;
                return __generator(this, function (_j) {
                    switch (_j.label) {
                        case 0:
                            flushStart = Date.now();
                            ctx.ports.setDisposed(true);
                            return [4 /*yield*/, shutdownStep("titleGeneration", function () {
                                    return Promise.all(__spreadArray([], ctx.state.titleGenerationTasks.keys(), true).map(ctx.ports.cancelTitleGeneration));
                                }, log)];
                        case 1:
                            _j.sent();
                            ctx.ports.getTerminalCommandBuffer().clearAll();
                            for (_i = 0, _a = ctx.ports.getExecutionBySession().values(); _i < _a.length; _i++) {
                                exec = _a[_i];
                                (_d = exec.activeAbort) === null || _d === void 0 ? void 0 : _d.abort(new Error("runtime disposed"));
                                exec.paused = false;
                                for (_b = 0, _c = exec.pauseWaiters; _b < _c.length; _b++) {
                                    resolveWaiter = _c[_b];
                                    resolveWaiter();
                                }
                                exec.pauseWaiters = [];
                            }
                            // Persist the last <1s of streamed text before the store flushes/closes.
                            (_f = (_e = ctx.ports).flushPendingPartialOutput) === null || _f === void 0 ? void 0 : _f.call(_e);
                            return [4 /*yield*/, shutdownStep("runCoordinator", function () {
                                    return Promise.all(__spreadArray([], ctx.ports.getExecutionBySession().keys(), true).map(function (id) {
                                        return (0, session_1.sessionRunCoordinator)(id).interrupt();
                                    }));
                                }, log)];
                        case 2:
                            _j.sent();
                            return [4 /*yield*/, shutdownStep("internalWakeTasks", function () { return Promise.allSettled(__spreadArray([], ctx.ports.getInternalWakeTasks(), true)); }, log)];
                        case 3:
                            _j.sent();
                            // A committed selection and other durable controls must reach disk before
                            // a caller opens the same session in a replacement runtime. These three
                            // run even if an earlier step timed out, so durable state is not lost.
                            return [4 /*yield*/, shutdownStep("sessionPersistence", function () { return ctx.ports.getSessionPersistence(); }, log)];
                        case 4:
                            // A committed selection and other durable controls must reach disk before
                            // a caller opens the same session in a replacement runtime. These three
                            // run even if an earlier step timed out, so durable state is not lost.
                            _j.sent();
                            sessionStore = ctx.state.serviceDirectory.getOptional(session_store_1.sessionStoreController);
                            return [4 /*yield*/, shutdownStep("sessionStoreFlush", function () {
                                    return sessionStore
                                        ? Promise.all(__spreadArray([], ctx.ports.getExecutionBySession().keys(), true).map(function (id) {
                                            return sessionStore.flush(id);
                                        }))
                                        : undefined;
                                }, log)];
                        case 5:
                            _j.sent();
                            return [4 /*yield*/, shutdownStep("sandboxClose", function () { var _a; return (_a = ctx.state.serviceDirectory.getOptional(runtime_services_1.sandboxService)) === null || _a === void 0 ? void 0 : _a.close(); }, log)];
                        case 6:
                            _j.sent();
                            return [4 /*yield*/, shutdownStep("terminalClose", function () { var _a; return (_a = ctx.state.serviceDirectory.getOptional(runtime_services_1.terminalController)) === null || _a === void 0 ? void 0 : _a.close(); }, log)];
                        case 7:
                            _j.sent();
                            checkpointClose = ctx.state.serviceDirectory.getOptional(checkpoint_1.checkpointFactory);
                            (_g = checkpointClose === null || checkpointClose === void 0 ? void 0 : checkpointClose.close) === null || _g === void 0 ? void 0 : _g.call(checkpointClose);
                            return [4 /*yield*/, shutdownStep("pluginsClose", function () { return ctx.ports.getPluginsController().close(); }, log)];
                        case 8:
                            _j.sent();
                            (_h = ctx.state.frameworkServices) === null || _h === void 0 ? void 0 : _h.close();
                            return [4 /*yield*/, shutdownStep("performanceTrace", function () { return ctx.ports.getPerformanceTrace().stop(); }, log)];
                        case 9:
                            _j.sent();
                            (0, operation_log_1.logOf)(ctx.state.serviceDirectory).debug("shutdown", "dispose total +".concat(Date.now() - flushStart, "ms"));
                            return [2 /*return*/];
                    }
                });
            });
        },
        canReloadConfig: function () {
            return __awaiter(this, void 0, void 0, function () {
                var blocked;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            blocked = ctx.ports.configReloadBlockedReason();
                            return [2 /*return*/, blocked ? { allowed: false, reason: blocked } : { allowed: true }];
                    }
                });
            });
        },
        reloadConfig: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, ctx.ports.applyConfigFromDisk()];
                        case 2: 
                        // Re-checked here rather than trusting `canReloadConfig`: a turn can start
                        // between the two calls, and applying new policy underneath a running turn
                        // would change the rules it started under.
                        return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        updateConfig: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var patch, error_2, outcome;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _b.sent();
                            patch = normalizeProviderRenamePatch(input.patch, ctx.ports.getTsRuntimeConfig(), log);
                            (0, operation_log_1.logOf)(ctx.state.serviceDirectory).info("updateConfig", "begin", {
                                args: [
                                    input.scope,
                                    "globalPath",
                                    options.globalConfigPath,
                                    JSON.stringify(patch, null, 2).slice(0, 4000),
                                ],
                            });
                            _b.label = 2;
                        case 2:
                            _b.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, (0, config_1.updateConfigAtScope)(ctx.ports.getWorkspaceRoot(), patch, (_a = input.scope) !== null && _a !== void 0 ? _a : "project", { globalPath: options.globalConfigPath })];
                        case 3:
                            _b.sent();
                            (0, operation_log_1.logOf)(ctx.state.serviceDirectory).info("updateConfig", "file written");
                            return [3 /*break*/, 5];
                        case 4:
                            error_2 = _b.sent();
                            (0, operation_log_1.logOf)(ctx.state.serviceDirectory).error("updateConfig", "write failed", { error: error_2 });
                            throw error_2;
                        case 5: return [4 /*yield*/, ctx.ports.applyConfigFromDisk()];
                        case 6:
                            outcome = _b.sent();
                            (0, operation_log_1.logOf)(ctx.state.serviceDirectory).info("updateConfig", "applied", {
                                args: [outcome.applied, outcome.reason],
                            });
                            return [2 /*return*/, outcome];
                    }
                });
            });
        },
    };
}
function normalizeProviderRenamePatch(patch, currentConfig, log) {
    var _a, _b;
    var providersPatch = patch.providers;
    if (!providersPatch)
        return patch;
    var currentProviders = (_a = currentConfig === null || currentConfig === void 0 ? void 0 : currentConfig.providers) !== null && _a !== void 0 ? _a : {};
    var result = __assign(__assign({}, patch), { providers: __assign({}, providersPatch) });
    var catalogPatch = patch.catalog;
    var nextCatalog = catalogPatch
        ? { providers: __assign({}, ((_b = catalogPatch.providers) !== null && _b !== void 0 ? _b : {})) }
        : undefined;
    var _loop_1 = function (key, value) {
        if (value === undefined)
            return "continue";
        var provider = value;
        var match = Object.keys(currentProviders).find(function (oldKey) {
            var _a, _b, _c, _d, _e, _f, _g;
            return oldKey !== key &&
                (((_a = currentProviders[oldKey]) === null || _a === void 0 ? void 0 : _a.name) === provider.name ||
                    (((_c = (_b = currentProviders[oldKey]) === null || _b === void 0 ? void 0 : _b.connection) === null || _c === void 0 ? void 0 : _c.baseURL) ===
                        ((_d = provider.connection) === null || _d === void 0 ? void 0 : _d.baseURL) &&
                        ((_f = (_e = currentProviders[oldKey]) === null || _e === void 0 ? void 0 : _e.connection) === null || _f === void 0 ? void 0 : _f.apiKey) ===
                            ((_g = provider.connection) === null || _g === void 0 ? void 0 : _g.apiKey)));
        });
        if (match) {
            result.providers[match] = undefined;
            if (nextCatalog) {
                if (nextCatalog.providers[key])
                    nextCatalog.providers[match] = undefined;
                result.catalog = nextCatalog;
            }
            log.info("updateConfig", "provider rename inferred", {
                args: [match, "->", key],
            });
        }
    };
    for (var _i = 0, _c = Object.entries(providersPatch); _i < _c.length; _i++) {
        var _d = _c[_i], key = _d[0], value = _d[1];
        _loop_1(key, value);
    }
    return result;
}
