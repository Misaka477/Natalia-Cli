/**
 * The product-policy half of the runtime context (master plan P3,
 * decisions §1.1/§1.2: policy stays @natalia, substrate is product-free).
 *
 * `context.ts` is substrate material — it must know no policy package.
 * The eight policy-state fields (domain sequence counters and the collab
 * wake registry) and the policy type re-exports live HERE; modules that
 * touch them widen their context parameter to `ProductRuntimeContext`,
 * which is exactly how the mechanism/policy boundary shows up per module:
 * the compiler draws it, and the substrate-purity guard keeps the core
 * file clean as extraction proceeds.
 */
import type { RuntimeContext, RuntimeState } from "./context";

/** Policy-owned mutable state: per-domain sequence counters + wake tasks. */
export type ProductRuntimeState = {
  evidenceSequence: number;
  decisionSequence: number;
  mailboxSequence: number;
  chatSequence: number;
  collabSequence: number;
  planSequence: number;
  completionSequence: number;
  internalWakeTasks: Set<Promise<unknown>>;
};

/** The context as the composition root actually builds it: generic + policy. */
export type ProductRuntimeContext = Omit<RuntimeContext, "state"> & {
  state: RuntimeState & ProductRuntimeState;
};

export type { ContextLedgerFactory } from "@natalia/context-ledger";
export type { RuntimeContextLedger } from "@natalia/context-ledger";
export type { GovernanceLedgerController } from "@natalia/governance-ledger";
export type { WorkLedgerController } from "@natalia/work-ledger";
