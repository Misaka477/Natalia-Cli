import { runWithRetry, type RetryRunnerOptions } from "@natalia/runtime";
import type { RetryService } from "@natalia/runtime";

export function createRetryService(input: {
  policy(): RetryRunnerOptions["policy"];
}): RetryService {
  return {
    policy: input.policy,
    run: (context, fn, options = {}) =>
      runWithRetry(context, fn, { ...options, policy: input.policy() }),
  };
}
