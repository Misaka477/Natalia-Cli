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
exports.pluginManifestSchema = exports.pluginManifestV2Schema = exports.pluginUiManifestSchema = exports.uiPanelMetaSchema = exports.uiPanelRequirementSchema = exports.pluginLifecycleHooksSchema = exports.pluginDependencySchema = exports.pluginIntegrationPointSchema = exports.pluginManifestV1Schema = exports.pluginScopeSchema = exports.PLUGIN_API_VERSION = void 0;
exports.manifestIntegrationPoints = manifestIntegrationPoints;
var zod_1 = require("zod");
exports.PLUGIN_API_VERSION = 2;
exports.pluginScopeSchema = zod_1.z.enum(["process", "workspace", "session"]);
var pluginIDSchema = zod_1.z.string().regex(/^[a-z0-9][a-z0-9._-]*$/u);
var versionSchema = zod_1.z.string().regex(/^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/iu);
exports.pluginManifestV1Schema = zod_1.z.object({
    apiVersion: zod_1.z.literal(1),
    id: pluginIDSchema,
    version: versionSchema,
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().default(""),
    entry: zod_1.z.string().default("index.ts"),
    capabilities: zod_1.z.array(zod_1.z.enum(["tools", "events", "commands"])).default([]),
    scope: exports.pluginScopeSchema.default("session"),
    provides: zod_1.z.array(zod_1.z.string()).default([]),
    requires: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.pluginIntegrationPointSchema = zod_1.z.enum([
    "tools",
    "commands",
    "events",
    "services",
    "resources",
    "projections",
    "workflows",
    "settingsSchema",
    "adapters",
    "schedulerJobs",
]);
exports.pluginDependencySchema = zod_1.z.object({
    id: pluginIDSchema,
    spec: zod_1.z.string().min(1),
    optional: zod_1.z.boolean().default(false),
    peer: zod_1.z.boolean().default(false),
});
exports.pluginLifecycleHooksSchema = zod_1.z.object({}).strict().default({});
exports.uiPanelRequirementSchema = zod_1.z.union([
    zod_1.z.object({ type: zod_1.z.literal("plugin"), id: zod_1.z.string().min(1) }),
    zod_1.z.object({ type: zod_1.z.literal("capability"), id: zod_1.z.string().min(1) }),
    zod_1.z.object({ type: zod_1.z.literal("method"), name: zod_1.z.string().min(1) }),
]);
exports.uiPanelMetaSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    title: zod_1.z.string().min(1),
    region: zod_1.z.enum(["main", "side", "bottom", "topbar", "settings"]).optional(),
    group: zod_1.z.string().optional(),
    icon: zod_1.z.string().optional(),
    order: zod_1.z.number().int().nonnegative().optional(),
    description: zod_1.z.string().optional(),
    requires: zod_1.z.array(exports.uiPanelRequirementSchema).optional(),
});
exports.pluginUiManifestSchema = zod_1.z.object({
    entry: zod_1.z.string().min(1),
    panels: zod_1.z.array(exports.uiPanelMetaSchema).optional(),
});
exports.pluginManifestV2Schema = zod_1.z.object({
    apiVersion: zod_1.z.literal(exports.PLUGIN_API_VERSION),
    id: pluginIDSchema,
    version: versionSchema,
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().default(""),
    entry: zod_1.z.string().default("index.ts"),
    scope: exports.pluginScopeSchema.default("session"),
    provides: zod_1.z.array(zod_1.z.string()).default([]),
    requires: zod_1.z.array(zod_1.z.string()).default([]),
    optionalRequires: zod_1.z.array(zod_1.z.string()).default([]),
    conflicts: zod_1.z.array(pluginIDSchema).default([]),
    dependencies: zod_1.z.array(exports.pluginDependencySchema).default([]),
    hooks: exports.pluginLifecycleHooksSchema,
    integrationPoints: zod_1.z.array(exports.pluginIntegrationPointSchema).default([]),
    ui: exports.pluginUiManifestSchema.optional(),
});
exports.pluginManifestSchema = zod_1.z.discriminatedUnion("apiVersion", [
    exports.pluginManifestV1Schema,
    exports.pluginManifestV2Schema,
]);
function manifestIntegrationPoints(manifest) {
    if (manifest.apiVersion === 2)
        return manifest.integrationPoints;
    return __spreadArray(__spreadArray([], manifest.capabilities, true), (manifest.provides.length ? ["services"] : []), true);
}
