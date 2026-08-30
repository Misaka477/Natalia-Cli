import type { RuntimeServiceClient } from "@natalia/runtime-services";
import {
  SESSION_STORE_CONTROLLER_SERVICE,
  TERMINAL_CONTROLLER_SERVICE,
  type SessionStoreController,
  type TerminalController,
} from "@natalia/runtime-services";
import type { SessionID } from "@natalia/contracts";
import type { RuntimeContext } from "../context";
import type { ClientSurfaceOptions } from "./types";
type Surface = Pick<
  RuntimeServiceClient,
  | "sessionList"
  | "sessionTouch"
  | "sessionRename"
  | "sessionPin"
  | "sessionDuplicate"
  | "sessionFork"
  | "sessionDelete"
  | "sessionNew"
  | "sessionArchive"
  | "sessionRestore"
  | "sessionExport"
  | "sessionAttach"
>;
export function createSessionsSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  function requireSessionStore() {
    const store = ctx.ports.resolveService<SessionStoreController>(
      SESSION_STORE_CONTROLLER_SERVICE,
    );
    if (!store)
      throw new Error("session store unavailable (natalia-session-store)");
    return store;
  }
  return {
    sessionAttach: ctx.ports.attachSession,
    async sessionList() {
      await ctx.ports.getReady();
      return await requireSessionStore().list();
    },
    async sessionTouch(id) {
      await ctx.ports.getReady();
      await requireSessionStore().touch(id);
    },
    async sessionRename(id, title) {
      await ctx.ports.getReady();
      const updated = await requireSessionStore().rename(id, title);
      const exec = ctx.ports.getExecutionBySession().get(id as SessionID);
      if (exec) {
        exec.session.title = updated.title;
        exec.session.metadata = {
          ...exec.session.metadata,
          titleSource: "manual",
        };
      }
      ctx.ports.publishForSession(exec, {
        type: "session.title.updated",
        sessionID: id as SessionID,
        title: updated.title,
      });
      return updated;
    },
    async sessionPin(id, pinned) {
      await ctx.ports.getReady();
      return await requireSessionStore().pin(id, pinned);
    },
    async sessionDuplicate(id, title) {
      await ctx.ports.getReady();
      return await requireSessionStore().duplicate(id, title);
    },
    async sessionFork(id, turnID, title) {
      await ctx.ports.getReady();
      return await requireSessionStore().fork(id, turnID, title);
    },
    async sessionDelete(id) {
      await ctx.ports.getReady();
      await ctx.ports.cancelTitleGeneration(id as SessionID);
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      await terminal?.stopForSession?.(id);
      return await requireSessionStore().delete(id);
    },
    async sessionNew(input = {}) {
      await ctx.ports.getReady();
      return await requireSessionStore().create(input);
    },
    async sessionArchive(id) {
      await ctx.ports.getReady();
      const terminal = ctx.ports.resolveService<TerminalController>(
        TERMINAL_CONTROLLER_SERVICE,
      );
      await terminal?.stopForSession?.(id);
      return await requireSessionStore().archive(id);
    },
    async sessionRestore(id) {
      await ctx.ports.getReady();
      return await requireSessionStore().restore(id);
    },
    async sessionExport(id) {
      await ctx.ports.getReady();
      return await requireSessionStore().export(id);
    },
  };
}
