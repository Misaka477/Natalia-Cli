import { expect, test } from "bun:test";
import { CapabilityRegistry } from "@natalia/capability";
import {
  createWorkflowSchedulerPluginHost,
  WORKFLOW_SCHEDULER_PLUGIN_ID,
  WORKFLOW_SCHEDULER_SERVICE,
} from "../src";

test("workflow scheduler host owns and disposes the process service", async () => {
  const capabilities = new CapabilityRegistry();
  const host = await createWorkflowSchedulerPluginHost(
    {},
    {
      capabilityRegistry: capabilities,
    },
  );
  expect(host.scheduler).toBeDefined();
  expect(WORKFLOW_SCHEDULER_PLUGIN_ID).toBe("natalia-workflow-scheduler");
  expect(WORKFLOW_SCHEDULER_SERVICE).toBe("workflow-execution.scheduler");
  expect(capabilities.has(WORKFLOW_SCHEDULER_PLUGIN_ID)).toBe(true);
  expect(capabilities.service<unknown>(WORKFLOW_SCHEDULER_SERVICE)).toBe(
    host.scheduler,
  );

  await host.close();
  expect(capabilities.has(WORKFLOW_SCHEDULER_PLUGIN_ID)).toBe(false);
  expect(capabilities.service(WORKFLOW_SCHEDULER_SERVICE)).toBeUndefined();
  expect(() =>
    host.scheduler.schedule({
      workspaceRoot: "/tmp/workflow-scheduler-plugin",
      run: async () => "done",
    }),
  ).toThrow("workflow execution scheduler disposed");
  await host.close();
});

test("workflow scheduler host fails before plugin setup when capability loading fails", async () => {
  const capabilities = new CapabilityRegistry();
  capabilities.registerOwner({
    id: WORKFLOW_SCHEDULER_PLUGIN_ID,
    name: "Existing owner",
    version: "1.0.0",
    scope: "process",
    grants: [],
  });

  await expect(
    createWorkflowSchedulerPluginHost({}, { capabilityRegistry: capabilities }),
  ).rejects.toThrow("already registered");
  expect(capabilities.has(WORKFLOW_SCHEDULER_PLUGIN_ID)).toBe(true);
  expect(capabilities.service(WORKFLOW_SCHEDULER_SERVICE)).toBeUndefined();
});

test("workflow scheduler host rolls back capability ownership when contribution fails", async () => {
  class RefusingCapabilityRegistry extends CapabilityRegistry {
    override registerOwner(
      registration: Parameters<CapabilityRegistry["registerOwner"]>[0],
    ) {
      const owner = super.registerOwner(registration);
      return {
        ...owner,
        contribute(): () => void {
          throw new Error("service contribution refused");
        },
      };
    }
  }
  const capabilities = new RefusingCapabilityRegistry();

  await expect(
    createWorkflowSchedulerPluginHost({}, { capabilityRegistry: capabilities }),
  ).rejects.toThrow("service contribution refused");
  expect(capabilities.has(WORKFLOW_SCHEDULER_PLUGIN_ID)).toBe(false);
  expect(capabilities.service(WORKFLOW_SCHEDULER_SERVICE)).toBeUndefined();
});
