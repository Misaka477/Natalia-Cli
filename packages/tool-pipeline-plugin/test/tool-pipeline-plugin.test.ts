import { expect, test } from "bun:test";
import { createPluginRegistry } from "@natalia/plugin";
import {
  TOOL_POLICY_SERVICE,
  type ToolPolicyService,
} from "@natalia/runtime-services";
import { createToolRegistry } from "@natalia/tools";
import { createToolPipelinePlugin, TOOL_PIPELINE_PLUGIN_ID } from "../src";

test("tool pipeline plugin owns the unique policy service", async () => {
  const services = new Map<string, unknown>();
  const registry = createPluginRegistry({
    tools: createToolRegistry([]),
    service: <T>(name: string) => services.get(name) as T | undefined,
    registerOwner: () => ({
      contribute: (kind, name, payload) => {
        if (kind === "services") services.set(name, payload);
        return () => services.delete(name);
      },
      release: () => undefined,
    }),
  });
  const plugin = createToolPipelinePlugin();
  await registry.load(plugin);

  expect(plugin.manifest.id).toBe(TOOL_PIPELINE_PLUGIN_ID);
  expect(plugin.manifest.provides).toEqual([TOOL_POLICY_SERVICE]);
  expect(services.get(TOOL_POLICY_SERVICE) as ToolPolicyService).toMatchObject({
    createExecutionPipeline: expect.any(Function),
    createHookLayer: expect.any(Function),
    evaluatePermissionRules: expect.any(Function),
  });

  await registry.unload(TOOL_PIPELINE_PLUGIN_ID);
  expect(services.get(TOOL_POLICY_SERVICE)).toBeUndefined();
});
