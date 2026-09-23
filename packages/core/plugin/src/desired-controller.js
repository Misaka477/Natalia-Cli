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
exports.createDesiredPluginController = createDesiredPluginController;
var dependencies_1 = require("./dependencies");
function createDesiredPluginController(input) {
    var desired = new Map();
    var lifecycleQueue = Promise.resolve();
    var reloadSequence = 0;
    function previous(id) {
        var state = desired.get(id);
        return state
            ? { fingerprint: state.fingerprint, manifest: state.entry.manifest }
            : undefined;
    }
    function enqueue(operation) {
        var result = lifecycleQueue.then(operation, operation);
        lifecycleQueue = result.then(function () { return undefined; }, function () { return undefined; });
        return result;
    }
    function reconcileDesired(source, settings) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
                            var catalog, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        if (!(typeof source === "function")) return [3 /*break*/, 2];
                                        return [4 /*yield*/, source()];
                                    case 1:
                                        _a = _b.sent();
                                        return [3 /*break*/, 3];
                                    case 2:
                                        _a = source;
                                        _b.label = 3;
                                    case 3:
                                        catalog = _a;
                                        return [4 /*yield*/, applyDesired(catalog, settings)];
                                    case 4:
                                        _b.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function applyDesired(catalog, settings) {
        return __awaiter(this, void 0, void 0, function () {
            var entries, blocked, byID, _loop_1, _i, _a, id, previousDesired, next, _loop_2, _b, _c, manifest, firstError, _loop_3, _d, _e, state;
            var _f, _g, _h, _j;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        entries = catalog.entries, blocked = catalog.blocked;
                        byID = new Map(entries.map(function (entry) { return [entry.id, entry]; }));
                        if (byID.size !== entries.length ||
                            entries.some(function (entry) { return entry.manifest && entry.id !== entry.manifest.id; }))
                            throw new Error("desired catalog contains duplicate or mismatched plugin ids");
                        _loop_1 = function (id) {
                            var mounted = input.registry
                                .list()
                                .some(function (manifest) { return manifest.id === id; });
                            if (!mounted)
                                (_f = input.assertOwnerReleased) === null || _f === void 0 ? void 0 : _f.call(input, id);
                        };
                        for (_i = 0, _a = desired.keys(); _i < _a.length; _i++) {
                            id = _a[_i];
                            _loop_1(id);
                        }
                        previousDesired = desired;
                        next = new Map(entries.map(function (entry) { return [
                            entry.id,
                            {
                                entry: entry,
                                fingerprint: entry.fingerprint,
                                settingsFingerprint: settingsFingerprint(settings === null || settings === void 0 ? void 0 : settings[entry.id]),
                                settings: settings === null || settings === void 0 ? void 0 : settings[entry.id],
                                activatable: !blocked.has(entry.id),
                            },
                        ]; }));
                        desired = next;
                        _loop_2 = function (manifest) {
                            var previous_1, wanted;
                            return __generator(this, function (_l) {
                                switch (_l.label) {
                                    case 0:
                                        if (!input.registry.list().some(function (entry) { return entry.id === manifest.id; }))
                                            return [2 /*return*/, "continue"];
                                        previous_1 = previousDesired.get(manifest.id);
                                        wanted = next.get(manifest.id);
                                        if ((wanted === null || wanted === void 0 ? void 0 : wanted.entry.enabled) &&
                                            wanted.activatable &&
                                            (previous_1 === null || previous_1 === void 0 ? void 0 : previous_1.fingerprint) === wanted.fingerprint &&
                                            previous_1.settingsFingerprint === wanted.settingsFingerprint &&
                                            ((_g = input.registry.status(manifest.id)) === null || _g === void 0 ? void 0 : _g.status) !== "failed")
                                            return [2 /*return*/, "continue"];
                                        return [4 /*yield*/, input.registry.unload(manifest.id)];
                                    case 1:
                                        _l.sent();
                                        (_h = input.assertOwnerReleased) === null || _h === void 0 ? void 0 : _h.call(input, manifest.id);
                                        return [2 /*return*/];
                                }
                            });
                        };
                        _b = 0, _c = input.registry.list().reverse();
                        _k.label = 1;
                    case 1:
                        if (!(_b < _c.length)) return [3 /*break*/, 4];
                        manifest = _c[_b];
                        return [5 /*yield**/, _loop_2(manifest)];
                    case 2:
                        _k.sent();
                        _k.label = 3;
                    case 3:
                        _b++;
                        return [3 /*break*/, 1];
                    case 4:
                        _loop_3 = function (state) {
                            var result, error_1;
                            return __generator(this, function (_m) {
                                switch (_m.label) {
                                    case 0:
                                        if (!(state.entry.enabled &&
                                            state.activatable &&
                                            !input.registry
                                                .list()
                                                .some(function (manifest) { return manifest.id === state.entry.id; }))) return [3 /*break*/, 4];
                                        _m.label = 1;
                                    case 1:
                                        _m.trys.push([1, 3, , 4]);
                                        if (!hasLiveDependencies(input.registry, state.entry.manifest))
                                            return [2 /*return*/, "continue"];
                                        return [4 /*yield*/, loadOne(state.entry, state.settings)];
                                    case 2:
                                        result = _m.sent();
                                        if (!result.loaded && firstError === undefined)
                                            firstError =
                                                (_j = result.error) !== null && _j !== void 0 ? _j : new Error("plugin failed to load: ".concat(state.entry.id));
                                        return [3 /*break*/, 4];
                                    case 3:
                                        error_1 = _m.sent();
                                        firstError !== null && firstError !== void 0 ? firstError : (firstError = error_1);
                                        return [3 /*break*/, 4];
                                    case 4: return [2 /*return*/];
                                }
                            });
                        };
                        _d = 0, _e = next.values();
                        _k.label = 5;
                    case 5:
                        if (!(_d < _e.length)) return [3 /*break*/, 8];
                        state = _e[_d];
                        return [5 /*yield**/, _loop_3(state)];
                    case 6:
                        _k.sent();
                        _k.label = 7;
                    case 7:
                        _d++;
                        return [3 /*break*/, 5];
                    case 8:
                        if (firstError !== undefined)
                            throw firstError;
                        return [2 /*return*/];
                }
            });
        });
    }
    function loadOne(entry, settings) {
        return __awaiter(this, void 0, void 0, function () {
            var plugin, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, entry.load()];
                    case 1:
                        plugin = _a.sent();
                        if (!plugin)
                            return [2 /*return*/, { loaded: false }];
                        if (plugin.manifest.id !== entry.id)
                            throw new Error("plugin loader returned id ".concat(plugin.manifest.id, " for ").concat(entry.id));
                        return [4 /*yield*/, input.registry.load(plugin, settings)];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        if (!entry.onError)
                            throw error_2;
                        entry.onError(error_2);
                        return [2 /*return*/, { loaded: false, error: error_2 }];
                    case 4: return [2 /*return*/, { loaded: true }];
                }
            });
        });
    }
    function load(entry, settings) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        desired.set(entry.id, {
                                            entry: entry,
                                            fingerprint: entry.fingerprint,
                                            settingsFingerprint: settingsFingerprint(settings),
                                            settings: settings,
                                            activatable: true,
                                        });
                                        if (!input.registry.list().some(function (item) { return item.id === entry.id; })) return [3 /*break*/, 2];
                                        return [4 /*yield*/, unloadOne(entry.id)];
                                    case 1:
                                        _a.sent();
                                        _a.label = 2;
                                    case 2: return [4 /*yield*/, loadOne(entry, settings)];
                                    case 3: return [2 /*return*/, _a.sent()];
                                }
                            });
                        }); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function unloadOne(id) {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!input.registry.list().some(function (manifest) { return manifest.id === id; })) return [3 /*break*/, 2];
                        return [4 /*yield*/, input.registry.unload(id)];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2:
                        (_a = input.assertOwnerReleased) === null || _a === void 0 ? void 0 : _a.call(input, id);
                        return [2 /*return*/, { unloaded: true }];
                }
            });
        });
    }
    function unload(id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, enqueue(function () { return unloadOne(id); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function loadReloadCandidate(state, cacheBust, action) {
        return __awaiter(this, void 0, void 0, function () {
            var plugin, error_3;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, state.entry.load(cacheBust)];
                    case 1:
                        plugin = _b.sent();
                        if (!plugin)
                            throw new Error("plugin failed to ".concat(action, ": ").concat(state.entry.id));
                        if (plugin.manifest.id !== state.entry.id)
                            throw new Error("plugin loader returned id ".concat(plugin.manifest.id, " for ").concat(state.entry.id));
                        return [4 /*yield*/, input.registry.load(plugin, state.settings)];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_3 = _b.sent();
                        if (state.entry.onError)
                            state.entry.onError(error_3);
                        else
                            (_a = input.onError) === null || _a === void 0 ? void 0 : _a.call(input, state.entry.id, action, error_3);
                        throw error_3;
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function reloadOne(id) {
        return __awaiter(this, void 0, void 0, function () {
            var state, reloadError, rollbackError, restorationError, error_4, rollbackFailure_1, unloadFailure_1, _loop_4, _i, _a, candidate;
            var _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        state = desired.get(id);
                        if (!(state === null || state === void 0 ? void 0 : state.entry.enabled) || !state.activatable)
                            throw new Error("plugin not found: ".concat(id));
                        return [4 /*yield*/, unloadOne(id)];
                    case 1:
                        _d.sent();
                        _d.label = 2;
                    case 2:
                        _d.trys.push([2, 4, , 14]);
                        return [4 /*yield*/, loadReloadCandidate(state, "".concat(Date.now(), "-").concat(reloadSequence++), "reload")];
                    case 3:
                        _d.sent();
                        return [3 /*break*/, 14];
                    case 4:
                        error_4 = _d.sent();
                        reloadError = error_4;
                        return [4 /*yield*/, unloadOne(id)];
                    case 5:
                        _d.sent();
                        _d.label = 6;
                    case 6:
                        _d.trys.push([6, 8, , 13]);
                        return [4 /*yield*/, loadReloadCandidate(state, undefined, "rollback")];
                    case 7:
                        _d.sent();
                        return [3 /*break*/, 13];
                    case 8:
                        rollbackFailure_1 = _d.sent();
                        rollbackError = rollbackFailure_1;
                        _d.label = 9;
                    case 9:
                        _d.trys.push([9, 11, , 12]);
                        return [4 /*yield*/, unloadOne(id)];
                    case 10:
                        _d.sent();
                        return [3 /*break*/, 12];
                    case 11:
                        unloadFailure_1 = _d.sent();
                        rollbackError = new AggregateError([rollbackFailure_1, unloadFailure_1], "plugin ".concat(id, " rollback cleanup failed"));
                        return [3 /*break*/, 12];
                    case 12: return [3 /*break*/, 13];
                    case 13: return [3 /*break*/, 14];
                    case 14:
                        _loop_4 = function (candidate) {
                            var error_5;
                            return __generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0:
                                        if (candidate.entry.id === id ||
                                            !candidate.entry.enabled ||
                                            !candidate.activatable ||
                                            (input.registry
                                                .list()
                                                .some(function (manifest) { return manifest.id === candidate.entry.id; }) &&
                                                ((_b = input.registry.status(candidate.entry.id)) === null || _b === void 0 ? void 0 : _b.status) !== "failed"))
                                            return [2 /*return*/, "continue"];
                                        _e.label = 1;
                                    case 1:
                                        _e.trys.push([1, 5, , 6]);
                                        if (!(((_c = input.registry.status(candidate.entry.id)) === null || _c === void 0 ? void 0 : _c.status) === "failed")) return [3 /*break*/, 3];
                                        return [4 /*yield*/, unloadOne(candidate.entry.id)];
                                    case 2:
                                        _e.sent();
                                        _e.label = 3;
                                    case 3:
                                        if (!hasLiveDependencies(input.registry, candidate.entry.manifest))
                                            return [2 /*return*/, "continue"];
                                        return [4 /*yield*/, loadReloadCandidate(candidate, undefined, "restore")];
                                    case 4:
                                        _e.sent();
                                        return [3 /*break*/, 6];
                                    case 5:
                                        error_5 = _e.sent();
                                        if (candidate.entry.id === id)
                                            rollbackError !== null && rollbackError !== void 0 ? rollbackError : (rollbackError = error_5);
                                        else
                                            restorationError !== null && restorationError !== void 0 ? restorationError : (restorationError = error_5);
                                        return [3 /*break*/, 6];
                                    case 6: return [2 /*return*/];
                                }
                            });
                        };
                        _i = 0, _a = desired.values();
                        _d.label = 15;
                    case 15:
                        if (!(_i < _a.length)) return [3 /*break*/, 18];
                        candidate = _a[_i];
                        return [5 /*yield**/, _loop_4(candidate)];
                    case 16:
                        _d.sent();
                        _d.label = 17;
                    case 17:
                        _i++;
                        return [3 /*break*/, 15];
                    case 18:
                        if (reloadError !== undefined)
                            throw reloadError;
                        if (rollbackError !== undefined)
                            throw rollbackError;
                        if (restorationError !== undefined)
                            throw restorationError;
                        return [2 /*return*/, { reloaded: true }];
                }
            });
        });
    }
    function reload(id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, enqueue(function () { return reloadOne(id); })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function close() {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, enqueue(function () { return __awaiter(_this, void 0, void 0, function () {
                            var _i, _a, id;
                            var _b;
                            return __generator(this, function (_c) {
                                switch (_c.label) {
                                    case 0:
                                        _c.trys.push([0, , 2, 3]);
                                        return [4 /*yield*/, input.registry.close()];
                                    case 1:
                                        _c.sent();
                                        return [3 /*break*/, 3];
                                    case 2:
                                        for (_i = 0, _a = desired.keys(); _i < _a.length; _i++) {
                                            id = _a[_i];
                                            (_b = input.assertOwnerReleased) === null || _b === void 0 ? void 0 : _b.call(input, id);
                                        }
                                        desired.clear();
                                        return [7 /*endfinally*/];
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    return {
        previous: previous,
        reconcileDesired: reconcileDesired,
        load: load,
        unload: unload,
        reload: reload,
        close: close,
        whenIdle: function () { return lifecycleQueue; },
    };
}
function hasLiveDependencies(registry, manifest) {
    if (!manifest || manifest.apiVersion !== 2)
        return true;
    var mounted = registry.list();
    var available = mounted.filter(function (candidate) {
        var _a;
        var status = (_a = registry.status(candidate.id)) === null || _a === void 0 ? void 0 : _a.status;
        return status === "active" || status === "pending";
    });
    var resolution = (0, dependencies_1.resolvePluginDependencies)([manifest], available, mounted);
    return resolution.denied.length === 0 && resolution.pending.length === 0;
}
function settingsFingerprint(value) {
    if (value === undefined)
        return "null";
    if (Array.isArray(value))
        return "[".concat(value.map(settingsFingerprint).join(","), "]");
    if (value && typeof value === "object")
        return "{".concat(Object.entries(value)
            .sort(function (_a, _b) {
            var left = _a[0];
            var right = _b[0];
            return left.localeCompare(right);
        })
            .map(function (_a) {
            var key = _a[0], child = _a[1];
            return "".concat(JSON.stringify(key), ":").concat(settingsFingerprint(child));
        })
            .join(","), "}");
    return JSON.stringify(value);
}
