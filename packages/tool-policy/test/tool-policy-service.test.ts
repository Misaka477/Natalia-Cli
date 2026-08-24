import { expect, test } from "bun:test";
import { TOOL_POLICY_SERVICE } from "@natalia/runtime-services";
import { createToolPolicyService } from "../src";

test("tool policy service owns the unique policy funnel", () => {
  const service = createToolPolicyService();
  expect(TOOL_POLICY_SERVICE).toBe("tool.policy");
  expect(service.createExecutionPipeline).toBeTypeOf("function");
  expect(service.createHookLayer).toBeTypeOf("function");
  expect(service.evaluatePermissionRules).toBeTypeOf("function");
  expect(service.workspaceWritePathForTool).toBeTypeOf("function");
  expect(service.workspaceWritePathsForTool).toBeTypeOf("function");
  expect(service.commandTextForTool).toBeTypeOf("function");
  expect(service.createExecutionPipeline()).toBeDefined();
});
