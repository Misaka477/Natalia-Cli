import type { Plugin, PluginManifest } from "@natalia/plugin";
import { taskModuleTools, type TaskModuleContext } from "./task-module-tools";

export const TASK_MODULE_PLUGIN_ID = "natalia-task-module";
export const TASK_MODULE_PLUGIN_MANIFEST: PluginManifest = {
  apiVersion: 2,
  id: TASK_MODULE_PLUGIN_ID,
  version: "1.0.0",
  name: "Task Module",
  description:
    "Task-scoped tools for the active flow module: completion claims, issue reporting and incremental data source reads.",
  entry: "natalia:task-module",
  scope: "session",
  provides: [],
  requires: [],
  optionalRequires: [],
  conflicts: [],
  dependencies: [],
  hooks: {},
  integrationPoints: ["tools"],
};

export function createTaskModulePlugin(context: TaskModuleContext): Plugin {
  return {
    manifest: TASK_MODULE_PLUGIN_MANIFEST,
    setup(api) {
      for (const tool of taskModuleTools(context)) api.tools.register(tool);
    },
  };
}
