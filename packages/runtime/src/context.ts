import type {
  CompactionTrigger,
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
};

export type ExactUsageCheckpoint = {
  messageCount: number;
  tokens: number;
  inputTokens?: number;
  outputTokens?: number;
  source: "provider_usage";
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
    | "pty"
    | "sandbox"
    | "workflow"
    | "skill";
  id: string;
  summary: string;
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

  add(entry: ContextEntry) {
    this.entries.push({
      ...entry,
      tokens: entry.tokens ?? estimateTokens(entry.content),
    });
    this.journalOffset += 1;
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
        this.checkpoint && this.entries.length === this.checkpoint.messageCount
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
  ) {
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
      source: "provider_usage",
    };
    this.compactionGeneration += 1;
    this.journalOffset += 1;
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
  if (input.providerOutputLimit && input.providerOutputLimit > 0) {
    return {
      tokens: input.providerOutputLimit,
      source: "provider_metadata",
      diagnostic: "provider output metadata",
    };
  }
  if (input.explicitMaxOutputTokens && input.explicitMaxOutputTokens > 0) {
    return {
      tokens: input.explicitMaxOutputTokens,
      source: "explicit_output",
      diagnostic: "explicit model.maxOutputTokens",
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
    50_000,
    Math.max(8192, Math.floor(input.contextWindow * 0.25)),
  );
  return {
    tokens,
    source: "fallback_formula",
    diagnostic: "conservative formula min(50000,max(8192,context*0.25))",
  };
}

export function contextStatusEvent(status: ContextStatus): RuntimeEvent {
  return { type: "context.status", ...status };
}

export function preserveRecentWithToolPairs(
  entries: ContextEntry[],
  recentCount: number,
) {
  const preserved = entries.slice(Math.max(0, entries.length - recentCount));
  const pairIDs = new Set(
    preserved.map((entry) => entry.pairID).filter(Boolean) as string[],
  );
  const missingPairs = entries.filter(
    (entry) =>
      entry.pairID &&
      pairIDs.has(entry.pairID) &&
      !preserved.some((item) => item.id === entry.id),
  );
  return [...missingPairs, ...preserved];
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
