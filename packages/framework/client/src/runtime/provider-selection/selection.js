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
exports.createSelectionSurface = createSelectionSurface;
var contracts_1 = require("@natalia/contracts");
var session_1 = require("@anthelia/session");
var config_1 = require("@natalia/config");
function selectionExec(ctx, sessionID) {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!sessionID) return [3 /*break*/, 4];
                    if (!((_b = ctx.ports
                        .getExecutionBySession()
                        .get(sessionID)) !== null && _b !== void 0)) return [3 /*break*/, 1];
                    _a = _b;
                    return [3 /*break*/, 3];
                case 1: return [4 /*yield*/, ctx.ports.ensureExecution(sessionID)];
                case 2:
                    _a = (_c.sent());
                    _c.label = 3;
                case 3: return [2 /*return*/, (_a)];
                case 4: return [2 /*return*/, ctx.ports.getActiveExec()];
            }
        });
    });
}
function createSelectionSurface(ctx, options) {
    return {
        selectAgent: function (name, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var agent, diagnostic, exec_1, exec, activeExec, isActive, publishSessionEvent;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            agent = (_a = ctx.ports.getAgentRegistry()) === null || _a === void 0 ? void 0 : _a.select(name);
                            if (!(name && !agent)) return [3 /*break*/, 2];
                            diagnostic = {
                                type: "diagnostic",
                                level: "error",
                                message: "agent not found: ".concat(name),
                            };
                            return [4 /*yield*/, selectionExec(ctx, sessionID)];
                        case 1:
                            exec_1 = _c.sent();
                            if (exec_1)
                                ctx.ports.publishForSession(exec_1, diagnostic);
                            else
                                ctx.ports.publish(diagnostic);
                            // A diagnostic is not an answer to the caller: a remote UI used to be
                            // told the agent was selected and then render the wrong one.
                            return [2 /*return*/, { outcome: "rejected", reason: "agent not found: ".concat(name) }];
                        case 2: return [4 /*yield*/, selectionExec(ctx, sessionID)];
                        case 3:
                            exec = _c.sent();
                            activeExec = ctx.ports.getActiveExec();
                            isActive = exec === activeExec;
                            publishSessionEvent = function (event) {
                                if (exec)
                                    ctx.ports.publishForSession(exec, event);
                                else
                                    ctx.ports.publish(event);
                            };
                            if (exec === null || exec === void 0 ? void 0 : exec.activeAbort) {
                                if (isActive)
                                    ctx.ports.setPendingAgent(agent);
                                exec.pendingAgent = agent;
                                publishSessionEvent({
                                    type: "agent.selection",
                                    name: agent === null || agent === void 0 ? void 0 : agent.name,
                                    pending: true,
                                });
                                // Deferred, not applied: switching agents mid-turn would change the rules
                                // the turn started under.
                                return [2 /*return*/, {
                                        outcome: "pending",
                                        selected: agent === null || agent === void 0 ? void 0 : agent.name,
                                        reason: "a turn is running; the selection applies when it ends",
                                    }];
                            }
                            if (isActive)
                                ctx.ports.setSelectedAgent(agent);
                            if (exec)
                                exec.selectedAgent = agent;
                            ctx.ports.applyAgentPolicy();
                            ctx.ports.applyAgentProvider(exec);
                            publishSessionEvent({
                                type: "agent.selection",
                                name: agent === null || agent === void 0 ? void 0 : agent.name,
                                pending: false,
                            });
                            // ADR Phase C: an agent switch is a prompt-level instruction change —
                            // record it as a durable `context.instructions` notice so the UI shows
                            // it in the interleaved context stream without mutating history.
                            if (exec)
                                ctx.ports.publishForSession(exec, {
                                    type: "context.instructions",
                                    id: "context:agent:".concat(Date.now().toString(36), ":").concat((0, session_1.nextContextInstructionsRevision)(exec.session.events)),
                                    kind: "agent_switch",
                                    at: new Date().toISOString(),
                                    revision: (0, session_1.nextContextInstructionsRevision)(exec.session.events),
                                    summary: "active agent switched to ".concat((_b = agent === null || agent === void 0 ? void 0 : agent.name) !== null && _b !== void 0 ? _b : "default"),
                                });
                            return [2 /*return*/, { outcome: "applied", selected: agent === null || agent === void 0 ? void 0 : agent.name }];
                    }
                });
            });
        },
        agents: function () {
            return __awaiter(this, void 0, void 0, function () {
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _c.sent();
                            return [2 /*return*/, ((_b = (_a = ctx.ports.getAgentRegistry()) === null || _a === void 0 ? void 0 : _a.list()) !== null && _b !== void 0 ? _b : []).map(function (agent) { return ({
                                    name: agent.name,
                                    description: agent.description,
                                    mode: agent.mode,
                                    hidden: agent.hidden,
                                    color: agent.color,
                                    model: agent.model,
                                    variant: agent.variant,
                                    maxSteps: agent.maxSteps,
                                    allowedTools: agent.allowedTools,
                                    excludedTools: agent.excludedTools,
                                    mcpServers: agent.mcpServers,
                                    permissions: agent.permissions,
                                }); })];
                    }
                });
            });
        },
        modelCatalog: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.clientModelCatalog()];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        },
        modelSelection: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec;
                var _a, _b, _c, _d, _e, _f;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _g.sent();
                            return [4 /*yield*/, selectionExec(ctx, sessionID)];
                        case 2:
                            exec = _g.sent();
                            if (!exec)
                                return [2 /*return*/, {
                                        modelID: ctx.ports.selectedModelRefKey(),
                                        variant: (_b = (_a = ctx.ports.getSelectedAgent()) === null || _a === void 0 ? void 0 : _a.variant) !== null && _b !== void 0 ? _b : (_c = ctx.ports.getSelectedModel()) === null || _c === void 0 ? void 0 : _c.variant,
                                    }];
                            return [2 /*return*/, {
                                    modelID: ctx.ports.modelRefKeyForSelection(exec.selectedAgent, exec.selectedModel),
                                    variant: (_e = (_d = exec.selectedAgent) === null || _d === void 0 ? void 0 : _d.variant) !== null && _e !== void 0 ? _e : (_f = exec.selectedModel) === null || _f === void 0 ? void 0 : _f.variant,
                                }];
                    }
                });
            });
        },
        selectModel: function (modelID, variant, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, selectionExec(ctx, sessionID)];
                        case 1:
                            exec = _a.sent();
                            return [4 /*yield*/, ctx.ports.selectRuntimeModel(modelID, variant, exec)];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            });
        },
        setDefaultModel: function (modelID) {
            return __awaiter(this, void 0, void 0, function () {
                var modelRef;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            if (!modelID)
                                return [2 /*return*/, { saved: false, reason: "modelID is required" }];
                            try {
                                modelRef = (0, contracts_1.parseModelRef)(modelID);
                            }
                            catch (error) {
                                return [2 /*return*/, {
                                        saved: false,
                                        reason: error instanceof Error ? error.message : String(error),
                                    }];
                            }
                            return [4 /*yield*/, (0, config_1.updateConfigAtScope)(ctx.ports.getWorkspaceRoot(), { defaultModel: modelRef }, "global", { globalPath: options.globalConfigPath })];
                        case 2:
                            _a.sent();
                            return [4 /*yield*/, ctx.ports.applyConfigFromDisk().catch(function () { return undefined; })];
                        case 3:
                            _a.sent();
                            return [2 /*return*/, { saved: true }];
                    }
                });
            });
        },
        reasoningEffort: function (sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, selectionExec(ctx, sessionID)];
                        case 2:
                            exec = _a.sent();
                            return [2 /*return*/, exec === null || exec === void 0 ? void 0 : exec.reasoningEffort];
                    }
                });
            });
        },
        setReasoningEffort: function (effort, sessionID) {
            return __awaiter(this, void 0, void 0, function () {
                var exec;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            if (effort && !isRuntimeReasoningEffort(effort))
                                throw new Error("unsupported reasoning effort: ".concat(effort));
                            return [4 /*yield*/, selectionExec(ctx, sessionID)];
                        case 2:
                            exec = _a.sent();
                            if (!exec)
                                throw new Error("session execution is unavailable");
                            exec.reasoningEffort = effort;
                            ctx.ports.publishForSession(exec, {
                                type: "model.reasoning.set",
                                reasoningEffort: effort,
                            });
                            ctx.ports.applyAgentProvider(exec);
                            return [2 /*return*/];
                    }
                });
            });
        },
        skills: function () {
            return __awaiter(this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [2 /*return*/, ctx.ports.skillsList().map(function (skill) { return ({
                                    name: skill.name,
                                    qualifiedName: skill.qualifiedName,
                                    description: skill.description,
                                    source: skill.source,
                                    requireApproval: skill.requireApproval,
                                    sandboxRequired: skill.sandboxRequired,
                                }); })];
                    }
                });
            });
        },
        agentCreate: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var config;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _b.sent();
                            config = ctx.ports.getTsRuntimeConfig();
                            if (config && config.agents[input.name])
                                return [2 /*return*/, {
                                        created: false,
                                        reason: "agent already exists: ".concat(input.name),
                                    }];
                            return [4 /*yield*/, (0, config_1.updateConfigAtScope)(ctx.ports.getWorkspaceRoot(), {
                                    agents: (_a = {}, _a[input.name] = input.config, _a),
                                }, "project", { globalPath: options.globalConfigPath })];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, ctx.ports.applyConfigFromDisk()];
                        case 3:
                            _b.sent();
                            return [2 /*return*/, { created: true }];
                    }
                });
            });
        },
        agentUpdate: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var config;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _b.sent();
                            config = ctx.ports.getTsRuntimeConfig();
                            if (!config || !config.agents[input.name])
                                throw new Error("agent not found: ".concat(input.name));
                            return [4 /*yield*/, (0, config_1.updateConfigAtScope)(ctx.ports.getWorkspaceRoot(), {
                                    agents: (_a = {}, _a[input.name] = input.config, _a),
                                }, "project", { globalPath: options.globalConfigPath })];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, ctx.ports.applyConfigFromDisk()];
                        case 3:
                            _b.sent();
                            return [2 /*return*/, { updated: true }];
                    }
                });
            });
        },
        agentDelete: function (name) {
            return __awaiter(this, void 0, void 0, function () {
                var config;
                var _a;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _b.sent();
                            config = ctx.ports.getTsRuntimeConfig();
                            if (config && config.defaultAgent === name)
                                return [2 /*return*/, {
                                        deleted: false,
                                        reason: "agent is the default agent: ".concat(name),
                                    }];
                            return [4 /*yield*/, (0, config_1.updateConfigAtScope)(ctx.ports.getWorkspaceRoot(), {
                                    agents: (_a = {}, _a[name] = undefined, _a),
                                }, "project", { globalPath: options.globalConfigPath })];
                        case 2:
                            _b.sent();
                            return [4 /*yield*/, ctx.ports.applyConfigFromDisk()];
                        case 3:
                            _b.sent();
                            return [2 /*return*/, { deleted: true }];
                    }
                });
            });
        },
        providerDiscover: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var models;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _a.sent();
                            return [4 /*yield*/, (0, config_1.discoverProviderModels)(input.type, input.baseURL, input.apiKey, input.headers)];
                        case 2:
                            models = _a.sent();
                            return [2 /*return*/, { models: models }];
                    }
                });
            });
        },
        providerAdd: function (input) {
            return __awaiter(this, void 0, void 0, function () {
                var config, sourceName, current, provider, models, providerPatch, catalogProviderPatch, modelOverridesPatch, _i, _a, _b, key, value, id, error_1;
                var _c;
                var _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
                return __generator(this, function (_p) {
                    switch (_p.label) {
                        case 0:
                            config = ctx.ports.getTsRuntimeConfig();
                            sourceName = input.previousName && input.previousName !== input.name
                                ? input.previousName
                                : input.name;
                            current = (_d = config === null || config === void 0 ? void 0 : config.providers) === null || _d === void 0 ? void 0 : _d[sourceName];
                            provider = __assign(__assign({}, current), { name: input.label || input.name, driver: input.type, enabled: true, connection: __assign(__assign({}, ((_e = current === null || current === void 0 ? void 0 : current.connection) !== null && _e !== void 0 ? _e : {})), { baseURL: input.baseURL || ((_f = current === null || current === void 0 ? void 0 : current.connection) === null || _f === void 0 ? void 0 : _f.baseURL), apiKey: input.apiKey || ((_g = current === null || current === void 0 ? void 0 : current.connection) === null || _g === void 0 ? void 0 : _g.apiKey) }), requestDefaults: __assign(__assign({}, ((_h = current === null || current === void 0 ? void 0 : current.requestDefaults) !== null && _h !== void 0 ? _h : {})), (input.headers ? { headers: input.headers } : {})) });
                            models = input.models !== undefined
                                ? Object.fromEntries(input.models.map(function (model) {
                                    var _a, _b, _c;
                                    return [
                                        model.id,
                                        {
                                            name: model.name || model.id,
                                            capabilities: {
                                                reasoning: (_a = model.reasoning) !== null && _a !== void 0 ? _a : false,
                                                imageInput: (_b = model.image) !== null && _b !== void 0 ? _b : false,
                                            },
                                            limits: {
                                                contextWindow: (_c = model.contextWindow) !== null && _c !== void 0 ? _c : "auto",
                                            },
                                            status: "stable",
                                            source: "manual",
                                        },
                                    ];
                                }))
                                : undefined;
                            providerPatch = (_c = {},
                                _c[input.name] = provider,
                                _c);
                            if (sourceName !== input.name)
                                providerPatch[sourceName] = undefined;
                            catalogProviderPatch = {};
                            if (sourceName !== input.name)
                                catalogProviderPatch[sourceName] = undefined;
                            if (models) {
                                // Config objects deep-merge; explicitly remove IDs missing from the submitted list.
                                catalogProviderPatch[input.name] = {
                                    models: __assign(__assign({}, Object.fromEntries(Object.keys((_k = (_j = config === null || config === void 0 ? void 0 : config.catalog.providers[input.name]) === null || _j === void 0 ? void 0 : _j.models) !== null && _k !== void 0 ? _k : {})
                                        .filter(function (id) { return !(id in models); })
                                        .map(function (id) { return [id, undefined]; }))), models),
                                };
                            }
                            else if (sourceName !== input.name &&
                                ((_m = (_l = config === null || config === void 0 ? void 0 : config.catalog) === null || _l === void 0 ? void 0 : _l.providers) === null || _m === void 0 ? void 0 : _m[sourceName])) {
                                catalogProviderPatch[input.name] = config.catalog.providers[sourceName];
                            }
                            modelOverridesPatch = {};
                            for (_i = 0, _a = Object.entries((_o = config === null || config === void 0 ? void 0 : config.modelOverrides) !== null && _o !== void 0 ? _o : {}); _i < _a.length; _i++) {
                                _b = _a[_i], key = _b[0], value = _b[1];
                                if (!key.startsWith("".concat(sourceName, "/")))
                                    continue;
                                id = key.slice(sourceName.length + 1);
                                if (models && !(id in models)) {
                                    modelOverridesPatch[key] = undefined;
                                }
                                else if (sourceName !== input.name) {
                                    modelOverridesPatch[key] = undefined;
                                    modelOverridesPatch["".concat(input.name, "/").concat(id)] = value;
                                }
                            }
                            return [4 /*yield*/, (0, config_1.updateConfigAtScope)(ctx.ports.getWorkspaceRoot(), __assign(__assign({ providers: providerPatch }, (Object.keys(catalogProviderPatch).length
                                    ? { catalog: { providers: catalogProviderPatch } }
                                    : {})), (Object.keys(modelOverridesPatch).length
                                    ? { modelOverrides: modelOverridesPatch }
                                    : {})), "global", { globalPath: options.globalConfigPath })];
                        case 1:
                            _p.sent();
                            _p.label = 2;
                        case 2:
                            _p.trys.push([2, 4, , 5]);
                            return [4 /*yield*/, ctx.ports.applyConfigFromDisk()];
                        case 3:
                            _p.sent();
                            return [3 /*break*/, 5];
                        case 4:
                            error_1 = _p.sent();
                            // The config file is already persisted. A reload failure in a
                            // read-only workspace must not make provider management look broken.
                            ctx.ports.publish({
                                type: "diagnostic",
                                level: "warning",
                                message: "provider saved but config reload deferred: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)),
                            });
                            return [3 /*break*/, 5];
                        case 5: return [2 /*return*/, { saved: true }];
                    }
                });
            });
        },
        providerRemove: function (name) {
            return __awaiter(this, void 0, void 0, function () {
                var config, modelPrefix, blocked, defaultModelReferencesProvider, _i, _a, _b, agentName, agent, _c, _d, _e, modeName, mode, _f, _g, exec, _h, _j, _k, stream, profile, newDefaultModel, currentModelID, _l, _m, _o, providerID, catalogProvider, firstModel, modelOverrides;
                var _p, _q;
                var _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13;
                return __generator(this, function (_14) {
                    switch (_14.label) {
                        case 0: return [4 /*yield*/, ctx.ports.getReady()];
                        case 1:
                            _14.sent();
                            config = ctx.ports.getTsRuntimeConfig();
                            if (!config)
                                throw new Error("provider configuration unavailable");
                            modelPrefix = "".concat(name, "/");
                            blocked = [];
                            defaultModelReferencesProvider = ((_r = config.defaultModel) === null || _r === void 0 ? void 0 : _r.provider) === name;
                            for (_i = 0, _a = Object.entries((_s = config.agents) !== null && _s !== void 0 ? _s : {}); _i < _a.length; _i++) {
                                _b = _a[_i], agentName = _b[0], agent = _b[1];
                                if ((_t = agent.model) === null || _t === void 0 ? void 0 : _t.startsWith(modelPrefix))
                                    blocked.push("agent:".concat(agentName));
                            }
                            for (_c = 0, _d = Object.entries((_u = config.agentModes) !== null && _u !== void 0 ? _u : {}); _c < _d.length; _c++) {
                                _e = _d[_c], modeName = _e[0], mode = _e[1];
                                if ((_v = mode.model) === null || _v === void 0 ? void 0 : _v.startsWith(modelPrefix))
                                    blocked.push("agentMode:".concat(modeName));
                            }
                            for (_f = 0, _g = ctx.ports.getExecutionBySession().values(); _f < _g.length; _f++) {
                                exec = _g[_f];
                                if (((_x = (_w = exec.selectedModel) === null || _w === void 0 ? void 0 : _w.modelID) === null || _x === void 0 ? void 0 : _x.startsWith(modelPrefix)) ||
                                    ((_z = (_y = exec.selectedAgent) === null || _y === void 0 ? void 0 : _y.model) === null || _z === void 0 ? void 0 : _z.startsWith(modelPrefix)) ||
                                    ((_1 = (_0 = exec.pendingAgent) === null || _0 === void 0 ? void 0 : _0.model) === null || _1 === void 0 ? void 0 : _1.startsWith(modelPrefix)))
                                    blocked.push("session:".concat(exec.session.id));
                                for (_h = 0, _j = [
                                    ["navi", exec.naviChatModelProfile],
                                    ["nia", exec.niaChatModelProfile],
                                ]; _h < _j.length; _h++) {
                                    _k = _j[_h], stream = _k[0], profile = _k[1];
                                    if (!profile)
                                        continue;
                                    if (((_3 = (_2 = profile.normal) === null || _2 === void 0 ? void 0 : _2.modelID) === null || _3 === void 0 ? void 0 : _3.startsWith(modelPrefix)) ||
                                        ((_5 = (_4 = profile.expert) === null || _4 === void 0 ? void 0 : _4.modelID) === null || _5 === void 0 ? void 0 : _5.startsWith(modelPrefix)))
                                        blocked.push("session:".concat(exec.session.id, ":").concat(stream));
                                }
                            }
                            if (blocked.length)
                                return [2 /*return*/, {
                                        removed: false,
                                        reason: "provider is referenced by ".concat(blocked.join(", ")),
                                    }];
                            if (defaultModelReferencesProvider) {
                                currentModelID = (_8 = (_7 = (_6 = ctx.ports.getActiveExec()) === null || _6 === void 0 ? void 0 : _6.selectedModel) === null || _7 === void 0 ? void 0 : _7.modelID) !== null && _8 !== void 0 ? _8 : (_9 = ctx.ports.getSelectedModel()) === null || _9 === void 0 ? void 0 : _9.modelID;
                                if (currentModelID && !currentModelID.startsWith(modelPrefix)) {
                                    try {
                                        newDefaultModel = (0, contracts_1.parseModelRef)(currentModelID);
                                    }
                                    catch (_15) {
                                        newDefaultModel = undefined;
                                    }
                                }
                                if (!newDefaultModel) {
                                    for (_l = 0, _m = Object.entries((_11 = (_10 = config.catalog) === null || _10 === void 0 ? void 0 : _10.providers) !== null && _11 !== void 0 ? _11 : {}); _l < _m.length; _l++) {
                                        _o = _m[_l], providerID = _o[0], catalogProvider = _o[1];
                                        if (providerID === name)
                                            continue;
                                        firstModel = Object.keys((_12 = catalogProvider === null || catalogProvider === void 0 ? void 0 : catalogProvider.models) !== null && _12 !== void 0 ? _12 : {})[0];
                                        if (firstModel) {
                                            newDefaultModel = { provider: providerID, model: firstModel };
                                            break;
                                        }
                                    }
                                }
                                if (!newDefaultModel)
                                    return [2 /*return*/, {
                                            removed: false,
                                            reason: "provider is the only configured provider; cannot remove without creating another provider",
                                        }];
                            }
                            modelOverrides = Object.fromEntries(Object.keys((_13 = config.modelOverrides) !== null && _13 !== void 0 ? _13 : {})
                                .filter(function (key) { return key.startsWith(modelPrefix); })
                                .map(function (key) { return [key, undefined]; }));
                            return [4 /*yield*/, (0, config_1.updateConfigAtScope)(ctx.ports.getWorkspaceRoot(), __assign({ providers: (_p = {}, _p[name] = undefined, _p), catalog: { providers: (_q = {}, _q[name] = undefined, _q) }, modelOverrides: modelOverrides }, (newDefaultModel ? { defaultModel: newDefaultModel } : {})), "global", { globalPath: options.globalConfigPath })];
                        case 2:
                            _14.sent();
                            return [4 /*yield*/, ctx.ports.applyConfigFromDisk()];
                        case 3:
                            _14.sent();
                            return [2 /*return*/, __assign({ removed: true }, (newDefaultModel
                                    ? { defaultModel: (0, contracts_1.modelRefKey)(newDefaultModel) }
                                    : {}))];
                    }
                });
            });
        },
    };
}
function isRuntimeReasoningEffort(value) {
    return (value === "minimal" ||
        value === "low" ||
        value === "medium" ||
        value === "high" ||
        value === "xhigh");
}
