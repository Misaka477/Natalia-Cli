import { z } from "zod";

export const outputTokenLimitSchema = z
  .number()
  .int()
  .positive()
  .nullable()
  .optional();

export const timeoutSchema = z.object({
  requestSec: z.number().int().positive().default(120),
  streamIdleSec: z.number().int().positive().default(120),
  toolSec: z.number().int().positive().optional(),
  turnSec: z.number().int().positive().nullable().default(null),
});

export const runtimeConfigSchema = z.object({
  maxStepsPerTurn: z.number().int().positive().default(1000),
  subagentDepth: z.number().int().min(1).max(8).default(1),
  timeouts: timeoutSchema.default({}),
  maxAttemptsPerStep: z.number().int().positive().default(3),
  retry: z
    .object({
      maxAttemptsPerStep: z.number().int().positive().default(3),
      initialBackoffMs: z.number().int().positive().default(300),
      maxBackoffMs: z.number().int().positive().default(5000),
      jitterMs: z.number().int().min(0).default(500),
    })
    .default({}),
});

export const contextConfigSchema = z.object({
  autoDetectWindow: z.boolean().default(true),
  compactionEnabled: z.boolean().default(true),
  compactionThresholdPercent: z.number().int().min(50).max(99).default(85),
  reservedOutputTokens: z
    .union([z.literal("auto"), z.number().int().positive()])
    .default("auto"),
  preservedRecentMessages: z.number().int().min(0).default(2),
});

export const checkpointConfigSchema = z
  .object({
    enabled: z.boolean().default(true),
    maxFiles: z.number().int().positive().default(20000),
    maxBytes: z
      .number()
      .int()
      .positive()
      .default(512 * 1024 * 1024),
    ignore: z.array(z.string()).default([]),
    additionalDirs: z.array(z.string()).default([]),
  })
  .default({});

export const modelConfigSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  contextWindow: z
    .union([z.literal("auto"), z.number().int().positive()])
    .default("auto"),
  maxOutputTokens: outputTokenLimitSchema,
  temperature: z.number().min(0).max(2).nullable().default(null),
  topP: z.number().min(0).max(1).nullable().default(null),
  reasoningEffort: z
    .enum(["minimal", "low", "medium", "high", "xhigh"])
    .nullable()
    .default(null),
  thinkingEnabled: z.boolean().default(true),
  stream: z.boolean().default(true),
  requestTimeoutSec: z.number().int().positive().nullable().default(null),
  variants: z
    .record(
      z.object({
        model: z.string().min(1).optional(),
        maxOutputTokens: outputTokenLimitSchema,
        temperature: z.number().min(0).max(2).nullable().default(null),
        topP: z.number().min(0).max(1).nullable().default(null),
        reasoningEffort: z
          .enum(["minimal", "low", "medium", "high", "xhigh"])
          .nullable()
          .default(null),
        thinkingEnabled: z.boolean().optional(),
        requestTimeoutSec: z.number().int().positive().nullable().default(null),
      }),
    )
    .default({}),
});

export const providerConfigSchema = z.object({
  type: z.string().min(1),
  baseURL: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  authHeader: z.string().min(1).optional(),
  customHeaders: z.record(z.string()).default({}),
  requireOutputLimit: z.boolean().optional(),
});

export const permissionProfileSchema = z.object({
  approval: z.enum(["ask", "auto", "read_only"]),
  description: z.string().default(""),
});

export const modeConfigSchema = z.object({
  description: z.string().default(""),
  model: z.string().optional(),
  permission: z.string().optional(),
  systemPrompt: z.string().default(""),
  allowedTools: z.array(z.string()).default([]),
  excludedTools: z.array(z.string()).default([]),
  mcpServers: z.array(z.string()).default([]),
});

export const agentPermissionRulesSchema = z.object({
  tools: z
    .object({
      allow: z.array(z.string()).default([]),
      exclude: z.array(z.string()).default([]),
    })
    .optional(),
  files: z
    .object({
      readPaths: z
        .array(
          z.object({
            pattern: z.string(),
            allow: z.boolean().optional(),
            reason: z.string().optional(),
          }),
        )
        .default([]),
      writePaths: z
        .array(
          z.object({
            pattern: z.string(),
            allow: z.boolean().optional(),
            reason: z.string().optional(),
          }),
        )
        .default([]),
    })
    .optional(),
  commands: z
    .object({
      allowPatterns: z.array(z.string()).default([]),
      denyPatterns: z.array(z.string()).default([]),
    })
    .optional(),
  network: z
    .object({
      allowedHosts: z.array(z.string()).default([]),
      denyHosts: z.array(z.string()).default([]),
      allowLocalhost: z.boolean().optional(),
      allowPrivate: z.boolean().optional(),
    })
    .optional(),
  env: z.object({ allowlist: z.array(z.string()).default([]) }).optional(),
  redactOutput: z.boolean().optional(),
});

export const agentConfigSchema = z.object({
  description: z.string().default(""),
  systemPrompt: z.string().default(""),
  mode: z.enum(["primary", "subagent", "all"]).default("primary"),
  hidden: z.boolean().default(false),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/u)
    .optional(),
  model: z.string().optional(),
  variant: z.string().optional(),
  maxSteps: z.number().int().positive().optional(),
  allowedTools: z.array(z.string()).default([]),
  excludedTools: z.array(z.string()).default([]),
  mcpServers: z.array(z.string()).default([]),
  permissions: agentPermissionRulesSchema.optional(),
});

export const skillsConfigSchema = z.object({
  urls: z.array(z.string().url()).default([]),
});

export const mcpServerConfigSchema = z.object({
  type: z.enum(["stdio", "http"]),
  command: z.string().optional(),
  args: z.array(z.string()).default([]),
  url: z.string().url().optional(),
  headers: z.record(z.string()).default({}),
  environment: z.record(z.string()).default({}),
  cwd: z.string().optional(),
  timeoutSec: z.number().int().positive().default(30),
  allowedTools: z.array(z.string()).default([]),
  excludedTools: z.array(z.string()).default([]),
  readOnly: z.boolean().default(false),
  enabled: z.boolean().default(true),
  // Interactive remote authentication is recognized only to emit a local unsupported diagnostic.
  auth: z.union([z.literal(false), z.object({}).passthrough()]).optional(),
});

export const workspaceConfigSchema = z.object({
  root: z.string().default(""),
  additionalDirs: z.array(z.string()).default([]),
});

export const instructionConfigSchema = z.object({
  enabled: z.boolean().default(true),
  includeReadme: z.boolean().default(true),
  includeDocs: z.boolean().default(false),
  extraFiles: z.array(z.string()).default([]),
});

export const webSearchConfigSchema = z.object({
  endpoint: z.string().url().nullable().default(null),
  providerPriority: z.array(z.string()).default(["duckduckgo"]),
});

export const browserConfigSchema = z.object({
  enabled: z.boolean().default(true),
  binary: z.string().default(""),
  persistentProfile: z.boolean().default(false),
  profileDir: z.string().default(""),
  userAgent: z.string().default(""),
  locale: z.string().default(""),
  timezone: z.string().default(""),
  headers: z.record(z.string()).default({}),
});

export const networkConfigSchema = z.object({
  allowedHosts: z.array(z.string()).default([]),
  allowedSchemes: z.array(z.string()).default(["https", "http"]),
  allowLocalhost: z.boolean().default(false),
  allowPrivate: z.boolean().default(false),
});

export const securityConfigSchema = z.object({
  envAllowlist: z.array(z.string()).default([]),
  redactToolOutput: z.boolean().default(true),
});

export const policyStatementSchema = z.object({
  effect: z.enum(["allow", "deny"]),
  action: z.string().min(1),
  resource: z.string().min(1),
});

export const experimentalConfigSchema = z.object({
  policies: z.array(policyStatementSchema).default([]),
});

export const configV2Schema = z.object({
  version: z.literal(2),
  runtime: runtimeConfigSchema.default({}),
  context: contextConfigSchema.default({}),
  checkpoint: checkpointConfigSchema,
  models: z.record(modelConfigSchema).default({}),
  defaultModel: z.string().default(""),
  providers: z.record(providerConfigSchema).default({}),
  permissionProfiles: z.record(permissionProfileSchema).default({
    ask: {
      approval: "ask",
      description: "Ask before write, process, or shell actions",
    },
    auto: { approval: "auto", description: "Automatically approve actions" },
    read_only: {
      approval: "read_only",
      description: "Reject write and execution actions",
    },
  }),
  defaultPermission: z.string().default("ask"),
  modes: z.record(modeConfigSchema).default({}),
  defaultMode: z.string().default("code"),
  agents: z.record(agentConfigSchema).default({}),
  defaultAgent: z.string().default(""),
  mcpServers: z.record(mcpServerConfigSchema).default({}),
  skills: skillsConfigSchema.default({}),
  workspace: workspaceConfigSchema.default({}),
  instructions: instructionConfigSchema.default({}),
  webSearch: webSearchConfigSchema.default({}),
  browser: browserConfigSchema.default({}),
  network: networkConfigSchema.default({}),
  security: securityConfigSchema.default({}),
  experimental: experimentalConfigSchema.default({}),
});

export type ConfigV2 = z.infer<typeof configV2Schema>;
export type ModelConfig = z.infer<typeof modelConfigSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type PermissionProfile = z.infer<typeof permissionProfileSchema>;
export type ModeConfig = z.infer<typeof modeConfigSchema>;
export type AgentConfig = z.infer<typeof agentConfigSchema>;
export type AgentPermissionRules = z.infer<typeof agentPermissionRulesSchema>;
export type MCPServerConfig = z.infer<typeof mcpServerConfigSchema>;
export type PolicyStatement = z.infer<typeof policyStatementSchema>;
