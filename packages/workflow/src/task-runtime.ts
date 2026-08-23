import type {
  EpisodeID,
  NataliaFlowDocument,
  NataliaTaskDocument,
  RuntimeEvent,
  SessionID,
} from "@natalia/contracts";
import { effectiveFlowPermissions } from "./effective-policy";

export type HeadlessExecution = {
  episodeID: EpisodeID;
  sessionID: SessionID;
  title: string;
  useSqliteStore: boolean;
};

export function newHeadlessExecution(): HeadlessExecution {
  const episodeID =
    `epi_${crypto.randomUUID().replace(/-/gu, "")}` as EpisodeID;
  return {
    episodeID,
    sessionID: `ses_${episodeID.slice("epi_".length)}` as SessionID,
    title: `Natalia unattended episode ${episodeID}`,
    useSqliteStore: true,
  };
}

export function plainRuntimeEvent(event: RuntimeEvent) {
  if (event.type === "diagnostic") return `${event.level}: ${event.message}`;
  if (event.type === "turn.finished")
    return `turn finished: ${event.stopReason}`;
  if (event.type === "checkpoint.created") return `checkpoint ${event.id}`;
  if (event.type === "rollback.end")
    return `rollback ${event.checkpointID} done`;
  return undefined;
}

export function taskPermissionPreview(input: {
  task: NataliaTaskDocument;
  flow: NataliaFlowDocument;
  config: import("@natalia/contracts").ConfigV3;
}) {
  return {
    taskID: input.task.taskID,
    permissionProfile: input.task.permissionProfile,
    ...effectiveFlowPermissions({
      profile: input.config.permissionProfiles[input.task.permissionProfile],
      flow: input.flow,
      taskCapabilities: {
        reportIssue: Boolean(input.task.issueTarget),
        readDataSource: Boolean(input.task.dataSource),
      },
    }),
  };
}

export function taskRetryMaxAttempts(
  retry: NataliaTaskDocument["retry"],
): number {
  if (retry === "once") return 2;
  if (retry === "twice") return 3;
  if (retry === "three_times") return 4;
  return 1;
}

export type ModuleCompletionOperations = {
  tools: Map<string, RuntimeEvent & { type: "tool.update" }>;
  terminals: Map<string, RuntimeEvent & { type: "terminal.update" }>;
  approvals: Set<string>;
};

export function newModuleCompletionOperations(): ModuleCompletionOperations {
  return { tools: new Map(), terminals: new Map(), approvals: new Set() };
}

export function trackModuleCompletionOperation(
  operations: ModuleCompletionOperations,
  event: RuntimeEvent,
) {
  if (event.type === "tool.update") {
    const id = event.callID ?? event.id;
    if (
      [
        "receiving_arguments",
        "queued",
        "awaiting_approval",
        "running",
      ].includes(event.status)
    )
      operations.tools.set(id, event);
    else operations.tools.delete(id);
    return;
  }
  if (event.type === "terminal.update") {
    if (["starting", "running", "awaiting_approval"].includes(event.status))
      operations.terminals.set(event.id, event);
    else operations.terminals.delete(event.id);
    return;
  }
  if (event.type === "approval.request") operations.approvals.add(event.id);
  if (event.type === "approval.response") operations.approvals.delete(event.id);
  if (event.type === "terminal.approval") {
    if (event.state === "awaiting") operations.approvals.add(event.approvalID);
    else operations.approvals.delete(event.approvalID);
  }
}

export function moduleCompletionOperationProblem(
  operations: ModuleCompletionOperations,
) {
  const pending = [
    ...[...operations.tools.entries()].map(
      ([id, event]) => `tool ${event.name} (${id}) is ${event.status}`,
    ),
    ...[...operations.terminals.entries()].map(
      ([id, event]) => `terminal ${id} is ${event.status}`,
    ),
    ...[...operations.approvals].map(
      (id) => `approval ${id} is awaiting a response`,
    ),
  ];
  return pending.length ? pending.join("; ") : undefined;
}
