import { type StatusSnapshotController } from "@natalia/runtime-services";
import { statusSnapshotController } from "@natalia/runtime-status";
import type { RuntimeServiceClient } from "@natalia/runtime-services";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
type Surface = Pick<
  RuntimeServiceClient,
  "runtimeStatus" | "diagnostics" | "sessionSnapshot"
>;
async function observabilityExec(ctx: RuntimeContext, sessionID?: string) {
  // Session snapshots may be the first routed call on a workspace proxy.
  await ctx.ports.ensureReady();
  if (sessionID)
    return (
      ctx.ports
        .getExecutionBySession()
        .get(sessionID as import("@natalia/contracts").SessionID) ??
      (await ctx.ports.ensureExecution(
        sessionID as import("@natalia/contracts").SessionID,
      ))
    );
  return ctx.ports.getActiveExec();
}

export function createObservabilitySurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    async runtimeStatus(sessionID?: string) {
      await ctx.ports.ensureReady();
      const exec = await observabilityExec(ctx, sessionID);
      if (!exec) return await ctx.ports.runtimeStatusSnapshot();
      const status = ctx.state.serviceDirectory.get(statusSnapshotController);
      return {
        ...(await status.snapshotFor({
          provider: exec.provider,
          context: exec.context,
          permissionMode: exec.permissionMode,
        })),
        sessionID: exec.session.id,
      };
    },
    async diagnostics(limit = 100, sessionID?: string) {
      await ctx.ports.getReady();
      const exec = await observabilityExec(ctx, sessionID);
      const entries = exec
        ? [
            ...ctx.ports.getRuntimeDiagnostics(),
            ...(ctx.ports
              .getRuntimeDiagnosticsBySession()
              .get(exec.session.id) ?? []),
          ]
        : ctx.ports.getRuntimeDiagnostics();
      return entries.slice(-Math.min(500, Math.max(1, limit)));
    },
    async sessionSnapshot(sessionID) {
      const exec = await observabilityExec(ctx, sessionID);
      if (!exec) return undefined;
      return ctx.ports.currentSessionSnapshot(
        exec,
        `snapshot:live:${exec.session.id}`,
      );
    },
  };
}
