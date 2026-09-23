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
exports.configureRuntime = configureRuntime;
var collaboration_1 = require("@natalia/collaboration");
var runtime_1 = require("./runtime");
var runtime_services_1 = require("@natalia/runtime-services");
var session_store_1 = require("@anthelia/session-store");
var tool_policy_1 = require("@natalia/tool-policy");
function configureRuntime(ctx_1, options_1, _a) {
    return __awaiter(this, arguments, void 0, function (ctx, options, _b) {
        var scope, start, mark, _c, resolvedSessionStore, configured, _d;
        var _e, _f, _g, _h, _j, _k;
        var runtimeConfig = _b.runtimeConfig, tsConfig = _b.tsConfig;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    scope = (0, runtime_1.createInitializeRuntime)(ctx);
                    start = performance.now();
                    mark = function (name) {
                        return (0, runtime_services_1.perfLog)("[perf] configureRuntime.".concat(name, " +").concat((performance.now() - start).toFixed(1), "ms"));
                    };
                    _c = ctx.state;
                    return [4 /*yield*/, scope.wireFrameworkServices(ctx, options)];
                case 1:
                    _c.frameworkServices = _l.sent();
                    mark("wireFrameworkServices");
                    return [4 /*yield*/, scope.mountPlugins({
                            controller: scope.pluginsController,
                            config: tsConfig.config.plugins,
                        })];
                case 2:
                    _l.sent();
                    mark("mountPlugins");
                    resolvedSessionStore = scope.serviceDirectory.get(session_store_1.sessionStoreController);
                    if (!resolvedSessionStore)
                        throw new Error("session store unavailable (natalia-session-store)");
                    // Resolution is fail-fast by construction (see the checks above).
                    scope.serviceDirectory.get(tool_policy_1.toolPolicy);
                    // Resolution is fail-fast by construction: a missing binding throws with the
                    // service id instead of being re-worded at every call site.
                    scope.serviceDirectory.get(collaboration_1.collaborationWaiter);
                    scope.retryPolicy = {
                        maxAttemptsPerStep: (_e = tsConfig.config.runtime.maxAttemptsPerStep) !== null && _e !== void 0 ? _e : tsConfig.config.runtime.retry.maxAttemptsPerStep,
                        initialBackoffMs: tsConfig.config.runtime.retry.initialBackoffMs,
                        maxBackoffMs: tsConfig.config.runtime.retry.maxBackoffMs,
                        jitterMs: tsConfig.config.runtime.retry.jitterMs,
                    };
                    scope.maxSteps = tsConfig.config.runtime.maxStepsPerTurn;
                    // The fan-out ceiling: parallel sub-agent streams take a slot per
                    // scope.provider instead of tripping rate limits.
                    scope.providerConcurrencyLimiter = new scope.ProviderConcurrencyLimiter((_f = tsConfig.config.runtime.providerConcurrency) !== null && _f !== void 0 ? _f : {});
                    // The config is a kernel service provided by the runtime-config built-in
                    // plugin; plugins and tool families resolve it by name and subscribe to
                    // its updates.
                    if (options.permissionProfile &&
                        !tsConfig.config.agentModes[options.permissionProfile])
                        throw new Error("permission profile not found: ".concat(options.permissionProfile));
                    if (!(((_g = scope.selectedPermissionProfile) === null || _g === void 0 ? void 0 : _g.commandRules) &&
                        scope.selectedPermissionProfile.commandRules.mode !== "none")) return [3 /*break*/, 4];
                    return [4 /*yield*/, scope.ensureBashCommandParser()];
                case 3:
                    _l.sent();
                    _l.label = 4;
                case 4:
                    mark("runtimeSettings");
                    scope.agentRegistry = scope.agentsFromConfig(tsConfig.config);
                    scope.selectedAgent = scope.agentRegistry.default();
                    if (Object.keys(tsConfig.config.agents).length && !scope.selectedAgent)
                        scope.publish({
                            type: "diagnostic",
                            level: "warning",
                            message: "TS config has no selectable primary agent; continuing with the configured default model.",
                        });
                    if (!options.provider) {
                        configured = scope.providerForModel(tsConfig.config, (_j = (_h = scope.selectedAgent) === null || _h === void 0 ? void 0 : _h.model) !== null && _j !== void 0 ? _j : tsConfig.config.defaultModel, (_k = scope.selectedAgent) === null || _k === void 0 ? void 0 : _k.variant, 
                        // The session id is the cache key: it routes this session's requests onto
                        // the provider's cache shard. Per-session rather than global, so a
                        // subagent or collaborator stream does not evict the main one. Sent only
                        // when the endpoint declares it accepts a key.
                        { sessionID: ctx.state.sessionID });
                        if (configured) {
                            scope.provider = configured;
                            scope.providerSource = "ts_config";
                            scope.publish({
                                type: "diagnostic",
                                level: "info",
                                message: "Loaded provider/model/runtime settings from .natalia/config.json; API key remains in memory only.",
                            });
                        }
                        else if (tsConfig.sources.some(function (source) { return source.scope !== "defaults" && source.applied; })) {
                            scope.publish({
                                type: "diagnostic",
                                level: "warning",
                                message: "TS config has no complete provider/model/API-key selection; configure a provider or environment credential.",
                            });
                        }
                    }
                    mark("agentProvider");
                    _d = scope;
                    return [4 /*yield*/, scope.resolveContextStatusConfig(tsConfig.config, scope.provider, scope.contextWindowResolver, scope.modelRefKeyForSelection(scope.selectedAgent, scope.selectedModel))];
                case 5:
                    _d.runtimeContextConfig = _l.sent();
                    mark("contextStatus");
                    scope.applyAgentPolicy();
                    mark("done");
                    return [2 /*return*/];
            }
        });
    });
}
