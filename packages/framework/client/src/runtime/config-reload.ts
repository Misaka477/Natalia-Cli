/**
 * Config reload — runtime/config-reload.ts.
 *
 * `applyConfigFromDisk` and `reloadConfigFromDisk` re-read the resolved config
 * and apply it live: runtime limits, permission settings, the agent registry,
 * the default plugin catalog and provider re-selection. Reads and writes host
 * state through `RuntimeContext` ports.
 */
import { agentsFromConfig } from "@natalia/agent";
import { resolveConfig } from "@natalia/config";
import { ensureBashCommandParser } from "@natalia/tools";
import { ProviderConcurrencyLimiter, providerForModel } from "@natalia/runtime";
import {
  CHECKPOINT_FACTORY_SERVICE,
  type CheckpointFactory,
} from "@natalia/runtime-services";
import type { ConfigV3, SessionID } from "@natalia/contracts";
import type { RuntimeContext } from "./context";
import type { RealRuntimeClientOptions } from "./options";

/**
 * The checkpoint factory owns per-session controllers; a config reload must
 * reset them so the next initialization reads the new checkpoint settings.
 */
function resetCheckpointFactory(ctx: RuntimeContext) {
  ctx.ports
    .resolveService<
      CheckpointFactory & { close?(): void }
    >(CHECKPOINT_FACTORY_SERVICE)
    ?.close?.();
}

export function createConfigReload(
  ctx: RuntimeContext,
  options: RealRuntimeClientOptions,
) {
  let reloadQueue = Promise.resolve<{
    read: boolean;
    providerReconfigured: boolean;
    reason?: string;
  }>({ read: false, providerReconfigured: false });

  return {
    configReloadBlockedReason,
    applyConfigFromDisk,
    reloadConfigFromDisk,
  };

  function configReloadBlockedReason() {
    const { getExecutionBySession, getInteractive } = ctx.ports;
    if ([...getExecutionBySession().values()].some((exec) => exec.activeTurnID))
      return "runtime config cannot be applied while a turn is running";
    if (getInteractive()?.hasPendingWaiters())
      return "runtime config cannot be applied while an approval or question is pending";
    return undefined;
  }

  /**
   * Reloads config from disk and applies it, answering value-style. Shared by
   * `reloadConfig` and `updateConfig` so the two write-apply paths cannot
   * drift.
   */
  async function applyConfigFromDisk(): Promise<{
    applied: boolean;
    reason?: string;
  }> {
    const { publish, scheduleRuntimeStatusSnapshot } = ctx.ports;
    const blocked = configReloadBlockedReason();
    if (blocked) return { applied: false, reason: blocked };
    const reloaded = await reloadConfigFromDisk();
    if (!reloaded.read) {
      const reason = "runtime config on disk could not be read";
      publish({ type: "diagnostic", level: "warning", message: reason });
      return { applied: false, reason };
    }
    if (reloaded.reason) {
      publish({
        type: "diagnostic",
        level: "warning",
        message: reloaded.reason,
      });
      return { applied: false, reason: reloaded.reason };
    }
    publish({
      type: "diagnostic",
      level: "info",
      message: reloaded.providerReconfigured
        ? "runtime config reloaded; provider reconfigured from disk"
        : "runtime config reloaded; provider unchanged",
    });
    scheduleRuntimeStatusSnapshot();
    return { applied: true };
  }

  async function reloadConfigFromDisk(): Promise<{
    read: boolean;
    providerReconfigured: boolean;
    reason?: string;
  }> {
    const reload = reloadQueue.then(applyReloadFromDisk, applyReloadFromDisk);
    reloadQueue = reload;
    return await reload;
  }

  async function applyReloadFromDisk(): Promise<{
    read: boolean;
    providerReconfigured: boolean;
    reason?: string;
  }> {
    const {
      getWorkspaceRoot,
      getExecutionBySession,
      getTsRuntimeConfig,
      setTsRuntimeConfig,
      setMaxSteps,
      setRetryPolicy,
      setProviderConcurrencyLimiter,
      getSelectedAgent,
      setSelectedAgent,
      setAgentRegistry,
      getPermissionMode,
      getSelectedPermissionProfile,
      setPermissionMode,
      setSelectedPermissionProfile,
      getTools,
      getPluginsController,
      applyAgentPolicy,
      setProvider,
      getProviderSource,
      setProviderSource,
      getContextWindowResolver,
      refreshExecutionContextConfig,
      modelRefKeyForSelection,
      runPluginLifecyclePostReconcile,
      publishToolCatalogChanges,
    } = ctx.ports;
    const workspaceRoot = getWorkspaceRoot();
    const previous = captureReloadState();
    try {
      const tsConfig = await resolveConfig({
        workspaceRoot,
        globalPath: options.globalConfigPath,
      });
      setTsRuntimeConfig(tsConfig.config);
      resetCheckpointFactory(ctx);
      setMaxSteps(tsConfig.config.runtime.maxStepsPerTurn);
      setRetryPolicy({
        maxAttemptsPerStep: tsConfig.config.runtime.retry.maxAttemptsPerStep,
        initialBackoffMs: tsConfig.config.runtime.retry.initialBackoffMs,
        maxBackoffMs: tsConfig.config.runtime.retry.maxBackoffMs,
        jitterMs: tsConfig.config.runtime.retry.jitterMs,
      });
      setProviderConcurrencyLimiter(
        new ProviderConcurrencyLimiter(
          tsConfig.config.runtime.providerConcurrency ?? {},
        ),
      );
      const selectedAgentName = getSelectedAgent()?.name;
      const agentRegistry = agentsFromConfig(tsConfig.config);
      setAgentRegistry(agentRegistry);
      setSelectedAgent(
        selectedAgentName
          ? (agentRegistry.select(selectedAgentName) ?? agentRegistry.default())
          : agentRegistry.default(),
      );
      for (const exec of getExecutionBySession().values()) {
        const name = exec.selectedAgent?.name;
        exec.selectedAgent = name
          ? (agentRegistry.select(name) ?? agentRegistry.default())
          : agentRegistry.default();
      }
      // Permission changes (default profile switch, auto/ask flip, profile
      // edits) apply immediately, not on the next restart.
      ctx.ports.reloadPermissionSettings(tsConfig.config);
      ctx.state.frameworkServices?.refreshRuntimeConfig();
      const permissionMode = getPermissionMode();
      const selectedPermissionProfile = getSelectedPermissionProfile();
      for (const exec of getExecutionBySession().values()) {
        exec.permissionMode = permissionMode;
        exec.permissionProfile = selectedPermissionProfile;
      }
      const toolsBeforeReconcile = new Set(getTools().keys());
      const selectedSkills = new Map(
        [...getExecutionBySession().entries()].flatMap(([id, exec]) =>
          exec.activeSkill ? [[id, exec.activeSkill.qualifiedName]] : [],
        ),
      );
      await getPluginsController().reconcileDesired(
        [],
        tsConfig.config.plugins,
      );
      await runPluginLifecyclePostReconcile(selectedSkills);
      publishToolCatalogChanges(toolsBeforeReconcile);
      applyAgentPolicy();
      if (
        selectedPermissionProfile?.commandRules &&
        selectedPermissionProfile.commandRules.mode !== "none"
      )
        await ensureBashCommandParser().catch(() => undefined);
      if (!options.provider) {
        const configured = providerForModel(
          tsConfig.config,
          getSelectedAgent()?.model ?? tsConfig.config.defaultModel,
          getSelectedAgent()?.variant,
        );
        if (configured) {
          setProvider(configured);
          setProviderSource("ts_config");
          for (const exec of getExecutionBySession().values())
            ctx.ports.applyAgentProvider(exec);
          ctx.ports.setRuntimeContextConfig(
            await ctx.ports.resolveContextStatusConfig(
              tsConfig.config,
              configured,
              getContextWindowResolver(),
              modelRefKeyForSelection(getSelectedAgent(), undefined),
            ),
          );
          for (const exec of getExecutionBySession().values())
            await refreshExecutionContextConfig(exec);
          return { read: true, providerReconfigured: true };
        }
      }
      ctx.ports.setRuntimeContextConfig(
        await ctx.ports.resolveContextStatusConfig(
          tsConfig.config,
          ctx.ports.getProvider(),
          getContextWindowResolver(),
          modelRefKeyForSelection(getSelectedAgent(), undefined),
        ),
      );
      for (const exec of getExecutionBySession().values())
        await refreshExecutionContextConfig(exec);
      return { read: true, providerReconfigured: false };
    } catch (error) {
      let rollbackError: unknown;
      try {
        await rollbackReload(previous);
      } catch (failure) {
        rollbackError = failure;
      }
      const reason = error instanceof Error ? error.message : String(error);
      return {
        read: true,
        providerReconfigured: false,
        reason: `runtime config could not be applied: ${reason}${
          rollbackError === undefined
            ? ""
            : `; rollback failed: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`
        }`,
      };
    }
  }

  function captureReloadState() {
    const ports = ctx.ports;
    return {
      config: ports.getTsRuntimeConfig(),
      maxSteps: ports.getMaxSteps(),
      retryPolicy: ports.getRetryPolicy(),
      limiter: ports.getProviderConcurrencyLimiter(),
      agentRegistry: ports.getAgentRegistry(),
      selectedAgent: ports.getSelectedAgent(),
      permissionMode: ports.getPermissionMode(),
      selectedPermissionProfile: ports.getSelectedPermissionProfile(),
      defaultPermissionMode: ports.getDefaultPermissionMode(),
      defaultPermissionProfile: ports.getDefaultPermissionProfile(),
      provider: ports.getProvider(),
      providerSource: ports.getProviderSource(),
      runtimeContextConfig: ports.getRuntimeContextConfig(),
      executions: new Map(
        [...ports.getExecutionBySession()].map(([id, exec]) => [
          id,
          {
            selectedAgent: exec.selectedAgent,
            permissionMode: exec.permissionMode,
            permissionProfile: exec.permissionProfile,
            provider: exec.provider,
            runtimeContextConfig: exec.runtimeContextConfig,
            activeSkill: exec.activeSkill?.qualifiedName,
          },
        ]),
      ),
    };
  }

  async function rollbackReload(
    previous: ReturnType<typeof captureReloadState>,
  ) {
    const ports = ctx.ports;
    ports.setTsRuntimeConfig(previous.config);
    resetCheckpointFactory(ctx);
    ports.setMaxSteps(previous.maxSteps);
    ports.setRetryPolicy(previous.retryPolicy);
    ports.setProviderConcurrencyLimiter(previous.limiter);
    if (previous.agentRegistry) ports.setAgentRegistry(previous.agentRegistry);
    ports.setSelectedAgent(previous.selectedAgent);
    ports.setPermissionMode(previous.permissionMode);
    ports.setSelectedPermissionProfile(previous.selectedPermissionProfile);
    ports.setDefaultPermissionMode(previous.defaultPermissionMode);
    ports.setDefaultPermissionProfile(previous.defaultPermissionProfile);
    ctx.state.frameworkServices?.refreshRuntimeConfig();
    ports.setProvider(previous.provider);
    ports.setProviderSource(previous.providerSource);
    ports.setRuntimeContextConfig(previous.runtimeContextConfig);
    for (const [id, state] of previous.executions) {
      const exec = ports.getExecutionBySession().get(id);
      if (!exec) continue;
      exec.selectedAgent = state.selectedAgent;
      exec.permissionMode = state.permissionMode;
      exec.permissionProfile = state.permissionProfile;
      exec.provider = state.provider;
      exec.runtimeContextConfig = state.runtimeContextConfig;
    }
    ports.applyAgentPolicy();
    if (!previous.config) return;
    await ports
      .getPluginsController()
      .reconcileDesired([], previous.config.plugins);
    const selectedSkills = new Map(
      [...previous.executions].flatMap(([id, state]) =>
        state.activeSkill ? [[id, state.activeSkill]] : [],
      ),
    );
    await ports.runPluginLifecyclePostReconcile(selectedSkills);
  }
}
