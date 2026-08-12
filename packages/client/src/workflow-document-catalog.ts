import {
  NataliaDocumentStore,
  type ContributedNataliaDocuments,
} from "@natalia/workflow";
import { readdir } from "node:fs/promises";
import type { ConfigV2 } from "@natalia/contracts";
import { manualFlowTask } from "./flow-document";

import type { WorkflowDocumentChoice } from "@natalia/contracts";
export type { WorkflowDocumentChoice } from "@natalia/contracts";

export async function workflowDocumentCatalog(
  workspaceRoot: string,
  config?: ConfigV2,
  contributedDocuments?: ContributedNataliaDocuments,
): Promise<WorkflowDocumentChoice[]> {
  const documents = new NataliaDocumentStore(
    workspaceRoot,
    contributedDocuments,
  );
  const choices: WorkflowDocumentChoice[] = [];
  for (const [kind, directory] of [
    ["task", documents.tasksDir],
    ["flow", documents.flowsDir],
  ] as const) {
    let entries: string[] = [];
    try {
      entries = (await readdir(directory)).filter((entry) =>
        /\.ya?ml$/iu.test(entry),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const paths = [
      ...entries.sort(),
      ...documents.contributedDocumentPaths(kind),
    ];
    for (const path of paths) {
      try {
        if (kind === "task") {
          const document = await documents.loadTaskDocument(path);
          choices.push({
            kind,
            path,
            id: document.taskID,
            displayName: document.displayName,
          });
        } else {
          const document = await documents.loadFlow(
            documents.isContributedPath(path) ? path : `.natalia/flows/${path}`,
          );
          const profile = document.directRun?.permissionProfile;
          // A contributed flow is a management document even before it gains a
          // direct-run profile. Disk flows keep the launch catalog's existing
          // direct-run filter.
          if (!profile && !documents.isContributedPath(path)) continue;
          if (profile && config) manualFlowTask(document, config);
          choices.push({
            kind,
            path,
            id: document.flowID,
            displayName: document.displayName,
          });
        }
      } catch {
        // Unreadable documents stay visible in management surfaces, not launch completion.
      }
    }
  }
  return choices;
}
