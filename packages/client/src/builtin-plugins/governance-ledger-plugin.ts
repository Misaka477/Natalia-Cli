import type { Plugin } from "@natalia/plugin";
import {
  createGovernanceLedgerController,
  type GovernanceLedgerController,
} from "../governance-ledger-controller";
import {
  WORK_LEDGER_CONTROLLER_SERVICE,
  WORK_LEDGER_PLUGIN_ID,
} from "./work-ledger-plugin";

export const GOVERNANCE_LEDGER_PLUGIN_ID = "natalia-governance-ledger";
export const GOVERNANCE_LEDGER_CONTROLLER_SERVICE =
  "governance-ledger.controller";

export function createGovernanceLedgerPlugin(): Plugin {
  let controller: GovernanceLedgerController | undefined;
  return {
    manifest: {
      apiVersion: 2,
      id: GOVERNANCE_LEDGER_PLUGIN_ID,
      version: "1.0.0",
      name: "Governance Ledger",
      description: "Constitution, decision, evidence and completion writers.",
      entry: "natalia:governance-ledger",
      scope: "workspace",
      provides: [GOVERNANCE_LEDGER_CONTROLLER_SERVICE],
      requires: [WORK_LEDGER_CONTROLLER_SERVICE],
      optionalRequires: [],
      conflicts: [],
      dependencies: [
        {
          id: WORK_LEDGER_PLUGIN_ID,
          spec: ">=1.0.0",
          optional: false,
          peer: false,
        },
      ],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      if (!api.services.get(WORK_LEDGER_CONTROLLER_SERVICE))
        throw new Error("work ledger unavailable (natalia-work-ledger)");
      controller = createGovernanceLedgerController();
      api.services.provide(GOVERNANCE_LEDGER_CONTROLLER_SERVICE, controller);
    },
    dispose() {
      controller = undefined;
    },
  };
}
