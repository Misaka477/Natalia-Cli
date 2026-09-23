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
var promises_1 = require("node:fs/promises");
var node_os_1 = require("node:os");
var node_path_1 = require("node:path");
var capability_1 = require("@natalia/capability");
var plugin_1 = require("@natalia/plugin");
var tools_1 = require("@anthelia/tools");
var substrate_1 = require("@anthelia/substrate");
var substrate_2 = require("@anthelia/substrate");
var plugin_test_helpers_1 = require("./plugin-test-helpers");
(0, plugin_test_helpers_1.useWorkspaceCleanup)();
var pluginID = "lifecycle.symmetry";
var packageName = "lifecycle-symmetry-plugin";
var version = "1.0.0";
var contributions = [
    ["tools", "symmetry_tool"],
    ["commands", "symmetry_command"],
    ["services", "symmetry.persistence"],
    ["resources", "symmetry.resource"],
    ["projections", "symmetry.projection"],
    ["workflows", "symmetry.workflow"],
    ["settingsSchema", "symmetry.settings"],
    ["adapters", "symmetry.adapter"],
    ["adapters", "symmetry.ui"],
    ["schedulerJobs", "symmetry.job"],
];
function installedFixture() {
    return __awaiter(this, void 0, void 0, function () {
        var root, pluginStoreRoot, packageRoot, manifest, manifestPath, persistencePath, config, entries;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-plugin-symmetry-"))];
                case 1:
                    root = _c.sent();
                    pluginStoreRoot = (0, node_path_1.join)(root, "plugin-store");
                    packageRoot = (0, node_path_1.join)(pluginStoreRoot, "node_modules", packageName);
                    return [4 /*yield*/, (0, promises_1.mkdir)(packageRoot, { recursive: true })];
                case 2:
                    _c.sent();
                    manifest = {
                        apiVersion: 2,
                        id: pluginID,
                        version: version,
                        name: "Lifecycle symmetry fixture",
                        description: "Exercises every plugin contribution surface.",
                        entry: "index.ts",
                        scope: "workspace",
                        provides: ["symmetry.persistence"],
                        requires: [],
                        optionalRequires: [],
                        conflicts: [],
                        dependencies: [],
                        hooks: {},
                        integrationPoints: [
                            "tools",
                            "commands",
                            "events",
                            "services",
                            "resources",
                            "projections",
                            "workflows",
                            "settingsSchema",
                            "adapters",
                            "schedulerJobs",
                        ],
                    };
                    manifestPath = (0, node_path_1.join)(packageRoot, "natalia.plugin.json");
                    persistencePath = (0, node_path_1.join)(root, ".natalia", "symmetry-state.txt");
                    return [4 /*yield*/, (0, promises_1.writeFile)(manifestPath, JSON.stringify(manifest))];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(packageRoot, "index.ts"), "import { readFile, writeFile } from \"node:fs/promises\";\nimport { definePlugin } from \"".concat((0, plugin_test_helpers_1.pluginSdkImportPath)(), "\";\nconst persistencePath = ").concat(JSON.stringify(persistencePath), ";\nexport default definePlugin({\n  manifest: ").concat(JSON.stringify(manifest), ",\n  setup(api) {\n    api.tools.register({ name: \"symmetry_tool\", description: \"Symmetry\", requiresApproval: false, parameters: { type: \"object\", properties: {} }, async execute() { return \"ok\"; } });\n    api.commands.register({ name: \"symmetry_command\", title: \"Symmetry\", run() {} });\n    api.events.on(() => {});\n    api.services.provide(\"symmetry.persistence\", {\n      async read() { try { return await readFile(persistencePath, \"utf8\"); } catch (error) { if ((error as NodeJS.ErrnoException).code === \"ENOENT\") return undefined; throw error; } },\n      async write(value: string) { await writeFile(persistencePath, value); },\n    });\n    api.resources.register({ name: \"symmetry.resource\" });\n    api.projections.register({ name: \"symmetry.projection\" });\n    api.workflows.register({ name: \"symmetry.workflow\" });\n    api.settingsSchema.register({ name: \"symmetry.settings\" });\n    api.adapters.register({ name: \"symmetry.adapter\", adapterType: \"test\", create: () => ({ dispose() {} }) });\n    api.adapters.registerUi({ kind: \"symmetry.ui\", mount() {}, dispose() {} });\n    api.scheduler.add({ name: \"symmetry.job\" });\n  },\n});"))];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, (0, promises_1.mkdir)((0, node_path_1.join)(root, ".natalia"), { recursive: true })];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, (0, promises_1.writeFile)((0, node_path_1.join)(pluginStoreRoot, "natalia.lock"), JSON.stringify({
                            version: 1,
                            plugins: (_a = {},
                                _a[pluginID] = {
                                    packageName: packageName,
                                    manifest: manifestPath,
                                    metadata: {
                                        id: pluginID,
                                        source: { type: "registry", spec: "".concat(packageName, "@").concat(version) },
                                        resolvedVersion: version,
                                        scope: "workspace",
                                        dependencies: [],
                                    },
                                },
                                _a),
                        }))];
                case 6:
                    _c.sent();
                    config = {
                        packages: (_b = {},
                            _b[pluginID] = {
                                source: {
                                    type: "registry",
                                    spec: "".concat(packageName, "@").concat(version),
                                },
                                version: version,
                                scope: "workspace",
                            },
                            _b),
                    };
                    return [4 /*yield*/, (0, substrate_1.discoverDesiredPluginEntries)({
                            pluginStoreRoot: pluginStoreRoot,
                            packages: config.packages,
                            declaredIDs: [],
                            onError: function (_id, error) {
                                throw error;
                            },
                        })];
                case 7:
                    entries = _c.sent();
                    (0, bun_test_1.expect)(entries).toHaveLength(1);
                    return [2 /*return*/, { root: root, pluginStoreRoot: pluginStoreRoot, config: config }];
            }
        });
    });
}
function assertPresent(kernel) {
    for (var _i = 0, contributions_1 = contributions; _i < contributions_1.length; _i++) {
        var _a = contributions_1[_i], kind = _a[0], name_1 = _a[1];
        (0, bun_test_1.expect)(kernel.ownerOf(kind, name_1)).toBe(pluginID);
    }
    (0, bun_test_1.expect)(kernel
        .contributions("listeners")
        .some(function (entry) { return entry.capabilityID === pluginID; })).toBe(true);
}
function assertAbsent(kernel) {
    for (var _i = 0, contributions_2 = contributions; _i < contributions_2.length; _i++) {
        var _a = contributions_2[_i], kind = _a[0], name_2 = _a[1];
        (0, bun_test_1.expect)(kernel.ownerOf(kind, name_2)).toBeUndefined();
    }
    (0, bun_test_1.expect)(kernel
        .contributions("listeners")
        .some(function (entry) { return entry.capabilityID === pluginID; })).toBe(false);
    (0, bun_test_1.expect)(kernel.has(pluginID)).toBe(false);
}
(0, bun_test_1.test)("installed discovery uses the complete lifecycle", function () { return __awaiter(void 0, void 0, void 0, function () {
    var _a, root, pluginStoreRoot, config, kernel, tools, controller, persistence, _b, materializer, _c, recoveredUi;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0: return [4 /*yield*/, installedFixture()];
            case 1:
                _a = _e.sent(), root = _a.root, pluginStoreRoot = _a.pluginStoreRoot, config = _a.config;
                kernel = new capability_1.CapabilityRegistry();
                tools = (0, tools_1.createToolRegistry)([]);
                controller = (0, substrate_2.createPluginsController)({
                    pluginStoreRoot: pluginStoreRoot,
                    workspaceRoot: root,
                    tools: tools,
                    capabilityRegistry: kernel,
                    publish: function () { return undefined; },
                });
                controller.init();
                return [4 /*yield*/, controller.reconcileDesired([], config)];
            case 2:
                _e.sent();
                assertPresent(kernel);
                (0, bun_test_1.expect)(tools.has("symmetry_tool")).toBe(true);
                (0, bun_test_1.expect)(controller
                    .get()
                    .commands()
                    .map(function (_a) {
                    var name = _a.name;
                    return name;
                })).toContain("symmetry_command");
                persistence = kernel.service("symmetry.persistence");
                return [4 /*yield*/, persistence.write("installed discovery")];
            case 3:
                _e.sent();
                _b = bun_test_1.expect;
                return [4 /*yield*/, persistence.read()];
            case 4:
                _b.apply(void 0, [_e.sent()]).toBe("installed discovery");
                materializer = (0, plugin_1.createPluginAdapterMaterializer)(kernel);
                return [4 /*yield*/, materializer.materialize("symmetry.adapter", {})];
            case 5:
                _e.sent();
                return [4 /*yield*/, materializer.materialize("symmetry.ui", {})];
            case 6:
                _e.sent();
                return [4 /*yield*/, materializer.close()];
            case 7:
                _e.sent();
                return [4 /*yield*/, controller.unload(pluginID)];
            case 8:
                _e.sent();
                assertAbsent(kernel);
                (0, bun_test_1.expect)(tools.has("symmetry_tool")).toBe(false);
                (0, bun_test_1.expect)(controller.get().commands()).toEqual([]);
                return [4 /*yield*/, (0, bun_test_1.expect)((0, plugin_1.createPluginAdapterMaterializer)(kernel).materialize("symmetry.ui", {})).rejects.toThrow("adapter is not available")];
            case 9:
                _e.sent();
                return [4 /*yield*/, controller.reconcileDesired([], config)];
            case 10:
                _e.sent();
                assertPresent(kernel);
                _c = bun_test_1.expect;
                return [4 /*yield*/, ((_d = kernel.service("symmetry.persistence")) === null || _d === void 0 ? void 0 : _d.read())];
            case 11:
                _c.apply(void 0, [_e.sent()]).toBe("installed discovery");
                recoveredUi = (0, plugin_1.createPluginAdapterMaterializer)(kernel);
                return [4 /*yield*/, recoveredUi.materialize("symmetry.ui", {})];
            case 12:
                _e.sent();
                return [4 /*yield*/, recoveredUi.close()];
            case 13:
                _e.sent();
                return [4 /*yield*/, controller.close()];
            case 14:
                _e.sent();
                assertAbsent(kernel);
                return [2 /*return*/];
        }
    });
}); });
