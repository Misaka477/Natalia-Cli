export {
  createFlowModuleCompleteTool,
  createReadDataSourceTool,
  createReportIssueTool,
  taskModuleTools,
} from "./task-module-tools";
export type {
  TaskModuleContext,
  TaskReadDataSource,
  TaskReportIssue,
} from "@natalia/workflow";
export {
  createTaskModulePlugin,
  TASK_MODULE_PLUGIN_ID,
  TASK_MODULE_PLUGIN_MANIFEST,
} from "./task-module-plugin";
import type { Plugin, PluginAPI } from "@natalia/plugin";
import { TASK_MODULE_INPUT_SERVICE } from "@natalia/runtime-services";
import type { TaskModuleContext } from "@natalia/workflow";
import {
  createTaskModulePlugin,
  TASK_MODULE_PLUGIN_MANIFEST,
} from "./task-module-plugin";

export type TaskModuleRuntimeInput = TaskModuleContext;

const taskModulePlugin: Plugin = {
  manifest: {
    ...TASK_MODULE_PLUGIN_MANIFEST,
    entry: "index.js",
    requires: [TASK_MODULE_INPUT_SERVICE],
  },
  setup(api: PluginAPI) {
    const input = api.services.get<TaskModuleRuntimeInput>(
      TASK_MODULE_INPUT_SERVICE,
    );
    if (!input)
      throw new Error(`missing runtime service: ${TASK_MODULE_INPUT_SERVICE}`);
    return createTaskModulePlugin(input).setup(api);
  },
};

export default taskModulePlugin;
