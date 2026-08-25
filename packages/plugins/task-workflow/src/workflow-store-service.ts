import { readdir } from "node:fs/promises";
import type { NataliaTaskDocument } from "@natalia/contracts";
import {
  NataliaDocumentStore,
  NataliaTaskAlertQueue,
  NataliaTaskStateStore,
  NataliaUnattendedStateStore,
  type ContributedNataliaDocuments,
  type NataliaFlowModuleEvent,
} from "@natalia/workflow";

/** Store construction owned by the task-workflow plugin package. */
export function createWorkflowStoreService(input: {
  workspaceRoot: string;
  contributedDocuments?: ContributedNataliaDocuments;
}) {
  const documents = new NataliaDocumentStore(
    input.workspaceRoot,
    input.contributedDocuments,
  );
  return {
    loadTask: (path: string) => documents.loadTask(path),
    loadTaskDocument: (path: string) => documents.loadTaskDocument(path),
    loadTaskByID: (taskID: string) => documents.loadTaskByID(taskID),
    loadFlow: (path: string) => documents.loadFlow(path),
    loadFlowByID: (flowID: string) => documents.loadFlowByID(flowID),
    resolveTaskFlow: (task: NataliaTaskDocument) =>
      documents.resolveTaskFlow(task),
    async taskDocuments() {
      let entries: string[];
      try {
        entries = (await readdir(documents.tasksDir)).filter((entry) =>
          /\.ya?ml$/iu.test(entry),
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
      }
      const tasks = await Promise.all(
        entries.sort().map(async (path) => ({
          path,
          task: await documents.loadTaskDocument(path).catch(() => undefined),
        })),
      );
      return tasks.filter(
        (entry): entry is { path: string; task: NataliaTaskDocument } =>
          Boolean(entry.task),
      );
    },
  };
}

export function createWorkflowExecutionStoreService(workspaceRoot: string) {
  return {
    openTaskState: (onModuleEvent?: (event: NataliaFlowModuleEvent) => void) =>
      NataliaTaskStateStore.open(workspaceRoot, onModuleEvent),
    openAlertQueue: () => NataliaTaskAlertQueue.open(workspaceRoot),
    openUnattendedState: (taskID: string) =>
      NataliaUnattendedStateStore.open(workspaceRoot, taskID),
  };
}

export type WorkflowStoreService = ReturnType<
  typeof createWorkflowStoreService
>;
export type WorkflowExecutionStoreService = ReturnType<
  typeof createWorkflowExecutionStoreService
>;
export type TaskStateService = Awaited<
  ReturnType<WorkflowExecutionStoreService["openTaskState"]>
>;
export type TaskAlertQueueService = Awaited<
  ReturnType<WorkflowExecutionStoreService["openAlertQueue"]>
>;
