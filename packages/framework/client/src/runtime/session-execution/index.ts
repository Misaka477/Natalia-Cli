/**
 * Session execution state — runtime/session-execution/index.ts.
 *
 * `ensureExecution` creates a session's execution state lazily (its record,
 * context ledger and in-flight markers) and the drain/admit/persist/load
 * helpers that drive the turn controller for a session. Reads host state
 * through `RuntimeContext` at call time.
 */
import { providerForModel } from "@natalia/runtime";
import { projectSession } from "@natalia/session";
import {
  CONTEXT_LEDGER_FACTORY_SERVICE,
  SESSION_STORE_CONTROLLER_SERVICE,
  TURN_CONTROLLER_SERVICE,
  type ContextLedgerFactory,
  type SessionStoreController,
  type TurnController,
} from "@natalia/runtime-services";
import type { SessionRecord } from "@natalia/session";
import type { SessionID } from "@natalia/contracts";
import type { RuntimeContext } from "../context";
import type { SessionExecutionState } from "../context";
import type { RealRuntimeClientOptions } from "../options";

const MAX_IDLE_SESSION_EXECUTIONS = Math.max(
  64,
  Number(process.env.NATALIA_MAX_IDLE_SESSIONS ?? 512),
);

function pruneIdleSessionExecutions(ctx: RuntimeContext) {
  const { executionBySession } = ctx.state;
  if (executionBySession.size <= MAX_IDLE_SESSION_EXECUTIONS) return;
  const active = ctx.ports.getActiveExec();
  for (const [sessionID, exec] of executionBySession) {
    if (exec === active) continue;
    if (
      exec.activeAbort ||
      exec.activeTurnID ||
      exec.paused ||
      exec.endTurnWaitingHuman
    )
      continue;
    executionBySession.delete(sessionID);
    ctx.state.sessionPersistenceBySession.delete(sessionID);
    if (executionBySession.size <= MAX_IDLE_SESSION_EXECUTIONS) return;
  }
}

export function createSessionExecution(
  ctx: RuntimeContext,
  options: RealRuntimeClientOptions,
) {
  return {
    drainSessionFor,
    drainPendingQueue,
    runAdmittedInput,
    persistInboxPromotion,
    loadSessionForAttach,
    ensureExecution,
  };

  function drainSessionFor(sessionID: SessionID) {
    return async (signal: AbortSignal) => {
      await ensureExecution(sessionID);
      const turnController = ctx.ports.resolveService<TurnController>(
        TURN_CONTROLLER_SERVICE,
      );
      if (!turnController)
        throw new Error(
          "turn orchestration unavailable (natalia-turn-orchestration)",
        );
      await turnController.drain(signal, sessionID);
    };
  }

  async function drainPendingQueue(signal?: AbortSignal) {
    const turnController = ctx.ports.resolveService<TurnController>(
      TURN_CONTROLLER_SERVICE,
    );
    if (!turnController)
      throw new Error(
        "turn orchestration unavailable (natalia-turn-orchestration)",
      );
    await turnController.drainQueue(signal, ctx.ports.getSessionID());
  }

  async function runAdmittedInput(
    id: string,
    text: string,
    attachments: import("@natalia/contracts").LocalAttachment[] = [],
    resources: import("@natalia/contracts").PromptResourceMention[] = [],
    agents: import("@natalia/contracts").PromptAgentMention[] = [],
  ) {
    const turnController = ctx.ports.resolveService<TurnController>(
      TURN_CONTROLLER_SERVICE,
    );
    if (!turnController)
      throw new Error(
        "turn orchestration unavailable (natalia-turn-orchestration)",
      );
    await turnController.admit(
      ctx.ports.getSessionID(),
      id,
      text,
      attachments,
      resources,
      agents,
    );
  }

  async function persistInboxPromotion(
    targetSessionID = ctx.ports.getSessionID(),
  ) {
    const turnController = ctx.ports.resolveService<TurnController>(
      TURN_CONTROLLER_SERVICE,
    );
    if (!turnController)
      throw new Error(
        "turn orchestration unavailable (natalia-turn-orchestration)",
      );
    await turnController.persistPromotion(targetSessionID);
  }

  async function loadSessionForAttach(id: SessionID): Promise<SessionRecord> {
    const sessionStore = ctx.ports.resolveService<SessionStoreController>(
      SESSION_STORE_CONTROLLER_SERVICE,
    );
    if (!sessionStore)
      throw new Error("session store unavailable (natalia-session-store)");
    return (await sessionStore.load(id)).session;
  }

  /**
   * D2: the execution state for a session — its record, its context ledger and
   * its in-flight turn markers. Created lazily the first time the session runs
   * work (init, attach or a background submission) and kept for the client's
   * life, so a background turn of A survives attaching to B and back.
   */
  async function ensureExecution(
    sessionID: SessionID,
  ): Promise<SessionExecutionState> {
    const start = performance.now();
    const mark = (name: string) =>
      console.warn(
        `[perf] ensureExecution.${name} session=${sessionID} +${(performance.now() - start).toFixed(1)}ms`,
      );
    console.warn(`[perf] ensureExecution start session=${sessionID}`);
    const {
      getProviderSource,
      getProvider,
      getRuntimeContextConfig,
      getDefaultPermissionMode,
      getDefaultPermissionProfile,
      getAgentRegistry,
      applyAgentProvider,
      refreshExecutionContextConfig,
    } = ctx.ports;
    const { executionBySession } = ctx.state;
    const existing = executionBySession.get(sessionID);
    if (existing) {
      console.warn(
        `[perf] ensureExecution hit session=${sessionID} +${(performance.now() - start).toFixed(1)}ms`,
      );
      return existing;
    }
    const sessionStore = ctx.ports.resolveService<SessionStoreController>(
      SESSION_STORE_CONTROLLER_SERVICE,
    );
    if (!sessionStore)
      throw new Error("session store unavailable (natalia-session-store)");
    const contextLedgerFactory = ctx.ports.resolveService<ContextLedgerFactory>(
      CONTEXT_LEDGER_FACTORY_SERVICE,
    );
    if (!contextLedgerFactory)
      throw new Error("context ledger unavailable (natalia-context-ledger)");
    const stored = await sessionStore.load(sessionID);
    mark("load");
    const loaded = stored.session;
    const recovery = stored.recovery;
    const execContext = contextLedgerFactory.create();
    mark("createLedger");
    const projection = projectSession(loaded);
    mark("project");
    const epoch = stored.contextEpoch;
    const latestContextCheckpoint = [...projection.replayableEvents]
      .reverse()
      .find((event) => event.type === "context.checkpoint");
    const checkpointIndex = latestContextCheckpoint
      ? projection.replayableEvents.indexOf(latestContextCheckpoint)
      : -1;
    const checkpointHasSummary =
      latestContextCheckpoint?.type === "context.checkpoint" &&
      latestContextCheckpoint.snapshot.entries.some(
        (entry) => entry.role === "summary",
      );
    if (epoch) execContext.restoreDurableCheckpoint(epoch.snapshot);
    else if (checkpointHasSummary && latestContextCheckpoint)
      execContext.restoreDurableCheckpoint(latestContextCheckpoint.snapshot);
    mark("checkpointRestore");
    const restoreEvents = epoch
      ? sessionStore.contextEventsAfter(sessionID, epoch)!
      : checkpointHasSummary && latestContextCheckpoint
        ? projection.replayableEvents.slice(checkpointIndex + 1)
        : projection.replayableEvents;
    contextLedgerFactory.restore(execContext, restoreEvents);
    mark("restore");
    console.warn("[context-restore] ensureExecution", {
      sessionID,
      replayableEvents: projection.replayableEvents.length,
      restoreEvents: restoreEvents.length,
      contextEntries: execContext.snapshot().entries.length,
      hasEpoch: epoch !== undefined,
      checkpointHasSummary,
    });
    const exec: SessionExecutionState = {
      session: loaded,
      context: execContext,
      attachmentReferences: new Map(
        projection.replayableEvents.flatMap((event) =>
          event.type === "turn.submitted" && event.attachments?.length
            ? [[`${event.id}:user`, event.attachments] as const]
            : [],
        ),
      ),
      toolCalls: new Map(),
      provider:
        options.provider ??
        (getProviderSource() === "environment" ? getProvider() : undefined) ??
        (() => {
          const config = ctx.ports.getTsRuntimeConfig();
          return config?.defaultModel
            ? providerForModel(config, config.defaultModel)
            : undefined;
        })(),
      runtimeContextConfig: getRuntimeContextConfig(),
      permissionMode:
        recovery?.permissionMode ??
        projection.permissionMode ??
        getDefaultPermissionMode(),
      permissionProfile: getDefaultPermissionProfile(),
      selectedAgent: projection.selectedAgent
        ? getAgentRegistry()?.select(projection.selectedAgent)
        : undefined,
      selectedModel: recovery?.selectedModel ?? projection.selectedModel,
      reasoningEffort: recovery?.reasoningEffort ?? projection.reasoningEffort,
      chatModelProfile:
        recovery?.chatModelProfile ?? projection.chatModelProfile,
      paused: false,
      pauseWaiters: [],
      injectedMailboxIDs: new Set(),
      pendingChatUserMessages: [],
    };
    executionBySession.set(sessionID, exec);
    pruneIdleSessionExecutions(ctx);
    applyAgentProvider(exec);
    mark("apply");
    // Warm the collaboration snapshot cache for attached/background sessions
    // without making the user wait for the worker.
    ctx.ports.scheduleCollabSnapshot?.(exec);
    await refreshExecutionContextConfig(exec);
    mark("refresh");
    console.warn(
      `[perf] ensureExecution done session=${sessionID} events=${exec.session.events.length} +${(performance.now() - start).toFixed(1)}ms`,
    );
    return exec;
  }
}
