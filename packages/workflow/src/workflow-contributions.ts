import {
  validateNataliaDocument,
  type NataliaDocument,
} from "./natalia-documents";

export type WorkflowContributionView = {
  contributions<T>(grant: string): Array<{
    capabilityID: string;
    name: string;
    payload: T;
  }>;
  scopeOf(capabilityID: string): unknown;
};

export type WorkflowContributionsProjection = {
  documents: Record<string, NataliaDocument>;
  diagnostics: string[];
};

export function workflowContributionsProjection(
  registry: WorkflowContributionView,
): WorkflowContributionsProjection {
  const documents: Record<string, NataliaDocument> = {};
  const diagnostics: string[] = [];
  for (const entry of registry.contributions<unknown>("workflows")) {
    if (!registry.scopeOf(entry.capabilityID)) continue;
    try {
      const document = validateNataliaDocument(entry.payload);
      const id =
        document.kind === "natalia-flow" ? document.flowID : document.taskID;
      documents[`cap:${entry.capabilityID}/${id}.yaml`] = document;
    } catch (error) {
      diagnostics.push(
        `capability ${entry.capabilityID} contributed invalid workflow "${entry.name}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return { documents, diagnostics };
}
