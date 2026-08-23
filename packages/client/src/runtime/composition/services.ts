import { createServiceRefresh } from "../service-refresh";
import { createEnsureReady } from "../ensure-ready";
import { createSessionExecution } from "../session-execution";
import { createSessionAttach } from "../session-attach";
import { createToolPolicySurface } from "../tool-execution/policy";
import { boundToolOutput, validateToolParameters } from "@natalia/tools";
import {
  parseToolArguments,
  tryParseToolArguments,
} from "../../tool-arguments";
import type { RuntimeContext } from "../context";
import type { RealRuntimeClientOptions } from "../options";
import { isManagedResourceTool, waitForToolExecution } from "./helpers";

export function wireServices(
  ctx: RuntimeContext,
  options: RealRuntimeClientOptions,
) {
  const { state, ports } = ctx;
  ports.setWorkspaceWriteLock = (value) => {
    state.workspaceWriteLock = value;
  };
  ports.setMutationRegistry = (value) => {
    state.mutationRegistry = value;
  };
  ports.setWorkspaceFilesController = (value) => {
    state.workspaceFilesController = value;
  };
  ports.setTerminalController = (value) => {
    state.terminalController = value;
  };
  ports.setSandboxController = (value) => {
    state.sandboxController = value;
  };
  ports.setMcpService = (value) => {
    state.mcpService = value;
  };
  ports.setSubagentsController = (value) => {
    state.subagentsController = value;
  };
  ports.setProviderModelController = (value) => {
    state.providerModelController = value;
  };
  ports.setTaskWorkflowController = (value) => {
    state.taskWorkflowController = value;
  };
  ports.setCompactionService = (value) => {
    state.compactionService = value;
  };
  ports.setSessionStoreController = (value) => {
    state.sessionStoreController = value;
  };
  ports.setToolPolicyService = (value) => {
    state.toolPolicy = value;
  };
  ports.setInteractive = (value) => {
    state.interactive = value;
  };
  ports.setAttachmentService = (value) => {
    state.attachmentService = value;
  };
  ports.setRetryService = (value) => {
    state.retryService = value;
  };
  ports.setContextLedgerFactory = (value) => {
    state.contextLedgerFactory = value;
  };
  ports.setStatusController = (value) => {
    state.statusController = value;
  };
  ports.setWorkLedgerController = (value) => {
    state.workLedgerController = value;
  };
  ports.setGovernanceLedgerController = (value) => {
    state.governanceLedgerController = value;
  };
  ports.setTurnController = (value) => {
    state.turnController = value;
  };
  ports.setActiveCheckpointFactory = (value) => {
    state.activeCheckpointFactory = value;
  };
  ports.getActiveCheckpointFactory = () => state.activeCheckpointFactory;
  ports.refreshBuiltinServices =
    createServiceRefresh(ctx).refreshBuiltinServices;
  ports.setReady = (value) => {
    state.ready = value;
  };
  const ensureReady = createEnsureReady(ctx).ensureReady;
  const sessionExecution = createSessionExecution(ctx, options);
  ports.ensureExecution = sessionExecution.ensureExecution;
  ports.persistInboxPromotion = sessionExecution.persistInboxPromotion;
  ports.drainSessionFor = sessionExecution.drainSessionFor;
  ports.setLastSubmitted = (value) => {
    state.lastSubmitted = value;
  };
  ports.setSessionID = (value) => {
    state.sessionID = value;
  };
  ports.setSession = (value) => {
    state.session = value;
  };
  ports.setRuntimeContext = (value) => {
    state.runtimeContext = value;
  };
  ports.setActiveExec = (value) => {
    state.activeExec = value;
  };
  ports.setAttachmentReferences = (value) => {
    state.attachmentReferences = value;
  };
  ports.setToolCalls = (value) => {
    state.toolCalls = value;
  };
  ports.setPauseWaiters = (value) => {
    state.pauseWaiters = value;
  };
  ports.setActiveSkill = (value) => {
    state.activeSkill = value;
  };
  ports.setLastProviderUsage = (value) => {
    state.lastProviderUsage = value;
  };
  ports.clearRuntimeDiagnostics = () => {
    state.runtimeDiagnostics.splice(0);
  };
  ports.getRuntimeDiagnosticsBySession = () =>
    state.runtimeDiagnosticsBySession;
  ports.getRuntimeDiagnostics = () => state.runtimeDiagnostics;
  ports.attachSession = createSessionAttach(ctx).attachSession;
  ports.setActiveAbort = (value) => {
    state.activeAbort = value;
  };
  ports.setActiveTurnID = (value) => {
    state.activeTurnID = value;
  };
  ports.setSelectedAgent = (value) => {
    state.selectedAgent = value;
  };
  ports.setPendingAgent = (value) => {
    state.pendingAgent = value;
  };
  ports.getCompactionService = () => state.compactionService;
  ports.getAttachmentService = () => state.attachmentService;
  ports.getMcpService = () => state.mcpService;
  ports.getRetryService = () => state.retryService;

  const policy = createToolPolicySurface(ctx);
  ports.waitIfPaused = policy.waitIfPaused;
  ports.toolSettings = policy.toolSettings;
  ports.authorizeWorkspaceRead = policy.authorizeWorkspaceRead;
  ports.authorizeSandboxMerge = policy.authorizeSandboxMerge;
  ports.authorizeSandboxManagement = policy.authorizeSandboxManagement;
  ports.getTerminalController = () => state.terminalController;
  ports.getInteractive = () => state.interactive;
  ports.getMutationRegistry = () => state.mutationRegistry;
  ports.getTerminalCommandBuffer = () => state.terminalCommandBuffer;
  ports.getSandboxResourcesByID = () => state.sandboxResourcesByID;
  ports.getEndTurnWaitingHuman = () => state.endTurnWaitingHuman;
  ports.setEndTurnWaitingHuman = (value) => {
    state.endTurnWaitingHuman = value;
  };
  ports.waitForToolExecution = waitForToolExecution;
  ports.boundToolOutput = boundToolOutput;
  ports.isManagedResourceTool = isManagedResourceTool;
  ports.tryParseToolArguments = (input) => {
    const parsed = tryParseToolArguments(input);
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  };
  ports.parseToolArguments = parseToolArguments;
  ports.validateToolParameters = validateToolParameters;
  return { ensureReady, sessionExecution };
}
