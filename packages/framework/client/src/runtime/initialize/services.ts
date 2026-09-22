import type {
  AttachmentService,
  CompactionService,
  ContextLedgerFactory,
  GovernanceLedgerController,
  InitializeOptions,
  RetryService,
  RuntimeContext,
  SessionID,
  StatusSnapshotController,
  TurnController,
  WorkLedgerController,
} from "../context";
import { createInitializeRuntime } from "./runtime";

import { retryService } from "@natalia/retry";
import { compactionService } from "@natalia/compaction";
import { contextLedgerFactory } from "@natalia/context-ledger";
import { turnController } from "@natalia/turn-orchestration";

export async function resolveServices(
  ctx: RuntimeContext,
  options: InitializeOptions,
) {
  const scope = createInitializeRuntime(ctx);
  const resolvedAttachmentService =
    scope.capabilityRegistry.service<AttachmentService>(
      scope.ATTACHMENT_SERVICE,
    );
  if (!resolvedAttachmentService)
    throw new Error("attachment service unavailable (natalia-attachment)");
  // Resolution is fail-fast by construction: a missing binding throws with the
  // service id instead of being re-worded at every call site.
  scope.serviceDirectory.get(retryService);
  // Resolution is fail-fast by construction (see the retry check above).
  const resolvedContextLedgerFactory =
    scope.serviceDirectory.get(contextLedgerFactory);
  // Resolution is fail-fast by construction (see the retry check above).
  scope.serviceDirectory.get(compactionService);
  const resolvedStatusController =
    scope.capabilityRegistry.service<StatusSnapshotController>(
      scope.STATUS_SNAPSHOT_CONTROLLER_SERVICE,
    );
  if (!resolvedStatusController)
    throw new Error("runtime UI unavailable (natalia-runtime-ui)");
  scope.runtimeContext = resolvedContextLedgerFactory.create();
  const resolvedWorkLedgerController =
    scope.capabilityRegistry.service<WorkLedgerController>(
      scope.WORK_LEDGER_CONTROLLER_SERVICE,
    );
  if (!resolvedWorkLedgerController)
    throw new Error("work ledger unavailable (natalia-work-ledger)");
  const resolvedGovernanceLedgerController =
    scope.capabilityRegistry.service<GovernanceLedgerController>(
      scope.GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
    );
  if (!resolvedGovernanceLedgerController)
    throw new Error(
      "governance ledger unavailable (natalia-governance-ledger)",
    );
  // Resolution is fail-fast by construction (see the retry check above).
  scope.serviceDirectory.get(turnController);
  scope.sessionID =
    options.sessionID ??
    (`ses_${scope.sessionSeed(scope.workspaceRoot)}` as SessionID);
  const sessionStore = scope.resolveService<
    import("@natalia/runtime-services").SessionStoreController
  >(scope.SESSION_STORE_CONTROLLER_SERVICE);
  if (!sessionStore)
    throw new Error("session store unavailable (natalia-session-store)");
  await sessionStore.init();
  // T-2: the sandboxed sub-agent path. A sub-agent spawned with
  // `mode: "sandbox"` gets its own sandbox worktree — its file scope.tools operate
  // in that worktree, not the parent's workspace — and the turn loop is
  // otherwise the same (same strength, reduced authority via the tool
  // domain). It is a new path; the shared-context loop below stays untouched.
  // The concurrent fan-out cap (`team.maxConcurrent`) is enforced here, at
  // the work itself, not at the spawn call.
}
