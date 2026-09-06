/**
 * Subagent read surface exposed over RuntimeClient.
 *
 * This is the framework-side lazy projection: subagent records are owned by
 * the durable subagent registry, not reconstructed from the transcript event
 * stream. Keeping it here (framework/runtime) means the web/TUI transport can
 * reuse the same RPC without a plugin depending on view-store internals.
 */
import type {
  RuntimeEvent,
  RuntimeSubagentView,
  SessionID,
} from "@natalia/contracts";
import type { SubagentRecordView } from "@natalia/tools";
import {
  SUBAGENTS_SERVICE,
  type SubagentsService,
} from "@natalia/runtime-services";
import type { RuntimeContext } from "./context";
import type { RuntimeServiceClient } from "@natalia/runtime-services";

export function createSubagentRuntime(
  ctx: RuntimeContext,
): Pick<RuntimeServiceClient, "subagents" | "subagentHistory"> {
  return {
    async subagents(sessionID?: string): Promise<RuntimeSubagentView[]> {
      await ctx.ports.getReady();
      const subagents =
        ctx.ports.resolveService<SubagentsService>(SUBAGENTS_SERVICE);
      if (!subagents?.enabled()) return [];
      const ownerSessionID = sessionID ?? ctx.ports.getActiveExec()?.session.id;
      return subagents
        .list()
        .filter(
          (record) =>
            !ownerSessionID ||
            !record.parentSessionID ||
            record.parentSessionID === ownerSessionID,
        )
        .map((record) => toSubagentView(record, subagents));
    },
    async subagentHistory(
      sessionID?: SessionID,
    ): Promise<RuntimeSubagentView[]> {
      await ctx.ports.getReady();
      const exec = sessionID
        ? ctx.ports.getExecutionBySession().get(sessionID)
        : ctx.ports.getActiveExec();
      const events = exec?.session.events ?? [];
      return events.filter(
        (event): event is Extract<RuntimeEvent, { type: "subagent.update" }> =>
          event.type === "subagent.update",
      );
    },
  };
}

function toSubagentView(
  record: SubagentRecordView,
  subagents: SubagentsService,
): RuntimeSubagentView {
  return {
    type: "subagent.update",
    id: record.id,
    status: record.status,
    attached: record.attached,
    event: "status",
    task: record.task,
    ...(record.parentSessionID !== undefined
      ? { parentSessionID: record.parentSessionID }
      : {}),
    ...(record.parentAgentID !== undefined
      ? { parentAgentID: record.parentAgentID }
      : {}),
    ...(record.continuation !== undefined
      ? { continuation: record.continuation }
      : {}),
    phase: record.phase,
    activityDetail: record.activityDetail,
    health: subagents.health(record.id),
    lastActivityAt: record.lastActivityAt,
    startedAt: record.startedAt,
    ...(record.endedAt !== undefined ? { endedAt: record.endedAt } : {}),
  };
}
