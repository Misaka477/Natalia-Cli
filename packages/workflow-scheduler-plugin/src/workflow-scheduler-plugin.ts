import { CapabilityRegistry } from "@natalia/capability";
import { createPluginRegistry, type Plugin } from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";
import { WorkflowExecutionScheduler } from "./workflow-execution-scheduler";

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
  dependencies: { capabilityRegistry?: CapabilityRegistry } = {},
) {
  const capabilities =
    dependencies.capabilityRegistry ?? new CapabilityRegistry();
  const loaded = capabilities.tryLoad({
    id: WORKFLOW_SCHEDULER_PLUGIN_ID,
    name: "Workflow Scheduler",
    version: "1.0.0",
    description: "Process-level workflow admission and concurrency gates.",
    scope: "process",
    grants: ["services"],
    provides: [],
  });
  if (!loaded.ok)
    throw new Error(
      `workflow scheduler capability failed to load: ${loaded.reason}`,
    );
  if (loaded.pending || !capabilities.has(WORKFLOW_SCHEDULER_PLUGIN_ID)) {
    capabilities.unload(WORKFLOW_SCHEDULER_PLUGIN_ID);
    throw new Error("workflow scheduler capability did not finish loading");
  }

  const registry = createPluginRegistry({
    tools: createToolRegistry([]),
    allowed: ["services"],
    contribute: () => (kind, name, payload) => {
      capabilities.contribute(
        WORKFLOW_SCHEDULER_PLUGIN_ID,
        kind,
        name,
        payload,
      );
      return () => undefined;
    },
    onUnload: () => capabilities.unload(WORKFLOW_SCHEDULER_PLUGIN_ID),
    service: <T>(name: string) => capabilities.service<T>(name),
  });
  try {
    await registry.loadBuiltin(createWorkflowSchedulerPlugin(options));
  } catch (error) {
    await registry.unloadAll().catch(() => undefined);
    capabilities.unload(WORKFLOW_SCHEDULER_PLUGIN_ID);
    throw error;
  }
  const scheduler = capabilities.service(WORKFLOW_SCHEDULER_SERVICE) as
    | WorkflowExecutionScheduler
    | undefined;
  if (!scheduler) {
    await registry.unloadAll();
    throw new Error("workflow scheduler plugin failed to provide its service");
  }
  let closed = false;
  return {
    scheduler,
    service: <T>(name: string) => capabilities.service<T>(name),
    close: async () => {
      if (closed) return;
      closed = true;
      await registry.unloadAll();
    },
  };
}
