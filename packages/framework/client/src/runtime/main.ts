import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  terminalApprovalScope,
  terminalInputRisk,
} from "@natalia/runtime-services";
import { createClientSurface } from "./client-surface";
import { createCompositionContext } from "./composition/state";
import { wireFoundation } from "./composition/foundation";
import { wireFeatures } from "./composition/features";
import { wireServices } from "./composition/services";
import { wireExecution } from "./composition/execution";
import { wireInitialize } from "./composition/initialize";
import type { RealRuntimeClientOptions } from "./options";

export { EGRESS_ADVISORY } from "./commands";
export { terminalApprovalScope, terminalInputRisk };
export type { RealRuntimeClientOptions } from "./options";

/** Explicit composition root for the production runtime client. */
export function createRealRuntimeClient(
  options: RealRuntimeClientOptions = {},
): RuntimeServiceClient {
  const ctx = createCompositionContext(options);
  wireFoundation(ctx);
  const features = wireFeatures(ctx, options);
  const services = wireServices(ctx, options);
  const execution = wireExecution(ctx, options);
  wireInitialize(
    ctx,
    options,
    { ...features, ...execution },
    createRealRuntimeClient,
  );
  ctx.ports.ensureReady = services.ensureReady;
  return createClientSurface(ctx, options);
}
