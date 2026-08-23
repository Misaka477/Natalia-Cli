/**
 * Builtin service refresh — runtime/service-refresh.ts.
 *
 * `refreshBuiltinServices` re-resolves every workspace service controller from
 * the capability registry after a plugin reconcile, re-inits replacement
 * terminal/sandbox/MCP controllers, resets the checkpoint factory when it
 * changes, and restores the selected skills on each session exec. Reads and
 * writes host state through `RuntimeContext` ports.
 */
import {
  ATTACHMENT_SERVICE,
  CHECKPOINT_FACTORY_SERVICE,
  COLLABORATION_WAITER_SERVICE,
  COMPACTION_SERVICE,
  CONTEXT_LEDGER_FACTORY_SERVICE,
  GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
  MCP_SERVICE,
  PROVIDER_MODEL_CONTROLLER_SERVICE,
  RETRY_SERVICE,
  SANDBOX_SERVICE,
  SESSION_STORE_CONTROLLER_SERVICE,
  STATUS_SNAPSHOT_CONTROLLER_SERVICE,
  SUBAGENTS_SERVICE,
  TASK_WORKFLOW_CONTROLLER_SERVICE,
  TERMINAL_CONTROLLER_SERVICE,
  TOOL_POLICY_SERVICE,
  TURN_CONTROLLER_SERVICE,
  WORK_LEDGER_CONTROLLER_SERVICE,
  WORKSPACE_FILES_SERVICE,
  WORKSPACE_MUTATIONS_SERVICE,
  WORKSPACE_WRITE_LOCK_SERVICE,
  type AttachmentService,
  type CheckpointFactory,
  type CompactionService,
  type ContextLedgerFactory,
  type GovernanceLedgerController,
  type InteractiveWaiter,
  type McpService,
  type MutationRegistry,
  type ProviderModelController,
  type RetryService,
  type SandboxService,
  type SessionStoreController,
  type StatusSnapshotController,
  type SubagentsService,
  type TaskWorkflowController,
  type TerminalController,
  type ToolPolicyService,
  type TurnController,
  type WorkLedgerController,
  type WorkspaceFilesController,
  type WorkspaceWriteLock,
} from "@natalia/runtime-services";
import type { SessionID } from "@natalia/contracts";
import type { RuntimeContext } from "./context";

export function createServiceRefresh(ctx: RuntimeContext) {
  return {
    refreshBuiltinServices,
  };

  async function refreshBuiltinServices(
    selectedSkills: Map<SessionID, string> = new Map(),
  ) {
    const {
      getCapabilityRegistry,
      setWorkspaceWriteLock,
      setMutationRegistry,
      setWorkspaceFilesController,
      setTerminalController,
      setSandboxController,
      setMcpService,
      setSubagentsController,
      setProviderModelController,
      setTaskWorkflowController,
      setCompactionService,
      setSessionStoreController,
      setToolPolicyService,
      setInteractive,
      setAttachmentService,
      setRetryService,
      setContextLedgerFactory,
      setStatusController,
      setWorkLedgerController,
      setGovernanceLedgerController,
      setTurnController,
      setActiveCheckpointFactory,
      getActiveCheckpointFactory,
      getTerminalController,
      getSandboxController,
      getMcpService,
      setRuntimeContext,
      getExecutionBySession,
      getActiveExec,
      setActiveSkill,
      getSessionID,
      skillService,
    } = ctx.ports;
    const capabilityRegistry = getCapabilityRegistry();
    const previousTerminal = getTerminalController();
    const previousSandbox = getSandboxController();
    const previousMcp = getMcpService();
    const previousContextLedgerFactory = ctx.ports.getContextLedgerFactory();
    const nextCheckpointFactory = capabilityRegistry.service<CheckpointFactory>(
      CHECKPOINT_FACTORY_SERVICE,
    );

    setWorkspaceWriteLock(
      capabilityRegistry.service<WorkspaceWriteLock>(
        WORKSPACE_WRITE_LOCK_SERVICE,
      ),
    );
    setMutationRegistry(
      capabilityRegistry.service<MutationRegistry>(WORKSPACE_MUTATIONS_SERVICE),
    );
    setWorkspaceFilesController(
      capabilityRegistry.service<WorkspaceFilesController>(
        WORKSPACE_FILES_SERVICE,
      ),
    );
    setTerminalController(
      capabilityRegistry.service<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      ),
    );
    setSandboxController(
      capabilityRegistry.service<SandboxService>(SANDBOX_SERVICE),
    );
    setMcpService(capabilityRegistry.service<McpService>(MCP_SERVICE));
    setSubagentsController(
      capabilityRegistry.service<SubagentsService>(SUBAGENTS_SERVICE),
    );
    setProviderModelController(
      capabilityRegistry.service<ProviderModelController>(
        PROVIDER_MODEL_CONTROLLER_SERVICE,
      ),
    );
    setTaskWorkflowController(
      capabilityRegistry.service<TaskWorkflowController>(
        TASK_WORKFLOW_CONTROLLER_SERVICE,
      ),
    );
    setCompactionService(
      capabilityRegistry.service<CompactionService>(COMPACTION_SERVICE),
    );

    const nextSessionStore = capabilityRegistry.service<SessionStoreController>(
      SESSION_STORE_CONTROLLER_SERVICE,
    );
    if (nextSessionStore) setSessionStoreController(nextSessionStore);
    const nextToolPolicy =
      capabilityRegistry.service<ToolPolicyService>(TOOL_POLICY_SERVICE);
    if (nextToolPolicy) setToolPolicyService(nextToolPolicy);
    const nextInteractive = capabilityRegistry.service<InteractiveWaiter>(
      COLLABORATION_WAITER_SERVICE,
    );
    if (nextInteractive) setInteractive(nextInteractive);
    const nextAttachment =
      capabilityRegistry.service<AttachmentService>(ATTACHMENT_SERVICE);
    if (nextAttachment) setAttachmentService(nextAttachment);
    const nextRetry = capabilityRegistry.service<RetryService>(RETRY_SERVICE);
    if (nextRetry) setRetryService(nextRetry);
    const nextContextLedgerFactory =
      capabilityRegistry.service<ContextLedgerFactory>(
        CONTEXT_LEDGER_FACTORY_SERVICE,
      );
    if (nextContextLedgerFactory) {
      setContextLedgerFactory(nextContextLedgerFactory);
      if (previousContextLedgerFactory !== nextContextLedgerFactory)
        setRuntimeContext(nextContextLedgerFactory.create());
    }
    const nextStatusController =
      capabilityRegistry.service<StatusSnapshotController>(
        STATUS_SNAPSHOT_CONTROLLER_SERVICE,
      );
    if (nextStatusController) setStatusController(nextStatusController);
    const nextWorkLedger = capabilityRegistry.service<WorkLedgerController>(
      WORK_LEDGER_CONTROLLER_SERVICE,
    );
    if (nextWorkLedger) setWorkLedgerController(nextWorkLedger);
    const nextGovernance =
      capabilityRegistry.service<GovernanceLedgerController>(
        GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
      );
    if (nextGovernance) setGovernanceLedgerController(nextGovernance);
    const nextTurnController = capabilityRegistry.service<TurnController>(
      TURN_CONTROLLER_SERVICE,
    );
    if (nextTurnController) setTurnController(nextTurnController);

    if (nextCheckpointFactory !== getActiveCheckpointFactory()) {
      ctx.state.checkpointControllerBySession.clear();
      ctx.state.checkpointInitBySession.clear();
      setActiveCheckpointFactory(nextCheckpointFactory);
    }
    const mcpService = getMcpService();
    if (mcpService && mcpService !== previousMcp) await mcpService.reload();
    const terminalController = getTerminalController();
    if (terminalController && terminalController !== previousTerminal) {
      await terminalController.init();
      terminalController.setActiveSession(getSessionID());
    }
    const sandboxController = getSandboxController();
    if (sandboxController && sandboxController !== previousSandbox)
      await sandboxController.init();

    const registry = skillService();
    for (const [id, exec] of getExecutionBySession()) {
      const qualifiedName = selectedSkills.get(id);
      if (!qualifiedName || !registry) {
        exec.activeSkill = undefined;
        continue;
      }
      try {
        exec.activeSkill = registry.resolve(qualifiedName);
      } catch {
        exec.activeSkill = undefined;
      }
    }
    setActiveSkill(getActiveExec()?.activeSkill);
  }
}
