import { isAbsolute, join } from "node:path";
import {
  foregroundProcessForTTY,
  globalConfigHome,
  userRuntimeHome,
} from "@natalia/platform";
import { TerminalCommandBuffer } from "@natalia/tools";
import {
  SKILL_SERVICE,
  TEAM_BEHAVIOR_SERVICE,
  TERMINAL_CONTROLLER_SERVICE,
  WORK_LEDGER_CONTROLLER_SERVICE,
  WORKSPACE_WRITE_LOCK_SERVICE,
  SANDBOX_SERVICE,
  STATUS_SNAPSHOT_CONTROLLER_SERVICE,
  type SandboxService,
  type SkillService,
  type StatusSnapshotController,
  type TeamBehaviorService,
  type TerminalController,
  type WorkLedgerController,
  type WorkspaceWriteLock,
} from "@natalia/runtime-services";
import { createPluginsController } from "../../plugins-controller";
import { redactToolOutput } from "../client-surface/helpers";
import type { RuntimeContext } from "../context";

function userSkillRoot() {
  const root = join(globalConfigHome(), "natalia-cli", "skills");
  return isAbsolute(root) ? root : undefined;
}

export function wireFoundation(ctx: RuntimeContext) {
  const { state, ports } = ctx;
  state.terminalCommandBuffer = new TerminalCommandBuffer({
    foregroundProgram: async (paneID) => {
      try {
        const terminal = ports.resolveService<TerminalController>(
          TERMINAL_CONTROLLER_SERVICE,
        );
        const ttyName = await terminal?.ttyName(paneID);
        if (!ttyName)
          return {
            supported: false as const,
            reason: `pane ${paneID} has no terminal device`,
          };
        return foregroundProcessForTTY(ttyName);
      } catch (error) {
        return {
          supported: false as const,
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
  state.pluginsController = createPluginsController({
    workspaceRoot: state.workspaceRoot,
    tools: state.tools,
    capabilityRegistry: state.capabilityRegistry,
    publish: (event) => ports.publish(event),
  });
  state.waiterDeps = {
    publish: (event) => ports.publish(event),
    sessionID: () => state.sessionID,
    permissionMode: (turnID) =>
      (turnID ? ports.executionForTurn(turnID) : state.activeExec)
        ?.permissionMode ?? state.permissionMode,
    abortSignal: (turnID) =>
      state.executionBySession.get(
        state.turnSession.get(turnID) ?? state.sessionID,
      )?.activeAbort?.signal,
    activeTurnID: () => state.activeExec?.activeTurnID,
    isPending: (sessionID, id, kind) =>
      ports.isPendingInteractiveRequest(sessionID, id, kind),
    sessionIDForTurn: (turnID) =>
      state.turnSession.get(turnID) ?? state.sessionID,
    agentIDForTurn: (turnID) => state.turnAgent.get(turnID),
    capabilityOwnerForTool: (toolName) =>
      state.capabilityRegistry.ownerOf("tools", toolName),
    workLedger: () => {
      const workLedger = ports.resolveService<WorkLedgerController>(
        WORK_LEDGER_CONTROLLER_SERVICE,
      );
      if (!workLedger)
        throw new Error("work ledger unavailable (natalia-work-ledger)");
      return workLedger;
    },
    publishForSession: (sessionID, event) =>
      ports.publishForSession(state.executionBySession.get(sessionID), event),
  };

  ports.isDisposed = () => state.runtimeDisposed;
  ports.setDisposed = (disposed) => {
    state.runtimeDisposed = disposed;
  };
  ports.resolveService = <T>(serviceID: string) =>
    state.capabilityRegistry.service<T>(serviceID);
  ports.getSession = () => state.session;
  ports.getReplayMode = () => state.replayMode;
  ports.setReplayMode = (mode) => {
    state.replayMode = mode;
  };
  ports.getSessionPersistence = () => state.sessionPersistence;
  ports.getProviderConcurrencyLimiter = () => state.providerConcurrencyLimiter;
  ports.getExecutionBySession = () => state.executionBySession;
  ports.getTurnSession = () => state.turnSession;
  ports.getRuntimeContext = () => state.runtimeContext;
  ports.getActiveSkill = () => state.activeSkill;
  ports.getTurnAgent = () => state.turnAgent;
  ports.getAttachmentReferences = () => state.attachmentReferences;
  ports.getToolCalls = () => state.toolCalls;
  ports.getRetryPolicy = () => state.retryPolicy;
  ports.executionForTurn = (turnID) =>
    state.executionBySession.get(
      state.turnSession.get(turnID) ?? state.sessionID,
    );
  ports.getSessionID = () => state.sessionID;
  ports.getProvider = () => state.provider;
  ports.getActiveExec = () => state.activeExec;
  ports.getActiveTurnID = () => state.activeTurnID;
  ports.getPauseWaiters = () => state.pauseWaiters;
  ports.getWorkspaceCapabilityView = () => state.workspaceCapabilityView;
  ports.getTools = () => state.tools;
  ports.scheduleRuntimeStatusSnapshot = () =>
    ports
      .resolveService<StatusSnapshotController>(
        STATUS_SNAPSHOT_CONTROLLER_SERVICE,
      )
      ?.schedule();
  ports.runtimeStatusSnapshot = () => {
    const status = ports.resolveService<StatusSnapshotController>(
      STATUS_SNAPSHOT_CONTROLLER_SERVICE,
    );
    if (!status) throw new Error("runtime UI unavailable (natalia-runtime-ui)");
    return status.snapshot();
  };
  ports.skillService = () =>
    state.capabilityRegistry.service<SkillService>(SKILL_SERVICE);
  ports.skillsList = () => ports.skillService()?.list() ?? [];
  ports.teamBehavior = () =>
    state.capabilityRegistry.service<TeamBehaviorService>(
      TEAM_BEHAVIOR_SERVICE,
    );
  ports.getProviderSource = () => state.providerSource;
  ports.getWorkspaceRoot = () => state.workspaceRoot;
  ports.getAgentRegistry = () => state.agentRegistry;
  ports.setPaused = (value) => {
    state.paused = value;
  };
  ports.getPaused = () => state.paused;
  ports.getCapabilityRegistry = () => state.capabilityRegistry;
  ports.getTsRuntimeConfig = () => state.tsRuntimeConfig;
  ports.getSelectedAgent = () => state.selectedAgent;
  ports.getSelectedModel = () => state.selectedModel;
  ports.getMaxSteps = () => state.maxSteps;
  ports.getReady = () => state.ready;
  ports.getContextWindowResolver = () => state.contextWindowResolver;
  ports.setProvider = (value) => {
    state.provider = value;
  };
  ports.setSelectedModel = (value) => {
    state.selectedModel = value;
  };
  ports.setRuntimeContextConfig = (value) => {
    state.runtimeContextConfig = value;
  };
  ports.getRuntimeContextConfig = () => state.runtimeContextConfig;
  ports.nextMailboxSequence = () => state.mailboxSequence++;
  ports.nextDecisionSequence = () => state.decisionSequence++;
  ports.nextEvidenceSequence = () => state.evidenceSequence++;
  ports.nextCompletionSequence = () => state.completionSequence++;
  ports.nextChatSequence = () => state.chatSequence++;
  ports.getInternalWakeTasks = () => state.internalWakeTasks;
  ports.setSessionPersistence = (next) => {
    state.sessionPersistence = next;
  };
  ports.redactToolOutput = redactToolOutput;
  ports.getSink = () => state.sink;
  ports.setSink = (next) => {
    state.sink = next;
  };
  ports.getPerformanceTrace = () => state.performanceTrace;
  ports.getNativeRuntimeID = () => state.nativeRuntimeID;
  ports.getUserRuntimeHome = () => userRuntimeHome();
  ports.getUserSkillRoot = () => userSkillRoot();
  ports.setProviderSource = (source) => {
    state.providerSource = source;
  };
  ports.getPluginsController = () => state.pluginsController;
}
