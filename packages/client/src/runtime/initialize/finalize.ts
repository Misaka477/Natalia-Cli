import type { InitializeOptions, RuntimeContext } from "../context";
import { createInitializeRuntime } from "./runtime";

export async function finalizeInitialize(
  ctx: RuntimeContext,
  _options: InitializeOptions,
  {
    interrupted,
    sqliteRecovery,
  }: Awaited<ReturnType<typeof import("./session-recovery").recoverSession>>,
) {
  const scope = createInitializeRuntime(ctx);
  const session = scope.session;
  if (!session) throw new Error("session initialization did not complete");
  scope.publish({
    type: "session.created",
    sessionID: scope.sessionID,
    title: session.title,
  });
  if (scope.replayMode === "all")
    for (const event of session.events) scope.sink?.(event);
  if (sqliteRecovery)
    scope.interactive.restoreRecoveredInteractiveState(
      sqliteRecovery.approvals.filter(
        (request) =>
          !interrupted.some(
            (event) =>
              event.type === "approval.response" && event.id === request.id,
          ),
      ),
      sqliteRecovery.questions.filter(
        (request) =>
          !interrupted.some(
            (event) =>
              event.type === "question.response" && event.id === request.id,
          ),
      ),
    );
  else scope.interactive.restoreInteractiveState(session.events);
  if (scope.replayMode === "none") {
    const pending = sqliteRecovery
      ? {
          approvals: sqliteRecovery.approvals.filter(
            (request) =>
              !interrupted.some(
                (event) =>
                  event.type === "approval.response" && event.id === request.id,
              ),
          ),
          questions: sqliteRecovery.questions.filter(
            (request) =>
              !interrupted.some(
                (event) =>
                  event.type === "question.response" && event.id === request.id,
              ),
          ),
        }
      : scope.projectInteractiveRequests(session.events);
    for (const request of pending.approvals) scope.sink?.(request);
    for (const request of pending.questions) scope.sink?.(request);
  }
  if (scope.activeExec)
    await scope.initializeCheckpointController(scope.activeExec);
  // The exec is the turn's view of agent/model state; the closures were the
  // source of truth during init, so mirror them before any turn can run.
  if (scope.activeExec) {
    scope.activeExec.selectedAgent = scope.selectedAgent;
    scope.activeExec.selectedModel = scope.selectedModel;
    scope.activeExec.activeSkill = scope.activeSkill;
    scope.activeExec.permissionMode = scope.permissionMode;
    scope.activeExec.permissionProfile = scope.selectedPermissionProfile;
    scope.applyAgentProvider(scope.activeExec);
  }
  scope.publish({ type: "session.ready", sessionID: scope.sessionID });
  // The self-protection rules are the first constitution facts: migrate them
  // into the durable journal on every boot (idempotent — replay already holds
  // them) so `constitutionRules()` and the /constitution UI answer real rules,
  // not the empty projection CST1 shipped.
  for (const rule of scope.governanceLedgerController.seedConstitutionRules(
    session.events,
  )) {
    scope.publish(rule);
    // CST4 Work Graph linkage: each seeded rule is a `constraint` node, so
    // tool calls and drift findings can relate to it in the graph.
    scope.publish(
      scope.workLedgerController.constitutionRuleNode({
        ruleID: rule.ruleID,
        statement: rule.statement,
        sessionID: scope.sessionID,
      }),
    );
  }
  // Overrides are visible, not silent: a plugin that replaced a built-in
  // tool shows up in diagnostics so nobody discovers it by surprise.
  for (const override of scope.capabilityRegistry.overrides())
    scope.publish({
      type: "diagnostic",
      level: "warning",
      message: `capability "${override.winner}" (precedence ${override.winnerPrecedence}) replaced "${override.loser}" (precedence ${override.loserPrecedence}) for ${override.kind} "${override.name}"`,
    });
  scope.publishBuiltinCapabilities();
  scope.publishRegisteredTools();
  scope.publish(
    scope.contextStatusEvent(
      scope.runtimeContext.status(scope.runtimeContextConfig),
    ),
  );
  scope.publish(await scope.runtimeStatusSnapshot());
}
