import type {
  CheckpointFactory,
  InitializeCatalogResult,
  InitializeOptions,
  InteractiveWaiter,
  McpService,
  MutationRegistry,
  PermissionProfileCommandRules,
  ProviderModelController,
  RuntimeContext,
  SandboxService,
  SessionStoreController,
  SubagentsService,
  TaskWorkflowController,
  TerminalController,
  ToolPolicyService,
  WorkspaceFilesController,
  WorkspaceWriteLock,
} from "../context";
import { createInitializeRuntime } from "./runtime";

export async function configureRuntime(
  ctx: RuntimeContext,
  options: InitializeOptions,
  { runtimeConfig, tsConfig }: InitializeCatalogResult,
) {
  const scope = createInitializeRuntime(ctx);
  const builtinPlugins = scope.buildBuiltinPluginCatalog(runtimeConfig);
  scope.builtinPluginIDs = new Set(builtinPlugins.map((entry) => entry.id));
  scope.activeExternalPluginConfigFingerprint =
    scope.externalPluginConfigFingerprint(tsConfig.config);
  await scope.mountRuntimePlugins({
    controller: scope.pluginsController,
    builtins: builtinPlugins,
    settings: scope.tsRuntimeConfig?.plugins.settings,
    loadExternal: scope.extensionEnabled("plugins"),
  });
  scope.activeCheckpointFactory =
    scope.capabilityRegistry.service<CheckpointFactory>(
      scope.CHECKPOINT_FACTORY_SERVICE,
    );
  // The workspace built-in provides these services during its setup; every
  // consumer below runs after this point.
  scope.workspaceWriteLock =
    scope.capabilityRegistry.service<WorkspaceWriteLock>(
      scope.WORKSPACE_WRITE_LOCK_SERVICE,
    );
  scope.mutationRegistry = scope.capabilityRegistry.service<MutationRegistry>(
    scope.WORKSPACE_MUTATIONS_SERVICE,
  );
  scope.workspaceFilesController =
    scope.capabilityRegistry.service<WorkspaceFilesController>(
      scope.WORKSPACE_FILES_SERVICE,
    );
  scope.terminalController =
    scope.capabilityRegistry.service<TerminalController>(
      scope.TERMINAL_CONTROLLER_SERVICE,
    );
  scope.sandboxController = scope.capabilityRegistry.service<SandboxService>(
    scope.SANDBOX_SERVICE,
  );
  scope.mcpService = scope.capabilityRegistry.service<McpService>(
    scope.MCP_SERVICE,
  );
  scope.subagentsController =
    scope.capabilityRegistry.service<SubagentsService>(scope.SUBAGENTS_SERVICE);
  const resolvedSessionStore =
    scope.capabilityRegistry.service<SessionStoreController>(
      scope.SESSION_STORE_CONTROLLER_SERVICE,
    );
  if (!resolvedSessionStore)
    throw new Error("session store unavailable (natalia-session-store)");
  scope.sessionStoreController = resolvedSessionStore;
  scope.toolPolicy = scope.capabilityRegistry.service<ToolPolicyService>(
    scope.TOOL_POLICY_SERVICE,
  );
  if (!scope.toolPolicy)
    throw new Error("tool pipeline unavailable (natalia-tool-pipeline)");
  const resolvedWaiter = scope.capabilityRegistry.service<InteractiveWaiter>(
    scope.COLLABORATION_WAITER_SERVICE,
  );
  if (!resolvedWaiter)
    throw new Error("collaboration waiter unavailable (natalia-collaboration)");
  scope.interactive = resolvedWaiter;
  const resolvedProviderModel =
    scope.capabilityRegistry.service<ProviderModelController>(
      scope.PROVIDER_MODEL_CONTROLLER_SERVICE,
    );
  scope.providerModelController = resolvedProviderModel;
  scope.taskWorkflowController =
    scope.capabilityRegistry.service<TaskWorkflowController>(
      scope.TASK_WORKFLOW_CONTROLLER_SERVICE,
    );
  scope.agentToolLayer = scope.toolPolicy.createHookLayer();
  scope.permissionProfileToolLayer = scope.toolPolicy.createHookLayer();
  scope.moduleToolLayer = scope.toolPolicy.createHookLayer(
    options.taskModuleContext
      ? scope.moduleToolPolicy(options.taskModuleContext.moduleType)
      : undefined,
  );
  scope.modulePermissionToolLayer = scope.toolPolicy.createHookLayer(
    options.taskModuleContext?.modulePermissions?.tools,
  );
  scope.toolLayer = scope.toolPolicy!.createHookLayer(options.toolPolicy, {
    preExecute: async (event) => {
      // System control, not a capability: an allow-list that forgets it must not
      // be able to make module completion impossible.
      if (
        options.taskModuleContext &&
        event.toolName === "flow_module_complete"
      )
        return { allowed: true, diagnostics: [] };
      const exec = scope.executionForTurn(event.turnID);
      const agent = exec ? exec.selectedAgent : scope.selectedAgent;
      const profile = exec
        ? exec.permissionProfile
        : scope.selectedPermissionProfile;
      const agentResult = await (
        exec ? scope.agentPolicyLayer(agent) : scope.agentToolLayer
      ).preExecute(event);
      if (!agentResult.allowed) return agentResult;
      const profileResult = await (
        exec
          ? scope.permissionProfileLayer(profile)
          : scope.permissionProfileToolLayer
      ).preExecute(event);
      if (!profileResult.allowed) return profileResult;
      const moduleResult = await scope.moduleToolLayer.preExecute(event);
      if (!moduleResult.allowed)
        return {
          ...moduleResult,
          diagnostics: [
            `blocked outside active ${options.taskModuleContext?.moduleType} module: ${event.toolName}`,
          ],
        };
      const modulePermissionToolResult =
        await scope.modulePermissionToolLayer.preExecute(event);
      if (!modulePermissionToolResult.allowed)
        return modulePermissionToolResult;
      const extensionResult = scope.extensionToolPermission(
        event.toolName,
        profile,
      );
      if (!extensionResult.allowed) return extensionResult;
      const permission = scope.toolPolicy!.evaluatePermissionRules(
        agent?.permissions,
        event.toolName,
        scope.tryParseToolArguments(event.arguments),
        scope.workspaceRoot,
      );
      if (!permission.allowed) return permission;
      const profilePermission = scope.toolPolicy!.evaluatePermissionRules(
        profile?.permissions,
        event.toolName,
        scope.tryParseToolArguments(event.arguments),
        scope.workspaceRoot,
      );
      if (!profilePermission.allowed) return profilePermission;
      const args = scope.tryParseToolArguments(event.arguments);
      const modulePermission = scope.toolPolicy!.evaluatePermissionRules(
        options.taskModuleContext?.modulePermissions,
        event.toolName,
        args,
        scope.workspaceRoot,
      );
      if (!modulePermission.allowed) return modulePermission;
      const bufferedProfileCommandPermission =
        await scope.terminalCommandBuffer.evaluate(
          [
            profile?.commandRules,
            options.taskModuleContext?.moduleCommandRules,
          ].filter((rules): rules is PermissionProfileCommandRules =>
            Boolean(rules),
          ),
          event.toolName,
          args,
          [
            profile?.interactivePrograms,
            options.taskModuleContext?.moduleInteractivePrograms,
          ],
        );
      const profileCommandPermission =
        bufferedProfileCommandPermission ??
        (await scope.evaluatePermissionProfileCommandRules(
          profile?.commandRules,
          event.toolName,
          args,
        ));
      if (!profileCommandPermission.allowed) return profileCommandPermission;
      if (!bufferedProfileCommandPermission) {
        const moduleCommandPermission =
          await scope.evaluatePermissionProfileCommandRules(
            options.taskModuleContext?.moduleCommandRules,
            event.toolName,
            args,
            "active module",
          );
        if (!moduleCommandPermission.allowed) return moduleCommandPermission;
      }
      return (
        (await options.hooks?.preExecute?.(event)) ?? {
          allowed: true,
          diagnostics: [],
        }
      );
    },
    postExecute: options.hooks?.postExecute,
  });
  scope.retryPolicy = {
    maxAttemptsPerStep: tsConfig.config.runtime.retry.maxAttemptsPerStep,
    initialBackoffMs: tsConfig.config.runtime.retry.initialBackoffMs,
    maxBackoffMs: tsConfig.config.runtime.retry.maxBackoffMs,
    jitterMs: tsConfig.config.runtime.retry.jitterMs,
  };
  scope.maxSteps = tsConfig.config.runtime.maxStepsPerTurn;
  // The fan-out ceiling: parallel sub-agent streams take a slot per
  // scope.provider instead of tripping rate limits.
  scope.providerConcurrencyLimiter = new scope.ProviderConcurrencyLimiter(
    tsConfig.config.runtime.providerConcurrency ?? {},
  );
  // The config is a kernel service provided by the runtime-config built-in
  // plugin; plugins and tool families resolve it by name and subscribe to
  // its updates.
  if (
    options.permissionProfile &&
    !tsConfig.config.permissionProfiles[options.permissionProfile]
  )
    throw new Error(
      `permission profile not found: ${options.permissionProfile}`,
    );
  if (
    (scope.selectedPermissionProfile?.commandRules &&
      scope.selectedPermissionProfile.commandRules.mode !== "none") ||
    (options.taskModuleContext?.moduleCommandRules &&
      options.taskModuleContext.moduleCommandRules.mode !== "none")
  )
    await scope.ensureBashCommandParser();
  scope.agentRegistry = scope.agentsFromConfig(tsConfig.config);
  scope.selectedAgent = scope.agentRegistry.default();
  if (Object.keys(tsConfig.config.agents).length && !scope.selectedAgent)
    scope.publish({
      type: "diagnostic",
      level: "warning",
      message:
        "TS config has no selectable primary agent; continuing with the configured default model.",
    });
  if (!options.provider) {
    const configured = scope.providerForModel(
      tsConfig.config,
      scope.selectedAgent?.model ?? tsConfig.config.defaultModel,
      scope.selectedAgent?.variant,
    );
    if (configured) {
      scope.provider = configured;
      scope.providerSource = "ts_config";
      scope.publish({
        type: "diagnostic",
        level: "info",
        message:
          "Loaded provider/model/runtime settings from .natalia/config.json; API key remains in memory only.",
      });
    } else if (
      tsConfig.sources.some(
        (source) => source.scope !== "defaults" && source.applied,
      )
    ) {
      scope.publish({
        type: "diagnostic",
        level: "warning",
        message:
          "TS config has no complete provider/model/API-key selection; configure a provider or environment credential.",
      });
    }
  }
  scope.runtimeContextConfig = await scope.resolveContextStatusConfig(
    tsConfig.config,
    scope.provider,
    scope.contextWindowResolver,
    scope.modelRefKeyForSelection(scope.selectedAgent, scope.selectedModel),
  );
  scope.applyAgentPolicy();
}
