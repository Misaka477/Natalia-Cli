import type { WorkLedgerController } from "@natalia/runtime-services";
import { defineService } from "@natalia/runtime-services";

/** The work ledger controller token; lives with the mechanism. */
export const workLedgerController = defineService<WorkLedgerController>(
  "work-ledger.controller",
  { scope: "workspace", capability: "services" },
);
