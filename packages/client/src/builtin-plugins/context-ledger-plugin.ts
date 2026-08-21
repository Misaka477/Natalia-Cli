import type { Plugin } from "@natalia/plugin";
import {
  createContextLedgerFactory,
  type ContextLedgerFactory,
} from "../context-ledger-factory";

export const CONTEXT_LEDGER_PLUGIN_ID = "natalia-context-ledger";
export const CONTEXT_LEDGER_FACTORY_SERVICE = "context-ledger.factory";

export function createContextLedgerPlugin(): Plugin {
  let factory: ContextLedgerFactory | undefined;
  return {
    manifest: {
      apiVersion: 2,
      id: CONTEXT_LEDGER_PLUGIN_ID,
      version: "1.0.0",
      name: "Context Ledger",
      description: "Context ledger construction and durable event recovery.",
      entry: "natalia:context-ledger",
      scope: "workspace",
      provides: [CONTEXT_LEDGER_FACTORY_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      factory = createContextLedgerFactory();
      api.services.provide(CONTEXT_LEDGER_FACTORY_SERVICE, factory);
    },
    dispose() {
      factory = undefined;
    },
  };
}
