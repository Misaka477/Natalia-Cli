import type { InitializeOptions, RuntimeContext } from "../context";
import { configureCatalog } from "./config-catalog";
import { configureRuntime } from "./config-runtime";
import { resolveServices } from "./services";
import { createSubagentSupport } from "./subagent-support";
import { createSubagentTools } from "./subagent-tools";
import { installSubagents } from "./subagent-runner";
import { recoverSession } from "./session-recovery";
import { registerCollaborationTools } from "./collaboration-tools";
import { finalizeInitialize } from "./finalize";

export function createInitialize(
  ctx: RuntimeContext,
  options: InitializeOptions,
) {
  async function initialize() {
    try {
      const config = await configureCatalog(ctx, options);
      await configureRuntime(ctx, options, config);
    } catch (error) {
      ctx.ports.publish({
        type: "diagnostic",
        level: "warning",
        message: `TS config was not used: ${error instanceof Error ? error.message : String(error)}`,
      });
      if (options.permissionProfile) throw error;
    }
    await resolveServices(ctx, options);
    const support = await createSubagentSupport(ctx, options);
    const toolSupport = await createSubagentTools(ctx, options, support);
    await installSubagents(ctx, options, { ...support, ...toolSupport });
    const recovery = await recoverSession(ctx, options);
    await registerCollaborationTools(ctx, options);
    await finalizeInitialize(ctx, options, recovery);
  }

  return { initialize };
}
