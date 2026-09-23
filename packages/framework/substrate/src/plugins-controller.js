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
exports.createPluginsController = createPluginsController;
var plugin_1 = require("@natalia/plugin");
var runtime_services_1 = require("@natalia/runtime-services");
var plugin_discovery_1 = require("./plugin-discovery");
var plugin_owner_1 = require("./plugin-owner");
var projection_contributions_1 = require("./projection-contributions");
var HOST_INPUT_SERVICES = new Set([
    runtime_services_1.localToolsInput.id,
    runtime_services_1.mcpInput.id,
    runtime_services_1.skillsInput.id,
    runtime_services_1.terminalInput.id,
]);
function createPluginsController(input) {
    var registry;
    var controller;
    var lastCatalog = [];
    var closed = false;
    var hostInputGeneration = 0;
    function init() {
        closed = false;
        registry = (0, plugin_1.createPluginRegistry)({
            tools: input.tools,
            onAudit: function (entry) {
                input.publish({
                    type: "plugin.update",
                    id: entry.pluginID,
                    status: entry.action,
                    detail: entry.detail,
                });
                publishProjectionSnapshot();
            },
            registerOwner: function (manifest) {
                return (0, plugin_owner_1.registerPluginOwner)(manifest, input.capabilityRegistry);
            },
            runtimeConfig: function () { return input.capabilityRegistry.service("runtime.config"); },
            service: function (name) { return input.capabilityRegistry.service(name); },
            serviceProvider: function (name) {
                return input.capabilityRegistry.ownerOf("services", name);
            },
            onServiceUpdate: function (listener) {
                return input.capabilityRegistry.onServiceUpdate(listener);
            },
        });
        controller = (0, plugin_1.createDesiredPluginController)({
            registry: registry,
            assertOwnerReleased: function (id) {
                if (input.capabilityRegistry.has(id))
                    throw new Error("plugin ".concat(id, " unloaded without releasing its capability owner"));
            },
            onError: publishPluginError,
        });
    }
    function reconcileDesired(injectedEntries, config) {
        return __awaiter(this, void 0, void 0, function () {
            var snapshot, current, inputGeneration;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        snapshot = structuredClone(config);
                        current = getController();
                        inputGeneration = ++hostInputGeneration;
                        return [4 /*yield*/, current.reconcileDesired(function () { return __awaiter(_this, void 0, void 0, function () {
                                var users, entries, catalog;
                                var _a, _b, _c;
                                return __generator(this, function (_d) {
                                    switch (_d.label) {
                                        case 0: return [4 /*yield*/, ((_a = input.discoverDesiredEntries) !== null && _a !== void 0 ? _a : plugin_discovery_1.discoverDesiredPluginEntries)({
                                                pluginStoreRoot: input.pluginStoreRoot,
                                                workspaceRoot: input.workspaceRoot,
                                                paths: (_b = snapshot.paths) !== null && _b !== void 0 ? _b : [],
                                                packages: (_c = snapshot.packages) !== null && _c !== void 0 ? _c : {},
                                                enabled: snapshot.enabled,
                                                declaredIDs: injectedEntries.map(function (entry) { return entry.id; }),
                                                onError: publishLoadError,
                                            })];
                                        case 1:
                                            users = _d.sent();
                                            entries = __spreadArray(__spreadArray([], injectedEntries, true), users, true).map(function (entry) {
                                                var _a;
                                                return ((_a = entry.manifest) === null || _a === void 0 ? void 0 : _a.requires.some(function (name) { return HOST_INPUT_SERVICES.has(name); }))
                                                    ? __assign(__assign({}, entry), { fingerprint: "".concat(entry.fingerprint, ":host-input:").concat(inputGeneration) }) : entry;
                                            });
                                            return [4 /*yield*/, (0, plugin_1.resolveDesiredPluginCatalog)({
                                                    entries: entries,
                                                    previous: current.previous,
                                                    onError: publishLoadError,
                                                })];
                                        case 2:
                                            catalog = _d.sent();
                                            // The resolved catalog is the runtime's plugin composition: the
                                            // generation record snapshots it by identity and fingerprint.
                                            lastCatalog = catalog.entries;
                                            return [2 /*return*/, catalog];
                                    }
                                });
                            }); }, snapshot.settings)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    }
    function publishProjectionSnapshot() {
        input.publish({
            type: "projections.updated",
            contributions: (0, projection_contributions_1.snapshotProjectionContributions)(input.capabilityRegistry),
        });
    }
    function publishLoadError(id, error) {
        publishPluginError(id, "load", error);
    }
    function publishPluginError(id, action, error) {
        input.publish({
            type: "diagnostic",
            level: "warning",
            owner: id,
            message: "plugin ".concat(id, " ").concat(action, " failed: ").concat(error instanceof Error ? error.message : String(error)),
        });
    }
    function getController() {
        if (!controller)
            throw new Error("plugins are not enabled in this runtime");
        return controller;
    }
    function get() {
        if (!registry)
            throw new Error("plugins are not enabled in this runtime");
        return registry;
    }
    function list() {
        var _a;
        return (_a = registry === null || registry === void 0 ? void 0 : registry.list()) !== null && _a !== void 0 ? _a : [];
    }
    function close() {
        return __awaiter(this, void 0, void 0, function () {
            var current, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (closed)
                            return [2 /*return*/];
                        current = controller;
                        if (!current)
                            return [2 /*return*/];
                        closed = true;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, current.close()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 5];
                    case 3:
                        error_1 = _a.sent();
                        publishPluginError("plugins", "cleanup/close", error_1);
                        return [3 /*break*/, 5];
                    case 4:
                        registry = undefined;
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        });
    }
    return {
        init: init,
        reconcileDesired: reconcileDesired,
        catalog: function () {
            return lastCatalog.map(function (_a) {
                var id = _a.id, enabled = _a.enabled, fingerprint = _a.fingerprint;
                return ({
                    id: id,
                    enabled: enabled,
                    fingerprint: fingerprint,
                });
            });
        },
        get: get,
        list: list,
        status: function (id) { return registry === null || registry === void 0 ? void 0 : registry.status(id); },
        active: function (id) { var _a; return (_a = registry === null || registry === void 0 ? void 0 : registry.active(id)) !== null && _a !== void 0 ? _a : false; },
        load: function (entry, settings) {
            return getController().load(entry, settings);
        },
        unload: function (id) {
            return controller
                ? controller.unload(id)
                : Promise.resolve({ unloaded: true });
        },
        reload: function (id) { return getController().reload(id); },
        close: close,
        dispatch: function (event) { return registry === null || registry === void 0 ? void 0 : registry.dispatch(event); },
    };
}
