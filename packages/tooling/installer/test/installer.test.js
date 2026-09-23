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
var bun_test_1 = require("bun:test");
var node_fs_1 = require("node:fs");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var config_1 = require("@natalia/config");
var src_1 = require("../src");
var closure_1 = require("../src/closure");
var packageName = "@fixture/natalia-plugin";
var pluginID = "fixture.plugin";
function pluginModule(manifest) {
    return "export default { manifest: ".concat(JSON.stringify(manifest), ", setup() {} };");
}
function fixturePackageManager(runs) {
    var _this = this;
    return function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
        var prefix, packageDir, manifest;
        var _c, _d;
        var args = _b.args;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    runs.push(args);
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
function installedWorkspace() {
    return __awaiter(this, void 0, void 0, function () {
        var pluginStoreRoot, runs, runPackageManager;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-transaction-"))];
                case 1:
                    pluginStoreRoot = _a.sent();
                    runs = [];
                    runPackageManager = fixturePackageManager(runs);
                    return [4 /*yield*/, (0, src_1.installPlugin)({
                            pluginStoreRoot: pluginStoreRoot,
                            spec: "".concat(packageName, "@1.2.3"),
                            runPackageManager: runPackageManager,
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/, { pluginStoreRoot: pluginStoreRoot, runs: runs, runPackageManager: runPackageManager }];
            }
        });
    });
}
(0, bun_test_1.test)("plugin lifecycle installs, catalogs, toggles, reconciles, and fully uninstalls", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, workspaceRoot, runs, runPackageManager, installed, _a, rows, toggled, _b, _c, _d, _e, config;
    var _f, _g, _h, _j;
    var _k;
    return __generator(this, function (_l) {
        switch (_l.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-store-"))];
            case 1:
                pluginStoreRoot = _l.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-installer-"))];
            case 2:
                workspaceRoot = _l.sent();
                runs = [];
                runPackageManager = fixturePackageManager(runs);
                return [4 /*yield*/, (0, src_1.installPlugin)({
                        pluginStoreRoot: pluginStoreRoot,
                        spec: "".concat(packageName, "@1.2.3"),
                        runPackageManager: runPackageManager,
                    })];
            case 3:
                installed = _l.sent();
                (0, bun_test_1.expect)(installed).toMatchObject({
                    installed: true,
                    pluginID: pluginID,
                    packageName: packageName,
                    metadata: { resolvedVersion: "1.2.3", integrity: "sha512-fixture" },
                });
                (0, bun_test_1.expect)(runs).toHaveLength(1);
                (0, bun_test_1.expect)(runs[0].join(" ")).toContain("--prefix ".concat(pluginStoreRoot));
                (0, bun_test_1.expect)(runs[0].join(" ")).not.toContain("plugin-staging");
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.doctorPlugins)(pluginStoreRoot)];
            case 4:
                _a.apply(void 0, [_l.sent()]).toEqual([]);
                return [4 /*yield*/, (0, src_1.listInstalledPlugins)({ pluginStoreRoot: pluginStoreRoot, workspaceRoot: workspaceRoot })];
            case 5:
                rows = _l.sent();
                (0, bun_test_1.expect)(rows.find(function (row) { return row.id === pluginID; })).toMatchObject({
                    name: "Fixture",
                    installed: true,
                    packageName: packageName,
                });
                (0, bun_test_1.expect)(rows.map(function (row) { return row.id; })).toEqual(__spreadArray([], rows.map(function (row) { return row.id; }), true).sort());
                (0, bun_test_1.expect)(new Set(rows.map(function (row) { return Object.keys(row).sort().join(","); })).size).toBe(1);
                return [4 /*yield*/, (0, src_1.setPluginEnabled)({
                        pluginStoreRoot: pluginStoreRoot,
                        workspaceRoot: workspaceRoot,
                        pluginID: pluginID,
                        enabled: false,
                    })];
            case 6:
                _l.sent();
                _c = (_b = JSON).parse;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(workspaceRoot, ".natalia", "config.json"), "utf8")];
            case 7:
                toggled = _c.apply(_b, [_l.sent()]);
                (0, bun_test_1.expect)(toggled.plugins.enabled).toMatchObject((_f = {},
                    _f[pluginID] = false,
                    _f));
                (0, bun_test_1.expect)((_k = toggled.tools) === null || _k === void 0 ? void 0 : _k.enabled).toBeUndefined();
                return [4 /*yield*/, (0, config_1.updateConfig)(workspaceRoot, {
                        plugins: {
                            settings: (_g = {}, _g[pluginID] = { key: true }, _g),
                            capabilities: (_h = {}, _h[pluginID] = ["tools"], _h),
                            readOnly: (_j = {}, _j[pluginID] = true, _j),
                        },
                    })];
            case 8:
                _l.sent();
                _d = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.uninstallPlugin)({ pluginStoreRoot: pluginStoreRoot, pluginID: pluginID, runPackageManager: runPackageManager })];
            case 9:
                _d.apply(void 0, [_l.sent()]).toMatchObject({ disposition: "removed" });
                _e = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.loadNataliaLock)(pluginStoreRoot)];
            case 10:
                _e.apply(void 0, [(_l.sent()).plugins]).toEqual({});
                return [4 /*yield*/, (0, config_1.resolveConfig)({ workspaceRoot: workspaceRoot })];
            case 11:
                config = (_l.sent()).config.plugins;
                (0, bun_test_1.expect)(config.enabled[pluginID]).toBe(false);
                (0, bun_test_1.expect)(config.settings[pluginID]).toEqual({ key: true });
                (0, bun_test_1.expect)(config.capabilities[pluginID]).toEqual(["tools"]);
                (0, bun_test_1.expect)(config.readOnly[pluginID]).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("invalid installed package does not create a Natalia lock", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, runs, runPackageManager;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-invalid-"))];
            case 1:
                pluginStoreRoot = _a.sent();
                runs = [];
                runPackageManager = function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
                    var prefix, packageDir;
                    var args = _b.args;
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0:
                                runs.push(args);
                                prefix = args[args.indexOf("--prefix") + 1];
                                if (!(args[0] === "uninstall")) return [3 /*break*/, 3];
                                return [4 /*yield*/, (0, promises_1.rm)((0, node_path_1.join)(prefix, "node_modules", "invalid-plugin"), {
                                        recursive: true,
                                        force: true,
                                    })];
                            case 1:
                                _c.sent();
                                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(prefix, "package.json"), JSON.stringify({}))];
                            case 2:
                                _c.sent();
                                return [2 /*return*/];
                            case 3:
                                packageDir = (0, node_path_1.join)(prefix, "node_modules", "invalid-plugin");
                                return [4 /*yield*/, (0, promises_1.mkdir)(packageDir, { recursive: true })];
                            case 4:
                                _c.sent();
                                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(prefix, "package.json"), JSON.stringify({ dependencies: { "invalid-plugin": "1.0.0" } }))];
                            case 5:
                                _c.sent();
                                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(prefix, "package-lock.json"), JSON.stringify({
                                        packages: { "node_modules/invalid-plugin": { version: "1.0.0" } },
                                    }))];
                            case 6:
                                _c.sent();
                                return [2 /*return*/];
                        }
                    });
                }); };
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.installPlugin)({
                        pluginStoreRoot: pluginStoreRoot,
                        spec: "invalid-plugin",
                        runPackageManager: runPackageManager,
                    })).rejects.toThrow("exactly one natalia.plugin.json")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(runs.some(function (args) { return args[0] === "uninstall"; })).toBe(true);
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(pluginStoreRoot, "node_modules", "invalid-plugin"))).toBe(false);
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(pluginStoreRoot, "natalia.lock"))).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("install enables the plugin in the selected workspace", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, workspaceRoot, config, _a, _b, _c;
    var _d;
    var _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-store-"))];
            case 1:
                pluginStoreRoot = _f.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-enable-on-install-"))];
            case 2:
                workspaceRoot = _f.sent();
                return [4 /*yield*/, (0, src_1.installPlugin)({
                        pluginStoreRoot: pluginStoreRoot,
                        workspaceRoot: workspaceRoot,
                        spec: "".concat(packageName, "@1.2.3"),
                        runPackageManager: fixturePackageManager([]),
                    })];
            case 3:
                _f.sent();
                _b = (_a = JSON).parse;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(workspaceRoot, ".natalia", "config.json"), "utf8")];
            case 4:
                config = _b.apply(_a, [_f.sent()]);
                (0, bun_test_1.expect)(config.plugins.enabled).toMatchObject((_d = {}, _d[pluginID] = true, _d));
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.listInstalledPlugins)({ pluginStoreRoot: pluginStoreRoot, workspaceRoot: workspaceRoot })];
            case 5:
                _c.apply(void 0, [(_e = (_f.sent())[0]) === null || _e === void 0 ? void 0 : _e.enabled]).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("install rejects an entry manifest that differs from the package manifest", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, base, runPackageManager;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-mismatch-"))];
            case 1:
                pluginStoreRoot = _a.sent();
                base = fixturePackageManager([]);
                runPackageManager = function (input) { return __awaiter(void 0, void 0, void 0, function () {
                    var prefix, entry;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, base(input)];
                            case 1:
                                _a.sent();
                                prefix = input.args[input.args.indexOf("--prefix") + 1];
                                entry = (0, node_path_1.join)(prefix, "node_modules", "@fixture", "natalia-plugin", "index.ts");
                                return [4 /*yield*/, (0, promises_1.writeFile)(entry, pluginModule({
                                        apiVersion: 2,
                                        id: "different.plugin",
                                        version: "1.2.3",
                                        name: "Fixture",
                                        entry: "index.ts",
                                        scope: "workspace",
                                    }))];
                            case 2:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); };
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.installPlugin)({ pluginStoreRoot: pluginStoreRoot, spec: packageName, runPackageManager: runPackageManager })).rejects.toThrow("does not match natalia.plugin.json")];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("installer state is not synthesized without a physical package", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, workspaceRoot, _a, physicalRoot, installed;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-no-store-"))];
            case 1:
                pluginStoreRoot = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-no-runtime-"))];
            case 2:
                workspaceRoot = _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.listInstalledPlugins)({ pluginStoreRoot: pluginStoreRoot, workspaceRoot: workspaceRoot })];
            case 3:
                _a.apply(void 0, [_b.sent()]).toEqual([]);
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.setPluginEnabled)({
                        pluginStoreRoot: pluginStoreRoot,
                        workspaceRoot: workspaceRoot,
                        pluginID: "runtime.plugin",
                        enabled: false,
                    })).rejects.toThrow("unknown plugin")];
            case 4:
                _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.uninstallPlugin)({
                        pluginStoreRoot: pluginStoreRoot,
                        pluginID: "runtime.plugin",
                    })).rejects.toThrow("unknown plugin")];
            case 5:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-runtime-id-"))];
            case 6:
                physicalRoot = _b.sent();
                return [4 /*yield*/, (0, src_1.installPlugin)({
                        pluginStoreRoot: physicalRoot,
                        spec: packageName,
                        runPackageManager: fixturePackageManager([]),
                    })];
            case 7:
                installed = _b.sent();
                (0, bun_test_1.expect)(installed.pluginID).toBe(pluginID);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugin doctor reports and reconciles a package missing from disk", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, runs, runPackageManager, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-doctor-"))];
            case 1:
                pluginStoreRoot = _c.sent();
                runs = [];
                runPackageManager = fixturePackageManager(runs);
                return [4 /*yield*/, (0, src_1.installPlugin)({
                        pluginStoreRoot: pluginStoreRoot,
                        spec: "".concat(packageName, "@1.2.3"),
                        runPackageManager: runPackageManager,
                    })];
            case 2:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.rm)((0, node_path_1.join)(pluginStoreRoot, "node_modules", "@fixture", "natalia-plugin"), { recursive: true })];
            case 3:
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.doctorPlugins)(pluginStoreRoot)];
            case 4:
                _a.apply(void 0, [_c.sent()]).toContainEqual(bun_test_1.expect.objectContaining({ code: "package_missing" }));
                return [4 /*yield*/, (0, src_1.reconcilePlugins)(pluginStoreRoot, runPackageManager)];
            case 5:
                _c.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.doctorPlugins)(pluginStoreRoot)];
            case 6:
                _b.apply(void 0, [_c.sent()]).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("package manager failure does not mutate Natalia metadata", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, beforeLock, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, installedWorkspace()];
            case 1:
                pluginStoreRoot = (_b.sent()).pluginStoreRoot;
                return [4 /*yield*/, (0, src_1.loadNataliaLock)(pluginStoreRoot)];
            case 2:
                beforeLock = _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.installPlugin)({
                        pluginStoreRoot: pluginStoreRoot,
                        spec: "".concat(packageName, "@2.0.0"),
                        runPackageManager: function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                throw new Error("npm failed");
                            });
                        }); },
                    })).rejects.toThrow("npm failed")];
            case 3:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.loadNataliaLock)(pluginStoreRoot)];
            case 4:
                _a.apply(void 0, [_b.sent()]).toEqual(beforeLock);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("lock failure rolls back a successful package install", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, runs, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-metadata-"))];
            case 1:
                pluginStoreRoot = _b.sent();
                runs = [];
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.installPlugin)({
                        pluginStoreRoot: pluginStoreRoot,
                        spec: "".concat(packageName, "@1.2.3"),
                        runPackageManager: fixturePackageManager(runs),
                        seams: {
                            saveLock: function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    throw new Error("lock write failed");
                                });
                            }); },
                        },
                    })).rejects.toThrow("lock write failed")];
            case 2:
                _b.sent();
                (0, bun_test_1.expect)(runs.some(function (args) { return args[0] === "uninstall"; })).toBe(true);
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(pluginStoreRoot, "node_modules", "@fixture", "natalia-plugin"))).toBe(false);
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.loadNataliaLock)(pluginStoreRoot)];
            case 3:
                _a.apply(void 0, [(_b.sent()).plugins[pluginID]]).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("install rejects duplicate plugin IDs and package manifest ID changes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, manager;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, installedWorkspace()];
            case 1:
                pluginStoreRoot = (_a.sent()).pluginStoreRoot;
                manager = function (name, id) {
                    return function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
                        var prefix, dir, manifest;
                        var _c, _d;
                        var args = _b.args;
                        return __generator(this, function (_e) {
                            switch (_e.label) {
                                case 0:
                                    prefix = args[args.indexOf("--prefix") + 1];
                                    dir = (0, node_path_1.join)(prefix, "node_modules", name);
                                    return [4 /*yield*/, (0, promises_1.mkdir)(dir, { recursive: true })];
                                case 1:
                                    _e.sent();
                                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(prefix, "package.json"), JSON.stringify({ dependencies: (_c = {}, _c[name] = "1.0.0", _c) }))];
                                case 2:
                                    _e.sent();
                                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(prefix, "package-lock.json"), JSON.stringify({
                                            packages: (_d = {}, _d["node_modules/".concat(name)] = { version: "1.0.0" }, _d),
                                        }))];
                                case 3:
                                    _e.sent();
                                    manifest = {
                                        apiVersion: 1,
                                        id: id,
                                        version: "1.0.0",
                                        name: name,
                                        entry: "index-".concat(id, ".ts"),
                                        scope: "workspace",
                                    };
                                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(dir, "natalia.plugin.json"), JSON.stringify(manifest))];
                                case 4:
                                    _e.sent();
                                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(dir, manifest.entry), pluginModule(manifest))];
                                case 5:
                                    _e.sent();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                };
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.installPlugin)({
                        pluginStoreRoot: pluginStoreRoot,
                        spec: "other-package",
                        runPackageManager: manager("other-package", pluginID),
                    })).rejects.toThrow("already owned")];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.installPlugin)({
                        pluginStoreRoot: pluginStoreRoot,
                        spec: packageName,
                        runPackageManager: manager(packageName, "changed.id"),
                    })).rejects.toThrow("changing plugin id")];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("reinstall resolves an unchanged scoped registry dependency", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, pluginStoreRoot, runPackageManager, installed;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, installedWorkspace()];
            case 1:
                _a = _b.sent(), pluginStoreRoot = _a.pluginStoreRoot, runPackageManager = _a.runPackageManager;
                return [4 /*yield*/, (0, src_1.installPlugin)({
                        pluginStoreRoot: pluginStoreRoot,
                        spec: "".concat(packageName, "@1.2.3"),
                        runPackageManager: runPackageManager,
                    })];
            case 2:
                installed = _b.sent();
                (0, bun_test_1.expect)(installed.packageName).toBe(packageName);
                (0, bun_test_1.expect)(installed.pluginID).toBe(pluginID);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("uninstall leaves Natalia metadata unchanged when npm fails", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, beforeLock, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, installedWorkspace()];
            case 1:
                pluginStoreRoot = (_b.sent()).pluginStoreRoot;
                return [4 /*yield*/, (0, src_1.loadNataliaLock)(pluginStoreRoot)];
            case 2:
                beforeLock = _b.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.uninstallPlugin)({
                        pluginStoreRoot: pluginStoreRoot,
                        pluginID: pluginID,
                        runPackageManager: function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                throw new Error("npm uninstall failed");
                            });
                        }); },
                    })).rejects.toThrow("npm uninstall failed")];
            case 3:
                _b.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.loadNataliaLock)(pluginStoreRoot)];
            case 4:
                _a.apply(void 0, [_b.sent()]).toEqual(beforeLock);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("uninstall does not restore a package after metadata cleanup fails", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, pluginStoreRoot, runPackageManager, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, installedWorkspace()];
            case 1:
                _a = _c.sent(), pluginStoreRoot = _a.pluginStoreRoot, runPackageManager = _a.runPackageManager;
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.uninstallPlugin)({
                        pluginStoreRoot: pluginStoreRoot,
                        pluginID: pluginID,
                        runPackageManager: runPackageManager,
                        seams: {
                            saveLock: function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    throw new Error("lock removal failed");
                                });
                            }); },
                        },
                    })).rejects.toThrow("lock removal failed")];
            case 2:
                _c.sent();
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(pluginStoreRoot, "node_modules", "@fixture", "natalia-plugin"))).toBe(false);
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.loadNataliaLock)(pluginStoreRoot)];
            case 3:
                _b.apply(void 0, [(_c.sent()).plugins[pluginID]]).toBeDefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("reconcile delegates every physical package repair to installPlugin", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, repairs, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-reconcile-npm-"))];
            case 1:
                pluginStoreRoot = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(pluginStoreRoot, "sentinel"), "before")];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, src_1.saveNataliaLock)(pluginStoreRoot, {
                        version: 1,
                        plugins: {
                            "first.plugin": lockEntry("first-package", "first.plugin"),
                            "second.plugin": lockEntry("second-package", "second.plugin"),
                        },
                    })];
            case 3:
                _b.sent();
                repairs = [];
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.reconcilePlugins)(pluginStoreRoot, undefined, {
                        installPlugin: function (input) { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                repairs.push(input.spec);
                                if (repairs.length === 2)
                                    throw new Error("second repair failed");
                                return [2 /*return*/, {}];
                            });
                        }); },
                    })).rejects.toThrow("second repair failed")];
            case 4:
                _b.sent();
                (0, bun_test_1.expect)(repairs).toHaveLength(2);
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, promises_1.readFile)((0, node_path_1.join)(pluginStoreRoot, "sentinel"), "utf8")];
            case 5:
                _a.apply(void 0, [_b.sent()]).toBe("before");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("package validation enforces package, manifest, entry, and lock boundaries", function () { return __awaiter(void 0, void 0, void 0, function () {
    var manager, entryRoot, packageRoot, missingRoot, dependencyRoot, installed;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                manager = function (mode) {
                    return function (_a) { return __awaiter(void 0, [_a], void 0, function (_b) {
                        var prefix, dir, packageRoot, manifest, dependency;
                        var args = _b.args;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    prefix = args[args.indexOf("--prefix") + 1];
                                    dir = (0, node_path_1.join)(prefix, "node_modules", "boundary-plugin");
                                    packageRoot = mode === "packageEscape" ? (0, node_path_1.join)(prefix, "outside-package") : dir;
                                    return [4 /*yield*/, (0, promises_1.mkdir)(packageRoot, { recursive: true })];
                                case 1:
                                    _c.sent();
                                    if (!(mode === "packageEscape")) return [3 /*break*/, 4];
                                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(prefix, "node_modules"), { recursive: true })];
                                case 2:
                                    _c.sent();
                                    return [4 /*yield*/, (0, promises_1.symlink)(packageRoot, dir, "dir")];
                                case 3:
                                    _c.sent();
                                    _c.label = 4;
                                case 4: return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(prefix, "package.json"), JSON.stringify({ dependencies: { "boundary-plugin": "1.0.0" } }))];
                                case 5:
                                    _c.sent();
                                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(prefix, "package-lock.json"), JSON.stringify({
                                            packages: mode === "missing"
                                                ? {}
                                                : { "node_modules/boundary-plugin": { version: "1.0.0" } },
                                        }))];
                                case 6:
                                    _c.sent();
                                    manifest = {
                                        apiVersion: 1,
                                        id: "boundary.plugin",
                                        version: "1.0.0",
                                        name: "Boundary",
                                        entry: "index.ts",
                                        scope: "workspace",
                                    };
                                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(packageRoot, "natalia.plugin.json"), JSON.stringify(manifest))];
                                case 7:
                                    _c.sent();
                                    if (!(mode === "entryEscape")) return [3 /*break*/, 10];
                                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(prefix, "outside.ts"), "export default {};")];
                                case 8:
                                    _c.sent();
                                    return [4 /*yield*/, (0, promises_1.symlink)((0, node_path_1.join)(prefix, "outside.ts"), (0, node_path_1.join)(packageRoot, "index.ts"))];
                                case 9:
                                    _c.sent();
                                    return [3 /*break*/, 12];
                                case 10: return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(packageRoot, "index.ts"), pluginModule(manifest))];
                                case 11:
                                    _c.sent();
                                    _c.label = 12;
                                case 12:
                                    if (!(mode === "dependency")) return [3 /*break*/, 15];
                                    dependency = (0, node_path_1.join)(dir, "node_modules", "dependency");
                                    return [4 /*yield*/, (0, promises_1.mkdir)(dependency, { recursive: true })];
                                case 13:
                                    _c.sent();
                                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(dependency, "natalia.plugin.json"), "{}")];
                                case 14:
                                    _c.sent();
                                    _c.label = 15;
                                case 15: return [2 /*return*/];
                            }
                        });
                    }); };
                };
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-boundary-entry-"))];
            case 1:
                entryRoot = _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.installPlugin)({
                        pluginStoreRoot: entryRoot,
                        spec: "boundary-plugin",
                        runPackageManager: manager("entryEscape"),
                    })).rejects.toThrow("entry escapes")];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-boundary-package-"))];
            case 3:
                packageRoot = _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.installPlugin)({
                        pluginStoreRoot: packageRoot,
                        spec: "boundary-plugin",
                        runPackageManager: manager("packageEscape"),
                    })).rejects.toThrow("package escapes node_modules")];
            case 4:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-boundary-lock-"))];
            case 5:
                missingRoot = _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, src_1.installPlugin)({
                        pluginStoreRoot: missingRoot,
                        spec: "boundary-plugin",
                        runPackageManager: manager("missing"),
                    })).rejects.toThrow("package-lock is missing")];
            case 6:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-boundary-dependency-"))];
            case 7:
                dependencyRoot = _a.sent();
                return [4 /*yield*/, (0, src_1.installPlugin)({
                        pluginStoreRoot: dependencyRoot,
                        spec: "boundary-plugin",
                        runPackageManager: manager("dependency"),
                    })];
            case 8:
                installed = _a.sent();
                (0, bun_test_1.expect)(installed === null || installed === void 0 ? void 0 : installed.pluginID).toBe("boundary.plugin");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("rollback attempts every restoration and aggregates failures", function () { return __awaiter(void 0, void 0, void 0, function () {
    var attempts, original, firstRestore, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                attempts = [];
                original = new Error("mutation failed");
                firstRestore = new Error("closure restore failed");
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, (0, closure_1.rollbackWith)(original, [
                        function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                attempts.push("closure");
                                throw firstRestore;
                            });
                        }); },
                        function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                attempts.push("lock");
                                return [2 /*return*/];
                            });
                        }); },
                        function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                attempts.push("config");
                                return [2 /*return*/];
                            });
                        }); },
                    ])];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                error_1 = _a.sent();
                (0, bun_test_1.expect)(error_1).toBeInstanceOf(AggregateError);
                (0, bun_test_1.expect)(error_1.errors).toEqual([original, firstRestore]);
                return [3 /*break*/, 4];
            case 4:
                (0, bun_test_1.expect)(attempts).toEqual(["closure", "lock", "config"]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("real and symlink store paths share one operation queue", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, alias, active, maximum, base, manager;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-realpath-"))];
            case 1:
                root = _a.sent();
                alias = "".concat(root, "-alias");
                return [4 /*yield*/, (0, promises_1.symlink)(root, alias, "dir")];
            case 2:
                _a.sent();
                active = 0;
                maximum = 0;
                base = fixturePackageManager([]);
                manager = function (input) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                active += 1;
                                maximum = Math.max(maximum, active);
                                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
                            case 1:
                                _a.sent();
                                return [4 /*yield*/, base(input)];
                            case 2:
                                _a.sent();
                                active -= 1;
                                return [2 /*return*/];
                        }
                    });
                }); };
                return [4 /*yield*/, Promise.all([
                        (0, src_1.installPlugin)({
                            pluginStoreRoot: root,
                            spec: packageName,
                            runPackageManager: manager,
                        }),
                        (0, src_1.installPlugin)({
                            pluginStoreRoot: alias,
                            spec: packageName,
                            runPackageManager: manager,
                        }),
                    ])];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(maximum).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("workspaces share one plugin store and keep independent enabled config", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, firstWorkspaceRoot, secondWorkspaceRoot, active, maximum, apply, _a, _b, _c, _i, _d, workspaceRoot, _e, _f;
    var _g, _h;
    return __generator(this, function (_j) {
        switch (_j.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-shared-store-"))];
            case 1:
                pluginStoreRoot = _j.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-a-"))];
            case 2:
                firstWorkspaceRoot = _j.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-workspace-b-"))];
            case 3:
                secondWorkspaceRoot = _j.sent();
                return [4 /*yield*/, (0, src_1.installPlugin)({
                        pluginStoreRoot: pluginStoreRoot,
                        spec: packageName,
                        runPackageManager: fixturePackageManager([]),
                    })];
            case 4:
                _j.sent();
                active = 0;
                maximum = 0;
                apply = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                active += 1;
                                maximum = Math.max(maximum, active);
                                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10); })];
                            case 1:
                                _a.sent();
                                active -= 1;
                                return [2 /*return*/];
                        }
                    });
                }); };
                return [4 /*yield*/, Promise.all([
                        (0, src_1.setPluginEnabled)({
                            pluginStoreRoot: pluginStoreRoot,
                            workspaceRoot: firstWorkspaceRoot,
                            pluginID: pluginID,
                            enabled: false,
                            apply: apply,
                        }),
                        (0, src_1.setPluginEnabled)({
                            pluginStoreRoot: pluginStoreRoot,
                            workspaceRoot: secondWorkspaceRoot,
                            pluginID: pluginID,
                            enabled: true,
                            apply: apply,
                        }),
                    ])];
            case 5:
                _j.sent();
                (0, bun_test_1.expect)(maximum).toBe(1);
                _a = bun_test_1.expect;
                _c = (_b = Object).keys;
                return [4 /*yield*/, (0, src_1.loadNataliaLock)(pluginStoreRoot)];
            case 6:
                _a.apply(void 0, [_c.apply(_b, [(_j.sent()).plugins])]).toEqual([pluginID]);
                (0, bun_test_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(pluginStoreRoot, "node_modules", "@fixture", "natalia-plugin"))).toBe(true);
                for (_i = 0, _d = [firstWorkspaceRoot, secondWorkspaceRoot]; _i < _d.length; _i++) {
                    workspaceRoot = _d[_i];
                    (0, bun_test_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(workspaceRoot, "natalia.lock"))).toBe(false);
                    (0, bun_test_1.expect)((0, node_fs_1.existsSync)((0, node_path_1.join)(workspaceRoot, "node_modules"))).toBe(false);
                }
                _e = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.listInstalledPlugins)({
                        pluginStoreRoot: pluginStoreRoot,
                        workspaceRoot: firstWorkspaceRoot,
                    })];
            case 7:
                _e.apply(void 0, [(_g = (_j.sent())[0]) === null || _g === void 0 ? void 0 : _g.enabled]).toBe(false);
                _f = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.listInstalledPlugins)({
                        pluginStoreRoot: pluginStoreRoot,
                        workspaceRoot: secondWorkspaceRoot,
                    })];
            case 8:
                _f.apply(void 0, [(_h = (_j.sent())[0]) === null || _h === void 0 ? void 0 : _h.enabled]).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("custom global config participates in maintenance reads and writes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, workspaceRoot, globalPath, _a, _b;
    var _c;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-store-"))];
            case 1:
                pluginStoreRoot = _e.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-custom-config-"))];
            case 2:
                workspaceRoot = _e.sent();
                globalPath = (0, node_path_1.join)(workspaceRoot, "custom-global.json");
                return [4 /*yield*/, (0, promises_1.writeFile)(globalPath, JSON.stringify({
                        version: 3,
                        plugins: { enabled: (_c = {}, _c[pluginID] = false, _c) },
                    }))];
            case 3:
                _e.sent();
                return [4 /*yield*/, (0, src_1.installPlugin)({
                        pluginStoreRoot: pluginStoreRoot,
                        spec: packageName,
                        runPackageManager: fixturePackageManager([]),
                    })];
            case 4:
                _e.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.listInstalledPlugins)({
                        pluginStoreRoot: pluginStoreRoot,
                        workspaceRoot: workspaceRoot,
                        globalPath: globalPath,
                    })];
            case 5:
                _a.apply(void 0, [(_d = (_e.sent())[0]) === null || _d === void 0 ? void 0 : _d.enabled]).toBe(false);
                return [4 /*yield*/, (0, src_1.setPluginEnabled)({
                        pluginStoreRoot: pluginStoreRoot,
                        workspaceRoot: workspaceRoot,
                        pluginID: pluginID,
                        enabled: true,
                        config: { globalPath: globalPath },
                    })];
            case 6:
                _e.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, config_1.resolveConfig)({ workspaceRoot: workspaceRoot, globalPath: globalPath })];
            case 7:
                _b.apply(void 0, [(_e.sent()).config.plugins.enabled[pluginID]]).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("official catalog contains 16 prebuilt packages and excludes PDF", function () {
    (0, bun_test_1.expect)(src_1.OFFICIAL_PLUGIN_PACKAGES).toHaveLength(16);
    (0, bun_test_1.expect)(src_1.OFFICIAL_PLUGIN_PACKAGES.map(function (_a) {
        var id = _a.id;
        return id;
    })).not.toContain("natalia-tool-pdf");
});
(0, bun_test_1.test)("first initialization physically installs through installPlugin", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, distributionRoot, calls, result, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-official-first-"))];
            case 1:
                pluginStoreRoot = _d.sent();
                return [4 /*yield*/, officialDistribution("natalia-tool-ask")];
            case 2:
                distributionRoot = _d.sent();
                calls = [];
                return [4 /*yield*/, (0, src_1.initializeOfficialPlugins)({
                        pluginStoreRoot: pluginStoreRoot,
                        distributionRoot: distributionRoot,
                        pluginIDs: ["natalia-tool-ask"],
                        runPackageManager: fixturePackageManager([]),
                        seams: {
                            installPlugin: function (input) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            calls.push(input.spec);
                                            return [4 /*yield*/, (0, src_1.installPlugin)(input)];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); },
                        },
                    })];
            case 3:
                result = _d.sent();
                (0, bun_test_1.expect)(result.initialized).toBe(true);
                _b = (_a = (0, bun_test_1.expect)(calls)).toEqual;
                return [4 /*yield*/, (0, src_1.resolveOfficialPluginPackage)(distributionRoot, "natalia-tool-ask")];
            case 4:
                _b.apply(_a, [[
                        _d.sent()
                    ]]);
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.loadNataliaLock)(pluginStoreRoot)];
            case 5:
                _c.apply(void 0, [(_d.sent()).plugins[pluginID]]).toBeDefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("uninstalled official plugin stays absent after re-init and reconcile", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, distributionRoot, runPackageManager, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-official-absent-"))];
            case 1:
                pluginStoreRoot = _c.sent();
                return [4 /*yield*/, officialDistribution("natalia-tool-ask")];
            case 2:
                distributionRoot = _c.sent();
                runPackageManager = fixturePackageManager([]);
                return [4 /*yield*/, (0, src_1.initializeOfficialPlugins)({
                        pluginStoreRoot: pluginStoreRoot,
                        distributionRoot: distributionRoot,
                        pluginIDs: ["natalia-tool-ask"],
                        runPackageManager: runPackageManager,
                    })];
            case 3:
                _c.sent();
                return [4 /*yield*/, (0, src_1.uninstallPlugin)({ pluginStoreRoot: pluginStoreRoot, pluginID: pluginID, runPackageManager: runPackageManager })];
            case 4:
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.initializeOfficialPlugins)({
                        pluginStoreRoot: pluginStoreRoot,
                        distributionRoot: distributionRoot,
                        pluginIDs: ["natalia-tool-ask"],
                        runPackageManager: runPackageManager,
                    })];
            case 5:
                _a.apply(void 0, [_c.sent()]).toEqual({ initialized: false, installed: [] });
                return [4 /*yield*/, (0, src_1.reconcilePlugins)(pluginStoreRoot, runPackageManager)];
            case 6:
                _c.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.loadNataliaLock)(pluginStoreRoot)];
            case 7:
                _b.apply(void 0, [(_c.sent()).plugins]).toEqual({});
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("official reinstall resolves the current bundled source", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, firstRoot, currentRoot, calls, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-official-reinstall-"))];
            case 1:
                pluginStoreRoot = _d.sent();
                return [4 /*yield*/, officialDistribution("natalia-tool-ask")];
            case 2:
                firstRoot = _d.sent();
                return [4 /*yield*/, officialDistribution("natalia-tool-ask")];
            case 3:
                currentRoot = _d.sent();
                calls = [];
                return [4 /*yield*/, (0, src_1.reinstallOfficialPlugin)({
                        pluginStoreRoot: pluginStoreRoot,
                        distributionRoot: firstRoot,
                        pluginID: "natalia-tool-ask",
                        runPackageManager: fixturePackageManager([]),
                    })];
            case 4:
                _d.sent();
                return [4 /*yield*/, (0, src_1.reinstallOfficialPlugin)({
                        pluginStoreRoot: pluginStoreRoot,
                        distributionRoot: currentRoot,
                        pluginID: "natalia-tool-ask",
                        seams: {
                            installPlugin: function (input) { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            calls.push(input.spec);
                                            return [4 /*yield*/, (0, src_1.installPlugin)(__assign(__assign({}, input), { runPackageManager: fixturePackageManager([]) }))];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); },
                        },
                    })];
            case 5:
                _d.sent();
                _b = (_a = (0, bun_test_1.expect)(calls)).toEqual;
                return [4 /*yield*/, (0, src_1.resolveOfficialPluginPackage)(currentRoot, "natalia-tool-ask")];
            case 6:
                _b.apply(_a, [[
                        _d.sent()
                    ]]);
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.loadNataliaLock)(pluginStoreRoot)];
            case 7:
                _c.apply(void 0, [(_d.sent()).plugins[pluginID]]).toBeDefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("zero official plugins is a valid initialized state", function () { return __awaiter(void 0, void 0, void 0, function () {
    var pluginStoreRoot, distributionRoot, _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-official-zero-"))];
            case 1:
                pluginStoreRoot = _d.sent();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-dist-zero-"))];
            case 2:
                distributionRoot = _d.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.initializeOfficialPlugins)({
                        pluginStoreRoot: pluginStoreRoot,
                        distributionRoot: distributionRoot,
                        pluginIDs: [],
                    })];
            case 3:
                _a.apply(void 0, [_d.sent()]).toEqual({ initialized: true, installed: [] });
                _b = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.loadNataliaLock)(pluginStoreRoot)];
            case 4:
                _b.apply(void 0, [(_d.sent()).plugins]).toEqual({});
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.initializeOfficialPlugins)({ pluginStoreRoot: pluginStoreRoot, distributionRoot: distributionRoot })];
            case 5:
                _c.apply(void 0, [_d.sent()]).toEqual({ initialized: false, installed: [] });
                return [2 /*return*/];
        }
    });
}); });
function officialDistribution(id) {
    return __awaiter(this, void 0, void 0, function () {
        var root, entry;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-distribution-"))];
                case 1:
                    root = _a.sent();
                    entry = src_1.OFFICIAL_PLUGIN_PACKAGES.find(function (candidate) { return candidate.id === id; });
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, entry.directory), { recursive: true })];
                case 2:
                    _a.sent();
                    return [2 /*return*/, root];
            }
        });
    });
}
function lockEntry(packageName, id) {
    return {
        packageName: packageName,
        manifest: "plugin-store/node_modules/".concat(packageName, "/natalia.plugin.json"),
        metadata: {
            id: id,
            source: { type: "registry", spec: "".concat(packageName, "@1.2.3") },
            resolvedVersion: "1.2.3",
            integrity: "sha512-fixture",
            scope: "workspace",
            dependencies: [],
        },
    };
}
