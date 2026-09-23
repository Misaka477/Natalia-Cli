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
exports.createPluginRuntime = createPluginRuntime;
var installer_1 = require("@natalia/installer");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
function installOfficialLocal(pluginStoreRoot, official) {
    return __awaiter(this, void 0, void 0, function () {
        var distributionRoot, sourceDir, packagesDir, packageRoot, lock;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    distributionRoot = (0, node_path_1.resolve)(pluginStoreRoot, "..", "plugins");
                    sourceDir = (0, node_path_1.resolve)(distributionRoot, official.directory);
                    packagesDir = (0, node_path_1.resolve)(pluginStoreRoot, "node_modules");
                    packageRoot = node_path_1.resolve.apply(void 0, __spreadArray([packagesDir], official.packageName.split("/"), false));
                    return [4 /*yield*/, (0, promises_1.mkdir)(packagesDir, { recursive: true })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.rm)(packageRoot, { recursive: true, force: true })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.cp)(sourceDir, packageRoot, { recursive: true })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, installer_1.loadNataliaLock)(pluginStoreRoot)];
                case 4:
                    lock = _a.sent();
                    lock.plugins[official.id] = {
                        packageName: official.packageName,
                        manifest: (0, node_path_1.resolve)(packageRoot, "natalia.plugin.json"),
                        metadata: {
                            id: official.id,
                            source: {
                                type: "path",
                                path: sourceDir,
                            },
                            resolvedVersion: "1.0.0",
                            scope: "session",
                            dependencies: [],
                        },
                    };
                    return [4 /*yield*/, (0, installer_1.saveNataliaLock)(pluginStoreRoot, lock)];
                case 5:
                    _a.sent();
                    return [2 /*return*/, {
                            installed: true,
                            pluginID: official.id,
                            packageName: official.packageName,
                        }];
            }
        });
    });
}
function createPluginRuntime(ctx, seams) {
    function requirePluginStore() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (!ctx.state.pluginStoreRoot)
                    throw new Error("plugin store is not configured for this runtime");
                return [2 /*return*/, ctx.state.pluginStoreRoot];
            });
        });
    }
    // Every plugin mutation reconciles the live plugin set on a config reload.
    // Refuse while a turn is running or an approval/question is pending so the
    // reload cannot tear a plugin out from under a live execution — and, for
    // uninstall, so files are never deleted for a reload that then gets blocked.
    function assertPluginMutationAllowed() {
        var _a, _b;
        var blocked = (_b = (_a = ctx.ports).configReloadBlockedReason) === null || _b === void 0 ? void 0 : _b.call(_a);
        if (blocked)
            throw new Error(blocked);
    }
    return {
        pluginCatalog: function () {
            return __awaiter(this, void 0, void 0, function () {
                var pluginStoreRoot;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, requirePluginStore()];
                        case 1:
                            pluginStoreRoot = _a.sent();
                            return [4 /*yield*/, (0, installer_1.listInstalledPlugins)({
                                    pluginStoreRoot: pluginStoreRoot,
                                    workspaceRoot: ctx.ports.getWorkspaceRoot(),
                                })];
                        case 2: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        pluginInstall: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var pluginStoreRoot, official, result, _a;
                var _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, requirePluginStore()];
                        case 1:
                            pluginStoreRoot = _d.sent();
                            assertPluginMutationAllowed();
                            official = installer_1.OFFICIAL_PLUGIN_PACKAGES.find(function (plugin) { return plugin.packageName === input.spec; });
                            if (!official) return [3 /*break*/, 3];
                            return [4 /*yield*/, installOfficialLocal(pluginStoreRoot, official)];
                        case 2:
                            _a = _d.sent();
                            return [3 /*break*/, 5];
                        case 3: return [4 /*yield*/, (0, installer_1.installPlugin)({
                                pluginStoreRoot: pluginStoreRoot,
                                spec: input.spec,
                                workspaceRoot: ctx.ports.getWorkspaceRoot(),
                                runPackageManager: seams === null || seams === void 0 ? void 0 : seams.runPackageManager,
                            })];
                        case 4:
                            _a = _d.sent();
                            _d.label = 5;
                        case 5:
                            result = _a;
                            return [4 /*yield*/, ((_c = (_b = ctx.ports).reloadConfigFromDisk) === null || _c === void 0 ? void 0 : _c.call(_b))];
                        case 6:
                            _d.sent();
                            return [2 /*return*/, result];
                    }
                });
            });
        },
        pluginUninstall: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var pluginStoreRoot, result, reload;
                var _a, _b, _c;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0: return [4 /*yield*/, requirePluginStore()];
                        case 1:
                            pluginStoreRoot = _d.sent();
                            // Uninstall is a delete-then-reload transaction: `uninstallPlugin`
                            // removes the package and its lock entry, and only the subsequent config
                            // reload actually unloads the plugin from the runtime. Refuse while a
                            // turn is running or an approval/question is pending — otherwise the
                            // reload is blocked and the files are already gone, leaving a plugin
                            // running in memory with no package on disk (audit finding B-01).
                            assertPluginMutationAllowed();
                            return [4 /*yield*/, (0, installer_1.uninstallPlugin)({
                                    pluginStoreRoot: pluginStoreRoot,
                                    pluginID: input.pluginID,
                                    runPackageManager: seams === null || seams === void 0 ? void 0 : seams.runPackageManager,
                                })];
                        case 2:
                            result = _d.sent();
                            return [4 /*yield*/, ((_b = (_a = ctx.ports).applyConfigFromDisk) === null || _b === void 0 ? void 0 : _b.call(_a))];
                        case 3:
                            reload = _d.sent();
                            if (reload && !reload.applied) {
                                throw new Error((_c = reload.reason) !== null && _c !== void 0 ? _c : "plugin ".concat(input.pluginID, " was removed from disk but the runtime did not unload it"));
                            }
                            return [2 /*return*/, result];
                    }
                });
            });
        },
        pluginSetEnabled: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var pluginStoreRoot, result;
                var _this = this;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, requirePluginStore()];
                        case 1:
                            pluginStoreRoot = _a.sent();
                            assertPluginMutationAllowed();
                            return [4 /*yield*/, (0, installer_1.setPluginEnabled)({
                                    pluginStoreRoot: pluginStoreRoot,
                                    workspaceRoot: ctx.ports.getWorkspaceRoot(),
                                    pluginID: input.pluginID,
                                    enabled: input.enabled,
                                    apply: function () { return __awaiter(_this, void 0, void 0, function () {
                                        var _a, _b;
                                        return __generator(this, function (_c) {
                                            switch (_c.label) {
                                                case 0: return [4 /*yield*/, ((_b = (_a = ctx.ports).reloadConfigFromDisk) === null || _b === void 0 ? void 0 : _b.call(_a))];
                                                case 1:
                                                    _c.sent();
                                                    return [2 /*return*/];
                                            }
                                        });
                                    }); },
                                })];
                        case 2:
                            result = _a.sent();
                            return [2 /*return*/, result];
                    }
                });
            });
        },
    };
}
