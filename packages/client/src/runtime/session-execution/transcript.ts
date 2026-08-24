import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  SESSION_STORE_CONTROLLER_SERVICE,
  type SessionStoreController,
} from "@natalia/runtime-services";
import { projectInteractiveRequests } from "@natalia/session";
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
      return await sessionStore.history(
        ctx.ports.getSessionID(),
        ctx.ports.getSession()?.events ?? [],
        options,
      );
    },
    async messages(options = {}) {
      await ctx.ports.getReady();
      if (!ctx.ports.getSession())
        throw new Error("session initialization did not complete");
      const sessionStore = ctx.ports.resolveService<SessionStoreController>(
        SESSION_STORE_CONTROLLER_SERVICE,
      );
      if (!sessionStore)
        throw new Error("session store unavailable (natalia-session-store)");
      return await sessionStore.messages(
        ctx.ports.getSessionID(),
        ctx.ports.getSession()!,
        options,
      );
    },
    async pendingInteractive() {
      await ctx.ports.getReady();
      return projectInteractiveRequests(ctx.ports.getSession()?.events ?? []);
    },
  };
}
