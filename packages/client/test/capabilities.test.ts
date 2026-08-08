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
import {
  registerTaskModuleCapability,
  taskModuleCapability,
  TASK_MODULE_CAPABILITY_ID,
} from "../src/capabilities/task-module-capability";

// The point of extracting these factories is that they can be exercised without
// standing up a runtime. If any of these tests needed a real client, the
// extraction would not have bought anything.

test("built-in capability records are stable data", () => {
  const records = builtinCapabilities();
  expect(records.map((record) => record.id)).toEqual([
    "natalia-terminal",
    "natalia-sandbox",
    "natalia-checkpoint",
    "natalia-mcp",
  ]);
  // Every record must declare a scope and at least one grant, otherwise the
  // catalogue entry says nothing about what the subsystem is allowed to do.
  for (const record of records) {
    expect(record.scope).toBeString();
    expect(record.grants.length).toBeGreaterThan(0);
  }
});

test("registration emits one durable event per capability that loaded", () => {
  // Against the real registry, not a stand-in: a fake that accepts everything
  // would not notice if the kernel started refusing these records.
  const registry = new CapabilityRegistry();
  const outcome = registerBuiltinCapabilities(registry);
  expect(outcome.failed).toEqual([]);
  expect(outcome.loaded).toHaveLength(4);
  expect(outcome.loaded[0]).toMatchObject({
    type: "capability.loaded",
    id: "cap:natalia-terminal",
    apiVersion: 1,
    scope: "session",
  });
  expect(registry.list().map((record) => record.id)).toEqual(
    builtinCapabilities().map((record) => record.id),
  );
});

test("a capability that fails to load is reported with a reason", () => {
  // The journal must never claim a capability is present when loading refused
  // it, and "absent for no stated reason" is just as bad.
  const registry = new CapabilityRegistry();
  registry.load({
    id: "natalia-sandbox",
    name: "Squatter",
    version: "0.0.1",
    scope: "workspace",
    grants: [],
  });
  const outcome = registerBuiltinCapabilities(registry);
  expect(outcome.loaded.map((event) => event.id)).toEqual([
    "cap:natalia-terminal",
    "cap:natalia-checkpoint",
    "cap:natalia-mcp",
  ]);
  expect(outcome.failed).toHaveLength(1);
  expect(outcome.failed[0]).toMatchObject({ id: "cap:natalia-sandbox" });
  expect(outcome.failed[0]!.reason).toContain("already loaded");
});

test("the task module capability owns its tools through the kernel", () => {
  const registry = new CapabilityRegistry();
  const result = registerTaskModuleCapability(
    registry,
    moduleContext({
      reportIssue: async () => ({}),
      readDataSource: async () => ({}),
    }),
  );
  expect(result.ok).toBe(true);

  // The runtime never names these tools; it reads whatever the kernel accepted.
  const contributed = registry
    .contributions<{ name: string }>("tools")
    .map((entry) => entry.name);
  expect(contributed).toEqual([
    "flow_module_complete",
    "report_issue",
    "read_data_source",
  ]);
  expect(registry.ownerOf("tools", "report_issue")).toBe(
    TASK_MODULE_CAPABILITY_ID,
  );

  // Unloading releases them, which is the property the runtime depends on when a
  // session ends.
  expect(registry.unloadScope("session")).toEqual([TASK_MODULE_CAPABILITY_ID]);
  expect(registry.contributions("tools")).toEqual([]);
});

test("the task module capability may only contribute tools", () => {
  // It declares the "tools" grant alone, so the kernel is what stops it from
  // quietly acquiring a command or a settings surface later.
  expect(taskModuleCapability().grants).toEqual(["tools"]);
  const registry = new CapabilityRegistry();
  const result = registry.tryLoad(taskModuleCapability(), (capability) => {
    capability.contribute("commands", "/sneaky", () => {});
  });
  expect(result.ok).toBe(false);
  if (!result.ok)
    expect(result.reason).toContain('without the "commands" grant');
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
