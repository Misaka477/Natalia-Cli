"use strict";
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
exports.deriveAgentToolPolicy = deriveAgentToolPolicy;
exports.deriveProfileToolPolicy = deriveProfileToolPolicy;
function deriveAgentToolPolicy(input) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    var agent = input.agent, mode = input.mode;
    return {
        allow: __spreadArray(__spreadArray([], ((_b = (_a = agent === null || agent === void 0 ? void 0 : agent.allowedTools) !== null && _a !== void 0 ? _a : mode === null || mode === void 0 ? void 0 : mode.allowedTools) !== null && _b !== void 0 ? _b : []), true), ((_e = (_d = (_c = agent === null || agent === void 0 ? void 0 : agent.permissions) === null || _c === void 0 ? void 0 : _c.tools) === null || _d === void 0 ? void 0 : _d.allow) !== null && _e !== void 0 ? _e : []), true),
        exclude: __spreadArray(__spreadArray([], ((_g = (_f = agent === null || agent === void 0 ? void 0 : agent.excludedTools) !== null && _f !== void 0 ? _f : mode === null || mode === void 0 ? void 0 : mode.excludedTools) !== null && _g !== void 0 ? _g : []), true), ((_k = (_j = (_h = agent === null || agent === void 0 ? void 0 : agent.permissions) === null || _h === void 0 ? void 0 : _h.tools) === null || _j === void 0 ? void 0 : _j.exclude) !== null && _k !== void 0 ? _k : []), true),
    };
}
function deriveProfileToolPolicy(input) {
    var _a, _b, _c, _d, _e, _f;
    var profile = input.profile;
    var mode = profile && "allowedTools" in profile ? profile : undefined;
    var legacy = profile && "permissions" in profile ? profile : undefined;
    return {
        allow: (_a = mode === null || mode === void 0 ? void 0 : mode.allowedTools) !== null && _a !== void 0 ? _a : (_c = (_b = legacy === null || legacy === void 0 ? void 0 : legacy.permissions) === null || _b === void 0 ? void 0 : _b.tools) === null || _c === void 0 ? void 0 : _c.allow,
        exclude: (_d = mode === null || mode === void 0 ? void 0 : mode.excludedTools) !== null && _d !== void 0 ? _d : (_f = (_e = legacy === null || legacy === void 0 ? void 0 : legacy.permissions) === null || _e === void 0 ? void 0 : _e.tools) === null || _f === void 0 ? void 0 : _f.exclude,
    };
}
