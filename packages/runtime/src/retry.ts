import type { RuntimeEvent, StepRetryOperation } from "@natalia/contracts";
import {
  asProviderError,
  redactedProviderMessage,
  type ProviderError,
} from "./errors";

export type RetryTimer = (ms: number) => Promise<void>;
export type RetryRandom = () => number;

export type RetryPolicy = {
  maxAttemptsPerStep: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  jitterMs: number;
  maxRetryAfterMs: number;
};

export type RetryContext = {
  id: string;
  operation: StepRetryOperation;
  step: number;
};

export type RetryRunnerOptions = {
  policy?: Partial<RetryPolicy>;
  timer?: RetryTimer;
  random?: RetryRandom;
  onEvent?: (event: RuntimeEvent) => void;
};

export type RetryAttemptContext = {
  attempt: number;
  maxAttempts: number;
};

export const defaultRetryPolicy: RetryPolicy = {
  maxAttemptsPerStep: 3,
  initialBackoffMs: 300,
  maxBackoffMs: 5000,
  jitterMs: 500,
  maxRetryAfterMs: 5000,
};

export function shouldRetryProviderError(error: ProviderError) {
  if (error.kind === "timeout") return true;
  if (error.kind === "connection") return true;
  if (error.kind === "empty_response") return true;
  if (error.kind === "rate_limit") return true;
  if (error.kind === "server") return true;
  return false;
}

export function retryDelayMs(
  error: ProviderError,
  retryIndex: number,
  policy: RetryPolicy = defaultRetryPolicy,
  random: RetryRandom = Math.random,
) {
  const retryAfter = error.retryAfterMs;
  if (retryAfter !== undefined)
    return Math.min(retryAfter, policy.maxRetryAfterMs);
  const exponential =
    policy.initialBackoffMs * 2 ** Math.max(0, retryIndex - 1);
  const base = Math.min(exponential, policy.maxBackoffMs);
  const jitter =
    policy.jitterMs > 0 ? Math.floor(random() * (policy.jitterMs + 1)) : 0;
  return Math.min(base + jitter, policy.maxBackoffMs);
}

export async function runWithRetry<T>(
  context: RetryContext,
  fn: (attempt: RetryAttemptContext) => Promise<T>,
  options: RetryRunnerOptions = {},
) {
  const policy = { ...defaultRetryPolicy, ...options.policy };
  const timer = options.timer ?? ((ms) => Bun.sleep(ms));
  const random = options.random ?? Math.random;
  let lastError: ProviderError | undefined;

  for (let attempt = 1; attempt <= policy.maxAttemptsPerStep; attempt++) {
    try {
      const result = await fn({
        attempt,
        maxAttempts: policy.maxAttemptsPerStep,
      });
      if (attempt > 1) {
        options.onEvent?.({
          type: "step.retry.cleared",
          id: context.id,
          operation: context.operation,
          step: context.step,
          attempts: attempt,
        });
      }
      return result;
    } catch (error) {
      const providerError = asProviderError(error);
      lastError = providerError;
      const canRetry = shouldRetryProviderError(providerError);
      if (!canRetry || attempt >= policy.maxAttemptsPerStep) {
        options.onEvent?.({
          type: "step.retry.exhausted",
          id: context.id,
          operation: context.operation,
          step: context.step,
          attempts: attempt,
          maxAttempts: policy.maxAttemptsPerStep,
          reason: providerError.kind,
          statusCode: providerError.statusCode,
          message: redactedProviderMessage(providerError),
        });
        throw providerError;
      }
      const waitMs = retryDelayMs(providerError, attempt, policy, random);
      options.onEvent?.({
        type: "step.retry",
        id: context.id,
        operation: context.operation,
        step: context.step,
        attempt: attempt + 1,
        maxAttempts: policy.maxAttemptsPerStep,
        waitMs,
        reason: providerError.kind,
        statusCode: providerError.statusCode,
      });
      await timer(waitMs);
    }
  }

  throw lastError ?? new Error("retry runner exhausted without an error");
}

export async function runStreamingWithRetry(
  context: RetryContext,
  fn: (
    attempt: RetryAttemptContext,
    emitTransient: (chunk: string) => void,
  ) => Promise<string[]>,
  options: RetryRunnerOptions & {
    onCommit?: (chunk: string, attempt: number) => void;
  } = {},
) {
  return runWithRetry(
    context,
    async (attempt) => {
      const transient: string[] = [];
      const committed = await fn(attempt, (chunk) => transient.push(chunk));
      const output = committed.length ? committed : transient;
      for (const chunk of output) options.onCommit?.(chunk, attempt.attempt);
      return output;
    },
    options,
  );
}
