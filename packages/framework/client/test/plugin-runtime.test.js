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
var bun_test_1 = require("bun:test");
var node_fs_1 = require("node:fs");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var installer_1 = require("@natalia/installer");
var plugin_runtime_1 = require("../src/runtime/plugin-runtime");
var packageName = "@fixture/natalia-plugin";
var pluginID = "fixture.plugin";
function pluginModule(manifest) {
    return "export default { manifest: ".concat(JSON.stringify(manifest), ", setup() {} };");
}
function fixturePackageManager() {
    var _this = this;
    return function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
        var prefix, packageDir, manifest;
        var _c, _d;
        var args = _b.args;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    prefix = args[args.indexOf("--prefix") + 1];
                    packageDir = (0, node_path_1.join)(prefix, "node_modules", "@fixture", "natalia-plugin");
                    if (!(args[0] === "uninstall")) return [3 /*break*/, 2];
                    return [4 /*yield*/, (0, promises_1.rm)(packageDir, { recursive: true, force: true })];
                case 1:
                    _e.sent();
                    return [2 /*return*/];
                case 2: return [4 /*yield*/, (0, promises_1.mkdir)(packageDir, { recursive: true })];
                case 3:
                    _e.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(prefix, "package.json"), JSON.stringify({ dependencies: (_c = {}, _c[packageName] = "1.2.3", _c) }))];
                case 4:
                    _e.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(prefix, "package-lock.json"), JSON.stringify({
                            lockfileVersion: 3,
                            packages: (_d = {},
                                _d["node_modules/".concat(packageName)] = {
                                    version: "1.2.3",
                                    integrity: "sha512-fixture",
                                },
                                _d),
                        }))];
                case 5:
                    _e.sent();
                    manifest = {
                        apiVersion: 2,
                        id: pluginID,
                        version: "1.2.3",
                        name: "Fixture",
                        entry: "index.ts",
                        scope: "workspace",
                    };
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(packageDir, "natalia.plugin.json"), JSON.stringify(manifest))];
                case 6:
                    _e.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(packageDir, "index.ts"), pluginModule(manifest))];
                case 7:
                    _e.sent();
                    return [2 /*return*/];
            }
        });
    }); };
}
function harness() {
    return __awaiter(this, void 0, void 0, function () {
        var root, pluginStoreRoot, workspaceRoot, runPackageManager, blockedReason, reloadResult, applyCalls, ctx, runtime, packageDir;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugin-runtime-"))];
                case 1:
                    root = _a.sent();
                    pluginStoreRoot = (0, node_path_1.join)(root, "plugin-store");
                    workspaceRoot = (0, node_path_1.join)(root, "workspace");
                    return [4 /*yield*/, (0, promises_1.mkdir)(workspaceRoot, { recursive: true })];
                case 2:
                    _a.sent();
                    runPackageManager = fixturePackageManager();
                    return [4 /*yield*/, (0, installer_1.installPlugin)({
                            pluginStoreRoot: pluginStoreRoot,
                            spec: "".concat(packageName, "@1.2.3"),
                            runPackageManager: runPackageManager,
                        })];
                case 3:
                    _a.sent();
                    reloadResult = { applied: true };
                    applyCalls = 0;
                    ctx = {
                        state: { pluginStoreRoot: pluginStoreRoot },
                        ports: {
                            getWorkspaceRoot: function () { return workspaceRoot; },
                            configReloadBlockedReason: function () { return blockedReason; },
                            applyConfigFromDisk: function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    applyCalls += 1;
                                    return [2 /*return*/, reloadResult];
                                });
                            }); },
                            reloadConfigFromDisk: function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    return [2 /*return*/, ({
                                            read: true,
                                            providerReconfigured: false,
                                        })];
                                });
                            }); },
                        },
                    };
                    runtime = (0, plugin_runtime_1.createPluginRuntime)(ctx, { runPackageManager: runPackageManager });
                    packageDir = (0, node_path_1.join)(pluginStoreRoot, "node_modules", "@fixture", "natalia-plugin");
                    return [2 /*return*/, {
                            runtime: runtime,
                            pluginStoreRoot: pluginStoreRoot,
                            workspaceRoot: workspaceRoot,
                            packageDir: packageDir,
                            setBlocked: function (reason) {
                                blockedReason = reason;
                            },
                            setReloadResult: function (result) {
                                reloadResult = result;
                            },
                            applyCallCount: function () { return applyCalls; },
                            dispose: function () { return (0, promises_1.rm)(root, { recursive: true, force: true }); },
                        }];
            }
        });
    });
}
(0, bun_test_1.test)("pluginUninstall refuses while a turn is running and leaves the package installed", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, harness()];
            case 1:
                h = _b.sent();
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 5, 7]);
                h.setBlocked("runtime config cannot be applied while a turn is running");
                return [4 /*yield*/, (0, bun_test_1.expect)(h.runtime.pluginUninstall({ pluginID: pluginID })).rejects.toThrow(/turn is running/)];
            case 3:
                _b.sent();
                // The delete step must not have run: the package and its lock entry stay.
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)(h.packageDir)).toBe(true);
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, installer_1.loadNataliaLock)(h.pluginStoreRoot)];
            case 4:
                _a.apply(void 0, [(_b.sent()).plugins[pluginID]]).toBeDefined();
                // And the runtime reload is never reached.
                (0, bun_test_1.expect)(h.applyCallCount()).toBe(0);
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, h.dispose()];
            case 6:
                _b.sent();
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pluginUninstall refuses while an approval or question is pending", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, harness()];
            case 1:
                h = _b.sent();
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 5, 7]);
                h.setBlocked("runtime config cannot be applied while an approval or question is pending");
                return [4 /*yield*/, (0, bun_test_1.expect)(h.runtime.pluginUninstall({ pluginID: pluginID })).rejects.toThrow(/approval or question is pending/)];
            case 3:
                _b.sent();
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)(h.packageDir)).toBe(true);
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, installer_1.loadNataliaLock)(h.pluginStoreRoot)];
            case 4:
                _a.apply(void 0, [(_b.sent()).plugins[pluginID]]).toBeDefined();
                (0, bun_test_1.expect)(h.applyCallCount()).toBe(0);
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, h.dispose()];
            case 6:
                _b.sent();
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pluginUninstall reports when the reload cannot unload after the files are gone", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, harness()];
            case 1:
                h = _b.sent();
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 5, 7]);
                h.setBlocked(undefined);
                h.setReloadResult({
                    applied: false,
                    reason: "runtime config could not be applied: reconcile failed",
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(h.runtime.pluginUninstall({ pluginID: pluginID })).rejects.toThrow(/reconcile failed/)];
            case 3:
                _b.sent();
                // The delete already happened, so the package is gone — but the caller is
                // told the runtime still holds it instead of a clean success.
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)(h.packageDir)).toBe(false);
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, installer_1.loadNataliaLock)(h.pluginStoreRoot)];
            case 4:
                _a.apply(void 0, [(_b.sent()).plugins[pluginID]]).toBeUndefined();
                (0, bun_test_1.expect)(h.applyCallCount()).toBe(1);
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, h.dispose()];
            case 6:
                _b.sent();
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pluginUninstall removes the package and reloads when nothing blocks it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, result, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, harness()];
            case 1:
                h = _b.sent();
                _b.label = 2;
            case 2:
                _b.trys.push([2, , 5, 7]);
                h.setBlocked(undefined);
                h.setReloadResult({ applied: true });
                return [4 /*yield*/, h.runtime.pluginUninstall({ pluginID: pluginID })];
            case 3:
                result = _b.sent();
                (0, bun_test_1.expect)(result).toMatchObject({ uninstalled: true, pluginID: pluginID });
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)(h.packageDir)).toBe(false);
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, installer_1.loadNataliaLock)(h.pluginStoreRoot)];
            case 4:
                _a.apply(void 0, [(_b.sent()).plugins[pluginID]]).toBeUndefined();
                (0, bun_test_1.expect)(h.applyCallCount()).toBe(1);
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, h.dispose()];
            case 6:
                _b.sent();
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pluginInstall refuses while a turn is running and installs nothing", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, harness()];
            case 1:
                h = _d.sent();
                _d.label = 2;
            case 2:
                _d.trys.push([2, , 5, 7]);
                h.setBlocked("runtime config cannot be applied while a turn is running");
                return [4 /*yield*/, (0, bun_test_1.expect)(h.runtime.pluginInstall({ spec: "".concat(packageName, "@1.2.3") })).rejects.toThrow(/turn is running/)];
            case 3:
                _d.sent();
                // The store is untouched: no second package, no new lock entry.
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)(h.packageDir)).toBe(true);
                _a = bun_test_1.expect;
                _c = (_b = Object).keys;
                return [4 /*yield*/, (0, installer_1.loadNataliaLock)(h.pluginStoreRoot)];
            case 4:
                _a.apply(void 0, [_c.apply(_b, [(_d.sent()).plugins])]).toEqual([pluginID]);
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, h.dispose()];
            case 6:
                _d.sent();
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("pluginSetEnabled refuses while a turn is running and writes no config", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, configPath;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, harness()];
            case 1:
                h = _a.sent();
                _a.label = 2;
            case 2:
                _a.trys.push([2, , 4, 6]);
                configPath = (0, node_path_1.join)(h.workspaceRoot, ".natalia", "config.json");
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)(configPath)).toBe(false);
                h.setBlocked("runtime config cannot be applied while a turn is running");
                return [4 /*yield*/, (0, bun_test_1.expect)(h.runtime.pluginSetEnabled({ pluginID: pluginID, enabled: false })).rejects.toThrow(/turn is running/)];
            case 3:
                _a.sent();
                // The guard runs before setPluginEnabled, so the enabled config is not
                // written for a turn that is still live.
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)(configPath)).toBe(false);
                return [3 /*break*/, 6];
            case 4: return [4 /*yield*/, h.dispose()];
            case 5:
                _a.sent();
                return [7 /*endfinally*/];
            case 6: return [2 /*return*/];
        }
    });
}); });
