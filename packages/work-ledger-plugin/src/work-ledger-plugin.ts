import type { Plugin, PluginManifest } from "@natalia/plugin";
import { createWorkLedgerController } from "./work-ledger-controller";
import {
  WORK_LEDGER_CONTROLLER_SERVICE,
  type WorkLedgerController,
} from "@natalia/runtime-services";

export const WORK_LEDGER_PLUGIN_ID = "natalia-work-ledger";
export const WORK_LEDGER_PLUGIN_MANIFEST: PluginManifest = {
  apiVersion: 2,
  id: WORK_LEDGER_PLUGIN_ID,
  version: "1.0.0",
  name: "Work Ledger",
  description: "Plan, drift and work graph event writers.",
  entry: "natalia:work-ledger",
  scope: "workspace",
  provides: [WORK_LEDGER_CONTROLLER_SERVICE],
  requires: [],
  optionalRequires: [],
  conflicts: [],
  dependencies: [],
  hooks: {},
  integrationPoints: ["services"],
};
export function createWorkLedgerPlugin(
  input: Parameters<typeof createWorkLedgerController>[0],
): Plugin {
  let controller: WorkLedgerController | undefined;
  return {
    manifest: WORK_LEDGER_PLUGIN_MANIFEST,
    setup(api) {
      controller = createWorkLedgerController(input);
      api.services.provide(WORK_LEDGER_CONTROLLER_SERVICE, controller);
    },
    dispose() {
      controller = undefined;
    },
  };
}
