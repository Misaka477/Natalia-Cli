/**
 * Input admission — runtime/session-admission.ts.
 *
 * `submitInput` admits a user turn to a session: it applies the team-mode
 * directive, stores attachments, builds the durable `turn.submitted` fact,
 * admits the input, wakes and runs the session's drain, and records the work
 * graph agent node. Reads host state through `RuntimeContext` at call time.
 */
import {
  admittedInputs,
  admitInput,
  buildSubmittedTurn,
  sessionRunCoordinator,
} from "@natalia/session";
import {
  ATTACHMENT_SERVICE,
  WORK_LEDGER_CONTROLLER_SERVICE,
  type AttachmentService,
  type WorkLedgerController,
} from "@natalia/runtime-services";
import type { SessionID, SubmitInput, SubmittedTurn } from "@natalia/contracts";
import type { RuntimeContext } from "./context";
import type { RealRuntimeClientOptions } from "./options";

export function createSessionAdmission(
  ctx: RuntimeContext,
  options: RealRuntimeClientOptions,
) {
  return {
    submitInput,
  };

  async function submitInput(
    input: SubmitInput & { internal?: boolean },
    forSessionID?: SessionID,
  ) {
    const {
      getReady,
      isDisposed,
      getSessionID,
      ensureExecution,
      teamBehavior,
      publishForSession,
      getSessionPersistence,
      getActiveExec,
      setLastSubmitted,
      rememberTitleInput,
      drainSessionFor,
    } = ctx.ports;
    const { turnSession } = ctx.state;
    await getReady();
    if (isDisposed()) throw new Error("runtime disposed");
    const attachmentService =
      ctx.ports.resolveService<AttachmentService>(ATTACHMENT_SERVICE);
    if (!attachmentService)
      throw new Error("attachment service unavailable (natalia-attachment)");
    const workLedger = ctx.ports.resolveService<WorkLedgerController>(
      WORK_LEDGER_CONTROLLER_SERVICE,
    );
    if (!workLedger)
      throw new Error("work ledger unavailable (natalia-work-ledger)");
    const targetSessionID = (input.sessionID ??
      forSessionID ??
      getSessionID()) as SessionID;
    const targetExec = await ensureExecution(targetSessionID);
    if (isDisposed()) throw new Error("runtime disposed");
    const targetSession = targetExec.session;
    let text = input.text;
    // /team <message>: the user explicitly requests the agent team. Inject the
    // forcing directive into the turn's context and run the rest as a normal
    // turn — the model must decompose and fan out instead of working
    // sequentially. Handled here (not as a slash command) so the turn runs
    // normally instead of nesting a submit inside a command.
    const activeTeamBehavior = teamBehavior();
    if (activeTeamBehavior && text.trim().startsWith("/team")) {
      const message = text.trim().slice("/team".length).trim();
      if (!message) throw new Error("/team requires a message after it");
      targetExec.context.add({
        id: `team-mode:${targetExec.context.journalStatus().journalOffset}`,
        role: "system",
        content: activeTeamBehavior.directive(),
      });
      text = message;
    }
    const attachments = input.attachments?.length
      ? await attachmentService.store(input.attachments)
      : [];
    if (isDisposed()) throw new Error("runtime disposed");
    const id = input.id ?? `turn_${crypto.randomUUID().replace(/-/gu, "")}`;
    const delivery = input.delivery ?? "next-step";
    const submitted: SubmittedTurn = buildSubmittedTurn({
      id,
      text,
      attachments,
      resources: input.resources,
      agents: input.agents,
      internal: input.internal,
      delivery,
    });
    if (attachments.length)
      targetExec?.attachmentReferences.set(`${id}:user`, attachments);
    if (!targetSession)
      throw new Error("session initialization did not complete");
    const existing = admittedInputs(targetSession).find(
      (item) => item.id === id,
    );
    admitInput(targetSession, {
      id,
      text,
      delivery,
      attachments,
      resources: input.resources,
      agents: input.agents,
      internal: input.internal,
    });
    const targetCoordinator = () => sessionRunCoordinator(targetSessionID);
    if (existing) {
      if (!existing.promotedAt && delivery === "next-step")
        void targetCoordinator().wake(drainSessionFor(targetSessionID));
      return submitted;
    }
    targetExec.lastSubmitted = submitted;
    if (targetExec === getActiveExec()) setLastSubmitted(submitted);
    turnSession.set(id, targetSessionID);
    // A `next-step` admitted while a turn is running is claimed by that turn's
    // provider loop and published as `turn.input`; announcing it as its own
    // turn here would create a phantom turn.
    const injectable =
      delivery === "next-step" && targetCoordinator().active;
    if (!injectable) publishForSession(targetExec, submitted);
    // One Work Graph node per turn. The prompt itself is not recorded: it can
    // contain anything, and the graph is replayable and shareable.
    publishForSession(
      targetExec,
      workLedger.agentActionNode({
        turnID: id,
        sessionID: targetSessionID,
        agent: targetExec?.selectedAgent?.name,
      }),
    );
    if (!input.internal) {
      rememberTitleInput(targetSessionID, text);
      ctx.state.initialize?.scheduleTitleGeneration?.(targetSessionID);
    }
    void targetCoordinator().wake(drainSessionFor(targetSessionID));
    return submitted;
  }
}
