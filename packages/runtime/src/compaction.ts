import type { CompactionTrigger, RuntimeEvent } from "@natalia/contracts";
import { providerError, type ProviderError } from "./errors";
import {
  ContextLedger,
  estimateTokens,
  largeToolResultContext,
  preserveRecentWithToolPairs,
  type ContextEntry,
} from "./context";
import { runWithRetry, type RetryRunnerOptions } from "./retry";
import type { StreamingProvider } from "./provider";

export type CompactionInput = {
  entries: ContextEntry[];
  instruction?: string;
  resources: string[];
};

export type CompactionResult = {
  summary: string;
  tokens?: number;
};

export type Compactor = {
  compact(input: CompactionInput): Promise<CompactionResult>;
};

export function providerCompactor(provider: StreamingProvider): Compactor {
  return {
    async compact(input) {
      const prompt = [
        "Summarize this Natalia agent session for durable context compaction.",
        "Keep user goals, decisions, file/tool facts, unresolved tasks, and rollback-relevant state.",
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
      let summary = "";
      let tokens: number | undefined;
      for await (const chunk of provider.stream({
        messages: [
          {
            role: "system",
            content:
              "You compact long coding-agent context into a faithful, concise operational summary. Do not invent facts.",
          },
          { role: "user", content: prompt },
        ],
      })) {
        if (chunk.type === "content") summary += chunk.text;
        if (chunk.type === "usage")
          tokens = chunk.inputTokens + chunk.outputTokens;
      }
      if (!summary.trim())
        throw new Error("provider compactor returned empty summary");
      return { summary: summary.trim(), tokens };
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
  const beforeTokens = ledger.effectiveTokens();
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
          entries: snapshot.entries.map((entry) =>
            largeToolResultContext(entry),
          ),
          instruction: options.instruction,
          resources: snapshot.resources.map(
            (resource) => `${resource.kind}:${resource.id} ${resource.summary}`,
          ),
        }),
      { ...options.retry, onEvent },
    );
    const preserved = preserveRecentWithToolPairs(
      snapshot.entries,
      options.preservedRecentMessages,
    );
    const summary: ContextEntry = {
      id: `${options.id}:summary`,
      role: "summary",
      content: buildCompactionPrompt(result.summary, options.instruction),
      tokens: result.tokens ?? estimateTokens(result.summary),
    };
    ledger.replaceAfterCompaction(
      summary,
      preserved,
      result.tokens
        ? result.tokens +
            estimateTokens(preserved.map((entry) => entry.content).join("\n"))
        : undefined,
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
  runStep: () => Promise<T>;
  onEvent?: (event: RuntimeEvent) => void;
}) {
  try {
    return await input.runStep();
  } catch (error) {
    if (
      !(error instanceof Error) ||
      (error as ProviderError).kind !== "context_limit"
    )
      throw error;
    input.onEvent?.({
      type: "context.limit.recovery",
      id: input.id,
      step: input.step,
      attempted: true,
      compacted: false,
      reason: "context_limit",
    });
    await compactContext(input.ledger, input.compactor, {
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
      compacted: true,
      reason: "context_limit",
    });
    try {
      return await input.runStep();
    } catch (retryError) {
      if ((retryError as ProviderError).kind === "context_limit") {
        throw providerError({
          kind: "context_limit",
          message: "context-limit recovery already attempted",
          cause: retryError,
        });
      }
      throw retryError;
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
