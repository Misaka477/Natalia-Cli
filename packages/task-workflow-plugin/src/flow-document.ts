import { RuntimeRefusal } from "@natalia/contracts";
import type {
  ConfigV3,
  NataliaFlowDocument,
  NataliaFlowDocumentInput,
  NataliaTaskDocument,
} from "@natalia/contracts";
import { agentsFromConfig } from "@natalia/agent-plugin";
import { resolveEffectiveModel } from "@natalia/config";
import { modelRefKey } from "@natalia/contracts";
import { providerForModel } from "@natalia/runtime";
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
    throw new RuntimeRefusal(
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

export function manualFlowTask(
  flow: NataliaFlowDocument,
  config: ConfigV3,
): NataliaTaskDocument {
  const permissionProfile = flow.directRun?.permissionProfile;
  if (!permissionProfile)
    throw new Error(
      `flow manual run profile is not configured: ${flow.flowID}`,
    );
  const profile = config.permissionProfiles[permissionProfile];
  if (!profile)
    throw new Error(`flow manual run profile not found: ${permissionProfile}`);
  if (profile.approval !== "auto")
    throw new Error(
      `flow manual run profile must use auto approval: ${permissionProfile}`,
    );
  const agent = agentsFromConfig(config).default();
  const ref =
    agent?.model ??
    (config.defaultModel ? modelRefKey(config.defaultModel) : undefined);
  const effective = ref ? resolveEffectiveModel(config, ref) : undefined;
  if (!ref || !effective || !providerForModel(config, ref, agent?.variant))
    throw new Error("flow manual run requires an available default model");
  return {
    kind: "natalia-task",
    version: 1,
    taskID: `manual_flow_${flow.flowID}`,
    displayName: `Manual · ${flow.displayName}`,
    schedule: "manual",
    prompt: `Execute the flow "${flow.displayName}" in module order. Follow each active module's instructions and completion conditions.`,
    permissionProfile,
    flow: { flowID: flow.flowID },
    // A manual run retries once as a whole when a module stalls or blocks:
    // a model that misformatted a claim or evaluation gets a fresh attempt
    // instead of the flow being killed outright.
    retry: "once",
    alerts: [],
    evaluator: { provider: effective.providerID, model: effective.ref.model },
  };
}
