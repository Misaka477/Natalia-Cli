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
import {
  projectedCollabMessages,
  projectedMailboxMessages,
  projectedPlans,
} from "@natalia/session";
import type { ProviderRunnerInput } from "@natalia/runtime-services";
import type { RuntimeContext } from "./context";
import type { RealRuntimeClientOptions } from "../real-runtime";

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
      getCompactionService,
      getTools,
      getAttachmentService,
      getMcpService,
      getAgentRegistry,
      getActiveExec,
      getWorkspaceRoot,
      getTsRuntimeConfig,
      getStatusController,
      getRetryService,
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
    const compactionService = getCompactionService();
    if (!compactionService)
      throw new Error("compaction service unavailable (natalia-compaction)");
    const activeExec = getActiveExec();
    return {
      provider: () => exec.provider,
      session: () => exec.session,
      context: () => exec.context,
      tools: () => tools,
      attachmentReferences: () => exec.attachmentReferences,
      attachments: getAttachmentService(),
      compaction: compactionService,
      mcp: () => getMcpService(),
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
      mailboxMessages: () =>
        projectedMailboxMessages(exec.session.events)
          .filter((message) => message.status === "delivered")
          .map((message) => ({
            messageID: message.messageID,
            intent: message.intent,
            text: message.text,
            priority: message.priority,
            source: message.source,
          })),
      naviSuggestions: () =>
        projectedCollabMessages(exec.session.events)
          .filter(
            (message) =>
              message.kind === "suggestion" && message.status === "proposed",
          )
          .map((message) => ({
            id: message.id,
            suggestion: message.text,
            priority: message.priority ?? "normal",
          })),
      naviAnswers: () =>
        projectedCollabMessages(exec.session.events)
          .filter((message) => message.kind === "answer")
          .map((message) => ({
            questionID: message.questionID ?? "",
            answer: message.text,
          })),
      naviChats: () =>
        projectedCollabMessages(exec.session.events)
          .filter((message) => message.kind === "chat")
          .map((message) => ({
            id: message.id,
            threadID: message.threadID ?? "",
            from: message.from,
            text: message.text,
            round: message.round ?? 1,
            expectsReply: message.expectsReply ?? false,
            status: message.status,
          })),
      naviIntro: () => projectedCollabMessages(exec.session.events).length > 0,
      activePlan: () => {
        const plan = projectedPlans(exec.session.events).find(
          (candidate) => candidate.status === "active",
        );
        if (!plan) return undefined;
        return {
          planID: plan.planID,
          version: plan.version,
          title: plan.title,
          objective: plan.objective,
          steps: plan.steps,
          constraints: plan.constraints,
          verification: plan.verification,
          riskNotes: plan.riskNotes,
        };
      },
      retry: getRetryService(),
      lastProviderUsage: () => exec.lastProviderUsage,
      setLastProviderUsage: (usage) => {
        exec.lastProviderUsage = usage;
      },
      taskModuleContext: () => options.taskModuleContext,
      publish: (event) => publishForSession(exec, event),
      applyAgentPolicy: () => {
        if (exec === activeExec) applyAgentPolicy();
      },
      applyAgentProvider: () => applyAgentProvider(exec),
      persistInboxPromotion: () => persistInboxPromotion(exec.session.id),
      createTurnCheckpoint: async (input) => {
        const controller = await initializeCheckpointController(exec);
        if (controller?.isEnabled())
          await controller.get().createCheckpoint(input);
      },
      isToolAllowed: (toolName) => isToolAllowed(toolName, exec),
      setInFlightOperation: (operation) =>
        setInFlightOperationFor(exec, operation),
      executeToolCalls,
      reloadConfig: async () => {
        const result = await reloadConfigFromDisk();
        if (result.providerReconfigured) applyAgentProvider(exec);
        return result;
      },
      runtimeStatusSnapshot: () =>
        getStatusController().snapshotFor({
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
