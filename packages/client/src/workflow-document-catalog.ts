import {
  NataliaDocumentStore,
  type ContributedNataliaDocuments,
} from "@natalia/workflow";
import { readdir } from "node:fs/promises";
import type { ConfigV2 } from "@natalia/contracts";
import { manualFlowTask } from "./flow-document";
import { effectiveFlowPermissions } from "./effective-policy";
import { assertTaskReferences } from "./task-preflight";

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
          const launch = await taskLaunchReadiness(documents, document, config);
          choices.push({
            kind,
            path,
            id: document.taskID,
            displayName: document.displayName,
            source: documentSource(path),
            launch,
          });
        } else {
          const document = await documents.loadFlow(
            documents.isContributedPath(path) ? path : `.natalia/flows/${path}`,
          );
          choices.push({
            kind,
            path,
            id: document.flowID,
            displayName: document.displayName,
            source: documentSource(path),
            launch: flowLaunchReadiness(document, config),
          });
        }
      } catch {
        // Unreadable documents stay visible in management surfaces, not launch completion.
      }
    }
  }
  return choices;
}

function documentSource(path: string): WorkflowDocumentChoice["source"] {
  if (!path.startsWith("cap:")) return { kind: "workspace" };
  return {
    kind: "capability",
    capabilityID: path.slice("cap:".length, path.indexOf("/")),
  };
}

function flowLaunchReadiness(
  document: Parameters<typeof manualFlowTask>[0],
  config?: ConfigV2,
): WorkflowDocumentChoice["launch"] {
  if (!config) return { ready: false, reason: "runtime config is unavailable" };
  try {
    manualFlowTask(document, config);
    return { ready: true };
  } catch (error) {
    return {
      ready: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

async function taskLaunchReadiness(
  documents: NataliaDocumentStore,
  task: Awaited<ReturnType<NataliaDocumentStore["loadTaskDocument"]>>,
  config?: ConfigV2,
): Promise<WorkflowDocumentChoice["launch"]> {
  if (!config) return { ready: false, reason: "runtime config is unavailable" };
  try {
    const flow = await documents.resolveTaskFlow(task);
    assertTaskReferences({ task, config });
    if (!flow.modules.some((module) => module.enabled))
      throw new Error(`task flow has no enabled modules: ${flow.flowID}`);
    const conditionless = flow.modules.find(
      (module) => module.enabled && !module.minimumConditions.length,
    );
    if (conditionless)
      throw new Error(
        `stage has no minimum completion condition: ${conditionless.id}`,
      );
    const blocked = effectiveFlowPermissions({
      profile: config.permissionProfiles[task.permissionProfile],
      flow,
      taskCapabilities: {
        reportIssue: Boolean(task.issueTarget),
        readDataSource: Boolean(task.dataSource),
      },
    }).blocked[0];
    if (blocked) throw new Error(`${blocked.moduleID}: ${blocked.reason}`);
    return { ready: true };
  } catch (error) {
    return {
      ready: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
