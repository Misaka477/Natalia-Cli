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
  enabled: z.boolean().default(true),
  capabilities: z
    .object({
      toolCall: z.boolean().default(true),
      reasoning: z.boolean().default(true),
      thinking: z.boolean().default(true),
      imageInput: z.boolean().default(false),
      pdfInput: z.boolean().default(false),
    })
    .default({}),
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
  enabled: z.boolean().default(true),
  baseURL: z.string().url().optional(),
  apiKey: z.string().min(1).optional(),
  authHeader: z.string().min(1).optional(),
  customHeaders: z.record(z.string()).default({}),
  requireOutputLimit: z.boolean().optional(),
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

/**
 * Alert events a task can subscribe to. The vocabulary is frozen: a task chooses
 * from it, and nothing invents a kind outside it.
 */
export const TASK_ALERT_EVENT_KINDS = [
  "task_started",
  "attempt_failed",
  "retry_scheduled",
  "succeeded",
  "ultimately_failed",
  "blocked_by_policy",
  "skipped_due_to_overlap",
] as const;

export type TaskAlertEventKind = (typeof TASK_ALERT_EVENT_KINDS)[number];

/** Applied to a bare channel name, so the common case needs no policy at all. */
export const DEFAULT_TASK_ALERT_EVENTS: readonly TaskAlertEventKind[] = [
  "ultimately_failed",
  "blocked_by_policy",
  "skipped_due_to_overlap",
];

export const bashCommandRuleSchema = z.object({
  command: z.string().min(1),
  reason: z.string().min(1).optional(),
});

export const permissionProfileCommandRulesSchema = z.object({
  mode: z.enum(["blacklist", "whitelist", "none"]),
  rules: z.array(bashCommandRuleSchema).default([]),
});

/**
 * Launch commands that may take over a pane as an interactive program, such as
 * an editor, a REPL or a database client. By default it is an explicit
 * allowlist. `allowAny` is an intentionally high-risk escape hatch selected by
 * the user; foreground-process confirmation still applies.
 */
export const interactiveProgramRulesSchema = z.object({
  allowAny: z.boolean().default(false),
  allow: z.array(bashCommandRuleSchema).default([]),
});

/** Extension stages can only narrow the profile's extension boundary. */
export const extensionRulesSchema = z.object({
  skills: z.boolean().optional(),
  mcp: z.boolean().optional(),
  plugins: z.boolean().optional(),
});

export const permissionProfileSchema = z.object({
  approval: z.enum(["ask", "auto", "read_only"]),
  description: z.string().default(""),
  permissions: agentPermissionRulesSchema.optional(),
  commandRules: permissionProfileCommandRulesSchema.optional(),
  interactivePrograms: interactiveProgramRulesSchema.optional(),
  extensions: extensionRulesSchema.optional(),
});

export const flowModuleTypeSchema = z.enum([
  "read_search",
  "terminal",
  "shell_command",
  "workspace_changes",
  "web_fetch",
  "skills",
  "mcp",
  "plugins",
  "subagents",
  "report_output",
]);

export const flowConditionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

export const flowConditionDecompositionSchema = z
  .object({
    schemaVersion: z.literal(1),
    conditions: z
      .array(z.object({ text: z.string().trim().min(1) }).strict())
      .min(1),
  })
  .strict();

export const nataliaFlowModuleSchema = z.object({
  id: z.string().min(1),
  type: flowModuleTypeSchema,
  displayName: z.string().min(1),
  enabled: z.boolean().default(true),
  instructions: z.string().default(""),
  minimumConditions: z.array(flowConditionSchema).default([]),
  idealConditions: z.array(flowConditionSchema).default([]),
  commandRules: permissionProfileCommandRulesSchema.optional(),
  interactivePrograms: interactiveProgramRulesSchema.optional(),
  extensions: extensionRulesSchema.optional(),
  permissions: agentPermissionRulesSchema.optional(),
});

export const nataliaFlowDocumentSchema = z.object({
  kind: z.literal("natalia-flow"),
  version: z.number().int().positive(),
  flowID: z.string().min(1),
  displayName: z.string().min(1),
  directRun: z.object({ permissionProfile: z.string().min(1) }).optional(),
  modules: z.array(nataliaFlowModuleSchema).min(1),
});

export const nataliaTaskDocumentSchema = z.object({
  kind: z.literal("natalia-task"),
  version: z.number().int().positive(),
  taskID: z.string().min(1),
  displayName: z.string().min(1),
  schedule: z.string().min(1),
  prompt: z.string().min(1),
  permissionProfile: z.string().min(1),
  flow: z
    .object({
      path: z.string().min(1).optional(),
      flowID: z.string().min(1).optional(),
    })
    .refine((flow) => Boolean(flow.path || flow.flowID), {
      message: "flow reference requires a path or flowID",
    }),
  retry: z.enum(["none", "once", "twice", "three_times"]).default("none"),
  /**
   * Where the task's outcome is announced, and for which events. A bare channel
   * name keeps the conservative default: the outcomes a person has to know about,
   * without a message per retried attempt and without one for every success.
   */
  alerts: z
    .array(
      z.union([
        z.string().min(1),
        z.object({
          channel: z.string().min(1),
          on: z.array(z.enum(TASK_ALERT_EVENT_KINDS)).min(1),
        }),
      ]),
    )
    .default([]),
  /** Configuration key of the issue target used to reconcile findings. */
  issueTarget: z.string().min(1).optional(),
  /**
   * Optional configuration key of an append-only source this task consumes
   * incrementally. A task that has nothing to resume from omits it.
   */
  dataSource: z.string().min(1).optional(),
  evaluator: z
    .object({ provider: z.string().min(1), model: z.string().min(1) })
    .optional(),
  evaluatorConsent: z
    .object({ provider: z.string().min(1), confirmedAt: z.string().datetime() })
    .optional(),
  /**
   * Explicit scheduler input and the installed timer identity. `schedule`
   * remains the human-readable label; no runtime code derives a calendar from
   * that free text.
   */
  systemd: z
    .object({
      calendar: z.string().min(1),
      scope: z.enum(["user", "system"]).default("user"),
      timerUnit: z.string().min(1).optional(),
      generatedCalendar: z.string().min(1).optional(),
    })
    .optional(),
});

export const evaluatorConditionStatusSchema = z
  .object({
    id: z.string().min(1),
    status: z.enum(["missing", "partial", "satisfied"]),
    reason: z.string().min(1),
    evidenceRefs: z.array(z.string().min(1)),
  })
  .strict();

export const evaluatorResultSchema = z
  .object({
    schemaVersion: z.literal(1),
    outcome: z.enum(["complete", "incomplete", "blocked"]),
    conditions: z.array(evaluatorConditionStatusSchema),
    gaps: z.array(z.string().min(1)),
    forbiddenRepeats: z.array(z.string().min(1)),
    recommendedActions: z.array(z.string().min(1)),
    idealOutcome: z.enum(["missing", "partial", "satisfied"]),
  })
  .strict();

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

export const pluginConfigSchema = z.object({
  enabled: z.record(z.boolean()).default({}),
  paths: z.array(z.string()).default([]),
  capabilities: z.record(z.array(z.enum(["tools", "events"]))).default({}),
  readOnly: z.record(z.boolean()).default({}),
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
  providerPriority: z.array(z.string()).default(["configured", "duckduckgo"]),
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

export const constitutionRuleSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  scope: z.enum(["project", "package", "sandbox", "task", "release"]),
  priority: z.enum(["critical", "high", "medium", "low"]),
  source: z.enum(["user", "master_plan", "policy"]),
  enforcement: z.enum(["deny", "approval", "warn"]),
  overridePolicy: z.enum(["forbidden", "user_scoped", "user_explicit"]),
  evidenceRefs: z.array(z.string()).default([]),
});

export const decisionRecordSchema = z.object({
  id: z.string().min(1),
  decision: z.string().min(1),
  rationale: z.array(z.string()).default([]),
  alternatives: z
    .array(
      z.object({
        option: z.string(),
        rejectedReason: z.string().optional(),
      }),
    )
    .default([]),
  consequences: z.array(z.string()).default([]),
  status: z.enum(["proposed", "accepted", "superseded"]),
  scope: z.array(z.string()).default([]),
  linkedPlans: z.array(z.string()).default([]),
  linkedConstraints: z.array(z.string()).default([]),
});

export const validationRunSchema = z.object({
  command: z.string(),
  target: z.string(),
  result: z.enum(["passed", "failed", "skipped"]),
  durationMs: z.number().int().positive().optional(),
  outputArtifact: z.string().optional(),
  safeSummary: z.string(),
});

export const completionEvidenceSchema = z.object({
  id: z.string().min(1),
  taskID: z.string().min(1),
  objective: z.string().min(1),
  status: z.enum([
    "planned",
    "implemented",
    "validated",
    "accepted",
    "promoted",
    "blocked",
    "failed",
    "partial",
  ]),
  changes: z
    .array(
      z.object({
        path: z.string(),
        changeType: z.enum(["added", "modified", "deleted"]),
        summary: z.string(),
      }),
    )
    .default([]),
  validations: z.array(validationRunSchema).default([]),
  knownGaps: z.array(z.string()).default([]),
  rollback: z
    .object({
      checkpointID: z.string().optional(),
      sandboxID: z.string().optional(),
    })
    .optional(),
  workGraphRefs: z.array(z.string()).default([]),
});

export const workGraphNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum([
    "goal",
    "constraint",
    "decision",
    "plan",
    "plan_step",
    "agent_action",
    "tool_call",
    "approval",
    "checkpoint",
    "validation",
    "workspace_change",
  ]),
  summary: z.string(),
  actor: z.string().optional(),
  target: z.string().optional(),
  journalOffset: z.number().int().nonnegative().optional(),
  sessionID: z.string().optional(),
  turnID: z.string().optional(),
  stepID: z.string().optional(),
});

export const sessionIntelligenceSnapshotSchema = z.object({
  id: z.string().min(1),
  agentStatus: z.string(),
  currentStep: z.string().optional(),
  activeTool: z.string().optional(),
  changedFiles: z.number().int().nonnegative().default(0),
  unvalidatedChanges: z.number().int().nonnegative().default(0),
  recentOutput: z.string().max(2000).optional(),
  hasPTY: z.boolean().default(false),
  hasSandbox: z.boolean().default(false),
});

export const driftFindingSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(["advisory", "warning", "high"]),
  confidence: z.number().min(0).max(1),
  originalObjective: z.string().min(1),
  currentActivity: z.string().min(1),
  evidence: z.array(z.string()).default([]),
  applicableConstraints: z.array(z.string()).default([]),
  status: z.enum(["open", "explained", "dismissed", "corrected"]),
  options: z
    .array(
      z.object({
        label: z.string(),
        action: z.string(),
      }),
    )
    .default([]),
});

export const toolCanonicalRegistrationSchema = z.object({
  name: z.string().min(1),
  owner: z.string().min(1),
  scope: z.enum(["process", "workspace", "session"]),
  recovery: z
    .enum(["none", "retry", "restart", "fail_closed"])
    .default("retry"),
  precedence: z.number().int().default(0),
  grants: z.array(z.string()).default([]),
  requiresApproval: z.boolean().default(false),
});

export const capabilityManifestSchema = z.object({
  apiVersion: z.literal(1),
  id: z.string().min(1),
  version: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  scope: z.enum(["process", "workspace", "session"]),
  dependencies: z.array(z.string()).default([]),
  grants: z
    .array(
      z.enum([
        "tools",
        "commands",
        "settings",
        "workflows",
        "projection",
        "resources",
      ]),
    )
    .default([]),
});

export const workGraphEdgeSchema = z.object({
  id: z.string().min(1),
  sourceID: z.string().min(1),
  targetID: z.string().min(1),
  kind: z.enum([
    "requested_by",
    "constrained_by",
    "planned_by",
    "executed_by",
    "caused",
    "modified",
    "validated_by",
    "approved_by",
    "checkpointed_by",
    "superseded_by",
    "rolled_back_by",
  ]),
  reason: z.string().optional(),
});

export const scopedOverrideSchema = z.object({
  id: z.string().min(1),
  ruleID: z.string().min(1),
  reason: z.string().min(1),
  scope: z.object({
    paths: z.array(z.string()).optional(),
    taskID: z.string().optional(),
    expiresAt: z.string().optional(),
  }),
  approvedBy: z.literal("user"),
});

export const policyStatementSchema = z.object({
  effect: z.enum(["allow", "deny"]),
  action: z.string().min(1),
  resource: z.string().min(1),
});

export const experimentalConfigSchema = z.object({
  policies: z.array(policyStatementSchema).default([]),
});

export const issueTargetConfigSchema = z.object({
  kind: z.enum(["gitea", "github"]),
  baseURL: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
  /** Bot credential. It stays in configuration and never enters a task, a flow, a prompt or the model context. */
  token: z.string().default(""),
  label: z.string().default(""),
  enabled: z.boolean().default(true),
});

/**
 * Append-only source a task consumes incrementally: an application log, an
 * exported report, an audit trail, or anything else that only grows. The path is
 * deployment specific, so it lives in configuration rather than in the
 * version-controlled task document, and the model never chooses it.
 */
export const dataSourceConfigSchema = z.object({
  path: z.string().min(1),
  kind: z.enum(["offset", "timestamp"]).default("offset"),
  /**
   * Required by `kind: "timestamp"`: the JSON field each line carries its own
   * time in. The operator names it, because guessing at log formats would mean
   * shipping a vendor adapter per source. Ignored by `kind: "offset"`.
   */
  timestampField: z.string().default(""),
  maxBytes: z.number().int().positive().default(65536),
  enabled: z.boolean().default(true),
});

/**
 * Where a task alert is delivered. The journal channel is the durable queue and
 * the process output itself; a webhook is an external endpoint. Credentials stay
 * here and never enter a task document, a prompt, a systemd unit or the queue.
 */
export const alertChannelConfigSchema = z.object({
  kind: z.enum(["journal", "webhook"]),
  url: z.string().default(""),
  token: z.string().default(""),
  timeoutMs: z.number().int().positive().default(10_000),
  enabled: z.boolean().default(true),
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
  plugins: pluginConfigSchema.default({}),
  workspace: workspaceConfigSchema.default({}),
  instructions: instructionConfigSchema.default({}),
  webSearch: webSearchConfigSchema.default({}),
  browser: browserConfigSchema.default({}),
  network: networkConfigSchema.default({}),
  security: securityConfigSchema.default({}),
  issueTargets: z.record(issueTargetConfigSchema).default({}),
  dataSources: z.record(dataSourceConfigSchema).default({}),
  alertChannels: z.record(alertChannelConfigSchema).default({}),
  experimental: experimentalConfigSchema.default({}),
});

export type ConfigV2 = z.infer<typeof configV2Schema>;
export type ModelConfig = z.infer<typeof modelConfigSchema>;
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type PermissionProfile = z.infer<typeof permissionProfileSchema>;
export type IssueTargetConfig = z.infer<typeof issueTargetConfigSchema>;
export type DataSourceConfig = z.infer<typeof dataSourceConfigSchema>;
export type AlertChannelConfig = z.infer<typeof alertChannelConfigSchema>;
export type InteractiveProgramRules = z.infer<
  typeof interactiveProgramRulesSchema
>;
export type ExtensionRules = z.infer<typeof extensionRulesSchema>;
export type NataliaFlowDocument = z.infer<typeof nataliaFlowDocumentSchema>;
export type NataliaTaskDocument = z.infer<typeof nataliaTaskDocumentSchema>;
export type NataliaFlowDocumentInput = z.input<
  typeof nataliaFlowDocumentSchema
>;
export type NataliaTaskDocumentInput = z.input<
  typeof nataliaTaskDocumentSchema
>;
export type FlowConditionDecomposition = z.infer<
  typeof flowConditionDecompositionSchema
>;
export type EvaluatorResult = z.infer<typeof evaluatorResultSchema>;
export type ModeConfig = z.infer<typeof modeConfigSchema>;
export type AgentConfig = z.infer<typeof agentConfigSchema>;
export type AgentPermissionRules = z.infer<typeof agentPermissionRulesSchema>;
export type MCPServerConfig = z.infer<typeof mcpServerConfigSchema>;
export type PolicyStatement = z.infer<typeof policyStatementSchema>;
export type CapabilityManifest = z.infer<typeof capabilityManifestSchema>;
export type CompletionEvidence = z.infer<typeof completionEvidenceSchema>;
export type DriftFinding = z.infer<typeof driftFindingSchema>;
export type WorkGraphNode = z.infer<typeof workGraphNodeSchema>;
export type WorkGraphEdge = z.infer<typeof workGraphEdgeSchema>;
export type SessionIntelligenceSnapshot = z.infer<
  typeof sessionIntelligenceSnapshotSchema
>;
export type ToolCanonicalRegistration = z.infer<
  typeof toolCanonicalRegistrationSchema
>;
export type ConstitutionRule = z.infer<typeof constitutionRuleSchema>;
export type DecisionRecord = z.infer<typeof decisionRecordSchema>;
export type ScopedOverride = z.infer<typeof scopedOverrideSchema>;
