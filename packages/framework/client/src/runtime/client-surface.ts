import type { RuntimeServiceClient } from "@natalia/runtime-services";
import { createAutomationRuntime } from "./automation-runtime";
import { createChatSurface } from "./collaboration/chat";
import { createMailboxSurface } from "./collaboration/mailbox";
import { createPlansRuntime } from "./collaboration/plans";
import { createExtensionsRuntime } from "./commands/extensions-runtime";
import type { RuntimeContext } from "./context";
import { createIntelligenceSurface } from "./engineering-intelligence/intelligence";
import { createMcpRuntime } from "./mcp-runtime";
import type { RealRuntimeClientOptions } from "./options";
import { createSelectionSurface } from "./provider-selection/selection";
import { createSandboxRuntime } from "./sandbox-runtime";
import { createTeamRuntime } from "./team-runtime";
import { createCoreSurface } from "./session-execution/core";
import { createLifecycleSurface } from "./session-execution/lifecycle";
import { createManagementSurface } from "./session-execution/management";
import { createObservabilitySurface } from "./session-execution/observability";
import { createSessionsSurface } from "./session-execution/sessions";
import { createSettingsSurface } from "./session-execution/settings";
import { createTranscriptSurface } from "./session-execution/transcript";
import { createTurnControlSurface } from "./session-execution/turn-control";
import { createNativeTerminalSurface } from "./terminal-runtime/native-terminal";
import { createWorkGraphRuntime } from "./work-graph";
import { createWorkspaceRuntime } from "./workspace-runtime";

export function createClientSurface(
  ctx: RuntimeContext,
  options: RealRuntimeClientOptions,
): RuntimeServiceClient {
  const checkpoint = ctx.ports.getCheckpointRuntime();
  return {
    ...createCoreSurface(ctx, options),
    ...createTranscriptSurface(ctx, options),
    ...createTurnControlSurface(ctx, options),
    ...createLifecycleSurface(ctx, options),
    ...createSettingsSurface(ctx, options),
    ...createSelectionSurface(ctx, options),
    ...createWorkspaceRuntime(ctx),
    ...createNativeTerminalSurface(ctx, options),
    checkpointList: checkpoint.checkpointList,
    checkpointPreview: checkpoint.checkpointPreview,
    checkpointRollback: checkpoint.checkpointRollback,
    workspaceDiff: checkpoint.workspaceDiff,
    ...createSandboxRuntime(ctx, options.episodeID),
    ...createTeamRuntime(ctx),
    ...createSessionsSurface(ctx, options),
    ...createMcpRuntime(ctx, options.globalConfigPath),
    ...createExtensionsRuntime(ctx),
    ...createManagementSurface(ctx, options),
    ...createAutomationRuntime(ctx),
    ...createObservabilitySurface(ctx, options),
    ...createWorkGraphRuntime(ctx),
    ...createIntelligenceSurface(ctx, options),
    ...createMailboxSurface(ctx),
    ...(({
      planList,
      planCreate,
      planUpdate,
      planPropose,
      planAccept,
      planQueue,
      planActivate,
      planSupersede,
      planCompleted,
    }) => ({
      planList,
      planCreate,
      planUpdate,
      planPropose,
      planAccept,
      planQueue,
      planActivate,
      planSupersede,
      planCompleted,
    }))(createPlansRuntime(ctx)),
    ...createChatSurface(ctx),
  };
}
