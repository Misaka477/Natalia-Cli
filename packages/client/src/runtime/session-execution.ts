/**
 * Session execution state — runtime/session-execution.ts.
 *
 * `ensureExecution` creates a session's execution state lazily (its record,
 * context ledger and in-flight markers) and the drain/admit/persist/load
 * helpers that drive the turn controller for a session. Reads host state
 * through `RuntimeContext` at call time.
 */
import { modelVisibleEvents, projectSession } from "@natalia/session";
import type { SessionRecord } from "@natalia/session";
import type { SessionID } from "@natalia/contracts";
import type { RuntimeContext } from "./context";
import type { SessionExecutionState } from "./context";
import type { RealRuntimeClientOptions } from "../real-runtime";

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
      await ctx.ports.getTurnController().drain(signal, sessionID);
    };
  }

  async function drainPendingQueue(signal?: AbortSignal) {
    await ctx.ports
      .getTurnController()
      .drainQueue(signal, ctx.ports.getSessionID());
  }

  async function runAdmittedInput(
    id: string,
    text: string,
    attachments: import("@natalia/contracts").LocalAttachment[] = [],
    resources: import("@natalia/contracts").PromptResourceMention[] = [],
    agents: import("@natalia/contracts").PromptAgentMention[] = [],
  ) {
    await ctx.ports
      .getTurnController()
      .admit(
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
    await ctx.ports.getTurnController().persistPromotion(targetSessionID);
  }

  async function loadSessionForAttach(id: SessionID): Promise<SessionRecord> {
    return (await ctx.ports.getSessionStoreController().load(id)).session;
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
    const {
      getSessionStoreController,
      getContextLedgerFactory,
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
    if (existing) return existing;
    const sessionStoreController = getSessionStoreController();
    const stored = await sessionStoreController.load(sessionID);
    const loaded = stored.session;
    const execContext = getContextLedgerFactory().create();
    const projection = projectSession(loaded);
    const epoch = stored.contextEpoch;
    if (epoch) execContext.restoreDurableCheckpoint(epoch.snapshot);
    getContextLedgerFactory().restore(
      execContext,
      epoch
        ? sessionStoreController.contextEventsAfter(sessionID, epoch)!
        : modelVisibleEvents(projection.replayableEvents),
    );
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
        (getProviderSource() === "environment" ? getProvider() : undefined),
      runtimeContextConfig: getRuntimeContextConfig(),
      permissionMode: getDefaultPermissionMode(),
      permissionProfile: getDefaultPermissionProfile(),
      selectedAgent: projection.selectedAgent
        ? getAgentRegistry()?.select(projection.selectedAgent)
        : undefined,
      selectedModel: projection.selectedModel,
      paused: false,
      pauseWaiters: [],
    };
    executionBySession.set(sessionID, exec);
    applyAgentProvider(exec);
    await refreshExecutionContextConfig(exec);
    return exec;
  }
}
