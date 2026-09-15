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
import { subagentHistoryInWorker } from "./session-project-client";
import { projectSubagentsInWorker } from "./secondary-worker-client";
import { perfLog } from "@natalia/runtime-services";

export function createSubagentRuntime(
  ctx: RuntimeContext,
): Pick<RuntimeServiceClient, "subagents" | "subagentHistory"> {
  return {
    async subagents(sessionID?: string): Promise<RuntimeSubagentView[]> {
      await ctx.ports.getReady();
      const start = performance.now();
      const subagents =
        ctx.ports.resolveService<SubagentsService>(SUBAGENTS_SERVICE);
      if (!subagents?.enabled()) return [];
      const ownerSessionID = sessionID ?? ctx.ports.getActiveExec()?.session.id;
      const records = subagents
        .list()
        .filter(
          (record) =>
            !ownerSessionID ||
            !record.parentSessionID ||
            record.parentSessionID === ownerSessionID,
        );
      let result: RuntimeSubagentView[];
      try {
        result = await projectSubagentsInWorker(
          records.map((record) => ({
            record,
            health: subagents.health(record.id),
          })),
        );
      } catch {
        result = records.map((record) => toSubagentView(record, subagents));
      }
      perfLog(
        `[perf] subagents done count=${result.length} +${(performance.now() - start).toFixed(1)}ms`,
      );
      return result;
    },
    async subagentHistory(
      sessionID?: SessionID,
    ): Promise<RuntimeSubagentView[]> {
      await ctx.ports.getReady();
      const start = performance.now();
      const exec = sessionID
        ? ctx.ports.getExecutionBySession().get(sessionID)
        : ctx.ports.getActiveExec();
      if (!exec) return [];
      // Sub-agent history reads the current window. Full history is a
      // deliberate escape hatch for inspector/search paths, not startup.
      const events = exec.session.events;
      let result: RuntimeSubagentView[];
      try {
        result = await subagentHistoryInWorker(events);
      } catch {
        result = events.filter(
          (
            event,
          ): event is Extract<RuntimeEvent, { type: "subagent.update" }> =>
            event.type === "subagent.update",
        );
      }
      perfLog(
        `[perf] subagentHistory done count=${result.length} +${(performance.now() - start).toFixed(1)}ms`,
      );
      return result;
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
