import type { RuntimeEvent } from "@natalia/contracts";
import type { RetryRunnerOptions } from "@natalia/runtime";
import {
  compactContext,
  decideCompaction,
  providerCompactor,
  selectCompactableRange,
  type CompactionDecision,
  type ContextEntry,
  type ContextLedger,
  type ProviderMessage,
  type RequestEnvelope,
  type StreamingProvider,
  type TokenMeasurement,
  type TokenMeter,
  type ToolResultPruneOptions,
} from "@natalia/runtime";

/**
 * Identity-free preflight pipeline shared by the main, subagent, Navi and Nia
 * request paths. It owns the canonical order:
 *
 *   construct envelope -> measure -> decide -> (prune -> rebuild -> remeasure ->
 *   decide) -> (summarize -> rebuild -> remeasure) -> emit context surface.
 *
 * The path supplies only what is genuinely path-shaped: the outbound messages,
 * a `rebuildOutbound` that re-derives them from the (possibly rewritten) ledger,
 * and the event sink. No channel/stream identity is threaded through, and no
 * path re-derives its own trigger budget or hand-stitches `usedTokens`.
 */
export type PrepareContextRequestInput = {
  /** Stable id prefix for compaction / checkpoint events. */
  id: string;
  /** Current step index, used only to keep the compaction event id unique. */
  step?: number;
  ledger: ContextLedger;
  meter: TokenMeter;
  /** TokenMeter scope; distinct per stream, never a shared channel. */
  scope: string;
  /** Canonical request envelope header (system + tools). */
  system: string | undefined;
  tools: unknown;
  /** Capacity of the route/model for this request. */
  contextWindow: number;
  budget: { max: number; thresholdPercent: number; reserved: number };
  preserve: { recentMessages?: number; recentTokens?: number };
  /**
   * The outbound provider messages about to be sent. The pipeline measures
   * this first, then replaces it via `rebuildOutbound` after prune/compaction.
   */
  outbound: ProviderMessage[];
  /**
   * Re-derive the outbound messages from the (possibly rewritten) ledger. The
   * path closes over whatever stateful restoration it needs (reasoning fields,
   * runtime-context re-injection, live user turns). `phase` distinguishes the
   * model-free prune rebuild from the post-summarization rebuild.
   */
  rebuildOutbound: (
    entries: ContextEntry[],
    phase: "prune" | "compact",
  ) => ProviderMessage[];
  /** When provided, model-free tool-result pruning runs before deciding. */
  pruneOptions?: Partial<ToolResultPruneOptions>;
  /** Active provider used to build the summarizer for this request. */
  provider: StreamingProvider;
  prefixMessages?: ProviderMessage[];
  instruction?: string;
  compactionEnabled?: boolean;
  signal?: AbortSignal;
  /** Retry policy for the summarizer; the service supplies it when wired. */
  retry?: RetryRunnerOptions;
  /** Event sink for compaction.begin/end events. */
  publish: (event: RuntimeEvent) => void;
  /**
   * Emit the stream-namespaced context.status surface after each measurement.
   * The pipeline calls this with the fresh three-bucket measurement; the path
   * decides whether and how to publish (main emits context.status, subagent
   * emits nothing here).
   */
  emitStatus: (measured: TokenMeasurement) => void;
  /** Emit the stream-namespaced context.snapshot surface after each measurement. */
  emitSnapshot: (measured: TokenMeasurement) => void;
  /** Invoked after a successful summarization (e.g. to emit a durable checkpoint). */
  onCompacted?: () => void;
  now?: () => Date;
};

export type PrepareContextRequestResult = {
  /** Outbound messages to send to the provider (post prune/compaction). */
  outbound: ProviderMessage[];
  decision: CompactionDecision;
  compacted: boolean;
  pruned: number;
  /** Final measured full-request tokens. */
  used: number;
};

export async function prepareContextRequest(
  input: PrepareContextRequestInput,
): Promise<PrepareContextRequestResult> {
  const { ledger, meter, scope, budget, preserve } = input;
  let outbound = input.outbound;

  const measure = (): TokenMeasurement =>
    meter.measureRequest(scope, {
      system: input.system,
      tools: input.tools,
      messages: outbound,
      contextWindow: input.contextWindow,
    });

  const hasCompactableRange = () =>
    selectCompactableRange(ledger.snapshot().entries, preserve).hasRange;

  const decide = (measured: TokenMeasurement): CompactionDecision =>
    decideCompaction({
      requestTokens: measured.totalTokens,
      headerTokens: measured.headerTokens,
      surfaceTokens: measured.messageTokens,
      max: budget.max,
      reserved: budget.reserved,
      thresholdPercent: budget.thresholdPercent,
      hasCompactableRange: hasCompactableRange(),
    });

  const publishSurface = (measured: TokenMeasurement) => {
    input.emitStatus(measured);
    input.emitSnapshot(measured);
  };

  let pruned = 0;

  // Model-free prune is cheap and keeps old tool results bounded on every
  // step (the main path's established behaviour); only the expensive LLM
  // summarize is gated behind the decision below.
  if (input.pruneOptions) {
    const outcome = ledger.pruneToolResults(input.pruneOptions);
    pruned = outcome.pruned;
    if (pruned > 0)
      outbound = input.rebuildOutbound(ledger.snapshot().entries, "prune");
  }

  let measured = measure();
  let decision = decide(measured);

  publishSurface(measured);

  if (decision === "none" || decision === "nothing_to_compact") {
    return { outbound, decision, compacted: false, pruned, used: measured.totalTokens };
  }

  const outcome = await compactContext(ledger, providerCompactor(input.provider, input.signal), {
    id: `${input.id}:preflight:${input.step ?? 0}`,
    trigger: decision === "ratio" ? "ratio" : "reserved",
    maxTokens: budget.max,
    thresholdPercent: budget.thresholdPercent,
    reservedTokens: budget.reserved,
    preservedRecentMessages: preserve.recentMessages ?? 10,
    ...(preserve.recentTokens === undefined
      ? {}
      : { preservedRecentTokens: preserve.recentTokens }),
    ...(input.prefixMessages ? { prefixMessages: input.prefixMessages } : {}),
    ...(input.instruction ? { instruction: input.instruction } : {}),
    ...(input.compactionEnabled === undefined
      ? {}
      : { enabled: input.compactionEnabled }),
    beforeTokens: measured.totalTokens,
    retry: { ...(input.retry ?? {}), signal: input.signal },
    onEvent: input.publish,
    now: input.now,
  });

  if (outcome.compacted) {
    // The provider usage anchor described the pre-compaction surface; drop it
    // so the re-measure prices the rewritten request instead of reusing a
    // stale (now-too-large) sample.
    meter.clear(scope);
    outbound = input.rebuildOutbound(ledger.snapshot().entries, "compact");
    measured = measure();
    input.onCompacted?.();
    publishSurface(measured);
  }

  return {
    outbound,
    decision,
    compacted: outcome.compacted,
    pruned,
    used: measured.totalTokens,
  };
}

/** Exported for tests and callers that build the envelope shape directly. */
export type { RequestEnvelope };
