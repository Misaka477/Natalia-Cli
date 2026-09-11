import { z } from "zod";

export const outputTokenLimitSchema = z
  .number()
  .int()
  .positive()
  .nullable()
  .optional();

export const timeoutSchema = z.object({
  requestSec: z.number().int().min(0).default(0),
  streamIdleSec: z.number().int().min(0).default(0),
  toolSec: z.number().int().positive().optional(),
  turnSec: z.number().int().positive().nullable().default(null),
});

/**
 * How the native terminal window is opened for a foreground session.
 * Deployment driven: a headless server has no display, so the pane must run
 * windowless (the model still reads and writes it; only the human window is
 * missing). `auto` is the default — it attempts a window and, when the attach
 * fails (no display, stale DISPLAY, transient first-run failure), degrades to
 * windowless instead of rolling the started terminal back.
 */
export const terminalWindowConfigSchema = z.object({
  windowMode: z.enum(["auto", "windowless", "window"]).default("auto"),
  backend: z.enum(["wezterm", "pty"]).default("pty"),
});

export const teamConfigSchema = z.object({
  /**
   * The maximum number of sandboxed sub-agents a fan-out may run concurrently.
   * More parallelism is faster but costs more provider tokens and sandbox
   * disk; the provider-concurrency limiter is the hard ceiling underneath.
   */
  maxConcurrent: z.number().int().min(1).max(32).default(4),
});

export const sandboxConfigSchema = z.object({
  /**
   * Which sandbox backend is the default. `snapshot` is our own git-free
   * backend (content-addressed object store, candidate/promote/rollback) and
   * needs nothing external; `worktree` uses the host's real git when the
   * workspace is a git repo, so a promoted sandbox change lands as a commit in
   * the user's own history. Default `snapshot`: the framework ships its own
   * git, git is opt-in for history integration.
   */
  backend: z.enum(["snapshot", "worktree"]).default("snapshot"),
  /**
   * Command run inside the candidate before a promote may land. Empty is
   * rejected; the runtime never promotes on a silent no-op command.
   */
  promoteCommand: z.string().trim().min(1).default("npm run typecheck"),
});

export const runtimeConfigSchema = z.object({
  maxStepsPerTurn: z.number().int().positive().optional(),
  subagentDepth: z.number().int().min(1).max(8).default(1),
  collaboration: z
    .object({
      /**
       * Maximum request/reply exchanges Natalia and Navi may continue without
       * another user turn. A reply that closes the final exchange is always
       * delivered; this limit only prevents another automatic follow-up.
       */
      maxAutoRounds: z.number().int().min(1).max(10).default(3),
    })
    .default({}),
  timeouts: timeoutSchema.default({}),
  maxAttemptsPerStep: z.number().int().positive().default(3),
  /**
   * Max in-flight provider requests per provider id, keyed by provider. This is
   * the fan-out ceiling: N parallel sub-agents each take a slot before calling
   * the provider, so they queue instead of tripping rate limits. Absent =
   * unlimited.
   */
  providerConcurrency: z.record(z.number().int().min(1)).default({}),
  retry: z
    .object({
      // Null means transient provider failures retry until success or cancellation.
      maxAttemptsPerStep: z.number().int().positive().nullable().default(null),
      initialBackoffMs: z.number().int().positive().default(300),
      maxBackoffMs: z.number().int().positive().default(5000),
      jitterMs: z.number().int().min(0).default(500),
    })
    .default({}),
  terminal: terminalWindowConfigSchema.default({}),
});

export const contextConfigSchema = z.object({
  autoDetectWindow: z.boolean().default(true),
  compactionEnabled: z.boolean().default(true),
  compactionThresholdPercent: z.number().int().min(50).max(99).default(85),
  reservedOutputTokens: z
    .union([z.literal("auto"), z.number().int().positive()])
    .default("auto"),
  preservedRecentMessages: z.number().int().min(0).default(10),
  /** When > 0, an absolute token budget for the recent tail. */
  preservedRecentTokens: z.number().int().min(0).default(0),
  /** Bounded overflow recovery attempts before surfacing context_limit. */
  maxOverflowRetries: z.number().int().min(0).max(3).default(1),
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

export const modelCapabilitiesSchema = z.object({
  toolCall: z.boolean().default(true),
  reasoning: z.boolean().default(true),
  thinking: z.boolean().default(true),
  imageInput: z.boolean().default(false),
  pdfInput: z.boolean().default(false),
  videoInput: z.boolean().default(false),
});

export const modelLimitsSchema = z
  .object({
    contextWindow: z
      .union([z.literal("auto"), z.number().int().positive()])
      .default("auto"),
    maxOutputTokens: outputTokenLimitSchema,
  })
  .default({});

/**
 * A model known to a provider, keyed by the model ID the provider's API
 * returns. The catalog is where provider-returned facts live (discovery or
 * user-declared manual import); it is never mutated by a runtime default.
 */
export const catalogModelSchema = z.object({
  name: z.string().min(1),
  capabilities: modelCapabilitiesSchema.default({}),
  limits: modelLimitsSchema,
  status: z.enum(["stable", "experimental", "deprecated"]).default("stable"),
  source: z.enum(["discovery", "manual"]).default("discovery"),
});

/**
 * The provider-visible model catalog. `catalog.providers[providerID].models`
 * is keyed by the provider's own model ID, so the same model string on two
 * providers never collides.
 */
export const modelCatalogSchema = z
  .object({
    providers: z
      .record(
        z
          .object({
            models: z.record(catalogModelSchema).default({}),
          })
          .default({}),
      )
      .default({}),
  })
  .default({});

export const providerConnectionSchema = z
  .object({
    baseURL: z.string().url().optional(),
    apiKey: z.string().min(1).optional(),
    authHeader: z.string().optional(),
  })
  .default({});

export const providerRequestDefaultsSchema = z
  .object({
    stream: z.boolean().default(true),
    headers: z.record(z.string()).default({}),
    options: z.record(z.unknown()).default({}),
  })
  .default({});

/**
 * A configured provider, keyed by a stable provider ID. `name` is the
 * user-editable label; `driver` names the wire protocol adapter. Connection
 * secrets and request-level defaults are nested so a partial overlay can
 * update one without replacing the others.
 */
export const providerConfigSchema = z.object({
  name: z.string().min(1),
  driver: z.string().min(1),
  enabled: z.boolean().default(true),
  connection: providerConnectionSchema,
  requestDefaults: providerRequestDefaultsSchema,
});

export const modelOverrideRequestDefaultsSchema = z
  .object({
    temperature: z.number().min(0).max(2).nullable().default(null),
    topP: z.number().min(0).max(1).nullable().default(null),
    // Optional on purpose: an unset field falls through to the provider's
    // connection-level request default instead of being pinned to `true`.
    stream: z.boolean().optional(),
    thinkingEnabled: z.boolean().optional(),
  })
  .default({});

/**
 * User intent layered over the catalog. Keyed by the canonical
 * `${providerID}/${modelID}` ref, so a user can enable, rename or tune a
 * specific model without rewriting provider-returned catalog facts.
 */
export const modelOverrideSchema = z.object({
  enabled: z.boolean().default(true),
  name: z.string().min(1).optional(),
  requestDefaults: modelOverrideRequestDefaultsSchema,
  requestOptions: z.record(z.unknown()).default({}),
  headers: z.record(z.string()).default({}),
  limits: modelLimitsSchema.optional(),
});

/** A canonical model reference: `{provider, model}`. */
export const modelRefSchema = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
  })
  .strict();

export function modelRefKey(ref: { provider: string; model: string }): string {
  return `${ref.provider}/${ref.model}`;
}

export function parseModelRef(input: string): {
  provider: string;
  model: string;
} {
  const separator = input.indexOf("/");
  if (separator <= 0 || separator === input.length - 1)
    throw new Error(
      `invalid model reference "${input}"; expected "provider/model"`,
    );
  return {
    provider: input.slice(0, separator),
    model: input.slice(separator + 1),
  };
}

export const modeConfigSchema = z.object({
  description: z.string().default(""),
  model: z.string().optional(),
  permission: z.string().optional(),
  systemPrompt: z.string().default(""),
  allowedTools: z.array(z.string()).default([]),
  excludedTools: z.array(z.string()).default([]),
  mcpServers: z.array(z.string()).default([]),
});
