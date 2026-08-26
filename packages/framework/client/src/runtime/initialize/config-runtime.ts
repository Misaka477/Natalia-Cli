import type {
  InitializeCatalogResult,
  InitializeOptions,
  InteractiveWaiter,
  PermissionProfileCommandRules,
  RuntimeContext,
  SessionStoreController,
  ToolPolicyService,
} from "../context";
import { createInitializeRuntime } from "./runtime";

export async function configureRuntime(
  ctx: RuntimeContext,
  options: InitializeOptions,
  { runtimeConfig, tsConfig }: InitializeCatalogResult,
) {
  const scope = createInitializeRuntime(ctx);
  ctx.state.frameworkServices = await scope.wireFrameworkServices(ctx, options);
  await scope.mountPlugins({
    controller: scope.pluginsController,
    config: tsConfig.config.plugins,
  });
  const resolvedSessionStore = scope.resolveService<SessionStoreController>(
    scope.SESSION_STORE_CONTROLLER_SERVICE,
  );
  if (!resolvedSessionStore)
    throw new Error("session store unavailable (natalia-session-store)");
  const toolPolicy = scope.resolveService<ToolPolicyService>(
    scope.TOOL_POLICY_SERVICE,
  );
  if (!toolPolicy)
    throw new Error("tool pipeline unavailable (natalia-tool-pipeline)");
  const resolvedWaiter = scope.capabilityRegistry.service<InteractiveWaiter>(
    scope.COLLABORATION_WAITER_SERVICE,
  );
  if (!resolvedWaiter)
    throw new Error("collaboration waiter unavailable (natalia-collaboration)");
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
