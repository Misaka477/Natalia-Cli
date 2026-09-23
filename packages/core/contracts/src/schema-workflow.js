"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentConfigSchema = exports.agentModeSchema = exports.permissionProfileSchema = exports.extensionRulesSchema = exports.interactiveProgramRulesSchema = exports.permissionProfileCommandRulesSchema = exports.bashCommandRuleSchema = exports.agentPermissionRulesSchema = void 0;
var zod_1 = require("zod");
exports.agentPermissionRulesSchema = zod_1.z.object({
    tools: zod_1.z
        .object({
        allow: zod_1.z.array(zod_1.z.string()).default([]),
        exclude: zod_1.z.array(zod_1.z.string()).default([]),
    })
        .optional(),
    files: zod_1.z
        .object({
        readPaths: zod_1.z
            .array(zod_1.z.object({
            pattern: zod_1.z.string(),
            allow: zod_1.z.boolean().optional(),
            reason: zod_1.z.string().optional(),
        }))
            .default([]),
        writePaths: zod_1.z
            .array(zod_1.z.object({
            pattern: zod_1.z.string(),
            allow: zod_1.z.boolean().optional(),
            reason: zod_1.z.string().optional(),
        }))
            .default([]),
    })
        .optional(),
    commands: zod_1.z
        .object({
        allowPatterns: zod_1.z.array(zod_1.z.string()).default([]),
        denyPatterns: zod_1.z.array(zod_1.z.string()).default([]),
    })
        .optional(),
    network: zod_1.z
        .object({
        allowedHosts: zod_1.z.array(zod_1.z.string()).default([]),
        denyHosts: zod_1.z.array(zod_1.z.string()).default([]),
        allowLocalhost: zod_1.z.boolean().optional(),
        allowPrivate: zod_1.z.boolean().optional(),
    })
        .optional(),
    env: zod_1.z.object({ allowlist: zod_1.z.array(zod_1.z.string()).default([]) }).optional(),
    redactOutput: zod_1.z.boolean().optional(),
});
exports.bashCommandRuleSchema = zod_1.z.object({
    command: zod_1.z.string().min(1),
    reason: zod_1.z.string().min(1).optional(),
});
exports.permissionProfileCommandRulesSchema = zod_1.z.object({
    mode: zod_1.z.enum(["blacklist", "whitelist", "none"]),
    rules: zod_1.z.array(exports.bashCommandRuleSchema).default([]),
});
/**
 * Launch commands that may take over a pane as an interactive program, such as
 * an editor, a REPL or a database client. By default it is an explicit
 * allowlist. `allowAny` is an intentionally high-risk escape hatch selected by
 * the user; foreground-process confirmation still applies.
 */
exports.interactiveProgramRulesSchema = zod_1.z.object({
    allowAny: zod_1.z.boolean().default(false),
    allow: zod_1.z.array(exports.bashCommandRuleSchema).default([]),
});
/** Extension stages can only narrow the profile's extension boundary. */
exports.extensionRulesSchema = zod_1.z.object({
    skills: zod_1.z.boolean().optional(),
    mcp: zod_1.z.boolean().optional(),
});
exports.permissionProfileSchema = zod_1.z.object({
    approval: zod_1.z.enum(["ask", "auto", "read_only"]),
    description: zod_1.z.string().default(""),
    permissions: exports.agentPermissionRulesSchema.optional(),
    commandRules: exports.permissionProfileCommandRulesSchema.optional(),
    interactivePrograms: exports.interactiveProgramRulesSchema.optional(),
    extensions: exports.extensionRulesSchema.optional(),
});
/**
 * Unified agent runtime mode. This replaces the separate permission profile
 * plus mode split: one mode owns the workflow preset and the security boundary.
 * The built-in ask/auto/read_only modes remain available and non-editable.
 */
exports.agentModeSchema = zod_1.z.object({
    description: zod_1.z.string().default(""),
    approval: zod_1.z.enum(["ask", "auto", "read_only"]),
    systemPrompt: zod_1.z.string().default(""),
    model: zod_1.z.string().optional(),
    allowedTools: zod_1.z.array(zod_1.z.string()).default([]),
    excludedTools: zod_1.z.array(zod_1.z.string()).default([]),
    permissions: exports.agentPermissionRulesSchema.optional(),
    commandRules: exports.permissionProfileCommandRulesSchema.optional(),
    interactivePrograms: exports.interactiveProgramRulesSchema.optional(),
    extensions: exports.extensionRulesSchema.optional(),
    skills: zod_1.z.boolean().default(true),
    mcpServers: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.agentConfigSchema = zod_1.z.object({
    description: zod_1.z.string().default(""),
    systemPrompt: zod_1.z.string().default(""),
    mode: zod_1.z.enum(["primary", "subagent", "all"]).default("primary"),
    hidden: zod_1.z.boolean().default(false),
    color: zod_1.z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/u)
        .optional(),
    model: zod_1.z.string().optional(),
    variant: zod_1.z.string().optional(),
    maxSteps: zod_1.z.number().int().positive().optional(),
    allowedTools: zod_1.z.array(zod_1.z.string()).default([]),
    excludedTools: zod_1.z.array(zod_1.z.string()).default([]),
    mcpServers: zod_1.z.array(zod_1.z.string()).default([]),
    permissions: exports.agentPermissionRulesSchema.optional(),
});
