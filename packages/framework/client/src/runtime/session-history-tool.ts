import type { RuntimeTool } from "@natalia/tools";
import {
  SESSION_STORE_CONTROLLER_SERVICE,
  type SessionStoreController,
} from "@natalia/runtime-services";
import type { SessionID } from "@natalia/contracts";
import type { RuntimeContext } from "./context";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 200;

/**
 * Model-facing transcript paging.
 *
 * The store's `messages` query pages from the SQLite message index (falling back
 * to the session record), so a model can walk arbitrarily far back through the
 * session without the runtime materialising the whole journal. The response
 * carries `cursor.previous` (older rows) and `cursor.next` (newer rows); passing
 * a cursor back is how the model "turns the page".
 */
export function createSessionHistoryTool(ctx: RuntimeContext): RuntimeTool {
  return {
    name: "session_history",
    description:
      "Read the session transcript as a JSON page of projected turn/message rows. The response carries cursor.previous (older rows) and cursor.next (newer rows); pass a cursor back to page through history. Use it to retrieve concrete details from earlier in the session that are not in the current context.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        cursor: {
          type: "string",
          description:
            "Opaque cursor from a previous session_history response.",
        },
        limit: {
          type: "number",
          description: "Rows per page (1-200, default 40).",
        },
        order: {
          type: "string",
          enum: ["asc", "desc"],
          description:
            "Page order; omit when passing a cursor (the cursor carries it).",
        },
      },
      additionalProperties: false,
    },
    async execute(parsed, context) {
      await ctx.ports.getReady();
      const sessionID = (context.sessionID ?? ctx.ports.getSessionID()) as
        | SessionID
        | undefined;
      if (!sessionID) return JSON.stringify({ data: [], cursor: {} });
      const exec = ctx.ports.getExecutionBySession().get(sessionID);
      const attached = ctx.ports.getSession();
      const session =
        exec?.session ?? (attached?.id === sessionID ? attached : undefined);
      const store = ctx.ports.resolveService<SessionStoreController>(
        SESSION_STORE_CONTROLLER_SERVICE,
      );
      if (!store || !session)
        return JSON.stringify({
          data: [],
          cursor: {},
          error: "session_unavailable",
        });
      const args = parsed as {
        cursor?: unknown;
        limit?: unknown;
        order?: unknown;
      };
      const limit =
        typeof args.limit === "number" && Number.isFinite(args.limit)
          ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(args.limit)))
          : DEFAULT_LIMIT;
      const page = await store.messages(sessionID, session, {
        limit,
        ...(typeof args.cursor === "string" && args.cursor
          ? { cursor: args.cursor }
          : {}),
        ...(args.order === "asc" || args.order === "desc"
          ? { order: args.order }
          : {}),
      });
      return JSON.stringify(page);
    },
  };
}
