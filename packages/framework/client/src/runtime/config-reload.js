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
exports.activeConstitutionRows = activeConstitutionRows;
exports.createConfigReload = createConfigReload;
/**
 * Config reload — runtime/config-reload.ts.
 *
 * `applyConfigFromDisk` and `reloadConfigFromDisk` re-read the resolved config
 * and apply it live: runtime limits, permission settings, the agent registry,
 * the default plugin catalog and provider re-selection. Reads and writes host
 * state through `RuntimeContext` ports.
 */
var agent_1 = require("@anthelia/agent");
var subagents_1 = require("@anthelia/subagents");
var config_1 = require("@natalia/config");
var tools_1 = require("@anthelia/tools");
var runtime_1 = require("@natalia/runtime");
var session_1 = require("@anthelia/session");
var session_2 = require("@anthelia/session");
var checkpoint_1 = require("@anthelia/checkpoint");
var object_store_1 = require("@natalia/object-store");
var composition_1 = require("@natalia/composition");
var platform_1 = require("@natalia/platform");
var runtime_2 = require("@natalia/runtime");
/**
 * The checkpoint factory owns per-session controllers; a config reload must
 * reset them so the next initialization reads the new checkpoint settings.
 */
/**
 * Re-render the `agent_spawn` description from the current agent registry.
 *
 * The request builder reads each tool's description per step, so mutating it in
 * place is enough — no re-registration, and the tool's identity (name,
 * parameters) is untouched so the request prefix does not churn.
 */
/**
 * The constitution rows a generation carries (study §4.1): the active
 * ledger projected from the session's journal, normalized from the
 * `rule_added` event shape into contract rows. Empty only when no session
 * exists yet — there is no active constitution to violate.
 */
function activeConstitutionRows(ctx) {
    var exec = __spreadArray([], ctx.ports.getExecutionBySession().values(), true)[0];
    if (!(exec === null || exec === void 0 ? void 0 : exec.session))
        return [];
    return (0, session_2.projectedConstitutionRules)(exec.session.events).map(function (event) {
        var _a;
        return ({
            id: event.ruleID,
            statement: event.statement,
            scope: event.scope,
            priority: event.priority,
            source: event.source,
            enforcement: event.enforcement,
            overridePolicy: event.overridePolicy,
            evidenceRefs: (_a = event.evidenceRefs) !== null && _a !== void 0 ? _a : [],
        });
    });
}
function refreshAgentSpawnDescription(ctx, registry) {
    var spawn = ctx.state.tools.get("agent_spawn");
    if (!spawn)
        return;
    spawn.description = [
        "Spawn an isolated TS/Bun subagent task.",
        (0, subagents_1.renderSubagentTypes)(registry.list().map(function (agent) { return ({
            name: agent.name,
            description: agent.description,
            mode: agent.mode,
            allowedTools: agent.allowedTools,
            excludedTools: agent.excludedTools,
        }); })),
    ]
        .filter(Boolean)
        .join("\n");
}
function resetCheckpointFactory(ctx) {
    var _a;
    var checkpointClose = ctx.state.serviceDirectory.getOptional(checkpoint_1.checkpointFactory);
    (_a = checkpointClose === null || checkpointClose === void 0 ? void 0 : checkpointClose.close) === null || _a === void 0 ? void 0 : _a.call(checkpointClose);
}
var lastGenerationID;
function createConfigReload(ctx, options) {
    var reloadQueue = Promise.resolve({ read: false, providerReconfigured: false });
    return {
        configReloadBlockedReason: configReloadBlockedReason,
        applyConfigFromDisk: applyConfigFromDisk,
        reloadConfigFromDisk: reloadConfigFromDisk,
    };
    function configReloadBlockedReason() {
        var _a;
        var _b = ctx.ports, getExecutionBySession = _b.getExecutionBySession, getInteractive = _b.getInteractive;
        if (__spreadArray([], getExecutionBySession().values(), true).some(function (exec) { return exec.activeTurnID; }))
            return "runtime config cannot be applied while a turn is running";
        if ((_a = getInteractive()) === null || _a === void 0 ? void 0 : _a.hasPendingWaiters())
            return "runtime config cannot be applied while an approval or question is pending";
        return undefined;
    }
    /**
     * Reloads config from disk and applies it, answering value-style. Shared by
     * `reloadConfig` and `updateConfig` so the two write-apply paths cannot
     * drift.
     */
    function applyConfigFromDisk() {
        return __awaiter(this, void 0, void 0, function () {
            var _a, publish, scheduleRuntimeStatusSnapshot, blocked, reloaded, reason, _i, _b, exec, revision, candidateID;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = ctx.ports, publish = _a.publish, scheduleRuntimeStatusSnapshot = _a.scheduleRuntimeStatusSnapshot;
                        blocked = configReloadBlockedReason();
                        if (blocked)
                            return [2 /*return*/, { applied: false, reason: blocked }];
                        return [4 /*yield*/, reloadConfigFromDisk()];
                    case 1:
                        reloaded = _c.sent();
                        if (!reloaded.read) {
                            reason = "runtime config on disk could not be read";
                            publish({ type: "diagnostic", level: "warning", message: reason });
                            return [2 /*return*/, { applied: false, reason: reason }];
                        }
                        if (reloaded.reason) {
                            publish({
                                type: "diagnostic",
                                level: "warning",
                                message: reloaded.reason,
                            });
                            return [2 /*return*/, { applied: false, reason: reloaded.reason }];
                        }
                        publish({
                            type: "diagnostic",
                            level: "info",
                            message: reloaded.providerReconfigured
                                ? "runtime config reloaded; provider reconfigured from disk"
                                : "runtime config reloaded; provider unchanged",
                        });
                        // ADR Phase C: a config reload is a prompt-level instruction change.
                        // Record it as a durable `context.instructions` notice per session so the
                        // interleaved context stream shows it — appended with a higher revision,
                        // never mutating earlier messages (D3/D6).
                        for (_i = 0, _b = ctx.ports.getExecutionBySession().values(); _i < _b.length; _i++) {
                            exec = _b[_i];
                            revision = (0, session_1.nextContextInstructionsRevision)(exec.session.events);
                            ctx.ports.publishForSession(exec, {
                                type: "context.instructions",
                                id: "context:config:".concat(Date.now().toString(36), ":").concat(revision),
                                kind: "config_reload",
                                at: new Date().toISOString(),
                                revision: revision,
                                summary: reloaded.providerReconfigured
                                    ? "runtime config reloaded; provider reconfigured from disk"
                                    : "runtime config reloaded; provider unchanged",
                            });
                        }
                        scheduleRuntimeStatusSnapshot();
                        return [4 /*yield*/, stageCandidate("config.reload")];
                    case 2:
                        candidateID = _c.sent();
                        if (candidateID)
                            commitCandidate(candidateID, "config.reload");
                        return [2 /*return*/, { applied: true }];
                }
            });
        });
    }
    /**
     * Stages the reloaded composition as a content-addressed candidate and
     * publishes the attempt (P2 / NGM G2). The candidate is stored before the
     * switch is decided, so a failed apply leaves a proposal in the journal
     * with no matching switch — the record of what was tried.
     */
    function stageCandidate(reason) {
        return __awaiter(this, void 0, void 0, function () {
            var config, store, catalog, candidateID, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        config = ctx.ports.getTsRuntimeConfig();
                        if (!config)
                            return [2 /*return*/, undefined];
                        store = new object_store_1.ObjectStore((0, platform_1.resolveWorkspaceObjectsRoot)(ctx.ports.getWorkspaceRoot()));
                        catalog = ctx.ports.getPluginsController().catalog();
                        return [4 /*yield*/, (0, composition_1.storeGeneration)(store, (0, composition_1.buildGeneration)({
                                config: config,
                                catalog: catalog,
                                policyRows: activeConstitutionRows(ctx),
                            }))];
                    case 1:
                        candidateID = _a.sent();
                        ctx.ports.publish({ type: "composition.proposed", candidateID: candidateID, reason: reason });
                        return [2 /*return*/, candidateID];
                    case 2:
                        error_1 = _a.sent();
                        ctx.ports.publish({
                            type: "diagnostic",
                            level: "warning",
                            message: "composition record failed: ".concat(error_1 instanceof Error ? error_1.message : String(error_1)),
                        });
                        return [2 /*return*/, undefined];
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    /**
     * Commits the staged candidate as the running generation (P2 / NGM G1/G2).
     * The from-link comes from this closure's memory of the last committed
     * generation; the journal remains the durable record either way.
     */
    function commitCandidate(candidateID, reason) {
        ctx.ports.publish(__assign(__assign({ type: "composition.switched" }, (lastGenerationID ? { from: lastGenerationID } : {})), { to: candidateID, reason: reason }));
        lastGenerationID = candidateID;
    }
    function reloadConfigFromDisk() {
        return __awaiter(this, void 0, void 0, function () {
            var reload;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        reload = reloadQueue.then(applyReloadFromDisk, applyReloadFromDisk);
                        reloadQueue = reload;
                        return [4 /*yield*/, reload];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    }
    function applyReloadFromDisk() {
        return __awaiter(this, void 0, void 0, function () {
            var _a, getWorkspaceRoot, publish, getExecutionBySession, setTsRuntimeConfig, setMaxSteps, setRetryPolicy, setProviderConcurrencyLimiter, getSelectedAgent, setSelectedAgent, setAgentRegistry, getPermissionMode, getSelectedPermissionProfile, getTools, getPluginsController, applyAgentPolicy, setProvider, setProviderSource, getContextWindowResolver, refreshExecutionContextConfig, modelRefKeyForSelection, runPluginLifecyclePostReconcile, publishToolCatalogChanges, workspaceRoot, previous, tsConfig, selectedAgentName, agentRegistry, _i, _b, exec, name_1, permissionMode, selectedPermissionProfile, _c, _d, exec, toolsBeforeReconcile, selectedSkills, adapterResults, _e, adapterResults_1, result, configured, _f, _g, exec, _h, _j, _k, _l, exec, _m, _o, _p, _q, exec, error_2, rollbackError, failure_1, reason;
            var _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
            return __generator(this, function (_1) {
                switch (_1.label) {
                    case 0:
                        _a = ctx.ports, getWorkspaceRoot = _a.getWorkspaceRoot, publish = _a.publish, getExecutionBySession = _a.getExecutionBySession, setTsRuntimeConfig = _a.setTsRuntimeConfig, setMaxSteps = _a.setMaxSteps, setRetryPolicy = _a.setRetryPolicy, setProviderConcurrencyLimiter = _a.setProviderConcurrencyLimiter, getSelectedAgent = _a.getSelectedAgent, setSelectedAgent = _a.setSelectedAgent, setAgentRegistry = _a.setAgentRegistry, getPermissionMode = _a.getPermissionMode, getSelectedPermissionProfile = _a.getSelectedPermissionProfile, getTools = _a.getTools, getPluginsController = _a.getPluginsController, applyAgentPolicy = _a.applyAgentPolicy, setProvider = _a.setProvider, setProviderSource = _a.setProviderSource, getContextWindowResolver = _a.getContextWindowResolver, refreshExecutionContextConfig = _a.refreshExecutionContextConfig, modelRefKeyForSelection = _a.modelRefKeyForSelection, runPluginLifecyclePostReconcile = _a.runPluginLifecyclePostReconcile, publishToolCatalogChanges = _a.publishToolCatalogChanges;
                        workspaceRoot = getWorkspaceRoot();
                        previous = captureReloadState();
                        _1.label = 1;
                    case 1:
                        _1.trys.push([1, 19, , 24]);
                        return [4 /*yield*/, (0, config_1.resolveConfig)({
                                workspaceRoot: workspaceRoot,
                                globalPath: options.globalConfigPath,
                            })];
                    case 2:
                        tsConfig = _1.sent();
                        setTsRuntimeConfig(tsConfig.config);
                        resetCheckpointFactory(ctx);
                        setMaxSteps(tsConfig.config.runtime.maxStepsPerTurn);
                        setRetryPolicy({
                            maxAttemptsPerStep: (_r = tsConfig.config.runtime.maxAttemptsPerStep) !== null && _r !== void 0 ? _r : tsConfig.config.runtime.retry.maxAttemptsPerStep,
                            initialBackoffMs: tsConfig.config.runtime.retry.initialBackoffMs,
                            maxBackoffMs: tsConfig.config.runtime.retry.maxBackoffMs,
                            jitterMs: tsConfig.config.runtime.retry.jitterMs,
                        });
                        setProviderConcurrencyLimiter(new runtime_1.ProviderConcurrencyLimiter((_s = tsConfig.config.runtime.providerConcurrency) !== null && _s !== void 0 ? _s : {}));
                        selectedAgentName = (_t = getSelectedAgent()) === null || _t === void 0 ? void 0 : _t.name;
                        agentRegistry = (0, agent_1.agentsFromConfig)(tsConfig.config);
                        setAgentRegistry(agentRegistry);
                        // Re-render the advertised spawn types: the request builder reads each
                        // tool's description per step, so updating it in place keeps the types
                        // current without disturbing the tool's identity or the request prefix.
                        refreshAgentSpawnDescription(ctx, agentRegistry);
                        setSelectedAgent(selectedAgentName
                            ? ((_u = agentRegistry.select(selectedAgentName)) !== null && _u !== void 0 ? _u : agentRegistry.default())
                            : agentRegistry.default());
                        for (_i = 0, _b = getExecutionBySession().values(); _i < _b.length; _i++) {
                            exec = _b[_i];
                            name_1 = (_v = exec.selectedAgent) === null || _v === void 0 ? void 0 : _v.name;
                            exec.selectedAgent = name_1
                                ? ((_w = agentRegistry.select(name_1)) !== null && _w !== void 0 ? _w : agentRegistry.default())
                                : agentRegistry.default();
                        }
                        // Permission changes (default profile switch, auto/ask flip, profile
                        // edits) apply immediately, not on the next restart.
                        ctx.ports.reloadPermissionSettings(tsConfig.config);
                        (_x = ctx.state.frameworkServices) === null || _x === void 0 ? void 0 : _x.refreshRuntimeConfig();
                        permissionMode = getPermissionMode();
                        selectedPermissionProfile = getSelectedPermissionProfile();
                        for (_c = 0, _d = getExecutionBySession().values(); _c < _d.length; _c++) {
                            exec = _d[_c];
                            exec.permissionMode = permissionMode;
                            exec.permissionProfile = selectedPermissionProfile;
                        }
                        toolsBeforeReconcile = new Set(getTools().keys());
                        selectedSkills = new Map(__spreadArray([], getExecutionBySession().entries(), true).flatMap(function (_a) {
                            var id = _a[0], exec = _a[1];
                            return exec.activeSkill ? [[id, exec.activeSkill.qualifiedName]] : [];
                        }));
                        return [4 /*yield*/, getPluginsController().reconcileDesired([], tsConfig.config.plugins)];
                    case 3:
                        _1.sent();
                        return [4 /*yield*/, runPluginLifecyclePostReconcile(selectedSkills)];
                    case 4:
                        _1.sent();
                        publishToolCatalogChanges(toolsBeforeReconcile);
                        applyAgentPolicy();
                        if (!((selectedPermissionProfile === null || selectedPermissionProfile === void 0 ? void 0 : selectedPermissionProfile.commandRules) &&
                            selectedPermissionProfile.commandRules.mode !== "none")) return [3 /*break*/, 6];
                        return [4 /*yield*/, (0, tools_1.ensureBashCommandParser)().catch(function () { return undefined; })];
                    case 5:
                        _1.sent();
                        _1.label = 6;
                    case 6:
                        if (!!options.provider) return [3 /*break*/, 13];
                        return [4 /*yield*/, (0, runtime_2.reloadProviderAdapterModules)({
                                workspaceRoot: getWorkspaceRoot(),
                                requests: (0, runtime_2.providerAdapterModuleRequests)(tsConfig.config.providers),
                            })];
                    case 7:
                        adapterResults = _1.sent();
                        for (_e = 0, adapterResults_1 = adapterResults; _e < adapterResults_1.length; _e++) {
                            result = adapterResults_1[_e];
                            if (!result.ok)
                                publish({
                                    type: "diagnostic",
                                    level: "warning",
                                    message: "provider adapter module for \"".concat(result.providerID, "\" did not ") +
                                        "load (".concat(result.module, "): ").concat(result.error),
                                });
                        }
                        configured = (0, runtime_1.providerForModel)(tsConfig.config, (_z = (_y = getSelectedAgent()) === null || _y === void 0 ? void 0 : _y.model) !== null && _z !== void 0 ? _z : tsConfig.config.defaultModel, (_0 = getSelectedAgent()) === null || _0 === void 0 ? void 0 : _0.variant);
                        if (!configured) return [3 /*break*/, 13];
                        setProvider(configured);
                        setProviderSource("ts_config");
                        for (_f = 0, _g = getExecutionBySession().values(); _f < _g.length; _f++) {
                            exec = _g[_f];
                            ctx.ports.applyAgentProvider(exec);
                        }
                        _j = (_h = ctx.ports).setRuntimeContextConfig;
                        return [4 /*yield*/, ctx.ports.resolveContextStatusConfig(tsConfig.config, configured, getContextWindowResolver(), modelRefKeyForSelection(getSelectedAgent(), undefined))];
                    case 8:
                        _j.apply(_h, [_1.sent()]);
                        _k = 0, _l = getExecutionBySession().values();
                        _1.label = 9;
                    case 9:
                        if (!(_k < _l.length)) return [3 /*break*/, 12];
                        exec = _l[_k];
                        return [4 /*yield*/, refreshExecutionContextConfig(exec)];
                    case 10:
                        _1.sent();
                        _1.label = 11;
                    case 11:
                        _k++;
                        return [3 /*break*/, 9];
                    case 12: return [2 /*return*/, { read: true, providerReconfigured: true }];
                    case 13:
                        _o = (_m = ctx.ports).setRuntimeContextConfig;
                        return [4 /*yield*/, ctx.ports.resolveContextStatusConfig(tsConfig.config, ctx.ports.getProvider(), getContextWindowResolver(), modelRefKeyForSelection(getSelectedAgent(), undefined))];
                    case 14:
                        _o.apply(_m, [_1.sent()]);
                        _p = 0, _q = getExecutionBySession().values();
                        _1.label = 15;
                    case 15:
                        if (!(_p < _q.length)) return [3 /*break*/, 18];
                        exec = _q[_p];
                        return [4 /*yield*/, refreshExecutionContextConfig(exec)];
                    case 16:
                        _1.sent();
                        _1.label = 17;
                    case 17:
                        _p++;
                        return [3 /*break*/, 15];
                    case 18: return [2 /*return*/, { read: true, providerReconfigured: false }];
                    case 19:
                        error_2 = _1.sent();
                        rollbackError = void 0;
                        _1.label = 20;
                    case 20:
                        _1.trys.push([20, 22, , 23]);
                        return [4 /*yield*/, rollbackReload(previous)];
                    case 21:
                        _1.sent();
                        return [3 /*break*/, 23];
                    case 22:
                        failure_1 = _1.sent();
                        rollbackError = failure_1;
                        return [3 /*break*/, 23];
                    case 23:
                        reason = error_2 instanceof Error ? error_2.message : String(error_2);
                        return [2 /*return*/, {
                                read: true,
                                providerReconfigured: false,
                                reason: "runtime config could not be applied: ".concat(reason).concat(rollbackError === undefined
                                    ? ""
                                    : "; rollback failed: ".concat(rollbackError instanceof Error ? rollbackError.message : String(rollbackError))),
                            }];
                    case 24: return [2 /*return*/];
                }
            });
        });
    }
    function captureReloadState() {
        var ports = ctx.ports;
        return {
            config: ports.getTsRuntimeConfig(),
            maxSteps: ports.getMaxSteps(),
            retryPolicy: ports.getRetryPolicy(),
            limiter: ports.getProviderConcurrencyLimiter(),
            agentRegistry: ports.getAgentRegistry(),
            selectedAgent: ports.getSelectedAgent(),
            permissionMode: ports.getPermissionMode(),
            selectedPermissionProfile: ports.getSelectedPermissionProfile(),
            defaultPermissionMode: ports.getDefaultPermissionMode(),
            defaultPermissionProfile: ports.getDefaultPermissionProfile(),
            provider: ports.getProvider(),
            providerSource: ports.getProviderSource(),
            runtimeContextConfig: ports.getRuntimeContextConfig(),
            executions: new Map(__spreadArray([], ports.getExecutionBySession(), true).map(function (_a) {
                var _b;
                var id = _a[0], exec = _a[1];
                return [
                    id,
                    {
                        selectedAgent: exec.selectedAgent,
                        permissionMode: exec.permissionMode,
                        permissionProfile: exec.permissionProfile,
                        provider: exec.provider,
                        runtimeContextConfig: exec.runtimeContextConfig,
                        activeSkill: (_b = exec.activeSkill) === null || _b === void 0 ? void 0 : _b.qualifiedName,
                    },
                ];
            })),
        };
    }
    function rollbackReload(previous) {
        return __awaiter(this, void 0, void 0, function () {
            var ports, adapterResults, _i, adapterResults_2, result, _a, _b, _c, id, state, exec, toolsBeforeRollback, selectedSkills;
            var _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        ports = ctx.ports;
                        ports.setTsRuntimeConfig(previous.config);
                        resetCheckpointFactory(ctx);
                        ports.setMaxSteps(previous.maxSteps);
                        ports.setRetryPolicy(previous.retryPolicy);
                        ports.setProviderConcurrencyLimiter(previous.limiter);
                        if (previous.agentRegistry) {
                            ports.setAgentRegistry(previous.agentRegistry);
                            // The reload re-derived the agent_spawn description from the new registry
                            // in place; restoring the registry alone would leave that description stale,
                            // so re-derive it from the registry we just put back.
                            refreshAgentSpawnDescription(ctx, previous.agentRegistry);
                        }
                        ports.setSelectedAgent(previous.selectedAgent);
                        ports.setPermissionMode(previous.permissionMode);
                        ports.setSelectedPermissionProfile(previous.selectedPermissionProfile);
                        ports.setDefaultPermissionMode(previous.defaultPermissionMode);
                        ports.setDefaultPermissionProfile(previous.defaultPermissionProfile);
                        (_d = ctx.state.frameworkServices) === null || _d === void 0 ? void 0 : _d.refreshRuntimeConfig();
                        ports.setProvider(previous.provider);
                        ports.setProviderSource(previous.providerSource);
                        if (!(!options.provider && previous.config)) return [3 /*break*/, 2];
                        return [4 /*yield*/, (0, runtime_2.reloadProviderAdapterModules)({
                                workspaceRoot: ports.getWorkspaceRoot(),
                                requests: (0, runtime_2.providerAdapterModuleRequests)(previous.config.providers),
                            })];
                    case 1:
                        adapterResults = _e.sent();
                        for (_i = 0, adapterResults_2 = adapterResults; _i < adapterResults_2.length; _i++) {
                            result = adapterResults_2[_i];
                            if (!result.ok)
                                ports.publish({
                                    type: "diagnostic",
                                    level: "warning",
                                    message: "provider adapter module for \"".concat(result.providerID, "\" did not load (").concat(result.module, "): ").concat(result.error),
                                });
                        }
                        _e.label = 2;
                    case 2:
                        ports.setRuntimeContextConfig(previous.runtimeContextConfig);
                        for (_a = 0, _b = previous.executions; _a < _b.length; _a++) {
                            _c = _b[_a], id = _c[0], state = _c[1];
                            exec = ports.getExecutionBySession().get(id);
                            if (!exec)
                                continue;
                            exec.selectedAgent = state.selectedAgent;
                            exec.permissionMode = state.permissionMode;
                            exec.permissionProfile = state.permissionProfile;
                            exec.provider = state.provider;
                            exec.runtimeContextConfig = state.runtimeContextConfig;
                        }
                        ports.applyAgentPolicy();
                        if (!previous.config)
                            return [2 /*return*/];
                        toolsBeforeRollback = new Set(ports.getTools().keys());
                        return [4 /*yield*/, ports
                                .getPluginsController()
                                .reconcileDesired([], previous.config.plugins)];
                    case 3:
                        _e.sent();
                        selectedSkills = new Map(__spreadArray([], previous.executions, true).flatMap(function (_a) {
                            var id = _a[0], state = _a[1];
                            return state.activeSkill ? [[id, state.activeSkill]] : [];
                        }));
                        return [4 /*yield*/, ports.runPluginLifecyclePostReconcile(selectedSkills)];
                    case 4:
                        _e.sent();
                        ports.publishToolCatalogChanges(toolsBeforeRollback);
                        return [2 /*return*/];
                }
            });
        });
    }
}
