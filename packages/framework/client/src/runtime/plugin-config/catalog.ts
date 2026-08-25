import { pdfPluginEntry, toolPluginCatalog } from "./tool-catalog";
import {
  createTaskModulePlugin,
  TASK_MODULE_PLUGIN_ID,
} from "@natalia/plugin-task-module";
import {
  createTaskWorkflowPlugin,
  TASK_WORKFLOW_PLUGIN_ID,
} from "@natalia/plugin-task-workflow";
import {
  createTerminalPlugin,
  TERMINAL_PLUGIN_ID,
  TERMINAL_PLUGIN_MANIFEST,
} from "@natalia/plugin-native-terminal";
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
    ...(input.terminal ? [terminalPluginEntry(input)] : []),
  ];
}

/**
 * The terminal plugin is assembled from the live controller input callbacks
 * and the host-owned registry (`options.nativeTerminal`), but its identity is
 * derived from `windowMode` alone. Everything else in the input is recreated on
 * every catalog build, so fingerprinting the whole object would unload and
 * rebuild the controller on every reload. `windowMode` is the only input that
 * changes controller behavior at construction, so a reload only tears the
 * plugin down when that mode actually changed.
 */
function terminalPluginEntry(
  input: RuntimePluginCatalogInput,
): DesiredPluginEntry {
  const windowMode = input.terminal!.windowMode();
  return describePlugin(
    {
      id: TERMINAL_PLUGIN_ID,
      enabled: input.terminalEnabled,
      manifest: TERMINAL_PLUGIN_MANIFEST,
      create: () => createTerminalPlugin(input.terminal!),
    },
    { windowMode },
  );
}
