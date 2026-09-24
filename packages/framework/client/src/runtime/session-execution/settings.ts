import type { RuntimeServiceClient } from "@anthelia/runtime-services";
import { resolveTuiConfig, saveTuiConfig } from "@anthelia/config";
import { rinaResponseCache } from "@anthelia/rina";
import type { RuntimeContext } from "@anthelia/substrate";
import type { ClientSurfaceOptions } from "./types";
type Surface = Pick<
  RuntimeServiceClient,
  "settingsGet" | "settingsSet" | "responseCache"
>;
export function createSettingsSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    async settingsGet() {
      await ctx.ports.getReady();
      const resolved = await resolveTuiConfig(ctx.ports.getWorkspaceRoot());
      return {
        config: resolved.config as unknown as Record<string, unknown>,
        sources: resolved.sources,
      };
    },
    async responseCache(input?: { enabled?: boolean }) {
      await ctx.ports.getReady();
      // The live process's switch (rina Phase 4's runtime face): the
      // composition row is the boot-time opt-in, this is the restart-free
      // toggle. An absent cache (a bare runtime) answers its own off
      // state rather than inventing one.
      const cache = ctx.state.serviceDirectory.getOptional(rinaResponseCache);
      if (!cache) return { enabled: false, hits: 0, misses: 0, entries: 0 };
      if (input?.enabled !== undefined) cache.setEnabled(input.enabled);
      const stats = cache.stats();
      return {
        enabled: stats.enabled,
        hits: stats.hits,
        misses: stats.misses,
        entries: stats.entries,
      };
    },
    async settingsSet(patch, scope) {
      await ctx.ports.getReady();
      // The interface-preference file, served publicly now that the TUI no
      // longer owns it privately. Validated by the shared schema (an invalid
      // patch is an argument error, not a partial write), written atomically,
      // then announced so subscribers can re-read.
      await saveTuiConfig(ctx.ports.getWorkspaceRoot(), patch, scope);
      ctx.ports.publish({ type: "settings.updated", scope });
      return { applied: true };
    },
  };
}
