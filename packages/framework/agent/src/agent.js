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
exports.AgentRegistry = void 0;
exports.agentsFromConfig = agentsFromConfig;
var AgentRegistry = /** @class */ (function () {
    function AgentRegistry(input) {
        if (input === void 0) { input = {}; }
        var _a;
        this.agents = new Map();
        for (var _i = 0, _b = Object.entries((_a = input.agents) !== null && _a !== void 0 ? _a : {}); _i < _b.length; _i++) {
            var _c = _b[_i], name_1 = _c[0], agent = _c[1];
            this.register(__assign({ name: name_1 }, agent));
        }
        this.defaultName = input.defaultAgent || undefined;
    }
    AgentRegistry.prototype.register = function (agent) {
        var _a, _b, _c, _d, _e, _f, _g;
        validateAgent(agent);
        this.agents.set(agent.name, {
            name: agent.name,
            description: (_a = agent.description) !== null && _a !== void 0 ? _a : "",
            systemPrompt: (_b = agent.systemPrompt) !== null && _b !== void 0 ? _b : "",
            mode: (_c = agent.mode) !== null && _c !== void 0 ? _c : "primary",
            hidden: (_d = agent.hidden) !== null && _d !== void 0 ? _d : false,
            color: agent.color,
            model: agent.model,
            variant: agent.variant,
            maxSteps: agent.maxSteps,
            allowedTools: (_e = agent.allowedTools) !== null && _e !== void 0 ? _e : [],
            excludedTools: (_f = agent.excludedTools) !== null && _f !== void 0 ? _f : [],
            mcpServers: (_g = agent.mcpServers) !== null && _g !== void 0 ? _g : [],
            permissions: agent.permissions,
        });
    };
    AgentRegistry.prototype.remove = function (name) {
        this.agents.delete(name);
        if (this.defaultName === name)
            this.defaultName = undefined;
    };
    AgentRegistry.prototype.get = function (name) {
        return this.agents.get(name);
    };
    AgentRegistry.prototype.list = function () {
        return __spreadArray([], this.agents.values(), true).sort(function (a, b) {
            return a.name.localeCompare(b.name);
        });
    };
    AgentRegistry.prototype.selectable = function () {
        return this.list().filter(function (agent) { return agent.mode !== "subagent" && !agent.hidden; });
    };
    AgentRegistry.prototype.default = function () {
        var configured = this.defaultName
            ? this.get(this.defaultName)
            : undefined;
        if (configured && configured.mode !== "subagent" && !configured.hidden)
            return configured;
        return this.selectable()[0];
    };
    AgentRegistry.prototype.select = function (name) {
        if (name)
            return this.get(name);
        return this.default();
    };
    AgentRegistry.prototype.setDefault = function (name) {
        if (name && !this.get(name))
            throw new Error("agent not found: ".concat(name));
        this.defaultName = name;
    };
    return AgentRegistry;
}());
exports.AgentRegistry = AgentRegistry;
function agentsFromConfig(config) {
    return new AgentRegistry({
        agents: config.agents,
        defaultAgent: config.defaultAgent,
    });
}
function validateAgent(agent) {
    if (!/^[a-z0-9][a-z0-9_-]*$/u.test(agent.name))
        throw new Error("invalid agent name: ".concat(agent.name));
}
