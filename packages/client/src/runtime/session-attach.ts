/**
 * Session attachment — runtime/session-attach.ts.
 *
 * `attachSession` switches which session the UI is attached to: it flushes and
 * ensures the target session's execution state, then rewires the activity
 * closures to that exec while a background turn of the previous session keeps
 * running. Reads and writes host state through `RuntimeContext` ports.
 */
import { contextStatusEvent } from "@natalia/runtime";
import { projectSession } from "@natalia/session";
import { RuntimeRefusal } from "@natalia/contracts";
import type { SessionID } from "@natalia/contracts";
import type { RuntimeContext } from "./context";

export function createSessionAttach(ctx: RuntimeContext) {
  return {
    attachSession,
  };

  async function attachSession(id: string) {
    const {
      getReady,
      getSessionID,
      setSessionID,
      setSession,
      setRuntimeContext,
      setActiveExec,
      setAttachmentReferences,
      setToolCalls,
      getSessionPersistence,
      getSessionStoreController,
      ensureExecution,
      getTerminalController,
      setLastSubmitted,
      setActiveAbort,
      setActiveTurnID,
      setPaused,
      setPauseWaiters,
      setActiveSkill,
      setSelectedAgent,
      setSelectedModel,
      setPendingAgent,
      setLastProviderUsage,
      clearRuntimeDiagnostics,
      getRuntimeDiagnosticsBySession,
      setPermissionMode,
      setSelectedPermissionProfile,
      setProvider,
      getProvider,
      applyAgentPolicy,
      applyAgentProvider,
      initializeCheckpointController,
      publishForSession,
      getStatusController,
    } = ctx.ports;
    await getReady();
    // D2: a running turn is no longer a reason to refuse. The turn belongs to
    // its own session's exec and keeps running in the background; attach only
    // switches which session the UI is attached to.
    const sessionID = getSessionID();
    const nextID = id as SessionID;
    if (nextID === sessionID) return { sessionID: nextID };

    // A replacement runtime can open the old session as soon as attach returns.
    await getSessionPersistence();
    await getSessionStoreController()?.flush(sessionID);

    // D2: the attached session becomes the activity exec. Its ledger is its
    // own — restoring into the shared one would clobber the previous session's
    // ledger, which a background turn may still be writing to.
    const exec = await ensureExecution(nextID);
    if (exec.session.metadata?.archived)
      throw new RuntimeRefusal("cannot attach an archived session");
    setSessionID(nextID);
    setSession(exec.session);
    setRuntimeContext(exec.context);
    setActiveExec(exec);
    setAttachmentReferences(exec.attachmentReferences);
    setToolCalls(exec.toolCalls);
    getTerminalController()?.setActiveSession(nextID);
    setLastSubmitted(exec.lastSubmitted);
    setActiveAbort(exec.activeAbort);
    setActiveTurnID(exec.activeTurnID);
    setPaused(exec.paused);
    setPauseWaiters(exec.pauseWaiters);
    setActiveSkill(undefined);
    setSelectedAgent(undefined);
    setSelectedModel(undefined);
    setPendingAgent(undefined);
    setLastProviderUsage(undefined);
    clearRuntimeDiagnostics();
    applyAgentPolicy();
    applyAgentProvider();

    const projection = projectSession(exec.session);
    const diagnostics =
      getRuntimeDiagnosticsBySession().get(exec.session.id) ?? [];
    for (const event of projection.replayableEvents) {
      if (event.type === "diagnostic")
        diagnostics.push({
          ...event,
          at: event.at ?? exec.session.createdAt,
        });
    }
    getRuntimeDiagnosticsBySession().set(exec.session.id, diagnostics);
    // The exec already restored its own ledger, agent and model selection
    // (`ensureExecution`); here the activity closures take the same values so
    // UI reads and the next attach start from them.
    setSelectedAgent(exec.selectedAgent);
    setSelectedModel(exec.selectedModel);
    setActiveSkill(exec.activeSkill);
    setPermissionMode(exec.permissionMode);
    setSelectedPermissionProfile(exec.permissionProfile);
    setProvider(exec.provider ?? getProvider());
    if (exec.selectedAgent) {
      applyAgentPolicy();
      applyAgentProvider();
    } else if (exec.selectedModel) {
      applyAgentProvider();
    }
    await initializeCheckpointController(exec);
    publishForSession(exec, {
      type: "session.ready",
      sessionID: exec.session.id,
    });
    publishForSession(
      exec,
      contextStatusEvent(exec.context.status(exec.runtimeContextConfig)),
    );
    publishForSession(
      exec,
      await getStatusController().snapshotFor({
        provider: exec.provider,
        context: exec.context,
        permissionMode: exec.permissionMode,
      }),
    );
    return { sessionID: exec.session.id };
  }
}
