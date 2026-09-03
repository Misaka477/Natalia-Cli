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
  | "nativeTerminalClaimHumanInput"
  | "nativeTerminalReleaseHumanControl"
  | "nativeTerminalBeginSecureInput"
  | "nativeTerminalEndSecureInput"
  | "nativeTerminalStop"
  | "nativeTerminalStart"
  | "nativeTerminalWrite"
  | "nativeTerminalResize"
  | "subscribeTerminalOutput"
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
    async nativeTerminalList(_sessionID?: string) {
      await ctx.ports.getReady();
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      return (await terminal?.list()) ?? [];
    },
    async nativeTerminalRead(id, _sessionID?: string) {
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
    async nativeTerminalRevokeApprovalScope(id, _sessionID?: string) {
      await ctx.ports.getReady();
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      if (!terminal) throw new Error("Native Terminal Host is unavailable");
      return ctx.ports.getInteractive().revokeTerminalApprovalScope(id);
    },
    async nativeTerminalClaimHumanInput(id, _sessionID?: string) {
      await ctx.ports.getReady();
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      if (!terminal?.claimHumanInput)
        throw new Error("Native Terminal Host is unavailable");
      return await terminal.claimHumanInput(id);
    },
    async nativeTerminalReleaseHumanControl(id, sessionID) {
      await ctx.ports.getReady();
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      if (!terminal) throw new Error("Native Terminal Host is unavailable");
      const sessionView = terminal.releaseHumanControl(id);
      // TERM-M.3 (c): the remote release path triggers the same continuation
      // as the local timeline-detach path. Pass the owning session so a
      // background session's terminal release does not fall back to active.
      void ctx.ports.maybeContinueAfterHumanInput(
        id,
        sessionID as import("@natalia/contracts").SessionID | undefined,
      );
      return sessionView;
    },
    async nativeTerminalBeginSecureInput(id, _sessionID?: string) {
      await ctx.ports.getReady();
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      if (!terminal) throw new Error("Native Terminal Host is unavailable");
      return terminal.beginSecureInput(id);
    },
    async nativeTerminalEndSecureInput(id, _sessionID?: string) {
      await ctx.ports.getReady();
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      if (!terminal) throw new Error("Native Terminal Host is unavailable");
      return terminal.endSecureInput(id);
    },
    async nativeTerminalStop(id, _sessionID?: string) {
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
      const sessionID = input.sessionID ?? owner?.session.id;
      if (!sessionID) throw new RuntimeRefusal("session is not initialized");
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
          sessionID,
          ...(input.agentID ? { agentID: input.agentID } : {}),
        });
      } catch (error) {
        throw refusalFromRegistry(error);
      }
    },
    async nativeTerminalWrite(input: {
      id: string;
      input: string;
      idempotencyKey?: string;
      sessionID?: string;
    }) {
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
    async nativeTerminalResize(input: {
      id: string;
      rows: number;
      cols: number;
      sessionID?: string;
    }) {
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
    subscribeTerminalOutput(id, listener) {
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      if (!terminal?.subscribeOutput)
        throw new RuntimeRefusal("Native Terminal Host is unavailable");
      return terminal.subscribeOutput(id, listener);
    },
  };
}
