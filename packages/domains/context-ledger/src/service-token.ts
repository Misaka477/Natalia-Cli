import type { ContextLedgerFactory } from "@natalia/runtime-services";
import { defineService } from "@natalia/runtime-services";

/** The context ledger factory token; lives with the mechanism. */
export const contextLedgerFactory = defineService<ContextLedgerFactory>(
  "context-ledger.factory",
  { scope: "workspace", capability: "services" },
);
