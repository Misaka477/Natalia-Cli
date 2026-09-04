/**
 * Provider and model selection — runtime/provider-selection module.
 *
 * Resolves the effective `provider/model` for a session, refreshes per-session
 * execution context config, and exposes the model catalog and capability
 * helpers. Reads host state and writes the shared provider/model selection
 * through `RuntimeContext` ports at call time.
 */
import {
  buildModelCatalog,
  modelSelectionStatus,
  resolveEffectiveModel,
} from "@natalia/config";
import { modelRefKey, parseModelRef, type ModelRef } from "@natalia/contracts";
import {
  modelsDevModelLimits,
  providerForModel,
  resolveReservedOutputTokens,
  type StreamingProvider,
} from "@natalia/runtime";
import { deriveModelRefKey } from "../model-ref-key";
import type { AgentDefinition } from "@natalia/agent";
import type { ConfigV3, ModelCapabilities } from "@natalia/contracts";
import type { ContextWindowResolver } from "@natalia/runtime";
import type { SessionExecutionState } from "./context";
import type { RuntimeContext } from "./context";
import type { RuntimeContextStatusConfig } from "./status-config";
import type { RealRuntimeClientOptions } from "./options";

export function defaultContextStatusConfig(): RuntimeContextStatusConfig {
  return {
    max: Math.max(32_000, Number(process.env.NATALIA_CONTEXT_WINDOW ?? 32_000)),
    thresholdPercent: Number(process.env.NATALIA_CONTEXT_THRESHOLD ?? 85),
    reserved: Math.max(
      1,
      Number(process.env.NATALIA_CONTEXT_RESERVED ?? 20_000),
    ),
  };
}

async function resolveContextStatusConfig(
  config: ConfigV3,
  provider: StreamingProvider | undefined,
  resolver: ContextWindowResolver,
  selectedRef?: string,
) {
  if (!selectedRef && !config.defaultModel) return defaultContextStatusConfig();
  const effective = resolveEffectiveModel(
    config,
    selectedRef ?? config.defaultModel!,
  );
  if (!effective) return defaultContextStatusConfig();
  const executingModel = provider?.model ?? effective.ref.model;
  const selectionMatchesProvider = executingModel === effective.ref.model;
  const executingProvider = selectionMatchesProvider
    ? effective.providerID
    : (provider?.provider ?? effective.providerID);
  const providerConfig = config.providers[executingProvider];
  const canProbeExecutingProvider =
    selectionMatchesProvider || !!providerConfig;
  const contextWindow = await resolver.resolve({
    provider: executingProvider,
    model: executingModel,
    baseURL: providerConfig?.connection?.baseURL,
    apiKey: providerConfig?.connection?.apiKey,
    explicitContextWindow: selectionMatchesProvider
      ? effective.limits.contextWindow
      : undefined,
    providerAdapter:
      config.context.autoDetectWindow &&
      canProbeExecutingProvider &&
      shouldProbeProviderMetadata(providerConfig?.connection?.baseURL)
        ? provider
        : undefined,
    useModelsDevCatalog: config.context.autoDetectWindow,
  });
  const catalog = config.context.autoDetectWindow
    ? await modelsDevModelLimits(executingProvider, executingModel)
    : undefined;
  const providerMetadata =
    catalog ||
    !canProbeExecutingProvider ||
    !shouldProbeProviderMetadata(providerConfig?.connection?.baseURL)
      ? undefined
      : await provider?.listModels?.().catch(() => undefined);
  const discoveredOutput = providerMetadata?.find(
    (model) => model.id === executingModel,
  )?.maxOutputTokens;
  const reserved = resolveReservedOutputTokens({
    configuredReserved: config.context.reservedOutputTokens,
    explicitMaxOutputTokens: selectionMatchesProvider
      ? effective.limits.maxOutputTokens
      : undefined,
    providerOutputLimit: discoveredOutput,
    catalogOutputLimit: catalog?.maxOutputTokens,
    contextWindow: contextWindow.tokens,
  });
  return {
    max: contextWindow.tokens,
    thresholdPercent: config.context.compactionThresholdPercent,
    reserved: Math.min(
      contextWindow.tokens,
      reserved.source === "config"
        ? reserved.tokens
        : Math.min(20_000, reserved.tokens),
    ),
  };
}

function shouldProbeProviderMetadata(baseURL?: string) {
  if (!baseURL) return true;
  try {
    const hostname = new URL(baseURL).hostname;
    return (
      hostname !== "localhost" && hostname !== "127.0.0.1" && hostname !== "::1"
    );
  } catch {
    return false;
  }
}

export function createProviderSelection(
  ctx: RuntimeContext,
  options: RealRuntimeClientOptions,
) {
  return {
    currentModelImageInput,
    currentModelPdfInput,
    modelCapabilitiesForExecution,
    mediaTypeForImage,
    applyAgentProvider,
    refreshExecutionContextConfig,
    modelRefKeyForSelection,
    selectedModelRefKey,
    effectiveMaxSteps,
    redactToolOutputEnabled,
    selectRuntimeModel,
    clientModelCatalog,
    defaultContextStatusConfig,
    resolveContextStatusConfig,
  };

  function currentModelImageInput(
    exec: SessionExecutionState | undefined,
  ): boolean {
    const { getTsRuntimeConfig, getSelectedAgent, getSelectedModel } =
      ctx.ports;
    if (exec?.activeModelCapabilities)
      return exec.activeModelCapabilities.imageInput;
    const ref = modelRefKeyForSelection(
      exec ? exec.selectedAgent : getSelectedAgent(),
      exec ? exec.selectedModel : getSelectedModel(),
    );
    const tsRuntimeConfig = getTsRuntimeConfig();
    if (!ref || !tsRuntimeConfig) return false;
    return (
      resolveEffectiveModel(tsRuntimeConfig, ref)?.capabilities.imageInput ??
      false
    );
  }

  function currentModelPdfInput(
    exec: SessionExecutionState | undefined,
  ): boolean {
    const { getTsRuntimeConfig, getSelectedAgent, getSelectedModel } =
      ctx.ports;
    if (exec?.activeModelCapabilities)
      return exec.activeModelCapabilities.pdfInput;
    const ref = modelRefKeyForSelection(
      exec ? exec.selectedAgent : getSelectedAgent(),
      exec ? exec.selectedModel : getSelectedModel(),
    );
    const tsRuntimeConfig = getTsRuntimeConfig();
    if (!ref || !tsRuntimeConfig) return false;
    return (
      resolveEffectiveModel(tsRuntimeConfig, ref)?.capabilities.pdfInput ??
      false
    );
  }

  function modelCapabilitiesForExecution(
    exec: SessionExecutionState | undefined,
  ): ModelCapabilities {
    const { getTsRuntimeConfig } = ctx.ports;
    const agent = exec?.selectedAgent;
    const model = exec?.selectedModel;
    const ref = modelRefKeyForSelection(agent, model);
    const tsRuntimeConfig = getTsRuntimeConfig();
    return (
      (ref && tsRuntimeConfig
        ? resolveEffectiveModel(tsRuntimeConfig, ref)?.capabilities
        : undefined) ?? {
        toolCall: true,
        reasoning: true,
        thinking: true,
        imageInput: false,
        pdfInput: false,
        videoInput: false,
      }
    );
  }

  function mediaTypeForImage(
    path: string,
  ): "image/png" | "image/jpeg" | "image/webp" | "image/gif" {
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "webp") return "image/webp";
    if (ext === "gif") return "image/gif";
    return "image/png";
  }

  function applyAgentProvider(
    exec: SessionExecutionState | undefined,
  ) {
    const {
      getTsRuntimeConfig,
      getProviderSource,
      getSelectedAgent,
      getSelectedModel,
      getActiveExec,
      setProvider,
      publishForSession,
    } = ctx.ports;
    if (options.provider || getProviderSource() !== "ts_config") return;
    const tsRuntimeConfig = getTsRuntimeConfig();
    if (!tsRuntimeConfig) return;
    const selectedAgent = getSelectedAgent();
    const selectedModel = getSelectedModel();
    const agent = exec ? exec.selectedAgent : selectedAgent;
    const model = exec ? exec.selectedModel : selectedModel;
    const ref = modelRefKeyForSelection(agent, model);
    if (!ref) {
      publishForSession(exec, {
        type: "diagnostic",
        level: "warning",
        message: `agent ${agent?.name ?? "default"} model override is unavailable: model_not_configured; retaining current provider`,
      });
      return;
    }
    const next = providerForModel(
      tsRuntimeConfig,
      ref,
      agent?.variant ?? model?.variant,
      { reasoningEffort: exec?.reasoningEffort },
    );
    if (!next) {
      const status = modelSelectionStatus(tsRuntimeConfig, ref);
      publishForSession(exec, {
        type: "diagnostic",
        level: "warning",
        message: `agent ${agent?.name ?? "default"} model override is unavailable: ${status.reason ?? "provider_not_configured"}; retaining current provider`,
      });
      return;
    }
    if (exec) exec.provider = next;
    if (!exec || exec === getActiveExec()) setProvider(next);
  }

  async function refreshExecutionContextConfig(exec: SessionExecutionState) {
    const {
      getTsRuntimeConfig,
      getContextWindowResolver,
      getActiveExec,
      setRuntimeContextConfig,
    } = ctx.ports;
    const tsRuntimeConfig = getTsRuntimeConfig();
    if (!tsRuntimeConfig) return;
    exec.runtimeContextConfig = await resolveContextStatusConfig(
      tsRuntimeConfig,
      exec.provider,
      getContextWindowResolver(),
      modelRefKeyForSelection(exec.selectedAgent, exec.selectedModel),
    );
    if (exec === getActiveExec())
      setRuntimeContextConfig(exec.runtimeContextConfig);
  }

  /** The canonical `provider/model` key of the effective model selection. */
  function modelRefKeyForSelection(
    agent: AgentDefinition | undefined,
    model: { modelID?: string; variant?: string } | undefined,
  ): string | undefined {
    const { getTsRuntimeConfig } = ctx.ports;
    return deriveModelRefKey({
      agent,
      model,
      defaultModel: getTsRuntimeConfig()?.defaultModel,
    });
  }

  function selectedModelRefKey() {
    const { getSelectedAgent, getSelectedModel } = ctx.ports;
    return modelRefKeyForSelection(getSelectedAgent(), getSelectedModel());
  }

  function effectiveMaxSteps(
    exec: SessionExecutionState | undefined,
  ) {
    const { getSelectedAgent, getMaxSteps } = ctx.ports;
    return (
      (exec ? exec.selectedAgent : getSelectedAgent())?.maxSteps ??
      getMaxSteps() ??
      Number.POSITIVE_INFINITY
    );
  }

  /**
   * Redaction precedence, matching how the other boundaries resolve: an agent
   * that states a value wins, then the workspace `security.redactToolOutput`
   * setting, then the schema default.
   */
  function redactToolOutputEnabled(
    exec: SessionExecutionState | undefined,
  ) {
    const { getSelectedAgent, getTsRuntimeConfig } = ctx.ports;
    return (
      (exec ? exec.selectedAgent : getSelectedAgent())?.permissions
        ?.redactOutput ??
      getTsRuntimeConfig()?.security.redactToolOutput ??
      true
    );
  }

  async function selectRuntimeModel(
    modelID?: string,
    variant?: string,
    exec?: SessionExecutionState | undefined,
  ) {
    const {
      getReady,
      getTsRuntimeConfig,
      getActiveExec,
      setSelectedModel,
      publishForSession,
    } = ctx.ports;
    await getReady();
    const tsRuntimeConfig = getTsRuntimeConfig();
    if (!tsRuntimeConfig) throw new Error("runtime config is unavailable");
    let ref: ModelRef | undefined;
    if (modelID) {
      ref = parseModelRef(modelID);
      const status = modelSelectionStatus(tsRuntimeConfig, ref);
      if (!status.selected)
        throw new Error(`model is unavailable: ${status.reason ?? modelID}`);
    } else if (variant) {
      throw new Error("a variant requires a selected model");
    }
    // V3 dropped model variants: the variant is carried as an opaque label for
    // event/selection compatibility but never validated against a model.
    const nextSelection = ref
      ? { modelID: modelRefKey(ref), variant }
      : undefined;
    if (exec) exec.selectedModel = nextSelection;
    if (exec === getActiveExec()) setSelectedModel(nextSelection);
    applyAgentProvider(exec);
    if (exec) await refreshExecutionContextConfig(exec);
    publishForSession(exec, {
      type: "model.selection",
      modelID: ref ? modelRefKey(ref) : undefined,
      variant,
    });
  }

  async function clientModelCatalog() {
    const { getReady, getTsRuntimeConfig } = ctx.ports;
    await getReady();
    const config = getTsRuntimeConfig();
    if (!config) return [];
    return buildModelCatalog(config).flatMap((provider) =>
      provider.models
        .filter(
          (entry) =>
            modelSelectionStatus(
              config,
              modelRefKey({ provider: provider.id, model: entry.id }),
            ).selected,
        )
        .map((entry) => ({
          id: modelRefKey({ provider: provider.id, model: entry.id }),
          name: entry.name,
          provider: provider.id,
          // V3 removed model variants; the catalog exposes none.
          variants: [] as string[],
        })),
    );
  }
}
