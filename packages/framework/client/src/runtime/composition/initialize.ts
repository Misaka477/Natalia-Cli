import { createHash } from "node:crypto";
import { agentsFromConfig } from "@natalia/agent";
import { resolveConfig } from "@natalia/config";
import {
  contextEntriesToProviderMessages,
  contextStatusEvent,
  MAX_STEPS_PROMPT,
  MISSING_FINAL_RESPONSE_FALLBACK,
  nativeToolCallCorrection,
  normalizeRawToolCallProtocol,
  ProviderConcurrencyLimiter,
  providerForModel,
  requireNativeToolCallProtocol,
  withProviderConcurrency,
} from "@natalia/runtime";
import {
  modelVisibleEvents,
  projectInteractiveRequests,
  projectSession,
  sessionRunCoordinator,
  settleInterruptedTurnIDs,
  settleInterruptedTurns,
} from "@natalia/session";
import {
  readOnlyToolMessage,
  ATTACHMENT_SERVICE,
  GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
  PROVIDER_MODEL_CONTROLLER_SERVICE,
  SANDBOX_SERVICE,
  SESSION_STORE_CONTROLLER_SERVICE,
  STATUS_SNAPSHOT_CONTROLLER_SERVICE,
  SUBAGENTS_SERVICE,
  TOOL_POLICY_SERVICE,
  TURN_CONTROLLER_SERVICE,
  WORK_LEDGER_CONTROLLER_SERVICE,
} from "@natalia/runtime-services";
import {
  cleanupToolOutput,
  ensureBashCommandParser,
  evaluatePermissionProfileCommandRules,
} from "@natalia/tools";
import { mountPlugins } from "../../plugin-mount";
import { wireFrameworkServices } from "../initialize/framework-services";
import { createInitialize } from "../initialize";
import type { RuntimeContext } from "../context";
import type { RealRuntimeClientOptions } from "../options";
import { lineCount } from "./helpers";

const WAITING_TOOLS = new Set(["terminal_observe"]);
const MAX_PROTOCOL_CORRECTIONS = 2;

function sessionSeed(workspaceRoot: string) {
  return createHash("sha256").update(workspaceRoot).digest("hex").slice(0, 12);
}

export function wireInitialize(
  ctx: RuntimeContext,
  options: RealRuntimeClientOptions,
  features: ReturnType<typeof import("./features").wireFeatures> &
    ReturnType<typeof import("./execution").wireExecution>,
  createRuntimeClient: typeof import("../main").createRealRuntimeClient,
) {
  const { state, ports } = ctx;
  const drainSession = async (signal: AbortSignal) => {
    const controller = ports.resolveService<
      import("@natalia/runtime-services").TurnController
    >(TURN_CONTROLLER_SERVICE);
    if (!controller) throw new Error("turn orchestration unavailable");
    await controller.drain(signal, state.sessionID);
  };
  state.initialize = {
    resolveConfig,
    reloadPermissionSettings: features.permissions.reloadPermissionSettings,
    skillsPluginInput: features.pluginAssembly.skillsPluginInput,
    localToolsPluginInput: features.pluginAssembly.localToolsPluginInput,
    mcpPluginInput: features.pluginAssembly.mcpPluginInput,
    providerModelPluginInput: features.pluginAssembly.providerModelPluginInput,
    wireFrameworkServices,
    capabilityRegistry: state.capabilityRegistry,
    serviceDirectory: state.serviceDirectory,
    workspaceCapabilityView: state.workspaceCapabilityView,
    waiterDeps: state.waiterDeps,
    handleCommand: features.commands.handleCommand,
    scheduleTitleGeneration: features.title.scheduleTitleGeneration,
    deliverQueuedMailboxAtBoundary:
      features.boundary.deliverQueuedMailboxAtBoundary,
    createRealRuntimeClient: (nestedOptions) =>
      createRuntimeClient({
        ...nestedOptions,
        pluginStoreRoot: options.pluginStoreRoot,
      }),
    mountPlugins,
    agentPolicyLayer: features.permissions.agentPolicyLayer,
    permissionProfileLayer: features.permissions.permissionProfileLayer,
    terminalCommandBuffer: state.terminalCommandBuffer,
    evaluatePermissionProfileCommandRules,
    ensureBashCommandParser,
    agentsFromConfig,
    providerForModel,
    sessionSeed,
    createHash,
    lineCount,
    contextEntriesToProviderMessages,
    withProviderConcurrency,
    requireNativeToolCallProtocol,
    normalizeRawToolCallProtocol,
    nativeToolCallCorrection,
    MAX_PROTOCOL_CORRECTIONS,
    WAITING_TOOLS,
    readOnlyToolMessage,
    MAX_STEPS_PROMPT,
    MISSING_FINAL_RESPONSE_FALLBACK,
    cleanupToolOutput,
    settleInterruptedTurnIDs,
    settleInterruptedTurns,
    projectSession,
    modelVisibleEvents,
    turnCoordinator: () => sessionRunCoordinator(state.sessionID),
    drainSession,
    projectInteractiveRequests,
    contextStatusEvent,
    publishRuntimeCapabilities: features.toolPublish.publishRuntimeCapabilities,
    publishRegisteredTools: features.toolPublish.publishRegisteredTools,
    ProviderConcurrencyLimiter,
    serviceNames: {
      attachment: ATTACHMENT_SERVICE,
      statusSnapshotController: STATUS_SNAPSHOT_CONTROLLER_SERVICE,
      workLedgerController: WORK_LEDGER_CONTROLLER_SERVICE,
      governanceLedgerController: GOVERNANCE_LEDGER_CONTROLLER_SERVICE,
      turnController: TURN_CONTROLLER_SERVICE,
      sandbox: SANDBOX_SERVICE,
      subagents: SUBAGENTS_SERVICE,
      sessionStoreController: SESSION_STORE_CONTROLLER_SERVICE,
      toolPolicy: TOOL_POLICY_SERVICE,
      providerModelController: PROVIDER_MODEL_CONTROLLER_SERVICE,
    },
  };
  ports.initialize = createInitialize(ctx, options).initialize;
  ports.applyConfigFromDisk = features.configReload.applyConfigFromDisk;
}
