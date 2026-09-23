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
var bun_test_1 = require("bun:test");
var capability_1 = require("@natalia/capability");
var plugin_workspace_resources_1 = require("../src/runtime/plugin-workspace-resources");
var resource = {
    name: "session-todo-store",
    kind: "workspace-file",
    access: "read",
    scope: "session",
    path: ".natalia/todos/{sessionID}.json",
};
function registryWithResource() {
    var registry = new capability_1.CapabilityRegistry();
    var owner = registry.registerOwner({
        id: "natalia-tool-todo",
        name: "Todo Tools",
        version: "1.0.0",
        scope: "session",
        grants: ["resources"],
    });
    var release = owner.contribute("resources", resource.name, resource);
    return { registry: registry, owner: owner, release: release };
}
(0, bun_test_1.test)("a declared plugin workspace resource resolves for its current session", function () {
    var registry = registryWithResource().registry;
    (0, bun_test_1.expect)((0, plugin_workspace_resources_1.resolvePluginWorkspaceResource)({
        registry: registry,
        path: ".natalia/todos/ses_current.json",
        sessionID: "ses_current",
        access: "read",
    })).toEqual({
        pluginID: "natalia-tool-todo",
        contributionName: "session-todo-store",
        relativePath: ".natalia/todos/ses_current.json",
        access: "read",
    });
});
(0, bun_test_1.test)("a declared resource does not resolve for another session or path", function () {
    var registry = registryWithResource().registry;
    (0, bun_test_1.expect)((0, plugin_workspace_resources_1.resolvePluginWorkspaceResource)({
        registry: registry,
        path: ".natalia/todos/ses_other.json",
        sessionID: "ses_current",
        access: "read",
    })).toBeUndefined();
    (0, bun_test_1.expect)((0, plugin_workspace_resources_1.resolvePluginWorkspaceResource)({
        registry: registry,
        path: ".natalia/todos/ses_current.json/extra",
        sessionID: "ses_current",
        access: "read",
    })).toBeUndefined();
});
(0, bun_test_1.test)("unloading the owning plugin removes the resource", function () {
    var _a = registryWithResource(), registry = _a.registry, release = _a.release;
    release();
    (0, bun_test_1.expect)((0, plugin_workspace_resources_1.resolvePluginWorkspaceResource)({
        registry: registry,
        path: ".natalia/todos/ses_current.json",
        sessionID: "ses_current",
        access: "read",
    })).toBeUndefined();
});
(0, bun_test_1.test)("reserved or non-.natalia paths are not promoted to plugin resources", function () {
    var registry = new capability_1.CapabilityRegistry();
    var owner = registry.registerOwner({
        id: "fixture.resources",
        name: "Fixture Resources",
        version: "1.0.0",
        scope: "session",
        grants: ["resources"],
    });
    owner.contribute("resources", "config", {
        name: "config",
        kind: "workspace-file",
        access: "read",
        scope: "session",
        path: ".natalia/config.json",
    });
    owner.contribute("resources", "outside", {
        name: "outside",
        kind: "workspace-file",
        access: "read",
        scope: "session",
        path: "src/{sessionID}.json",
    });
    (0, bun_test_1.expect)((0, plugin_workspace_resources_1.resolvePluginWorkspaceResource)({
        registry: registry,
        path: ".natalia/config.json",
        sessionID: "ses_current",
        access: "read",
    })).toBeUndefined();
    (0, bun_test_1.expect)((0, plugin_workspace_resources_1.resolvePluginWorkspaceResource)({
        registry: registry,
        path: "src/ses_current.json",
        sessionID: "ses_current",
        access: "read",
    })).toBeUndefined();
});
(0, bun_test_1.test)("named resource reads enforce reader allowlists and carry audit intent", function () {
    var registry = new capability_1.CapabilityRegistry();
    var owner = registry.registerOwner({
        id: "natalia-tool-todo",
        name: "Todo Tools",
        version: "1.0.0",
        scope: "session",
        grants: ["resources"],
    });
    owner.contribute("resources", resource.name, __assign(__assign({}, resource), { readers: ["natalia.ui.todo"], audit: true }));
    (0, bun_test_1.expect)((0, plugin_workspace_resources_1.resolveNamedPluginWorkspaceResource)({
        registry: registry,
        resource: resource.name,
        params: { sessionID: "ses_current" },
        sessionID: "ses_current",
        reader: "natalia.ui.todo",
    })).toEqual({
        pluginID: "natalia-tool-todo",
        contributionName: resource.name,
        relativePath: ".natalia/todos/ses_current.json",
        access: "read",
        audit: true,
    });
    (0, bun_test_1.expect)((0, plugin_workspace_resources_1.resolveNamedPluginWorkspaceResource)({
        registry: registry,
        resource: resource.name,
        params: { sessionID: "ses_current" },
        sessionID: "ses_current",
        reader: "other.plugin",
    })).toBeUndefined();
});
(0, bun_test_1.test)("reader-scoped resources are not exposed through the path surface", function () {
    var registry = new capability_1.CapabilityRegistry();
    var owner = registry.registerOwner({
        id: "natalia-tool-todo",
        name: "Todo Tools",
        version: "1.0.0",
        scope: "session",
        grants: ["resources"],
    });
    owner.contribute("resources", resource.name, __assign(__assign({}, resource), { readers: ["natalia.ui.todo"] }));
    (0, bun_test_1.expect)((0, plugin_workspace_resources_1.resolvePluginWorkspaceResource)({
        registry: registry,
        path: ".natalia/todos/ses_current.json",
        sessionID: "ses_current",
        access: "read",
    })).toBeUndefined();
});
(0, bun_test_1.test)("named reads can fill plugin-declared path params safely", function () {
    var registry = new capability_1.CapabilityRegistry();
    var owner = registry.registerOwner({
        id: "natalia-skills",
        name: "Skills",
        version: "1.0.0",
        scope: "workspace",
        grants: ["resources"],
    });
    var resourceName = "workspace-skill-document";
    owner.contribute("resources", resourceName, {
        name: resourceName,
        kind: "workspace-file",
        access: "read",
        scope: "workspace",
        params: ["skillName"],
        path: ".natalia/skills/{skillName}/SKILL.md",
        readers: ["natalia.ui.skills-settings"],
    });
    (0, bun_test_1.expect)((0, plugin_workspace_resources_1.resolveNamedPluginWorkspaceResource)({
        registry: registry,
        resource: resourceName,
        params: { skillName: "release" },
        reader: "natalia.ui.skills-settings",
    })).toMatchObject({
        pluginID: "natalia-skills",
        contributionName: resourceName,
        relativePath: ".natalia/skills/release/SKILL.md",
        access: "read",
    });
    (0, bun_test_1.expect)((0, plugin_workspace_resources_1.resolveNamedPluginWorkspaceResource)({
        registry: registry,
        resource: resourceName,
        params: { skillName: "../secret" },
        reader: "natalia.ui.skills-settings",
    })).toBeUndefined();
    (0, bun_test_1.expect)((0, plugin_workspace_resources_1.resolvePluginWorkspaceResource)({
        registry: registry,
        path: ".natalia/skills/release/SKILL.md",
        access: "read",
    })).toBeUndefined();
});
