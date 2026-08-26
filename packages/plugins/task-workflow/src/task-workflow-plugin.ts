import type { Plugin, PluginManifest } from "@natalia/plugin";
import { createTaskWorkflowController } from "./task-workflow-controller";
import {
  TASK_WORKFLOW_CONTROLLER_SERVICE,
  type TaskWorkflowService,
} from "@natalia/runtime-services";

export const TASK_WORKFLOW_PLUGIN_ID = "natalia-task-workflow";
export const TASK_WORKFLOW_PLUGIN_MANIFEST: PluginManifest = {
  apiVersion: 2,
  id: TASK_WORKFLOW_PLUGIN_ID,
  version: "1.0.0",
  name: "Task Workflow",
  description: "Task and workflow documents, preflight and scheduling.",
  entry: "index.js",
  scope: "workspace",
  provides: [TASK_WORKFLOW_CONTROLLER_SERVICE],
  requires: [],
  optionalRequires: [],
  conflicts: [],
  dependencies: [],
  hooks: {},
  integrationPoints: ["services", "commands"],
};
export function createTaskWorkflowPlugin(
  input: Parameters<typeof createTaskWorkflowController>[0],
): Plugin {
  let controller: TaskWorkflowService | undefined;
  return {
    manifest: TASK_WORKFLOW_PLUGIN_MANIFEST,
    setup(api) {
      controller = createTaskWorkflowController(input);
      api.services.provide(TASK_WORKFLOW_CONTROLLER_SERVICE, controller);
      for (const kind of ["task", "flow"] as const)
        api.commands.register({
          name: kind,
          title: `Run ${kind}`,
          description: `Run an existing ${kind} document`,
          acceptsArguments: true,
          async run(invocation) {
            if (invocation?.args.length)
              return await controller?.runCommand(
                kind,
                invocation.args.join(" "),
                invocation.signal,
              );
            const documents = await controller?.documentCatalog();
            const choices = (documents ?? []).filter(
              (document) => document.kind === kind,
            );
            if (!choices.length) return `No ${kind} documents found.`;
            return choices
              .map(
                (document) =>
                  `${document.path}${document.launch.ready ? "" : ` (unavailable: ${document.launch.reason})`}`,
              )
              .join("\n");
          },
        });
    },
    dispose() {
      controller = undefined;
    },
  };
}
