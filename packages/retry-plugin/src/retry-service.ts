import {
  runWithRetry,
  type RetryAttemptContext,
  type RetryContext,
  type RetryRunnerOptions,
} from "@natalia/runtime";

export type RetryService = {
  policy(): RetryRunnerOptions["policy"];
  run<T>(
    context: RetryContext,
    fn: (attempt: RetryAttemptContext) => Promise<T>,
    options?: Omit<RetryRunnerOptions, "policy">,
  ): Promise<T>;
};

export function createRetryService(input: {
  policy(): RetryRunnerOptions["policy"];
}): RetryService {
  return {
    policy: input.policy,
    run: (context, fn, options = {}) =>
      runWithRetry(context, fn, { ...options, policy: input.policy() }),
  };
}
