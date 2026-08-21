import type { CompactionTrigger, RuntimeEvent } from "@natalia/contracts";
import {
  compactContext,
  compactionTrigger,
  providerError,
  providerCompactor,
  type StreamingProvider,
} from "@natalia/runtime";
import type { RuntimeContextLedger } from "./context-ledger-factory";
import type { RetryService } from "./retry-service";

export type CompactionBudget = {
  max: number;
  thresholdPercent: number;
  reserved: number;
};

export type CompactionOutcome = Awaited<ReturnType<typeof compactContext>>;

type CompactionOperation = {
  compactionID: string;
  ledger: RuntimeContextLedger;
  provider: StreamingProvider;
  budget: CompactionBudget;
  preservedRecentMessages: number;
  instruction: string;
  signal?: AbortSignal;
  onEvent?: (event: RuntimeEvent) => void;
};

export type CompactionService = {
  compactBeforeProviderStep(
    input: CompactionOperation & { usedTokens: number; enabled: boolean },
  ): Promise<CompactionOutcome & { trigger?: CompactionTrigger }>;
  runWithContextLimitRecovery<T>(
    input: CompactionOperation & {
      id: string;
      step: number;
      runStep(): Promise<T>;
      beforeRetry?(outcome: CompactionOutcome): void | Promise<void>;
      onCompacted?(outcome: CompactionOutcome): void | Promise<void>;
    },
  ): Promise<T>;
};

export function createCompactionService(input: {
  retry: RetryService;
}): CompactionService {
  const compact = (
    operation: CompactionOperation,
    trigger: CompactionTrigger,
    options?: { enabled?: boolean; force?: boolean; beforeTokens?: number },
  ) =>
    compactContext(
      operation.ledger,
      providerCompactor(operation.provider, operation.signal),
      {
        id: operation.compactionID,
        trigger,
        maxTokens: operation.budget.max,
        thresholdPercent: operation.budget.thresholdPercent,
        reservedTokens: operation.budget.reserved,
        preservedRecentMessages: operation.preservedRecentMessages,
        instruction: operation.instruction,
        onEvent: operation.onEvent,
        retry: { policy: input.retry.policy(), signal: operation.signal },
        ...options,
      },
    );

  return {
    async compactBeforeProviderStep(operation) {
      const trigger = compactionTrigger({
        used: operation.usedTokens,
        max: operation.budget.max,
        thresholdPercent: operation.budget.thresholdPercent,
        reserved: operation.budget.reserved,
      });
      if (!trigger)
        return { compacted: false, skipped: "nothing_to_compact" as const };
      return {
        ...(await compact(operation, trigger, {
          enabled: operation.enabled,
          beforeTokens: operation.usedTokens,
        })),
        trigger,
      };
    },
    async runWithContextLimitRecovery(operation) {
      try {
        return await operation.runStep();
      } catch (error) {
        if ((error as { kind?: string }).kind !== "context_limit") throw error;
        operation.onEvent?.({
          type: "context.limit.recovery",
          id: operation.id,
          step: operation.step,
          attempted: true,
          compacted: false,
          reason: "context_limit",
        });
        const outcome = await compact(operation, "context_limit", {
          force: true,
        });
        if (outcome.compacted === true) await operation.onCompacted?.(outcome);
        operation.onEvent?.({
          type: "context.limit.recovery",
          id: operation.id,
          step: operation.step,
          attempted: true,
          compacted: outcome.compacted,
          reason: "context_limit",
        });
        await operation.beforeRetry?.(outcome);
        try {
          return await operation.runStep();
        } catch (retryError) {
          if ((retryError as { kind?: string }).kind === "context_limit")
            throw providerError({
              kind: "context_limit",
              message: "context-limit recovery already attempted",
              cause: retryError,
            });
          throw retryError;
        }
      }
    },
  };
}
