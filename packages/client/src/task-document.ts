import type {
  NataliaTaskDocument,
  NataliaTaskDocumentInput,
} from "@natalia/contracts";
import { NataliaDocumentStore } from "@natalia/workflow";

/**
 * The task editor deliberately uses the same document store as CLI execution.
 * Saving validates the document and atomically writes it, while references are
 * reported by the overview afterwards so an operator can save an unfinished
 * draft as "Needs attention" instead of losing it.
 */
export async function loadTaskDocument(input: {
  workspaceRoot: string;
  path: string;
}): Promise<NataliaTaskDocument> {
  const documents = new NataliaDocumentStore(input.workspaceRoot);
  return documents.loadTaskDocument(input.path);
}

export async function saveTaskDocument(input: {
  workspaceRoot: string;
  path?: string;
  document: NataliaTaskDocumentInput;
}) {
  const documents = new NataliaDocumentStore(input.workspaceRoot);
  return documents.saveTask(input.document, input.path);
}

export async function deleteTaskDocument(input: {
  workspaceRoot: string;
  path: string;
}) {
  const documents = new NataliaDocumentStore(input.workspaceRoot);
  await documents.deleteTask(input.path);
}

export function newScheduledTaskID() {
  return `task_${crypto.randomUUID().replace(/-/gu, "")}`;
}
