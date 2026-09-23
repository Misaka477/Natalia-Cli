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
exports.activatePlugin = activatePlugin;
function activatePlugin(state, entry) {
    return __awaiter(this, void 0, void 0, function () {
        function namedRegistry(point, kind) {
            return {
                register: function (contribution) {
                    var _a;
                    state.assertCapability(manifest, point);
                    if (!contribution.name)
                        throw new Error("plugin ".concat(manifest.id, " contributed unnamed ").concat(kind));
                    var dispose = state.once((_a = contributionOwner === null || contributionOwner === void 0 ? void 0 : contributionOwner.contribute(kind, contribution.name, contribution)) !== null && _a !== void 0 ? _a : (function () { return undefined; }));
                    disposers.push(dispose);
                    return dispose;
                },
            };
        }
        var plugin, manifest, snapshot, listeners, commands, providedServices, disposers, abort, effects, listenerSequence, contributionOwner, error_1, ownedDisposer, api, missing, error_2, _a;
        var _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    plugin = entry.plugin;
                    manifest = plugin.manifest;
                    snapshot = state.serviceSnapshot(manifest);
                    entry.missingServices = snapshot.missingServices;
                    if (snapshot.missingServices.length) {
                        entry.status = "pending";
                        entry.error = undefined;
                        return [2 /*return*/];
                    }
                    if (entry.status === "failed" &&
                        state.sameProviders(entry.lastAttemptedProviders, snapshot.providers))
                        return [2 /*return*/];
                    entry.status = "activating";
                    entry.error = undefined;
                    entry.lastAttemptedProviders = snapshot.providers;
                    listeners = new Set();
                    commands = new Map();
                    providedServices = new Map();
                    disposers = [];
                    abort = new AbortController();
                    effects = new Set();
                    listenerSequence = 0;
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, ((_c = (_b = state.input).registerOwner) === null || _c === void 0 ? void 0 : _c.call(_b, manifest))];
                case 2:
                    contributionOwner = _g.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _g.sent();
                    entry.status = "failed";
                    entry.error = error_1 instanceof Error ? error_1.message : String(error_1);
                    state.writeAudit(manifest.id, "failed", entry.error);
                    throw error_1;
                case 4:
                    ownedDisposer = function () {
                        var releases = [];
                        for (var _i = 0; _i < arguments.length; _i++) {
                            releases[_i] = arguments[_i];
                        }
                        return state.once(function () {
                            var errors = state.cleanup(releases);
                            if (errors[0] !== undefined)
                                throw errors[0];
                        });
                    };
                    api = __assign({ config: entry.config, tools: {
                            register: function (tool) {
                                state.assertCapability(manifest, "tools");
                                var name = tool.name;
                                var ownedTool = __assign(__assign({}, tool), { name: name, requiresApproval: tool.requiresApproval });
                                if (state.input.tools.get(name) !== undefined)
                                    throw new Error("plugin tool already registered: ".concat(name));
                                var releaseKernel = contributionOwner === null || contributionOwner === void 0 ? void 0 : contributionOwner.contribute("tools", name, ownedTool);
                                state.input.tools.set(name, ownedTool);
                                var dispose = ownedDisposer.apply(void 0, __spreadArray(__spreadArray([], (releaseKernel ? [releaseKernel] : []), false), [function () {
                                        if (state.input.tools.get(name) === ownedTool)
                                            state.input.tools.delete(name);
                                    }], false));
                                disposers.push(dispose);
                                return dispose;
                            },
                            registerAlias: function (alias, target) {
                                state.assertCapability(manifest, "tools");
                                var dispose = state.once(state.input.tools.addAlias(alias, target));
                                disposers.push(dispose);
                                return dispose;
                            },
                        }, services: {
                            provide: function (name, value) {
                                var _a;
                                if (!manifest.provides.includes(name))
                                    throw new Error("plugin ".concat(manifest.id, " provided undeclared service: ").concat(name));
                                state.assertCapability(manifest, "services");
                                var releaseKernel = contributionOwner === null || contributionOwner === void 0 ? void 0 : contributionOwner.contribute("services", name, value);
                                providedServices.set(name, ((_a = providedServices.get(name)) !== null && _a !== void 0 ? _a : 0) + 1);
                                var dispose = ownedDisposer.apply(void 0, __spreadArray(__spreadArray([], (releaseKernel ? [releaseKernel] : []), false), [function () {
                                        var _a;
                                        var remaining = ((_a = providedServices.get(name)) !== null && _a !== void 0 ? _a : 1) - 1;
                                        if (remaining > 0)
                                            providedServices.set(name, remaining);
                                        else
                                            providedServices.delete(name);
                                    }], false));
                                disposers.push(dispose);
                                return dispose;
                            },
                            get: function (name) { var _a, _b; return (_b = (_a = state.input).service) === null || _b === void 0 ? void 0 : _b.call(_a, name); },
                            on: function (name, listener) {
                                var _a, _b;
                                var unsubscribe = (_b = (_a = state.input).onServiceUpdate) === null || _b === void 0 ? void 0 : _b.call(_a, function (update) {
                                    var _a, _b;
                                    if (update.name === name)
                                        listener((_b = (_a = state.input).service) === null || _b === void 0 ? void 0 : _b.call(_a, name));
                                });
                                var dispose = state.once(unsubscribe !== null && unsubscribe !== void 0 ? unsubscribe : (function () { return undefined; }));
                                disposers.push(dispose);
                                return dispose;
                            },
                        }, events: {
                            on: function (typeOrListener, typedListener) {
                                state.assertCapability(manifest, "events");
                                var listener = typeof typeOrListener === "function"
                                    ? typeOrListener
                                    : function (event) {
                                        if (event &&
                                            typeof event === "object" &&
                                            "type" in event &&
                                            event.type === typeOrListener)
                                            typedListener === null || typedListener === void 0 ? void 0 : typedListener(event);
                                    };
                                var name = "".concat(manifest.id, ":listener:").concat(++listenerSequence);
                                var releaseKernel = contributionOwner === null || contributionOwner === void 0 ? void 0 : contributionOwner.contribute("listeners", name, listener);
                                listeners.add(listener);
                                var dispose = ownedDisposer.apply(void 0, __spreadArray(__spreadArray([], (releaseKernel ? [releaseKernel] : []), false), [function () { return listeners.delete(listener); }], false));
                                disposers.push(dispose);
                                return dispose;
                            },
                        }, commands: {
                            register: function (command) {
                                var _a;
                                state.assertCapability(manifest, "commands");
                                var name = command.name;
                                if (state.commandOwners.has(name))
                                    throw new Error("plugin command already registered: ".concat(name));
                                var ownedCommand = __assign(__assign({}, command), { name: name, category: (_a = command.category) !== null && _a !== void 0 ? _a : manifest.name });
                                var releaseKernel = contributionOwner === null || contributionOwner === void 0 ? void 0 : contributionOwner.contribute("commands", name, ownedCommand);
                                commands.set(name, ownedCommand);
                                state.commandOwners.set(name, manifest.id);
                                var dispose = ownedDisposer.apply(void 0, __spreadArray(__spreadArray([], (releaseKernel ? [releaseKernel] : []), false), [function () {
                                        commands.delete(name);
                                        state.commandOwners.delete(name);
                                    }], false));
                                disposers.push(dispose);
                                return dispose;
                            },
                        }, resources: namedRegistry("resources", "resources"), projections: namedRegistry("projections", "projections"), workflows: namedRegistry("workflows", "workflows"), settingsSchema: namedRegistry("settingsSchema", "settingsSchema"), adapters: (function () {
                            var registry = namedRegistry("adapters", "adapters");
                            registry.registerUi = function (contribution) {
                                return registry.register({
                                    name: contribution.kind,
                                    adapterType: "ui",
                                    create: function (input) {
                                        return __awaiter(this, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: return [4 /*yield*/, contribution.mount(input)];
                                                    case 1:
                                                        _a.sent();
                                                        return [2 /*return*/, { dispose: contribution.dispose }];
                                                }
                                            });
                                        });
                                    },
                                });
                            };
                            return registry;
                        })(), scheduler: {
                            add: namedRegistry("schedulerJobs", "schedulerJobs").register,
                        }, effects: {
                            signal: abort.signal,
                            run: function (effect) {
                                if (abort.signal.aborted)
                                    return Promise.reject(new Error("plugin is unloading: ".concat(manifest.id)));
                                var task = Promise.resolve().then(function () { return effect(abort.signal); });
                                effects.add(task);
                                void task.finally(function () { return effects.delete(task); }).catch(function () { return undefined; });
                                return task;
                            },
                        } }, (state.input.runtimeConfig
                        ? { runtimeConfig: state.input.runtimeConfig }
                        : {}));
                    _g.label = 5;
                case 5:
                    _g.trys.push([5, 7, , 13]);
                    return [4 /*yield*/, plugin.setup(api)];
                case 6:
                    _g.sent();
                    missing = manifest.provides.filter(function (name) { return !providedServices.has(name); });
                    if (missing.length)
                        throw new Error("plugin ".concat(manifest.id, " did not provide declared services: ").concat(missing.join(", ")));
                    return [3 /*break*/, 13];
                case 7:
                    error_2 = _g.sent();
                    _g.label = 8;
                case 8:
                    _g.trys.push([8, 10, , 11]);
                    return [4 /*yield*/, ((_d = plugin.dispose) === null || _d === void 0 ? void 0 : _d.call(plugin))];
                case 9:
                    _g.sent();
                    return [3 /*break*/, 11];
                case 10:
                    _a = _g.sent();
                    return [3 /*break*/, 11];
                case 11:
                    abort.abort();
                    return [4 /*yield*/, Promise.allSettled(effects)];
                case 12:
                    _g.sent();
                    state.cleanup(disposers);
                    try {
                        contributionOwner === null || contributionOwner === void 0 ? void 0 : contributionOwner.release();
                    }
                    catch (_h) {
                        // best-effort release during rollback
                    }
                    entry.epoch = undefined;
                    entry.status = "failed";
                    entry.error = error_2 instanceof Error ? error_2.message : String(error_2);
                    state.writeAudit(manifest.id, "failed", entry.error);
                    throw error_2;
                case 13:
                    entry.epoch = {
                        listeners: listeners,
                        commands: commands,
                        dispose: disposers,
                        abort: abort,
                        effects: effects,
                        contributionOwner: contributionOwner,
                    };
                    entry.requiredProviders = snapshot.providers;
                    entry.status = "active";
                    (_f = (_e = state.input).onChange) === null || _f === void 0 ? void 0 : _f.call(_e);
                    return [2 /*return*/];
            }
        });
    });
}
