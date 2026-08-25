import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  TERMINAL_CONTROLLER_SERVICE,
  type TerminalController,
} from "@natalia/runtime-services";
import { RuntimeRefusal } from "@natalia/contracts";
import type { RuntimeContext } from "../context";
import type { RealRuntimeClientOptions } from "../options";

type ClientSurfaceOptions = Pick<
  RealRuntimeClientOptions,
  "episodeID" | "globalConfigPath"
>;
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

function refusalFromRegistry(error: unknown): RuntimeRefusal {
  return new RuntimeRefusal(
    error instanceof Error ? error.message : String(error),
  );
}

export function createNativeTerminalSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    async nativeTerminalList() {
      await ctx.ports.getReady();
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      return (await terminal?.list()) ?? [];
    },
    async nativeTerminalRead(id) {
      await ctx.ports.getReady();
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      if (!terminal) throw new Error("Native Terminal Host is unavailable");
      const { text } = await terminal.read(id, { maxLines: 200 });
      return { id, text };
    },
    async nativeTerminalOpenHub() {
      await ctx.ports.getReady();
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      if (!terminal) throw new Error("Native Terminal Host is unavailable");
      return await terminal.openHub();
    },
    async nativeTerminalRevokeApprovalScope(id) {
      await ctx.ports.getReady();
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      if (!terminal) throw new Error("Native Terminal Host is unavailable");
      return ctx.ports.getInteractive().revokeTerminalApprovalScope(id);
    },
    async nativeTerminalReleaseHumanControl(id) {
      await ctx.ports.getReady();
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      if (!terminal) throw new Error("Native Terminal Host is unavailable");
      const sessionView = terminal.releaseHumanControl(id);
      // TERM-M.3 (c): the remote release path triggers the same continuation
      // as the local timeline-detach path.
      void ctx.ports.maybeContinueAfterHumanInput(id);
      return sessionView;
    },
    async nativeTerminalBeginSecureInput(id) {
      await ctx.ports.getReady();
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      if (!terminal) throw new Error("Native Terminal Host is unavailable");
      return terminal.beginSecureInput(id);
    },
    async nativeTerminalEndSecureInput(id) {
      await ctx.ports.getReady();
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      if (!terminal) throw new Error("Native Terminal Host is unavailable");
      return terminal.endSecureInput(id);
    },
    async nativeTerminalStop(id) {
      await ctx.ports.getReady();
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      if (!terminal) throw new Error("Native Terminal Host is unavailable");
      return {
        ...(await terminal.stop(id, "human")),
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
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      if (!terminal)
        throw new RuntimeRefusal("Native Terminal Host is unavailable");
      try {
        return await terminal.start({
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
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      if (!terminal)
        throw new RuntimeRefusal("Native Terminal Host is unavailable");
      try {
        const result = await terminal.write(input.id, input.input, {
          idempotencyKey: input.idempotencyKey,
        });
        return { id: input.id, ...result };
      } catch (error) {
        throw refusalFromRegistry(error);
      }
    },
    async nativeTerminalResize(input) {
      await ctx.ports.getReady();
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      if (!terminal)
        throw new RuntimeRefusal("Native Terminal Host is unavailable");
      try {
        return await terminal.resize(input.id, input.rows, input.cols, "model");
      } catch (error) {
        throw refusalFromRegistry(error);
      }
    },
  };
}
