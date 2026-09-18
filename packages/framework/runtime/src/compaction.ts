import type { CompactionTrigger, RuntimeEvent } from "@natalia/contracts";
import { providerError, type ProviderError } from "./errors";
import {
  ContextLedger,
  estimateTokens,
  largeToolResultContext,
  selectCompactableRange,
  type ContextEntry,
} from "./context";
import { runWithRetry, type RetryRunnerOptions } from "./retry";
import type { ProviderMessage, StreamingProvider } from "./provider";

const COMPACTION_SUMMARY_TEMPLATE = `Use exactly this Markdown structure and keep every section:
## Objective
- The user's current goal.

## Important Details
- Constraints, decisions and reasons, exact identifiers, and facts needed to continue.

## Work State
### Completed
- Finished and verified work.

### Active
- Work currently in progress.

### Blocked
- Blockers, failures, and unresolved unknowns.

## Next Move
1. The immediate concrete action.

## Relevant Files
- Exact path: why it matters.

Use terse bullets. Write "(none)" when a section has no content.`;

export type CompactionInput = {
  entries: ContextEntry[];
  instruction?: string;
  resources: string[];
  /**
   * Optional prefix from the routed request. The system prompt is reused so a
   * provider that supports prefix caching can avoid paying to re-read it.
   */
  prefixMessages?: ProviderMessage[];
};

export type CompactionResult = {
  summary: string;
  /** Optional estimate of the compacted summary itself, never API request usage. */
  tokens?: number;
};

export type Compactor = {
  compact(input: CompactionInput): Promise<CompactionResult>;
};

export function providerCompactor(
  provider: StreamingProvider,
  signal?: AbortSignal,
): Compactor {
  return {
    async compact(input) {
      const prompt = [
        "Summarize this Natalia agent session for durable context compaction.",
        "Keep user goals, decisions, file/tool facts, unresolved tasks, and rollback-relevant state.",
        "If the entries contain an earlier summary, update that anchor: retain still-true details, remove stale details, and merge newer facts.",
        "Preserve exact file paths, symbols, commands, errors, URLs, and identifiers. Do not invent facts or mention the compaction process.",
        COMPACTION_SUMMARY_TEMPLATE,
        input.instruction
          ? `Extra instruction: ${input.instruction}`
          : undefined,
        input.resources.length
          ? `Active resources:\n${input.resources.join("\n")}`
          : undefined,
        "Session entries:",
        input.entries
          .map((entry) => `${entry.role}: ${entry.content}`)
          .join("\n\n"),
      ]
        .filter(Boolean)
        .join("\n\n");
      const systemContent =
        input.prefixMessages?.find((message) => message.role === "system")
          ?.content ??
        "You compact long coding-agent context into a faithful, concise operational summary. Do not invent facts.";
      let summary = "";
      for await (const chunk of provider.stream({
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: prompt },
        ],
        signal,
      })) {
        if (chunk.type === "content") summary += chunk.text;
      }
      if (!summary.trim())
        throw new Error("provider compactor returned empty summary");
      return { summary: summary.trim() };
    },
  };
}

export type CompactionOptions = {
  id: string;
  trigger: CompactionTrigger;
  maxTokens: number;
  thresholdPercent: number;
  reservedTokens: number;
  preservedRecentMessages: number;
  preservedRecentTokens?: number;
  prefixMessages?: ProviderMessage[];
  beforeTokens?: number;
  instruction?: string;
  enabled?: boolean;
  force?: boolean;
  now?: () => Date;
  onEvent?: (event: RuntimeEvent) => void;
  retry?: RetryRunnerOptions;
};

export async function compactContext(
  ledger: ContextLedger,
  compactor: Compactor,
  options: CompactionOptions,
) {
  if (
    options.enabled === false &&
    !options.force &&
    options.trigger !== "manual"
  ) {
    return { compacted: false, skipped: "disabled" as const };
  }
  const snapshot = ledger.snapshot();
  const expectedRevision = ledger.surfaceRevision();
  const { preserved, compactable: compactedEntries, hasRange } =
    selectCompactableRange(snapshot.entries, {
      ...(options.preservedRecentTokens === undefined
        ? {}
        : { recentTokens: options.preservedRecentTokens }),
      recentMessages: options.preservedRecentMessages,
    });
  if (!hasRange)
    return { compacted: false, skipped: "nothing_to_compact" as const };
  const preservedIDs = new Set(preserved.map((entry) => entry.id));
  const retained = preserved.filter((entry) => entry.role !== "resource");
  const beforeTokens = options.beforeTokens ?? ledger.effectiveTokens();
  const started = options.now?.() ?? new Date();
  options.onEvent?.({
    type: "compaction.begin",
    id: options.id,
    trigger: options.trigger,
    beforeTokens,
    maxTokens: options.maxTokens,
    thresholdPercent: options.thresholdPercent,
    reservedTokens: options.reservedTokens,
    instruction: options.instruction,
    attempt: 1,
    startedAt: started.toISOString(),
  });
  let attempts = 1;
  const onEvent = (event: RuntimeEvent) => {
    if (event.type === "step.retry" && event.operation === "compaction")
      attempts = event.attempt;
    options.onEvent?.(event);
  };
  try {
    const result = await runWithRetry(
      { id: options.id, operation: "compaction", step: 0 },
      async () =>
        compactor.compact({
          entries: compactedEntries.map((entry) =>
            largeToolResultContext(entry),
          ),
          instruction: options.instruction,
          ...(options.prefixMessages
            ? { prefixMessages: options.prefixMessages }
            : {}),
          // Active resources are re-injected as live entries after compaction;
          // summarizing them too would show the model stale duplicate state.
          resources: [],
        }),
      { ...options.retry, onEvent },
    );
    if (ledger.surfaceRevision() !== expectedRevision) {
      options.onEvent?.({
        type: "compaction.end",
        id: options.id,
        trigger: options.trigger,
        success: false,
        beforeTokens,
        durationMs: Math.max(
          0,
          (options.now?.() ?? new Date()).getTime() - started.getTime(),
        ),
        attempts,
        error: "surface_changed",
      });
      return { compacted: false, skipped: "surface_changed" as const };
    }
    const content = buildCompactionPrompt(result.summary, options.instruction);
    const summary: ContextEntry = {
      id: `${options.id}:summary`,
      role: "summary",
      content,
      tokens: result.tokens ?? estimateTokens(content),
    };
    ledger.replaceAfterCompaction(
      summary,
      retained,
      undefined,
      expectedRevision,
    );
    const afterTokens = ledger.effectiveTokens();
    options.onEvent?.({
      type: "compaction.end",
      id: options.id,
      trigger: options.trigger,
      success: true,
      beforeTokens,
      afterTokens,
      durationMs: Math.max(
        0,
        (options.now?.() ?? new Date()).getTime() - started.getTime(),
      ),
      attempts,
    });
    return { compacted: true, beforeTokens, afterTokens };
  } catch (error) {
    ledger.restore(snapshot);
    const provider = error as ProviderError;
    options.onEvent?.({
      type: "compaction.end",
      id: options.id,
      trigger: options.trigger,
      success: false,
      beforeTokens,
      durationMs: Math.max(
        0,
        (options.now?.() ?? new Date()).getTime() - started.getTime(),
      ),
      attempts,
      error: provider.kind ?? "compaction_failed",
    });
    throw error;
  }
}

export async function recoverContextLimitOnce<T>(input: {
  id: string;
  step: number;
  ledger: ContextLedger;
  compactor: Compactor;
  compact: Omit<CompactionOptions, "trigger" | "force">;
  maxOverflowRetries?: number;
  runStep: () => Promise<T>;
  onEvent?: (event: RuntimeEvent) => void;
}) {
  const maxRetries = Math.max(0, Math.floor(input.maxOverflowRetries ?? 1));
  let retries = 0;
  while (true) {
    try {
      return await input.runStep();
    } catch (error) {
      if (
        !(error instanceof Error) ||
        (error as ProviderError).kind !== "context_limit"
      )
        throw error;
      if (retries >= maxRetries)
        throw providerError({
          kind: "context_limit",
          message: `context-limit recovery retries exhausted (${retries})`,
          cause: error,
        });
      retries += 1;
      input.onEvent?.({
        type: "context.limit.recovery",
        id: input.id,
        step: input.step,
        attempted: true,
        compacted: false,
        reason: "context_limit",
      });
      const compacted = await compactContext(input.ledger, input.compactor, {
        ...input.compact,
        trigger: "context_limit",
        force: true,
        onEvent: input.onEvent,
      });
      input.onEvent?.({
        type: "context.limit.recovery",
        id: input.id,
        step: input.step,
        attempted: true,
        compacted: compacted.compacted,
        reason: "context_limit",
      });
    }
  }
}

export function buildCompactionPrompt(summary: string, instruction?: string) {
  return [
    "Natalia compacted context summary:",
    instruction ? `User compaction instruction: ${instruction}` : undefined,
    summary,
  ]
    .filter(Boolean)
    .join("\n\n");
}
