import type { Plugin } from "@natalia/plugin";
import {
  createWorkLedgerController,
  type WorkLedgerController,
} from "../work-ledger-controller";

export const WORK_LEDGER_PLUGIN_ID = "natalia-work-ledger";
export const WORK_LEDGER_CONTROLLER_SERVICE = "work-ledger.controller";

export function createWorkLedgerPlugin(
  input: Parameters<typeof createWorkLedgerController>[0],
): Plugin {
  let controller: WorkLedgerController | undefined;
  return {
    manifest: {
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
    },
    setup(api) {
      controller = createWorkLedgerController(input);
      api.services.provide(WORK_LEDGER_CONTROLLER_SERVICE, controller);
    },
    dispose() {
      controller = undefined;
    },
  };
}
