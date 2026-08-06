import type {
  NataliaFlowDocument,
  NataliaFlowDocumentInput,
} from "@natalia/contracts";
import { NataliaDocumentStore } from "@natalia/workflow";

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

export function newFlowID() {
  return `flow_${crypto.randomUUID().replace(/-/gu, "")}`;
}
