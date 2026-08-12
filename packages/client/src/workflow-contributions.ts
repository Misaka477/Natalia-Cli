import type { CapabilityRegistryView } from "@natalia/capability";
import type { NataliaDocument } from "@natalia/workflow";
import { validateNataliaDocument } from "@natalia/workflow";

export type WorkflowContributionsProjection = {
  documents: Record<string, NataliaDocument>;
  diagnostics: string[];
};

/**
 * Turns opaque workflow grant payloads into the virtual document source the
 * workflow store understands. Validation belongs here, at the host boundary:
 * the capability kernel intentionally cannot depend on workflow contracts.
 */
export function workflowContributionsProjection(
  registry: CapabilityRegistryView,
): WorkflowContributionsProjection {
  const documents: Record<string, NataliaDocument> = {};
  const diagnostics: string[] = [];
  for (const entry of registry.contributions<unknown>("workflows")) {
    // `contributions` is effective-only, but retain this check so a stale or
    // custom registry cannot make an unloaded capability visible.
    if (!registry.scopeOf(entry.capabilityID)) continue;
    try {
      const document = validateNataliaDocument(entry.payload);
      const id =
        document.kind === "natalia-flow" ? document.flowID : document.taskID;
      const path = `cap:${entry.capabilityID}/${id}.yaml`;
      documents[path] = document;
    } catch (error) {
      diagnostics.push(
        `capability ${entry.capabilityID} contributed invalid workflow "${entry.name}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return { documents, diagnostics };
}
