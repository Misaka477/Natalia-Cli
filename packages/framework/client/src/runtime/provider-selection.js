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
exports.defaultContextStatusConfig = defaultContextStatusConfig;
exports.createProviderSelection = createProviderSelection;
/**
 * Provider and model selection — runtime/provider-selection module.
 *
 * Resolves the effective `provider/model` for a session, refreshes per-session
 * execution context config, and exposes the model catalog and capability
 * helpers. Reads host state and writes the shared provider/model selection
 * through `RuntimeContext` ports at call time.
 */
var config_1 = require("@natalia/config");
var contracts_1 = require("@natalia/contracts");
var runtime_1 = require("@natalia/runtime");
var model_ref_key_1 = require("../model-ref-key");
var substrate_1 = require("@anthelia/substrate");
var runtime_services_1 = require("@natalia/runtime-services");
function defaultContextStatusConfig() {
    var _a, _b;
    var max = Math.max(32000, Number((_a = process.env.NATALIA_CONTEXT_WINDOW) !== null && _a !== void 0 ? _a : 32000));
    // A 32k-class window must not reserve a flat 20k output budget: that would
    // trip the reserved-capacity compaction guard on ordinary multi-step turns.
    // Derive the reserve from the same conservative formula the resolved path
    // uses (min(20000, max(4096, window*0.1))) unless an explicit override is set.
    var envReserved = process.env.NATALIA_CONTEXT_RESERVED;
    var reserved = (0, runtime_1.resolveReservedOutputTokens)({
        contextWindow: max,
        configuredReserved: envReserved === undefined || envReserved === ""
            ? "auto"
            : Number(envReserved),
    });
    return {
        max: max,
        thresholdPercent: Number((_b = process.env.NATALIA_CONTEXT_THRESHOLD) !== null && _b !== void 0 ? _b : 85),
        reserved: Math.max(1, reserved.tokens),
        reservedSource: reserved.source,
        // Schema defaults, applied here so a pre-config default is still a complete
        // budget rather than a partially-filled one (plan §2.3).
        preservedRecentMessages: 10,
        preservedRecentTokens: 0,
        maxOverflowRetries: 1,
        prune: runtime_1.DEFAULT_TOOL_RESULT_PRUNE_OPTIONS,
    };
}
function resolveContextStatusConfig(config, provider, resolver, selectedRef) {
    return __awaiter(this, void 0, void 0, function () {
        var applyPolicy, resolveStart, mark, effective, executingModel, selectionMatchesProvider, executingProvider, providerConfig, canProbeExecutingProvider, contextWindow, catalog, _a, discoveredOutput, reserved, effectiveWindow, budget;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0:
                    applyPolicy = function (base) {
                        var budget = __assign(__assign({}, base), { preservedRecentMessages: config.context.preservedRecentMessages, preservedRecentTokens: config.context.preservedRecentTokens, maxOverflowRetries: config.context.maxOverflowRetries });
                        (0, runtime_1.assertContextBudgetInvariants)(budget);
                        return budget;
                    };
                    if (!selectedRef && !config.defaultModel)
                        return [2 /*return*/, applyPolicy(defaultContextStatusConfig())];
                    resolveStart = performance.now();
                    mark = function (name) {
                        return (0, runtime_services_1.perfLog)("[perf] resolveContextStatusConfig.".concat(name, " model=").concat(selectedRef !== null && selectedRef !== void 0 ? selectedRef : config.defaultModel, " +").concat((performance.now() - resolveStart).toFixed(1), "ms"));
                    };
                    effective = (0, config_1.resolveEffectiveModel)(config, selectedRef !== null && selectedRef !== void 0 ? selectedRef : config.defaultModel);
                    if (!effective)
                        return [2 /*return*/, applyPolicy(defaultContextStatusConfig())];
                    mark("effective");
                    executingModel = (_b = provider === null || provider === void 0 ? void 0 : provider.model) !== null && _b !== void 0 ? _b : effective.ref.model;
                    selectionMatchesProvider = executingModel === effective.ref.model;
                    executingProvider = selectionMatchesProvider
                        ? effective.providerID
                        : ((_c = provider === null || provider === void 0 ? void 0 : provider.provider) !== null && _c !== void 0 ? _c : effective.providerID);
                    providerConfig = config.providers[executingProvider];
                    canProbeExecutingProvider = selectionMatchesProvider || !!providerConfig;
                    mark("config");
                    return [4 /*yield*/, resolver.resolve({
                            provider: executingProvider,
                            model: executingModel,
                            baseURL: (_d = providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.connection) === null || _d === void 0 ? void 0 : _d.baseURL,
                            apiKey: (_e = providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.connection) === null || _e === void 0 ? void 0 : _e.apiKey,
                            explicitContextWindow: selectionMatchesProvider
                                ? effective.limits.contextWindow
                                : undefined,
                            providerAdapter: config.context.autoDetectWindow &&
                                canProbeExecutingProvider &&
                                shouldProbeProviderMetadata((_f = providerConfig === null || providerConfig === void 0 ? void 0 : providerConfig.connection) === null || _f === void 0 ? void 0 : _f.baseURL)
                                ? provider
                                : undefined,
                            useModelsDevCatalog: config.context.autoDetectWindow,
                        })];
                case 1:
                    contextWindow = _m.sent();
                    mark("resolver");
                    if (!config.context.autoDetectWindow) return [3 /*break*/, 3];
                    return [4 /*yield*/, (0, runtime_1.modelsDevModelLimits)(executingProvider, executingModel)];
                case 2:
                    _a = _m.sent();
                    return [3 /*break*/, 4];
                case 3:
                    _a = undefined;
                    _m.label = 4;
                case 4:
                    catalog = _a;
                    mark("modelsDev");
                    mark("modelsDev2");
                    discoveredOutput = (_h = (_g = contextWindow.maxOutputTokens) !== null && _g !== void 0 ? _g : catalog === null || catalog === void 0 ? void 0 : catalog.maxOutputTokens) !== null && _h !== void 0 ? _h : (0, runtime_1.knownModelOutputLimit)(executingModel);
                    mark("discoveredOutput");
                    reserved = (0, runtime_1.resolveReservedOutputTokens)({
                        configuredReserved: (_j = effective.limits.reservedOutputTokens) !== null && _j !== void 0 ? _j : config.context.reservedOutputTokens,
                        explicitMaxOutputTokens: selectionMatchesProvider
                            ? effective.limits.maxOutputTokens
                            : undefined,
                        providerOutputLimit: discoveredOutput,
                        catalogOutputLimit: catalog === null || catalog === void 0 ? void 0 : catalog.maxOutputTokens,
                        contextWindow: contextWindow.tokens,
                    });
                    mark("reserved");
                    effectiveWindow = Math.min(contextWindow.tokens, (_k = effective.limits.inputLimit) !== null && _k !== void 0 ? _k : contextWindow.tokens);
                    budget = {
                        max: effectiveWindow,
                        thresholdPercent: (_l = effective.limits.compactionThresholdPercent) !== null && _l !== void 0 ? _l : config.context.compactionThresholdPercent,
                        reserved: Math.min(effectiveWindow, reserved.source === "config"
                            ? reserved.tokens
                            : Math.min(20000, reserved.tokens)),
                        reservedSource: reserved.source,
                        // `applyPolicy` below fills the preserved-recent / overflow policy from the
                        // workspace config for every return path (plan §2.3).
                        preservedRecentMessages: config.context.preservedRecentMessages,
                        preservedRecentTokens: config.context.preservedRecentTokens,
                        maxOverflowRetries: config.context.maxOverflowRetries,
                        prune: runtime_1.DEFAULT_TOOL_RESULT_PRUNE_OPTIONS,
                    };
                    // Config-time invariant: a preserved tail above the compaction threshold can
                    // never be satisfied, so reject it here instead of spinning at runtime.
                    return [2 /*return*/, applyPolicy(budget)];
            }
        });
    });
}
function shouldProbeProviderMetadata(baseURL) {
    if (!baseURL)
        return true;
    try {
        var hostname = new URL(baseURL).hostname;
        return (hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1");
    }
    catch (_a) {
        return false;
    }
}
function createProviderSelection(ctx, options) {
    return {
        currentModelImageInput: currentModelImageInput,
        modelCapabilitiesForExecution: modelCapabilitiesForExecution,
        mediaTypeForImage: mediaTypeForImage,
        applyAgentProvider: applyAgentProvider,
        refreshExecutionContextConfig: refreshExecutionContextConfig,
        modelRefKeyForSelection: modelRefKeyForSelection,
        selectedModelRefKey: selectedModelRefKey,
        effectiveMaxSteps: effectiveMaxSteps,
        redactToolOutputEnabled: redactToolOutputEnabled,
        selectRuntimeModel: selectRuntimeModel,
        clientModelCatalog: clientModelCatalog,
        defaultContextStatusConfig: defaultContextStatusConfig,
        resolveContextStatusConfig: resolveContextStatusConfig,
    };
    function currentModelImageInput(exec) {
        var _a, _b;
        var _c = ctx.ports, getTsRuntimeConfig = _c.getTsRuntimeConfig, getSelectedAgent = _c.getSelectedAgent, getSelectedModel = _c.getSelectedModel;
        if (exec === null || exec === void 0 ? void 0 : exec.activeModelCapabilities)
            return exec.activeModelCapabilities.imageInput;
        var ref = modelRefKeyForSelection(exec ? exec.selectedAgent : getSelectedAgent(), exec ? exec.selectedModel : getSelectedModel());
        var tsRuntimeConfig = getTsRuntimeConfig();
        if (!ref || !tsRuntimeConfig)
            return false;
        return ((_b = (_a = (0, config_1.resolveEffectiveModel)(tsRuntimeConfig, ref)) === null || _a === void 0 ? void 0 : _a.capabilities.imageInput) !== null && _b !== void 0 ? _b : false);
    }
    function modelCapabilitiesForExecution(exec) {
        var _a, _b;
        var getTsRuntimeConfig = ctx.ports.getTsRuntimeConfig;
        var agent = exec === null || exec === void 0 ? void 0 : exec.selectedAgent;
        var model = exec === null || exec === void 0 ? void 0 : exec.selectedModel;
        var ref = modelRefKeyForSelection(agent, model);
        var tsRuntimeConfig = getTsRuntimeConfig();
        return ((_b = (ref && tsRuntimeConfig
            ? (_a = (0, config_1.resolveEffectiveModel)(tsRuntimeConfig, ref)) === null || _a === void 0 ? void 0 : _a.capabilities
            : undefined)) !== null && _b !== void 0 ? _b : {
            toolCall: true,
            reasoning: true,
            thinking: true,
            imageInput: false,
            videoInput: false,
        });
    }
    function mediaTypeForImage(path) {
        var _a, _b;
        var ext = (_b = (_a = path.split(".").pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : "";
        if (ext === "png")
            return "image/png";
        if (ext === "jpg" || ext === "jpeg")
            return "image/jpeg";
        if (ext === "webp")
            return "image/webp";
        if (ext === "gif")
            return "image/gif";
        return undefined;
    }
    function applyAgentProvider(exec) {
        var _a, _b, _c, _d;
        var _e = ctx.ports, getTsRuntimeConfig = _e.getTsRuntimeConfig, getProviderSource = _e.getProviderSource, getSelectedAgent = _e.getSelectedAgent, getSelectedModel = _e.getSelectedModel, getActiveExec = _e.getActiveExec, setProvider = _e.setProvider, publishForSession = _e.publishForSession;
        if (options.provider || getProviderSource() !== "ts_config")
            return;
        var tsRuntimeConfig = getTsRuntimeConfig();
        if (!tsRuntimeConfig)
            return;
        var selectedAgent = getSelectedAgent();
        var selectedModel = getSelectedModel();
        var agent = exec ? exec.selectedAgent : selectedAgent;
        var model = exec ? exec.selectedModel : selectedModel;
        var ref = modelRefKeyForSelection(agent, model);
        if (!ref) {
            publishForSession(exec, {
                type: "diagnostic",
                level: "warning",
                message: "agent ".concat((_a = agent === null || agent === void 0 ? void 0 : agent.name) !== null && _a !== void 0 ? _a : "default", " model override is unavailable: model_not_configured; retaining current provider"),
            });
            return;
        }
        var next = (0, runtime_1.providerForModel)(tsRuntimeConfig, ref, (_b = agent === null || agent === void 0 ? void 0 : agent.variant) !== null && _b !== void 0 ? _b : model === null || model === void 0 ? void 0 : model.variant, { reasoningEffort: exec === null || exec === void 0 ? void 0 : exec.reasoningEffort });
        if (!next) {
            var status_1 = (0, config_1.modelSelectionStatus)(tsRuntimeConfig, ref);
            publishForSession(exec, {
                type: "diagnostic",
                level: "warning",
                message: "agent ".concat((_c = agent === null || agent === void 0 ? void 0 : agent.name) !== null && _c !== void 0 ? _c : "default", " model override is unavailable: ").concat((_d = status_1.reason) !== null && _d !== void 0 ? _d : "provider_not_configured", "; retaining current provider"),
            });
            return;
        }
        if (exec)
            exec.provider = next;
        if (!exec || exec === getActiveExec())
            setProvider(next);
    }
    function refreshExecutionContextConfig(exec) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, getTsRuntimeConfig, getContextWindowResolver, getActiveExec, setRuntimeContextConfig, tsRuntimeConfig, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = ctx.ports, getTsRuntimeConfig = _a.getTsRuntimeConfig, getContextWindowResolver = _a.getContextWindowResolver, getActiveExec = _a.getActiveExec, setRuntimeContextConfig = _a.setRuntimeContextConfig;
                        tsRuntimeConfig = getTsRuntimeConfig();
                        if (!tsRuntimeConfig)
                            return [2 /*return*/];
                        _b = exec;
                        return [4 /*yield*/, resolveContextStatusConfig(tsRuntimeConfig, exec.provider, getContextWindowResolver(), modelRefKeyForSelection(exec.selectedAgent, exec.selectedModel))];
                    case 1:
                        _b.runtimeContextConfig = _c.sent();
                        if (exec === getActiveExec())
                            setRuntimeContextConfig(exec.runtimeContextConfig);
                        return [2 /*return*/];
                }
            });
        });
    }
    /** The canonical `provider/model` key of the effective model selection. */
    function modelRefKeyForSelection(agent, model) {
        var _a;
        var getTsRuntimeConfig = ctx.ports.getTsRuntimeConfig;
        return (0, model_ref_key_1.deriveModelRefKey)({
            agent: agent,
            model: model,
            defaultModel: (_a = getTsRuntimeConfig()) === null || _a === void 0 ? void 0 : _a.defaultModel,
        });
    }
    function selectedModelRefKey() {
        var _a = ctx.ports, getSelectedAgent = _a.getSelectedAgent, getSelectedModel = _a.getSelectedModel;
        return modelRefKeyForSelection(getSelectedAgent(), getSelectedModel());
    }
    function effectiveMaxSteps(exec) {
        var _a, _b, _c;
        var _d = ctx.ports, getSelectedAgent = _d.getSelectedAgent, getMaxSteps = _d.getMaxSteps;
        return ((_c = (_b = (_a = (exec ? exec.selectedAgent : getSelectedAgent())) === null || _a === void 0 ? void 0 : _a.maxSteps) !== null && _b !== void 0 ? _b : getMaxSteps()) !== null && _c !== void 0 ? _c : Number.POSITIVE_INFINITY);
    }
    /**
     * Redaction precedence, matching how the other boundaries resolve: an agent
     * that states a value wins, then the workspace `security.redactToolOutput`
     * setting, then the schema default.
     */
    function redactToolOutputEnabled(exec) {
        var _a, _b, _c, _d, _e;
        var _f = ctx.ports, getSelectedAgent = _f.getSelectedAgent, getTsRuntimeConfig = _f.getTsRuntimeConfig;
        return ((_e = (_c = (_b = (_a = (exec ? exec.selectedAgent : getSelectedAgent())) === null || _a === void 0 ? void 0 : _a.permissions) === null || _b === void 0 ? void 0 : _b.redactOutput) !== null && _c !== void 0 ? _c : (_d = getTsRuntimeConfig()) === null || _d === void 0 ? void 0 : _d.security.redactToolOutput) !== null && _e !== void 0 ? _e : true);
    }
    function selectRuntimeModel(modelID, variant, exec) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, getReady, getTsRuntimeConfig, getActiveExec, setSelectedModel, publishForSession, tsRuntimeConfig, ref, status_2, nextSelection;
            var _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = ctx.ports, getReady = _a.getReady, getTsRuntimeConfig = _a.getTsRuntimeConfig, getActiveExec = _a.getActiveExec, setSelectedModel = _a.setSelectedModel, publishForSession = _a.publishForSession;
                        return [4 /*yield*/, getReady()];
                    case 1:
                        _c.sent();
                        tsRuntimeConfig = getTsRuntimeConfig();
                        if (!tsRuntimeConfig)
                            throw new Error("runtime config is unavailable");
                        if (modelID) {
                            ref = (0, contracts_1.parseModelRef)(modelID);
                            status_2 = (0, config_1.modelSelectionStatus)(tsRuntimeConfig, ref);
                            if (!status_2.selected)
                                throw new Error("model is unavailable: ".concat((_b = status_2.reason) !== null && _b !== void 0 ? _b : modelID));
                        }
                        else if (variant) {
                            throw new Error("a variant requires a selected model");
                        }
                        nextSelection = ref
                            ? { modelID: (0, contracts_1.modelRefKey)(ref), variant: variant }
                            : undefined;
                        if (exec)
                            exec.selectedModel = nextSelection;
                        if (exec === getActiveExec())
                            setSelectedModel(nextSelection);
                        applyAgentProvider(exec);
                        if (!exec) return [3 /*break*/, 3];
                        return [4 /*yield*/, refreshExecutionContextConfig(exec)];
                    case 2:
                        _c.sent();
                        _c.label = 3;
                    case 3:
                        publishForSession(exec, {
                            type: "model.selection",
                            modelID: ref ? (0, contracts_1.modelRefKey)(ref) : undefined,
                            variant: variant,
                        });
                        return [2 /*return*/];
                }
            });
        });
    }
    function clientModelCatalog() {
        return __awaiter(this, void 0, void 0, function () {
            var _a, getReady, getTsRuntimeConfig, config, providers, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = ctx.ports, getReady = _a.getReady, getTsRuntimeConfig = _a.getTsRuntimeConfig;
                        return [4 /*yield*/, getReady()];
                    case 1:
                        _c.sent();
                        config = getTsRuntimeConfig();
                        if (!config)
                            return [2 /*return*/, []];
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 4, , 5]);
                        return [4 /*yield*/, (0, substrate_1.modelCatalogInWorker)(config)];
                    case 3:
                        providers = _c.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _b = _c.sent();
                        providers = (0, config_1.buildModelCatalog)(config);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/, providers.flatMap(function (provider) {
                            return provider.models
                                .filter(function (entry) {
                                return (0, config_1.modelSelectionStatus)(config, (0, contracts_1.modelRefKey)({ provider: provider.id, model: entry.id })).selected;
                            })
                                .map(function (entry) { return ({
                                id: (0, contracts_1.modelRefKey)({ provider: provider.id, model: entry.id }),
                                name: entry.name,
                                provider: provider.id,
                                // V3 removed model variants; the catalog exposes none.
                                variants: [],
                            }); });
                        })];
                }
            });
        });
    }
}
