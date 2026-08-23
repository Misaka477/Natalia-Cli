import type { RuntimeServiceClient } from "@natalia/runtime-services";
import type { RuntimeContext } from "../context";
import { createAutomationSurface } from "./automation";
import { createChatSurface } from "./chat";
import { createCheckpointSurface } from "./checkpoint";
import { createCoreSurface } from "./core";
import { createExtensionsSurface } from "./extensions";
import { createIntelligenceSurface } from "./intelligence";
import { createLifecycleSurface } from "./lifecycle";
import { createMailboxSurface } from "./mailbox";
import { createManagementSurface } from "./management";
import { createMcpSurface } from "./mcp";
import { createNativeTerminalSurface } from "./native-terminal";
import { createObservabilitySurface } from "./observability";
import { createPlansSurface } from "./plans";
import { createSandboxSurface } from "./sandbox";
import { createSelectionSurface } from "./selection";
import { createSessionsSurface } from "./sessions";
import { createSettingsSurface } from "./settings";
import { createTranscriptSurface } from "./transcript";
import { createTurnControlSurface } from "./turn-control";
import type { ClientSurfaceOptions } from "./types";
import { createWorkGraphSurface } from "./work-graph";
import { createWorkspaceSurface } from "./workspace";

export function createClientSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): RuntimeServiceClient {
  return {
    ...createCoreSurface(ctx, options),
    ...createTranscriptSurface(ctx, options),
    ...createTurnControlSurface(ctx, options),
    ...createLifecycleSurface(ctx, options),
    ...createSettingsSurface(ctx, options),
    ...createSelectionSurface(ctx, options),
    ...createWorkspaceSurface(ctx, options),
    ...createNativeTerminalSurface(ctx, options),
    ...createCheckpointSurface(ctx, options),
    ...createSandboxSurface(ctx, options),
    ...createSessionsSurface(ctx, options),
    ...createMcpSurface(ctx, options),
    ...createExtensionsSurface(ctx, options),
    ...createManagementSurface(ctx, options),
    ...createAutomationSurface(ctx, options),
    ...createObservabilitySurface(ctx, options),
    ...createWorkGraphSurface(ctx, options),
    ...createIntelligenceSurface(ctx, options),
    ...createMailboxSurface(ctx, options),
    ...createPlansSurface(ctx, options),
    ...createChatSurface(ctx, options),
  };
}
