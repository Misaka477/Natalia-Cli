import type { GovernanceLedgerController } from "@natalia/runtime-services";
import { defineService } from "@natalia/runtime-services";

/** The governance ledger controller token; lives with the mechanism. */
export const governanceLedgerController =
  defineService<GovernanceLedgerController>("governance-ledger.controller", {
    scope: "workspace",
    capability: "services",
  });
