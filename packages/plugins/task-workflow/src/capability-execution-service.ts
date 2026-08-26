import { resolve } from "node:path";
import type {
  CapabilityTaskExecutionRequest,
  TaskRunFromDocumentInput,
  TaskRunResult,
  WorkflowCapabilityHost,
} from "@natalia/runtime-services";
import {
  workflowContributionsProjection,
  type ContributedNataliaDocuments,
  type NataliaDocument,
  type WorkflowExecutionSchedulerService,
} from "@natalia/workflow";
import type {
  NataliaFlowDocument,
  NataliaTaskDocument,
} from "@natalia/contracts";
import { createWorkflowStoreService } from "@natalia/workflow";

export function runCapabilityTask(input: {
  capabilities: WorkflowCapabilityHost;
  scheduler: WorkflowExecutionSchedulerService;
  request: CapabilityTaskExecutionRequest;
  runTaskFromDocument(
    request: TaskRunFromDocumentInput,
  ): Promise<TaskRunResult>;
}) {
  const { request } = input;
  const workspaceRoot = resolve(request.workspaceRoot);
  if (
    input.capabilities.workspaceRoot &&
    input.capabilities.workspaceRoot !== workspaceRoot
  )
    throw new Error(
      `capability host belongs to another workspace: ${input.capabilities.workspaceRoot}`,
    );
  return input.scheduler.schedule({
    workspaceRoot,
    executionID: request.executionID,
    idempotencyKey: request.idempotencyKey,
    idempotencyFingerprint: request.idempotencyFingerprint,
    run: async ({ signal, publishOutput, publishResolved }) => {
      signal.throwIfAborted();
      const first = await resolveExecutionDocuments(
        input.capabilities,
        request,
      );
      const lease = first.capabilityIDs.length
        ? input.capabilities.acquireExecutionLease(first.capabilityIDs)
        : undefined;
      try {
        signal.throwIfAborted();
        const current = await resolveExecutionDocuments(
          input.capabilities,
          request,
        );
        if (executionIdentity(first) !== executionIdentity(current))
          throw new Error(
            "workflow contribution changed while execution was being admitted",
          );
        publishResolved({
          taskID: current.taskID,
          flowID: current.flowID,
          source: current.capabilityIDs.length
            ? { kind: "capability", capabilityIDs: current.capabilityIDs }
            : { kind: "workspace" },
          requestedBy: request.requestedBy,
        });
        return await input.runTaskFromDocument({
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

async function resolveExecutionDocuments(
  capabilities: WorkflowCapabilityHost,
  request: CapabilityTaskExecutionRequest,
) {
  if (Boolean(request.path) === Boolean(request.taskID))
    throw new Error("task execution requires exactly one path or taskID");
  const projection = workflowContributionsProjection(capabilities.view);
  const documents = createWorkflowStoreService({
    workspaceRoot: request.workspaceRoot,
    contributedDocuments: projection.documents,
  });
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

function executionIdentity(input: {
  taskID: string;
  flowID: string;
  taskPath?: string;
  flowPath?: string;
  capabilityIDs: string[];
  task: NataliaTaskDocument;
  flow: NataliaFlowDocument;
}) {
  return JSON.stringify(input);
}

async function effectiveTaskPath(
  workspaceRoot: string,
  requestedPath: string | undefined,
  taskID: string,
  contributed: Readonly<Record<string, NataliaDocument>>,
) {
  if (requestedPath) return requestedPath;
  const disk = createWorkflowStoreService({ workspaceRoot });
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
  const disk = createWorkflowStoreService({ workspaceRoot });
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
