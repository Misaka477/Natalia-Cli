import { z } from "zod";
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
});

export const permissionProfileSchema = z.object({
  approval: z.enum(["ask", "auto", "read_only"]),
  description: z.string().default(""),
  permissions: agentPermissionRulesSchema.optional(),
  commandRules: permissionProfileCommandRulesSchema.optional(),
  interactivePrograms: interactiveProgramRulesSchema.optional(),
  extensions: extensionRulesSchema.optional(),
});

/**
 * Unified agent runtime mode. This replaces the separate permission profile
 * plus mode split: one mode owns the workflow preset and the security boundary.
 * The built-in ask/auto/read_only modes remain available and non-editable.
 */
export const agentModeSchema = z.object({
  description: z.string().default(""),
  approval: z.enum(["ask", "auto", "read_only"]),
  systemPrompt: z.string().default(""),
  model: z.string().optional(),
  allowedTools: z.array(z.string()).default([]),
  excludedTools: z.array(z.string()).default([]),
  commandRules: permissionProfileCommandRulesSchema.optional(),
  interactivePrograms: interactiveProgramRulesSchema.optional(),
  skills: z.boolean().default(true),
  mcpServers: z.array(z.string()).default([]),
});

export const flowModuleTypeSchema = z.enum([
  "read_search",
  "terminal",
  "shell_command",
  "workspace_changes",
  "web_fetch",
  "skills",
  "mcp",
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
