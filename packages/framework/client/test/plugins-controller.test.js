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
var tools_1 = require("@anthelia/tools");
var capability_1 = require("@natalia/capability");
var substrate_1 = require("@anthelia/substrate");
var plugin_1 = require("@natalia/plugin");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
function pluginWorkspace() {
    return __awaiter(this, void 0, void 0, function () {
        var root;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugins-controller-"))];
                case 1:
                    root = _a.sent();
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia", "plugins", "demo.plugin"), {
                            recursive: true,
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, plugin_test_helpers_1.installPluginSdkLinks)(root)];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "plugins", "demo.plugin", "natalia.plugin.json"), JSON.stringify({
                            apiVersion: 1,
                            id: "demo.plugin",
                            version: "1.0.0",
                            name: "Demo",
                            capabilities: ["commands"],
                        }))];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "plugins", "demo.plugin", "index.ts"), "import { definePlugin } from \"".concat((0, plugin_test_helpers_1.pluginSdkImportPath)(), "\";\nexport default definePlugin({ manifest: { apiVersion: 1, id: \"demo.plugin\", version: \"1.0.0\", name: \"Demo\", capabilities: [\"commands\"] }, setup(api) { api.commands.register({ name: \"hello\", title: \"Hello\", run() {} }); } });"))];
                case 5:
                    _a.sent();
                    return [2 /*return*/, root];
            }
        });
    });
}
function makeController(root, capabilityRegistry, config) {
    if (capabilityRegistry === void 0) { capabilityRegistry = new capability_1.CapabilityRegistry(); }
    if (config === void 0) { config = {}; }
    var controller = (0, substrate_1.createPluginsController)({
        pluginStoreRoot: (0, node_path_1.join)(root, "plugin-store"),
        workspaceRoot: root,
        tools: (0, tools_1.createToolRegistry)([]),
        capabilityRegistry: capabilityRegistry,
        discoverDesiredEntries: fixtureDiscovery(root),
        publish: function () { return undefined; },
    });
    return { controller: controller };
}
function fixtureDiscovery(root) {
    var _this = this;
    return function (input) { return __awaiter(_this, void 0, void 0, function () {
        var entries, ids;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, plugin_1.discoverPluginManifests)((0, node_path_1.join)(root, ".natalia", "plugins"), { nodeModules: false })];
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
function initialize(controller_1) {
    return __awaiter(this, arguments, void 0, function (controller, defaults, config) {
        if (defaults === void 0) { defaults = []; }
        if (config === void 0) { config = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    controller.init();
                    return [4 /*yield*/, controller.reconcileDesired(defaults, config)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function desiredPlugin(plugin, fingerprint, enabled) {
    var _this = this;
    if (fingerprint === void 0) { fingerprint = plugin.manifest.version; }
    if (enabled === void 0) { enabled = true; }
    return {
        id: plugin.manifest.id,
        enabled: enabled,
        fingerprint: fingerprint,
        manifest: plugin.manifest,
        load: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, plugin];
        }); }); },
    };
}
(0, bun_test_1.test)("plugins controller reconciles the configured user plugin set", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, config, kernel, controller;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, pluginWorkspace()];
            case 1:
                root = _a.sent();
                config = {};
                kernel = new capability_1.CapabilityRegistry();
                controller = makeController(root, kernel, config).controller;
                return [4 /*yield*/, initialize(controller)];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(controller.list().map(function (plugin) { return plugin.id; })).toEqual(["demo.plugin"]);
                config.enabled = { "demo.plugin": false };
                return [4 /*yield*/, controller.reconcileDesired([], { enabled: config.enabled })];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(controller.list()).toHaveLength(0);
                (0, bun_test_1.expect)(kernel.has("demo.plugin")).toBe(false);
                config.enabled = { "demo.plugin": true };
                return [4 /*yield*/, controller.reconcileDesired([], { enabled: config.enabled })];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(controller.list().map(function (plugin) { return plugin.id; })).toEqual(["demo.plugin"]);
                (0, bun_test_1.expect)(kernel.has("demo.plugin")).toBe(true);
                return [4 /*yield*/, controller.close()];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("disabled user declarations still conflict with duplicate default ids", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, duplicate;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, pluginWorkspace()];
            case 1:
                root = _a.sent();
                controller = makeController(root).controller;
                duplicate = desiredPlugin({
                    manifest: {
                        apiVersion: 2,
                        id: "demo.plugin",
                        version: "1.0.0",
                        name: "Duplicate",
                        description: "",
                        entry: "natalia:test:duplicate",
                        scope: "workspace",
                        provides: [],
                        requires: [],
                        optionalRequires: [],
                        conflicts: [],
                        dependencies: [],
                        hooks: {},
                        integrationPoints: [],
                    },
                    setup: function () { },
                });
                controller.init();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.reconcileDesired([duplicate], {
                        enabled: { "demo.plugin": false },
                    })).rejects.toThrow("duplicate plugin id: demo.plugin")];
            case 2:
                _a.sent();
                return [4 /*yield*/, controller.close()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugins controller reapplies user plugin settings on reconcile", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, entry, config, controller;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, pluginWorkspace()];
            case 1:
                root = _a.sent();
                entry = (0, node_path_1.join)(root, ".natalia", "plugins", "demo.plugin", "index.ts");
                return [4 /*yield*/, (0, promises_1.writeFile)(entry, "import { definePlugin } from \"".concat((0, plugin_test_helpers_1.pluginSdkImportPath)(), "\";\nexport default definePlugin({ manifest: { apiVersion: 1, id: \"demo.plugin\", version: \"1.0.0\", name: \"Demo\", capabilities: [\"commands\"] }, setup(api) { const name = String(api.config); api.commands.register({ name, title: name, run() {} }); } });"))];
            case 2:
                _a.sent();
                config = {
                    settings: { "demo.plugin": "before" },
                };
                controller = makeController(root, new capability_1.CapabilityRegistry(), config).controller;
                return [4 /*yield*/, initialize(controller, [], { settings: config.settings })];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(controller
                    .get()
                    .commands()
                    .map(function (command) { return command.name; })).toEqual(["before"]);
                config.settings = { "demo.plugin": "after" };
                return [4 /*yield*/, controller.reconcileDesired([], { settings: config.settings })];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(controller
                    .get()
                    .commands()
                    .map(function (command) { return command.name; })).toEqual(["after"]);
                return [4 /*yield*/, controller.close()];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugins controller loads, unloads idempotently and reloads", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, unloaded, again, reloaded, missing;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, pluginWorkspace()];
            case 1:
                root = _a.sent();
                controller = makeController(root).controller;
                return [4 /*yield*/, initialize(controller)];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(controller
                    .get()
                    .list()
                    .some(function (p) { return p.id === "demo.plugin"; })).toBe(true);
                return [4 /*yield*/, controller.unload("demo.plugin")];
            case 3:
                unloaded = _a.sent();
                (0, bun_test_1.expect)(unloaded.unloaded).toBe(true);
                return [4 /*yield*/, controller.unload("demo.plugin")];
            case 4:
                again = _a.sent();
                (0, bun_test_1.expect)(again.unloaded).toBe(true);
                (0, bun_test_1.expect)(controller.get().list()).toHaveLength(0);
                return [4 /*yield*/, controller.reload("demo.plugin")];
            case 5:
                reloaded = _a.sent();
                (0, bun_test_1.expect)(reloaded.reloaded).toBe(true);
                (0, bun_test_1.expect)(controller
                    .get()
                    .list()
                    .some(function (p) { return p.id === "demo.plugin"; })).toBe(true);
                return [4 /*yield*/, controller
                        .reload("missing.plugin")
                        .catch(function (error) { return error; })];
            case 6:
                missing = _a.sent();
                (0, bun_test_1.expect)(missing.message).toContain("plugin not found");
                return [4 /*yield*/, controller.close()];
            case 7:
                _a.sent();
                (0, bun_test_1.expect)(function () { return controller.get(); }).toThrow("plugins are not enabled");
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugins controller loads only configured lock-backed packages", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, pluginStoreRoot, modulesRoot, configuredRoot, neighborRoot, _i, _a, _b, directory, id, command, controller;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugins-closure-"))];
            case 1:
                root = _c.sent();
                pluginStoreRoot = (0, node_path_1.join)(root, "plugin-store");
                modulesRoot = (0, node_path_1.join)(pluginStoreRoot, "node_modules");
                configuredRoot = (0, node_path_1.join)(modulesRoot, "configured-plugin");
                neighborRoot = (0, node_path_1.join)(modulesRoot, "neighbor-plugin");
                return [4 /*yield*/, Promise.all([
                        (0, promises_1.mkdir)(configuredRoot, { recursive: true }),
                        (0, promises_1.mkdir)(neighborRoot, { recursive: true }),
                    ])];
            case 2:
                _c.sent();
                _i = 0, _a = [
                    [configuredRoot, "configured.plugin", "configured"],
                    [neighborRoot, "neighbor.plugin", "neighbor"],
                ];
                _c.label = 3;
            case 3:
                if (!(_i < _a.length)) return [3 /*break*/, 7];
                _b = _a[_i], directory = _b[0], id = _b[1], command = _b[2];
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(directory, "natalia.plugin.json"), JSON.stringify({
                        apiVersion: 1,
                        id: id,
                        version: "1.0.0",
                        name: id,
                        entry: "index.ts",
                        capabilities: ["commands"],
                        scope: "workspace",
                    }))];
            case 4:
                _c.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(directory, "index.ts"), "import { definePlugin } from \"".concat((0, plugin_test_helpers_1.pluginSdkImportPath)(), "\";\nexport default definePlugin({ manifest: { apiVersion: 1, id: \"").concat(id, "\", version: \"1.0.0\", name: \"").concat(id, "\", capabilities: [\"commands\"], scope: \"workspace\" }, setup(api) { api.commands.register({ name: \"").concat(command, "\", title: \"").concat(command, "\", run() {} }); } });"))];
            case 5:
                _c.sent();
                _c.label = 6;
            case 6:
                _i++;
                return [3 /*break*/, 3];
            case 7: return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(pluginStoreRoot, "natalia.lock"), JSON.stringify({
                    version: 1,
                    plugins: {
                        "configured.plugin": {
                            packageName: "configured-plugin",
                            manifest: (0, node_path_1.join)(configuredRoot, "natalia.plugin.json"),
                            metadata: {
                                id: "configured.plugin",
                                source: { type: "registry", spec: "configured-plugin@1.0.0" },
                                resolvedVersion: "1.0.0",
                                scope: "workspace",
                                dependencies: [],
                            },
                        },
                    },
                }))];
            case 8:
                _c.sent();
                controller = (0, substrate_1.createPluginsController)({
                    pluginStoreRoot: pluginStoreRoot,
                    workspaceRoot: root,
                    tools: (0, tools_1.createToolRegistry)([]),
                    capabilityRegistry: new capability_1.CapabilityRegistry(),
                    publish: function () { return undefined; },
                });
                return [4 /*yield*/, initialize(controller, [], {
                        packages: {
                            "configured.plugin": {
                                source: { type: "registry", spec: "configured-plugin@1.0.0" },
                                version: "1.0.0",
                                scope: "workspace",
                            },
                        },
                    })];
            case 9:
                _c.sent();
                (0, bun_test_1.expect)(controller.list().map(function (plugin) { return plugin.id; })).toEqual([
                    "configured.plugin",
                ]);
                (0, bun_test_1.expect)(controller
                    .get()
                    .commands()
                    .map(function (command) { return command.name; })).toEqual(["configured"]);
                return [4 /*yield*/, controller.close()];
            case 10:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugin tools are owned by the kernel with the plugin's declared scope", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, kernel, controller;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugins-owned-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia", "plugins", "scanner.plugin"), {
                        recursive: true,
                    })];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "plugins", "scanner.plugin", "natalia.plugin.json"), JSON.stringify({
                        apiVersion: 1,
                        id: "scanner.plugin",
                        version: "1.0.0",
                        name: "Scanner",
                        description: "",
                        entry: "index.ts",
                        capabilities: ["tools"],
                        scope: "workspace",
                    }))];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "plugins", "scanner.plugin", "index.ts"), "import { definePlugin } from \"".concat((0, plugin_test_helpers_1.pluginSdkImportPath)(), "\";\nexport default definePlugin({ manifest: { apiVersion: 1, id: \"scanner.plugin\", version: \"1.0.0\", name: \"Scanner\", capabilities: [\"tools\"], scope: \"workspace\" }, setup(api) { api.tools.register({ name: \"scan\", description: \"Scan\", requiresApproval: false, parameters: { type: \"object\", properties: {} }, async execute() { return \"ok\"; } }); } });"))];
            case 4:
                _a.sent();
                kernel = new capability_1.CapabilityRegistry();
                controller = makeController(root, kernel).controller;
                return [4 /*yield*/, initialize(controller)];
            case 5:
                _a.sent();
                // The kernel owns the plugin's tool, named after the plugin, with the scope
                // the plugin declared — the same attribution a built-in family gets.
                (0, bun_test_1.expect)(kernel.ownerOf("tools", "scan")).toBe("scanner.plugin");
                (0, bun_test_1.expect)(kernel.scopeOf("scanner.plugin")).toBe("workspace");
                return [4 /*yield*/, controller.unload("scanner.plugin")];
            case 6:
                _a.sent();
                (0, bun_test_1.expect)(kernel.has("scanner.plugin")).toBe(false);
                (0, bun_test_1.expect)(kernel.ownerOf("tools", "scan")).toBeUndefined();
                return [4 /*yield*/, controller.close()];
            case 7:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a failing plugin's diagnostic is attributed to the plugin", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, diagnostics, controller;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugins-owner-"))];
            case 1:
                root = _a.sent();
                // A plugin whose entry does not exist fails to load; its diagnostic must say
                // which plugin it belongs to, so "which package failed" is traceable.
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia", "plugins", "broken.plugin"), {
                        recursive: true,
                    })];
            case 2:
                // A plugin whose entry does not exist fails to load; its diagnostic must say
                // which plugin it belongs to, so "which package failed" is traceable.
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "plugins", "broken.plugin", "natalia.plugin.json"), JSON.stringify({
                        apiVersion: 1,
                        id: "broken.plugin",
                        version: "1.0.0",
                        name: "Broken",
                        description: "",
                        entry: "missing.ts",
                        capabilities: [],
                    }))];
            case 3:
                _a.sent();
                diagnostics = [];
                controller = (0, substrate_1.createPluginsController)({
                    pluginStoreRoot: (0, node_path_1.join)(root, "plugin-store"),
                    workspaceRoot: root,
                    tools: (0, tools_1.createToolRegistry)([]),
                    capabilityRegistry: new capability_1.CapabilityRegistry(),
                    discoverDesiredEntries: fixtureDiscovery(root),
                    publish: function (event) {
                        if (event.type === "diagnostic")
                            diagnostics.push(event);
                    },
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(initialize(controller)).rejects.toThrow("broken.plugin")];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(diagnostics.length).toBeGreaterThan(0);
                (0, bun_test_1.expect)(diagnostics.some(function (entry) { return entry.owner === "broken.plugin"; })).toBe(true);
                return [4 /*yield*/, controller.close()];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugin reload re-reads the module after a file change (cache-bust)", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, entry, _i, _a, name_1, commands;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, pluginWorkspace()];
            case 1:
                root = _b.sent();
                controller = makeController(root).controller;
                return [4 /*yield*/, initialize(controller)];
            case 2:
                _b.sent();
                entry = (0, node_path_1.join)(root, ".natalia", "plugins", "demo.plugin", "index.ts");
                _b.label = 3;
            case 3:
                _b.trys.push([3, , 9, 11]);
                _i = 0, _a = ["reloaded_once", "reloaded_twice"];
                _b.label = 4;
            case 4:
                if (!(_i < _a.length)) return [3 /*break*/, 8];
                name_1 = _a[_i];
                return [4 /*yield*/, (0, promises_1.writeFile)(entry, "import { definePlugin } from \"".concat((0, plugin_test_helpers_1.pluginSdkImportPath)(), "\";\nexport default definePlugin({ manifest: { apiVersion: 1, id: \"demo.plugin\", version: \"1.0.0\", name: \"Demo\", capabilities: [\"commands\"] }, setup(api) { api.commands.register({ name: \"").concat(name_1, "\", title: \"Reloaded\", run() {} }); } });"))];
            case 5:
                _b.sent();
                return [4 /*yield*/, controller.reload("demo.plugin")];
            case 6:
                _b.sent();
                _b.label = 7;
            case 7:
                _i++;
                return [3 /*break*/, 4];
            case 8:
                commands = controller.get().commands();
                // The second immediate reload must expose v2 even when both calls happen
                // within one clock tick.
                (0, bun_test_1.expect)(commands.some(function (command) { return command.name === "reloaded_twice"; })).toBe(true);
                return [3 /*break*/, 11];
            case 9: return [4 /*yield*/, controller.close()];
            case 10:
                _b.sent();
                return [7 /*endfinally*/];
            case 11: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("default and user plugins disable all contributions uniformly", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, kernel, config, controller, defaultPlugin, defaultEntry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugins-single-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia", "plugins", "full.plugin"), {
                        recursive: true,
                    })];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "plugins", "full.plugin", "natalia.plugin.json"), JSON.stringify({
                        apiVersion: 1,
                        id: "full.plugin",
                        version: "1.0.0",
                        name: "Full",
                        description: "",
                        entry: "index.ts",
                        capabilities: ["tools", "commands", "events"],
                        provides: ["full.service"],
                    }))];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "plugins", "full.plugin", "index.ts"), "import { definePlugin } from \"".concat((0, plugin_test_helpers_1.pluginSdkImportPath)(), "\";\nexport default definePlugin({ manifest: { apiVersion: 1, id: \"full.plugin\", version: \"1.0.0\", name: \"Full\", capabilities: [\"tools\", \"commands\", \"events\"], provides: [\"full.service\"] }, setup(api) {\n  api.tools.register({ name: \"run\", description: \"Run\", requiresApproval: false, parameters: { type: \"object\", properties: {} }, async execute() { return \"ok\"; } });\n  api.commands.register({ name: \"greet\", title: \"Greet\", run() {} });\n  api.events.on(() => {});\n  api.services.provide(\"full.service\", {});\n} });"))];
            case 4:
                _a.sent();
                kernel = new capability_1.CapabilityRegistry();
                config = {};
                controller = makeController(root, kernel, config).controller;
                defaultPlugin = {
                    manifest: {
                        apiVersion: 2,
                        id: "default.plugin",
                        version: "1.0.0",
                        name: "Default",
                        description: "",
                        entry: "natalia:test:default",
                        scope: "workspace",
                        provides: ["default.service"],
                        requires: [],
                        optionalRequires: [],
                        conflicts: [],
                        dependencies: [],
                        hooks: {},
                        integrationPoints: ["tools", "commands", "events", "services"],
                    },
                    setup: function (api) {
                        api.tools.register({
                            name: "default_tool",
                            description: "Default",
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
                            name: "default_command",
                            title: "Default",
                            run: function () { },
                        });
                        api.events.on(function () { });
                        api.services.provide("default.service", {});
                    },
                };
                defaultEntry = desiredPlugin(defaultPlugin);
                return [4 /*yield*/, initialize(controller, [defaultEntry])];
            case 5:
                _a.sent();
                (0, bun_test_1.expect)(controller.list().map(function (plugin) { return plugin.id; })).toEqual([
                    "default.plugin",
                    "full.plugin",
                ]);
                (0, bun_test_1.expect)(kernel.ownerOf("tools", "run")).toBe("full.plugin");
                (0, bun_test_1.expect)(kernel.ownerOf("commands", "greet")).toBe("full.plugin");
                (0, bun_test_1.expect)(kernel.ownerOf("services", "full.service")).toBe("full.plugin");
                (0, bun_test_1.expect)(kernel.ownerOf("tools", "default_tool")).toBe("default.plugin");
                (0, bun_test_1.expect)(kernel.ownerOf("commands", "default_command")).toBe("default.plugin");
                (0, bun_test_1.expect)(kernel.ownerOf("services", "default.service")).toBe("default.plugin");
                (0, bun_test_1.expect)(kernel
                    .contributions("listeners")
                    .some(function (entry) {
                    return entry.capabilityID === "full.plugin" &&
                        entry.name.startsWith("full.plugin:listener:");
                })).toBe(true);
                (0, bun_test_1.expect)(kernel
                    .contributions("listeners")
                    .some(function (entry) { return entry.capabilityID === "default.plugin"; })).toBe(true);
                return [4 /*yield*/, controller.unload("full.plugin")];
            case 6:
                _a.sent();
                return [4 /*yield*/, controller.unload("default.plugin")];
            case 7:
                _a.sent();
                (0, bun_test_1.expect)(kernel.ownerOf("tools", "run")).toBeUndefined();
                (0, bun_test_1.expect)(kernel.ownerOf("commands", "greet")).toBeUndefined();
                (0, bun_test_1.expect)(kernel.ownerOf("services", "full.service")).toBeUndefined();
                (0, bun_test_1.expect)(kernel.ownerOf("tools", "default_tool")).toBeUndefined();
                (0, bun_test_1.expect)(kernel.ownerOf("commands", "default_command")).toBeUndefined();
                (0, bun_test_1.expect)(kernel.ownerOf("services", "default.service")).toBeUndefined();
                (0, bun_test_1.expect)(kernel.contributions("listeners")).toHaveLength(0);
                return [4 /*yield*/, controller.reconcileDesired([defaultEntry], { enabled: {} })];
            case 8:
                _a.sent();
                (0, bun_test_1.expect)(controller.list().map(function (plugin) { return plugin.id; })).toEqual([
                    "default.plugin",
                    "full.plugin",
                ]);
                config.enabled = { "full.plugin": false };
                return [4 /*yield*/, controller.reconcileDesired([__assign(__assign({}, defaultEntry), { enabled: false, fingerprint: "disabled" })], { enabled: config.enabled })];
            case 9:
                _a.sent();
                (0, bun_test_1.expect)(controller.list()).toEqual([]);
                (0, bun_test_1.expect)(kernel.ownerOf("tools", "run")).toBeUndefined();
                (0, bun_test_1.expect)(kernel.ownerOf("commands", "greet")).toBeUndefined();
                (0, bun_test_1.expect)(kernel.ownerOf("services", "full.service")).toBeUndefined();
                (0, bun_test_1.expect)(kernel.ownerOf("tools", "default_tool")).toBeUndefined();
                (0, bun_test_1.expect)(kernel.ownerOf("commands", "default_command")).toBeUndefined();
                (0, bun_test_1.expect)(kernel.ownerOf("services", "default.service")).toBeUndefined();
                (0, bun_test_1.expect)(kernel.contributions("listeners")).toHaveLength(0);
                return [4 /*yield*/, controller.close()];
            case 10:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a plugin provides a service through the kernel, resolvable by name", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, kernel, controller;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugins-service-"))];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia", "plugins", "svc.plugin"), {
                        recursive: true,
                    })];
            case 2:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "plugins", "svc.plugin", "natalia.plugin.json"), JSON.stringify({
                        apiVersion: 1,
                        id: "svc.plugin",
                        version: "1.0.0",
                        name: "Svc",
                        description: "",
                        entry: "index.ts",
                        capabilities: [],
                        provides: ["greeting"],
                    }))];
            case 3:
                _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "plugins", "svc.plugin", "index.ts"), "import { definePlugin } from \"".concat((0, plugin_test_helpers_1.pluginSdkImportPath)(), "\";\nexport default definePlugin({ manifest: { apiVersion: 1, id: \"svc.plugin\", version: \"1.0.0\", name: \"Svc\", provides: [\"greeting\"] }, setup(api) {\n  api.services.provide(\"greeting\", { text: \"hello\" });\n} });"))];
            case 4:
                _b.sent();
                kernel = new capability_1.CapabilityRegistry();
                controller = makeController(root, kernel).controller;
                return [4 /*yield*/, initialize(controller)];
            case 5:
                _b.sent();
                // The plugin's service is a kernel-owned contribution, resolvable by name —
                // the first-class service surface a built-in capability has.
                (0, bun_test_1.expect)(kernel.ownerOf("services", "greeting")).toBe("svc.plugin");
                (0, bun_test_1.expect)((_a = kernel.service("greeting")) === null || _a === void 0 ? void 0 : _a.text).toBe("hello");
                return [4 /*yield*/, controller.unload("svc.plugin")];
            case 6:
                _b.sent();
                (0, bun_test_1.expect)(kernel.ownerOf("services", "greeting")).toBeUndefined();
                return [4 /*yield*/, controller.close()];
            case 7:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("the composition root can unload a default through its lifecycle", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, kernel, controller, plugin;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugins-default-"))];
            case 1:
                root = _a.sent();
                kernel = new capability_1.CapabilityRegistry();
                controller = makeController(root, kernel).controller;
                plugin = {
                    manifest: {
                        apiVersion: 2,
                        id: "default.service",
                        version: "1.0.0",
                        name: "Default Service",
                        description: "Test default lifecycle.",
                        entry: "natalia:test:default-service",
                        scope: "workspace",
                        provides: ["default.greeting"],
                        requires: [],
                        optionalRequires: [],
                        conflicts: [],
                        dependencies: [],
                        hooks: {},
                        integrationPoints: ["services"],
                    },
                    setup: function (api) {
                        api.services.provide("default.greeting", { text: "hello" });
                    },
                };
                return [4 /*yield*/, initialize(controller, [desiredPlugin(plugin)])];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(kernel.service("default.greeting")).toBeDefined();
                (0, bun_test_1.expect)(controller.list().map(function (entry) { return entry.id; })).toContain("default.service");
                return [4 /*yield*/, controller.unload("default.service")];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(kernel.service("default.greeting")).toBeUndefined();
                return [4 /*yield*/, controller.unload("default.service")];
            case 4:
                _a.sent();
                return [4 /*yield*/, controller.close()];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("desired default reconciliation diffs identity, settings and enabled state", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, kernel, controller, lifecycle, entry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-defaults-desired-"))];
            case 1:
                root = _a.sent();
                kernel = new capability_1.CapabilityRegistry();
                controller = makeController(root, kernel).controller;
                lifecycle = [];
                entry = function (fingerprint, enabled) {
                    if (enabled === void 0) { enabled = true; }
                    return desiredPlugin({
                        manifest: {
                            apiVersion: 2,
                            id: "default.desired",
                            version: "1.0.0",
                            name: "Desired",
                            description: "Desired state test builtin.",
                            entry: "natalia:test:desired",
                            scope: "workspace",
                            provides: ["desired.value"],
                            requires: [],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: [],
                            hooks: {},
                            integrationPoints: ["services"],
                        },
                        setup: function (api) {
                            lifecycle.push("setup");
                            api.services.provide("desired.value", {});
                        },
                        dispose: function () {
                            lifecycle.push("dispose");
                        },
                    }, fingerprint, enabled);
                };
                controller.init();
                return [4 /*yield*/, controller.reconcileDesired([entry("one")], {
                        settings: { "default.desired": { value: 1 } },
                    })];
            case 2:
                _a.sent();
                return [4 /*yield*/, controller.reconcileDesired([entry("one")], {
                        settings: { "default.desired": { value: 1 } },
                    })];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(lifecycle).toEqual(["setup"]);
                return [4 /*yield*/, controller.reconcileDesired([entry("two")], {
                        settings: { "default.desired": { value: 1 } },
                    })];
            case 4:
                _a.sent();
                return [4 /*yield*/, controller.reconcileDesired([entry("two")], {
                        settings: { "default.desired": { value: 2 } },
                    })];
            case 5:
                _a.sent();
                (0, bun_test_1.expect)(lifecycle).toEqual(["setup", "dispose", "setup", "dispose", "setup"]);
                return [4 /*yield*/, controller.reconcileDesired([entry("two", false)], {})];
            case 6:
                _a.sent();
                (0, bun_test_1.expect)(kernel.service("desired.value")).toBeUndefined();
                (0, bun_test_1.expect)(lifecycle.at(-1)).toBe("dispose");
                return [4 /*yield*/, controller.close()];
            case 7:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("desired default reconciliation restores dependency closure in catalog order", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, kernel, controller, lifecycle, catalog;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-defaults-deps-"))];
            case 1:
                root = _a.sent();
                kernel = new capability_1.CapabilityRegistry();
                controller = makeController(root, kernel).controller;
                lifecycle = [];
                catalog = function (providerFingerprint) { return [
                    desiredPlugin({
                        manifest: {
                            apiVersion: 2,
                            id: "builtin.provider",
                            version: "1.0.0",
                            name: "Provider",
                            description: "",
                            entry: "natalia:test:provider",
                            scope: "workspace",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: [],
                            hooks: {},
                            integrationPoints: [],
                        },
                        setup: function () {
                            lifecycle.push("provider:".concat(providerFingerprint));
                        },
                    }, providerFingerprint),
                    desiredPlugin({
                        manifest: {
                            apiVersion: 2,
                            id: "builtin.consumer",
                            version: "1.0.0",
                            name: "Consumer",
                            description: "",
                            entry: "natalia:test:consumer",
                            scope: "workspace",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: [
                                {
                                    id: "builtin.provider",
                                    spec: "*",
                                    optional: false,
                                    peer: false,
                                },
                            ],
                            hooks: {},
                            integrationPoints: [],
                        },
                        setup: function () {
                            lifecycle.push("consumer");
                        },
                    }),
                ]; };
                controller.init();
                return [4 /*yield*/, controller.reconcileDesired(catalog("one"), {})];
            case 2:
                _a.sent();
                return [4 /*yield*/, controller.reconcileDesired(catalog("two"), {})];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(lifecycle).toEqual([
                    "provider:one",
                    "consumer",
                    "provider:two",
                    "consumer",
                ]);
                (0, bun_test_1.expect)(controller.active("builtin.consumer")).toBe(true);
                return [4 /*yield*/, controller.close()];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a default plugin can depend on a discovered user plugin", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, lifecycle, user, defaultConsumer, controller;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-default-user-deps-"))];
            case 1:
                root = _a.sent();
                lifecycle = [];
                user = desiredPlugin({
                    manifest: {
                        apiVersion: 2,
                        id: "user.provider",
                        version: "1.0.0",
                        name: "User Provider",
                        description: "",
                        entry: "natalia:test:user-provider",
                        scope: "workspace",
                        provides: [],
                        requires: [],
                        optionalRequires: [],
                        conflicts: [],
                        dependencies: [],
                        hooks: {},
                        integrationPoints: [],
                    },
                    setup: function () {
                        lifecycle.push("user");
                    },
                });
                defaultConsumer = desiredPlugin({
                    manifest: {
                        apiVersion: 2,
                        id: "default.consumer",
                        version: "1.0.0",
                        name: "Default Consumer",
                        description: "",
                        entry: "natalia:test:default-consumer",
                        scope: "workspace",
                        provides: [],
                        requires: [],
                        optionalRequires: [],
                        conflicts: [],
                        dependencies: [{ id: user.id, spec: "*", optional: false, peer: false }],
                        hooks: {},
                        integrationPoints: [],
                    },
                    setup: function () {
                        lifecycle.push("default");
                    },
                });
                controller = (0, substrate_1.createPluginsController)({
                    pluginStoreRoot: (0, node_path_1.join)(root, "plugin-store"),
                    workspaceRoot: root,
                    tools: (0, tools_1.createToolRegistry)([]),
                    capabilityRegistry: new capability_1.CapabilityRegistry(),
                    discoverDesiredEntries: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, [user]];
                    }); }); },
                    publish: function () { return undefined; },
                });
                return [4 /*yield*/, initialize(controller, [defaultConsumer])];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(lifecycle).toEqual(["user", "default"]);
                (0, bun_test_1.expect)(controller.list().map(function (entry) { return entry.id; })).toEqual([
                    user.id,
                    defaultConsumer.id,
                ]);
                return [4 /*yield*/, controller.close()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("default and user plugin conflicts deny both sources symmetrically", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, diagnostics, conflicting, user, defaultEntry, controller;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-default-user-conflict-"))];
            case 1:
                root = _a.sent();
                diagnostics = [];
                conflicting = function (id, conflict) {
                    return desiredPlugin({
                        manifest: {
                            apiVersion: 2,
                            id: id,
                            version: "1.0.0",
                            name: id,
                            description: "",
                            entry: "natalia:test:".concat(id),
                            scope: "workspace",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: [conflict],
                            dependencies: [],
                            hooks: {},
                            integrationPoints: [],
                        },
                        setup: function () { },
                    });
                };
                user = conflicting("user.conflict", "default.conflict");
                defaultEntry = conflicting("default.conflict", "user.conflict");
                controller = (0, substrate_1.createPluginsController)({
                    pluginStoreRoot: (0, node_path_1.join)(root, "plugin-store"),
                    workspaceRoot: root,
                    tools: (0, tools_1.createToolRegistry)([]),
                    capabilityRegistry: new capability_1.CapabilityRegistry(),
                    discoverDesiredEntries: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                        return [2 /*return*/, [user]];
                    }); }); },
                    publish: function (event) {
                        if (event.type === "diagnostic")
                            diagnostics.push(event);
                    },
                });
                return [4 /*yield*/, initialize(controller, [defaultEntry])];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(controller.list()).toEqual([]);
                (0, bun_test_1.expect)(diagnostics.map(function (entry) { return entry.owner; }).sort()).toEqual([
                    defaultEntry.id,
                    user.id,
                ]);
                return [4 /*yield*/, controller.close()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("concurrent desired default reconciliation serializes complete lifecycle changes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, kernel, controller, lifecycle, entry;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-defaults-concurrent-"))];
            case 1:
                root = _a.sent();
                kernel = new capability_1.CapabilityRegistry();
                controller = makeController(root, kernel).controller;
                lifecycle = [];
                entry = function (fingerprint) {
                    return desiredPlugin({
                        manifest: {
                            apiVersion: 2,
                            id: "builtin.concurrent",
                            version: "1.0.0",
                            name: "Concurrent",
                            description: "",
                            entry: "natalia:test:concurrent",
                            scope: "workspace",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: [],
                            hooks: {},
                            integrationPoints: [],
                        },
                        setup: function () {
                            return __awaiter(this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            lifecycle.push("setup:".concat(fingerprint));
                                            return [4 /*yield*/, Promise.resolve()];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                        dispose: function () {
                            return __awaiter(this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            lifecycle.push("dispose:".concat(fingerprint));
                                            return [4 /*yield*/, Promise.resolve()];
                                        case 1:
                                            _a.sent();
                                            return [2 /*return*/];
                                    }
                                });
                            });
                        },
                    }, fingerprint);
                };
                controller.init();
                return [4 /*yield*/, controller.reconcileDesired([entry("one")], {})];
            case 2:
                _a.sent();
                return [4 /*yield*/, Promise.all([
                        controller.reconcileDesired([entry("two")], {}),
                        controller.reconcileDesired([entry("three")], {}),
                    ])];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(lifecycle).toEqual([
                    "setup:one",
                    "dispose:one",
                    "setup:two",
                    "dispose:two",
                    "setup:three",
                ]);
                (0, bun_test_1.expect)(kernel.has("builtin.concurrent")).toBe(true);
                return [4 /*yield*/, controller.close()];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("failed default setup is retried by the same desired reconcile", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, attempts, plugin, entry;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-default-retry-"))];
            case 1:
                root = _b.sent();
                controller = makeController(root).controller;
                attempts = 0;
                plugin = {
                    manifest: {
                        apiVersion: 2,
                        id: "default.retry",
                        version: "1.0.0",
                        name: "Retry",
                        description: "",
                        entry: "natalia:test:retry",
                        scope: "workspace",
                        provides: [],
                        requires: [],
                        optionalRequires: [],
                        conflicts: [],
                        dependencies: [],
                        hooks: {},
                        integrationPoints: [],
                    },
                    setup: function () {
                        if (++attempts === 1)
                            throw new Error("default setup failed");
                    },
                };
                entry = desiredPlugin(plugin);
                controller.init();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.reconcileDesired([entry], {})).rejects.toThrow("default setup failed")];
            case 2:
                _b.sent();
                (0, bun_test_1.expect)((_a = controller.status(entry.id)) === null || _a === void 0 ? void 0 : _a.status).toBe("failed");
                return [4 /*yield*/, controller.reconcileDesired([entry], {})];
            case 3:
                _b.sent();
                (0, bun_test_1.expect)(controller.active(entry.id)).toBe(true);
                (0, bun_test_1.expect)(attempts).toBe(2);
                return [4 /*yield*/, controller.close()];
            case 4:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("failed provider blocks its consumer until reconcile retries it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, attempts, provider, consumer;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-provider-retry-"))];
            case 1:
                root = _b.sent();
                controller = makeController(root).controller;
                attempts = 0;
                provider = desiredPlugin({
                    manifest: {
                        apiVersion: 2,
                        id: "retry.provider",
                        version: "1.0.0",
                        name: "Provider",
                        description: "",
                        entry: "natalia:test:retry-provider",
                        scope: "workspace",
                        provides: [],
                        requires: [],
                        optionalRequires: [],
                        conflicts: [],
                        dependencies: [],
                        hooks: {},
                        integrationPoints: [],
                    },
                    setup: function () {
                        if (++attempts === 1)
                            throw new Error("provider setup failed");
                    },
                });
                consumer = desiredPlugin({
                    manifest: {
                        apiVersion: 2,
                        id: "retry.consumer",
                        version: "1.0.0",
                        name: "Consumer",
                        description: "",
                        entry: "natalia:test:retry-consumer",
                        scope: "workspace",
                        provides: [],
                        requires: [],
                        optionalRequires: [],
                        conflicts: [],
                        dependencies: [
                            { id: provider.id, spec: "*", optional: false, peer: false },
                        ],
                        hooks: {},
                        integrationPoints: [],
                    },
                    setup: function () { },
                });
                controller.init();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.reconcileDesired([provider, consumer], {})).rejects.toThrow("provider setup failed")];
            case 2:
                _b.sent();
                (0, bun_test_1.expect)((_a = controller.status(provider.id)) === null || _a === void 0 ? void 0 : _a.status).toBe("failed");
                (0, bun_test_1.expect)(controller.status(consumer.id)).toBeUndefined();
                return [4 /*yield*/, controller.reconcileDesired([provider, consumer], {})];
            case 3:
                _b.sent();
                (0, bun_test_1.expect)(controller.active(provider.id)).toBe(true);
                (0, bun_test_1.expect)(controller.active(consumer.id)).toBe(true);
                return [4 /*yield*/, controller.close()];
            case 4:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("failed discovered user setup is retried by the same desired reconcile", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, pluginWorkspace()];
            case 1:
                root = _b.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "plugins", "demo.plugin", "index.ts"), "import { definePlugin } from \"".concat((0, plugin_test_helpers_1.pluginSdkImportPath)(), "\";\nglobalThis.__desiredUserAttempts ??= 0;\nexport default definePlugin({ manifest: { apiVersion: 1, id: \"demo.plugin\", version: \"1.0.0\", name: \"Demo\", capabilities: [\"commands\"] }, setup(api) {\n  if (++globalThis.__desiredUserAttempts === 1) throw new Error(\"user setup failed\");\n  api.commands.register({ name: \"recovered\", title: \"Recovered\", run() {} });\n} });"))];
            case 2:
                _b.sent();
                controller = makeController(root).controller;
                controller.init();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.reconcileDesired([], {})).rejects.toThrow("user setup failed")];
            case 3:
                _b.sent();
                (0, bun_test_1.expect)((_a = controller.status("demo.plugin")) === null || _a === void 0 ? void 0 : _a.status).toBe("failed");
                return [4 /*yield*/, controller.reconcileDesired([], {})];
            case 4:
                _b.sent();
                (0, bun_test_1.expect)(controller.active("demo.plugin")).toBe(true);
                return [4 /*yield*/, controller.close()];
            case 5:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("failed provider reload restores the desired closure and can recover", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, failReload, reloadDiagnostics, provider, originalLoad, consumer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-reload-closure-"))];
            case 1:
                root = _a.sent();
                controller = makeController(root).controller;
                failReload = true;
                reloadDiagnostics = [];
                provider = desiredPlugin({
                    manifest: {
                        apiVersion: 2,
                        id: "default.provider",
                        version: "1.0.0",
                        name: "Provider",
                        description: "",
                        entry: "natalia:test:provider",
                        scope: "workspace",
                        provides: [],
                        requires: [],
                        optionalRequires: [],
                        conflicts: [],
                        dependencies: [],
                        hooks: {},
                        integrationPoints: [],
                    },
                    setup: function () { },
                });
                originalLoad = provider.load;
                provider.load = function (cacheBust) { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        if (cacheBust && failReload)
                            throw new Error("provider reload failed");
                        return [2 /*return*/, originalLoad(cacheBust)];
                    });
                }); };
                provider.onError = function (error) {
                    return reloadDiagnostics.push(error instanceof Error ? error.message : String(error));
                };
                consumer = desiredPlugin({
                    manifest: {
                        apiVersion: 2,
                        id: "default.consumer",
                        version: "1.0.0",
                        name: "Consumer",
                        description: "",
                        entry: "natalia:test:consumer",
                        scope: "workspace",
                        provides: [],
                        requires: [],
                        optionalRequires: [],
                        conflicts: [],
                        dependencies: [
                            { id: provider.id, spec: "*", optional: false, peer: false },
                        ],
                        hooks: {},
                        integrationPoints: [],
                    },
                    setup: function () { },
                });
                controller.init();
                return [4 /*yield*/, controller.reconcileDesired([provider, consumer], {})];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.reload(provider.id)).rejects.toThrow("provider reload failed")];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(controller.list().map(function (entry) { return entry.id; })).toEqual([
                    provider.id,
                    consumer.id,
                ]);
                (0, bun_test_1.expect)(reloadDiagnostics).toContain("provider reload failed");
                failReload = false;
                return [4 /*yield*/, controller.reload(provider.id)];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(controller.list().map(function (entry) { return entry.id; })).toEqual([
                    provider.id,
                    consumer.id,
                ]);
                return [4 /*yield*/, controller.close()];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("failed reload and rollback leave required consumers absent", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, initial, provider, consumer;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-reload-rollback-"))];
            case 1:
                root = _a.sent();
                controller = makeController(root).controller;
                initial = true;
                provider = desiredPlugin({
                    manifest: {
                        apiVersion: 2,
                        id: "broken.provider",
                        version: "1.0.0",
                        name: "Provider",
                        description: "",
                        entry: "natalia:test:broken-provider",
                        scope: "workspace",
                        provides: [],
                        requires: [],
                        optionalRequires: [],
                        conflicts: [],
                        dependencies: [],
                        hooks: {},
                        integrationPoints: [],
                    },
                    setup: function () { },
                });
                provider.load = function () { return __awaiter(void 0, void 0, void 0, function () {
                    return __generator(this, function (_a) {
                        if (initial) {
                            initial = false;
                            return [2 /*return*/, {
                                    manifest: provider.manifest,
                                    setup: function () { },
                                }];
                        }
                        return [2 /*return*/, {
                                manifest: provider.manifest,
                                setup: function () {
                                    throw new Error("provider activation failed");
                                },
                            }];
                    });
                }); };
                consumer = desiredPlugin({
                    manifest: {
                        apiVersion: 2,
                        id: "broken.consumer",
                        version: "1.0.0",
                        name: "Consumer",
                        description: "",
                        entry: "natalia:test:broken-consumer",
                        scope: "workspace",
                        provides: [],
                        requires: [],
                        optionalRequires: [],
                        conflicts: [],
                        dependencies: [
                            { id: provider.id, spec: "*", optional: false, peer: false },
                        ],
                        hooks: {},
                        integrationPoints: [],
                    },
                    setup: function () { },
                });
                controller.init();
                return [4 /*yield*/, controller.reconcileDesired([provider, consumer], {})];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.reload(provider.id)).rejects.toThrow("provider activation failed")];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(controller.status(provider.id)).toBeUndefined();
                (0, bun_test_1.expect)(controller.status(consumer.id)).toBeUndefined();
                return [4 /*yield*/, controller.close()];
            case 4:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("desired state advances before a failing disposal", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, lifecycle, plugin;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-desired-disposal-"))];
            case 1:
                root = _a.sent();
                controller = makeController(root).controller;
                lifecycle = [];
                plugin = function (version, disposeFails) {
                    if (disposeFails === void 0) { disposeFails = false; }
                    return desiredPlugin({
                        manifest: {
                            apiVersion: 2,
                            id: "default.disposal",
                            version: "1.0.0",
                            name: "Disposal",
                            description: "",
                            entry: "natalia:test:disposal",
                            scope: "workspace",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: [],
                            hooks: {},
                            integrationPoints: [],
                        },
                        setup: function () {
                            lifecycle.push("setup:".concat(version));
                        },
                        dispose: function () {
                            lifecycle.push("dispose:".concat(version));
                            if (disposeFails)
                                throw new Error("disposal failed");
                        },
                    }, version);
                };
                controller.init();
                return [4 /*yield*/, controller.reconcileDesired([plugin("old", true)], {})];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, bun_test_1.expect)(controller.reconcileDesired([plugin("new")], {})).rejects.toThrow("disposal failed")];
            case 3:
                _a.sent();
                return [4 /*yield*/, controller.reload("default.disposal")];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(lifecycle).toEqual(["setup:old", "dispose:old", "setup:new"]);
                return [4 /*yield*/, controller.close()];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("discovery and reconcile use queued immutable config snapshots", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, releaseFirst, firstBlocked, seen, controller, config, first, second;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugin-snapshot-"))];
            case 1:
                root = _a.sent();
                firstBlocked = new Promise(function (resolve) {
                    releaseFirst = resolve;
                });
                seen = [];
                controller = (0, substrate_1.createPluginsController)({
                    pluginStoreRoot: (0, node_path_1.join)(root, "plugin-store"),
                    workspaceRoot: root,
                    tools: (0, tools_1.createToolRegistry)([]),
                    capabilityRegistry: new capability_1.CapabilityRegistry(),
                    discoverDesiredEntries: function (input) { return __awaiter(void 0, void 0, void 0, function () {
                        var _a;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    seen.push(String((_a = input.enabled) === null || _a === void 0 ? void 0 : _a["snapshot.plugin"]));
                                    if (!(seen.length === 1)) return [3 /*break*/, 2];
                                    return [4 /*yield*/, firstBlocked];
                                case 1:
                                    _b.sent();
                                    _b.label = 2;
                                case 2: return [2 /*return*/, []];
                            }
                        });
                    }); },
                    publish: function () { return undefined; },
                });
                controller.init();
                config = {
                    enabled: { "snapshot.plugin": true },
                };
                first = controller.reconcileDesired([], config);
                config.enabled["snapshot.plugin"] = false;
                second = controller.reconcileDesired([], {
                    enabled: { "snapshot.plugin": false },
                });
                releaseFirst();
                return [4 /*yield*/, Promise.all([first, second])];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(seen).toEqual(["true", "false"]);
                return [4 /*yield*/, controller.close()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("direct load updates desired state for reload and reconcile", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, entry;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-direct-load-"))];
            case 1:
                root = _b.sent();
                controller = makeController(root).controller;
                entry = desiredPlugin({
                    manifest: {
                        apiVersion: 2,
                        id: "direct.plugin",
                        version: "1.0.0",
                        name: "Direct",
                        description: "",
                        entry: "natalia:test:direct",
                        scope: "workspace",
                        provides: [],
                        requires: [],
                        optionalRequires: [],
                        conflicts: [],
                        dependencies: [],
                        hooks: {},
                        integrationPoints: [],
                    },
                    setup: function () { },
                });
                controller.init();
                return [4 /*yield*/, controller.load(entry, { value: 1 })];
            case 2:
                _b.sent();
                return [4 /*yield*/, controller.reload(entry.id)];
            case 3:
                _b.sent();
                (0, bun_test_1.expect)(controller.active(entry.id)).toBe(true);
                return [4 /*yield*/, controller.reconcileDesired([entry], {
                        settings: (_a = {}, _a[entry.id] = { value: 1 }, _a),
                    })];
            case 4:
                _b.sent();
                (0, bun_test_1.expect)(controller.active(entry.id)).toBe(true);
                return [4 /*yield*/, controller.close()];
            case 5:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("desired entry loads once per actual load epoch", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, constructions, defaults;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-default-factory-"))];
            case 1:
                root = _a.sent();
                controller = makeController(root).controller;
                constructions = 0;
                defaults = [
                    {
                        id: "default.factory",
                        enabled: true,
                        fingerprint: "stable",
                        manifest: {
                            apiVersion: 2,
                            id: "default.factory",
                            version: "1.0.0",
                            name: "Factory",
                            description: "",
                            entry: "natalia:test:factory",
                            scope: "workspace",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: [],
                            hooks: {},
                            integrationPoints: [],
                        },
                        load: function () {
                            return __awaiter(this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    constructions++;
                                    return [2 /*return*/, {
                                            manifest: {
                                                apiVersion: 2,
                                                id: "default.factory",
                                                version: "1.0.0",
                                                name: "Factory",
                                                description: "",
                                                entry: "natalia:test:factory",
                                                scope: "workspace",
                                                provides: [],
                                                requires: [],
                                                optionalRequires: [],
                                                conflicts: [],
                                                dependencies: [],
                                                hooks: {},
                                                integrationPoints: [],
                                            },
                                            setup: function () { },
                                        }];
                                });
                            });
                        },
                    },
                ];
                controller.init();
                return [4 /*yield*/, controller.reconcileDesired(defaults, {})];
            case 2:
                _a.sent();
                return [4 /*yield*/, controller.reconcileDesired(defaults, {})];
            case 3:
                _a.sent();
                (0, bun_test_1.expect)(constructions).toBe(1);
                return [4 /*yield*/, controller.reload("default.factory")];
            case 4:
                _a.sent();
                (0, bun_test_1.expect)(constructions).toBe(2);
                return [4 /*yield*/, controller.close()];
            case 5:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("dependency-blocked desired entry is not loaded", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, controller, constructions, defaults;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-default-blocked-"))];
            case 1:
                root = _a.sent();
                controller = makeController(root).controller;
                constructions = 0;
                defaults = [
                    {
                        id: "blocked.default",
                        enabled: true,
                        fingerprint: "stable",
                        manifest: {
                            apiVersion: 2,
                            id: "blocked.default",
                            version: "1.0.0",
                            name: "Blocked",
                            description: "",
                            entry: "natalia:test:blocked-default",
                            scope: "workspace",
                            provides: [],
                            requires: [],
                            optionalRequires: [],
                            conflicts: [],
                            dependencies: [
                                {
                                    id: "missing.default",
                                    spec: "*",
                                    optional: false,
                                    peer: false,
                                },
                            ],
                            hooks: {},
                            integrationPoints: [],
                        },
                        load: function () {
                            return __awaiter(this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    constructions++;
                                    throw new Error("blocked default was constructed");
                                });
                            });
                        },
                    },
                ];
                controller.init();
                return [4 /*yield*/, controller.reconcileDesired(defaults, {})];
            case 2:
                _a.sent();
                (0, bun_test_1.expect)(constructions).toBe(0);
                (0, bun_test_1.expect)(controller.status("blocked.default")).toBeUndefined();
                return [4 /*yield*/, controller.close()];
            case 3:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a plugin providing an undeclared service is refused", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, diagnostics, controller;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugins-undeclared-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia", "plugins", "bad.plugin"), {
                        recursive: true,
                    })];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "plugins", "bad.plugin", "natalia.plugin.json"), JSON.stringify({
                        apiVersion: 1,
                        id: "bad.plugin",
                        version: "1.0.0",
                        name: "Bad",
                        description: "",
                        entry: "index.ts",
                        capabilities: [],
                        provides: [],
                    }))];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "plugins", "bad.plugin", "index.ts"), "import { definePlugin } from \"".concat((0, plugin_test_helpers_1.pluginSdkImportPath)(), "\";\nexport default definePlugin({ manifest: { apiVersion: 1, id: \"bad.plugin\", version: \"1.0.0\", name: \"Bad\" }, setup(api) {\n  api.services.provide(\"undeclared\", {});\n} });"))];
            case 4:
                _a.sent();
                diagnostics = [];
                controller = (0, substrate_1.createPluginsController)({
                    pluginStoreRoot: (0, node_path_1.join)(root, "plugin-store"),
                    workspaceRoot: root,
                    tools: (0, tools_1.createToolRegistry)([]),
                    capabilityRegistry: new capability_1.CapabilityRegistry(),
                    discoverDesiredEntries: fixtureDiscovery(root),
                    publish: function (event) {
                        if (event.type === "diagnostic")
                            diagnostics.push(event.message);
                    },
                });
                return [4 /*yield*/, (0, bun_test_1.expect)(initialize(controller)).rejects.toThrow("bad.plugin")];
            case 5:
                _a.sent();
                (0, bun_test_1.expect)(diagnostics.some(function (message) { return message.includes("undeclared service"); })).toBe(true);
                return [4 /*yield*/, controller.close()];
            case 6:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a plugin requiring a service waits for it before its setup runs", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, kernel, controller, runtimeConfigOwner;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugins-requires-"))];
            case 1:
                root = _a.sent();
                return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia", "plugins", "req.plugin"), {
                        recursive: true,
                    })];
            case 2:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "plugins", "req.plugin", "natalia.plugin.json"), JSON.stringify({
                        apiVersion: 1,
                        id: "req.plugin",
                        version: "1.0.0",
                        name: "Req",
                        description: "",
                        entry: "index.ts",
                        capabilities: [],
                        requires: ["runtime.config"],
                    }))];
            case 3:
                _a.sent();
                return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(root, ".natalia", "plugins", "req.plugin", "index.ts"), "import { definePlugin } from \"".concat((0, plugin_test_helpers_1.pluginSdkImportPath)(), "\";\nlet setupRan = false;\nexport default definePlugin({ manifest: { apiVersion: 1, id: \"req.plugin\", version: \"1.0.0\", name: \"Req\", requires: [\"runtime.config\"] }, setup(api) {\n  setupRan = true;\n  (globalThis as any).__reqPluginSetupRan = setupRan;\n} });"))];
            case 4:
                _a.sent();
                kernel = new capability_1.CapabilityRegistry();
                controller = makeController(root, kernel).controller;
                runtimeConfigOwner = kernel.registerOwner({
                    id: "natalia-runtime-config",
                    name: "Runtime Config",
                    version: "1.0.0",
                    scope: "workspace",
                    grants: ["services"],
                });
                runtimeConfigOwner.contribute("services", "runtime.config", { runtime: {} });
                return [4 /*yield*/, initialize(controller, [])];
            case 5:
                _a.sent();
                // Plugin dependency ordering ensures the service is available before setup.
                (0, bun_test_1.expect)(kernel.has("req.plugin")).toBe(true);
                return [4 /*yield*/, controller.close()];
            case 6:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("plugins controller reactivates a mounted plugin when service provider identity changes", function () { return __awaiter(void 0, void 0, void 0, function () {
    var root, kernel, controller, lifecycle, epoch, consumer, providerA, providerB, providerC;
    var _a, _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugins-epochs-"))];
            case 1:
                root = _f.sent();
                kernel = new capability_1.CapabilityRegistry();
                controller = makeController(root, kernel).controller;
                lifecycle = [];
                epoch = 0;
                consumer = {
                    manifest: {
                        apiVersion: 2,
                        id: "builtin.consumer",
                        version: "1.0.0",
                        name: "Consumer",
                        description: "",
                        entry: "natalia:test:consumer",
                        scope: "workspace",
                        provides: [],
                        requires: ["test.provider"],
                        optionalRequires: [],
                        conflicts: [],
                        dependencies: [],
                        hooks: {},
                        integrationPoints: ["resources"],
                    },
                    setup: function (api) {
                        var current = ++epoch;
                        lifecycle.push("setup:".concat(current));
                        api.resources.register({ name: "consumer.resource", epoch: current });
                    },
                    dispose: function () {
                        lifecycle.push("dispose:".concat(epoch));
                    },
                };
                return [4 /*yield*/, initialize(controller, [desiredPlugin(consumer)])];
            case 2:
                _f.sent();
                (0, bun_test_1.expect)((_a = controller.status("builtin.consumer")) === null || _a === void 0 ? void 0 : _a.status).toBe("pending");
                (0, bun_test_1.expect)(controller.active("builtin.consumer")).toBe(false);
                providerA = kernel.registerOwner({
                    id: "provider:a",
                    name: "Provider A",
                    version: "1.0.0",
                    scope: "workspace",
                    grants: ["services"],
                });
                providerA.contribute("services", "test.provider", {});
                return [4 /*yield*/, controller.get().whenIdle()];
            case 3:
                _f.sent();
                (0, bun_test_1.expect)(controller.active("builtin.consumer")).toBe(true);
                (0, bun_test_1.expect)((_b = kernel.contribution("resources", "consumer.resource")) === null || _b === void 0 ? void 0 : _b.epoch).toBe(1);
                providerB = kernel.registerOwner({
                    id: "provider:b",
                    name: "Provider B",
                    version: "1.0.0",
                    scope: "workspace",
                    grants: ["services"],
                    precedence: 1,
                });
                providerB.contribute("services", "test.provider", {});
                return [4 /*yield*/, controller.get().whenIdle()];
            case 4:
                _f.sent();
                (0, bun_test_1.expect)(controller.active("builtin.consumer")).toBe(true);
                (0, bun_test_1.expect)((_c = kernel.contribution("resources", "consumer.resource")) === null || _c === void 0 ? void 0 : _c.epoch).toBe(2);
                providerB.release();
                return [4 /*yield*/, controller.get().whenIdle()];
            case 5:
                _f.sent();
                (0, bun_test_1.expect)((_d = controller.status("builtin.consumer")) === null || _d === void 0 ? void 0 : _d.status).toBe("pending");
                (0, bun_test_1.expect)(kernel.contribution("resources", "consumer.resource")).toBeUndefined();
                providerC = kernel.registerOwner({
                    id: "provider:c",
                    name: "Provider C",
                    version: "1.0.0",
                    scope: "workspace",
                    grants: ["services"],
                });
                providerC.contribute("services", "test.provider", {});
                return [4 /*yield*/, controller.get().whenIdle()];
            case 6:
                _f.sent();
                (0, bun_test_1.expect)((_e = kernel.contribution("resources", "consumer.resource")) === null || _e === void 0 ? void 0 : _e.epoch).toBe(3);
                (0, bun_test_1.expect)(lifecycle).toEqual([
                    "setup:1",
                    "dispose:1",
                    "setup:2",
                    "dispose:2",
                    "setup:3",
                ]);
                return [4 /*yield*/, controller.unload("builtin.consumer")];
            case 7:
                _f.sent();
                (0, bun_test_1.expect)(lifecycle).toEqual([
                    "setup:1",
                    "dispose:1",
                    "setup:2",
                    "dispose:2",
                    "setup:3",
                    "dispose:3",
                ]);
                providerA.release();
                providerC.release();
                return [4 /*yield*/, controller.close()];
            case 8:
                _f.sent();
                return [2 /*return*/];
        }
    });
}); });
