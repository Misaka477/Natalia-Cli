import type { Plugin } from "@natalia/plugin";
import { createRetryService } from "../retry-service";
import type { RetryRunnerOptions } from "@natalia/runtime";

export type { RetryService } from "../retry-service";

export const RETRY_PLUGIN_ID = "natalia-retry";
export const RETRY_SERVICE = "retry.service";

export function createRetryPlugin(input: {
  policy(): RetryRunnerOptions["policy"];
}): Plugin {
  return {
    manifest: {
      apiVersion: 2,
      id: RETRY_PLUGIN_ID,
      version: "1.0.0",
      name: "Retry",
      description: "Provider retry policy and execution lifecycle.",
      entry: "natalia:retry",
      scope: "workspace",
      provides: [RETRY_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      api.services.provide(RETRY_SERVICE, createRetryService(input));
    },
  };
}
