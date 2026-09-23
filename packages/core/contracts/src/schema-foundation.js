"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.modeConfigSchema = exports.modelRefSchema = exports.modelOverrideSchema = exports.modelOverrideRequestDefaultsSchema = exports.providerConfigSchema = exports.endpointProtocolSchema = exports.endpointCapabilitiesSchema = exports.providerRequestDefaultsSchema = exports.providerConnectionSchema = exports.modelCatalogSchema = exports.catalogModelSchema = exports.modelLimitsSchema = exports.modelCapabilitiesSchema = exports.interleavedReasoningCapabilitySchema = exports.checkpointConfigSchema = exports.contextConfigSchema = exports.runtimeConfigSchema = exports.goalConfigSchema = exports.subagentWallClockMs = exports.confinementConfigSchema = exports.CONFINEMENT_MODES = exports.sandboxConfigSchema = exports.teamConfigSchema = exports.terminalWindowConfigSchema = exports.timeoutSchema = exports.outputTokenLimitSchema = void 0;
exports.modelRefKey = modelRefKey;
exports.parseModelRef = parseModelRef;
var zod_1 = require("zod");
exports.outputTokenLimitSchema = zod_1.z
    .number()
    .int()
    .positive()
    .nullable()
    .optional();
exports.timeoutSchema = zod_1.z.object({
    requestSec: zod_1.z.number().int().min(0).default(0),
    streamIdleSec: zod_1.z.number().int().min(0).default(0),
    toolSec: zod_1.z.number().int().positive().optional(),
    turnSec: zod_1.z.number().int().positive().nullable().default(null),
});
/**
 * How the native terminal window is opened for a foreground session.
 * Deployment driven: a headless server has no display, so the pane must run
 * windowless (the model still reads and writes it; only the human window is
 * missing). `auto` is the default — it attempts a window and, when the attach
 * fails (no display, stale DISPLAY, transient first-run failure), degrades to
 * windowless instead of rolling the started terminal back.
 */
exports.terminalWindowConfigSchema = zod_1.z.object({
    windowMode: zod_1.z.enum(["auto", "windowless", "window"]).default("auto"),
    backend: zod_1.z.enum(["wezterm", "pty"]).default("pty"),
});
exports.teamConfigSchema = zod_1.z.object({
    /**
     * The maximum number of sandboxed sub-agents a fan-out may run concurrently.
     * More parallelism is faster but costs more provider tokens and sandbox
     * disk; the provider-concurrency limiter is the hard ceiling underneath.
     */
    maxConcurrent: zod_1.z.number().int().min(1).max(32).default(4),
});
exports.sandboxConfigSchema = zod_1.z.object({
    /**
     * Which sandbox backend is the default. `snapshot` is our own git-free
     * backend (content-addressed object store, candidate/promote/rollback) and
     * needs nothing external; `worktree` uses the host's real git when the
     * workspace is a git repo, so a promoted sandbox change lands as a commit in
     * the user's own history. Default `snapshot`: the framework ships its own
     * git, git is opt-in for history integration.
     */
    backend: zod_1.z.enum(["snapshot", "worktree"]).default("snapshot"),
    /**
     * Command run inside the candidate before a promote may land. Empty is
     * rejected; the runtime never promotes on a silent no-op command.
     */
    promoteCommand: zod_1.z.string().trim().min(1).default("npm run typecheck"),
});
/** The three-mode file axis (sandbox study §3 item 1, decision 25). */
exports.CONFINEMENT_MODES = [
    "read-only",
    "workspace-write",
    "danger-full-access",
];
/**
 * Execution confinement for tool subprocesses — the FILE-effect axis, kept
 * apart from the permission mode (the approval axis): a write that confinement
 * allows may still need human approval, and the two resolve independently
 * per call (sandbox study §3, the two-axis clarification).
 *
 * `workspace-write` as the shipped default is the threat model speaking:
 * `runShell` gets Landlock-level L1 enforcement for everything the agent
 * executes, with `/tmp` and the workspace writable and the rest of the
 * filesystem read-only. A deployment that wants the old unconstrained
 * behavior opts into `danger-full-access` explicitly.
 */
exports.confinementConfigSchema = zod_1.z.object({
    mode: zod_1.z.enum(exports.CONFINEMENT_MODES).default("workspace-write"),
});
/**
 * Wall-clock budget for one subagent run, in milliseconds.
 *
 * Bounds a run that is stuck rather than merely slow: a provider call that
 * never returns, or a step that takes minutes. Without it such a run continues
 * until the session ends, paying for every step it takes. `0` disables the
 * budget.
 *
 * The budget is per run, not per subagent: each retry is a deliberate new run
 * with its own budget, so an operator who retries is choosing to spend again.
 */
exports.subagentWallClockMs = zod_1.z.number().int().min(0).default(900000);
/**
 * Goal completion verification.
 *
 * A goal used to be complete because whoever reported it said so, which put the
 * authority entirely in the model's own claim. `command` makes that claim
 * checkable: it runs before a *model-initiated* completion is accepted, and a
 * non-zero exit refuses the completion with the exit code and output so the
 * model can see why.
 *
 * Empty by default. A workspace that does not configure a check behaves exactly
 * as before — an invented default command would fail every workspace that has no
 * test suite, and a silently passing one would be theatre.
 */
exports.goalConfigSchema = zod_1.z
    .object({
    completionCommand: zod_1.z.string().trim().min(1).optional(),
})
    .strict();
exports.runtimeConfigSchema = zod_1.z.object({
    maxStepsPerTurn: zod_1.z.number().int().positive().optional(),
    subagentDepth: zod_1.z.number().int().min(1).max(8).default(1),
    /** Milliseconds one subagent run may take before the runtime stops it. */
    subagentWallClockMs: exports.subagentWallClockMs,
    /**
     * Shortest acceptable final answer from a subagent. A shorter one is followed
     * by exactly one turn asking for the missing detail.
     *
     * `0` disables the gate. The parent receives only the subagent's final text,
     * so a one-word answer leaves it with nothing to act on and no way to tell
     * that from a complete one.
     */
    subagentMinResultChars: zod_1.z.number().int().min(0).default(200),
    /**
     * Settled-outcome notices one session's ledger will carry.
     *
     * A subagent settles whenever it likes and the turn that spawned it is usually
     * elsewhere by then, so the outcome is written into the ledger as runtime
     * context instead of left for the parent to poll for. The number is a budget
     * because each notice is context the parent pays for on every later request,
     * and a session that delegates a great deal must not have its prompt consumed
     * by its own bookkeeping. Each notice is deduplicated per subagent and
     * continuation, so the cap is on distinct children, not on re-settles.
     */
    subagentSettledNotices: zod_1.z
        .number()
        .int()
        .min(0)
        .refine(function (value) { return value === 0 || Number.isFinite(value); }, {
        message: "must be a non-negative integer",
    })
        .default(20),
    collaboration: zod_1.z
        .object({
        /**
         * Maximum request/reply exchanges Natalia and Navi may continue without
         * another user turn. A reply that closes the final exchange is always
         * delivered; this limit only prevents another automatic follow-up.
         */
        maxAutoRounds: zod_1.z.number().int().min(1).max(10).default(3),
    })
        .default({}),
    timeouts: exports.timeoutSchema.default({}),
    maxAttemptsPerStep: zod_1.z.number().int().positive().optional(),
    /**
     * Max in-flight provider requests per provider id, keyed by provider. This is
     * the fan-out ceiling: N parallel sub-agents each take a slot before calling
     * the provider, so they queue instead of tripping rate limits. Absent =
     * unlimited.
     */
    providerConcurrency: zod_1.z.record(zod_1.z.number().int().min(1)).default({}),
    retry: zod_1.z
        .object({
        // Null means transient provider failures retry until success or cancellation.
        maxAttemptsPerStep: zod_1.z.number().int().positive().nullable().default(null),
        initialBackoffMs: zod_1.z.number().int().positive().default(300),
        maxBackoffMs: zod_1.z.number().int().positive().default(5000),
        jitterMs: zod_1.z.number().int().min(0).default(500),
    })
        .default({}),
    terminal: exports.terminalWindowConfigSchema.default({}),
});
exports.contextConfigSchema = zod_1.z.object({
    autoDetectWindow: zod_1.z.boolean().default(true),
    compactionEnabled: zod_1.z.boolean().default(true),
    /**
     * The user's own instruction, layered onto every compaction prompt.
     *
     * A workspace often knows what a summary must keep that a generic one would
     * drop — changelog dates, ticket ids, which test names matter. This is where
     * that goes, rather than each stream hardcoding its own version of it.
     *
     * Absent by default: an invented instruction would be a guess at what the
     * workspace cares about.
     */
    customInstruction: zod_1.z.string().trim().min(1).optional(),
    compactionThresholdPercent: zod_1.z.number().int().min(50).max(99).default(85),
    reservedOutputTokens: zod_1.z
        .union([zod_1.z.literal("auto"), zod_1.z.number().int().positive()])
        .default("auto"),
    preservedRecentMessages: zod_1.z.number().int().min(0).default(10),
    /** When > 0, an absolute token budget for the recent tail. */
    /**
     * Recent-context tokens always kept verbatim across a compaction.
     *
     * A floor rather than a ceiling: the preserved tail is whichever of this and
     * `preservedRecentMessages` reaches further back. Sized in the 15k–20k range
     * the other agent harnesses settle on, because a count alone cannot say how
     * much context a turn holds: ten short exchanges and ten file reads are the
     * same count and an order of magnitude apart in tokens.
     */
    preservedRecentTokens: zod_1.z.number().int().min(0).default(20000),
    /** Bounded overflow recovery attempts before surfacing context_limit. */
    maxOverflowRetries: zod_1.z.number().int().min(0).max(3).default(1),
});
exports.checkpointConfigSchema = zod_1.z
    .object({
    enabled: zod_1.z.boolean().default(true),
    maxFiles: zod_1.z.number().int().positive().default(20000),
    maxBytes: zod_1.z
        .number()
        .int()
        .positive()
        .default(512 * 1024 * 1024),
    ignore: zod_1.z.array(zod_1.z.string()).default([]),
    additionalDirs: zod_1.z.array(zod_1.z.string()).default([]),
})
    .default({});
exports.interleavedReasoningCapabilitySchema = zod_1.z.union([
    zod_1.z.literal(true),
    zod_1.z.literal(false),
    zod_1.z.object({
        field: zod_1.z.enum(["reasoning", "reasoning_content", "reasoning_details"]),
    }),
]);
exports.modelCapabilitiesSchema = zod_1.z.object({
    toolCall: zod_1.z.boolean().default(true),
    reasoning: zod_1.z.boolean().default(true),
    thinking: zod_1.z.boolean().default(true),
    imageInput: zod_1.z.boolean().default(false),
    videoInput: zod_1.z.boolean().default(false),
    /**
     * OpenAI-compatible providers that expect reasoning to be carried in a
     * dedicated message field across turns. `false` disables the behavior even
     * for models whose id otherwise looks interleaved. An omitted value lets the
     * adapter use its built-in DeepSeek default.
     */
    interleaved: exports.interleavedReasoningCapabilitySchema.optional(),
});
exports.modelLimitsSchema = zod_1.z
    .object({
    contextWindow: zod_1.z
        .union([zod_1.z.literal("auto"), zod_1.z.number().int().positive()])
        .default("auto"),
    maxOutputTokens: exports.outputTokenLimitSchema,
    /** Optional provider/model input ceiling; falls back to contextWindow. */
    inputLimit: zod_1.z.number().int().positive().optional(),
    /** Optional per-model output reserve override. */
    reservedOutputTokens: zod_1.z.number().int().positive().optional(),
    /** Optional per-model compaction threshold override. */
    compactionThresholdPercent: zod_1.z.number().int().min(50).max(99).optional(),
})
    .default({});
/**
 * A model known to a provider, keyed by the model ID the provider's API
 * returns. The catalog is where provider-returned facts live (discovery or
 * user-declared manual import); it is never mutated by a runtime default.
 */
exports.catalogModelSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    capabilities: exports.modelCapabilitiesSchema.default({}),
    limits: exports.modelLimitsSchema,
    status: zod_1.z.enum(["stable", "experimental", "deprecated"]).default("stable"),
    source: zod_1.z.enum(["discovery", "manual"]).default("discovery"),
});
/**
 * The provider-visible model catalog. `catalog.providers[providerID].models`
 * is keyed by the provider's own model ID, so the same model string on two
 * providers never collides.
 */
exports.modelCatalogSchema = zod_1.z
    .object({
    providers: zod_1.z
        .record(zod_1.z
        .object({
        models: zod_1.z.record(exports.catalogModelSchema).default({}),
    })
        .default({}))
        .default({}),
})
    .default({});
exports.providerConnectionSchema = zod_1.z
    .object({
    baseURL: zod_1.z.string().url().optional(),
    apiKey: zod_1.z.string().min(1).optional(),
    authHeader: zod_1.z.string().optional(),
})
    .default({});
exports.providerRequestDefaultsSchema = zod_1.z
    .object({
    stream: zod_1.z.boolean().default(true),
    headers: zod_1.z.record(zod_1.z.string()).default({}),
    options: zod_1.z.record(zod_1.z.unknown()).default({}),
})
    .default({});
/**
 * A configured provider, keyed by a stable provider ID. `name` is the
 * user-editable label; `driver` names the wire protocol adapter. Connection
 * secrets and request-level defaults are nested so a partial overlay can
 * update one without replacing the others.
 */
/**
 * How an endpoint speaks to its provider.
 *
 * `format` names the wire format and is the only thing that selects an adapter.
 * It is optional so an existing configuration keeps loading, but the loader
 * warns with the exact JSON to add: a format inferred from `driver` is a guess
 * about what a human meant to type, and the adapter seam exists precisely so
 * that choice is declared instead of guessed.
 */
/**
 * Optional cache extensions an endpoint declares it accepts.
 *
 * Every field is optional and every absent one means off: an undeclared
 * capability costs one unused optimisation, while an assumed one makes every
 * request fail against a parameter the deployment never accepted.
 */
exports.endpointCapabilitiesSchema = zod_1.z
    .object({
    supportsLongCacheRetention: zod_1.z.boolean().optional(),
    supportsCacheControlOnTools: zod_1.z.boolean().optional(),
    sendSessionAffinityHeaders: zod_1.z.boolean().optional(),
    sessionAffinityFormat: zod_1.z.enum(["openrouter"]).optional(),
    supportsPromptCacheKey: zod_1.z.boolean().optional(),
    promptCacheKeyField: zod_1.z
        .enum(["promptCacheKey", "prompt_cache_key"])
        .optional(),
    supportsExplicitPromptCacheMode: zod_1.z.boolean().optional(),
})
    .strict();
exports.endpointProtocolSchema = zod_1.z
    .object({
    format: zod_1.z.string().min(1).optional(),
    /**
     * Local module exporting the adapter for a custom format, resolved against
     * the workspace root. Present only for formats this package does not ship;
     * the built-in families need no module.
     */
    module: zod_1.z.string().min(1).optional(),
    /** Declared optional cache extensions; absent means none are used. */
    capabilities: exports.endpointCapabilitiesSchema.optional(),
    /**
     * How long this endpoint's prompt cache should be retained. A preference,
     * not a capability: asking for `long` on an endpoint that has not declared
     * `supportsLongCacheRetention` degrades to `short` rather than failing.
     */
    cacheRetention: zod_1.z.enum(["none", "short", "long"]).optional(),
})
    .strict();
exports.providerConfigSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    driver: zod_1.z.string().min(1),
    enabled: zod_1.z.boolean().default(true),
    connection: exports.providerConnectionSchema,
    requestDefaults: exports.providerRequestDefaultsSchema,
    protocol: exports.endpointProtocolSchema.optional(),
});
exports.modelOverrideRequestDefaultsSchema = zod_1.z
    .object({
    temperature: zod_1.z.number().min(0).max(2).nullable().default(null),
    topP: zod_1.z.number().min(0).max(1).nullable().default(null),
    // Optional on purpose: an unset field falls through to the provider's
    // connection-level request default instead of being pinned to `true`.
    stream: zod_1.z.boolean().optional(),
    thinkingEnabled: zod_1.z.boolean().optional(),
})
    .default({});
/**
 * User intent layered over the catalog. Keyed by the canonical
 * `${providerID}/${modelID}` ref, so a user can enable, rename or tune a
 * specific model without rewriting provider-returned catalog facts.
 */
exports.modelOverrideSchema = zod_1.z.object({
    enabled: zod_1.z.boolean().default(true),
    name: zod_1.z.string().min(1).optional(),
    requestDefaults: exports.modelOverrideRequestDefaultsSchema,
    requestOptions: zod_1.z.record(zod_1.z.unknown()).default({}),
    headers: zod_1.z.record(zod_1.z.string()).default({}),
    limits: exports.modelLimitsSchema.optional(),
});
/** A canonical model reference: `{provider, model}`. */
exports.modelRefSchema = zod_1.z
    .object({
    provider: zod_1.z.string().min(1),
    model: zod_1.z.string().min(1),
})
    .strict();
function modelRefKey(ref) {
    return "".concat(ref.provider, "/").concat(ref.model);
}
function parseModelRef(input) {
    var separator = input.indexOf("/");
    if (separator <= 0 || separator === input.length - 1)
        throw new Error("invalid model reference \"".concat(input, "\"; expected \"provider/model\""));
    return {
        provider: input.slice(0, separator),
        model: input.slice(separator + 1),
    };
}
exports.modeConfigSchema = zod_1.z.object({
    description: zod_1.z.string().default(""),
    model: zod_1.z.string().optional(),
    permission: zod_1.z.string().optional(),
    systemPrompt: zod_1.z.string().default(""),
    allowedTools: zod_1.z.array(zod_1.z.string()).default([]),
    excludedTools: zod_1.z.array(zod_1.z.string()).default([]),
    mcpServers: zod_1.z.array(zod_1.z.string()).default([]),
});
