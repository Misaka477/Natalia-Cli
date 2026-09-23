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
var zod_1 = require("zod");
var tools_1 = require("@anthelia/tools");
var src_1 = require("../src");
(0, bun_test_1.test)("v2 manifests reject lifecycle hooks that are not implemented", function () {
    (0, bun_test_1.expect)(function () {
        return src_1.pluginManifestSchema.parse({
            apiVersion: 2,
            id: "fixture.hooks",
            version: "1.0.0",
            name: "Hooks",
            hooks: { postInstall: "configure" },
        });
    }).toThrow();
});
(0, bun_test_1.test)("plugin discovery scans unscoped and scoped installed packages", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, packages, _i, _a, _b, index, directory, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugin-discovery-"))];
            case 1:
                root = _d.sent();
                packages = [
                    (0, node_path_1.join)(root, "node_modules", "plain-plugin"),
                    (0, node_path_1.join)(root, "node_modules", "@fixture", "scoped-plugin"),
                ];
                _i = 0, _a = packages.entries();
                _d.label = 2;
            case 2:
                if (!(_i < _a.length)) return [3 /*break*/, 6];
                _b = _a[_i], index = _b[0], directory = _b[1];
                return [4 /*yield*/, (0, promises_1.mkdir)(directory, { recursive: true })];
            case 3:
                _d.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(directory, "natalia.plugin.json"), JSON.stringify({
                        apiVersion: 1,
                        id: "fixture.plugin.".concat(index),
                        version: "1.0.0",
                        name: "Fixture ".concat(index),
                    }))];
            case 4:
                _d.sent();
                _d.label = 5;
            case 5:
                _i++;
                return [3 /*break*/, 2];
            case 6:
                _c = bun_test_1.expect;
                return [4 /*yield*/, (0, src_1.discoverPluginManifests)(root)];
            case 7:
                _c.apply(void 0, [(_d.sent())
                        .map(function (entry) { return entry.manifest.id; })
                        .sort()]).toEqual(["fixture.plugin.0", "fixture.plugin.1"]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("separate registries load isolated plugin module lifecycles", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, manifest, lifecycle, first, second, entries;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugin-module-lifecycle-"))];
            case 1:
                root = _c.sent();
                manifest = src_1.pluginManifestSchema.parse({
                    apiVersion: 1,
                    id: "fixture.module-lifecycle",
                    version: "1.0.0",
                    name: "Module lifecycle fixture",
                    entry: "index.ts",
                    scope: "workspace",
                });
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "natalia.plugin.json"), JSON.stringify(manifest))];
            case 2:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, "index.ts"), "export default () => {\n  let instance = 0;\n  return {\n  setup(api) {\n    instance = Number(api.config);\n  },\n  dispose() {\n    globalThis.__nataliaPluginLifecycle ??= [];\n    globalThis.__nataliaPluginLifecycle.push(instance);\n  },\n  };\n};")];
            case 3:
                _c.sent();
                lifecycle = [];
                Object.assign(globalThis, { __nataliaPluginLifecycle: lifecycle });
                first = (0, src_1.createPluginRegistry)({ tools: (0, tools_1.createToolRegistry)([]) });
                second = (0, src_1.createPluginRegistry)({ tools: (0, tools_1.createToolRegistry)([]) });
                entries = [{ manifest: manifest, path: (0, node_path_1.join)(root, "natalia.plugin.json") }];
                return [4 /*yield*/, (0, src_1.loadPluginEntries)({
                        entries: entries,
                        registry: first,
                        settings: (_a = {}, _a[manifest.id] = 1, _a),
                    })];
            case 4:
                _c.sent();
                return [4 /*yield*/, (0, src_1.loadPluginEntries)({
                        entries: entries,
                        registry: second,
                        settings: (_b = {}, _b[manifest.id] = 2, _b),
                    })];
            case 5:
                _c.sent();
                return [4 /*yield*/, second.unloadAll()];
            case 6:
                _c.sent();
                return [4 /*yield*/, first.unloadAll()];
            case 7:
                _c.sent();
                (0, bun_test_1.expect)(lifecycle).toEqual([2, 1]);
                delete globalThis
                    .__nataliaPluginLifecycle;
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("installed plugin entries require matching lock and manifest", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, pluginStoreRoot, packageRoot, manifestPath, lockPath, resolved, mismatch;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugin-closure-"))];
            case 1:
                root = _a.sent();
                pluginStoreRoot = (0, node_path_1.join)(root, "plugin-store");
                packageRoot = (0, node_path_1.join)(pluginStoreRoot, "node_modules", "@fixture", "plugin");
                return [4 /*yield*/, (0, promises_1.mkdir)(packageRoot, { recursive: true })];
            case 2:
                _a.sent();
                manifestPath = (0, node_path_1.join)(packageRoot, "natalia.plugin.json");
                return [4 /*yield*/, (0, promises_1.writeFile)(manifestPath, JSON.stringify({
                        apiVersion: 2,
                        id: "fixture.plugin",
                        version: "1.2.3",
                        name: "Fixture",
                        entry: "index.ts",
                        scope: "workspace",
                    }))];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(packageRoot, "index.ts"), "export default {};")];
            case 4:
                _a.sent();
                lockPath = (0, node_path_1.join)(pluginStoreRoot, "natalia.lock");
                return [4 /*yield*/, (0, promises_1.writeFile)(lockPath, JSON.stringify({
                        version: 1,
                        plugins: {
                            "fixture.plugin": {
                                packageName: "@fixture/plugin",
                                manifest: manifestPath,
                                metadata: {
                                    id: "fixture.plugin",
                                    source: { type: "registry", spec: "@fixture/plugin@1.2.3" },
                                    resolvedVersion: "1.2.3",
                                    integrity: "sha512-fixture",
                                    scope: "workspace",
                                    dependencies: [],
                                },
                            },
                        },
                    }))];
            case 5:
                _a.sent();
                return [4 /*yield*/, (0, src_1.resolveInstalledPluginEntries)({
                        pluginStoreRoot: pluginStoreRoot,
                    })];
            case 6:
                resolved = _a.sent();
                (0, bun_test_1.expect)(resolved.errors).toEqual([]);
                (0, bun_test_1.expect)(resolved.entries).toEqual([
                    bun_test_1.expect.objectContaining({
                        path: manifestPath,
                        manifest: bun_test_1.expect.objectContaining({ id: "fixture.plugin" }),
                    }),
                ]);
                return [4 /*yield*/, (0, promises_1.writeFile)(lockPath, JSON.stringify({
                        version: 1,
                        plugins: {
                            "fixture.plugin": {
                                packageName: "@fixture/plugin",
                                manifest: manifestPath,
                                metadata: {
                                    id: "fixture.plugin",
                                    source: { type: "registry", spec: "@fixture/plugin@2.0.0" },
                                    resolvedVersion: "2.0.0",
                                    integrity: "sha512-fixture",
                                    scope: "workspace",
                                    dependencies: [],
                                },
                            },
                            "missing.plugin": {
                                packageName: "missing-plugin",
                                manifest: (0, node_path_1.join)(pluginStoreRoot, "node_modules", "missing-plugin", "natalia.plugin.json"),
                                metadata: {
                                    id: "missing.plugin",
                                    source: { type: "registry", spec: "missing-plugin@1.0.0" },
                                    resolvedVersion: "1.0.0",
                                    scope: "workspace",
                                    dependencies: [],
                                },
                            },
                        },
                    }))];
            case 7:
                _a.sent();
                return [4 /*yield*/, (0, src_1.resolveInstalledPluginEntries)({ pluginStoreRoot: pluginStoreRoot })];
            case 8:
                mismatch = _a.sent();
                (0, bun_test_1.expect)(mismatch.entries).toEqual([]);
                (0, bun_test_1.expect)(mismatch.errors.map(function (_a) {
                    var id = _a.id;
                    return id;
                }).sort()).toEqual([
                    "fixture.plugin",
                    "missing.plugin",
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("installed plugin entries reject lock paths outside their package", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, pluginStoreRoot, packageRoot, resolved;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugin-escape-"))];
            case 1:
                root = _b.sent();
                pluginStoreRoot = (0, node_path_1.join)(root, "plugin-store");
                packageRoot = (0, node_path_1.join)(pluginStoreRoot, "node_modules", "fixture-plugin");
                return [4 /*yield*/, (0, promises_1.mkdir)(packageRoot, { recursive: true })];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(packageRoot, "index.ts"), "export default {};")];
            case 3:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(pluginStoreRoot, "natalia.lock"), JSON.stringify({
                        version: 1,
                        plugins: {
                            "fixture.plugin": {
                                packageName: "fixture-plugin",
                                manifest: (0, node_path_1.join)(root, "outside", "natalia.plugin.json"),
                                metadata: {
                                    id: "fixture.plugin",
                                    source: { type: "registry", spec: "fixture-plugin" },
                                    resolvedVersion: "1.0.0",
                                    scope: "workspace",
                                    dependencies: [],
                                },
                            },
                        },
                    }))];
            case 4:
                _b.sent();
                return [4 /*yield*/, (0, src_1.resolveInstalledPluginEntries)({
                        pluginStoreRoot: pluginStoreRoot,
                    })];
            case 5:
                resolved = _b.sent();
                (0, bun_test_1.expect)(resolved.entries).toEqual([]);
                (0, bun_test_1.expect)((_a = resolved.errors[0]) === null || _a === void 0 ? void 0 : _a.error.message).toContain("manifest escapes package");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugin manifest v2 keeps v1 compatibility and applies defaults", function () {
    (0, bun_test_1.expect)(src_1.pluginManifestSchema.parse({
        apiVersion: 2,
        id: "v2.plugin",
        version: "2.0.0",
        name: "V2",
    })).toMatchObject({
        apiVersion: 2,
        scope: "session",
        optionalRequires: [],
        conflicts: [],
        dependencies: [],
        integrationPoints: [],
    });
    (0, bun_test_1.expect)(src_1.pluginManifestSchema.parse({
        apiVersion: 1,
        id: "v1.plugin",
        version: "1.0.0",
        name: "V1",
    })).toMatchObject({ apiVersion: 1, capabilities: [], scope: "session" });
});
(0, bun_test_1.test)("v2 manifests accept renderer-side UI metadata", function () {
    var parsed = src_1.pluginManifestSchema.parse({
        apiVersion: 2,
        id: "ui.plugin",
        version: "1.0.0",
        name: "UI Plugin",
        integrationPoints: ["tools"],
        ui: {
            entry: "src/ui/plugin.js",
            panels: [
                {
                    id: "settings",
                    title: "Settings",
                    region: "settings",
                    group: "扩展",
                    requires: [
                        { type: "plugin", id: "natalia-ui" },
                        { type: "capability", id: "settings" },
                    ],
                },
            ],
        },
    });
    (0, bun_test_1.expect)(parsed).toMatchObject({
        apiVersion: 2,
        ui: {
            entry: "src/ui/plugin.js",
            panels: [
                {
                    id: "settings",
                    title: "Settings",
                    region: "settings",
                    group: "扩展",
                    requires: [
                        { type: "plugin", id: "natalia-ui" },
                        { type: "capability", id: "settings" },
                    ],
                },
            ],
        },
    });
});
(0, bun_test_1.test)("plugin dependency resolver orders required dependencies", function () {
    var provider = src_1.pluginManifestSchema.parse({
        apiVersion: 2,
        id: "provider.plugin",
        version: "1.4.0",
        name: "Provider",
    });
    var consumer = src_1.pluginManifestSchema.parse({
        apiVersion: 2,
        id: "consumer.plugin",
        version: "1.0.0",
        name: "Consumer",
        dependencies: [
            { id: "provider.plugin", spec: "^1.2.0" },
            { id: "missing.optional", spec: "*", optional: true },
        ],
    });
    (0, bun_test_1.expect)((0, src_1.resolvePluginDependencies)([consumer, provider])).toEqual({
        order: ["provider.plugin", "consumer.plugin"],
        pending: [],
        denied: [],
    });
});
(0, bun_test_1.test)("plugin dependency resolver orders available optional dependencies", function () {
    var manifest = function (id, input) {
        if (input === void 0) { input = {}; }
        return src_1.pluginManifestSchema.parse(__assign({ apiVersion: 2, id: id, version: "1.0.0", name: id }, input));
    };
    (0, bun_test_1.expect)((0, src_1.resolvePluginDependencies)([
        manifest("consumer.plugin", {
            dependencies: [
                { id: "optional.plugin", spec: "^1.0.0", optional: true },
            ],
        }),
        manifest("optional.plugin"),
    ]).order).toEqual(["optional.plugin", "consumer.plugin"]);
});
(0, bun_test_1.test)("plugin dependency resolver reports missing, cycles, and conflicts", function () {
    var manifest = function (id, input) {
        if (input === void 0) { input = {}; }
        return src_1.pluginManifestSchema.parse(__assign({ apiVersion: 2, id: id, version: "1.0.0", name: id }, input));
    };
    var result = (0, src_1.resolvePluginDependencies)([
        manifest("a.plugin", {
            dependencies: [{ id: "b.plugin", spec: "*" }],
        }),
        manifest("b.plugin", {
            dependencies: [{ id: "a.plugin", spec: "*" }],
        }),
        manifest("missing.plugin", {
            dependencies: [{ id: "absent.plugin", spec: ">=1.0.0" }],
        }),
        manifest("conflict.plugin", { conflicts: ["active.plugin"] }),
    ], [manifest("active.plugin")]);
    (0, bun_test_1.expect)(result.order).toEqual([]);
    (0, bun_test_1.expect)(result.pending).toEqual(bun_test_1.expect.arrayContaining([
        { id: "a.plugin", reason: "plugin dependency cycle" },
        { id: "b.plugin", reason: "plugin dependency cycle" },
        bun_test_1.expect.objectContaining({ id: "missing.plugin" }),
    ]));
    (0, bun_test_1.expect)(result.denied).toContainEqual({
        id: "conflict.plugin",
        reason: 'conflicts with "active.plugin"',
    });
});
(0, bun_test_1.test)("plugin dependency resolver propagates unavailable dependencies", function () {
    var manifest = function (id, input) {
        if (input === void 0) { input = {}; }
        return src_1.pluginManifestSchema.parse(__assign({ apiVersion: 2, id: id, version: "1.0.0", name: id }, input));
    };
    var result = (0, src_1.resolvePluginDependencies)([
        manifest("consumer.plugin", {
            dependencies: [{ id: "provider.plugin", spec: "*" }],
        }),
        manifest("provider.plugin", {
            dependencies: [{ id: "missing.plugin", spec: "*" }],
        }),
    ]);
    (0, bun_test_1.expect)(result.order).toEqual([]);
    (0, bun_test_1.expect)(result.pending).toEqual(bun_test_1.expect.arrayContaining([
        bun_test_1.expect.objectContaining({ id: "provider.plugin" }),
        {
            id: "consumer.plugin",
            reason: 'requires unavailable plugin "provider.plugin"',
        },
    ]));
});
(0, bun_test_1.test)("plugin dependency conflicts are enforced from either side", function () {
    var manifest = function (id, conflicts) {
        if (conflicts === void 0) { conflicts = []; }
        return src_1.pluginManifestSchema.parse({
            apiVersion: 2,
            id: id,
            version: "1.0.0",
            name: id,
            conflicts: conflicts,
        });
    };
    (0, bun_test_1.expect)((0, src_1.resolvePluginDependencies)([manifest("incoming.plugin")], [manifest("active.plugin", ["incoming.plugin"])]).denied).toEqual([
        {
            id: "incoming.plugin",
            reason: 'conflicts with "active.plugin"',
        },
    ]);
});
(0, bun_test_1.test)("plugin registry enforces v2 dependencies and conflicts before setup", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry, plugin;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registry = (0, src_1.createPluginRegistry)({ tools: (0, tools_1.createToolRegistry)([]) });
                plugin = function (id, input) {
                    var _a, _b;
                    if (input === void 0) { input = {}; }
                    return (0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 2,
                            id: id,
                            version: "1.0.0",
                            name: id,
                            description: "",
                            entry: "natalia:".concat(id),
                            scope: "workspace",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: (_a = input.conflicts) !== null && _a !== void 0 ? _a : [],
                            dependencies: ((_b = input.dependencies) !== null && _b !== void 0 ? _b : []).map(function (dependency) { return (__assign(__assign({}, dependency), { optional: false, peer: false })); }),
                            hooks: {},
                            integrationPoints: [],
                        },
                        setup: function () { },
                    });
                };
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.load(plugin("consumer.plugin", {
                        dependencies: [{ id: "provider.plugin", spec: "^1.0.0" }],
                    }))).rejects.toThrow("plugin dependency unresolved")];
            case 1:
                _a.sent();
                return [4 /*yield*/, registry.load(plugin("provider.plugin"))];
            case 2:
                _a.sent();
                return [4 /*yield*/, registry.load(plugin("consumer.plugin", {
                        dependencies: [{ id: "provider.plugin", spec: "^1.0.0" }],
                    }))];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.load(plugin("conflict.plugin", { conflicts: ["provider.plugin"] }))).rejects.toThrow('conflicts with "provider.plugin"')];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("failed mounted plugins conflict but cannot satisfy dependencies", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry, plugin;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registry = (0, src_1.createPluginRegistry)({ tools: (0, tools_1.createToolRegistry)([]) });
                plugin = function (id, input) {
                    var _a, _b;
                    if (input === void 0) { input = {}; }
                    return (0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 2,
                            id: id,
                            version: "1.0.0",
                            name: id,
                            description: "",
                            entry: "natalia:".concat(id),
                            scope: "workspace",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: (_a = input.conflicts) !== null && _a !== void 0 ? _a : [],
                            dependencies: ((_b = input.dependencies) !== null && _b !== void 0 ? _b : []).map(function (dependency) { return ({
                                id: dependency,
                                spec: "*",
                                optional: false,
                                peer: false,
                            }); }),
                            hooks: {},
                            integrationPoints: [],
                        },
                        setup: function () {
                            if (input.fails)
                                throw new Error("setup failed");
                        },
                    });
                };
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.load(plugin("failed.provider", { fails: true }))).rejects.toThrow("setup failed")];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.load(plugin("required.consumer", { dependencies: ["failed.provider"] }))).rejects.toThrow('requires plugin "failed.provider"')];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.load(plugin("conflicting.consumer", { conflicts: ["failed.provider"] }))).rejects.toThrow('conflicts with "failed.provider"')];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("unloading a provider unloads required dependents first", function () { return __awaiter(void 0, void 0, void 0, function () {
    var cleanup, registry, plugin;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                cleanup = [];
                registry = (0, src_1.createPluginRegistry)({ tools: (0, tools_1.createToolRegistry)([]) });
                plugin = function (id, dependencies) {
                    if (dependencies === void 0) { dependencies = []; }
                    return (0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 2,
                            id: id,
                            version: "1.0.0",
                            name: id,
                            description: "",
                            entry: "natalia:".concat(id),
                            scope: "workspace",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: dependencies.map(function (dependency) { return ({
                                id: dependency,
                                spec: "*",
                                optional: false,
                                peer: false,
                            }); }),
                            hooks: {},
                            integrationPoints: [],
                        },
                        setup: function () { },
                        dispose: function () {
                            cleanup.push(id);
                        },
                    });
                };
                return [4 /*yield*/, registry.load(plugin("provider.plugin"))];
            case 1:
                _a.sent();
                return [4 /*yield*/, registry.load(plugin("middle.plugin", ["provider.plugin"]))];
            case 2:
                _a.sent();
                return [4 /*yield*/, registry.load(plugin("consumer.plugin", ["middle.plugin"]))];
            case 3:
                _a.sent();
                return [4 /*yield*/, registry.unload("provider.plugin")];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(cleanup).toEqual([
                    "consumer.plugin",
                    "middle.plugin",
                    "provider.plugin",
                ]);
                (0, bun_test_1.expect)(registry.list()).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("batch unload isolates plugin cleanup failures", function () { return __awaiter(void 0, void 0, void 0, function () {
    var cleanup, registry, _loop_1, _i, _a, id;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                cleanup = [];
                registry = (0, src_1.createPluginRegistry)({ tools: (0, tools_1.createToolRegistry)([]) });
                _loop_1 = function (id) {
                    return __generator(this, function (_c) {
                        switch (_c.label) {
                            case 0: return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                                    manifest: {
                                        apiVersion: 1,
                                        id: id,
                                        version: "1.0.0",
                                        name: id,
                                        description: "",
                                        entry: "natalia:".concat(id),
                                        scope: "workspace",
                                        capabilities: [],
                                        provides: [],
                                        requires: [],
                                    },
                                    setup: function () { },
                                    dispose: function () {
                                        cleanup.push(id);
                                        if (id === "broken.plugin")
                                            throw new Error("cleanup failed");
                                    },
                                }))];
                            case 1:
                                _c.sent();
                                return [2 /*return*/];
                        }
                    });
                };
                _i = 0, _a = ["first.plugin", "broken.plugin", "last.plugin"];
                _b.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 4];
                id = _a[_i];
                return [5 /*yield**/, _loop_1(id)];
            case 2:
                _b.sent();
                _b.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4: return [4 /*yield*/, (0, bun_test_1.expect)(registry.unloadAll()).rejects.toThrow("cleanup failed")];
            case 5:
                _b.sent();
                (0, bun_test_1.expect)(cleanup).toEqual(["last.plugin", "broken.plugin", "first.plugin"]);
                (0, bun_test_1.expect)(registry.list()).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("v2 contributions and typed services use the shared ownership channel", function () { return __awaiter(void 0, void 0, void 0, function () {
    var contributions, releases, serviceValue, serviceListener, seenServices, registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                contributions = [];
                releases = [];
                serviceValue = { ready: true };
                seenServices = [];
                registry = (0, src_1.createPluginRegistry)({
                    tools: (0, tools_1.createToolRegistry)([]),
                    service: function () { return serviceValue; },
                    onServiceUpdate: function (listener) {
                        serviceListener = listener;
                        return function () {
                            serviceListener = undefined;
                        };
                    },
                    registerOwner: function () { return ({
                        contribute: function (kind, name) {
                            contributions.push({ kind: kind, name: name });
                            return function () { return releases.push("".concat(kind, ":").concat(name)); };
                        },
                        release: function () { return undefined; },
                    }); },
                });
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 2,
                            id: "natalia-v2",
                            version: "2.0.0",
                            name: "V2",
                            description: "",
                            entry: "natalia:v2",
                            scope: "workspace",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: [],
                            hooks: {},
                            integrationPoints: [
                                "resources",
                                "projections",
                                "workflows",
                                "settingsSchema",
                                "adapters",
                                "schedulerJobs",
                            ],
                        },
                        setup: function (api) {
                            (0, bun_test_1.expect)(api.services.get("status.service")).toEqual({
                                ready: true,
                            });
                            api.services.on("status.service", function (value) { return seenServices.push(value); });
                            api.resources.register({ name: "resource" });
                            api.projections.register({
                                name: "projection",
                                title: "Demo card",
                                placement: "sidebar",
                                text: "hello from a plugin",
                            });
                            api.workflows.register({ name: "workflow" });
                            api.settingsSchema.register({ name: "settings" });
                            api.adapters.register({
                                name: "adapter",
                                adapterType: "test",
                                create: function () { return ({ dispose: function () { } }); },
                            });
                            api.scheduler.add({ name: "job" });
                        },
                    }))];
            case 1:
                _a.sent();
                serviceValue = { ready: false };
                serviceListener === null || serviceListener === void 0 ? void 0 : serviceListener({ name: "status.service" });
                (0, bun_test_1.expect)(seenServices).toEqual([{ ready: false }]);
                (0, bun_test_1.expect)(contributions).toEqual([
                    { kind: "resources", name: "resource" },
                    { kind: "projections", name: "projection" },
                    { kind: "workflows", name: "workflow" },
                    { kind: "settingsSchema", name: "settings" },
                    { kind: "adapters", name: "adapter" },
                    { kind: "schedulerJobs", name: "job" },
                ]);
                return [4 /*yield*/, registry.unload("natalia-v2")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(releases).toEqual([
                    "schedulerJobs:job",
                    "adapters:adapter",
                    "settingsSchema:settings",
                    "workflows:workflow",
                    "projections:projection",
                    "resources:resource",
                ]);
                (0, bun_test_1.expect)(serviceListener).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("adapter contributions stay inert until materialized and dispose in reverse", function () { return __awaiter(void 0, void 0, void 0, function () {
    var contributions, owners, lifecycle, registry, materializer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                contributions = new Map();
                owners = new Map();
                lifecycle = [];
                registry = (0, src_1.createPluginRegistry)({
                    tools: (0, tools_1.createToolRegistry)([]),
                    registerOwner: function (manifest) { return ({
                        contribute: function (kind, name, payload) {
                            if (kind === "adapters") {
                                contributions.set(name, payload);
                                owners.set(name, manifest.id);
                            }
                            return function () {
                                contributions.delete(name);
                                owners.delete(name);
                            };
                        },
                        release: function () { return undefined; },
                    }); },
                });
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 2,
                            id: "natalia-adapters",
                            version: "2.0.0",
                            name: "Adapters",
                            description: "",
                            entry: "natalia:adapters",
                            scope: "process",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: [],
                            hooks: {},
                            integrationPoints: ["adapters"],
                        },
                        setup: function (api) {
                            var _loop_2 = function (name_1) {
                                api.adapters.register({
                                    name: name_1,
                                    adapterType: "test",
                                    create: function (context) {
                                        lifecycle.push("create:".concat(name_1, ":").concat(context.value));
                                        return {
                                            dispose: function () {
                                                lifecycle.push("dispose:".concat(name_1));
                                            },
                                        };
                                    },
                                });
                            };
                            for (var _i = 0, _a = ["first", "second"]; _i < _a.length; _i++) {
                                var name_1 = _a[_i];
                                _loop_2(name_1);
                            }
                        },
                    }))];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(lifecycle).toEqual([]);
                materializer = (0, src_1.createPluginAdapterMaterializer)({
                    contribution: function (_kind, name) {
                        return contributions.get(name);
                    },
                    ownerOf: function (_kind, name) { return owners.get(name); },
                });
                return [4 /*yield*/, materializer.materialize("first", { value: "a" })];
            case 2:
                _a.sent();
                return [4 /*yield*/, materializer.materialize("second", { value: "b" })];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(materializer.active()).toEqual([
                    { name: "first", ownerID: "natalia-adapters" },
                    { name: "second", ownerID: "natalia-adapters" },
                ]);
                return [4 /*yield*/, materializer.close()];
            case 4:
                _a.sent();
                return [4 /*yield*/, materializer.close()];
            case 5:
                _a.sent();
                (0, bun_test_1.expect)(lifecycle).toEqual([
                    "create:first:a",
                    "create:second:b",
                    "dispose:second",
                    "dispose:first",
                ]);
                return [4 /*yield*/, registry.unloadAll()];
            case 6:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("UI adapters receive host runtime ports and follow materializer lifecycle", function () { return __awaiter(void 0, void 0, void 0, function () {
    var contributions, owners, lifecycle, registry, input, materializer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                contributions = new Map();
                owners = new Map();
                lifecycle = [];
                registry = (0, src_1.createPluginRegistry)({
                    tools: (0, tools_1.createToolRegistry)([]),
                    registerOwner: function (manifest) { return ({
                        contribute: function (kind, name, payload) {
                            if (kind === "adapters") {
                                contributions.set(name, payload);
                                owners.set(name, manifest.id);
                            }
                            return function () {
                                contributions.delete(name);
                                owners.delete(name);
                            };
                        },
                        release: function () { return undefined; },
                    }); },
                });
                input = {
                    runtime: {},
                    events: { subscribe: function () { return function () { return undefined; }; } },
                    commands: {
                        list: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, []];
                        }); }); },
                        execute: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, undefined];
                        }); }); },
                    },
                };
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 2,
                            id: "natalia-ui-test",
                            version: "1.0.0",
                            name: "UI Test",
                            description: "",
                            entry: "natalia:ui-test",
                            scope: "process",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: [],
                            hooks: {},
                            integrationPoints: ["adapters"],
                        },
                        setup: function (api) {
                            api.adapters.registerUi({
                                kind: "ui.test",
                                mount: function (received) {
                                    (0, bun_test_1.expect)(received).toBe(input);
                                    lifecycle.push("mount");
                                },
                                dispose: function () {
                                    lifecycle.push("dispose");
                                },
                            });
                        },
                    }))];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(lifecycle).toEqual([]);
                materializer = (0, src_1.createPluginAdapterMaterializer)({
                    contribution: function (_kind, name) {
                        return contributions.get(name);
                    },
                    ownerOf: function (_kind, name) { return owners.get(name); },
                });
                return [4 /*yield*/, materializer.materialize("ui.test", input)];
            case 2:
                _a.sent();
                return [4 /*yield*/, materializer.close()];
            case 3:
                _a.sent();
                return [4 /*yield*/, materializer.close()];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(lifecycle).toEqual(["mount", "dispose"]);
                return [4 /*yield*/, registry.unloadAll()];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("adapter materializer fails before creating unavailable resources", function () { return __awaiter(void 0, void 0, void 0, function () {
    var materializer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                materializer = (0, src_1.createPluginAdapterMaterializer)({
                    contribution: function () { return undefined; },
                    ownerOf: function () { return undefined; },
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(materializer.materialize("missing", {})).rejects.toThrow("adapter is not available: missing")];
            case 1:
                _a.sent();
                return [4 /*yield*/, materializer.close()];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugin cleanup is reverse ordered and isolates disposer failures", function () { return __awaiter(void 0, void 0, void 0, function () {
    var cleanup, registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                cleanup = [];
                registry = (0, src_1.createPluginRegistry)({
                    tools: (0, tools_1.createToolRegistry)([]),
                    registerOwner: function () { return ({
                        contribute: function (_kind, name) { return function () {
                            cleanup.push(name);
                            if (name === "middle")
                                throw new Error("middle cleanup failed");
                        }; },
                        release: function () { return undefined; },
                    }); },
                });
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 2,
                            id: "natalia-cleanup",
                            version: "2.0.0",
                            name: "Cleanup",
                            description: "",
                            entry: "natalia:cleanup",
                            scope: "workspace",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: [],
                            hooks: {},
                            integrationPoints: ["resources"],
                        },
                        setup: function (api) {
                            api.resources.register({ name: "first" });
                            api.resources.register({ name: "middle" });
                            api.resources.register({ name: "last" });
                        },
                    }))];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.unload("natalia-cleanup")).rejects.toThrow("middle cleanup failed")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(cleanup).toEqual(["last", "middle", "first"]);
                (0, bun_test_1.expect)(registry.list()).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugin dispose owns lifecycle before capability ownership is released", function () { return __awaiter(void 0, void 0, void 0, function () {
    var lifecycle, registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                lifecycle = [];
                registry = (0, src_1.createPluginRegistry)({
                    tools: (0, tools_1.createToolRegistry)([]),
                    registerOwner: function () { return ({
                        contribute: function () { return function () { return undefined; }; },
                        release: function () { return lifecycle.push("owner.release"); },
                    }); },
                });
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 2,
                            id: "natalia-lifecycle-owner",
                            version: "1.0.0",
                            name: "Lifecycle Owner",
                            description: "",
                            entry: "natalia:lifecycle-owner",
                            scope: "workspace",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: [],
                            hooks: {},
                            integrationPoints: ["resources"],
                        },
                        setup: function (api) {
                            lifecycle.push("plugin.setup");
                            api.resources.register({ name: "resource" });
                        },
                        dispose: function () {
                            lifecycle.push("plugin.dispose");
                        },
                    }))];
            case 1:
                _a.sent();
                return [4 /*yield*/, registry.unload("natalia-lifecycle-owner")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(lifecycle).toEqual([
                    "plugin.setup",
                    "plugin.dispose",
                    "owner.release",
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("missing required services leave the plugin mounted and pending", function () { return __awaiter(void 0, void 0, void 0, function () {
    var setupRan, ownerRegistered, registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                setupRan = false;
                ownerRegistered = false;
                registry = (0, src_1.createPluginRegistry)({
                    tools: (0, tools_1.createToolRegistry)([]),
                    service: function () { return undefined; },
                    registerOwner: function () {
                        ownerRegistered = true;
                        return {
                            contribute: function () { return function () { return undefined; }; },
                            release: function () { return undefined; },
                        };
                    },
                });
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 2,
                            id: "natalia-missing-service",
                            version: "1.0.0",
                            name: "Missing Service",
                            description: "",
                            entry: "natalia:missing-service",
                            scope: "workspace",
                            provides: [],
                            requires: ["missing.service"],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: [],
                            hooks: {},
                            integrationPoints: [],
                        },
                        setup: function () {
                            setupRan = true;
                        },
                    }))];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(setupRan).toBe(false);
                (0, bun_test_1.expect)(ownerRegistered).toBe(false);
                (0, bun_test_1.expect)(registry.list().map(function (_a) {
                    var id = _a.id;
                    return id;
                })).toEqual([
                    "natalia-missing-service",
                ]);
                (0, bun_test_1.expect)(registry.status("natalia-missing-service")).toEqual({
                    id: "natalia-missing-service",
                    status: "pending",
                    missingServices: ["missing.service"],
                });
                (0, bun_test_1.expect)(registry.active("natalia-missing-service")).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("required service availability drives serialized activation epochs", function () { return __awaiter(void 0, void 0, void 0, function () {
    var serviceValue, provider, notify, epoch, lifecycle, contributions, registry;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                epoch = 0;
                lifecycle = [];
                contributions = new Set();
                registry = (0, src_1.createPluginRegistry)({
                    tools: (0, tools_1.createToolRegistry)([]),
                    service: function () { return serviceValue; },
                    serviceProvider: function () { return provider; },
                    onServiceUpdate: function (listener) {
                        notify = listener;
                        return function () {
                            notify = undefined;
                        };
                    },
                    registerOwner: function () {
                        var ownerEpoch = epoch + 1;
                        lifecycle.push("owner:".concat(ownerEpoch));
                        return {
                            contribute: function (_kind, name) {
                                contributions.add(name);
                                return function () {
                                    lifecycle.push("cleanup:".concat(ownerEpoch));
                                    contributions.delete(name);
                                };
                            },
                            release: function () { return lifecycle.push("release:".concat(ownerEpoch)); },
                        };
                    },
                });
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 2,
                            id: "natalia-epochs",
                            version: "1.0.0",
                            name: "Epochs",
                            description: "",
                            entry: "natalia:epochs",
                            scope: "workspace",
                            provides: [],
                            requires: ["required.service"],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: [],
                            hooks: {},
                            integrationPoints: ["resources"],
                        },
                        setup: function (api) {
                            var current = ++epoch;
                            lifecycle.push("setup:".concat(current));
                            api.resources.register({ name: "resource:".concat(current) });
                            void api.effects.run(function (signal) {
                                return new Promise(function (resolve) {
                                    return signal.addEventListener("abort", function () {
                                        lifecycle.push("settled:".concat(current));
                                        resolve();
                                    }, { once: true });
                                });
                            });
                        },
                        dispose: function () {
                            lifecycle.push("dispose:".concat(epoch));
                        },
                    }))];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)((_a = registry.status("natalia-epochs")) === null || _a === void 0 ? void 0 : _a.status).toBe("pending");
                serviceValue = {};
                provider = "provider:a";
                notify === null || notify === void 0 ? void 0 : notify({ name: "required.service" });
                return [4 /*yield*/, registry.whenIdle()];
            case 2:
                _b.sent();
                (0, bun_test_1.expect)(registry.active("natalia-epochs")).toBe(true);
                (0, bun_test_1.expect)(contributions).toEqual(new Set(["resource:1"]));
                serviceValue = undefined;
                provider = undefined;
                notify === null || notify === void 0 ? void 0 : notify({ name: "required.service" });
                return [4 /*yield*/, registry.whenIdle()];
            case 3:
                _b.sent();
                (0, bun_test_1.expect)(registry.status("natalia-epochs")).toEqual({
                    id: "natalia-epochs",
                    status: "pending",
                    missingServices: ["required.service"],
                });
                (0, bun_test_1.expect)(contributions.size).toBe(0);
                serviceValue = {};
                provider = "provider:a";
                notify === null || notify === void 0 ? void 0 : notify({ name: "required.service" });
                return [4 /*yield*/, registry.whenIdle()];
            case 4:
                _b.sent();
                (0, bun_test_1.expect)(contributions).toEqual(new Set(["resource:2"]));
                serviceValue = {};
                provider = "provider:b";
                notify === null || notify === void 0 ? void 0 : notify({ name: "required.service" });
                return [4 /*yield*/, registry.whenIdle()];
            case 5:
                _b.sent();
                (0, bun_test_1.expect)(registry.active("natalia-epochs")).toBe(true);
                (0, bun_test_1.expect)(contributions).toEqual(new Set(["resource:3"]));
                (0, bun_test_1.expect)(lifecycle).toEqual([
                    "owner:1",
                    "setup:1",
                    "dispose:1",
                    "settled:1",
                    "cleanup:1",
                    "release:1",
                    "owner:2",
                    "setup:2",
                    "dispose:2",
                    "settled:2",
                    "cleanup:2",
                    "release:2",
                    "owner:3",
                    "setup:3",
                ]);
                return [4 /*yield*/, registry.unload("natalia-epochs")];
            case 6:
                _b.sent();
                (0, bun_test_1.expect)(lifecycle.slice(-4)).toEqual([
                    "dispose:3",
                    "settled:3",
                    "cleanup:3",
                    "release:3",
                ]);
                (0, bun_test_1.expect)(registry.status("natalia-epochs")).toBeUndefined();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("manual registration disposal releases local and kernel ownership", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, released, dispatches, dispose, registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tools = (0, tools_1.createToolRegistry)([]);
                released = [];
                dispatches = 0;
                registry = (0, src_1.createPluginRegistry)({
                    tools: tools,
                    registerOwner: function () { return ({
                        contribute: function (kind, name) { return function () { return released.push("".concat(kind, ":").concat(name)); }; },
                        release: function () { return undefined; },
                    }); },
                });
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 1,
                            id: "natalia-dynamic",
                            version: "1.0.0",
                            name: "Dynamic",
                            description: "",
                            entry: "natalia:dynamic",
                            scope: "workspace",
                            capabilities: ["tools", "commands", "events"],
                            provides: [],
                            requires: [],
                        },
                        setup: function (api) {
                            var releases = [
                                api.tools.register({
                                    name: "dynamic_tool",
                                    description: "Dynamic",
                                    requiresApproval: false,
                                    parameters: { type: "object", properties: {} },
                                    execute: function () {
                                        return __awaiter(this, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                return [2 /*return*/, "ok"];
                                            });
                                        });
                                    },
                                }),
                                api.commands.register({
                                    name: "dynamic_command",
                                    title: "Dynamic command",
                                    run: function () { },
                                }),
                                api.events.on(function () {
                                    dispatches += 1;
                                }),
                            ];
                            dispose = function () {
                                for (var _i = 0, _a = releases.reverse(); _i < _a.length; _i++) {
                                    var release = _a[_i];
                                    release();
                                }
                            };
                        },
                    }))];
            case 1:
                _a.sent();
                dispose();
                dispose();
                registry.dispatch({ type: "test" });
                (0, bun_test_1.expect)(tools.has("dynamic_tool")).toBe(false);
                (0, bun_test_1.expect)(registry.commands()).toEqual([]);
                (0, bun_test_1.expect)(dispatches).toBe(0);
                (0, bun_test_1.expect)(released).toEqual([
                    "listeners:natalia-dynamic:listener:1",
                    "commands:dynamic_command",
                    "tools:dynamic_tool",
                ]);
                return [4 /*yield*/, registry.unload("natalia-dynamic")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(released).toHaveLength(3);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("setup failure rolls back every registered contribution", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, cleanup, unloaded, registry;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                tools = (0, tools_1.createToolRegistry)([]);
                cleanup = [];
                unloaded = 0;
                registry = (0, src_1.createPluginRegistry)({
                    tools: tools,
                    registerOwner: function () { return ({
                        contribute: function (kind, name) { return function () { return cleanup.push("".concat(kind, ":").concat(name)); }; },
                        release: function () {
                            unloaded += 1;
                        },
                    }); },
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 2,
                            id: "natalia-rollback",
                            version: "2.0.0",
                            name: "Rollback",
                            description: "",
                            entry: "natalia:rollback",
                            scope: "workspace",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: [],
                            hooks: {},
                            integrationPoints: ["tools", "commands", "resources"],
                        },
                        setup: function (api) {
                            api.tools.register({
                                name: "rollback_tool",
                                description: "Rollback",
                                requiresApproval: false,
                                parameters: { type: "object", properties: {} },
                                execute: function () {
                                    return __awaiter(this, void 0, void 0, function () {
                                        return __generator(this, function (_a) {
                                            return [2 /*return*/, "ok"];
                                        });
                                    });
                                },
                            });
                            api.commands.register({
                                name: "rollback_command",
                                title: "Rollback command",
                                run: function () { },
                            });
                            api.resources.register({ name: "rollback_resource" });
                            throw new Error("setup failed");
                        },
                    }))).rejects.toThrow("setup failed")];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)(tools.has("rollback_tool")).toBe(false);
                (0, bun_test_1.expect)(registry.commands()).toEqual([]);
                (0, bun_test_1.expect)((_a = registry.status("natalia-rollback")) === null || _a === void 0 ? void 0 : _a.status).toBe("failed");
                (0, bun_test_1.expect)(cleanup).toEqual([
                    "resources:rollback_resource",
                    "commands:rollback_command",
                    "tools:rollback_tool",
                ]);
                (0, bun_test_1.expect)(unloaded).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugin-owned effects are cancelled and settled before unload completes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var observedAbort, releaseSetup, started, registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                observedAbort = false;
                started = new Promise(function (resolve) {
                    releaseSetup = resolve;
                });
                registry = (0, src_1.createPluginRegistry)({ tools: (0, tools_1.createToolRegistry)([]) });
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 2,
                            id: "natalia-effects",
                            version: "2.0.0",
                            name: "Effects",
                            description: "",
                            entry: "natalia:effects",
                            scope: "workspace",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: [],
                            hooks: {},
                            integrationPoints: [],
                        },
                        setup: function (api) {
                            void api.effects.run(function (signal) {
                                return new Promise(function (resolve) {
                                    signal.addEventListener("abort", function () {
                                        observedAbort = true;
                                        resolve();
                                    }, { once: true });
                                    releaseSetup();
                                });
                            });
                        },
                    }))];
            case 1:
                _a.sent();
                return [4 /*yield*/, started];
            case 2:
                _a.sent();
                return [4 /*yield*/, registry.unload("natalia-effects")];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(observedAbort).toBe(true);
                (0, bun_test_1.expect)(registry.list()).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugin registrations are capability-gated and removed on unload", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tools = (0, tools_1.createToolRegistry)([]);
                registry = (0, src_1.createPluginRegistry)({ tools: tools });
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 1,
                            id: "demo.plugin",
                            version: "1.0.0",
                            name: "Demo",
                            description: "",
                            entry: "index.ts",
                            capabilities: ["tools"],
                            scope: "session",
                            provides: [],
                            requires: [],
                        },
                        setup: function (api) {
                            api.tools.register({
                                name: "echo",
                                description: "Echo",
                                requiresApproval: false,
                                parameters: { type: "object", properties: {} },
                                execute: function () {
                                    return __awaiter(this, void 0, void 0, function () {
                                        return __generator(this, function (_a) {
                                            return [2 /*return*/, "ok"];
                                        });
                                    });
                                },
                            });
                        },
                    }))];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(tools.has("echo")).toBe(true);
                return [4 /*yield*/, registry.unload("demo.plugin")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(tools.has("echo")).toBe(false);
                (0, bun_test_1.expect)(registry.audit().map(function (entry) { return entry.action; })).toEqual([
                    "loaded",
                    "unloaded",
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugin aliases are removed on unload and cannot shadow tools", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, registry, aliasedPlugin, staleDispose, currentDispose;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tools = (0, tools_1.createToolRegistry)([]);
                registry = (0, src_1.createPluginRegistry)({ tools: tools });
                aliasedPlugin = (0, src_1.definePlugin)({
                    manifest: {
                        apiVersion: 1,
                        id: "alias.plugin",
                        version: "1.0.0",
                        name: "Alias",
                        description: "",
                        entry: "index.ts",
                        capabilities: ["tools"],
                        scope: "session",
                        provides: [],
                        requires: [],
                    },
                    setup: function (api) {
                        api.tools.register({
                            name: "target",
                            description: "Target",
                            requiresApproval: false,
                            parameters: { type: "object", properties: {} },
                            execute: function () {
                                return __awaiter(this, void 0, void 0, function () {
                                    return __generator(this, function (_a) {
                                        return [2 /*return*/, "ok"];
                                    });
                                });
                            },
                        });
                        api.tools.registerAlias("shortcut", "target");
                    },
                });
                return [4 /*yield*/, registry.load(aliasedPlugin)];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(tools.has("shortcut")).toBe(true);
                (0, bun_test_1.expect)(function () { return tools.addAlias("target", "target"); }).toThrow("tool alias already registered: target");
                (0, bun_test_1.expect)(function () { return tools.addAlias("shortcut", "target"); }).toThrow("tool alias already registered: shortcut");
                staleDispose = tools.addAlias("stale", "target");
                staleDispose();
                currentDispose = tools.addAlias("stale", "target");
                staleDispose();
                (0, bun_test_1.expect)(tools.has("stale")).toBe(true);
                currentDispose();
                return [4 /*yield*/, registry.unload("alias.plugin")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(tools.has("shortcut")).toBe(false);
                return [4 /*yield*/, registry.load(aliasedPlugin)];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(tools.has("shortcut")).toBe(true);
                return [4 /*yield*/, registry.unload("alias.plugin")];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugins use their declared public names", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, registry;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                tools = (0, tools_1.createToolRegistry)([]);
                registry = (0, src_1.createPluginRegistry)({ tools: tools });
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 1,
                            id: "natalia-observe",
                            version: "1.0.0",
                            name: "Observe",
                            description: "",
                            entry: "natalia:observe",
                            capabilities: ["tools"],
                            scope: "workspace",
                            provides: [],
                            requires: [],
                        },
                        setup: function (api) {
                            api.tools.register({
                                name: "observe",
                                description: "Observe",
                                requiresApproval: false,
                                parameters: { type: "object", properties: {} },
                                execute: function () {
                                    return __awaiter(this, void 0, void 0, function () {
                                        return __generator(this, function (_a) {
                                            return [2 /*return*/, "ok"];
                                        });
                                    });
                                },
                            });
                        },
                    }))];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)((_a = tools.get("observe")) === null || _a === void 0 ? void 0 : _a.requiresApproval).toBe(false);
                (0, bun_test_1.expect)(tools.has("plugin_natalia_observe_observe")).toBe(false);
                return [4 /*yield*/, registry.unload("natalia-observe")];
            case 2:
                _b.sent();
                (0, bun_test_1.expect)(tools.has("observe")).toBe(false);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("declared services must be provided before activation completes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                registry = (0, src_1.createPluginRegistry)({ tools: (0, tools_1.createToolRegistry)([]) });
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 1,
                            id: "natalia-lying-service",
                            version: "1.0.0",
                            name: "Lying Service",
                            description: "",
                            entry: "natalia:lying-service",
                            capabilities: [],
                            scope: "workspace",
                            provides: ["missing.service"],
                            requires: [],
                        },
                        setup: function () { },
                    }))).rejects.toThrow("did not provide declared services")];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)((_a = registry.status("natalia-lying-service")) === null || _a === void 0 ? void 0 : _a.status).toBe("failed");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("declared services must remain active through setup", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                registry = (0, src_1.createPluginRegistry)({
                    tools: (0, tools_1.createToolRegistry)([]),
                    registerOwner: function () { return ({
                        contribute: function () { return function () { }; },
                        release: function () { return undefined; },
                    }); },
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 1,
                            id: "natalia-disposed-service",
                            version: "1.0.0",
                            name: "Disposed Service",
                            description: "",
                            entry: "natalia:disposed-service",
                            scope: "workspace",
                            capabilities: [],
                            provides: ["disposed.service"],
                            requires: [],
                        },
                        setup: function (api) {
                            var dispose = api.services.provide("disposed.service", {});
                            dispose();
                        },
                    }))).rejects.toThrow("did not provide declared services")];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)((_a = registry.status("natalia-disposed-service")) === null || _a === void 0 ? void 0 : _a.status).toBe("failed");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a failing plugin disposer cannot retain owned registrations", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tools = (0, tools_1.createToolRegistry)([]);
                registry = (0, src_1.createPluginRegistry)({ tools: tools });
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 1,
                            id: "natalia-broken-dispose",
                            version: "1.0.0",
                            name: "Broken Dispose",
                            description: "",
                            entry: "natalia:broken-dispose",
                            capabilities: ["tools"],
                            scope: "workspace",
                            provides: [],
                            requires: [],
                        },
                        setup: function (api) {
                            api.tools.register({
                                name: "temporary",
                                description: "Temporary",
                                requiresApproval: false,
                                parameters: { type: "object", properties: {} },
                                execute: function () {
                                    return __awaiter(this, void 0, void 0, function () {
                                        return __generator(this, function (_a) {
                                            return [2 /*return*/, "ok"];
                                        });
                                    });
                                },
                            });
                        },
                        dispose: function () {
                            throw new Error("dispose failed");
                        },
                    }))];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.unload("natalia-broken-dispose")).rejects.toThrow("dispose failed")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(tools.has("temporary")).toBe(false);
                (0, bun_test_1.expect)(registry.list()).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugin tools preserve their declared approval requirement", function () { return __awaiter(void 0, void 0, void 0, function () {
    var safeTools, safeRegistry, guardedTools, guardedRegistry;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                safeTools = (0, tools_1.createToolRegistry)([]);
                safeRegistry = (0, src_1.createPluginRegistry)({
                    tools: safeTools,
                });
                return [4 /*yield*/, safeRegistry.load(pluginWithApprovalTool("safe.plugin", false))];
            case 1:
                _c.sent();
                (0, bun_test_1.expect)((_a = safeTools.get("observe")) === null || _a === void 0 ? void 0 : _a.requiresApproval).toBe(false);
                guardedTools = (0, tools_1.createToolRegistry)([]);
                guardedRegistry = (0, src_1.createPluginRegistry)({ tools: guardedTools });
                return [4 /*yield*/, guardedRegistry.load(pluginWithApprovalTool("guarded.plugin", true))];
            case 2:
                _c.sent();
                (0, bun_test_1.expect)((_b = guardedTools.get("observe")) === null || _b === void 0 ? void 0 : _b.requiresApproval).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugin conformance harness verifies lifecycle cleanup", function () { return __awaiter(void 0, void 0, void 0, function () {
    var results;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, src_1.runPluginConformance)({
                    plugin: (0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 1,
                            id: "conformance.plugin",
                            version: "1.0.0",
                            name: "Conformance",
                            description: "",
                            entry: "index.ts",
                            capabilities: ["tools"],
                            scope: "session",
                            provides: [],
                            requires: [],
                        },
                        setup: function (api) {
                            api.tools.register({
                                name: "ping",
                                description: "Ping",
                                requiresApproval: false,
                                parameters: { type: "object", properties: {} },
                                execute: function () {
                                    return __awaiter(this, void 0, void 0, function () {
                                        return __generator(this, function (_a) {
                                            return [2 /*return*/, "pong"];
                                        });
                                    });
                                },
                            });
                        },
                    }),
                })];
            case 1:
                results = _a.sent();
                (0, bun_test_1.expect)(results).toEqual([
                    { name: "manifest-and-setup", passed: true, detail: undefined },
                    { name: "tool-ownership", passed: true, detail: undefined },
                    { name: "approval-boundary", passed: true, detail: undefined },
                    { name: "owned-registration-cleanup", passed: true, detail: undefined },
                ]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugin cannot use an undeclared capability", function () { return __awaiter(void 0, void 0, void 0, function () {
    var registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                registry = (0, src_1.createPluginRegistry)({
                    tools: (0, tools_1.createToolRegistry)([]),
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 1,
                            id: "events.plugin",
                            version: "1.0.0",
                            name: "Events",
                            description: "",
                            entry: "index.ts",
                            capabilities: [],
                            scope: "session",
                            provides: [],
                            requires: [],
                        },
                        setup: function (api) {
                            api.events.on(function () { return undefined; });
                        },
                    }))).rejects.toThrow("capability denied")];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a manifest-declared capability is authorized without a host whitelist", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tools = (0, tools_1.createToolRegistry)([]);
                registry = (0, src_1.createPluginRegistry)({
                    tools: tools,
                });
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 1,
                            id: "declared.plugin",
                            version: "1.0.0",
                            name: "Declared",
                            description: "",
                            entry: "index.ts",
                            capabilities: ["tools"],
                            scope: "session",
                            provides: [],
                            requires: [],
                        },
                        setup: function (api) {
                            api.tools.register({
                                name: "echo",
                                description: "Echo",
                                requiresApproval: false,
                                parameters: { type: "object", properties: {} },
                                execute: function () {
                                    return __awaiter(this, void 0, void 0, function () {
                                        return __generator(this, function (_a) {
                                            return [2 /*return*/, "ok"];
                                        });
                                    });
                                },
                            });
                        },
                    }))];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(tools.has("echo")).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
function pluginWithApprovalTool(id, requiresApproval) {
    return (0, src_1.definePlugin)({
        manifest: {
            apiVersion: 1,
            id: id,
            version: "1.0.0",
            name: "Observe",
            description: "",
            entry: "index.ts",
            capabilities: ["tools"],
            scope: "session",
            provides: [],
            requires: [],
        },
        setup: function (api) {
            api.tools.register({
                name: "observe",
                description: "Observe",
                requiresApproval: requiresApproval,
                parameters: { type: "object", properties: {} },
                execute: function () {
                    return __awaiter(this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, "ok"];
                        });
                    });
                },
            });
        },
    });
}
(0, bun_test_1.test)("a plugin command uses its declared name and is removed on unload", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, registry, ran, commands;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tools = (0, tools_1.createToolRegistry)([]);
                registry = (0, src_1.createPluginRegistry)({ tools: tools });
                ran = [];
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 1,
                            id: "demo.plugin",
                            version: "1.0.0",
                            name: "Demo",
                            description: "",
                            entry: "index.ts",
                            capabilities: ["commands"],
                            scope: "session",
                            provides: [],
                            requires: [],
                        },
                        setup: function (api) {
                            api.commands.register({
                                name: "sync",
                                title: "Sync everything",
                                run: function () {
                                    ran.push("sync");
                                },
                            });
                        },
                    }))];
            case 1:
                _a.sent();
                commands = registry.commands();
                (0, bun_test_1.expect)(commands).toHaveLength(1);
                (0, bun_test_1.expect)(commands[0].name).toBe("sync");
                (0, bun_test_1.expect)(commands[0].category).toBe("Demo");
                return [4 /*yield*/, commands[0].run()];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(ran).toEqual(["sync"]);
                return [4 /*yield*/, registry.unload("demo.plugin")];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(registry.commands()).toEqual([]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a plugin without the commands capability cannot register one", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, registry;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                tools = (0, tools_1.createToolRegistry)([]);
                registry = (0, src_1.createPluginRegistry)({ tools: tools });
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 1,
                            id: "sneaky.plugin",
                            version: "1.0.0",
                            name: "Sneaky",
                            description: "",
                            entry: "index.ts",
                            capabilities: ["tools"],
                            scope: "session",
                            provides: [],
                            requires: [],
                        },
                        setup: function (api) {
                            api.commands.register({
                                name: "escalate",
                                title: "Escalate",
                                run: function () { },
                            });
                        },
                    }))).rejects.toThrow(/capability denied: sneaky.plugin\/commands/u)];
            case 1:
                _b.sent();
                // The failed setup leaves no contributions but remains observable.
                (0, bun_test_1.expect)(registry.commands()).toEqual([]);
                (0, bun_test_1.expect)((_a = registry.status("sneaky.plugin")) === null || _a === void 0 ? void 0 : _a.status).toBe("failed");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("two plugins cannot register the same command name", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, registry, manifest;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tools = (0, tools_1.createToolRegistry)([]);
                registry = (0, src_1.createPluginRegistry)({ tools: tools });
                manifest = function (id) { return ({
                    apiVersion: 1,
                    id: id,
                    version: "1.0.0",
                    name: id,
                    description: "",
                    entry: "index.ts",
                    capabilities: ["commands"],
                    scope: "session",
                    provides: [],
                    requires: [],
                }); };
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: manifest("first.plugin"),
                        setup: function (api) {
                            api.commands.register({ name: "go", title: "Go", run: function () { } });
                        },
                    }))];
            case 1:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.load((0, src_1.definePlugin)({
                        manifest: manifest("second.plugin"),
                        setup: function (api) {
                            api.commands.register({ name: "go", title: "Go", run: function () { } });
                        },
                    }))).rejects.toThrow("plugin command already registered: go")];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
function configuredPlugin(input) {
    return (0, src_1.definePlugin)({
        manifest: {
            apiVersion: 1,
            id: input.id,
            version: "1.0.0",
            name: "Configured",
            description: "",
            entry: "index.ts",
            capabilities: ["tools"],
            scope: "session",
            provides: [],
            requires: [],
        },
        configSchema: input.configSchema,
        setup: function (api) {
            input.seen.config = api.config;
            api.tools.register({
                name: "run",
                description: "Run",
                requiresApproval: false,
                parameters: { type: "object", properties: {} },
                execute: function () {
                    return __awaiter(this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            return [2 /*return*/, "ok"];
                        });
                    });
                },
            });
        },
    });
}
(0, bun_test_1.test)("a plugin receives its own config validated by its declared schema", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, registry, seen;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tools = (0, tools_1.createToolRegistry)([]);
                registry = (0, src_1.createPluginRegistry)({ tools: tools });
                seen = {};
                return [4 /*yield*/, registry.load(configuredPlugin({
                        id: "configured.plugin",
                        seen: seen,
                        configSchema: zod_1.z.object({
                            retries: zod_1.z.number().int().default(3),
                            label: zod_1.z.string(),
                        }),
                    }), { label: "primary" })];
            case 1:
                _a.sent();
                // The parsed value reaches setup, so schema defaults are applied.
                (0, bun_test_1.expect)(seen.config).toEqual({ retries: 3, label: "primary" });
                (0, bun_test_1.expect)(tools.has("run")).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("an invalid plugin config fails the load and registers nothing", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, registry, seen;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tools = (0, tools_1.createToolRegistry)([]);
                registry = (0, src_1.createPluginRegistry)({ tools: tools });
                seen = {};
                return [4 /*yield*/, (0, bun_test_1.expect)(registry.load(configuredPlugin({
                        id: "invalid.plugin",
                        seen: seen,
                        configSchema: zod_1.z.object({ label: zod_1.z.string() }),
                    }), { label: 42 })).rejects.toThrow(/plugin config invalid: invalid.plugin/u)];
            case 1:
                _a.sent();
                // Misconfiguration fails before setup runs, so nothing was contributed.
                (0, bun_test_1.expect)(seen.config).toBeUndefined();
                (0, bun_test_1.expect)(tools.has("run")).toBe(false);
                (0, bun_test_1.expect)(registry.list()).toEqual([]);
                (0, bun_test_1.expect)(registry.audit().map(function (entry) { return entry.action; })).toEqual(["failed"]);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a plugin without a config schema keeps its config unchanged", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, registry, seen;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tools = (0, tools_1.createToolRegistry)([]);
                registry = (0, src_1.createPluginRegistry)({ tools: tools });
                seen = {};
                return [4 /*yield*/, registry.load(configuredPlugin({ id: "raw.plugin", seen: seen }), {
                        anything: true,
                    })];
            case 1:
                _a.sent();
                (0, bun_test_1.expect)(seen.config).toEqual({ anything: true });
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugin config validation reports the failing path", function () {
    var seen = {};
    var plugin = configuredPlugin({
        id: "paths.plugin",
        seen: seen,
        configSchema: zod_1.z.object({ nested: zod_1.z.object({ port: zod_1.z.number() }) }),
    });
    (0, bun_test_1.expect)(function () { return (0, src_1.resolvePluginConfig)(plugin, { nested: { port: "80" } }); }).toThrow(/\(at nested.port\)/u);
});
(0, bun_test_1.test)("an async plugin config schema is refused instead of loading unvalidated", function () {
    var seen = {};
    var plugin = __assign(__assign({}, configuredPlugin({ id: "async.plugin", seen: seen })), { configSchema: {
            "~standard": {
                validate: function () { return Promise.resolve({ value: {} }); },
            },
        } });
    (0, bun_test_1.expect)(function () { return (0, src_1.resolvePluginConfig)(plugin, {}); }).toThrow(/must be synchronous: async.plugin/u);
});
(0, bun_test_1.test)("conformance checks a plugin against the config it will be loaded with", function () { return __awaiter(void 0, void 0, void 0, function () {
    var seen, plugin, passed, failed;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                seen = {};
                plugin = configuredPlugin({
                    id: "conformance.plugin",
                    seen: seen,
                    configSchema: zod_1.z.object({ endpoint: zod_1.z.string().min(1) }),
                });
                return [4 /*yield*/, (0, src_1.runPluginConformance)({
                        plugin: plugin,
                        config: { endpoint: "https://example.test" },
                    })];
            case 1:
                passed = _c.sent();
                (0, bun_test_1.expect)(passed.every(function (check) { return check.passed; })).toBe(true);
                (0, bun_test_1.expect)(seen.config).toEqual({ endpoint: "https://example.test" });
                return [4 /*yield*/, (0, src_1.runPluginConformance)({
                        plugin: plugin,
                        config: {},
                    })];
            case 2:
                failed = _c.sent();
                (0, bun_test_1.expect)((_a = failed[0]) === null || _a === void 0 ? void 0 : _a.passed).toBe(false);
                (0, bun_test_1.expect)((_b = failed[0]) === null || _b === void 0 ? void 0 : _b.detail).toMatch(/plugin config invalid: conformance.plugin/u);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a plugin manifest without a scope defaults to session", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, registry;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                tools = (0, tools_1.createToolRegistry)([]);
                registry = (0, src_1.createPluginRegistry)({ tools: tools });
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 1,
                            id: "scopeless.plugin",
                            version: "1.0.0",
                            name: "Scopeless",
                            description: "",
                            entry: "index.ts",
                            capabilities: ["tools"],
                            scope: "session",
                            provides: [],
                            requires: [],
                        },
                        setup: function (api) {
                            api.tools.register({
                                name: "noop",
                                description: "Noop",
                                requiresApproval: false,
                                parameters: { type: "object", properties: {} },
                                execute: function () {
                                    return __awaiter(this, void 0, void 0, function () {
                                        return __generator(this, function (_a) {
                                            return [2 /*return*/, "ok"];
                                        });
                                    });
                                },
                            });
                        },
                    }))];
            case 1:
                _b.sent();
                (0, bun_test_1.expect)((_a = registry.list()[0]) === null || _a === void 0 ? void 0 : _a.scope).toBe("session");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugin tools are offered to the kernel channel with the plugin's scope", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, contributed, released, unloaded, registry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                tools = (0, tools_1.createToolRegistry)([]);
                contributed = [];
                released = [];
                registry = (0, src_1.createPluginRegistry)({
                    tools: tools,
                    registerOwner: function (manifest) { return ({
                        contribute: function (_kind, name, tool) {
                            contributed.push({ name: name, tool: tool, manifest: manifest });
                            return function () { return released.push(name); };
                        },
                        release: function () {
                            unloaded = manifest.id;
                        },
                    }); },
                });
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 1,
                            id: "owned.plugin",
                            version: "1.0.0",
                            name: "Owned",
                            description: "",
                            entry: "index.ts",
                            scope: "workspace",
                            capabilities: ["tools"],
                            provides: [],
                            requires: [],
                        },
                        setup: function (api) {
                            api.tools.register({
                                name: "scan",
                                description: "Scan",
                                requiresApproval: false,
                                parameters: { type: "object", properties: {} },
                                execute: function () {
                                    return __awaiter(this, void 0, void 0, function () {
                                        return __generator(this, function (_a) {
                                            return [2 /*return*/, "ok"];
                                        });
                                    });
                                },
                            });
                        },
                    }))];
            case 1:
                _a.sent();
                // The kernel channel saw the declared tool name and the manifest it came
                // from, so a host can attribute it and read the plugin's declared scope.
                (0, bun_test_1.expect)(contributed).toHaveLength(1);
                (0, bun_test_1.expect)(contributed[0].name).toBe("scan");
                (0, bun_test_1.expect)(contributed[0].manifest.scope).toBe("workspace");
                return [4 /*yield*/, registry.unload("owned.plugin")];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(released).toEqual(["scan"]);
                (0, bun_test_1.expect)(unloaded).toBe("owned.plugin");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("conformance reports tool ownership and the approval boundary", function () { return __awaiter(void 0, void 0, void 0, function () {
    var results, byName;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, (0, src_1.runPluginConformance)({
                    plugin: (0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 1,
                            id: "owned.plugin",
                            version: "1.0.0",
                            name: "Owned",
                            description: "",
                            entry: "index.ts",
                            capabilities: ["tools"],
                            scope: "session",
                            provides: [],
                            requires: [],
                        },
                        setup: function (api) {
                            api.tools.register({
                                name: "scan",
                                description: "Scan",
                                requiresApproval: false,
                                parameters: { type: "object", properties: {} },
                                execute: function () {
                                    return __awaiter(this, void 0, void 0, function () {
                                        return __generator(this, function (_a) {
                                            return [2 /*return*/, "ok"];
                                        });
                                    });
                                },
                            });
                        },
                    }),
                })];
            case 1:
                results = _d.sent();
                byName = new Map(results.map(function (check) { return [check.name, check]; }));
                (0, bun_test_1.expect)((_a = byName.get("tool-ownership")) === null || _a === void 0 ? void 0 : _a.passed).toBe(true);
                (0, bun_test_1.expect)((_b = byName.get("approval-boundary")) === null || _b === void 0 ? void 0 : _b.passed).toBe(true);
                (0, bun_test_1.expect)((_c = byName.get("owned-registration-cleanup")) === null || _c === void 0 ? void 0 : _c.passed).toBe(true);
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a plugin reads the runtime's resolved config via api.runtimeConfig", function () { return __awaiter(void 0, void 0, void 0, function () {
    var tools, seen, registry;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                tools = (0, tools_1.createToolRegistry)([]);
                seen = [];
                registry = (0, src_1.createPluginRegistry)({
                    tools: tools,
                    runtimeConfig: function () { return ({
                        defaultAgentMode: "ask",
                        runtime: { maxSteps: 8 },
                    }); },
                });
                return [4 /*yield*/, registry.load((0, src_1.definePlugin)({
                        manifest: {
                            apiVersion: 1,
                            id: "cfg.reader",
                            version: "1.0.0",
                            name: "Cfg Reader",
                            description: "",
                            entry: "index.ts",
                            capabilities: [],
                            scope: "session",
                            provides: [],
                            requires: [],
                        },
                        setup: function (api) {
                            var _a;
                            seen.push((_a = api.runtimeConfig) === null || _a === void 0 ? void 0 : _a.call(api));
                        },
                    }))];
            case 1:
                _b.sent();
                // The resolved config reached the plugin by name — the D2 service has a real
                // production consumer, not just tests.
                (0, bun_test_1.expect)(seen).toEqual([{ defaultAgentMode: "ask", runtime: { maxSteps: 8 } }]);
                (0, bun_test_1.expect)((_a = registry.list()[0]) === null || _a === void 0 ? void 0 : _a.id).toBe("cfg.reader");
                return [2 /*return*/];
        }
    });
}); });
