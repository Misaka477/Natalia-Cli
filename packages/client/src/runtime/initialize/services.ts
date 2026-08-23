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
  scope.attachmentService = resolvedAttachmentService;
  const resolvedRetryService = scope.capabilityRegistry.service<RetryService>(
    scope.RETRY_SERVICE,
  );
  if (!resolvedRetryService)
    throw new Error("retry service unavailable (natalia-retry)");
  scope.retryService = resolvedRetryService;
  const resolvedContextLedgerFactory =
    scope.capabilityRegistry.service<ContextLedgerFactory>(
      scope.CONTEXT_LEDGER_FACTORY_SERVICE,
    );
  if (!resolvedContextLedgerFactory)
    throw new Error("context ledger unavailable (natalia-context-ledger)");
  scope.contextLedgerFactory = resolvedContextLedgerFactory;
  const resolvedCompactionService =
    scope.capabilityRegistry.service<CompactionService>(
      scope.COMPACTION_SERVICE,
    );
  if (!resolvedCompactionService)
    throw new Error("compaction service unavailable (natalia-compaction)");
  scope.compactionService = resolvedCompactionService;
  const resolvedStatusController =
    scope.capabilityRegistry.service<StatusSnapshotController>(
      scope.STATUS_SNAPSHOT_CONTROLLER_SERVICE,
    );
  if (!resolvedStatusController)
    throw new Error("runtime UI unavailable (natalia-runtime-ui)");
  scope.statusController = resolvedStatusController;
  scope.runtimeContext = scope.contextLedgerFactory.create();
  const resolvedWorkLedgerController =
    scope.capabilityRegistry.service<WorkLedgerController>(
      scope.WORK_LEDGER_CONTROLLER_SERVICE,
    );
  if (!resolvedWorkLedgerController)
    throw new Error("work ledger unavailable (natalia-work-ledger)");
  scope.workLedgerController = resolvedWorkLedgerController;
  const resolvedGovernanceLedgerController =
    scope.capabilityRegistry.service<GovernanceLedgerController>(
      scope.GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
    );
  if (!resolvedGovernanceLedgerController)
    throw new Error(
      "governance ledger unavailable (natalia-governance-ledger)",
    );
  scope.governanceLedgerController = resolvedGovernanceLedgerController;
  const resolvedTurnController =
    scope.capabilityRegistry.service<TurnController>(
      scope.TURN_CONTROLLER_SERVICE,
    );
  if (!resolvedTurnController)
    throw new Error(
      "turn orchestration unavailable (natalia-turn-orchestration)",
    );
  scope.turnController = resolvedTurnController;
  scope.sessionID =
    options.sessionID ??
    (`ses_${scope.sessionSeed(scope.workspaceRoot)}` as SessionID);
  await scope.sessionStoreController?.init();
  // T-2: the sandboxed sub-agent path. A sub-agent spawned with
  // `mode: "sandbox"` gets its own sandbox worktree — its file scope.tools operate
  // in that worktree, not the parent's workspace — and the turn loop is
  // otherwise the same (same strength, reduced authority via the tool
  // domain). It is a new path; the shared-context loop below stays untouched.
  // The concurrent fan-out cap (`team.maxConcurrent`) is enforced here, at
  // the work itself, not at the spawn call.
}
