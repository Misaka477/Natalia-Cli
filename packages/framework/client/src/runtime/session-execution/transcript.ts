import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  SESSION_STORE_CONTROLLER_SERVICE,
  type SessionStoreController,
} from "@natalia/runtime-services";
import { projectInteractiveRequests } from "@natalia/session";
import type { SessionID } from "@natalia/contracts";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
type Surface = Pick<
  RuntimeServiceClient,
  "history" | "messages" | "pendingInteractive" | "submitInput"
>;
export function createTranscriptSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    submitInput: ctx.ports.submitInput,
    async history(options = {}) {
      await ctx.ports.getReady();
      const sessionStore = ctx.ports.resolveService<SessionStoreController>(
        SESSION_STORE_CONTROLLER_SERVICE,
      );
      if (!sessionStore)
        throw new Error("session store unavailable (natalia-session-store)");
      const requestedID = (options.sessionID ??
        ctx.ports.getSessionID()) as SessionID;
      const attached = ctx.ports.getSession();
      const fallback =
        attached && attached.id === requestedID ? (attached.events ?? []) : [];
      return await sessionStore.history(requestedID, fallback, options);
    },
    async messages(options = {}) {
      await ctx.ports.getReady();
      const requestedID = (options.sessionID ??
        ctx.ports.getSessionID()) as SessionID;
      const exec = ctx.ports.getExecutionBySession().get(requestedID);
      const session = exec?.session ?? ctx.ports.getSession();
      if (!session) throw new Error("session initialization did not complete");
      const sessionStore = ctx.ports.resolveService<SessionStoreController>(
        SESSION_STORE_CONTROLLER_SERVICE,
      );
      if (!sessionStore)
        throw new Error("session store unavailable (natalia-session-store)");
      const start = performance.now();
      const page = await sessionStore.messages(requestedID, session, options);
      console.warn(
        `[perf] session.messages ${requestedID} ${(performance.now() - start).toFixed(1)}ms`,
      );
      return page;
    },
    async pendingInteractive() {
      await ctx.ports.getReady();
      return projectInteractiveRequests(ctx.ports.getSession()?.events ?? []);
    },
  };
}
