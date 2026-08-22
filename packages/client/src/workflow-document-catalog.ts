import { workflowDocumentCatalog as workflowDocumentCatalogFromPlugin } from "@natalia/task-workflow-plugin";
import type { ConfigV3 } from "@natalia/contracts";
import type { ContributedNataliaDocuments } from "@natalia/workflow";
import { effectiveFlowPermissions } from "./effective-policy";

export type { WorkflowDocumentChoice } from "@natalia/task-workflow-plugin";

export function workflowDocumentCatalog(
  workspaceRoot: string,
  config?: ConfigV3,
  contributedDocuments?: ContributedNataliaDocuments,
) {
  return workflowDocumentCatalogFromPlugin(
    workspaceRoot,
    config,
    contributedDocuments,
    effectiveFlowPermissions,
  );
}
