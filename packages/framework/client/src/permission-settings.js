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
Object.defineProperty(exports, "__esModule", { value: true });
exports.derivePermissionSettings = derivePermissionSettings;
function permissionsFromMode(mode) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var allow = (_d = (_c = (_b = (_a = mode === null || mode === void 0 ? void 0 : mode.permissions) === null || _a === void 0 ? void 0 : _a.tools) === null || _b === void 0 ? void 0 : _b.allow) !== null && _c !== void 0 ? _c : mode === null || mode === void 0 ? void 0 : mode.allowedTools) !== null && _d !== void 0 ? _d : [];
    var exclude = (_h = (_g = (_f = (_e = mode === null || mode === void 0 ? void 0 : mode.permissions) === null || _e === void 0 ? void 0 : _e.tools) === null || _f === void 0 ? void 0 : _f.exclude) !== null && _g !== void 0 ? _g : mode === null || mode === void 0 ? void 0 : mode.excludedTools) !== null && _h !== void 0 ? _h : [];
    var permissions = (mode === null || mode === void 0 ? void 0 : mode.permissions)
        ? __assign(__assign({}, mode.permissions), { tools: { allow: allow, exclude: exclude } }) : allow.length || exclude.length
        ? { tools: { allow: allow, exclude: exclude } }
        : undefined;
    return permissions;
}
function extensionsFromMode(mode) {
    var _a, _b;
    return {
        skills: (mode === null || mode === void 0 ? void 0 : mode.skills) !== false && ((_a = mode === null || mode === void 0 ? void 0 : mode.extensions) === null || _a === void 0 ? void 0 : _a.skills) !== false,
        mcp: ((_b = mode === null || mode === void 0 ? void 0 : mode.extensions) === null || _b === void 0 ? void 0 : _b.mcp) !== false,
    };
}
function derivePermissionSettings(input) {
    var _a, _b, _c, _d;
    var config = input.config, requestedProfile = input.requestedProfile, optionMode = input.optionMode, permissionMode = input.permissionMode;
    var agentMode = (_a = config.agentModes[config.defaultAgentMode]) !== null && _a !== void 0 ? _a : config.agentModes["ask"];
    var defaultProfile = __assign(__assign(__assign(__assign({ approval: (_b = agentMode === null || agentMode === void 0 ? void 0 : agentMode.approval) !== null && _b !== void 0 ? _b : "ask", description: (_c = agentMode === null || agentMode === void 0 ? void 0 : agentMode.description) !== null && _c !== void 0 ? _c : "" }, (permissionsFromMode(agentMode)
        ? { permissions: permissionsFromMode(agentMode) }
        : {})), ((agentMode === null || agentMode === void 0 ? void 0 : agentMode.commandRules)
        ? { commandRules: agentMode.commandRules }
        : {})), ((agentMode === null || agentMode === void 0 ? void 0 : agentMode.interactivePrograms)
        ? { interactivePrograms: agentMode.interactivePrograms }
        : {})), { extensions: extensionsFromMode(agentMode) });
    if (requestedProfile) {
        var found = config.agentModes[requestedProfile];
        if (!found)
            return { found: false };
        var foundProfile = __assign(__assign(__assign(__assign({ approval: found.approval, description: (_d = found.description) !== null && _d !== void 0 ? _d : "" }, (permissionsFromMode(found)
            ? { permissions: permissionsFromMode(found) }
            : {})), (found.commandRules ? { commandRules: found.commandRules } : {})), (found.interactivePrograms
            ? { interactivePrograms: found.interactivePrograms }
            : {})), { extensions: extensionsFromMode(found) });
        var nextMode_1 = !optionMode && found ? foundProfile.approval : permissionMode;
        return {
            found: true,
            selectedProfile: foundProfile,
            mode: nextMode_1,
            defaultMode: nextMode_1,
            defaultProfile: foundProfile,
        };
    }
    var selectedProfile = defaultProfile;
    var nextMode = !optionMode && selectedProfile ? selectedProfile.approval : permissionMode;
    return {
        found: true,
        selectedProfile: selectedProfile,
        mode: nextMode,
        defaultMode: nextMode,
        defaultProfile: selectedProfile,
    };
}
