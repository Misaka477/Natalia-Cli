import { CapabilityRegistry } from "@natalia/capability";
import { createPluginRegistry, type Plugin } from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";
import { WorkflowExecutionScheduler } from "../workflow-execution-scheduler";

export const WORKFLOW_SCHEDULER_PLUGIN_ID = "natalia-workflow-scheduler";
export const WORKFLOW_SCHEDULER_SERVICE = "workflow-execution.scheduler";

export type WorkflowSchedulerOptions = ConstructorParameters<
  typeof WorkflowExecutionScheduler
>[0];

export function createWorkflowSchedulerPlugin(
  options: WorkflowSchedulerOptions = {},
): Plugin {
  let scheduler: WorkflowExecutionScheduler | undefined;
  return {
    manifest: {
      apiVersion: 2,
      id: WORKFLOW_SCHEDULER_PLUGIN_ID,
      version: "1.0.0",
      name: "Workflow Scheduler",
      description: "Process-level workflow admission and concurrency gates.",
      entry: "natalia:workflow-scheduler",
      scope: "process",
      provides: [WORKFLOW_SCHEDULER_SERVICE],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["services"],
    },
    setup(api) {
      scheduler = new WorkflowExecutionScheduler(options);
      api.services.provide(WORKFLOW_SCHEDULER_SERVICE, scheduler);
    },
    async dispose() {
      await scheduler?.dispose();
      scheduler = undefined;
    },
  };
}

/** Activates the process-scoped scheduler through the same plugin kernel path. */
export async function createWorkflowSchedulerPluginHost(
  options: WorkflowSchedulerOptions = {},
) {
  const kernel = new CapabilityRegistry();
  const registry = createPluginRegistry({
    tools: createToolRegistry([]),
    contribute: (manifest) => {
      kernel.tryLoad({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        scope: manifest.scope,
        grants: ["services"],
        provides: manifest.provides,
      });
      return (kind, name, payload) => {
        kernel.contribute(manifest.id, kind, name, payload);
        return () => undefined;
      };
    },
    onUnload: (pluginID) => kernel.unload(pluginID),
    service: (name) => kernel.service(name),
  });
  await registry.loadBuiltin(createWorkflowSchedulerPlugin(options));
  const scheduler = kernel.service<WorkflowExecutionScheduler>(
    WORKFLOW_SCHEDULER_SERVICE,
  );
  if (!scheduler) throw new Error("workflow scheduler plugin failed to load");
  return {
    scheduler,
    close: () => registry.unloadAll(),
  };
}
