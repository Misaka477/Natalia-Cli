import { expect, test } from "bun:test";
import { CapabilityRegistry } from "@natalia/capability";
import { createPluginRegistry } from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";
import {
  createReadDataSourceTool,
  createReportIssueTool,
  createTaskModulePlugin,
  taskModuleTools,
  TASK_MODULE_PLUGIN_ID,
  type TaskModuleContext,
} from "../src/index";

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

test("the task module plugin owns its tools through the kernel", async () => {
  const kernel = new CapabilityRegistry();
  const registry = createPluginRegistry({
    tools: createToolRegistry([]),
    registerOwner: (manifest, context) => {
      const capabilityID = context.builtin ? manifest.id : `cap:${manifest.id}`;
      return kernel.registerOwner({
        id: capabilityID,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        scope: manifest.scope,
        grants: ["tools"],
      });
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

  expect(
    kernel.contributions<{ name: string }>("tools").map((entry) => entry.name),
  ).toEqual(["flow_module_complete", "report_issue", "read_data_source"]);
  expect(kernel.ownerOf("tools", "report_issue")).toBe(TASK_MODULE_PLUGIN_ID);

  await registry.unload(TASK_MODULE_PLUGIN_ID);
  expect(kernel.contributions("tools")).toEqual([]);
});

test("the task module plugin declares only its session tool surface", () => {
  const plugin = createTaskModulePlugin(moduleContext());
  expect(plugin.manifest.apiVersion).toBe(2);
  if (plugin.manifest.apiVersion === 2)
    expect(plugin.manifest.integrationPoints).toEqual(["tools"]);
  expect(plugin.manifest.scope).toBe("session");
});

test("task module tools follow the supplied controller bindings", () => {
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

test("a completion claim reaches the invocation-scoped store", async () => {
  const claims: unknown[] = [];
  const [complete] = taskModuleTools(
    moduleContext({
      store: {
        claimModule(input: unknown) {
          claims.push(input);
        },
      } as unknown as TaskModuleContext["store"],
    }),
  );
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
  expect(JSON.parse(result).status).toBe("claimed");
});

test("a malformed completion claim is rejected", async () => {
  const [complete] = taskModuleTools(moduleContext());
  const base = {
    flowID: "flow_1",
    moduleID: "read",
    conditionStatuses: [{ id: "condition_1", status: "satisfied" }],
    evidenceRefs: [],
    gaps: [],
    recommendedAction: "continue",
  };

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

test("report_issue never exposes or forwards a credential", async () => {
  const seen: unknown[] = [];
  const tool = createReportIssueTool(async (finding) => {
    seen.push(finding);
    return { status: "created" };
  });
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

test("read_data_source accepts a size but never a position", async () => {
  const seen: unknown[] = [];
  const tool = createReadDataSourceTool(async (input) => {
    seen.push(input);
    return { from: 0, to: 16 };
  });
  expect(Object.keys(tool.parameters.properties ?? {})).toEqual(["maxBytes"]);

  await tool.execute({ maxBytes: 64, from: 999 }, {} as never);
  expect(seen).toEqual([{ maxBytes: 64 }]);
  await expect(tool.execute({ maxBytes: "lots" }, {} as never)).rejects.toThrow(
    "maxBytes must be a number",
  );
});
