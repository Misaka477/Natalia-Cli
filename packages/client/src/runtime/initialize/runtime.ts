import type { RuntimeContext } from "../context";
import { initializeConstants } from "./constants";

export function createInitializeRuntime(ctx: RuntimeContext) {
  const deps = ctx.state.initialize;
  return {
    ...deps,
    ...initializeConstants(ctx),
    get workspaceRoot() {
      return ctx.ports.getWorkspaceRoot();
    },
    get tsRuntimeConfig() {
      return ctx.ports.getTsRuntimeConfig();
    },
    set tsRuntimeConfig(value) {
      ctx.ports.setTsRuntimeConfig(value);
    },
    get buildBuiltinPluginCatalog() {
      return ctx.ports.buildBuiltinPluginCatalog;
    },
    set buildBuiltinPluginCatalog(value) {
      ctx.ports.setBuildBuiltinPluginCatalog(value);
    },
    set activeCheckpointFactory(
      value: import("@natalia/runtime-services").CheckpointFactory | undefined,
    ) {
      ctx.ports.setActiveCheckpointFactory(value);
    },
    get activeCheckpointFactory() {
      return ctx.ports.getActiveCheckpointFactory();
    },
    set workspaceWriteLock(
      value: import("@natalia/runtime-services").WorkspaceWriteLock | undefined,
    ) {
      ctx.ports.setWorkspaceWriteLock(value);
    },
    get workspaceWriteLock() {
      return ctx.ports.getWorkspaceWriteLock();
    },
    set mutationRegistry(
      value: import("@natalia/runtime-services").MutationRegistry | undefined,
    ) {
      ctx.ports.setMutationRegistry(value);
    },
    get mutationRegistry() {
      return ctx.ports.getMutationRegistry();
    },
    set workspaceFilesController(
      value:
        | import("@natalia/runtime-services").WorkspaceFilesController
        | undefined,
    ) {
      ctx.ports.setWorkspaceFilesController(value);
    },
    get workspaceFilesController() {
      return ctx.ports.getWorkspaceFilesController();
    },
    get terminalController() {
      return ctx.ports.getTerminalController();
    },
    set terminalController(
      value: import("@natalia/runtime-services").TerminalController | undefined,
    ) {
      ctx.ports.setTerminalController(value);
    },
    get sandboxController() {
      return ctx.ports.getSandboxController();
    },
    set sandboxController(
      value: import("@natalia/runtime-services").SandboxService | undefined,
    ) {
      ctx.ports.setSandboxController(value);
    },
    get mcpService() {
      return ctx.ports.getMcpService();
    },
    set mcpService(
      value: import("@natalia/runtime-services").McpService | undefined,
    ) {
      ctx.ports.setMcpService(value);
    },
    get subagentsController() {
      return ctx.ports.getSubagentsController();
    },
    set subagentsController(
      value: import("@natalia/runtime-services").SubagentsService | undefined,
    ) {
      ctx.ports.setSubagentsController(value);
    },
    get sessionStoreController() {
      return ctx.ports.getSessionStoreController();
    },
    set sessionStoreController(
      value: import("@natalia/runtime-services").SessionStoreController,
    ) {
      ctx.ports.setSessionStoreController(value);
    },
    get toolPolicy() {
      return ctx.ports.getToolPolicy();
    },
    set toolPolicy(
      value: import("@natalia/runtime-services").ToolPolicyService | undefined,
    ) {
      ctx.ports.setToolPolicyService(value);
    },
    get interactive() {
      return ctx.ports.getInteractive();
    },
    set interactive(
      value: import("@natalia/runtime-services").InteractiveWaiter,
    ) {
      ctx.ports.setInteractive(value);
    },
    get providerModelController() {
      return ctx.ports.getProviderModelController();
    },
    set providerModelController(
      value:
        | import("@natalia/runtime-services").ProviderModelController
        | undefined,
    ) {
      ctx.ports.setProviderModelController(value);
    },
    set taskWorkflowController(
      value:
        | import("@natalia/runtime-services").TaskWorkflowController
        | undefined,
    ) {
      ctx.ports.setTaskWorkflowController(value);
    },
    get taskWorkflowController() {
      return ctx.ports.getTaskWorkflowController();
    },
    get agentToolLayer() {
      return ctx.ports.getAgentToolLayer();
    },
    set agentToolLayer(value) {
      ctx.ports.setAgentToolLayer(value);
    },
    get permissionProfileToolLayer() {
      return ctx.ports.getPermissionProfileToolLayer();
    },
    set permissionProfileToolLayer(value) {
      ctx.ports.setPermissionProfileToolLayer(value);
    },
    get moduleToolLayer() {
      return ctx.ports.getModuleToolLayer();
    },
    set moduleToolLayer(value) {
      ctx.ports.setModuleToolLayer(value);
    },
    get modulePermissionToolLayer() {
      return ctx.ports.getModulePermissionToolLayer();
    },
    set modulePermissionToolLayer(value) {
      ctx.ports.setModulePermissionToolLayer(value);
    },
    get toolLayer() {
      return ctx.ports.getToolLayer();
    },
    set toolLayer(value) {
      ctx.ports.setToolLayer(value);
    },
    get retryPolicy() {
      return ctx.ports.getRetryPolicy();
    },
    set retryPolicy(value) {
      ctx.ports.setRetryPolicy(value);
    },
    set maxSteps(value: number | undefined) {
      ctx.ports.setMaxSteps(value);
    },
    get maxSteps() {
      return ctx.ports.getMaxSteps();
    },
    get providerConcurrencyLimiter() {
      return ctx.ports.getProviderConcurrencyLimiter();
    },
    set providerConcurrencyLimiter(value) {
      ctx.ports.setProviderConcurrencyLimiter(value);
    },
    get agentRegistry() {
      return ctx.ports.getAgentRegistry();
    },
    set agentRegistry(
      value: import("@natalia/agent").AgentRegistry | undefined,
    ) {
      if (value) ctx.ports.setAgentRegistry(value);
    },
    get selectedAgent() {
      return ctx.ports.getSelectedAgent();
    },
    set selectedAgent(value) {
      ctx.ports.setSelectedAgent(value);
    },
    get selectedModel() {
      return ctx.ports.getSelectedModel();
    },
    set selectedModel(value) {
      ctx.ports.setSelectedModel(value);
    },
    get provider() {
      return ctx.ports.getProvider();
    },
    set provider(value) {
      ctx.ports.setProvider(value);
    },
    set providerSource(
      value: "explicit" | "environment" | "ts_config" | "unconfigured",
    ) {
      ctx.ports.setProviderSource(value);
    },
    get providerSource() {
      return ctx.ports.getProviderSource();
    },
    get runtimeContextConfig() {
      return ctx.ports.getRuntimeContextConfig();
    },
    set runtimeContextConfig(value) {
      ctx.ports.setRuntimeContextConfig(value);
    },
    get attachmentService() {
      return ctx.ports.getAttachmentService();
    },
    set attachmentService(value) {
      ctx.ports.setAttachmentService(value);
    },
    get retryService() {
      return ctx.ports.getRetryService();
    },
    set retryService(value) {
      ctx.ports.setRetryService(value);
    },
    get contextLedgerFactory() {
      return ctx.ports.getContextLedgerFactory();
    },
    set contextLedgerFactory(value) {
      ctx.ports.setContextLedgerFactory(value);
    },
    get compactionService() {
      return ctx.ports.getCompactionService();
    },
    set compactionService(value) {
      ctx.ports.setCompactionService(value);
    },
    get statusController() {
      return ctx.ports.getStatusController();
    },
    set statusController(value) {
      ctx.ports.setStatusController(value);
    },
    get runtimeContext() {
      return ctx.ports.getRuntimeContext();
    },
    set runtimeContext(value) {
      ctx.ports.setRuntimeContext(value);
    },
    get workLedgerController() {
      return ctx.ports.getWorkLedgerController();
    },
    set workLedgerController(value) {
      ctx.ports.setWorkLedgerController(value);
    },
    get governanceLedgerController() {
      return ctx.ports.getGovernanceLedgerController();
    },
    set governanceLedgerController(value) {
      ctx.ports.setGovernanceLedgerController(value);
    },
    get turnController() {
      return ctx.ports.getTurnController();
    },
    set turnController(value) {
      ctx.ports.setTurnController(value);
    },
    get sessionID() {
      return ctx.ports.getSessionID();
    },
    set sessionID(value) {
      ctx.ports.setSessionID(value);
    },
    get sessionPersistence() {
      return ctx.ports.getSessionPersistence();
    },
    set sessionPersistence(value) {
      ctx.ports.setSessionPersistence(value);
    },
    get session() {
      return ctx.ports.getSession();
    },
    set session(value) {
      if (value) ctx.ports.setSession(value);
    },
    get activeExec() {
      return ctx.ports.getActiveExec();
    },
    set activeExec(value) {
      ctx.ports.setActiveExec(value);
    },
    get activeSkill() {
      return ctx.ports.getActiveSkill();
    },
    set activeSkill(value) {
      ctx.ports.setActiveSkill(value);
    },
    get permissionMode() {
      return ctx.ports.getPermissionMode();
    },
    get selectedPermissionProfile() {
      return ctx.ports.getSelectedPermissionProfile();
    },
    get attachmentReferences() {
      return ctx.ports.getAttachmentReferences();
    },
    get toolCalls() {
      return ctx.ports.getToolCalls();
    },
    get runtimeDiagnosticsBySession() {
      return ctx.ports.getRuntimeDiagnosticsBySession();
    },
    get executionBySession() {
      return ctx.state.executionBySession;
    },
    get turnSession() {
      return ctx.state.turnSession;
    },
    get turnAgent() {
      return ctx.ports.getTurnAgent();
    },
    get replayMode() {
      return ctx.ports.getReplayMode();
    },
    get sink() {
      return ctx.ports.getSink();
    },
    publish: ctx.ports.publish,
    publishForSession: ctx.ports.publishForSession,
    ensureExecution: ctx.ports.ensureExecution,
    executionForTurn: ctx.ports.executionForTurn,
    extensionEnabled: ctx.ports.extensionEnabled,
    extensionToolPermission: ctx.ports.extensionToolPermission,
    pluginsController: ctx.ports.getPluginsController(),
    applyAgentPolicy: ctx.ports.applyAgentPolicy,
    applyAgentProvider: ctx.ports.applyAgentProvider,
    resolveContextStatusConfig: ctx.ports.resolveContextStatusConfig,
    contextWindowResolver: ctx.ports.getContextWindowResolver(),
    modelRefKeyForSelection: ctx.ports.modelRefKeyForSelection,
    tryParseToolArguments: ctx.ports.tryParseToolArguments,
    parseToolArguments: ctx.ports.parseToolArguments,
    validateToolParameters: ctx.ports.validateToolParameters,
    authorizeWorkspaceRead: ctx.ports.authorizeWorkspaceRead,
    authorizeSandboxMerge: ctx.ports.authorizeSandboxMerge,
    toolSettings: ctx.ports.toolSettings,
    redactToolOutput: ctx.ports.redactToolOutput,
    redactToolOutputEnabled: ctx.ports.redactToolOutputEnabled,
    teamBehavior: ctx.ports.teamBehavior,
    tools: ctx.ports.getTools(),
    isToolAllowed: ctx.ports.isToolAllowed,
    effectiveMaxSteps: ctx.ports.effectiveMaxSteps,
    skillService: ctx.ports.skillService,
    requestNaviWake: ctx.ports.requestNaviWake,
    createCollabChatTool: ctx.ports.createCollabChatTool,
    initializeCheckpointController: ctx.ports.initializeCheckpointController,
    runtimeStatusSnapshot: ctx.ports.runtimeStatusSnapshot,
    scheduleRuntimeStatusSnapshot: ctx.ports.scheduleRuntimeStatusSnapshot,
  };
}
