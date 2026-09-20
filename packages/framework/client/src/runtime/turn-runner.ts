/**
 * Turn runner input — runtime/turn-runner.ts.
 *
 * `providerRunnerInput` builds the TurnRunner input object for a session: the
 * provider/session/context/tools bindings, the model capability gates, the
 * collaboration surfaces (mailbox, Navi suggestions/answers/chats), the active
 * plan projection, and the runtime seams (approval, policy, persistence,
 * checkpoint, tool execution). Reads host state through `RuntimeContext` at
 * call time.
 */
import { providerForModel } from "@natalia/runtime";
import {
  claimNextSteps,
  projectedCollabMessages,
  sessionFactCollabMessages,
} from "@natalia/session";
import type { ProviderRunnerInput } from "@natalia/runtime-services";
import {
  ATTACHMENT_SERVICE,
  COMPACTION_SERVICE,
  MCP_SERVICE,
  RETRY_SERVICE,
  STATUS_SNAPSHOT_CONTROLLER_SERVICE,
  type AttachmentService,
  type CompactionService,
  type McpService,
  type RetryService,
  type StatusSnapshotController,
} from "@natalia/runtime-services";
import type { RuntimeContext, SessionExecutionState } from "./context";
import { activePlanForExec } from "./collaboration/plan-doc-runtime";
import { loadProjectDocumentsSync } from "./project-docs";
import type { RealRuntimeClientOptions } from "./options";

function collabMessagesForExec(
  exec: SessionExecutionState,
): ReturnType<typeof projectedCollabMessages> {
  // The hot state holds the complete collab slice even when session.events is a
  // fast-attach tail; prefer it over the (possibly tail-based) snapshot.
  if (exec.factStateComplete === true && exec.factState)
    return sessionFactCollabMessages(exec.factState);
  const snapshot = exec.collabSnapshot;
  if (snapshot && snapshot.eventCount === exec.session.events.length)
    return snapshot.collabMessages;
  return projectedCollabMessages(exec.session.events);
}

export function createTurnRunner(
  ctx: RuntimeContext,
  options: RealRuntimeClientOptions,
) {
  return {
    providerRunnerInput,
  };

  function providerRunnerInput(
    sessionID: import("@natalia/contracts").SessionID,
  ): ProviderRunnerInput {
    const {
      getExecutionBySession,
      getTools,
      getAgentRegistry,
      getActiveExec,
      getWorkspaceRoot,
      getTsRuntimeConfig,
      publishForSession,
      modelCapabilitiesForExecution,
      refreshExecutionContextConfig,
      skillsList,
      skillService,
      applyAgentPolicy,
      applyAgentProvider,
      persistInboxPromotion,
      initializeCheckpointController,
      isToolAllowed,
      setInFlightOperationFor,
      executeToolCalls,
      reloadConfigFromDisk,
      effectiveMaxSteps,
      waitIfPaused,
      setActiveAbort,
      setActiveTurnID,
      setSelectedAgent,
      setPendingAgent,
    } = ctx.ports;
    const { executionBySession, tools } = ctx.state;
    const exec = executionBySession.get(sessionID);
    if (!exec) throw new Error(`no execution state for session ${sessionID}`);
    const compactionService =
      ctx.ports.resolveService<CompactionService>(COMPACTION_SERVICE);
    if (!compactionService)
      throw new Error("compaction service unavailable (natalia-compaction)");
    const attachmentService =
      ctx.ports.resolveService<AttachmentService>(ATTACHMENT_SERVICE);
    if (!attachmentService)
      throw new Error("attachment service unavailable (natalia-attachment)");
    const statusController = ctx.ports.resolveService<StatusSnapshotController>(
      STATUS_SNAPSHOT_CONTROLLER_SERVICE,
    );
    if (!statusController)
      throw new Error(
        "status snapshot controller unavailable (natalia-runtime-ui)",
      );
    const retryService = ctx.ports.resolveService<RetryService>(RETRY_SERVICE);
    if (!retryService)
      throw new Error("retry service unavailable (natalia-retry)");
    const activeExec = getActiveExec();
    return {
      provider: () => {
        if (exec.provider) return exec.provider;
        const config = ctx.ports.getTsRuntimeConfig();
        const fallback = config?.defaultModel
          ? providerForModel(config, config.defaultModel)
          : undefined;
        if (fallback) exec.provider = fallback;
        return exec.provider;
      },
      session: () => exec.session,
      context: () => exec.context,
      tokenMeter: () => exec.tokenMeter,
      tools: () => tools,
      attachmentReferences: () => exec.attachmentReferences,
      attachments: attachmentService,
      compaction: compactionService,
      mcp: () => ctx.ports.resolveService<McpService>(MCP_SERVICE),
      agentRegistry: () => getAgentRegistry(),
      activeAbort: () => exec.activeAbort,
      setActiveAbort: (controller) => {
        exec.activeAbort = controller;
        if (exec === activeExec) setActiveAbort(controller);
      },
      activeTurnID: () => exec.activeTurnID,
      setActiveTurnID: (id) => {
        exec.activeTurnID = id;
        if (exec === activeExec) setActiveTurnID(id);
      },
      selectedAgent: () => exec.selectedAgent,
      setSelectedAgent: (agent) => {
        exec.selectedAgent = agent;
        if (exec === activeExec) setSelectedAgent(agent);
      },
      // The session's date, snapshotted when its execution state was built and
      // rolled forward only by appending a notice — never by rewriting history.
      sessionStartedAt: () => exec.sessionStartedAt,
      sessionCurrentDate: () => exec.currentDate,
      recordSessionDate: (date) => {
        exec.currentDate = date;
      },
      pendingAgent: () => exec.pendingAgent,
      setPendingAgent: (agent) => {
        exec.pendingAgent = agent;
        if (exec === activeExec) setPendingAgent(agent);
      },
      selectedModel: () => exec.selectedModel,
      modelCapabilities: () => modelCapabilitiesForExecution(exec),
      setActiveModelCapabilities: (capabilities) => {
        exec.activeModelCapabilities = capabilities;
      },
      refreshContextConfig: () => refreshExecutionContextConfig(exec),
      permissionMode: () => exec.permissionMode,
      workspaceRoot: () => getWorkspaceRoot(),
      tsRuntimeConfig: () => getTsRuntimeConfig(),
      runtimeContextConfig: () => exec.runtimeContextConfig,
      activeSkill: () => exec.activeSkill,
      skillsList,
      skillService,
      naviSuggestions: () =>
        collabMessagesForExec(exec)
          .filter(
            (message): message is typeof message & { kind: "suggestion" } =>
              message.kind === "suggestion" && message.status === "pending",
          )
          .map((message) => ({
            id: message.id,
            suggestion: message.text,
            priority: message.priority ?? "normal",
          })),
      naviAnswers: () =>
        collabMessagesForExec(exec)
          .filter((message) => message.kind === "answer")
          .map((message) => ({
            questionID: message.questionID ?? "",
            answer: message.text,
          })),
      naviChats: () =>
        collabMessagesForExec(exec).flatMap((message) =>
          message.kind === "chat" &&
          (message.from === "main_agent" || message.to === "main_agent") &&
          (message.from === "live_chat" || message.to === "live_chat")
            ? [
                {
                  id: message.id,
                  threadID: message.threadID ?? "",
                  from: message.from,
                  to: message.to,
                  text: message.text,
                  round: message.round ?? 1,
                  expectsReply: message.expectsReply ?? false,
                  status: message.status,
                },
              ]
            : [],
        ),
      naviIntro: () =>
        collabMessagesForExec(exec).some(
          (message) =>
            (message.from === "main_agent" || message.to === "main_agent") &&
            (message.from === "live_chat" || message.to === "live_chat"),
        ),
      niaChats: () =>
        collabMessagesForExec(exec).flatMap((message) =>
          message.kind === "chat" &&
          (message.from === "nia" || message.to === "nia")
            ? [
                {
                  id: message.id,
                  threadID: message.threadID ?? "",
                  from: message.from,
                  to: message.to,
                  text: message.text,
                  round: message.round ?? 1,
                  expectsReply: message.expectsReply ?? false,
                  status: message.status,
                },
              ]
            : [],
        ),
      niaIntro: () =>
        collabMessagesForExec(exec).some(
          (message) => message.from === "nia" || message.to === "nia",
        ),
      activePlan: () => {
        const plan = activePlanForExec(ctx, exec);
        if (!plan) return undefined;
        return {
          planID: plan.planID,
          version: 1,
          title: plan.title,
          objective: plan.documentPath,
          steps: [],
          constraints: [],
          verification: [],
          riskNotes: [],
        };
      },
      // ADR D2 / EI §8.5: the project documents (AGENTS.md and
      // .natalia/constitution.md) load per turn and carry a content hash; a
      // document edit changes the hash, the rendered block changes, and the
      // runtime re-appends on change instead of mutating earlier messages.
      projectDocuments: () => {
        const snapshot = loadProjectDocumentsSync(getWorkspaceRoot());
        return snapshot?.documents.length ? snapshot : undefined;
      },
      retry: retryService,
      lastProviderUsage: () => exec.lastProviderUsage,
      setLastProviderUsage: (usage) => {
        exec.lastProviderUsage = usage;
      },
      publish: (event) => publishForSession(exec, event),
      applyAgentPolicy: () => {
        if (exec === activeExec) applyAgentPolicy();
      },
      applyAgentProvider: () => applyAgentProvider(exec),
      persistInboxPromotion: () => persistInboxPromotion(exec.session.id),
      createTurnCheckpoint: async (input) => {
        const controller = await initializeCheckpointController(exec);
        if (controller?.isEnabled()) await controller.createCheckpoint(input);
      },
      isToolAllowed: (toolName) => isToolAllowed(toolName, exec),
      setInFlightOperation: (operation) =>
        setInFlightOperationFor(exec, operation),
      executeToolCalls,
      takeLiveUserMessages: () => ctx.ports.takeLiveUserMessages(exec),
      takeStepInputs: (step) => {
        const claimed = claimNextSteps(
          exec.session,
          exec.activeTurnID ?? "",
          step,
        );
        if (!claimed.length) return [];
        for (const item of claimed)
          publishForSession(exec, {
            type: "turn.input",
            turnID: exec.activeTurnID ?? item.id,
            inputID: item.id,
            text: item.text,
            delivery: "next-step",
            ...(item.internal ? { internal: true } : {}),
          });
        void persistInboxPromotion(exec.session.id);
        return claimed.map((item) => ({ id: item.id, text: item.text }));
      },
      hasPendingStepInputs: () =>
        exec.session.inbox?.some(
          (item) => !item.promotedAt && item.delivery === "next-step",
        ) ?? false,
      isTurnAnnounced: (id) => exec.announcedTurnIDs.has(id),
      markTurnAnnounced: (id) => {
        exec.announcedTurnIDs.add(id);
      },
      reloadConfig: async () => {
        const result = await reloadConfigFromDisk();
        if (result.providerReconfigured) applyAgentProvider(exec);
        return result;
      },
      runtimeStatusSnapshot: () =>
        statusController.snapshotFor({
          provider: exec.provider,
          context: exec.context,
          permissionMode: exec.permissionMode,
        }),
      effectiveMaxSteps: () => effectiveMaxSteps(exec),
      waitIfPaused: () => waitIfPaused(exec),
      waitingHuman: () => exec.endTurnWaitingHuman,
    };
  }
}
