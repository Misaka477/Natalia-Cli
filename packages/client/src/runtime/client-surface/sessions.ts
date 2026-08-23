import type { RuntimeServiceClient } from "@natalia/runtime-services";
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
  | "sessionExport"
  | "sessionAttach"
>;
export function createSessionsSurface(
  ctx: RuntimeContext,
  options: ClientSurfaceOptions,
): Surface {
  return {
    sessionAttach: ctx.ports.attachSession,
    async sessionList() {
      await ctx.ports.getReady();
      return await ctx.ports.getSessionStoreController()?.list();
    },
    async sessionTouch(id) {
      await ctx.ports.getReady();
      await ctx.ports.getSessionStoreController()?.touch(id);
    },
    async sessionRename(id, title) {
      await ctx.ports.getReady();
      const updated = await ctx.ports
        .getSessionStoreController()
        ?.rename(id, title);
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
      return await ctx.ports.getSessionStoreController()?.pin(id, pinned);
    },
    async sessionDuplicate(id, title) {
      await ctx.ports.getReady();
      return await ctx.ports.getSessionStoreController()?.duplicate(id, title);
    },
    async sessionFork(id, turnID, title) {
      await ctx.ports.getReady();
      return await ctx.ports
        .getSessionStoreController()
        ?.fork(id, turnID, title);
    },
    async sessionDelete(id) {
      await ctx.ports.getReady();
      await ctx.ports.cancelTitleGeneration(id as SessionID);
      return await ctx.ports.getSessionStoreController()?.delete(id);
    },
    async sessionNew(input = {}) {
      await ctx.ports.getReady();
      return await ctx.ports.getSessionStoreController()?.create(input);
    },
    async sessionArchive(id) {
      await ctx.ports.getReady();
      return await ctx.ports.getSessionStoreController()?.archive(id);
    },
    async sessionExport(id) {
      await ctx.ports.getReady();
      return await ctx.ports.getSessionStoreController()?.export(id);
    },
  };
}
