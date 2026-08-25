import { expect, test } from "bun:test";
import { createWorkflowSchedulerHost } from "../src";

test("workflow scheduler host owns and disposes the process service", async () => {
  const host = createWorkflowSchedulerHost();
  expect(host.scheduler).toBeDefined();

  await host.close();
  expect(() =>
    host.scheduler.schedule({
      workspaceRoot: "/tmp/workflow-scheduler",
      run: async () => "done",
    }),
  ).toThrow("workflow execution scheduler disposed");
  await host.close();
});
