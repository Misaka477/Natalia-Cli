import { pdfPluginEntry, toolPluginCatalog } from "./tool-catalog";
import {
  createTaskModulePlugin,
  TASK_MODULE_PLUGIN_ID,
} from "@natalia/plugin-task-module";
import {
  createTaskWorkflowPlugin,
  TASK_WORKFLOW_PLUGIN_ID,
} from "@natalia/plugin-task-workflow";
import type { RuntimePluginCatalogInput } from "./catalog-input";
import {
  localToolsPluginEntry,
  mcpPluginEntry,
  skillsPluginEntry,
  teamPluginEntry,
} from "./catalog-entries";
import { describePlugin } from "./desired-entry";
import type { DesiredPluginEntry } from "@natalia/plugin";

export function runtimePluginCatalog(
  input: RuntimePluginCatalogInput,
): DesiredPluginEntry[] {
  return [
    ...toolPluginCatalog(input).map((entry) => describePlugin(entry)),
    skillsPluginEntry(input.skills),
    describePlugin(pdfPluginEntry(input.pdfEnabled)),
    ...(input.taskModule
      ? [
          describePlugin(
            {
              id: TASK_MODULE_PLUGIN_ID,
              enabled: true,
              create: () => createTaskModulePlugin(input.taskModule!),
            },
            input.taskModule,
          ),
        ]
      : []),
    localToolsPluginEntry(input.localTools),
    mcpPluginEntry(input.mcp),
    teamPluginEntry(input.team?.enabled === true),
    ...(input.taskWorkflow
      ? [
          describePlugin(
            {
              id: TASK_WORKFLOW_PLUGIN_ID,
              enabled: input.taskWorkflow.enabled,
              create: () =>
                createTaskWorkflowPlugin(input.taskWorkflow!.controller),
            },
            input.taskWorkflow,
          ),
        ]
      : []),
  ];
}
