import type { Plugin, PluginManifest } from "@natalia/plugin";
import type { RetryRunnerOptions } from "@natalia/runtime";
import { createRetryService } from "./retry-service";
import { RETRY_SERVICE } from "@natalia/runtime-services";

export const RETRY_PLUGIN_ID = "natalia-retry";
export const RETRY_PLUGIN_MANIFEST: PluginManifest = {
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
};

export function createRetryPlugin(input: {
  policy(): RetryRunnerOptions["policy"];
}): Plugin {
  return {
    manifest: RETRY_PLUGIN_MANIFEST,
    setup(api) {
      api.services.provide(RETRY_SERVICE, createRetryService(input));
    },
  };
}
