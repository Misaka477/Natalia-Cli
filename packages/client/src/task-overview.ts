import { scheduledTaskOverview as scheduledTaskOverviewFromPlugin } from "@natalia/task-workflow-plugin";
import { effectiveFlowPermissions } from "./effective-policy";

export {
  flowOverview,
  type FlowOverview,
  type FlowRow,
  type FlowStageRow,
  type ScheduledTaskOverview,
  type ScheduledTaskRow,
} from "@natalia/task-workflow-plugin";

export function scheduledTaskOverview(
  input: Omit<
    Parameters<typeof scheduledTaskOverviewFromPlugin>[0],
    "resolveFlowPermissions"
  >,
) {
  return scheduledTaskOverviewFromPlugin({
    ...input,
    resolveFlowPermissions: effectiveFlowPermissions,
  });
}
