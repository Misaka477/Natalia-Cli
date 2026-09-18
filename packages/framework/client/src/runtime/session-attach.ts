/**
 * Session attachment — runtime/session-attach.ts.
 *
 * `attachSession` switches which session the UI is attached to: it flushes and
 * ensures the target session's execution state, then rewires the activity
 * closures to that exec while a background turn of the previous session keeps
 * running. Reads and writes host state through `RuntimeContext` ports.
 */
import { contextStatusEvent, type TokenMeterMessage } from "@natalia/runtime";
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
import {
  naviChatProviderMessagesFromHistory,
  niaChatProviderMessagesFromHistory,
} from "./collaboration/chat-turn-common";
import { perfLog } from "@natalia/runtime-services";

export function createSessionAttach(ctx: RuntimeContext) {
  return {
    attachSession,
  };

  async function seedStreamContextSnapshots(
    exec: import("./context").SessionExecutionState,
  ) {
    // Seed stream meters from the current session window. A consumer that
    // truly needs older snapshots must call the shared full-event escape hatch
    // explicitly; attach must not force a full journal load on every switch.
    const meter = exec.tokenMeter;
    const latestSnapshot = (
      channel: "navi" | "nia" | undefined,
      agentID?: string,
    ) => {
      for (let index = exec.session.events.length - 1; index >= 0; index -= 1) {
        const event = exec.session.events[index];
        if (
          event?.type === "context.snapshot" &&
          event.channel === channel &&
          event.agentID === agentID
        )
          return event;
      }
      return undefined;
    };
    const publishSnapshot = (data: {
      channel?: "navi" | "nia";
      agentID?: string;
      usedTokens: number;
      pressureTokens?: number;
      projectedTokens?: number;
      contextWindow?: number;
      source: "estimate" | "provider_usage";
    }) => {
      ctx.ports.publishForSession(exec, {
        type: "context.snapshot",
        ...data,
        at: new Date().toISOString(),
      });
    };
    const publishExistingSnapshot = (snapshot: {
      channel?: "navi" | "nia";
      agentID?: string;
      usedTokens: number;
      pressureTokens?: number;
      projectedTokens?: number;
      contextWindow?: number;
      source: "estimate" | "provider_usage";
    }) =>
      publishSnapshot({
        ...(snapshot.channel ? { channel: snapshot.channel } : {}),
        ...(snapshot.agentID ? { agentID: snapshot.agentID } : {}),
        usedTokens: snapshot.usedTokens,
        ...(snapshot.pressureTokens === undefined
          ? {}
          : { pressureTokens: snapshot.pressureTokens }),
        ...(snapshot.projectedTokens === undefined
          ? {}
          : { projectedTokens: snapshot.projectedTokens }),
        ...(snapshot.contextWindow === undefined
          ? {}
          : { contextWindow: snapshot.contextWindow }),
        source: snapshot.source,
      });
    const chatContextWindow = async (channel: "navi" | "nia") => {
      const config = ctx.ports.getTsRuntimeConfig();
      const profile =
        channel === "navi"
          ? exec.naviChatModelProfile?.normal
          : exec.niaChatModelProfile?.normal;
      if (!config || !exec.provider) return exec.runtimeContextConfig.max;
      try {
        const budget = await ctx.ports.resolveContextStatusConfig(
          config,
          exec.provider,
          ctx.ports.getContextWindowResolver(),
          ctx.ports.modelRefKeyForSelection(undefined, profile),
        );
        return budget.max;
      } catch {
        return exec.runtimeContextConfig.max;
      }
    };
    for (const channel of ["navi", "nia"] as const) {
      const existing = latestSnapshot(channel);
      // Attach no longer replays the full durable log, so an existing durable
      // snapshot must be re-published to the live sink or the UI would never
      // see it after a restart. Republish it verbatim instead of inventing a
      // fresh estimate; if it lacks a context window the meter cannot render,
      // so fall through and compute a usable one below.
      if (existing && (existing.contextWindow ?? 0) > 0) {
        publishExistingSnapshot(existing);
        continue;
      }
      const messages =
        channel === "navi"
          ? naviChatProviderMessagesFromHistory(exec)
          : niaChatProviderMessagesFromHistory(exec);
      if (!messages.length) continue;
      const streamMeter =
        channel === "navi" ? exec.naviTokenMeter : exec.niaTokenMeter;
      const contextWindow = await chatContextWindow(channel);
      streamMeter.measureRequest("stream", {
        tools: undefined,
        messages,
        contextWindow,
      });
      const projection = streamMeter.project("stream");
      publishSnapshot({
        channel,
        usedTokens:
          projection.projectedTokens ??
          projection.pressureTokens ??
          streamMeter.estimateMessages(messages),
        ...(projection.pressureTokens === undefined
          ? {}
          : { pressureTokens: projection.pressureTokens }),
        ...(projection.projectedTokens === undefined
          ? {}
          : { projectedTokens: projection.projectedTokens }),
        contextWindow,
        source: projection.source,
      });
    }

    const byAgent = new Map<string, TokenMeterMessage[]>();
    for (const event of exec.session.events) {
      if (!event.agentID) continue;
      const messages = byAgent.get(event.agentID) ?? [];
      byAgent.set(event.agentID, messages);
      if (
        (event.type === "content.done" || event.type === "thinking.done") &&
        event.text
      ) {
        messages.push({ role: "assistant", content: event.text });
      } else if (event.type === "tool.update") {
        messages.push({
          role: "assistant",
          content: [
            event.name,
            event.summary,
            event.argumentsDelta ?? "",
            event.result ?? "",
          ]
            .filter(Boolean)
            .join("\n"),
        });
      }
    }
    for (const [agentID, messages] of byAgent) {
      const existing = latestSnapshot(undefined, agentID);
      if (existing && (existing.contextWindow ?? 0) > 0) {
        publishExistingSnapshot(existing);
        continue;
      }
      if (!messages.length) continue;
      const scope = `subagent:${agentID}`;
      meter.observeSurface(scope, messages);
      meter.measureRequest(scope, {
        messages,
        contextWindow: exec.runtimeContextConfig.max,
      });
      const projection = meter.project(scope);
      publishSnapshot({
        agentID,
        usedTokens:
          projection.projectedTokens ??
          projection.pressureTokens ??
          meter.estimateMessages(messages),
        ...(projection.pressureTokens === undefined
          ? {}
          : { pressureTokens: projection.pressureTokens }),
        ...(projection.projectedTokens === undefined
          ? {}
          : { projectedTokens: projection.projectedTokens }),
        contextWindow: exec.runtimeContextConfig.max,
        source: projection.source,
      });
    }
  }

  async function attachSession(id: string) {
    const start = performance.now();
    const mark = (name: string) =>
      perfLog(
        `[perf] attachSession.${name} target=${id} +${(performance.now() - start).toFixed(1)}ms`,
      );
    perfLog(`[perf] attachSession start target=${id}`);
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
      syncGoalStatus,
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
      // Startup restores the runtime's already-selected session by attaching to
      // the same id. Do not skip context seeding just because the id is already
      // active: legacy journals have no stream context snapshots yet, and the
      // UI mounts after the runtime was initialized with this session.
      const activeExec = ctx.ports.getActiveExec();
      if (activeExec?.session.id === nextID) {
        void seedStreamContextSnapshots(activeExec).catch(() => undefined);
      } else {
        const exec = await ensureExecution(nextID);
        if (exec.session.metadata?.archived)
          throw new RuntimeRefusal("cannot attach an archived session");
        void seedStreamContextSnapshots(exec).catch(() => undefined);
      }
      // A same-session startup attach skips `ensureExecution`, so the durable
      // goal is never replayed here; re-seed the live projection explicitly or
      // the status bar stays empty until the next goal mutation.
      await syncGoalStatus?.(nextID).catch(() => undefined);
      perfLog(
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
    // Re-seed the goal status for the session we just switched to; its exec may
    // already have existed (ensureExecution returns the cache) or its journal
    // tail may not carry the durable goal.
    await syncGoalStatus?.(nextID).catch(() => undefined);
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
    void seedStreamContextSnapshots(exec).catch(() => undefined);
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
    perfLog(
      `[perf] attachSession done target=${id} events=${exec.session.events.length} +${(performance.now() - start).toFixed(1)}ms`,
    );
    return { sessionID: exec.session.id };
  }
}
