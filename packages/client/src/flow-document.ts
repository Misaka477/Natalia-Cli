import type {
  NataliaFlowDocument,
  NataliaFlowDocumentInput,
  NataliaTaskDocument,
} from "@natalia/contracts";
import { NataliaDocumentStore } from "@natalia/workflow";
import { readdir } from "node:fs/promises";

function flowPath(path: string) {
  if (
    !path ||
    path.startsWith(".natalia/") ||
    path.startsWith("/") ||
    path.includes("/") ||
    path.includes("\\")
  )
    throw new Error(
      "flow editor paths must stay under .natalia/flows as a relative file name without a .natalia prefix",
    );
  return path;
}

export async function loadFlowDocument(input: {
  workspaceRoot: string;
  path: string;
}): Promise<NataliaFlowDocument> {
  const documents = new NataliaDocumentStore(input.workspaceRoot);
  return documents.loadFlow(`.natalia/flows/${flowPath(input.path)}`);
}

export async function saveFlowDocument(input: {
  workspaceRoot: string;
  path?: string;
  document: NataliaFlowDocumentInput;
}) {
  const documents = new NataliaDocumentStore(input.workspaceRoot);
  return documents.saveFlow(
    input.document,
    input.path === undefined ? undefined : flowPath(input.path),
  );
}

export async function deleteFlowDocument(input: {
  workspaceRoot: string;
  path: string;
}) {
  const path = flowPath(input.path);
  const documents = new NataliaDocumentStore(input.workspaceRoot);
  const flow = await documents.loadFlow(`.natalia/flows/${path}`);
  const references: string[] = [];
  try {
    for (const entry of await readdir(documents.tasksDir)) {
      if (!/\.ya?ml$/iu.test(entry)) continue;
      let task: NataliaTaskDocument;
      try {
        task = await documents.loadTaskDocument(entry);
      } catch (error) {
        throw new Error(
          `cannot verify flow references because task ${entry} is unreadable: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (
        task.flow.flowID === flow.flowID ||
        task.flow.path === `.natalia/flows/${path}`
      )
        references.push(task.taskID);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (references.length)
    throw new Error(
      `flow ${flow.flowID} is still used by task${references.length === 1 ? "" : "s"}: ${references.sort().join(", ")}`,
    );
  await documents.deleteFlow(path);
}

export function newFlowID() {
  return `flow_${crypto.randomUUID().replace(/-/gu, "")}`;
}
