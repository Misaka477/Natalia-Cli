import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  CHECKPOINT_FACTORY_SERVICE,
  SANDBOX_SERVICE,
  SESSION_STORE_CONTROLLER_SERVICE,
  TERMINAL_CONTROLLER_SERVICE,
  type CheckpointFactory,
  type SandboxService,
  type SessionStoreController,
  type TerminalController,
} from "@natalia/runtime-services";
import { updateConfigAtScope } from "@natalia/config";
import { sessionRunCoordinator } from "@natalia/session";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
type Surface = Pick<
  RuntimeServiceClient,
  "dispose" | "canReloadConfig" | "reloadConfig" | "updateConfig" | "configGet"
>;
export function createLifecycleSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    async configGet() {
      await ctx.ports.getReady();
      const config = ctx.ports.getTsRuntimeConfig();
      if (!config) throw new Error("runtime configuration is not initialized");
      return structuredClone(config);
    },
    async dispose() {
      ctx.ports.setDisposed(true);
      await Promise.all(
        [...ctx.state.titleGenerationTasks.keys()].map(
          ctx.ports.cancelTitleGeneration,
        ),
      );
      ctx.ports.getTerminalCommandBuffer().clearAll();
      for (const exec of ctx.ports.getExecutionBySession().values()) {
        exec.activeAbort?.abort(new Error("runtime disposed"));
        exec.paused = false;
        for (const resolveWaiter of exec.pauseWaiters) resolveWaiter();
        exec.pauseWaiters = [];
      }
      await Promise.all(
        [...ctx.ports.getExecutionBySession().keys()].map((id) =>
          sessionRunCoordinator(id).interrupt(),
        ),
      );
      await Promise.allSettled([...ctx.ports.getInternalWakeTasks()]);
      // A committed selection and other durable controls must reach disk before
      // a caller opens the same session in a replacement runtime.
      await ctx.ports.getSessionPersistence();
      const sessionStore = ctx.ports.resolveService<SessionStoreController>(
        SESSION_STORE_CONTROLLER_SERVICE,
      );
      if (sessionStore)
        await Promise.all(
          [...ctx.ports.getExecutionBySession().keys()].map((id) =>
            sessionStore.flush(id),
          ),
        );
      await ctx.ports.resolveService<SandboxService>(SANDBOX_SERVICE)?.close();
      await ctx.ports
        .resolveService<TerminalController>(TERMINAL_CONTROLLER_SERVICE)
        ?.close();
      ctx.ports
        .resolveService<
          CheckpointFactory & { close?(): void }
        >(CHECKPOINT_FACTORY_SERVICE)
        ?.close?.();
      ctx.state.frameworkServices?.close();
      await ctx.ports.getPluginsController().close();
      await ctx.ports.getPerformanceTrace().stop();
    },
    async canReloadConfig() {
      await ctx.ports.getReady();
      const blocked = ctx.ports.configReloadBlockedReason();
      return blocked ? { allowed: false, reason: blocked } : { allowed: true };
    },
    async reloadConfig() {
      await ctx.ports.getReady();
      // Re-checked here rather than trusting `canReloadConfig`: a turn can start
      // between the two calls, and applying new policy underneath a running turn
      // would change the rules it started under.
      return await ctx.ports.applyConfigFromDisk();
    },
    async updateConfig(input) {
      await ctx.ports.getReady();
      console.log("[updateConfig] begin", input.scope, JSON.stringify(input.patch, null, 2).slice(0, 4000));
      // The TUI settings menu path, now a public surface: merge the patch onto
      // disk, then apply. The file is written either way; whether it takes
      // effect under a running turn is an ordinary answer, not an exception.
      // Idempotent by patch: the same patch merged twice produces the same
      // merged config.
      await updateConfigAtScope(
        ctx.ports.getWorkspaceRoot(),
        input.patch as never,
        input.scope ?? "project",
        { globalPath: options.globalConfigPath },
      );
      console.log("[updateConfig] file written");
      // Applying is the same operation as a reload, with the same value-type
      // refusal; share it so the two paths cannot drift.
      const outcome = await ctx.ports.applyConfigFromDisk();
      console.log("[updateConfig] applied", outcome.applied, outcome.reason);
      return outcome;
    },
  };
}
