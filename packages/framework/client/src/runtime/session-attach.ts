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
import {
  SESSION_STORE_CONTROLLER_SERVICE,
  STATUS_SNAPSHOT_CONTROLLER_SERVICE,
  TERMINAL_CONTROLLER_SERVICE,
  type SessionStoreController,
  type StatusSnapshotController,
  type TerminalController,
} from "@natalia/runtime-services";
import type { SessionID } from "@natalia/contracts";
import type { RuntimeContext } from "./context";

export function createSessionAttach(ctx: RuntimeContext) {
  return {
    attachSession,
  };

  async function attachSession(id: string) {
    const start = performance.now();
    const mark = (name: string) =>
      console.warn(
        `[perf] attachSession.${name} target=${id} +${(performance.now() - start).toFixed(1)}ms`,
      );
    console.warn(`[perf] attachSession start target=${id}`);
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
      ensureExecution,
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
    } = ctx.ports;
    await getReady();
    mark("ready");
    // D2: a running turn is no longer a reason to refuse. The turn belongs to
    // its own session's exec and keeps running in the background; attach only
    // switches which session the UI is attached to.
    const sessionStore = ctx.ports.resolveService<SessionStoreController>(
      SESSION_STORE_CONTROLLER_SERVICE,
    );
    if (!sessionStore)
      throw new Error("session store unavailable (natalia-session-store)");
    const terminal = ctx.ports.resolveService<TerminalController>(
      TERMINAL_CONTROLLER_SERVICE,
    );
    const status = ctx.ports.resolveService<StatusSnapshotController>(
      STATUS_SNAPSHOT_CONTROLLER_SERVICE,
    );
    if (!status) throw new Error("runtime UI unavailable (natalia-runtime-ui)");
    const sessionID = getSessionID();
    const nextID = id as SessionID;
    if (nextID === sessionID) {
      console.warn(
        `[perf] attachSession same target=${id} +${(performance.now() - start).toFixed(1)}ms`,
      );
      return { sessionID: nextID };
    }

    // A replacement runtime can open the old session as soon as attach returns.
    await getSessionPersistence();
    await sessionStore.flush(sessionID);
    mark("flush");
    // D2: the attached session becomes the activity exec. Its ledger is its
    // own — restoring into the shared one would clobber the previous session's
    // ledger, which a background turn may still be writing to.
    const exec = await ensureExecution(nextID);
    mark("ensureExecution");
    if (exec.session.metadata?.archived)
      throw new RuntimeRefusal("cannot attach an archived session");
    setSessionID(nextID);
    setSession(exec.session);
    setRuntimeContext(exec.context);
    setActiveExec(exec);
    setAttachmentReferences(exec.attachmentReferences);
    setToolCalls(exec.toolCalls);
    terminal?.setActiveSession(nextID);
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
    applyAgentProvider(exec);

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
    mark("projection");
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
      applyAgentProvider(exec);
    } else if (exec.selectedModel) {
      applyAgentProvider(exec);
    }
    mark("apply");
    // Checkpoint store initialization scans the workspace and may write a
    // baseline; it must not block the first visible attach. Let it run in the
    // background; checkpoint operations lazy-init again when actually needed.
    void initializeCheckpointController(exec).catch((error) => {
      publishForSession(exec, {
        type: "diagnostic",
        level: "warning",
        message: `checkpoint controller init deferred/failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    });
    mark("checkpoint");
    publishForSession(exec, {
      type: "session.ready",
      sessionID: exec.session.id,
    });
    mark("ready");
    publishForSession(
      exec,
      contextStatusEvent(exec.context.status(exec.runtimeContextConfig)),
    );
    mark("context");
    publishForSession(
      exec,
      await status.snapshotFor({
        provider: exec.provider,
        context: exec.context,
        permissionMode: exec.permissionMode,
      }),
    );
    mark("status");
    console.warn(
      `[perf] attachSession done target=${id} events=${exec.session.events.length} +${(performance.now() - start).toFixed(1)}ms`,
    );
    return { sessionID: exec.session.id };
  }
}
