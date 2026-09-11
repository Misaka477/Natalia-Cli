import type { InitializeOptions, RuntimeContext } from "../context";
import { configureCatalog } from "./config-catalog";
import { configureRuntime } from "./config-runtime";
import { resolveServices } from "./services";
import { createSubagentSupport } from "./subagent-support";
import { createSubagentTools } from "./subagent-tools";
import { installSubagents } from "./subagent-runner";
import { recoverSession } from "./session-recovery";
import { finalizeInitialize } from "./finalize";
import { perfLog } from "@natalia/runtime-services";

export function createInitialize(
  ctx: RuntimeContext,
  options: InitializeOptions,
) {
  async function initialize() {
    const initStart = performance.now();
    const mark = (name: string) =>
      perfLog(
        `[perf] initialize ${name} +${(performance.now() - initStart).toFixed(1)}ms`,
      );
    mark("start");
    try {
      const config = await configureCatalog(ctx, options);
      mark("configureCatalog");
      await configureRuntime(ctx, options, config);
      mark("configureRuntime");
    } catch (error) {
      ctx.ports.publish({
        type: "diagnostic",
        level: "warning",
        message: `TS config was not used: ${error instanceof Error ? error.message : String(error)}`,
      });
      if (options.permissionProfile) throw error;
    }
    await resolveServices(ctx, options);
    mark("resolveServices");
    const support = await createSubagentSupport(ctx, options);
    const toolSupport = await createSubagentTools(ctx, options, support);
    mark("subagentSupport");
    await installSubagents(ctx, options, { ...support, ...toolSupport });
    mark("installSubagents");
    const recovery = await recoverSession(ctx, options);
    mark("recoverSession");
    await finalizeInitialize(ctx, options, recovery);
    mark("finalizeInitialize");
  }

  return { initialize };
}
