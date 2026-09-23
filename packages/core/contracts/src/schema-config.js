"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configV3Schema = exports.securityConfigSchema = exports.networkConfigSchema = exports.browserConfigSchema = exports.webSearchConfigSchema = exports.instructionConfigSchema = exports.workspaceConfigSchema = exports.mcpServerConfigSchema = exports.toolsConfigSchema = exports.pluginConfigSchema = exports.pluginIntegrationPointSchema = exports.nataliaLockSchema = exports.pluginLockEntrySchema = exports.pluginPackageConfigSchema = exports.pluginPackageSourceSchema = exports.skillsConfigSchema = void 0;
var zod_1 = require("zod");
var schema_workflow_1 = require("./schema-workflow");
var schema_governance_1 = require("./schema-governance");
var schema_foundation_1 = require("./schema-foundation");
exports.skillsConfigSchema = zod_1.z.object({
    urls: zod_1.z.array(zod_1.z.string().url()).default([]),
});
exports.pluginPackageSourceSchema = zod_1.z.discriminatedUnion("type", [
    zod_1.z.object({ type: zod_1.z.literal("registry"), spec: zod_1.z.string().min(1) }),
    zod_1.z.object({ type: zod_1.z.literal("tarball"), url: zod_1.z.string().min(1) }),
    zod_1.z.object({
        type: zod_1.z.literal("git"),
        url: zod_1.z.string().min(1),
        ref: zod_1.z.string().min(1).optional(),
    }),
    zod_1.z.object({ type: zod_1.z.literal("path"), path: zod_1.z.string().min(1) }),
]);
exports.pluginPackageConfigSchema = zod_1.z.object({
    source: exports.pluginPackageSourceSchema,
    version: zod_1.z.string().min(1),
    integrity: zod_1.z.string().min(1).optional(),
    signature: zod_1.z.string().min(1).optional(),
    scope: zod_1.z.enum(["process", "workspace", "session"]),
});
exports.pluginLockEntrySchema = zod_1.z.object({
    packageName: zod_1.z.string().min(1),
    manifest: zod_1.z.string().min(1),
    metadata: zod_1.z.object({
        id: zod_1.z.string().min(1),
        source: exports.pluginPackageSourceSchema,
        resolvedVersion: zod_1.z.string().min(1),
        integrity: zod_1.z.string().min(1).optional(),
        signature: zod_1.z.string().min(1).optional(),
        scope: zod_1.z.enum(["process", "workspace", "session"]),
        dependencies: zod_1.z.array(zod_1.z.object({
            id: zod_1.z.string().min(1),
            resolvedVersion: zod_1.z.string().min(1),
            optional: zod_1.z.boolean().optional(),
            peer: zod_1.z.boolean().optional(),
        })),
    }),
});
exports.nataliaLockSchema = zod_1.z.object({
    version: zod_1.z.literal(1),
    plugins: zod_1.z.record(exports.pluginLockEntrySchema).default({}),
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
exports.pluginConfigSchema = zod_1.z.object({
    enabled: zod_1.z.record(zod_1.z.boolean()).default({}),
    paths: zod_1.z.array(zod_1.z.string()).default([]),
    capabilities: zod_1.z.record(zod_1.z.array(exports.pluginIntegrationPointSchema)).default({}),
    readOnly: zod_1.z.record(zod_1.z.boolean()).default({}),
    // Per-plugin config, keyed by plugin id. The runtime does not interpret these
    // values: each plugin validates its own entry with the config schema it
    // declares, so an invalid entry fails that plugin's load instead of silently
    // reaching its setup.
    settings: zod_1.z.record(zod_1.z.unknown()).default({}),
    packages: zod_1.z.record(exports.pluginPackageConfigSchema).default({}),
});
/** Paths containing legacy out-of-tree tool family manifests. */
exports.toolsConfigSchema = zod_1.z.object({
    paths: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.mcpServerConfigSchema = zod_1.z.object({
    type: zod_1.z.enum(["stdio", "http"]),
    command: zod_1.z.string().optional(),
    args: zod_1.z.array(zod_1.z.string()).default([]),
    url: zod_1.z.string().url().optional(),
    headers: zod_1.z.record(zod_1.z.string()).default({}),
    environment: zod_1.z.record(zod_1.z.string()).default({}),
    cwd: zod_1.z.string().optional(),
    timeoutSec: zod_1.z.number().int().positive().default(30),
    allowedTools: zod_1.z.array(zod_1.z.string()).default([]),
    excludedTools: zod_1.z.array(zod_1.z.string()).default([]),
    readOnly: zod_1.z.boolean().default(false),
    enabled: zod_1.z.boolean().default(true),
    // Interactive remote authentication is recognized only to emit a local unsupported diagnostic.
    auth: zod_1.z.union([zod_1.z.literal(false), zod_1.z.object({}).passthrough()]).optional(),
});
exports.workspaceConfigSchema = zod_1.z.object({
    root: zod_1.z.string().default(""),
    additionalDirs: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.instructionConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(true),
    includeReadme: zod_1.z.boolean().default(true),
    includeDocs: zod_1.z.boolean().default(false),
    extraFiles: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.webSearchConfigSchema = zod_1.z.object({
    endpoint: zod_1.z.string().url().nullable().default(null),
    providerPriority: zod_1.z.array(zod_1.z.string()).default(["configured", "duckduckgo"]),
});
exports.browserConfigSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(true),
    binary: zod_1.z.string().default(""),
    persistentProfile: zod_1.z.boolean().default(false),
    profileDir: zod_1.z.string().default(""),
    userAgent: zod_1.z.string().default(""),
    locale: zod_1.z.string().default(""),
    timezone: zod_1.z.string().default(""),
    headers: zod_1.z.record(zod_1.z.string()).default({}),
});
exports.networkConfigSchema = zod_1.z.object({
    allowedHosts: zod_1.z.array(zod_1.z.string()).default([]),
    allowedSchemes: zod_1.z.array(zod_1.z.string()).default(["https", "http"]),
    allowLocalhost: zod_1.z.boolean().default(false),
    allowPrivate: zod_1.z.boolean().default(false),
});
exports.securityConfigSchema = zod_1.z.object({
    envAllowlist: zod_1.z.array(zod_1.z.string()).default([]),
    redactToolOutput: zod_1.z.boolean().default(true),
});
exports.configV3Schema = zod_1.z.object({
    version: zod_1.z.literal(3),
    runtime: schema_foundation_1.runtimeConfigSchema.default({}),
    sandbox: schema_foundation_1.sandboxConfigSchema.default({}),
    confinement: schema_foundation_1.confinementConfigSchema.default({}),
    goal: schema_foundation_1.goalConfigSchema.default({}),
    team: schema_foundation_1.teamConfigSchema.default({}),
    context: schema_foundation_1.contextConfigSchema.default({}),
    checkpoint: schema_foundation_1.checkpointConfigSchema,
    providers: zod_1.z.record(schema_foundation_1.providerConfigSchema).default({}),
    catalog: schema_foundation_1.modelCatalogSchema,
    modelOverrides: zod_1.z.record(schema_foundation_1.modelOverrideSchema).default({}),
    defaultModel: schema_foundation_1.modelRefSchema.nullable().default(null),
    agentModes: zod_1.z.record(schema_workflow_1.agentModeSchema).default({
        ask: {
            approval: "ask",
            description: "Ask before write, process, or shell actions",
        },
        auto: {
            approval: "auto",
            description: "Automatically approve actions",
        },
        read_only: {
            approval: "read_only",
            description: "Reject write and execution actions",
        },
    }),
    defaultAgentMode: zod_1.z.string().default("ask"),
    agents: zod_1.z.record(schema_workflow_1.agentConfigSchema).default({}),
    defaultAgent: zod_1.z.string().default(""),
    mcpServers: zod_1.z.record(exports.mcpServerConfigSchema).default({}),
    skills: exports.skillsConfigSchema.default({}),
    plugins: exports.pluginConfigSchema.default({}),
    tools: exports.toolsConfigSchema.default({}),
    workspace: exports.workspaceConfigSchema.default({}),
    instructions: exports.instructionConfigSchema.default({}),
    webSearch: exports.webSearchConfigSchema.default({}),
    browser: exports.browserConfigSchema.default({}),
    network: exports.networkConfigSchema.default({}),
    security: exports.securityConfigSchema.default({}),
    issueTargets: zod_1.z.record(schema_governance_1.issueTargetConfigSchema).default({}),
    dataSources: zod_1.z.record(schema_governance_1.dataSourceConfigSchema).default({}),
    alertChannels: zod_1.z.record(schema_governance_1.alertChannelConfigSchema).default({}),
    experimental: schema_governance_1.experimentalConfigSchema.default({}),
});
