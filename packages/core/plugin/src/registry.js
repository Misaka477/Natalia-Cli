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
exports.createPluginRegistry = createPluginRegistry;
var dependencies_1 = require("./dependencies");
var manifest_1 = require("./manifest");
var config_1 = require("./config");
var registry_activation_1 = require("./registry-activation");
function createPluginRegistry(input) {
    var _this = this;
    var _a;
    var plugins = new Map();
    var audit = [];
    var commandOwners = new Map();
    var cleanup = function (disposers) {
        var errors = [];
        for (var _i = 0, _a = __spreadArray([], disposers, true).reverse(); _i < _a.length; _i++) {
            var dispose = _a[_i];
            try {
                dispose();
            }
            catch (error) {
                errors.push(error);
            }
        }
        return errors;
    };
    var once = function (dispose) {
        var active = true;
        return function () {
            if (!active)
                return;
            active = false;
            dispose();
        };
    };
    var serviceSnapshot = function (manifest) {
        var _a, _b, _c;
        var missingServices = [];
        var providers = new Map();
        for (var _i = 0, _d = manifest.requires; _i < _d.length; _i++) {
            var name_1 = _d[_i];
            var value = (_a = input.service) === null || _a === void 0 ? void 0 : _a.call(input, name_1);
            if (value === undefined)
                missingServices.push(name_1);
            else
                providers.set(name_1, (_c = (_b = input.serviceProvider) === null || _b === void 0 ? void 0 : _b.call(input, name_1)) !== null && _c !== void 0 ? _c : value);
        }
        return { missingServices: missingServices, providers: providers };
    };
    var sameProviders = function (left, right) {
        return left.size === right.size &&
            __spreadArray([], left, true).every(function (_a) {
                var name = _a[0], provider = _a[1];
                return Object.is(provider, right.get(name));
            });
    };
    var writeAudit = function (pluginID, action, detail) {
        var _a;
        var entry = { pluginID: pluginID, action: action, detail: detail, timestamp: Date.now() };
        audit.push(entry);
        try {
            (_a = input.onAudit) === null || _a === void 0 ? void 0 : _a.call(input, entry);
        }
        catch (_b) {
            // an audit observer must not break the audit trail
        }
    };
    var state = {
        input: input,
        commandOwners: commandOwners,
        cleanup: cleanup,
        once: once,
        serviceSnapshot: serviceSnapshot,
        sameProviders: sameProviders,
        writeAudit: writeAudit,
        assertCapability: function (manifest, capability) {
            if (!(0, manifest_1.manifestIntegrationPoints)(manifest).includes(capability)) {
                writeAudit(manifest.id, "denied", capability);
                throw new Error("plugin capability denied: ".concat(manifest.id, "/").concat(capability));
            }
        },
    };
    var transitionQueue = Promise.resolve();
    var enqueueTransition = function (transition) {
        var result = transitionQueue.then(transition, transition);
        transitionQueue = result.then(function () { return undefined; }, function () { return undefined; });
        return result;
    };
    function deactivate(entry) {
        return __awaiter(this, void 0, void 0, function () {
            var epoch, errors, error_1;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        epoch = entry.epoch;
                        if (!epoch) {
                            entry.status = "pending";
                            return [2 /*return*/, []];
                        }
                        entry.status = "deactivating";
                        errors = [];
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, ((_b = (_a = entry.plugin).dispose) === null || _b === void 0 ? void 0 : _b.call(_a))];
                    case 2:
                        _e.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_1 = _e.sent();
                        errors.push(error_1);
                        return [3 /*break*/, 4];
                    case 4:
                        epoch.abort.abort();
                        return [4 /*yield*/, Promise.allSettled(epoch.effects)];
                    case 5:
                        _e.sent();
                        errors.push.apply(errors, cleanup(epoch.dispose));
                        try {
                            (_c = epoch.contributionOwner) === null || _c === void 0 ? void 0 : _c.release();
                        }
                        catch (error) {
                            errors.push(error);
                        }
                        entry.epoch = undefined;
                        entry.requiredProviders.clear();
                        entry.status = "pending";
                        (_d = input.onChange) === null || _d === void 0 ? void 0 : _d.call(input);
                        return [2 /*return*/, errors];
                }
            });
        });
    }
    function reconcileEntry(entry) {
        return __awaiter(this, void 0, void 0, function () {
            var snapshot;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        snapshot = serviceSnapshot(entry.plugin.manifest);
                        entry.missingServices = snapshot.missingServices;
                        if (!(entry.status === "active" &&
                            (snapshot.missingServices.length ||
                                !sameProviders(entry.requiredProviders, snapshot.providers)))) return [3 /*break*/, 2];
                        return [4 /*yield*/, deactivate(entry)];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2:
                        if (!(!snapshot.missingServices.length &&
                            (entry.status === "pending" || entry.status === "failed"))) return [3 /*break*/, 4];
                        return [4 /*yield*/, (0, registry_activation_1.activatePlugin)(state, entry)];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function loadPlugin(plugin, config) {
        return __awaiter(this, void 0, void 0, function () {
            var manifest, mounted, resolution, unresolved, resolvedConfig, snapshot, entry, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        manifest = manifest_1.pluginManifestSchema.parse(plugin.manifest);
                        if (plugins.has(manifest.id))
                            throw new Error("plugin already loaded: ".concat(manifest.id));
                        if (manifest.apiVersion === 2) {
                            mounted = __spreadArray([], plugins.values(), true);
                            resolution = (0, dependencies_1.resolvePluginDependencies)([manifest], mounted
                                .filter(function (entry) { return entry.status === "active" || entry.status === "pending"; })
                                .map(function (entry) { return entry.plugin.manifest; }), mounted.map(function (entry) { return entry.plugin.manifest; }));
                            unresolved = __spreadArray(__spreadArray([], resolution.denied, true), resolution.pending, true)[0];
                            if (unresolved) {
                                writeAudit(manifest.id, resolution.denied.length ? "denied" : "failed", unresolved.reason);
                                throw new Error("plugin dependency unresolved: ".concat(manifest.id, ": ").concat(unresolved.reason));
                            }
                        }
                        try {
                            resolvedConfig = (0, config_1.resolvePluginConfig)(__assign(__assign({}, plugin), { manifest: manifest }), config);
                        }
                        catch (error) {
                            writeAudit(manifest.id, "failed", error instanceof Error ? error.message : String(error));
                            throw error;
                        }
                        snapshot = serviceSnapshot(manifest);
                        entry = {
                            plugin: __assign(__assign({}, plugin), { manifest: manifest }),
                            config: resolvedConfig,
                            status: "pending",
                            missingServices: snapshot.missingServices,
                            requiredProviders: new Map(),
                            lastAttemptedProviders: new Map(),
                        };
                        plugins.set(manifest.id, entry);
                        writeAudit(manifest.id, "loaded");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, enqueueTransition(function () { return reconcileEntry(entry); })];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        error_2 = _a.sent();
                        if (entry.status !== "failed")
                            plugins.delete(manifest.id);
                        throw error_2;
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function unloadOne(id) {
        return __awaiter(this, void 0, void 0, function () {
            var entry, errors, error;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        entry = plugins.get(id);
                        if (!entry)
                            throw new Error("plugin not found: ".concat(id));
                        return [4 /*yield*/, deactivate(entry)];
                    case 1:
                        errors = _a.sent();
                        plugins.delete(id);
                        error = errors[0];
                        writeAudit(id, error === undefined ? "unloaded" : "failed", error instanceof Error
                            ? error.message
                            : error === undefined
                                ? undefined
                                : String(error));
                        if (error !== undefined)
                            throw error;
                        return [2 /*return*/];
                }
            });
        });
    }
    function dependentOrder(id) {
        var order = [];
        var visited = new Set();
        var visit = function (dependencyID) {
            for (var _i = 0, _a = __spreadArray([], plugins, true).reverse(); _i < _a.length; _i++) {
                var _b = _a[_i], candidateID = _b[0], entry = _b[1];
                if (visited.has(candidateID))
                    continue;
                var manifest = entry.plugin.manifest;
                if (manifest.apiVersion !== 2 ||
                    !manifest.dependencies.some(function (dependency) {
                        return !dependency.optional && dependency.id === dependencyID;
                    }))
                    continue;
                visited.add(candidateID);
                visit(candidateID);
                order.push(candidateID);
            }
        };
        visit(id);
        return order;
    }
    function unloadMany(ids) {
        return __awaiter(this, void 0, void 0, function () {
            var errors, _i, ids_1, id, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        errors = [];
                        _i = 0, ids_1 = ids;
                        _a.label = 1;
                    case 1:
                        if (!(_i < ids_1.length)) return [3 /*break*/, 6];
                        id = ids_1[_i];
                        if (!plugins.has(id)) return [3 /*break*/, 5];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, unloadOne(id)];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        error_3 = _a.sent();
                        errors.push(error_3);
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6:
                        if (errors.length === 1)
                            throw errors[0];
                        if (errors.length > 1)
                            throw new AggregateError(errors, "multiple plugins failed to unload");
                        return [2 /*return*/];
                }
            });
        });
    }
    var unsubscribeServices = (_a = input.onServiceUpdate) === null || _a === void 0 ? void 0 : _a.call(input, function (update) {
        void enqueueTransition(function () { return __awaiter(_this, void 0, void 0, function () {
            var _i, _a, entry, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _i = 0, _a = plugins.values();
                        _c.label = 1;
                    case 1:
                        if (!(_i < _a.length)) return [3 /*break*/, 6];
                        entry = _a[_i];
                        if (!entry.plugin.manifest.requires.includes(update.name)) return [3 /*break*/, 5];
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, reconcileEntry(entry)];
                    case 3:
                        _c.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _b = _c.sent();
                        return [3 /*break*/, 5];
                    case 5:
                        _i++;
                        return [3 /*break*/, 1];
                    case 6: return [2 /*return*/];
                }
            });
        }); });
    });
    return {
        load: function (plugin, config) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, loadPlugin(plugin, config)];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        unload: function (id) {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (!plugins.has(id))
                                throw new Error("plugin not found: ".concat(id));
                            return [4 /*yield*/, enqueueTransition(function () { return unloadMany(__spreadArray(__spreadArray([], dependentOrder(id), true), [id], false)); })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        unloadAll: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, enqueueTransition(function () { return unloadMany(__spreadArray([], plugins.keys(), true).reverse()); })];
                        case 1:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        close: function () {
            return __awaiter(this, void 0, void 0, function () {
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, enqueueTransition(function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            _a.trys.push([0, , 2, 3]);
                                            return [4 /*yield*/, unloadMany(__spreadArray([], plugins.keys(), true).reverse())];
                                        case 1:
                                            _a.sent();
                                            return [3 /*break*/, 3];
                                        case 2:
                                            unsubscribeServices === null || unsubscribeServices === void 0 ? void 0 : unsubscribeServices();
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
        },
        dispatch: function (event) {
            var _a, _b;
            for (var _i = 0, _c = plugins.values(); _i < _c.length; _i++) {
                var entry = _c[_i];
                for (var _d = 0, _e = (_b = (_a = entry.epoch) === null || _a === void 0 ? void 0 : _a.listeners) !== null && _b !== void 0 ? _b : []; _d < _e.length; _d++) {
                    var listener = _e[_d];
                    try {
                        listener(event);
                    }
                    catch (_f) {
                        // one listener must not break event delivery
                    }
                }
            }
        },
        list: function () { return __spreadArray([], plugins.values(), true).map(function (entry) { return entry.plugin.manifest; }); },
        status: function (id) {
            var entry = plugins.get(id);
            if (!entry)
                return undefined;
            return __assign({ id: id, status: entry.status, missingServices: __spreadArray([], entry.missingServices, true) }, (entry.error ? { error: entry.error } : {}));
        },
        active: function (id) { var _a; return ((_a = plugins.get(id)) === null || _a === void 0 ? void 0 : _a.status) === "active"; },
        whenIdle: function () { return transitionQueue; },
        commands: function () {
            return __spreadArray([], plugins.values(), true).flatMap(function (entry) {
                var _a, _b;
                return __spreadArray([], ((_b = (_a = entry.epoch) === null || _a === void 0 ? void 0 : _a.commands.values()) !== null && _b !== void 0 ? _b : []), true);
            });
        },
        audit: function () { return __spreadArray([], audit, true); },
    };
}
