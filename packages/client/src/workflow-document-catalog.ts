import { NataliaDocumentStore } from "@natalia/workflow";
import { readdir } from "node:fs/promises";
import type { ConfigV2 } from "@natalia/contracts";
import { manualFlowTask } from "./flow-document";

export type WorkflowDocumentChoice = {
  kind: "task" | "flow";
  path: string;
  id: string;
  displayName: string;
};

export async function workflowDocumentCatalog(
  workspaceRoot: string,
  config?: ConfigV2,
): Promise<WorkflowDocumentChoice[]> {
  const documents = new NataliaDocumentStore(workspaceRoot);
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
    for (const path of entries.sort()) {
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
          const document = await documents.loadFlow(`.natalia/flows/${path}`);
          const profile = document.directRun?.permissionProfile;
          if (!profile) continue;
          if (config) manualFlowTask(document, config);
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
