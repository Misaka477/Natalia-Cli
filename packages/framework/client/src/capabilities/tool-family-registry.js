"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toolFamilyCapabilityID = toolFamilyCapabilityID;
exports.toolFamilyRegistration = toolFamilyRegistration;
exports.registerToolFamilyCapabilities = registerToolFamilyCapabilities;
exports.createToolRegistryFromCapabilities = createToolRegistryFromCapabilities;
var tools_1 = require("@anthelia/tools");
function toolFamilyCapabilityID(familyID) {
    return "natalia-tool-".concat(familyID);
}
function toolFamilyRegistration(family) {
    return {
        id: toolFamilyCapabilityID(family.id),
        name: family.name,
        version: family.version,
        description: family.description,
        scope: family.scope,
        grants: ["tools"],
    };
}
function registerToolFamilyCapabilities(registry, families) {
    var loaded = [];
    var failed = [];
    for (var _i = 0, _a = orderedFamilies(families); _i < _a.length; _i++) {
        var family = _a[_i];
        var registration = toolFamilyRegistration(family);
        var owner = void 0;
        try {
            owner = registry.registerOwner(registration);
            for (var _b = 0, _c = family.tools; _b < _c.length; _b++) {
                var tool = _c[_b];
                owner.contribute("tools", tool.name, tool);
            }
        }
        catch (error) {
            owner === null || owner === void 0 ? void 0 : owner.release();
            failed.push({
                id: registration.id,
                reason: error instanceof Error ? error.message : String(error),
            });
            continue;
        }
        loaded.push({
            registration: registration,
            tools: family.tools.map(function (tool) { return tool.name; }),
        });
    }
    return { loaded: loaded, failed: failed };
}
function orderedFamilies(families) {
    var byID = new Map(families.map(function (family) { return [family.id, family]; }));
    var ordered = [];
    var visited = new Set();
    var visit = function (family) {
        var _a;
        if (visited.has(family.id))
            return;
        visited.add(family.id);
        for (var _i = 0, _b = (_a = family.dependencies) !== null && _a !== void 0 ? _a : []; _i < _b.length; _i++) {
            var dependency = _b[_i];
            var dependencyFamily = byID.get(dependency);
            if (dependencyFamily)
                visit(dependencyFamily);
        }
        ordered.push(family);
    };
    for (var _i = 0, families_1 = families; _i < families_1.length; _i++) {
        var family = families_1[_i];
        visit(family);
    }
    return ordered;
}
function createToolRegistryFromCapabilities(input) {
    var _a, _b;
    var families = (_a = input.families) !== null && _a !== void 0 ? _a : [];
    var outcome = registerToolFamilyCapabilities(input.registry, families);
    var tools = (0, tools_1.createToolRegistry)([]);
    var accepted = new Set(outcome.loaded.map(function (entry) { return entry.registration.id; }));
    for (var _i = 0, _c = input.registry.contributions("tools"); _i < _c.length; _i++) {
        var contribution = _c[_i];
        if (accepted.has(contribution.capabilityID))
            tools.set(contribution.name, contribution.payload);
    }
    for (var _d = 0, families_2 = families; _d < families_2.length; _d++) {
        var family = families_2[_d];
        if (!accepted.has(toolFamilyCapabilityID(family.id)))
            continue;
        for (var _e = 0, _f = Object.entries((_b = family.aliases) !== null && _b !== void 0 ? _b : {}); _e < _f.length; _e++) {
            var _g = _f[_e], alias = _g[0], target = _g[1];
            if (tools.has(target))
                tools.addAlias(alias, target);
        }
    }
    return { tools: tools, outcome: outcome };
}
