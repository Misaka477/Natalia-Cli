import { CONTEXT_LEDGER_PLUGIN_ID } from "@natalia/context-ledger-plugin";
import type { Plugin, PluginManifest } from "@natalia/plugin";
import { RETRY_PLUGIN_ID } from "@natalia/retry-plugin";
import {
  COMPACTION_SERVICE,
  CONTEXT_LEDGER_FACTORY_SERVICE,
  RETRY_SERVICE,
  type RetryService,
} from "@natalia/runtime-services";
import { createCompactionService } from "./compaction-service";

export const COMPACTION_PLUGIN_ID = "natalia-compaction";
export const COMPACTION_PLUGIN_MANIFEST: PluginManifest = {
  apiVersion: 2,
  id: COMPACTION_PLUGIN_ID,
  version: "1.0.0",
  name: "Compaction",
  description: "Context compaction and context-limit recovery.",
  entry: "natalia:compaction",
  scope: "workspace",
  provides: [COMPACTION_SERVICE],
  requires: [RETRY_SERVICE, CONTEXT_LEDGER_FACTORY_SERVICE],
  optionalRequires: [],
  conflicts: [],
  dependencies: [
    { id: RETRY_PLUGIN_ID, spec: ">=1.0.0", optional: false, peer: false },
    {
      id: CONTEXT_LEDGER_PLUGIN_ID,
      spec: ">=1.0.0",
      optional: false,
      peer: false,
    },
  ],
  hooks: {},
  integrationPoints: ["services"],
};

export function createCompactionPlugin(): Plugin {
  return {
    manifest: COMPACTION_PLUGIN_MANIFEST,
    setup(api) {
      const retry = api.services.get<RetryService>(RETRY_SERVICE);
      if (!retry) throw new Error("retry service unavailable (natalia-retry)");
      if (!api.services.get(CONTEXT_LEDGER_FACTORY_SERVICE))
        throw new Error("context ledger unavailable (natalia-context-ledger)");
      api.services.provide(
        COMPACTION_SERVICE,
        createCompactionService({ retry }),
      );
    },
  };
}
