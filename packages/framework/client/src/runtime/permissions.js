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
exports.createPermissions = createPermissions;
/**
 * Permission mode, profile and tool policy layers — runtime/permissions module.
 *
 * Owns the derivation of the agent and profile tool policy layers, the
 * permission-mode/profile reload on config change, and the extension gates
 * (skills/mcp). Reads host state and writes the shared permission
 * state through `RuntimeContext` ports at call time.
 */
var tool_policy_derivation_1 = require("../tool-policy-derivation");
var permission_settings_1 = require("../permission-settings");
var tool_policy_1 = require("@natalia/tool-policy");
function createPermissions(ctx, options) {
    return {
        applyAgentPolicy: applyAgentPolicy,
        createToolPolicyLayer: createToolPolicyLayer,
        agentPolicyLayer: agentPolicyLayer,
        permissionProfileLayer: permissionProfileLayer,
        reloadPermissionSettings: reloadPermissionSettings,
        isToolAllowed: isToolAllowed,
        extensionEnabled: extensionEnabled,
        extensionToolPermission: extensionToolPermission,
    };
    function applyAgentPolicy() { }
    function agentPolicyLayer(agent) {
        var _a, _b;
        var _c = ctx.ports, getTsRuntimeConfig = _c.getTsRuntimeConfig, resolveService = _c.resolveService;
        var tsRuntimeConfig = getTsRuntimeConfig();
        var mode = (_b = (_a = tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.agentModes) === null || _a === void 0 ? void 0 : _a[tsRuntimeConfig.defaultAgentMode]) !== null && _b !== void 0 ? _b : tsRuntimeConfig === null || tsRuntimeConfig === void 0 ? void 0 : tsRuntimeConfig.agentModes[tsRuntimeConfig.defaultAgentMode];
        return resolveService(tool_policy_1.toolPolicy.id).createHookLayer((0, tool_policy_derivation_1.deriveAgentToolPolicy)({ agent: agent, mode: mode }));
    }
    function permissionProfileLayer(profile) {
        return ctx.ports
            .resolveService(tool_policy_1.toolPolicy.id)
            .createHookLayer((0, tool_policy_derivation_1.deriveProfileToolPolicy)({ profile: profile }));
    }
    function createToolPolicyLayer(exec) {
        var _this = this;
        var _a, _b, _c;
        var policy = ctx.state.serviceDirectory.get(tool_policy_1.toolPolicy);
        if (!policy)
            throw new Error("tool pipeline unavailable (natalia-tool-pipeline)");
        var agent = (_a = exec === null || exec === void 0 ? void 0 : exec.selectedAgent) !== null && _a !== void 0 ? _a : ctx.ports.getSelectedAgent();
        var profile = (_b = exec === null || exec === void 0 ? void 0 : exec.permissionProfile) !== null && _b !== void 0 ? _b : ctx.ports.getSelectedPermissionProfile();
        var base = policy.createHookLayer(options.toolPolicy);
        var agentLayer = agentPolicyLayer(agent);
        var profileLayer = permissionProfileLayer(profile);
        var layers = [base, agentLayer, profileLayer];
        return __assign(__assign({}, policy.createHookLayer(undefined, {
            preExecute: function (event) { return __awaiter(_this, void 0, void 0, function () {
                var _i, layers_1, layer, result, args, _a, _b, rules, result, terminalCommandBuffer, bufferedProfileCommandPermission, profileCommandPermission, _c, extensionResult;
                var _d, _e, _f;
                return __generator(this, function (_g) {
                    switch (_g.label) {
                        case 0:
                            _i = 0, layers_1 = layers;
                            _g.label = 1;
                        case 1:
                            if (!(_i < layers_1.length)) return [3 /*break*/, 4];
                            layer = layers_1[_i];
                            return [4 /*yield*/, layer.preExecute(event)];
                        case 2:
                            result = _g.sent();
                            if (!result.allowed)
                                return [2 /*return*/, result];
                            _g.label = 3;
                        case 3:
                            _i++;
                            return [3 /*break*/, 1];
                        case 4:
                            args = ctx.ports.tryParseToolArguments(event.arguments);
                            for (_a = 0, _b = [agent === null || agent === void 0 ? void 0 : agent.permissions, profile === null || profile === void 0 ? void 0 : profile.permissions]; _a < _b.length; _a++) {
                                rules = _b[_a];
                                result = policy.evaluatePermissionRules(rules, event.toolName, args, ctx.ports.getWorkspaceRoot());
                                if (!result.allowed)
                                    return [2 /*return*/, result];
                            }
                            terminalCommandBuffer = ctx.ports.getTerminalCommandBuffer();
                            return [4 /*yield*/, terminalCommandBuffer.evaluate([profile === null || profile === void 0 ? void 0 : profile.commandRules].filter(function (rules) {
                                    return Boolean(rules);
                                }), event.toolName, args, [profile === null || profile === void 0 ? void 0 : profile.interactivePrograms])];
                        case 5:
                            bufferedProfileCommandPermission = _g.sent();
                            if (!(bufferedProfileCommandPermission !== null && bufferedProfileCommandPermission !== void 0)) return [3 /*break*/, 6];
                            _c = bufferedProfileCommandPermission;
                            return [3 /*break*/, 8];
                        case 6: return [4 /*yield*/, ctx.state.initialize.evaluatePermissionProfileCommandRules(profile === null || profile === void 0 ? void 0 : profile.commandRules, event.toolName, args)];
                        case 7:
                            _c = (_g.sent());
                            _g.label = 8;
                        case 8:
                            profileCommandPermission = _c;
                            if (!profileCommandPermission.allowed)
                                return [2 /*return*/, profileCommandPermission];
                            extensionResult = extensionToolPermission(event.toolName, profile);
                            if (!extensionResult.allowed)
                                return [2 /*return*/, extensionResult];
                            return [4 /*yield*/, ((_e = (_d = options.hooks) === null || _d === void 0 ? void 0 : _d.preExecute) === null || _e === void 0 ? void 0 : _e.call(_d, event))];
                        case 9: return [2 /*return*/, ((_f = (_g.sent())) !== null && _f !== void 0 ? _f : {
                                allowed: true,
                                diagnostics: [],
                            })];
                    }
                });
            }); },
            postExecute: (_c = options.hooks) === null || _c === void 0 ? void 0 : _c.postExecute,
        })), { isToolAllowed: function (toolName) {
                return layers.every(function (layer) { return layer.isToolAllowed(toolName); });
            } });
    }
    /**
     * Re-derives the permission mode and selected profile from the given config
     * and rebuilds the tool policy layers. Called at initialize and on every
     * config reload, so switching the default profile or flipping auto/ask in
     * the settings dialog takes effect immediately instead of after a restart.
     * A requested profile (options.permissionProfile) that vanished from disk
     * keeps the current selection; the caller decides whether that is fatal.
     */
    function reloadPermissionSettings(config) {
        var _a = ctx.ports, getPermissionMode = _a.getPermissionMode, setSelectedPermissionProfile = _a.setSelectedPermissionProfile, setPermissionMode = _a.setPermissionMode, setDefaultPermissionMode = _a.setDefaultPermissionMode, setDefaultPermissionProfile = _a.setDefaultPermissionProfile;
        var derived = (0, permission_settings_1.derivePermissionSettings)({
            config: config,
            requestedProfile: options.permissionProfile,
            optionMode: options.permissionMode,
            permissionMode: getPermissionMode(),
        });
        if (!derived.found)
            return;
        var previousMode = getPermissionMode();
        setSelectedPermissionProfile(derived.selectedProfile);
        setPermissionMode(derived.mode);
        setDefaultPermissionMode(derived.defaultMode);
        setDefaultPermissionProfile(derived.defaultProfile);
        // Reported only on a real change. The projector derives a session's mode by
        // scanning its events, and nothing emitted this one, so the projected mode
        // was always undefined — a pure replay cannot see process state, only events.
        if (previousMode !== derived.mode)
            for (var _i = 0, _b = ctx.ports.getExecutionBySession().values(); _i < _b.length; _i++) {
                var exec = _b[_i];
                exec.permissionMode = derived.mode;
                // `mode` only: the profile's key lives upstream of what this derivation
                // returns, and the event's `profile` is optional, so inventing one here
                // would be worse than leaving it out.
                ctx.ports.publishForSession(exec, {
                    type: "session.permission.mode",
                    mode: derived.mode,
                });
            }
    }
    function isToolAllowed(toolName, exec) {
        var getSelectedPermissionProfile = ctx.ports.getSelectedPermissionProfile;
        return (createToolPolicyLayer(exec).isToolAllowed(toolName) &&
            extensionToolPermission(toolName, exec ? exec.permissionProfile : getSelectedPermissionProfile()).allowed);
    }
    function extensionEnabled(extension, profile) {
        var _a;
        if (profile === void 0) { profile = ctx.ports.getSelectedPermissionProfile(); }
        return ((_a = profile === null || profile === void 0 ? void 0 : profile.extensions) === null || _a === void 0 ? void 0 : _a[extension]) !== false;
    }
    function extensionToolPermission(toolName, profile) {
        if (profile === void 0) { profile = ctx.ports.getSelectedPermissionProfile(); }
        var extension = toolName === "skill_load"
            ? "skills"
            : toolName.startsWith("mcp_")
                ? "mcp"
                : undefined;
        if (!extension || extensionEnabled(extension, profile))
            return { allowed: true, diagnostics: [] };
        var source = "permission profile";
        return {
            allowed: false,
            diagnostics: ["".concat(extension, " extensions are disabled by ").concat(source)],
        };
    }
}
