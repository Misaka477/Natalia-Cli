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
exports.createPluginAssembly = createPluginAssembly;
/**
 * Default plugin input assembly — runtime/plugin-assembly.ts.
 *
 * Builds the input objects for runtime default plugins from resolved config:
 * skills, terminal, workspace, provider-model, compaction, MCP and local-tools
 * inputs. Reads host state through `RuntimeContext` at call time.
 */
var node_path_1 = require("node:path");
var config_1 = require("@natalia/config");
var tool_family_capabilities_1 = require("../capabilities/tool-family-capabilities");
function createPluginAssembly(ctx, options) {
    var pluginEnabled = function (config, id) {
        return config.plugins.enabled[id] !== false;
    };
    return {
        skillsPluginInput: skillsPluginInput,
        providerModelPluginInput: providerModelPluginInput,
        mcpPluginInput: mcpPluginInput,
        localToolsPluginInput: localToolsPluginInput,
    };
    function skillsPluginInput(config) {
        var _a = ctx.ports, getWorkspaceRoot = _a.getWorkspaceRoot, getUserSkillRoot = _a.getUserSkillRoot, getExecutionBySession = _a.getExecutionBySession, getActiveExec = _a.getActiveExec, setActiveSkill = _a.setActiveSkill, extensionEnabled = _a.extensionEnabled;
        var workspaceRoot = getWorkspaceRoot();
        if (!pluginEnabled(config, "natalia-skills") || !extensionEnabled("skills"))
            return undefined;
        return {
            workspaceRoot: workspaceRoot,
            userRoot: getUserSkillRoot(),
            remoteURLs: config.skills.urls,
            commandSession: {
                active: function (sessionID) { var _a; return (_a = getExecutionBySession().get(sessionID)) === null || _a === void 0 ? void 0 : _a.activeSkill; },
                activate: function (sessionID, skill) {
                    var owner = getExecutionBySession().get(sessionID);
                    if (!owner)
                        throw new Error("session not found: ".concat(sessionID));
                    owner.activeSkill = skill;
                    if (owner === getActiveExec())
                        setActiveSkill(skill);
                    owner.context.add({
                        id: "skill:".concat(skill.qualifiedName, ":").concat(owner.context.journalStatus().journalOffset),
                        role: "system",
                        content: "Active skill ".concat(skill.name, ": ").concat(skill.description, "\n").concat(skill.body),
                    });
                },
            },
            onLoad: function (skill, output, context) {
                var owner = context.sessionID
                    ? getExecutionBySession().get(context.sessionID)
                    : undefined;
                if (!owner)
                    return;
                owner.activeSkill = skill;
                if (owner === getActiveExec())
                    setActiveSkill(skill);
                owner.context.add({
                    id: "skill:".concat(skill.qualifiedName, ":").concat(owner.context.journalStatus().journalOffset),
                    role: "system",
                    content: output,
                });
            },
        };
    }
    function providerModelPluginInput() {
        var _this = this;
        var _a = ctx.ports, getProvider = _a.getProvider, setProvider = _a.setProvider, setProviderSource = _a.setProviderSource, providerFromEnvironment = _a.providerFromEnvironment, getExecutionBySession = _a.getExecutionBySession, publishForSession = _a.publishForSession, runNaviChatTurn = _a.runNaviChatTurn, runNiaChatTurn = _a.runNiaChatTurn, wakeNavi = _a.wakeNavi, wakeNia = _a.wakeNia, providerRunnerInput = _a.providerRunnerInput, clientModelCatalog = _a.clientModelCatalog, selectRuntimeModel = _a.selectRuntimeModel;
        return {
            initialize: function () {
                if (!getProvider() && !options.provider) {
                    var provider = providerFromEnvironment();
                    if (provider) {
                        setProvider(provider);
                        setProviderSource("environment");
                    }
                }
            },
            runnerInput: providerRunnerInput,
            commands: {
                catalog: clientModelCatalog,
                select: function (sessionID, modelID, variant) { return __awaiter(_this, void 0, void 0, function () {
                    var exec;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                exec = getExecutionBySession().get(sessionID);
                                if (!exec)
                                    throw new Error("session not found: ".concat(sessionID));
                                return [4 /*yield*/, selectRuntimeModel(modelID, variant, exec)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); },
            },
            navi: {
                available: function (id) { return getExecutionBySession().has(id); },
                publish: function (id, event) {
                    return publishForSession(getExecutionBySession().get(id), event);
                },
                runBody: function (input, signal) { return __awaiter(_this, void 0, void 0, function () {
                    var exec;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                exec = getExecutionBySession().get(input.sessionID);
                                if (!exec)
                                    throw new Error("no execution state for session ".concat(input.sessionID));
                                return [4 /*yield*/, runNaviChatTurn(__assign(__assign({}, input), { exec: exec }), signal)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); },
                wake: function (id) { return __awaiter(_this, void 0, void 0, function () {
                    var exec;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                exec = getExecutionBySession().get(id);
                                if (!exec) return [3 /*break*/, 2];
                                return [4 /*yield*/, wakeNavi(exec)];
                            case 1:
                                _a.sent();
                                _a.label = 2;
                            case 2: return [2 /*return*/];
                        }
                    });
                }); },
            },
            nia: {
                available: function (id) { return getExecutionBySession().has(id); },
                publish: function (id, event) {
                    return publishForSession(getExecutionBySession().get(id), event);
                },
                runBody: function (input, signal) { return __awaiter(_this, void 0, void 0, function () {
                    var exec;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                exec = getExecutionBySession().get(input.sessionID);
                                if (!exec)
                                    throw new Error("no execution state for session ".concat(input.sessionID));
                                return [4 /*yield*/, runNiaChatTurn(__assign(__assign({}, input), { exec: exec }), signal)];
                            case 1:
                                _a.sent();
                                return [2 /*return*/];
                        }
                    });
                }); },
                wake: function (id) { return __awaiter(_this, void 0, void 0, function () {
                    var exec;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                exec = getExecutionBySession().get(id);
                                if (!exec) return [3 /*break*/, 2];
                                return [4 /*yield*/, wakeNia(exec)];
                            case 1:
                                _a.sent();
                                _a.label = 2;
                            case 2: return [2 /*return*/];
                        }
                    });
                }); },
            },
        };
    }
    function mcpPluginInput(config) {
        var _a = ctx.ports, getTsRuntimeConfig = _a.getTsRuntimeConfig, extensionEnabled = _a.extensionEnabled, publish = _a.publish;
        if (!pluginEnabled(config, "natalia-mcp") || !extensionEnabled("mcp"))
            return undefined;
        return {
            servers: function () {
                var _a, _b, _c;
                var runtimeConfig = getTsRuntimeConfig();
                var mode = (_a = runtimeConfig === null || runtimeConfig === void 0 ? void 0 : runtimeConfig.agentModes) === null || _a === void 0 ? void 0 : _a[(_b = runtimeConfig === null || runtimeConfig === void 0 ? void 0 : runtimeConfig.defaultAgentMode) !== null && _b !== void 0 ? _b : ""];
                var selected = mode === null || mode === void 0 ? void 0 : mode.mcpServers;
                // An agent mode controls MCP exactly as a whitelist: no selected MCP
                // means this mode exposes none, even if servers are globally enabled.
                if (!selected || !selected.length)
                    return {};
                var all = (_c = runtimeConfig === null || runtimeConfig === void 0 ? void 0 : runtimeConfig.mcpServers) !== null && _c !== void 0 ? _c : {};
                return Object.fromEntries(Object.entries(all).filter(function (_a) {
                    var name = _a[0];
                    return selected.includes(name);
                }));
            },
            workspaceRoot: ctx.ports.getWorkspaceRoot(),
            enabled: function () { return extensionEnabled("mcp"); },
            publish: publish,
            identity: config.mcpServers,
        };
    }
    function localToolsPluginInput(config) {
        var _this = this;
        var _a = ctx.ports, getWorkspaceRoot = _a.getWorkspaceRoot, publish = _a.publish, hotReloadToolFamily = _a.hotReloadToolFamily;
        var workspaceRoot = getWorkspaceRoot();
        if (options.tools ||
            !config.tools.paths.length ||
            !pluginEnabled(config, "natalia-local-tools"))
            return undefined;
        return {
            roots: config.tools.paths.map(function (path) { return (0, node_path_1.resolve)(workspaceRoot, path); }),
            onError: function (id, error) {
                return publish({
                    type: "diagnostic",
                    level: "warning",
                    owner: "natalia-tools",
                    message: "tool family ".concat(id, " failed to load: ").concat(error instanceof Error ? error.message : String(error)),
                });
            },
            trust: {
                workspaceRoot: workspaceRoot,
                verify: function (key, entryPath) {
                    return (0, config_1.verifyTrust)(workspaceRoot, key, entryPath);
                },
            },
            onChange: function (familyID, entryPath) { return __awaiter(_this, void 0, void 0, function () {
                var verified, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, (0, config_1.verifyTrust)(workspaceRoot, (0, node_path_1.resolve)(entryPath, ".."), entryPath)];
                        case 1:
                            verified = _a.sent();
                            if (verified.expected && !verified.verified) {
                                publish({
                                    type: "diagnostic",
                                    level: "warning",
                                    owner: (0, tool_family_capabilities_1.toolFamilyCapabilityID)(familyID),
                                    message: "tool family ".concat(familyID, " changed on disk without a promotion \u2014 refusing to hot reload"),
                                });
                                return [2 /*return*/];
                            }
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, hotReloadToolFamily(familyID)];
                        case 3:
                            _a.sent();
                            publish({
                                type: "diagnostic",
                                level: "info",
                                owner: (0, tool_family_capabilities_1.toolFamilyCapabilityID)(familyID),
                                message: "tool family ".concat(familyID, " hot-reloaded"),
                            });
                            return [3 /*break*/, 5];
                        case 4:
                            error_1 = _a.sent();
                            publish({
                                type: "diagnostic",
                                level: "warning",
                                owner: (0, tool_family_capabilities_1.toolFamilyCapabilityID)(familyID),
                                message: "tool family ".concat(familyID, " hot reload failed: ").concat(error_1 instanceof Error ? error_1.message : String(error_1)),
                            });
                            return [3 /*break*/, 5];
                        case 5: return [2 /*return*/];
                    }
                });
            }); },
        };
    }
}
