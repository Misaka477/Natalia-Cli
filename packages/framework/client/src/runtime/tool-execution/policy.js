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
exports.createToolPolicySurface = createToolPolicySurface;
/**
 * Tool execution policy surface — runtime/tool-execution/policy.ts.
 *
 * The sandbox/workspace authorization checks, the pause waiter, and the
 * resolved tool settings (network/browser/env/egress) that tool execution
 * reads. Reads host state through `RuntimeContext` at call time.
 */
var capability_settings_1 = require("../../capability-settings");
var tool_policy_1 = require("@natalia/tool-policy");
function createToolPolicySurface(ctx) {
    return {
        authorizeSandboxMerge: authorizeSandboxMerge,
        authorizeSandboxManagement: authorizeSandboxManagement,
        authorizeWorkspaceRead: authorizeWorkspaceRead,
        waitIfPaused: waitIfPaused,
        toolSettings: toolSettings,
    };
    function authorizeSandboxMerge(input_1) {
        return __awaiter(this, arguments, void 0, function (input, exec) {
            var _a, getActiveTurnID, getSessionID, publishForSession, toolLayer, activeTurnID, sessionID, _i, _b, path, hookEvent, preResult, _c, _d, diagnostic;
            var _e, _f, _g;
            if (exec === void 0) { exec = ctx.ports.getActiveExec(); }
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        _a = ctx.ports, getActiveTurnID = _a.getActiveTurnID, getSessionID = _a.getSessionID, publishForSession = _a.publishForSession;
                        toolLayer = ctx.ports.createToolPolicyLayer(exec);
                        activeTurnID = getActiveTurnID();
                        sessionID = getSessionID();
                        _i = 0, _b = input.paths;
                        _h.label = 1;
                    case 1:
                        if (!(_i < _b.length)) return [3 /*break*/, 4];
                        path = _b[_i];
                        hookEvent = {
                            turnID: (_f = (_e = exec === null || exec === void 0 ? void 0 : exec.activeTurnID) !== null && _e !== void 0 ? _e : activeTurnID) !== null && _f !== void 0 ? _f : "sandbox:".concat((_g = exec === null || exec === void 0 ? void 0 : exec.session.id) !== null && _g !== void 0 ? _g : sessionID),
                            toolName: "sandbox_merge",
                            toolCallID: "sandbox:".concat(input.id, ":").concat(path),
                            arguments: JSON.stringify({ id: input.id, path: path }),
                        };
                        return [4 /*yield*/, toolLayer.preExecute(hookEvent)];
                    case 2:
                        preResult = _h.sent();
                        for (_c = 0, _d = preResult.diagnostics; _c < _d.length; _c++) {
                            diagnostic = _d[_c];
                            publishForSession(exec, {
                                type: "diagnostic",
                                level: "info",
                                message: diagnostic,
                            });
                        }
                        if (!preResult.allowed)
                            throw new Error("sandbox merge denied for \"".concat(path, "\": ").concat(preResult.diagnostics.join("; ")));
                        _h.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    }
    function authorizeSandboxManagement(toolName_1, arguments_1) {
        return __awaiter(this, arguments, void 0, function (toolName, arguments_, exec) {
            var publishForSession, toolLayer, hookEvent, result, _i, _a, diagnostic;
            var _b;
            if (exec === void 0) { exec = ctx.ports.getActiveExec(); }
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        publishForSession = ctx.ports.publishForSession;
                        toolLayer = ctx.ports.createToolPolicyLayer(exec);
                        hookEvent = {
                            turnID: (_b = exec.activeTurnID) !== null && _b !== void 0 ? _b : "sandbox:".concat(exec.session.id),
                            toolName: toolName,
                            toolCallID: "sandbox:manage:".concat(toolName, ":").concat(arguments_.id),
                            arguments: JSON.stringify(arguments_),
                        };
                        return [4 /*yield*/, toolLayer.preExecute(hookEvent)];
                    case 1:
                        result = _c.sent();
                        for (_i = 0, _a = result.diagnostics; _i < _a.length; _i++) {
                            diagnostic = _a[_i];
                            publishForSession(exec, {
                                type: "diagnostic",
                                level: "info",
                                message: diagnostic,
                            });
                        }
                        if (!result.allowed)
                            throw new Error("".concat(toolName, " denied: ").concat(result.diagnostics.join("; ") || "runtime policy denied operation"));
                        return [2 /*return*/];
                }
            });
        });
    }
    function authorizeWorkspaceRead(input_1) {
        return __awaiter(this, arguments, void 0, function (input, exec) {
            var _a, getSelectedAgent, getWorkspaceRoot, publishForSession, policy, selectedAgent, agent, _i, _b, path, permission, _c, _d, diagnostic;
            if (exec === void 0) { exec = ctx.ports.getActiveExec(); }
            return __generator(this, function (_e) {
                _a = ctx.ports, getSelectedAgent = _a.getSelectedAgent, getWorkspaceRoot = _a.getWorkspaceRoot, publishForSession = _a.publishForSession;
                policy = ctx.state.serviceDirectory.get(tool_policy_1.toolPolicy);
                if (!policy)
                    throw new Error("tool pipeline unavailable (natalia-tool-pipeline)");
                selectedAgent = getSelectedAgent();
                agent = exec ? exec.selectedAgent : selectedAgent;
                for (_i = 0, _b = input.paths; _i < _b.length; _i++) {
                    path = _b[_i];
                    permission = policy.evaluatePermissionRules(agent === null || agent === void 0 ? void 0 : agent.permissions, input.toolName, { path: path }, getWorkspaceRoot());
                    if (permission.allowed)
                        continue;
                    for (_c = 0, _d = permission.diagnostics; _c < _d.length; _c++) {
                        diagnostic = _d[_c];
                        publishForSession(exec, {
                            type: "diagnostic",
                            level: "info",
                            message: diagnostic,
                        });
                    }
                    throw new Error("".concat(input.toolName, " denied for \"").concat(path, "\": ").concat(permission.diagnostics.join("; ")));
                }
                return [2 /*return*/];
            });
        });
    }
    function waitIfPaused() {
        return __awaiter(this, arguments, void 0, function (exec) {
            var _a, getActiveExec, getPaused, getPauseWaiters, activeExec, state;
            if (exec === void 0) { exec = ctx.ports.getActiveExec(); }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = ctx.ports, getActiveExec = _a.getActiveExec, getPaused = _a.getPaused, getPauseWaiters = _a.getPauseWaiters;
                        activeExec = getActiveExec();
                        state = exec !== null && exec !== void 0 ? exec : activeExec;
                        _b.label = 1;
                    case 1:
                        if (!(state ? state.paused : getPaused())) return [3 /*break*/, 3];
                        return [4 /*yield*/, new Promise(function (resolveWaiter) {
                                if (state)
                                    state.pauseWaiters.push(resolveWaiter);
                                else
                                    getPauseWaiters().push(resolveWaiter);
                            })];
                    case 2:
                        _b.sent();
                        return [3 /*break*/, 1];
                    case 3: return [2 /*return*/];
                }
            });
        });
    }
    function toolSettings(exec) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        if (exec === void 0) { exec = ctx.ports.getActiveExec(); }
        var _o = ctx.ports, getSelectedPermissionProfile = _o.getSelectedPermissionProfile, getSelectedAgent = _o.getSelectedAgent, getTsRuntimeConfig = _o.getTsRuntimeConfig, getWorkspaceCapabilityView = _o.getWorkspaceCapabilityView, getCapabilityRegistry = _o.getCapabilityRegistry;
        var selectedPermissionProfile = getSelectedPermissionProfile();
        var selectedAgent = getSelectedAgent();
        var tsRuntimeConfig = getTsRuntimeConfig();
        var profile = exec ? exec.permissionProfile : selectedPermissionProfile;
        var agent = exec ? exec.selectedAgent : selectedAgent;
        var profileNetwork = (_a = profile === null || profile === void 0 ? void 0 : profile.permissions) === null || _a === void 0 ? void 0 : _a.network;
        var agentNetwork = (_b = agent === null || agent === void 0 ? void 0 : agent.permissions) === null || _b === void 0 ? void 0 : _b.network;
        var effectiveNetwork = agentNetwork !== null && agentNetwork !== void 0 ? agentNetwork : profileNetwork;
        var agentAllowedHosts = (agentNetwork === null || agentNetwork === void 0 ? void 0 : agentNetwork.allowedHosts.length)
            ? agentNetwork.allowedHosts
            : tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.network.allowedHosts;
        var allowedHostGroups = [
            profileNetwork === null || profileNetwork === void 0 ? void 0 : profileNetwork.allowedHosts,
            agentAllowedHosts,
        ].filter(function (hosts) { return Boolean(hosts === null || hosts === void 0 ? void 0 : hosts.length); });
        var base = {
            webSearchEndpoint: (_c = tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.webSearch.endpoint) !== null && _c !== void 0 ? _c : undefined,
            webSearchProviderPriority: tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.webSearch.providerPriority,
            browserEnabled: tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.browser.enabled,
            browserBinary: (tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.browser.binary) || undefined,
            browserUserAgent: (tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.browser.userAgent) || undefined,
            browserHeaders: tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.browser.headers,
            browserPersistentProfile: tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.browser.persistentProfile,
            browserProfileDir: (tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.browser.profileDir) || undefined,
            browserLocale: (tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.browser.locale) || undefined,
            browserTimezone: (tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.browser.timezone) || undefined,
            allowedHosts: agentAllowedHosts,
            allowedHostGroups: allowedHostGroups.length
                ? allowedHostGroups
                : undefined,
            allowedSchemes: tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.network.allowedSchemes,
            deniedHosts: __spreadArray(__spreadArray([], ((_d = profileNetwork === null || profileNetwork === void 0 ? void 0 : profileNetwork.denyHosts) !== null && _d !== void 0 ? _d : []), true), ((_e = agentNetwork === null || agentNetwork === void 0 ? void 0 : agentNetwork.denyHosts) !== null && _e !== void 0 ? _e : []), true),
            allowLocalhost: (profileNetwork === null || profileNetwork === void 0 ? void 0 : profileNetwork.allowLocalhost) === false ||
                (agentNetwork === null || agentNetwork === void 0 ? void 0 : agentNetwork.allowLocalhost) === false
                ? false
                : ((_f = effectiveNetwork === null || effectiveNetwork === void 0 ? void 0 : effectiveNetwork.allowLocalhost) !== null && _f !== void 0 ? _f : tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.network.allowLocalhost),
            allowPrivate: (profileNetwork === null || profileNetwork === void 0 ? void 0 : profileNetwork.allowPrivate) === false ||
                (agentNetwork === null || agentNetwork === void 0 ? void 0 : agentNetwork.allowPrivate) === false
                ? false
                : ((_g = effectiveNetwork === null || effectiveNetwork === void 0 ? void 0 : effectiveNetwork.allowPrivate) !== null && _g !== void 0 ? _g : tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.network.allowPrivate),
            envAllowlist: (_k = (_j = (_h = agent === null || agent === void 0 ? void 0 : agent.permissions) === null || _h === void 0 ? void 0 : _h.env) === null || _j === void 0 ? void 0 : _j.allowlist) !== null && _k !== void 0 ? _k : tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.security.envAllowlist,
        };
        // The `settings` grant's first host consumer: capability contributions
        // provide defaults that explicit config and permission values override.
        return (0, capability_settings_1.mergeContributedToolSettings)(base, __spreadArray(__spreadArray([], ((_m = (_l = getWorkspaceCapabilityView()) === null || _l === void 0 ? void 0 : _l.contributions("settings")) !== null && _m !== void 0 ? _m : []), true), getCapabilityRegistry().contributions("settings"), true));
    }
}
