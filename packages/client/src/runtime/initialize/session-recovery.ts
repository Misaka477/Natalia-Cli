import type {
  InitializeOptions,
  RuntimeContext,
  SessionExecutionState,
} from "../context";
import { createInitializeRuntime } from "./runtime";

export async function recoverSession(
  ctx: RuntimeContext,
  options: InitializeOptions,
) {
  const scope = createInitializeRuntime(ctx);
  if (scope.tsRuntimeConfig && scope.extensionEnabled("mcp")) {
    await scope.mcpService?.reload();
  }
  // Out-of-tree families declared by `scope.tools.paths` join the built-ins through
  // the same kernel, so they own their scope.tools the same way. They load here
  // because dynamic import is async and the built-in catalogue is assembled at
  // construction — before this point no config is resolved yet.
  await scope.terminalController?.init();
  scope.terminalController?.setActiveSession(scope.sessionID);

  await scope.sandboxController?.init();
  const storedSession = await scope.sessionStoreController?.load(
    scope.sessionID,
    {
      title: options.title,
      create: true,
      indexedRecovery: scope.replayMode === "none",
    },
  );
  scope.session = storedSession?.session;
  if (!scope.session)
    throw new Error("session initialization did not complete");
  if (options.title && !scope.session.metadata?.titleSource) {
    scope.session.metadata = {
      ...scope.session.metadata,
      titleSource: "manual",
    };
    await scope.sessionStoreController?.updateMetadata(scope.session, {
      titleSource: "manual",
    });
  }
  // D2: the startup scope.session is the first exec; the activity view (the
  // `scope.session`/`scope.runtimeContext` closures) aliases it until an attach switches.
  const initialExec: SessionExecutionState = {
    session: scope.session,
    context: scope.runtimeContext,
    attachmentReferences: scope.attachmentReferences,
    toolCalls: scope.toolCalls,
    provider: scope.provider,
    runtimeContextConfig: scope.runtimeContextConfig,
    permissionMode: scope.permissionMode,
    permissionProfile: scope.selectedPermissionProfile,
    paused: false,
    pauseWaiters: [],
  };
  scope.activeExec = initialExec;
  scope.executionBySession.set(scope.sessionID, initialExec);
  const sqliteRecovery = storedSession.recovery;
  const sqliteEpoch = storedSession.contextEpoch;
  // The startup exec was created before durable recovery replaced the scope.session
  // record. Point it at the recovered record, or per-scope.session reads through the
  // exec (durable metadata like `pendingHumanTerminal`, the inbox, the event
  // list) would silently see the pre-recovery shell instead of the restored
  // state.
  if (scope.activeExec) scope.activeExec.session = scope.session;
  await scope.attachmentService
    .cleanup(await scope.sessionStoreController.referencedAttachments())
    .catch((error) =>
      scope.publish({
        type: "diagnostic",
        level: "warning",
        message: `attachment cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
  const interruptedOperation = scope.session.metadata?.inFlightOperation;
  const interrupted = sqliteRecovery
    ? scope.settleInterruptedTurnIDs(
        sqliteRecovery.activeTurnIDs,
        sqliteRecovery.approvals.map((request) => request.id),
        sqliteRecovery.questions.map((request) => request.id),
      )
    : scope.settleInterruptedTurns(scope.session);
  const operationTurnWasInterrupted = Boolean(
    interruptedOperation &&
      interrupted.some(
        (event) =>
          event.type === "turn.finished" &&
          event.id === interruptedOperation.turnID,
      ),
  );
  if (interruptedOperation) {
    delete scope.session.metadata?.inFlightOperation;
    await scope.sessionStoreController?.updateMetadata(scope.session, {
      inFlightOperation: undefined,
    });
  }
  if (interrupted.length || interruptedOperation) {
    await scope.sessionStoreController?.appendEvents(
      scope.session,
      interrupted,
    );
    scope.publish({
      type: "diagnostic",
      level: "warning",
      message: operationTurnWasInterrupted
        ? `previous process stopped during ${interruptedOperation!.kind === "provider_dispatch" ? "provider dispatch" : "tool execution"}; the operation was safely settled as an error and cannot be replayed without an idempotency contract`
        : `previous process stopped during ${interrupted.filter((event) => event.type === "turn.finished").length} active turn(s); unresolved interactive requests were rejected because incomplete provider work cannot be replayed`,
    });
  }
  const projection = scope.projectSession(scope.session);
  const initialDiagnostics =
    scope.runtimeDiagnosticsBySession.get(scope.session.id) ?? [];
  for (const event of sqliteRecovery?.diagnostics ?? [])
    initialDiagnostics.push({
      ...event,
      at: event.at ?? scope.session.createdAt,
    });
  for (const event of projection.replayableEvents)
    if (event.type === "diagnostic")
      initialDiagnostics.push({
        ...event,
        at: event.at ?? scope.session.createdAt,
      });
  scope.runtimeDiagnosticsBySession.set(scope.session.id, initialDiagnostics);
  for (const event of projection.replayableEvents)
    if (event.type === "turn.submitted" && event.attachments?.length)
      scope.attachmentReferences.set(`${event.id}:user`, event.attachments);
  const selectedAgentName =
    sqliteRecovery?.selectedAgent ?? projection.selectedAgent;
  if (selectedAgentName) {
    const restored = scope.agentRegistry?.select(selectedAgentName);
    if (restored) {
      scope.selectedAgent = restored;
      scope.applyAgentPolicy();
      scope.applyAgentProvider();
    } else {
      scope.publish({
        type: "diagnostic",
        level: "warning",
        message: `persisted agent is no longer configured: ${selectedAgentName}`,
      });
    }
  }
  const recoveredModel =
    sqliteRecovery?.selectedModel ?? projection.selectedModel;
  if (recoveredModel) {
    scope.selectedModel = recoveredModel;
    scope.applyAgentProvider();
  }
  await scope.cleanupToolOutput(scope.workspaceRoot).catch((error) =>
    scope.publish({
      type: "diagnostic",
      level: "warning",
      message: `tool output cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
    }),
  );
  const latestContextCheckpoint = [...projection.replayableEvents]
    .reverse()
    .find((event) => event.type === "context.checkpoint");
  if (sqliteEpoch)
    scope.runtimeContext.restoreDurableCheckpoint(sqliteEpoch.snapshot);
  else if (latestContextCheckpoint)
    scope.runtimeContext.restoreDurableCheckpoint(
      latestContextCheckpoint.snapshot,
    );
  scope.contextLedgerFactory.restore(
    scope.runtimeContext,
    sqliteEpoch
      ? scope.sessionStoreController.contextEventsAfter(
          scope.sessionID,
          sqliteEpoch,
        )!
      : scope.modelVisibleEvents(projection.replayableEvents),
  );
  for (const [turnID, attachments] of sqliteRecovery?.attachments ?? [])
    scope.attachmentReferences.set(`${turnID}:user`, attachments);
  const [queued] = projection.pendingInputs.filter(
    (input) => input.delivery === "queue",
  );
  if (queued) void scope.turnCoordinator().wake(scope.drainSession);
  const activeSkillEntry = [...scope.runtimeContext.snapshot().entries]
    .reverse()
    .find((entry) => entry.role === "system" && entry.id.startsWith("skill:"));
  const qualifiedName = activeSkillEntry?.id.match(
    /^skill:((?:project|remote|user):[^:]+):/u,
  )?.[1];
  if (qualifiedName && scope.skillService()) {
    try {
      scope.activeSkill = scope.skillService()!.resolve(qualifiedName);
    } catch {
      // A removed skill must not prevent durable scope.session recovery.
    }
  }
  return { interrupted, sqliteRecovery };
}
