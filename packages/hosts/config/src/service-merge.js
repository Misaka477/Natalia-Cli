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
exports.configPatch = configPatch;
exports.mergeConfig = mergeConfig;
exports.mergeOverlay = mergeOverlay;
var contracts_1 = require("@natalia/contracts");
function configPatch(base, next) {
    var _a;
    var patch = diffValue(base, next);
    var records = {
        providers: recordPatch(base.providers, next.providers),
        agentModes: recordPatch(base.agentModes, next.agentModes),
        agents: recordPatch(base.agents, next.agents),
        mcpServers: recordPatch(base.mcpServers, next.mcpServers),
        issueTargets: recordPatch(base.issueTargets, next.issueTargets),
        dataSources: recordPatch(base.dataSources, next.dataSources),
        alertChannels: recordPatch(base.alertChannels, next.alertChannels),
        pluginPackages: recordPatch(base.plugins.packages, next.plugins.packages),
    };
    for (var _i = 0, _b = Object.entries(records); _i < _b.length; _i++) {
        var _c = _b[_i], key = _c[0], value = _c[1];
        if (key === "pluginPackages") {
            if (Object.keys(value).length) {
                (_a = patch.plugins) !== null && _a !== void 0 ? _a : (patch.plugins = {});
                patch.plugins.packages = value;
            }
            else if (patch.plugins)
                delete patch.plugins.packages;
        }
        else if (Object.keys(value).length)
            patch[key] = value;
        else
            delete patch[key];
    }
    return patch;
}
function recordPatch(base, next) {
    var patch = {};
    for (var _i = 0, _a = new Set(__spreadArray(__spreadArray([], Object.keys(base), true), Object.keys(next), true)); _i < _a.length; _i++) {
        var key = _a[_i];
        if (!(key in next))
            patch[key] = undefined;
        else if (!(key in base) ||
            JSON.stringify(base[key]) !== JSON.stringify(next[key]))
            patch[key] = next[key];
    }
    return patch;
}
function diffValue(base, next) {
    if (Object.is(base, next))
        return {};
    if (!base ||
        !next ||
        Array.isArray(base) ||
        Array.isArray(next) ||
        typeof base !== "object" ||
        typeof next !== "object")
        return next;
    var result = {};
    var left = base;
    var right = next;
    for (var _i = 0, _a = new Set(__spreadArray(__spreadArray([], Object.keys(left), true), Object.keys(right), true)); _i < _a.length; _i++) {
        var key = _a[_i];
        if (!(key in right))
            result[key] = undefined;
        else if (!(key in left))
            result[key] = right[key];
        else {
            var value = diffValue(left[key], right[key]);
            if (typeof value !== "object" ||
                value === null ||
                Array.isArray(value) ||
                Object.keys(value).length)
                result[key] = value;
        }
    }
    return result;
}
function mergeConfig(base, overlay) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    return contracts_1.configV3Schema.parse({
        version: 3,
        runtime: deepMergeObject(base.runtime, overlay.runtime),
        sandbox: __assign(__assign({}, base.sandbox), overlay.sandbox),
        team: __assign(__assign({}, base.team), overlay.team),
        context: __assign(__assign({}, base.context), overlay.context),
        checkpoint: __assign(__assign({}, base.checkpoint), overlay.checkpoint),
        providers: deepMergeObject(base.providers, overlay.providers),
        catalog: deepMergeObject(base.catalog, overlay.catalog),
        modelOverrides: deepMergeObject(base.modelOverrides, overlay.modelOverrides),
        defaultModel: overlay.defaultModel === undefined
            ? base.defaultModel
            : deepMergeObject(base.defaultModel, overlay.defaultModel),
        agentModes: mergeRecord(base.agentModes, overlay.agentModes),
        defaultAgentMode: (_a = overlay.defaultAgentMode) !== null && _a !== void 0 ? _a : base.defaultAgentMode,
        agents: mergeRecord(base.agents, overlay.agents),
        defaultAgent: (_b = overlay.defaultAgent) !== null && _b !== void 0 ? _b : base.defaultAgent,
        mcpServers: mergeRecord(base.mcpServers, overlay.mcpServers),
        skills: __assign(__assign({}, base.skills), overlay.skills),
        plugins: {
            enabled: mergeRecord(base.plugins.enabled, (_c = overlay.plugins) === null || _c === void 0 ? void 0 : _c.enabled),
            paths: (_e = (_d = overlay.plugins) === null || _d === void 0 ? void 0 : _d.paths) !== null && _e !== void 0 ? _e : base.plugins.paths,
            capabilities: mergeRecord(base.plugins.capabilities, (_f = overlay.plugins) === null || _f === void 0 ? void 0 : _f.capabilities),
            readOnly: mergeRecord(base.plugins.readOnly, (_g = overlay.plugins) === null || _g === void 0 ? void 0 : _g.readOnly),
            settings: mergeRecord(base.plugins.settings, (_h = overlay.plugins) === null || _h === void 0 ? void 0 : _h.settings),
            packages: mergeRecord(base.plugins.packages, (_j = overlay.plugins) === null || _j === void 0 ? void 0 : _j.packages),
        },
        tools: { paths: (_l = (_k = overlay.tools) === null || _k === void 0 ? void 0 : _k.paths) !== null && _l !== void 0 ? _l : base.tools.paths },
        workspace: __assign(__assign({}, base.workspace), overlay.workspace),
        instructions: __assign(__assign({}, base.instructions), overlay.instructions),
        webSearch: __assign(__assign({}, base.webSearch), overlay.webSearch),
        browser: __assign(__assign({}, base.browser), overlay.browser),
        network: __assign(__assign({}, base.network), overlay.network),
        security: __assign(__assign({}, base.security), overlay.security),
        issueTargets: mergeRecord(base.issueTargets, overlay.issueTargets),
        dataSources: mergeRecord(base.dataSources, overlay.dataSources),
        alertChannels: mergeRecord(base.alertChannels, overlay.alertChannels),
        experimental: __assign(__assign({}, base.experimental), overlay.experimental),
    });
}
function deepMergeObject(base, overlay) {
    if (overlay === undefined)
        return base;
    if (base === undefined || Array.isArray(base) || Array.isArray(overlay))
        return overlay;
    if (typeof base !== "object" ||
        base === null ||
        typeof overlay !== "object" ||
        overlay === null)
        return overlay;
    var result = __assign({}, base);
    for (var _i = 0, _a = Object.entries(overlay); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        if (value === undefined)
            delete result[key];
        else
            result[key] = deepMergeObject(result[key], value);
    }
    return result;
}
function mergeRecord(base, overlay) {
    var result = __assign({}, base);
    for (var _i = 0, _a = Object.entries(overlay !== null && overlay !== void 0 ? overlay : {}); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        if (value === undefined)
            delete result[key];
        else
            result[key] = value;
    }
    return result;
}
function mergeOverlay(base, patch) {
    var result = structuredClone(base);
    for (var _i = 0, _a = Object.entries(patch); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        if (value === undefined)
            delete result[key];
        else if (result[key] &&
            value &&
            typeof result[key] === "object" &&
            typeof value === "object" &&
            !Array.isArray(result[key]) &&
            !Array.isArray(value))
            result[key] = mergeOverlay(result[key], value);
        else
            result[key] = value;
    }
    return result;
}
