"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPluginOwner = registerPluginOwner;
var plugin_1 = require("@natalia/plugin");
function registerPluginOwner(manifest, registry) {
    var grants = [];
    var integrationPoints = (0, plugin_1.manifestIntegrationPoints)(manifest);
    if (manifest.provides.length)
        grants.push("services");
    var grantForPoint = {
        tools: "tools",
        commands: "commands",
        events: "listeners",
        services: "services",
        resources: "resources",
        projections: "projections",
        workflows: "workflows",
        settingsSchema: "settingsSchema",
        adapters: "adapters",
        schedulerJobs: "schedulerJobs",
    };
    for (var _i = 0, integrationPoints_1 = integrationPoints; _i < integrationPoints_1.length; _i++) {
        var point = integrationPoints_1[_i];
        var grant = grantForPoint[point];
        if (grant && !grants.includes(grant))
            grants.push(grant);
    }
    var owner = registry.registerOwner({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        scope: manifest.scope,
        grants: grants,
    });
    return { contribute: owner.contribute, release: owner.release };
}
