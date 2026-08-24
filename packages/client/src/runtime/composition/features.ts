import { providerFromEnvironment } from "@natalia/runtime";
import { createTerminalRuntime } from "../terminal-runtime";
import { createPermissions } from "../permissions";
import { createCollaborationBoundary } from "../collaboration/boundary";
import { createSnapshot } from "../snapshot";
import { createChatPrompt } from "../collaboration/chat-prompt";
import { createChatTools } from "../collaboration/chat-tools";
import { createCollaborationWake } from "../collaboration/wake";
import { createMailboxPlans } from "../collaboration/mailbox-plans";
import { createChatTurn } from "../collaboration/chat-turn";
import { createPluginAssembly } from "../plugin-assembly";
import { createConfigReload } from "../config-reload";
import { createToolPublish } from "../tool-publish";
import type { RuntimeContext } from "../context";
import type { RealRuntimeClientOptions } from "../options";

export type FeatureAssembly = ReturnType<typeof wireFeatures>;

export function wireFeatures(
  ctx: RuntimeContext,
  options: RealRuntimeClientOptions,
) {
  const { state, ports } = ctx;
  const terminalRuntime = createTerminalRuntime(ctx);
  ports.setPendingHumanTerminal = terminalRuntime.setPendingHumanTerminal;
  ports.maybeContinueAfterHumanInput =
    terminalRuntime.maybeContinueAfterHumanInput;

  ports.getPermissionMode = () => state.permissionMode;
  ports.setPermissionMode = (mode) => {
    state.permissionMode = mode;
  };
  ports.getSelectedPermissionProfile = () => state.selectedPermissionProfile;
  ports.setSelectedPermissionProfile = (profile) => {
    state.selectedPermissionProfile = profile;
  };
  ports.getDefaultPermissionMode = () => state.defaultPermissionMode;
  ports.setDefaultPermissionMode = (mode) => {
    state.defaultPermissionMode = mode;
  };
  ports.getDefaultPermissionProfile = () => state.defaultPermissionProfile;
  ports.setDefaultPermissionProfile = (profile) => {
    state.defaultPermissionProfile = profile;
  };
  const permissions = createPermissions(ctx, options);
  ports.createToolPolicyLayer = permissions.createToolPolicyLayer;
  ports.isToolAllowed = permissions.isToolAllowed;
  ports.applyAgentPolicy = permissions.applyAgentPolicy;
  ports.extensionToolPermission = permissions.extensionToolPermission;
  ports.extensionEnabled = permissions.extensionEnabled;

  const boundary = createCollaborationBoundary(ctx);
  ports.settleMailboxAtBoundary = boundary.settleMailboxAtBoundary;
  ports.activateQueuedPlanAtBoundary = boundary.activateQueuedPlanAtBoundary;
  ports.reconcileWorkspaceObservation = boundary.reconcileWorkspaceObservation;
  const snapshot = createSnapshot(ctx);
  ports.setInFlightOperation = snapshot.setInFlightOperation;
  ports.toolEventTurnID = snapshot.toolEventTurnID;
  ports.isSessionSnapshotTrigger = snapshot.isSessionSnapshotTrigger;
  ports.publishSessionSnapshot = snapshot.publishSessionSnapshot;
  ports.currentSessionSnapshot = snapshot.currentSessionSnapshot;
  ports.nextCollabSequence = () => state.collabSequence++;
  ports.nextPlanSequence = () => state.planSequence++;

  const chatPrompt = createChatPrompt(ctx);
  const chatTools = createChatTools(ctx);
  const collaborationWake = createCollaborationWake(ctx);
  ports.wakeMainForCollaboration = collaborationWake.wakeMainForCollaboration;
  ports.wakeNavi = collaborationWake.wakeNavi;
  ports.requestNaviWake = collaborationWake.requestNaviWake;
  ports.scheduleInternalWake = collaborationWake.scheduleInternalWake;
  const mailboxPlans = createMailboxPlans(ctx);
  ports.createCollabChatTool = mailboxPlans.createCollabChatTool;
  ports.enqueueMailboxMessage = mailboxPlans.enqueueMailboxMessage;
  ports.createPlanDraft = mailboxPlans.createPlanDraft;
  ports.createPlanDraftForClient = (input) =>
    mailboxPlans.createPlanDraft(input);
  ports.enqueueMailboxForClient = (input) =>
    mailboxPlans.enqueueMailboxMessage(input);
  ports.chatSystemPrompt = chatPrompt.chatSystemPrompt;
  ports.chatTools = chatTools.chatTools;
  ports.chatToolSummary = chatTools.chatToolSummary;
  ports.runChatTurnBody = createChatTurn(ctx).runChatTurnBody;
  ports.providerFromEnvironment = providerFromEnvironment;

  const pluginAssembly = createPluginAssembly(ctx, options);
  ports.reloadPermissionSettings = permissions.reloadPermissionSettings;
  ports.setTsRuntimeConfig = (config) => {
    state.tsRuntimeConfig = config;
  };
  ports.setMaxSteps = (steps) => {
    state.maxSteps = steps;
  };
  ports.setRetryPolicy = (policy) => {
    state.retryPolicy = policy;
  };
  ports.setProviderConcurrencyLimiter = (limiter) => {
    state.providerConcurrencyLimiter = limiter;
  };
  ports.setAgentRegistry = (registry) => {
    state.agentRegistry = registry;
  };
  ports.setBuildBuiltinPluginCatalog = (build) => {
    state.buildBuiltinPluginCatalog = build;
  };
  ports.buildBuiltinPluginCatalog = (config) =>
    state.buildBuiltinPluginCatalog(config) as ReturnType<
      typeof import("@natalia/builtin-plugins").builtinPluginCatalog
    >;
  const configReload = createConfigReload(ctx, options);
  ports.configReloadBlockedReason = configReload.configReloadBlockedReason;
  ports.reloadConfigFromDisk = configReload.reloadConfigFromDisk;
  const toolPublish = createToolPublish(ctx, options);
  ports.publishWorkGraphToolCall = toolPublish.publishWorkGraphToolCall;
  ports.hotReloadToolFamily = toolPublish.hotReloadToolFamily;
  ports.publishToolCatalogChanges = toolPublish.publishToolCatalogChanges;
  ports.setInFlightOperationFor = snapshot.setInFlightOperationFor;

  return {
    terminalRuntime,
    permissions,
    boundary,
    snapshot,
    chatPrompt,
    toolPublish,
    pluginAssembly,
    configReload,
  };
}
