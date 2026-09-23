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
var config_1 = require("@natalia/config");
var config_reload_1 = require("../src/runtime/config-reload");
var runtime_services_1 = require("@natalia/runtime-services");
var tool_publish_1 = require("../src/runtime/tool-publish");
// A config reload mutates live runtime state in place; if a later step throws,
// rollbackReload puts the previous state back. This exercises that path — which
// otherwise has no direct test — and pins one piece of it: the agent_spawn tool
// description is re-derived from the agent registry during a reload, so the
// rollback must re-derive it from the registry it restores, not leave the failed
// config's subagent types advertised.
function harness() {
    return __awaiter(this, void 0, void 0, function () {
        var root, agentSpawn, tools, config, registry, failPermissionSettings, failContextConfig, published, diagnostics, ctx, options, reload;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdtemp)((0, node_path_1.join)((0, node_os_1.tmpdir)(), "natalia-reload-rollback-"))];
                case 1:
                    root = _a.sent();
                    agentSpawn = { name: "agent_spawn", description: "seed" };
                    tools = new Map([["agent_spawn", agentSpawn]]);
                    failPermissionSettings = false;
                    failContextConfig = false;
                    published = [];
                    diagnostics = [];
                    ctx = {
                        state: {
                            tools: tools,
                            frameworkServices: undefined,
                            pluginStoreRoot: undefined,
                            // The reload path resolves optional services through the directory; an
                            // empty context reproduces the port stub's "nothing provided".
                            serviceDirectory: (0, runtime_services_1.createTestContext)([]),
                        },
                        ports: {
                            getWorkspaceRoot: function () { return root; },
                            getTsRuntimeConfig: function () { return config; },
                            setTsRuntimeConfig: function (next) {
                                config = next;
                            },
                            getMaxSteps: function () { return 0; },
                            setMaxSteps: function () { },
                            getRetryPolicy: function () { return ({}); },
                            setRetryPolicy: function () { },
                            getProviderConcurrencyLimiter: function () { return ({}); },
                            setProviderConcurrencyLimiter: function () { },
                            getSelectedAgent: function () { return undefined; },
                            setSelectedAgent: function () { },
                            getAgentRegistry: function () { return registry; },
                            setAgentRegistry: function (next) {
                                registry = next;
                            },
                            getExecutionBySession: function () { return new Map(); },
                            getInteractive: function () { return undefined; },
                            // The reload re-derives the spawn description before this runs, so making
                            // it throw on the second call fails the reload right after that mutation.
                            reloadPermissionSettings: function () {
                                if (failPermissionSettings)
                                    throw new Error("injected permission-settings failure");
                            },
                            getPermissionMode: function () { return "default"; },
                            setPermissionMode: function () { },
                            getSelectedPermissionProfile: function () { return undefined; },
                            setSelectedPermissionProfile: function () { },
                            getDefaultPermissionMode: function () { return "default"; },
                            getDefaultPermissionProfile: function () { return undefined; },
                            setDefaultPermissionMode: function () { },
                            setDefaultPermissionProfile: function () { },
                            getProvider: function () { return ({}); },
                            setProvider: function () { },
                            getProviderSource: function () { return "ts_config"; },
                            setProviderSource: function () { },
                            getRuntimeContextConfig: function () { return ({}); },
                            setRuntimeContextConfig: function () { },
                            applyAgentPolicy: function () { },
                            getPluginsController: function () { return ({
                                catalog: function () { return []; },
                                reconcileDesired: function (_entries, plugins) { return __awaiter(_this, void 0, void 0, function () {
                                    var _a;
                                    return __generator(this, function (_b) {
                                        tools.clear();
                                        tools.set("agent_spawn", agentSpawn);
                                        if ((_a = plugins === null || plugins === void 0 ? void 0 : plugins.enabled) === null || _a === void 0 ? void 0 : _a.beta)
                                            tools.set("beta_tool", { name: "beta_tool", description: "" });
                                        return [2 /*return*/];
                                    });
                                }); },
                            }); },
                            runPluginLifecyclePostReconcile: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/];
                            }); }); },
                            publish: function (event) {
                                var _a;
                                if (event.type === "tool.registered" ||
                                    event.type === "tool.unregistered" ||
                                    event.type.startsWith("composition."))
                                    published.push({ type: event.type, name: (_a = event.name) !== null && _a !== void 0 ? _a : "" });
                                else if (event.type === "diagnostic" && event.message)
                                    diagnostics.push(event.message);
                            },
                            publishForSession: function () { },
                            scheduleRuntimeStatusSnapshot: function () { },
                            resolveService: function () { return undefined; },
                            getTools: function () { return tools; },
                            getCapabilityRegistry: function () { return ({
                                ownerOf: function () { return undefined; },
                                scopeOf: function () { return undefined; },
                            }); },
                            getContextWindowResolver: function () { return ({}); },
                            refreshExecutionContextConfig: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
                                return [2 /*return*/];
                            }); }); },
                            modelRefKeyForSelection: function () { return "key"; },
                            resolveContextStatusConfig: function () { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    if (failContextConfig)
                                        throw new Error("injected context-config failure");
                                    return [2 /*return*/, {}];
                                });
                            }); },
                            applyAgentProvider: function () { },
                            publishToolCatalogChanges: function () { },
                        },
                    };
                    options = { globalConfigPath: (0, node_path_1.join)(root, "absent-global.json") };
                    // Use the real tool-catalog publisher so the diff is actually emitted.
                    ctx.ports.publishToolCatalogChanges = (0, tool_publish_1.createToolPublish)(ctx, options).publishToolCatalogChanges;
                    reload = (0, config_reload_1.createConfigReload)(ctx, options);
                    return [2 /*return*/, {
                            root: root,
                            agentSpawn: agentSpawn,
                            published: published,
                            diagnostics: diagnostics,
                            globalConfigPath: options.globalConfigPath,
                            resetRecorded: function () {
                                published.length = 0;
                                diagnostics.length = 0;
                            },
                            setFailPermissionSettings: function (value) {
                                failPermissionSettings = value;
                            },
                            setFailContextConfig: function (value) {
                                failContextConfig = value;
                            },
                            reload: reload,
                            dispose: function () { return (0, promises_1.rm)(root, { recursive: true, force: true }); },
                        }];
            }
        });
    });
}
var alpha = { mode: "subagent", description: "Alpha explorer" };
var beta = { mode: "subagent", description: "Beta reviewer" };
(0, bun_test_1.test)("a failed config reload restores the agent_spawn description to the prior config", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, first, second;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, harness()];
            case 1:
                h = _a.sent();
                _a.label = 2;
            case 2:
                _a.trys.push([2, , 7, 9]);
                return [4 /*yield*/, (0, config_1.updateConfig)(h.root, { version: 3, agents: { alpha: alpha } })];
            case 3:
                _a.sent();
                return [4 /*yield*/, h.reload.applyConfigFromDisk()];
            case 4:
                first = _a.sent();
                (0, bun_test_1.expect)(first.applied).toBe(true);
                (0, bun_test_1.expect)(h.agentSpawn.description).toContain("alpha");
                (0, bun_test_1.expect)(h.agentSpawn.description).not.toContain("beta");
                // Add a second subagent type, then make the reload fail after the spawn
                // description has already been re-derived from the new registry.
                return [4 /*yield*/, (0, config_1.updateConfig)(h.root, { agents: { alpha: alpha, beta: beta } })];
            case 5:
                // Add a second subagent type, then make the reload fail after the spawn
                // description has already been re-derived from the new registry.
                _a.sent();
                h.setFailPermissionSettings(true);
                return [4 /*yield*/, h.reload.applyConfigFromDisk()];
            case 6:
                second = _a.sent();
                (0, bun_test_1.expect)(second.applied).toBe(false);
                // Rolled back to the first config: beta must no longer be advertised.
                (0, bun_test_1.expect)(h.agentSpawn.description).not.toContain("beta");
                (0, bun_test_1.expect)(h.agentSpawn.description).toContain("alpha");
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, h.dispose()];
            case 8:
                _a.sent();
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a failed reload re-publishes the tool catalog so the projection matches the rollback", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, harness()];
            case 1:
                h = _c.sent();
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 7, 9]);
                return [4 /*yield*/, (0, config_1.updateConfig)(h.root, { version: 3, agents: { alpha: alpha } })];
            case 3:
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, h.reload.applyConfigFromDisk()];
            case 4:
                _a.apply(void 0, [(_c.sent()).applied]).toBe(true);
                // Config B enables an extra plugin tool; fail the reload only after the new
                // tool catalog has been published (at context-config resolution).
                return [4 /*yield*/, (0, config_1.updateConfig)(h.root, {
                        agents: { alpha: alpha },
                        plugins: { enabled: { beta: true } },
                    })];
            case 5:
                // Config B enables an extra plugin tool; fail the reload only after the new
                // tool catalog has been published (at context-config resolution).
                _c.sent();
                h.setFailContextConfig(true);
                _b = bun_test_1.expect;
                return [4 /*yield*/, h.reload.applyConfigFromDisk()];
            case 6:
                _b.apply(void 0, [(_c.sent()).applied]).toBe(false);
                // The failed reload advertised beta_tool; the rollback must retract it so
                // the UI stops projecting a tool the restored registry no longer has.
                (0, bun_test_1.expect)(h.published).toContainEqual({
                    type: "tool.unregistered",
                    name: "beta_tool",
                });
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, h.dispose()];
            case 8:
                _c.sent();
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
var adapterProvider = function (format, module) { return ({
    name: "P",
    driver: "openai-compatible",
    connection: { apiKey: "x" },
    protocol: { format: format, module: module },
}); };
(0, bun_test_1.test)("a failed reload restores the previous config's provider adapter modules", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, harness()];
            case 1:
                h = _c.sent();
                _c.label = 2;
            case 2:
                _c.trys.push([2, , 7, 9]);
                // Config A names an adapter module that does not exist, so loading it fails
                // and publishes a diagnostic (registers nothing).
                return [4 /*yield*/, (0, config_1.updateConfig)(h.root, { version: 3, providers: { p: adapterProvider("fa", "a.ts") } }, { globalPath: h.globalConfigPath })];
            case 3:
                // Config A names an adapter module that does not exist, so loading it fails
                // and publishes a diagnostic (registers nothing).
                _c.sent();
                _a = bun_test_1.expect;
                return [4 /*yield*/, h.reload.applyConfigFromDisk()];
            case 4:
                _a.apply(void 0, [(_c.sent()).applied]).toBe(true);
                (0, bun_test_1.expect)(h.diagnostics.some(function (m) { return m.includes("a.ts"); })).toBe(true);
                // Config B swaps the module; fail the reload only after the adapter set has
                // been swapped (at context-config resolution).
                h.resetRecorded();
                return [4 /*yield*/, (0, config_1.updateConfig)(h.root, { version: 3, providers: { p: adapterProvider("fb", "b.ts") } }, { globalPath: h.globalConfigPath })];
            case 5:
                _c.sent();
                h.setFailContextConfig(true);
                _b = bun_test_1.expect;
                return [4 /*yield*/, h.reload.applyConfigFromDisk()];
            case 6:
                _b.apply(void 0, [(_c.sent()).applied]).toBe(false);
                // The rollback must restore the previous config's adapter set: its "a.ts"
                // load diagnostic is published again, proving the failed config's "b.ts"
                // was withdrawn and A's reloaded rather than left live.
                (0, bun_test_1.expect)(h.diagnostics.some(function (m) { return m.includes("b.ts"); })).toBe(true);
                (0, bun_test_1.expect)(h.diagnostics.some(function (m) { return m.includes("a.ts"); })).toBe(true);
                return [3 /*break*/, 9];
            case 7: return [4 /*yield*/, h.dispose()];
            case 8:
                _c.sent();
                return [7 /*endfinally*/];
            case 9: return [2 /*return*/];
        }
    });
}); });
(0, bun_test_1.test)("a successful reload records the candidate then commits it", function () { return __awaiter(void 0, void 0, void 0, function () {
    var h, applied, composition;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, harness()];
            case 1:
                h = _a.sent();
                _a.label = 2;
            case 2:
                _a.trys.push([2, , 5, 7]);
                return [4 /*yield*/, (0, config_1.updateConfig)(h.root, { version: 3, agents: { alpha: alpha } })];
            case 3:
                _a.sent();
                h.published.length = 0;
                return [4 /*yield*/, h.reload.applyConfigFromDisk()];
            case 4:
                applied = _a.sent();
                (0, bun_test_1.expect)(applied.applied).toBe(true);
                composition = h.published.filter(function (event) {
                    return event.type.startsWith("composition.");
                });
                // G2 journal signature: the attempt is recorded, then the outcome. The
                // ids are content hashes, so the pair is verified by shape and order.
                (0, bun_test_1.expect)(composition.map(function (event) { return event.type; })).toEqual([
                    "composition.proposed",
                    "composition.switched",
                ]);
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, h.dispose()];
            case 6:
                _a.sent();
                return [7 /*endfinally*/];
            case 7: return [2 /*return*/];
        }
    });
}); });
