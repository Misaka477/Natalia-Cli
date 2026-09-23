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
exports.createUiAdapterHost = createUiAdapterHost;
/**
 * Generic process UI adapter host.
 *
 * One host path for every UI: it resolves the workspace config, discovers
 * enabled installed and path plugins through `discoverDesiredPluginEntries`,
 * loads only adapter-capable process plugins into one process registry,
 * and materializes the requested UI adapter kind(s) against one shared
 * `createUiAdapterMountInput(runtime)`. Closing is idempotent and fail-closed:
 * materializer, then registry/controller, then runtime.
 *
 * The TUI is a UI like any other and runs through this same host (as an extra
 * desired entry), which is why extra desired entries are accepted. The host
 * stays minimal: no private control channel, no UI feature knowledge.
 */
var capability_1 = require("@natalia/capability");
var config_1 = require("@natalia/config");
var plugin_1 = require("@natalia/plugin");
var tools_1 = require("@anthelia/tools");
var substrate_1 = require("@anthelia/substrate");
var substrate_2 = require("@anthelia/substrate");
function createUiAdapterHost(input) {
    return __awaiter(this, void 0, void 0, function () {
        function close() {
            return __awaiter(this, void 0, void 0, function () {
                var errors, error_2, error_3, error_4;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            if (closed)
                                return [2 /*return*/];
                            closed = true;
                            errors = [];
                            _c.label = 1;
                        case 1:
                            _c.trys.push([1, 3, , 4]);
                            return [4 /*yield*/, (materializer === null || materializer === void 0 ? void 0 : materializer.close())];
                        case 2:
                            _c.sent();
                            return [3 /*break*/, 4];
                        case 3:
                            error_2 = _c.sent();
                            errors.push(error_2);
                            return [3 /*break*/, 4];
                        case 4:
                            _c.trys.push([4, 6, , 7]);
                            return [4 /*yield*/, (controller === null || controller === void 0 ? void 0 : controller.close())];
                        case 5:
                            _c.sent();
                            return [3 /*break*/, 7];
                        case 6:
                            error_3 = _c.sent();
                            errors.push(error_3);
                            return [3 /*break*/, 7];
                        case 7:
                            _c.trys.push([7, 9, , 10]);
                            return [4 /*yield*/, ((_b = (_a = input.runtime).dispose) === null || _b === void 0 ? void 0 : _b.call(_a))];
                        case 8:
                            _c.sent();
                            return [3 /*break*/, 10];
                        case 9:
                            error_4 = _c.sent();
                            errors.push(error_4);
                            return [3 /*break*/, 10];
                        case 10:
                            if (errors.length)
                                throw new AggregateError(errors, "ui adapter host cleanup failed");
                            return [2 /*return*/];
                    }
                });
            });
        }
        var report, onError, kernel, controller, materializer, mountInput, instances, closed, resolved, plugins_1, registry, _i, _a, kind, _b, _c, error_1;
        var _this = this;
        var _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    report = (_d = input.report) !== null && _d !== void 0 ? _d : (function () { return undefined; });
                    onError = function (id, error) {
                        return report("plugin ".concat(id, " failed: ").concat(error instanceof Error ? error.message : String(error)));
                    };
                    instances = [];
                    closed = false;
                    _f.label = 1;
                case 1:
                    _f.trys.push([1, 8, , 10]);
                    return [4 /*yield*/, ((_e = input.resolve) !== null && _e !== void 0 ? _e : config_1.resolveConfig)(__assign({ workspaceRoot: input.workspaceRoot }, (input.configPath ? { globalPath: input.configPath } : {})))];
                case 2:
                    resolved = _f.sent();
                    plugins_1 = resolved.config.plugins;
                    kernel = new capability_1.CapabilityRegistry();
                    registry = (0, plugin_1.createPluginRegistry)({
                        tools: (0, tools_1.createToolRegistry)([]),
                        registerOwner: function (manifest) { return (0, substrate_2.registerPluginOwner)(manifest, kernel); },
                    });
                    controller = (0, plugin_1.createDesiredPluginController)({ registry: registry, onError: onError });
                    return [4 /*yield*/, controller.reconcileDesired(function () { return __awaiter(_this, void 0, void 0, function () {
                            var users, _a;
                            var _b, _c, _d;
                            return __generator(this, function (_e) {
                                switch (_e.label) {
                                    case 0:
                                        if (!input.pluginStoreRoot) return [3 /*break*/, 2];
                                        return [4 /*yield*/, ((_b = input.discover) !== null && _b !== void 0 ? _b : substrate_1.discoverDesiredPluginEntries)({
                                                pluginStoreRoot: input.pluginStoreRoot,
                                                packages: plugins_1.packages,
                                                enabled: plugins_1.enabled,
                                                declaredIDs: ((_c = input.extraEntries) !== null && _c !== void 0 ? _c : []).map(function (entry) { return entry.id; }),
                                                onError: onError,
                                            })];
                                    case 1:
                                        _a = _e.sent();
                                        return [3 /*break*/, 3];
                                    case 2:
                                        _a = [];
                                        _e.label = 3;
                                    case 3:
                                        users = _a;
                                        return [2 /*return*/, (0, plugin_1.resolveDesiredPluginCatalog)({
                                                entries: __spreadArray(__spreadArray([], ((_d = input.extraEntries) !== null && _d !== void 0 ? _d : []), true), users, true).filter(isAdapterProcessEntry),
                                                previous: controller.previous,
                                                onError: onError,
                                            })];
                                }
                            });
                        }); }, plugins_1.settings)];
                case 3:
                    _f.sent();
                    materializer = (0, plugin_1.createPluginAdapterMaterializer)(kernel);
                    if (!input.kinds.length) return [3 /*break*/, 7];
                    mountInput = (0, plugin_1.createUiAdapterMountInput)(input.runtime);
                    _i = 0, _a = input.kinds;
                    _f.label = 4;
                case 4:
                    if (!(_i < _a.length)) return [3 /*break*/, 7];
                    kind = _a[_i];
                    _c = (_b = instances).push;
                    return [4 /*yield*/, materializer.materialize(kind, mountInput)];
                case 5:
                    _c.apply(_b, [_f.sent()]);
                    _f.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 4];
                case 7: return [3 /*break*/, 10];
                case 8:
                    error_1 = _f.sent();
                    return [4 /*yield*/, close()];
                case 9:
                    _f.sent();
                    throw error_1;
                case 10: return [2 /*return*/, {
                        kinds: __spreadArray([], input.kinds, true),
                        mountInput: mountInput,
                        instances: instances,
                        availableKinds: function () {
                            return kernel.contributions("adapters").map(function (entry) { return entry.name; });
                        },
                        close: close,
                    }];
            }
        });
    });
}
function isAdapterProcessEntry(entry) {
    var manifest = entry.manifest;
    return (manifest !== undefined &&
        manifest.scope === "process" &&
        (0, plugin_1.manifestIntegrationPoints)(manifest).includes("adapters"));
}
