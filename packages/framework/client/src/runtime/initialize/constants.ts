import type { RuntimeContext } from "../context";

export function initializeConstants(ctx: RuntimeContext) {
  const names = ctx.state.initialize.serviceNames;
  return {
    SESSION_STORE_CONTROLLER_SERVICE: names.sessionStoreController,
  };
}
