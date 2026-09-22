import type { RuntimeEvent } from "@natalia/contracts";
import type { ContextLedger } from "@natalia/runtime";

/** Context ledger contracts, moved from runtime-services with the token. */

export interface ContextLedgerFactory {
  create(): RuntimeContextLedger;
  restore(context: RuntimeContextLedger, events: RuntimeEvent[]): void;
}

export type RuntimeContextLedger = ContextLedger;
