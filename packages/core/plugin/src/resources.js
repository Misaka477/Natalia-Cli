"use strict";
/**
 * Generic plugin-owned workspace resources.
 *
 * A plugin declares a resource instead of teaching the framework its business
 * directory. The kernel validates the declaration shape and path template; the
 * runtime and platform layers decide how to authorize and read it.
 */
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
exports.pluginWorkspaceResourceParams = exports.pluginWorkspaceBuiltinParams = void 0;
exports.isPluginWorkspaceResource = isPluginWorkspaceResource;
exports.normalizePluginWorkspacePath = normalizePluginWorkspacePath;
exports.pluginWorkspaceResourcePath = pluginWorkspaceResourcePath;
/**
 * Runtime-supplied path parameters that every plugin resource may use without
 * declaring them.
 */
exports.pluginWorkspaceBuiltinParams = [
    "sessionID",
    "workspaceID",
];
/**
 * Older internal name kept as an alias for the built-in parameter list.
 *
 * @deprecated Use `pluginWorkspaceBuiltinParams`.
 */
exports.pluginWorkspaceResourceParams = exports.pluginWorkspaceBuiltinParams;
var placeholderPattern = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/gu;
var paramNamePattern = /^[a-zA-Z][a-zA-Z0-9_]*$/u;
var supportedScopes = new Set([
    "process",
    "workspace",
    "session",
]);
function isPluginWorkspaceResource(value) {
    if (!isRecord(value))
        return false;
    if (typeof value.name !== "string" || value.name.length === 0)
        return false;
    if (value.kind !== "workspace-file")
        return false;
    if (value.access !== "read")
        return false;
    if (typeof value.path !== "string")
        return false;
    if (value.scope !== undefined &&
        (typeof value.scope !== "string" || !supportedScopes.has(value.scope)))
        return false;
    if (value.description !== undefined && typeof value.description !== "string")
        return false;
    if (value.readers !== undefined &&
        (!Array.isArray(value.readers) ||
            value.readers.some(function (reader) { return typeof reader !== "string" || reader.length === 0; })))
        return false;
    if (value.audit !== undefined && typeof value.audit !== "boolean")
        return false;
    var declaredParams = pluginWorkspaceDeclaredParams(value.params);
    if (!declaredParams)
        return false;
    return isSafeResourceTemplate(value.path, pluginWorkspaceAllowedParams(declaredParams));
}
/**
 * Normalizes a workspace-relative path for template matching.
 *
 * The platform performs the real containment and symlink checks; this function
 * only guarantees that both sides of a resource match use the same POSIX shape.
 */
function normalizePluginWorkspacePath(value) {
    var posix = value.replace(/\\/gu, "/");
    if (!posix || posix.startsWith("/"))
        return undefined;
    var segments = [];
    for (var _i = 0, _a = posix.split("/"); _i < _a.length; _i++) {
        var segment = _a[_i];
        if (!segment || segment === ".")
            continue;
        if (segment === "..")
            return undefined;
        if (segment.includes("\0"))
            return undefined;
        segments.push(segment);
    }
    return segments.join("/");
}
/**
 * Resolves a resource template with trusted runtime parameters and declared
 * plugin parameters.
 *
 * Missing or unsafe placeholder values make the resource unavailable instead
 * of generating a broader path. The template itself is fixed by the plugin;
 * callers can only fill declared single-segment values.
 */
function pluginWorkspaceResourcePath(resource, params) {
    if (!isPluginWorkspaceResource(resource))
        return undefined;
    var allowedParams = pluginWorkspaceAllowedParams(pluginWorkspaceDeclaredParams(resource.params));
    var unresolved = false;
    var replaced = resource.path.replace(placeholderPattern, function (_match, rawName) {
        if (!allowedParams.has(rawName)) {
            unresolved = true;
            return "";
        }
        var value = params[rawName];
        if (!isSafePathSegment(value)) {
            unresolved = true;
            return "";
        }
        return value;
    });
    if (unresolved)
        return undefined;
    return normalizePluginWorkspacePath(replaced);
}
function pluginWorkspaceDeclaredParams(value) {
    if (value === undefined)
        return [];
    if (!Array.isArray(value))
        return undefined;
    var names = new Set();
    for (var _i = 0, value_1 = value; _i < value_1.length; _i++) {
        var name_1 = value_1[_i];
        if (typeof name_1 !== "string" || !paramNamePattern.test(name_1))
            return undefined;
        if (exports.pluginWorkspaceBuiltinParams.includes(name_1))
            return undefined;
        if (names.has(name_1))
            return undefined;
        names.add(name_1);
    }
    return __spreadArray([], names, true);
}
function pluginWorkspaceAllowedParams(declaredParams) {
    return new Set(__spreadArray(__spreadArray([], exports.pluginWorkspaceBuiltinParams, true), declaredParams, true));
}
function isSafeResourceTemplate(value, allowedParams) {
    var normalized = value.replace(/\\/gu, "/");
    if (!normalized || normalized.startsWith("/"))
        return false;
    if (/[*?\[\]]/u.test(normalized))
        return false;
    var names = new Set();
    for (var _i = 0, _a = normalized.matchAll(placeholderPattern); _i < _a.length; _i++) {
        var match = _a[_i];
        names.add(match[1]);
    }
    var withoutPlaceholders = normalized.replace(placeholderPattern, "");
    if (withoutPlaceholders.includes("{") || withoutPlaceholders.includes("}"))
        return false;
    for (var _b = 0, names_1 = names; _b < names_1.length; _b++) {
        var name_2 = names_1[_b];
        if (!allowedParams.has(name_2))
            return false;
    }
    for (var _c = 0, _d = normalized.split("/"); _c < _d.length; _c++) {
        var segment = _d[_c];
        if (!segment || segment === "." || segment === "..")
            return false;
    }
    return true;
}
function isSafePathSegment(value) {
    if (!value || value === "." || value === "..")
        return false;
    if (value.includes("/") || value.includes("\\") || value.includes("\0"))
        return false;
    return true;
}
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
