import { expect, test } from "bun:test";
import {
  builtinCapabilities,
  registerBuiltinCapabilities,
} from "../src/capabilities/builtin-capabilities";
import {
  createReadDataSourceTool,
  createReportIssueTool,
  taskModuleTools,
  type TaskModuleContext,
} from "../src/capabilities/task-module-tools";
import { CapabilityRegistry } from "@natalia/capability";
import { createPluginRegistry } from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";
import {
  createTaskModulePlugin,
  TASK_MODULE_PLUGIN_ID,
} from "../src/builtin-plugins/task-module-plugin";

// The point of extracting these factories is that they can be exercised without
// standing up a runtime. If any of these tests needed a real client, the
// extraction would not have bought anything.

test("no built-in subsystem keeps a visibility-only record", () => {
  const records = builtinCapabilities();
  // Terminal, sandbox, checkpoint and MCP controllers are all real plugins now
  // and own their capability through the plugin lifecycle; there is nothing
  // left for the runtime to construct directly, so no record claims a grant.
  expect(records).toEqual([]);
});

test("no built-in subsystem record claims to provide tools", () => {
  const registry = new CapabilityRegistry();
  registerBuiltinCapabilities(registry);
  // The tool providers are the tool-family capabilities, not these records.
  expect(registry.withGrant("tools")).toEqual([]);
});

test("registration emits no events when there are no records", () => {
  const registry = new CapabilityRegistry();
  const outcome = registerBuiltinCapabilities(registry);
  expect(outcome.failed).toEqual([]);
  expect(outcome.loaded).toEqual([]);
  expect(registry.list()).toEqual([]);
});

test("the task module plugin owns its tools through the kernel", async () => {
  const kernel = new CapabilityRegistry();
  const tools = createToolRegistry([]);
  const registry = createPluginRegistry({
    tools,
    contribute: (manifest, context) => {
      const capabilityID = context.builtin ? manifest.id : `cap:${manifest.id}`;
      kernel.tryLoad({
        id: capabilityID,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        scope: manifest.scope,
        grants: ["tools"],
        provides: [],
      });
      return (kind, name, payload) => {
        kernel.contribute(capabilityID, kind, name, payload);
        return () => undefined;
      };
    },
    onUnload: (pluginID, context) => {
      kernel.unload(context.builtin ? pluginID : `cap:${pluginID}`);
    },
  });
  await registry.loadBuiltin(
    createTaskModulePlugin(
      moduleContext({
        reportIssue: async () => ({}),
        readDataSource: async () => ({}),
      }),
    ),
  );

  // The runtime never names these tools; it reads whatever the kernel accepted.
  const contributed = kernel
    .contributions<{ name: string }>("tools")
    .map((entry) => entry.name);
  expect(contributed).toEqual([
    "flow_module_complete",
    "report_issue",
    "read_data_source",
  ]);
  expect(kernel.ownerOf("tools", "report_issue")).toBe(TASK_MODULE_PLUGIN_ID);

  // Unloading releases them, which is the property the runtime depends on when a
  // session ends.
  await registry.unload(TASK_MODULE_PLUGIN_ID);
  expect(kernel.contributions("tools")).toEqual([]);
});

test("the task module plugin declares the tools integration point only", () => {
  // The manifest grants "tools" alone, so the kernel is what stops it from
  // quietly acquiring a command or a settings surface later.
  const plugin = createTaskModulePlugin(moduleContext());
  expect(plugin.manifest.apiVersion).toBe(2);
  if (plugin.manifest.apiVersion === 2)
    expect(plugin.manifest.integrationPoints).toEqual(["tools"]);
  expect(plugin.manifest.scope).toBe("session");
});

function moduleContext(
  overrides: Partial<TaskModuleContext> = {},
): TaskModuleContext {
  return {
    store: {} as TaskModuleContext["store"],
    invocationID: "inv_1",
    attempt: 1,
    flowID: "flow_1",
    moduleID: "read",
    moduleType: "read_search",
    ...overrides,
  };
}

test("task module tools follow the controller bindings that were supplied", () => {
  expect(taskModuleTools(moduleContext()).map((tool) => tool.name)).toEqual([
    "flow_module_complete",
  ]);
  expect(
    taskModuleTools(
      moduleContext({
        reportIssue: async () => ({}),
        readDataSource: async () => ({}),
      }),
    ).map((tool) => tool.name),
  ).toEqual(["flow_module_complete", "report_issue", "read_data_source"]);
});

test("a completion claim reaches the store scoped to this invocation and attempt", async () => {
  const claims: unknown[] = [];
  const context = moduleContext({
    store: {
      claimModule(input: unknown) {
        claims.push(input);
      },
    } as unknown as TaskModuleContext["store"],
  });
  const [complete] = taskModuleTools(context);

  const result = await complete!.execute(
    {
      flowID: "flow_1",
      moduleID: "read",
      conditionStatuses: [{ id: "condition_1", status: "satisfied" }],
      evidenceRefs: ["tool:call_1"],
      gaps: [],
      recommendedAction: "continue",
    },
    {} as never,
  );

  expect(claims).toEqual([
    {
      invocationID: "inv_1",
      attempt: 1,
      claim: {
        flowID: "flow_1",
        moduleID: "read",
        conditionStatuses: [{ id: "condition_1", status: "satisfied" }],
        evidenceRefs: ["tool:call_1"],
        gaps: [],
        recommendedAction: "continue",
      },
    },
  ]);
  // A claim is only a claim: the tool must not report the task as complete.
  expect(JSON.parse(result).status).toBe("claimed");
});

test("a malformed completion claim is rejected instead of recorded", async () => {
  const context = moduleContext({
    store: {
      claimModule() {
        throw new Error("must not be reached");
      },
    } as unknown as TaskModuleContext["store"],
  });
  const [complete] = taskModuleTools(context);
  const base = {
    flowID: "flow_1",
    moduleID: "read",
    conditionStatuses: [{ id: "condition_1", status: "satisfied" }],
    evidenceRefs: [],
    gaps: [],
    recommendedAction: "continue",
  };

  // `execute` is async, so these must be awaited rejections. Asserting a
  // synchronous throw here would pass without the validator doing anything.
  await expect(complete!.execute("not an object", {} as never)).rejects.toThrow(
    "must be an object",
  );
  await expect(
    complete!.execute({ ...base, moduleID: "" }, {} as never),
  ).rejects.toThrow("moduleID");
  await expect(
    complete!.execute({ ...base, evidenceRefs: [1] }, {} as never),
  ).rejects.toThrow("evidenceRefs");
  await expect(
    complete!.execute(
      { ...base, conditionStatuses: [{ id: "c", status: "done" }] },
      {} as never,
    ),
  ).rejects.toThrow("status is invalid");
});

test("report_issue passes only the model's finding, never a credential", async () => {
  const seen: unknown[] = [];
  const tool = createReportIssueTool(async (finding) => {
    seen.push(finding);
    return { status: "created" };
  });
  // The model has no parameter through which a token could be supplied: the
  // credential is bound in the controller's closure.
  expect(Object.keys(tool.parameters.properties ?? {})).toEqual([
    "fingerprintParts",
    "title",
    "body",
    "labels",
  ]);
  await tool.execute(
    {
      fingerprintParts: ["auth", "TypeError"],
      title: "Auth handler throws",
      body: "details",
      token: "should-be-ignored",
    },
    {} as never,
  );
  expect(seen).toEqual([
    {
      fingerprintParts: ["auth", "TypeError"],
      title: "Auth handler throws",
      body: "details",
      labels: undefined,
    },
  ]);
});

test("read_data_source lets the model ask for size, never for a position", async () => {
  const seen: unknown[] = [];
  const tool = createReadDataSourceTool(async (input) => {
    seen.push(input);
    return { from: 0, to: 16 };
  });
  expect(Object.keys(tool.parameters.properties ?? {})).toEqual(["maxBytes"]);

  await tool.execute({ maxBytes: 64, from: 999 }, {} as never);
  // `from` is dropped: the runtime owns the watermark, so a model cannot make it
  // skip or reread data by choosing its own offset.
  expect(seen).toEqual([{ maxBytes: 64 }]);

  await expect(tool.execute({ maxBytes: "lots" }, {} as never)).rejects.toThrow(
    "maxBytes must be a number",
  );
});
