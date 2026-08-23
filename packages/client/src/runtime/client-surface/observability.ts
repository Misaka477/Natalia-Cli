import type { RuntimeServiceClient } from "@natalia/runtime-services";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
type Surface = Pick<
  RuntimeServiceClient,
  "runtimeStatus" | "diagnostics" | "sessionSnapshot"
>;
export function createObservabilitySurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    async runtimeStatus() {
      await ctx.ports.ensureReady();
      return await ctx.ports.runtimeStatusSnapshot();
    },
    async diagnostics(limit = 100) {
      await ctx.ports.getReady();
      const entries = ctx.ports.getActiveExec()
        ? [
            ...ctx.ports.getRuntimeDiagnostics(),
            ...(ctx.ports
              .getRuntimeDiagnosticsBySession()
              .get(ctx.ports.getActiveExec()!.session.id) ?? []),
          ]
        : ctx.ports.getRuntimeDiagnostics();
      return entries.slice(-Math.min(500, Math.max(1, limit)));
    },
    async sessionSnapshot() {
      if (!ctx.ports.getActiveExec()) return undefined;
      return ctx.ports.currentSessionSnapshot(
        ctx.ports.getActiveExec()!,
        `snapshot:live:${ctx.ports.getActiveExec()!.session.id}`,
      );
    },
  };
}
