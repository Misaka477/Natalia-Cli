/**
 * The task-module capability.
 *
 * This is the reference example of a capability that **owns its contributions**
 * rather than being named by the runtime. It declares the `tools` grant and
 * contributes its three task-scoped tools through the kernel, so:
 *
 *   - the runtime never mentions `flow_module_complete`, `report_issue` or
 *     `read_data_source` when wiring the tool registry;
 *   - the kernel refuses a contribution outside the grant;
 *   - unloading the capability removes the tools, because the kernel owns them.
 *
 * To add a feature of this shape, write a file like this one and register it. No
 * change to `real-runtime`'s tool wiring is required.
 */
import type {
  CapabilityRegistration,
  CapabilityRegistry,
} from "@natalia/capability";
import { taskModuleTools, type TaskModuleContext } from "./task-module-tools";

export const TASK_MODULE_CAPABILITY_ID = "natalia-task-module";

/**
 * Session scope is the honest choice: these tools only mean anything inside the
 * one flow-module execution the controller bound them to, so they must not
 * outlive it.
 */
export function taskModuleCapability(): CapabilityRegistration {
  return {
    id: TASK_MODULE_CAPABILITY_ID,
    name: "Task Module",
    version: "1.0.0",
    description:
      "Task-scoped tools for the active flow module: completion claims, issue reporting and incremental data source reads.",
    scope: "session",
    grants: ["tools"],
  };
}

/**
 * Registers the capability and returns whether it loaded. The caller decides what
 * to do with a failure; it is never swallowed here.
 */
export function registerTaskModuleCapability(
  registry: CapabilityRegistry,
  context: TaskModuleContext,
): { ok: true } | { ok: false; reason: string } {
  const result = registry.tryLoad(taskModuleCapability(), (capability) => {
    for (const tool of taskModuleTools(context))
      capability.contribute("tools", tool.name, tool);
  });
  return result.ok ? { ok: true } : { ok: false, reason: result.reason };
}
