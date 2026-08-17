import { resolve } from "node:path";
import type { CapabilityHost } from "@natalia/capability";
import type {
  ConfigV3,
  NataliaFlowDocument,
  NataliaTaskDocument,
} from "@natalia/contracts";
import { NataliaDocumentStore, type NataliaDocument } from "@natalia/workflow";
import { runTaskFromDocument, type TaskRunResult } from "./task-controller";
import { workflowContributionsProjection } from "./workflow-contributions";
import {
  WorkflowExecutionScheduler,
  type WorkflowExecutionHandle,
} from "./workflow-execution-scheduler";

export type CapabilityTaskExecutionRequest = {
  executionID?: string;
  idempotencyKey?: string;
  idempotencyFingerprint?: string;
  workspaceRoot: string;
  path?: string;
  taskID?: string;
  config: ConfigV3;
  json?: boolean;
  requestedBy?: {
    transport: "local" | "worker" | "http";
    sessionID?: string;
    credentialID?: string;
  };
};

/**
 * Process-local workflow execution authority. Admission is delayed until both
 * scheduler gates are held; capability documents are then resolved, leased and
 * resolved again so queued work cannot start from a stale contribution snapshot.
 */
export class CapabilityExecutionHost {
  private readonly scheduler: WorkflowExecutionScheduler;

  constructor(
    private readonly capabilities: CapabilityHost,
    options: {
      scheduler?: WorkflowExecutionScheduler;
      globalConcurrency?: number;
      workspaceConcurrency?: number;
      globalQueueLimit?: number;
      workspaceQueueLimit?: number;
      queueTimeoutMs?: number;
    } = {},
  ) {
    this.scheduler =
      options.scheduler ?? new WorkflowExecutionScheduler(options);
  }

  runTask(
    request: CapabilityTaskExecutionRequest,
  ): WorkflowExecutionHandle<TaskRunResult> {
    const workspaceRoot = resolve(request.workspaceRoot);
    if (
      this.capabilities.workspaceRoot &&
      this.capabilities.workspaceRoot !== workspaceRoot
    )
      throw new Error(
        `capability host belongs to another workspace: ${this.capabilities.workspaceRoot}`,
      );
    return this.scheduler.schedule({
      workspaceRoot,
      executionID: request.executionID,
      idempotencyKey: request.idempotencyKey,
      idempotencyFingerprint: request.idempotencyFingerprint,
      run: async ({ signal, publishOutput, publishResolved }) => {
        signal.throwIfAborted();
        const first = await this.resolveExecutionDocuments(request);
        const lease = first.capabilityIDs.length
          ? this.capabilities.acquireExecutionLease(first.capabilityIDs)
          : undefined;
        try {
          signal.throwIfAborted();
          const current = await this.resolveExecutionDocuments(request);
          if (executionIdentity(first) !== executionIdentity(current))
            throw new Error(
              "workflow contribution changed while execution was being admitted",
            );
          publishResolved({
            taskID: current.taskID,
            flowID: current.flowID,
            source: current.capabilityIDs.length
              ? {
                  kind: "capability",
                  capabilityIDs: current.capabilityIDs,
                }
              : { kind: "workspace" },
            requestedBy: request.requestedBy,
          });
          return await runTaskFromDocument({
            workspaceRoot,
            path: request.path,
            taskID: request.taskID,
            contributedDocuments: current.documents,
            config: request.config,
            json: request.json !== false,
            signal,
            emit: publishOutput,
          });
        } finally {
          lease?.release();
        }
      },
    });
  }

  private async resolveExecutionDocuments(
    request: CapabilityTaskExecutionRequest,
  ) {
    if (Boolean(request.path) === Boolean(request.taskID))
      throw new Error("task execution requires exactly one path or taskID");
    const projection = workflowContributionsProjection(this.capabilities.view);
    const documents = new NataliaDocumentStore(
      request.workspaceRoot,
      projection.documents,
    );
    const task = request.taskID
      ? await documents.loadTaskByID(request.taskID)
      : await documents.loadTask(request.path!);
    const flow = await documents.resolveTaskFlow(task);
    const taskPath = await effectiveTaskPath(
      request.workspaceRoot,
      request.path,
      task.taskID,
      projection.documents,
    );
    const flowPath = await effectiveFlowPath(
      request.workspaceRoot,
      task.flow.path,
      flow.flowID,
      projection.documents,
    );
    const capabilityIDs = [
      ...new Set([taskPath, flowPath].flatMap(capabilityID)),
    ];
    return {
      taskID: task.taskID,
      flowID: flow.flowID,
      taskPath,
      flowPath,
      capabilityIDs,
      documents: projection.documents,
      task,
      flow,
    };
  }
}

function executionIdentity(input: {
  taskID: string;
  flowID: string;
  taskPath?: string;
  flowPath?: string;
  capabilityIDs: string[];
  task: NataliaTaskDocument;
  flow: NataliaFlowDocument;
}) {
  return JSON.stringify({
    taskID: input.taskID,
    flowID: input.flowID,
    taskPath: input.taskPath,
    flowPath: input.flowPath,
    capabilityIDs: input.capabilityIDs,
    task: input.task,
    flow: input.flow,
  });
}

async function effectiveTaskPath(
  workspaceRoot: string,
  requestedPath: string | undefined,
  taskID: string,
  contributed: Readonly<Record<string, NataliaDocument>>,
) {
  if (requestedPath) return requestedPath;
  const disk = new NataliaDocumentStore(workspaceRoot);
  if (
    await disk.loadTaskByID(taskID).then(
      () => true,
      () => false,
    )
  )
    return undefined;
  return Object.entries(contributed).find(
    ([, document]) =>
      document.kind === "natalia-task" && document.taskID === taskID,
  )?.[0];
}

async function effectiveFlowPath(
  workspaceRoot: string,
  requestedPath: string | undefined,
  flowID: string,
  contributed: Readonly<Record<string, NataliaDocument>>,
) {
  if (requestedPath) return requestedPath;
  const disk = new NataliaDocumentStore(workspaceRoot);
  if (
    await disk.loadFlowByID(flowID).then(
      () => true,
      () => false,
    )
  )
    return undefined;
  return Object.entries(contributed).find(
    ([, document]) =>
      document.kind === "natalia-flow" && document.flowID === flowID,
  )?.[0];
}

function capabilityID(path: string | undefined) {
  if (!path?.startsWith("cap:")) return [];
  const slash = path.indexOf("/");
  return slash > 4 ? [path.slice(4, slash)] : [];
}
