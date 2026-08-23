import type { RuntimeServiceClient } from "@natalia/runtime-services";
import { RuntimeRefusal } from "@natalia/contracts";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
import { refusalFromRegistry } from "./helpers";
type Surface = Pick<
  RuntimeServiceClient,
  | "nativeTerminalList"
  | "nativeTerminalRead"
  | "nativeTerminalOpenHub"
  | "nativeTerminalRevokeApprovalScope"
  | "nativeTerminalReleaseHumanControl"
  | "nativeTerminalBeginSecureInput"
  | "nativeTerminalEndSecureInput"
  | "nativeTerminalStop"
  | "nativeTerminalStart"
  | "nativeTerminalWrite"
  | "nativeTerminalResize"
>;
export function createNativeTerminalSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    async nativeTerminalList() {
      await ctx.ports.getReady();
      return (await ctx.ports.getTerminalController()?.list()) ?? [];
    },
    async nativeTerminalRead(id) {
      await ctx.ports.getReady();
      if (!ctx.ports.getTerminalController())
        throw new Error("Native Terminal Host is unavailable");
      const { text } = await ctx.ports
        .getTerminalController()!
        .read(id, { maxLines: 200 });
      return { id, text };
    },
    async nativeTerminalOpenHub() {
      await ctx.ports.getReady();
      if (!ctx.ports.getTerminalController())
        throw new Error("Native Terminal Host is unavailable");
      return await ctx.ports.getTerminalController()!.openHub();
    },
    async nativeTerminalRevokeApprovalScope(id) {
      await ctx.ports.getReady();
      if (!ctx.ports.getTerminalController())
        throw new Error("Native Terminal Host is unavailable");
      return ctx.ports.getInteractive().revokeTerminalApprovalScope(id);
    },
    async nativeTerminalReleaseHumanControl(id) {
      await ctx.ports.getReady();
      if (!ctx.ports.getTerminalController())
        throw new Error("Native Terminal Host is unavailable");
      const sessionView = ctx.ports
        .getTerminalController()!
        .releaseHumanControl(id);
      // TERM-M.3 (c): the remote release path triggers the same continuation
      // as the local timeline-detach path.
      void ctx.ports.maybeContinueAfterHumanInput(id);
      return sessionView;
    },
    async nativeTerminalBeginSecureInput(id) {
      await ctx.ports.getReady();
      if (!ctx.ports.getTerminalController())
        throw new Error("Native Terminal Host is unavailable");
      return ctx.ports.getTerminalController()!.beginSecureInput(id);
    },
    async nativeTerminalEndSecureInput(id) {
      await ctx.ports.getReady();
      if (!ctx.ports.getTerminalController())
        throw new Error("Native Terminal Host is unavailable");
      return ctx.ports.getTerminalController()!.endSecureInput(id);
    },
    async nativeTerminalStop(id) {
      await ctx.ports.getReady();
      if (!ctx.ports.getTerminalController())
        throw new Error("Native Terminal Host is unavailable");
      return {
        ...(await ctx.ports.getTerminalController()!.stop(id, "human")),
        status: "exited",
      };
    },
    // --- P0-H: the terminal write surface, host-gated at the transport ---
    // Remote callers are treated as model-side actors: ownership, secure-input
    // and geometry arbitration are the same ones the model tools go through.
    async nativeTerminalStart(input) {
      await ctx.ports.getReady();
      const owner = ctx.ports.getActiveExec();
      if (!owner) throw new RuntimeRefusal("session is not initialized");
      if (!ctx.ports.getTerminalController())
        throw new RuntimeRefusal("Native Terminal Host is unavailable");
      try {
        return await ctx.ports.getTerminalController()!.start({
          command: input.command,
          cwd: input.cwd ?? ctx.ports.getWorkspaceRoot(),
          id: input.id,
          sessionID: owner.session.id,
        });
      } catch (error) {
        throw refusalFromRegistry(error);
      }
    },
    async nativeTerminalWrite(input) {
      await ctx.ports.getReady();
      if (!ctx.ports.getTerminalController())
        throw new RuntimeRefusal("Native Terminal Host is unavailable");
      try {
        const result = await ctx.ports
          .getTerminalController()!
          .write(input.id, input.input, {
            idempotencyKey: input.idempotencyKey,
          });
        return { id: input.id, ...result };
      } catch (error) {
        throw refusalFromRegistry(error);
      }
    },
    async nativeTerminalResize(input) {
      await ctx.ports.getReady();
      if (!ctx.ports.getTerminalController())
        throw new RuntimeRefusal("Native Terminal Host is unavailable");
      try {
        return await ctx.ports
          .getTerminalController()!
          .resize(input.id, input.rows, input.cols, "model");
      } catch (error) {
        throw refusalFromRegistry(error);
      }
    },
  };
}
