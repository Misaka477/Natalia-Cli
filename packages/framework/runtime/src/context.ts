import type {
  CompactionTrigger,
  LocalAttachment,
  ContextStatusSource,
  RuntimeEvent,
} from "@natalia/contracts";

export type ContextRole =
  | "system"
  | "user"
  | "assistant"
  | "tool_call"
  | "tool_result"
  | "dynamic"
  | "resource"
  | "summary";

export type ContextEntry = {
  id: string;
  role: ContextRole;
  content: string;
  tokens?: number;
  pairID?: string;
  artifactRef?: string;
  attachments?: LocalAttachment[];
  reasoningContent?: string;
  reasoningField?: string;
  reasoningSignature?: string;
  reasoningRedacted?: boolean;
  /** Gemini thought signature attached to a non-thought text part. */
  textSignature?: string;
  /** Gemini thought signature attached to a tool_call entry. */
  thoughtSignature?: string;
};

export type ExactUsageCheckpoint = {
  messageCount: number;
  tokens: number;
  inputTokens?: number;
  outputTokens?: number;
  source: "provider_usage" | "estimate";
};

export type ContextLedgerSnapshot = {
  entries: ContextEntry[];
  checkpoint?: ExactUsageCheckpoint;
  resources: ResourceSnapshot[];
};

export type DurableContextCheckpoint = ContextLedgerSnapshot & {
  journalOffset: number;
  step: number;
  tokenEstimate: number;
  compactionGeneration: number;
};

export type ContextStatus = {
  used: number;
  max: number;
  source: ContextStatusSource;
  thresholdPercent: number;
  reserved: number;
  trigger?: CompactionTrigger;
};

export type ResourceSnapshot = {
  kind:
    | "background"
    | "process"
    | "agent"
    | "terminal"
    | "sandbox"
    | "workflow"
    | "skill";
  id: string;
  summary: string;
};

export type ToolResultPruneOptions = {
  thresholdChars: number;
  headChars: number;
  tailChars: number;
  /**
   * Number of newest entries exempt from pruning. The default keeps the most
   * recent tool result intact while old tool output is reduced.
   */
  protectRecentEntries: number;
};

export const DEFAULT_TOOL_RESULT_PRUNE_OPTIONS: ToolResultPruneOptions = {
  thresholdChars: 8192,
  headChars: 4096,
  tailChars: 1024,
  protectRecentEntries: 1,
};

export type ToolResultPruneOutcome = {
  pruned: number;
  beforeTokens: number;
  afterTokens: number;
};

export type ReservedResolverInput = {
  contextWindow: number;
  explicitMaxOutputTokens?: number | null;
  configuredReserved: number | "auto";
  providerOutputLimit?: number;
  catalogOutputLimit?: number;
};

export type ReservedResolution = {
  tokens: number;
  source:
    | "config"
    | "provider_metadata"
    | "explicit_output"
    | "catalog"
    | "fallback_formula";
  diagnostic: string;
};

export class ContextLedger {
  private entries: ContextEntry[] = [];
  private checkpoint?: ExactUsageCheckpoint;
  private resources: ResourceSnapshot[] = [];
  private journalOffset = 0;
  private compactionGeneration = 0;
  private revision = 0;

  /** Monotonic entry-surface revision used to detect concurrent appends. */
  surfaceRevision(): number {
    return this.revision;
  }

  add(entry: ContextEntry) {
    this.entries.push({
      ...entry,
      tokens: entry.tokens ?? estimateTokens(entry.content),
    });
    this.journalOffset += 1;
    this.revision += 1;
  }

  addMany(entries: ContextEntry[]) {
    for (const entry of entries) this.add(entry);
  }

  addResource(resource: ResourceSnapshot) {
    this.resources = this.resources.filter((item) => item.id !== resource.id);
    this.resources.push(resource);
    this.add({
      id: `resource:${resource.id}`,
      role: "resource",
      content: `${resource.kind}:${resource.id} ${resource.summary}`,
    });
  }

  recordProviderUsage(inputTokens: number, outputTokens: number) {
    this.checkpoint = {
      messageCount: this.entries.length,
      tokens: inputTokens + outputTokens,
      inputTokens,
      outputTokens,
      source: "provider_usage",
    };
    this.journalOffset += 1;
  }

  effectiveTokens() {
    if (!this.checkpoint)
      return this.entries.reduce((sum, entry) => sum + (entry.tokens ?? 0), 0);
    const pending = this.entries
      .slice(this.checkpoint.messageCount)
      .reduce((sum, entry) => sum + (entry.tokens ?? 0), 0);
    return this.checkpoint.tokens + pending;
  }

  /**
   * Deterministically trims old large tool results in-place before a provider
   * request. Journal events remain untouched; only this live ledger surface is
   * replaced, and the exact provider checkpoint is degraded to an estimate
   * because the prior usage no longer describes this transformed surface.
   */
  pruneToolResults(
    options: Partial<ToolResultPruneOptions> = {},
  ): ToolResultPruneOutcome {
    const resolved = { ...DEFAULT_TOOL_RESULT_PRUNE_OPTIONS, ...options };
    const beforeTokens = this.effectiveTokens();
    const protect = Math.max(0, Math.floor(resolved.protectRecentEntries));
    const cutoff = Math.max(0, this.entries.length - protect);
    let pruned = 0;
    this.entries = this.entries.map((entry, index) => {
      if (index >= cutoff) return entry;
      const candidate = pruneToolResultEntry(entry, resolved);
      if (candidate !== entry) pruned += 1;
      return candidate;
    });
    if (!pruned) return { pruned: 0, beforeTokens, afterTokens: beforeTokens };
    const tokens = this.entries.reduce(
      (sum, entry) => sum + (entry.tokens ?? estimateTokens(entry.content)),
      0,
    );
    this.checkpoint = {
      messageCount: this.entries.length,
      tokens,
      source: "estimate",
    };
    this.revision += 1;
    return {
      pruned,
      beforeTokens,
      afterTokens: this.effectiveTokens(),
    };
  }

  status(input: {
    max: number;
    thresholdPercent: number;
    reserved: number;
  }): ContextStatus {
    const used = this.effectiveTokens();
    const trigger = compactionTrigger({
      used,
      max: input.max,
      thresholdPercent: input.thresholdPercent,
      reserved: input.reserved,
    });
    return {
      used,
      max: input.max,
      source:
        this.checkpoint?.source === "provider_usage" &&
        this.entries.length === this.checkpoint.messageCount
          ? "exact_checkpoint"
          : "pending_estimate",
      thresholdPercent: input.thresholdPercent,
      reserved: input.reserved,
      trigger,
    };
  }

  snapshot(): ContextLedgerSnapshot {
    return {
      entries: this.entries.map((entry) => ({ ...entry })),
      checkpoint: this.checkpoint ? { ...this.checkpoint } : undefined,
      resources: this.resources.map((resource) => ({ ...resource })),
    };
  }

  durableCheckpoint(step: number): DurableContextCheckpoint {
    return {
      ...this.snapshot(),
      journalOffset: this.journalOffset,
      step,
      tokenEstimate: this.effectiveTokens(),
      compactionGeneration: this.compactionGeneration,
    };
  }

  restore(snapshot: ContextLedgerSnapshot) {
    this.entries = snapshot.entries.map((entry) => ({ ...entry }));
    this.checkpoint = snapshot.checkpoint
      ? { ...snapshot.checkpoint }
      : undefined;
    this.resources = snapshot.resources.map((resource) => ({ ...resource }));
    if (
      "journalOffset" in snapshot &&
      typeof snapshot.journalOffset === "number"
    )
      this.journalOffset = snapshot.journalOffset;
    else this.journalOffset = this.entries.length;
    if (
      "compactionGeneration" in snapshot &&
      typeof snapshot.compactionGeneration === "number"
    )
      this.compactionGeneration = snapshot.compactionGeneration;
    this.revision += 1;
  }

  restoreDurableCheckpoint(checkpoint: DurableContextCheckpoint) {
    this.restore(checkpoint);
    this.journalOffset = checkpoint.journalOffset;
    this.compactionGeneration = checkpoint.compactionGeneration;
  }

  journalStatus() {
    return {
      journalOffset: this.journalOffset,
      messageCount: this.entries.length,
      tokenEstimate: this.effectiveTokens(),
      compactionGeneration: this.compactionGeneration,
    };
  }

  replaceAfterCompaction(
    summary: ContextEntry,
    preserved: ContextEntry[],
    estimatedTokens?: number,
    expectedRevision?: number,
  ) {
    if (expectedRevision !== undefined && this.revision !== expectedRevision)
      throw new Error("context surface changed during compaction");
    this.entries = [
      summary,
      ...preserved,
      ...this.resources.map(resourceToContextEntry),
    ];
    this.checkpoint = {
      messageCount: this.entries.length,
      tokens:
        estimatedTokens ??
        this.entries.reduce((sum, entry) => sum + (entry.tokens ?? 0), 0),
      source: "estimate",
    };
    this.compactionGeneration += 1;
    this.journalOffset += 1;
    this.revision += 1;
  }
}

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(Array.from(text).length / 4));
}

export function compactionTrigger(input: {
  used: number;
  max: number;
  thresholdPercent: number;
  reserved: number;
}): CompactionTrigger | undefined {
  if (input.used >= Math.floor((input.max * input.thresholdPercent) / 100))
    return "ratio";
  if (input.used + input.reserved >= input.max) return "reserved";
  return undefined;
}

export function resolveReservedOutputTokens(
  input: ReservedResolverInput,
): ReservedResolution {
  if (typeof input.configuredReserved === "number") {
    return {
      tokens: input.configuredReserved,
      source: "config",
      diagnostic: "explicit context.reservedOutputTokens",
    };
  }
  if (input.explicitMaxOutputTokens && input.explicitMaxOutputTokens > 0) {
    return {
      tokens: input.explicitMaxOutputTokens,
      source: "explicit_output",
      diagnostic: "explicit model.maxOutputTokens",
    };
  }
  if (input.providerOutputLimit && input.providerOutputLimit > 0) {
    return {
      tokens: input.providerOutputLimit,
      source: "provider_metadata",
      diagnostic: "provider output metadata",
    };
  }
  if (input.catalogOutputLimit && input.catalogOutputLimit > 0) {
    return {
      tokens: input.catalogOutputLimit,
      source: "catalog",
      diagnostic: "known model output catalog",
    };
  }
  const tokens = Math.min(
    20_000,
    Math.max(4_096, Math.floor(input.contextWindow * 0.1)),
  );
  return {
    tokens,
    source: "fallback_formula",
    diagnostic: "conservative formula min(20000,max(4096,context*0.1))",
  };
}

export function contextStatusEvent(status: ContextStatus): RuntimeEvent {
  return { type: "context.status", ...status };
}

function closeToolPairs(
  entries: ContextEntry[],
  preserved: ContextEntry[],
): ContextEntry[] {
  const pairIDs = new Set(
    preserved.map((entry) => entry.pairID).filter(Boolean) as string[],
  );
  const seenPairRoles = new Set<string>();
  const missingPairs = entries.filter((entry) => {
    if (!entry.pairID || !pairIDs.has(entry.pairID)) return false;
    if (preserved.some((item) => item.id === entry.id)) return false;
    // A malformed ledger can contain two calls or two results for one pair.
    // Close each side at most once so the rebuilt provider request never has a
    // duplicate tool_call_id.
    const key = `${entry.pairID}:${entry.role}`;
    if (seenPairRoles.has(key)) return false;
    seenPairRoles.add(key);
    return true;
  });
  return [...missingPairs, ...preserved];
}

export function preserveRecentWithToolPairs(
  entries: ContextEntry[],
  recentCount: number,
) {
  return closeToolPairs(
    entries,
    entries.slice(Math.max(0, entries.length - recentCount)),
  );
}

/**
 * Retains the newest suffix that fits a token budget. At least the newest
 * entry is retained even when it alone exceeds the budget, so compaction never
 * drops the current step's context. Tool-call/result pairs are closed after the
 * budget cut, which may add a bounded number of older entries.
 */
export function preserveRecentWithToolPairsByTokens(
  entries: ContextEntry[],
  tokenBudget: number,
): ContextEntry[] {
  if (tokenBudget <= 0) return [];
  let start = entries.length;
  let tokens = 0;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]!;
    const entryTokens = entry.tokens ?? estimateTokens(entry.content);
    if (start < entries.length && tokens + entryTokens > tokenBudget) break;
    tokens += entryTokens;
    start = index;
  }
  return closeToolPairs(entries, entries.slice(start));
}

const TOOL_RESULT_PRUNE_MARKER = "tool result truncated for context";

export function pruneToolResultEntry(
  entry: ContextEntry,
  options: ToolResultPruneOptions = DEFAULT_TOOL_RESULT_PRUNE_OPTIONS,
): ContextEntry {
  if (
    entry.role !== "tool_result" ||
    entry.content.length <= options.thresholdChars ||
    entry.content.includes(TOOL_RESULT_PRUNE_MARKER)
  )
    return entry;
  const head = entry.content.slice(0, options.headChars);
  const tail = entry.content.slice(-options.tailChars);
  const omittedChars = entry.content.length - head.length - tail.length;
  const content = `${head}\n\n[${TOOL_RESULT_PRUNE_MARKER}; originalChars=${entry.content.length}; omittedChars=${omittedChars}]\n\n${tail}`;
  if (content.length >= entry.content.length) return entry;
  return { ...entry, content, tokens: undefined };
}

export function largeToolResultContext(
  entry: ContextEntry,
  maxInlineChars = 2000,
): ContextEntry {
  if (entry.role !== "tool_result" || entry.content.length <= maxInlineChars)
    return entry;
  const head = entry.content.slice(0, Math.floor(maxInlineChars / 2));
  const tail = entry.content.slice(-Math.floor(maxInlineChars / 2));
  return {
    ...entry,
    content: `${head}\n\n[tool result stored as artifact ${entry.artifactRef ?? entry.id}; totalChars=${entry.content.length}]\n\n${tail}`,
    tokens: undefined,
  };
}

function resourceToContextEntry(resource: ResourceSnapshot): ContextEntry {
  return {
    id: `resource:${resource.id}`,
    role: "resource",
    content: `${resource.kind}:${resource.id} ${resource.summary}`,
  };
}
