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
var bun_test_1 = require("bun:test");
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var node_url_1 = require("node:url");
var plugin_1 = require("@natalia/plugin");
var ui_host_1 = require("../src/ui-host");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
var SDK = (0, plugin_test_helpers_1.pluginSdkImportPath)();
function runtimeFixture() {
    var _this = this;
    var sink;
    var disposals = 0;
    var runtime = {
        start: function (next) {
            sink = next;
        },
        submit: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, ({ sessionID: "ses_fixture", turnID: "turn_fixture" })];
        }); }); },
        dispose: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    disposals += 1;
                    return [2 /*return*/];
                });
            });
        },
    };
    return {
        runtime: runtime,
        disposals: function () { return disposals; },
        emit: function (event) {
            sink === null || sink === void 0 ? void 0 : sink(event);
        },
    };
}
function resetCounters() {
    globalThis.__uiHostMounts = 0;
    globalThis.__uiHostDisposals = 0;
    globalThis.__uiHostNonAdapterSetup =
        0;
}
function uiManifest(id, extra) {
    if (extra === void 0) { extra = {}; }
    return JSON.stringify(__assign({ apiVersion: 2, id: id, version: "1.0.0", name: "Fixture UI", description: "Fixture UI adapter.", entry: "index.ts", scope: "process", provides: [], requires: [], optionalRequires: [], conflicts: [], dependencies: [], hooks: {}, integrationPoints: ["adapters"] }, extra));
}
function uiEntry(id, kind) {
    return "import { definePlugin } from ".concat(JSON.stringify(SDK), ";\nexport default definePlugin({\n  manifest: ").concat(uiManifest(id), ",\n  setup(api) {\n    api.adapters.registerUi({\n      kind: ").concat(JSON.stringify(kind), ",\n      mount: async () => {\n        (globalThis as any).__uiHostMounts = ((globalThis as any).__uiHostMounts ?? 0) + 1;\n      },\n      dispose: () => {\n        (globalThis as any).__uiHostDisposals = ((globalThis as any).__uiHostDisposals ?? 0) + 1;\n      },\n    });\n  },\n});\n");
}
function discoveredUiWorkspace() {
    return __awaiter(this, arguments, void 0, function (config) {
        var root, pluginRoot;
        if (config === void 0) { config = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ui-host-"))];
                case 1:
                    root = _a.sent();
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, plugin_test_helpers_1.installPluginSdkLinks)(root)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify(__assign({ version: 3, plugins: { paths: ["ui-plugins"] } }, config)))];
                case 4:
                    _a.sent();
                    pluginRoot = (0, node_path_1.join)(root, "ui-plugins", "fixture");
                    return [4 /*yield*/, (0, promises_1.mkdir)(pluginRoot, { recursive: true })];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(pluginRoot, "natalia.plugin.json"), uiManifest("fixture.ui"))];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(pluginRoot, "index.ts"), uiEntry("fixture.ui", "ui.fixture"))];
                case 7:
                    _a.sent();
                    return [2 /*return*/, { root: root, pluginStoreRoot: (0, node_path_1.join)(root, "plugin-store") }];
            }
        });
    });
}
function directUiDiscovery(root) {
    var _this = this;
    return function (input) { return __awaiter(_this, void 0, void 0, function () {
        var entries, ids;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, plugin_1.discoverPluginManifests)((0, node_path_1.join)(root, "ui-plugins"), {
                        nodeModules: false,
                    })];
                case 1:
                    entries = _a.sent();
                    ids = new Set(input.declaredIDs);
                    return [2 /*return*/, entries.flatMap(function (entry) {
                            var _a;
                            if (ids.has(entry.manifest.id))
                                throw new Error("duplicate plugin id: ".concat(entry.manifest.id));
                            ids.add(entry.manifest.id);
                            if (((_a = input.enabled) === null || _a === void 0 ? void 0 : _a[entry.manifest.id]) === false)
                                return [];
                            return [
                                {
                                    id: entry.manifest.id,
                                    enabled: true,
                                    fingerprint: JSON.stringify({
                                        manifest: entry.manifest,
                                        path: entry.path,
                                    }),
                                    manifest: entry.manifest,
                                    onError: function (error) { return input.onError(entry.manifest.id, error); },
                                    load: function (cacheBust) {
                                        return __awaiter(this, void 0, void 0, function () {
                                            var modulePath, specifier, module;
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        modulePath = (0, plugin_1.validatePluginPath)((0, node_path_1.resolve)(entry.path, ".."), entry.manifest.entry);
                                                        specifier = cacheBust
                                                            ? "".concat(modulePath, "?reload=").concat(cacheBust)
                                                            : (0, node_url_1.pathToFileURL)(modulePath).href;
                                                        return [4 /*yield*/, Promise.resolve("".concat(specifier)).then(function (s) { return require(s); })];
                                                    case 1:
                                                        module = (_a.sent());
                                                        return [2 /*return*/, __assign(__assign({}, module.default), { manifest: entry.manifest })];
                                                }
                                            });
                                        });
                                    },
                                },
                            ];
                        })];
            }
        });
    }); };
}
function installedUiWorkspace() {
    return __awaiter(this, void 0, void 0, function () {
        var root, pluginStoreRoot, packageRoot;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ui-installed-"))];
                case 1:
                    root = _a.sent();
                    pluginStoreRoot = (0, node_path_1.join)(root, "plugin-store");
                    packageRoot = (0, node_path_1.join)(pluginStoreRoot, "node_modules", "fixture-ui");
                    return [4 /*yield*/, (0, promises_1.mkdir)(packageRoot, { recursive: true })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, plugin_test_helpers_1.installPluginSdkLinks)(root)];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify({
                            version: 3,
                            plugins: {
                                packages: {
                                    "fixture.ui": {
                                        source: { type: "registry", spec: "fixture-ui@1.0.0" },
                                        version: "1.0.0",
                                        scope: "process",
                                    },
                                },
                            },
                        }))];
                case 5:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(pluginStoreRoot, "natalia.lock"), JSON.stringify({
                            version: 1,
                            plugins: {
                                "fixture.ui": {
                                    packageName: "fixture-ui",
                                    manifest: (0, node_path_1.join)(packageRoot, "natalia.plugin.json"),
                                    metadata: {
                                        id: "fixture.ui",
                                        source: { type: "registry", spec: "fixture-ui@1.0.0" },
                                        resolvedVersion: "1.0.0",
                                        scope: "process",
                                        dependencies: [],
                                    },
                                },
                            },
                        }))];
                case 6:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(packageRoot, "natalia.plugin.json"), uiManifest("fixture.ui"))];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(packageRoot, "index.ts"), uiEntry("fixture.ui", "ui.fixture"))];
                case 8:
                    _a.sent();
                    return [2 /*return*/, { root: root, pluginStoreRoot: pluginStoreRoot }];
            }
        });
    });
}
(0, bun_test_1.test)("an enabled discovered UI plugin mounts and disposes through the generic host", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, root, pluginStoreRoot, fixture, host;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                resetCounters();
                return [4 /*yield*/, discoveredUiWorkspace()];
            case 1:
                _a = _b.sent(), root = _a.root, pluginStoreRoot = _a.pluginStoreRoot;
                fixture = runtimeFixture();
                return [4 /*yield*/, (0, ui_host_1.createUiAdapterHost)({
                        pluginStoreRoot: pluginStoreRoot,
                        workspaceRoot: root,
                        runtime: fixture.runtime,
                        kinds: ["ui.fixture"],
                        configPath: (0, node_path_1.join)(root, "missing-global.json"),
                        discover: directUiDiscovery(root),
                    })];
            case 2:
                host = _b.sent();
                (0, bun_test_1.expect)(globalThis.__uiHostMounts).toBe(1);
                (0, bun_test_1.expect)(host.instances).toHaveLength(1);
                (0, bun_test_1.expect)(host.availableKinds()).toEqual(["ui.fixture"]);
                return [4 /*yield*/, host.mountInput.commands.list()];
            case 3:
                _b.sent();
                return [4 /*yield*/, host.close()];
            case 4:
                _b.sent();
                (0, bun_test_1.expect)(globalThis.__uiHostDisposals).toBe(1);
                (0, bun_test_1.expect)(fixture.disposals()).toBe(1);
                return [4 /*yield*/, host.close()];
            case 5:
                _b.sent();
                (0, bun_test_1.expect)(globalThis.__uiHostDisposals).toBe(1);
                (0, bun_test_1.expect)(fixture.disposals()).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an enabled installed (lock-backed) UI plugin mounts through the generic host", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, root, pluginStoreRoot, fixture, host;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                resetCounters();
                return [4 /*yield*/, installedUiWorkspace()];
            case 1:
                _a = _b.sent(), root = _a.root, pluginStoreRoot = _a.pluginStoreRoot;
                fixture = runtimeFixture();
                return [4 /*yield*/, (0, ui_host_1.createUiAdapterHost)({
                        pluginStoreRoot: pluginStoreRoot,
                        workspaceRoot: root,
                        runtime: fixture.runtime,
                        kinds: ["ui.fixture"],
                        configPath: (0, node_path_1.join)(root, "missing-global.json"),
                    })];
            case 2:
                host = _b.sent();
                (0, bun_test_1.expect)(globalThis.__uiHostMounts).toBe(1);
                (0, bun_test_1.expect)(host.availableKinds()).toEqual(["ui.fixture"]);
                return [4 /*yield*/, host.close()];
            case 3:
                _b.sent();
                (0, bun_test_1.expect)(globalThis.__uiHostDisposals).toBe(1);
                (0, bun_test_1.expect)(fixture.disposals()).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a disabled discovered UI plugin mounts nothing and fails closed", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, root, pluginStoreRoot, fixture;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                resetCounters();
                return [4 /*yield*/, discoveredUiWorkspace({
                        plugins: {
                            paths: ["ui-plugins"],
                            enabled: { "fixture.ui": false },
                        },
                    })];
            case 1:
                _a = _b.sent(), root = _a.root, pluginStoreRoot = _a.pluginStoreRoot;
                fixture = runtimeFixture();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, ui_host_1.createUiAdapterHost)({
                        pluginStoreRoot: pluginStoreRoot,
                        workspaceRoot: root,
                        runtime: fixture.runtime,
                        kinds: ["ui.fixture"],
                        configPath: (0, node_path_1.join)(root, "missing-global.json"),
                        discover: directUiDiscovery(root),
                    })).rejects.toThrow("adapter is not available: ui.fixture")];
            case 2:
                _b.sent();
                (0, bun_test_1.expect)(globalThis.__uiHostMounts).toBe(0);
                (0, bun_test_1.expect)(fixture.disposals()).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an explicit missing UI kind fails closed without mounting anything", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, root, pluginStoreRoot, fixture;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                resetCounters();
                return [4 /*yield*/, discoveredUiWorkspace()];
            case 1:
                _a = _b.sent(), root = _a.root, pluginStoreRoot = _a.pluginStoreRoot;
                fixture = runtimeFixture();
                return [4 /*yield*/, (0, bun_test_1.expect)((0, ui_host_1.createUiAdapterHost)({
                        pluginStoreRoot: pluginStoreRoot,
                        workspaceRoot: root,
                        runtime: fixture.runtime,
                        kinds: ["ui.missing"],
                        configPath: (0, node_path_1.join)(root, "missing-global.json"),
                        discover: directUiDiscovery(root),
                    })).rejects.toThrow("adapter is not available: ui.missing")];
            case 2:
                _b.sent();
                (0, bun_test_1.expect)(globalThis.__uiHostMounts).toBe(0);
                (0, bun_test_1.expect)(globalThis.__uiHostDisposals).toBe(0);
                (0, bun_test_1.expect)(fixture.disposals()).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("only adapter-capable process plugins are loaded into the host registry", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, nonAdapter, fixture, host;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                resetCounters();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ui-filter-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, plugin_test_helpers_1.installPluginSdkLinks)(root)];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify({
                        version: 3,
                        plugins: { paths: ["ui-plugins"] },
                    }))];
            case 4:
                _a.sent();
                nonAdapter = (0, node_path_1.join)(root, "ui-plugins", "worker");
                return [4 /*yield*/, (0, promises_1.mkdir)(nonAdapter, { recursive: true })];
            case 5:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(nonAdapter, "natalia.plugin.json"), uiManifest("worker.plugin", {
                        scope: "process",
                        integrationPoints: ["commands"],
                    }))];
            case 6:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(nonAdapter, "index.ts"), "import { definePlugin } from ".concat(JSON.stringify(SDK), ";\nexport default definePlugin({\n  manifest: ").concat(uiManifest("worker.plugin", { scope: "process", integrationPoints: ["commands"] }), ",\n  setup() {\n    (globalThis as any).__uiHostNonAdapterSetup = ((globalThis as any).__uiHostNonAdapterSetup ?? 0) + 1;\n  },\n});\n"))];
            case 7:
                _a.sent();
                fixture = runtimeFixture();
                return [4 /*yield*/, (0, ui_host_1.createUiAdapterHost)({
                        pluginStoreRoot: (0, node_path_1.join)(root, "plugin-store"),
                        workspaceRoot: root,
                        runtime: fixture.runtime,
                        kinds: [],
                        configPath: (0, node_path_1.join)(root, "missing-global.json"),
                        discover: directUiDiscovery(root),
                    })];
            case 8:
                host = _a.sent();
                (0, bun_test_1.expect)(globalThis
                    .__uiHostNonAdapterSetup).toBe(0);
                (0, bun_test_1.expect)(host.availableKinds()).toEqual([]);
                return [4 /*yield*/, host.close()];
            case 9:
                _a.sent();
                (0, bun_test_1.expect)(fixture.disposals()).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("extra desired entries share the same generic host path", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, fixture, mounts, disposals, manifest, entry, host;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                resetCounters();
                return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-ui-extra-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "config.json"), JSON.stringify({ version: 3 }))];
            case 3:
                _a.sent();
                fixture = runtimeFixture();
                mounts = 0;
                disposals = 0;
                manifest = {
                    apiVersion: 2,
                    id: "natalia-tui",
                    version: "1.0.0",
                    name: "TUI",
                    description: "Fixture TUI.",
                    entry: "natalia:tui",
                    scope: "process",
                    provides: [],
                    requires: [],
                    optionalRequires: [],
                    conflicts: [],
                    dependencies: [],
                    hooks: {},
                    integrationPoints: ["adapters"],
                };
                entry = {
                    id: manifest.id,
                    enabled: true,
                    fingerprint: manifest.version,
                    manifest: manifest,
                    load: function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, ({
                                    manifest: manifest,
                                    setup: function (api) {
                                        var _this = this;
                                        api.adapters.registerUi({
                                            kind: "ui.tui",
                                            mount: function () { return __awaiter(_this, void 0, void 0, function () {
                                                return __generator(this, function (_a) {
                                                    mounts += 1;
                                                    return [2 /*return*/];
                                                });
                                            }); },
                                            dispose: function () {
                                                disposals += 1;
                                            },
                                        });
                                    },
                                })];
                        });
                    }); },
                };
                return [4 /*yield*/, (0, ui_host_1.createUiAdapterHost)({
                        workspaceRoot: root,
                        runtime: fixture.runtime,
                        kinds: ["ui.tui"],
                        extraEntries: [entry],
                        configPath: (0, node_path_1.join)(root, "missing-global.json"),
                    })];
            case 4:
                host = _a.sent();
                (0, bun_test_1.expect)(mounts).toBe(1);
                (0, bun_test_1.expect)(host.availableKinds()).toEqual(["ui.tui"]);
                return [4 /*yield*/, host.close()];
            case 5:
                _a.sent();
                (0, bun_test_1.expect)(disposals).toBe(1);
                (0, bun_test_1.expect)(fixture.disposals()).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
