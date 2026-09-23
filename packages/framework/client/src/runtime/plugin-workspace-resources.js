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
exports.resolvePluginWorkspaceResource = resolvePluginWorkspaceResource;
exports.resolveNamedPluginWorkspaceResource = resolveNamedPluginWorkspaceResource;
var plugin_1 = require("@natalia/plugin");
/**
 * The first implementation intentionally keeps plugin-owned resources inside
 * `.natalia/`. Normal project files already use `workspaceRead`; this surface
 * exists for plugin-private durable data, not for widening general workspace
 * access.
 */
var pluginResourceRoot = ".natalia/";
var reservedResourcePaths = new Set([
    ".natalia/config.json",
    ".natalia/workspace-settings.json",
    ".natalia/sessions",
]);
function resolvePluginWorkspaceResource(input) {
    var _a, _b, _c;
    var requestPath = (0, plugin_1.normalizePluginWorkspacePath)(input.path);
    if (!requestPath)
        return undefined;
    for (var _i = 0, _d = input.registry.contributions("resources"); _i < _d.length; _i++) {
        var contribution = _d[_i];
        var resource = contribution.payload;
        if (!(0, plugin_1.isPluginWorkspaceResource)(resource))
            continue;
        if (resource.access !== input.access)
            continue;
        // Reader-scoped and parameterized resources are only available through the
        // named API, where the caller can supply an auditable identity and values.
        if (((_a = resource.readers) === null || _a === void 0 ? void 0 : _a.length) || ((_b = resource.params) === null || _b === void 0 ? void 0 : _b.length))
            continue;
        var scope = (_c = resource.scope) !== null && _c !== void 0 ? _c : input.registry.scopeOf(contribution.capabilityID);
        if (scope === "session" && !input.sessionID)
            continue;
        var relativePath = (0, plugin_1.pluginWorkspaceResourcePath)(resource, {
            sessionID: input.sessionID,
            workspaceID: input.workspaceID,
        });
        if (!relativePath || relativePath !== requestPath)
            continue;
        if (!isReadablePluginResourcePath(relativePath))
            continue;
        return {
            pluginID: contribution.capabilityID,
            contributionName: contribution.name,
            relativePath: relativePath,
            access: input.access,
        };
    }
    return undefined;
}
function resolveNamedPluginWorkspaceResource(input) {
    var _a;
    var owner = input.registry.ownerOf("resources", input.resource);
    if (!owner)
        return undefined;
    var resource = input.registry.contribution("resources", input.resource);
    if (!(0, plugin_1.isPluginWorkspaceResource)(resource))
        return undefined;
    if (resource.access !== "read")
        return undefined;
    if (((_a = resource.readers) === null || _a === void 0 ? void 0 : _a.length) &&
        (!input.reader || !resource.readers.includes(input.reader)))
        return undefined;
    var relativePath = (0, plugin_1.pluginWorkspaceResourcePath)(resource, __assign(__assign({}, input.params), (input.sessionID ? { sessionID: input.sessionID } : {})));
    if (!relativePath || !isReadablePluginResourcePath(relativePath))
        return undefined;
    return {
        pluginID: owner,
        contributionName: input.resource,
        relativePath: relativePath,
        access: "read",
        audit: resource.audit === true,
    };
}
function isReadablePluginResourcePath(path) {
    if (!path.startsWith(pluginResourceRoot))
        return false;
    if (reservedResourcePaths.has(path))
        return false;
    if (path.startsWith(".natalia/sessions/"))
        return false;
    return true;
}
