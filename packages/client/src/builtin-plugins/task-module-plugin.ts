/**
 * The task-module built-in plugin.
 *
 * The task-scoped tools for the active flow module (`flow_module_complete`,
 * `report_issue`, `read_data_source`) load through the same plugin lifecycle as
 * every other built-in: the plugin owns its contributions, unloading releases
 * them, and a disabled or absent plugin leaves no tools behind. It is created
 * only when the host is running inside a flow-module execution (a
 * `TaskModuleContext` is bound), so in an ordinary session it never exists.
 */
import type { Plugin } from "@natalia/plugin";
import {
  taskModuleTools,
  type TaskModuleContext,
} from "../capabilities/task-module-tools";

export const TASK_MODULE_PLUGIN_ID = "natalia-task-module";

export function createTaskModulePlugin(context: TaskModuleContext): Plugin {
  return {
    manifest: {
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
    },
    setup(api) {
      for (const tool of taskModuleTools(context)) api.tools.register(tool);
    },
  };
}
