import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "bun:test";
import { createToolRegistry } from "@natalia/tools";
import {
  JsonlWorkflowStore,
  WorkflowRuntime,
  parseWorkflowJSON,
  parseWorkflowYAML,
  evaluateCondition,
  interpolate,
} from "../src";
import type { WorkflowDocument, WorkflowStep } from "../src";

// ── Helpers ─────────────────────────────────────────────────────────────────

async function makeRuntime() {
  const root = await mkdtemp(join(tmpdir(), "natalia-workflow-"));
  const store = new JsonlWorkflowStore(join(root, "runs"));
  const runtime = new WorkflowRuntime(createToolRegistry(), store);
  return { root, store, runtime };
}

// ── Original test (backward compat) ─────────────────────────────────────────

test("native workflow persists steps and resumes completed work", async () => {
  const { root, store, runtime } = await makeRuntime();
  const document: WorkflowDocument = {
    version: 1,
    name: "write-example",
    steps: [
      { id: "set", kind: "set", key: "branch", value: "main" },
      {
        id: "write",
        kind: "tool",
        tool: "write_file",
        arguments: { path: "out.txt", content: "workflow-ok" },
      },
    ],
  };
  const run = await runtime.run(document, { workspaceRoot: root }, "wf_test");
  expect(run.status).toBe("completed");
  expect(await readFile(join(root, "out.txt"), "utf8")).toBe("workflow-ok");
  const resumed = await runtime.run(
    document,
    { workspaceRoot: root },
    "wf_test",
  );
  expect(resumed.completedStepIDs).toEqual(["set", "write"]);
  expect(
    (await store.events("wf_test")).filter(
      (event) => event.type === "step_completed",
    ),
  ).toHaveLength(2);
});

test("native workflow executes script steps with sanitized environment", async () => {
  const { root, runtime } = await makeRuntime();
  const saved = process.env.NATALIA_SECRET_TOKEN;
  process.env.NATALIA_SECRET_TOKEN = "must-not-leak";
  try {
    const document: WorkflowDocument = {
      version: 1,
      name: "script-example",
      steps: [
        {
          id: "script",
          kind: "script",
          command: "env > env.txt; printf script-ok > out.txt",
          timeoutMs: 10000,
        },
      ],
    };
    const run = await runtime.run(document, { workspaceRoot: root });
    expect(run.status).toBe("completed");
    expect(await readFile(join(root, "out.txt"), "utf8")).toBe("script-ok");
    expect(await readFile(join(root, "env.txt"), "utf8")).not.toContain(
      "must-not-leak",
    );
  } finally {
    if (saved === undefined) delete process.env.NATALIA_SECRET_TOKEN;
    else process.env.NATALIA_SECRET_TOKEN = saved;
  }
});

test("workflow authorization blocks script and nested tool steps", async () => {
  const { root, store } = await makeRuntime();
  const checked: string[] = [];
  const runtime = new WorkflowRuntime(createToolRegistry(), store);
  const run = await runtime.run(
    {
      version: 1,
      name: "authorization",
      steps: [
        {
          id: "script",
          kind: "script",
          command: "printf blocked > blocked.txt",
        },
        {
          id: "write",
          kind: "tool",
          tool: "write_file",
          arguments: { path: "blocked.txt", content: "blocked" },
        },
      ],
    },
    {
      workspaceRoot: root,
      authorize: async (request) => {
        checked.push(
          request.kind === "script" ? "run_shell" : request.toolName,
        );
        throw new Error("blocked by workflow policy");
      },
    },
  );
  expect(run.status).toBe("failed");
  expect(checked).toEqual(["run_shell"]);
  await expect(
    readFile(join(root, "blocked.txt"), "utf8"),
  ).rejects.toMatchObject({
    code: "ENOENT",
  });
});

test("workflow authorization covers nested tool steps", async () => {
  const { root, store } = await makeRuntime();
  const checked: string[] = [];
  const runtime = new WorkflowRuntime(createToolRegistry(), store);
  const run = await runtime.run(
    {
      version: 1,
      name: "nested-authorization",
      steps: [
        {
          id: "retry",
          kind: "retry",
          maxAttempts: 1,
          step: {
            id: "write",
            kind: "tool",
            tool: "write_file",
            arguments: { path: "blocked.txt", content: "blocked" },
          },
        },
      ],
    },
    {
      workspaceRoot: root,
      authorize: async (request) => {
        if (request.kind === "tool") checked.push(request.toolName);
        throw new Error("blocked by workflow policy");
      },
    },
  );
  expect(run.status).toBe("failed");
  expect(checked).toEqual(["write_file"]);
  await expect(
    readFile(join(root, "blocked.txt"), "utf8"),
  ).rejects.toMatchObject({
    code: "ENOENT",
  });
});

// ── Branch / switch ─────────────────────────────────────────────────────────

test("branch matches first condition", async () => {
  const { root, runtime } = await makeRuntime();
  const doc: WorkflowDocument = {
    version: 1,
    name: "branch-test",
    steps: [
      { id: "s1", kind: "set", key: "env", value: "staging" },
      {
        id: "branch1",
        kind: "branch",
        branches: [
          {
            condition: 'values.env == "prod"',
            steps: [
              { id: "write-prod", kind: "set", key: "result", value: "prod" },
            ],
          },
          {
            condition: 'values.env == "staging"',
            steps: [
              {
                id: "write-staging",
                kind: "set",
                key: "result",
                value: "staging",
              },
            ],
          },
          {
            steps: [
              {
                id: "write-default",
                kind: "set",
                key: "result",
                value: "default",
              },
            ],
          },
        ],
      },
    ],
  };
  const run = await runtime.run(doc, { workspaceRoot: root });
  expect(run.status).toBe("completed");
  expect(run.values["result"]).toBe("staging");
});

test("branch falls through to default", async () => {
  const { root, runtime } = await makeRuntime();
  const doc: WorkflowDocument = {
    version: 1,
    name: "branch-default",
    steps: [
      { id: "s1", kind: "set", key: "env", value: "dev" },
      {
        id: "b1",
        kind: "branch",
        branches: [
          {
            condition: 'values.env == "prod"',
            steps: [{ id: "bp", kind: "set", key: "result", value: "prod" }],
          },
          {
            steps: [{ id: "bd", kind: "set", key: "result", value: "default" }],
          },
        ],
      },
    ],
  };
  const run = await runtime.run(doc, { workspaceRoot: root });
  expect(run.status).toBe("completed");
  expect(run.values["result"]).toBe("default");
});

test("branch no match (no default)", async () => {
  const { root, runtime } = await makeRuntime();
  const doc: WorkflowDocument = {
    version: 1,
    name: "branch-nomatch",
    steps: [
      { id: "s1", kind: "set", key: "env", value: "dev" },
      {
        id: "b1",
        kind: "branch",
        branches: [
          {
            condition: 'values.env == "prod"',
            steps: [{ id: "bp", kind: "set", key: "result", value: "prod" }],
          },
        ],
      },
    ],
  };
  const run = await runtime.run(doc, { workspaceRoot: root });
  expect(run.status).toBe("completed");
  expect(run.values["result"]).toBeUndefined();
});

// ── Retry ───────────────────────────────────────────────────────────────────

test("retry succeeds on first attempt", async () => {
  const { root, runtime } = await makeRuntime();
  const doc: WorkflowDocument = {
    version: 1,
    name: "retry-ok",
    steps: [
      { id: "s1", kind: "set", key: "x", value: "hello" },
      {
        id: "retry1",
        kind: "retry",
        maxAttempts: 3,
        step: { id: "inner-set", kind: "set", key: "y", value: "world" },
      },
    ],
  };
  const run = await runtime.run(doc, { workspaceRoot: root });
  expect(run.status).toBe("completed");
  expect(run.values["y"]).toBe("world");
});

test("retry fails after exhausting attempts", async () => {
  const { root, runtime } = await makeRuntime();
  let attempts = 0;
  const registry = createToolRegistry();
  registry.set("failing", {
    name: "failing",
    description: "always fails",
    requiresApproval: false,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute() {
      attempts++;
      await Bun.sleep(5);
      throw new Error(`fail attempt ${attempts}`);
    },
  });

  const doc: WorkflowDocument = {
    version: 1,
    name: "retry-fail",
    steps: [
      {
        id: "retry1",
        kind: "retry",
        maxAttempts: 2,
        step: { id: "tool-fail", kind: "tool", tool: "failing", arguments: {} },
      },
    ],
  };
  const store = new JsonlWorkflowStore(join(root, "runs"));
  const rt = new WorkflowRuntime(registry, store);
  const run = await rt.run(doc, { workspaceRoot: root });
  expect(run.status).toBe("failed");
  expect(attempts).toBe(2);
});

// ── Timeout ─────────────────────────────────────────────────────────────────

test("timeout step completes before expiry", async () => {
  const { root, runtime } = await makeRuntime();
  const doc: WorkflowDocument = {
    version: 1,
    name: "timeout-fast",
    steps: [
      {
        id: "t1",
        kind: "timeout",
        ms: 5000,
        step: { id: "inner", kind: "set", key: "a", value: "ok" },
      },
    ],
  };
  const run = await runtime.run(doc, { workspaceRoot: root });
  expect(run.status).toBe("completed");
  expect(run.values["a"]).toBe("ok");
});

test("timeout step fails on expiry", async () => {
  const { root } = await makeRuntime();
  const registry = createToolRegistry();
  registry.set("slow", {
    name: "slow",
    description: "slow tool",
    requiresApproval: false,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute() {
      await Bun.sleep(5000);
      return "done";
    },
  });

  const doc: WorkflowDocument = {
    version: 1,
    name: "timeout-slow",
    steps: [
      {
        id: "t1",
        kind: "timeout",
        ms: 10,
        step: { id: "slow-tool", kind: "tool", tool: "slow", arguments: {} },
      },
    ],
  };
  const store = new JsonlWorkflowStore(join(root, "runs"));
  const rt = new WorkflowRuntime(registry, store);
  const run = await rt.run(doc, { workspaceRoot: root });
  expect(run.status).toBe("failed");
  expect(
    run.events.some((e) => e.type === "step_failed" && e.stepID === "t1"),
  ).toBe(true);
});

test("timeout propagates abort to a cooperative tool", async () => {
  const { root } = await makeRuntime();
  const registry = createToolRegistry();
  let aborted = false;
  registry.set("cooperative", {
    name: "cooperative",
    description: "cooperative tool",
    requiresApproval: false,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_input, context) {
      await new Promise<void>((resolve) =>
        context.signal?.addEventListener(
          "abort",
          () => {
            aborted = true;
            resolve();
          },
          { once: true },
        ),
      );
      throw context.signal?.reason ?? new Error("expected abort");
    },
  });
  const runtime = new WorkflowRuntime(
    registry,
    new JsonlWorkflowStore(join(root, "runs")),
  );
  const run = await runtime.run(
    {
      version: 1,
      name: "timeout-abort",
      steps: [
        {
          id: "timeout",
          kind: "timeout",
          ms: 10,
          step: {
            id: "cooperative",
            kind: "tool",
            tool: "cooperative",
            arguments: {},
          },
        },
      ],
    },
    { workspaceRoot: root },
  );
  expect(run.status).toBe("failed");
  expect(aborted).toBe(true);
});

// ── Parallel ────────────────────────────────────────────────────────────────

test("parallel runs branches concurrently", async () => {
  const { root, runtime, store } = await makeRuntime();
  const doc: WorkflowDocument = {
    version: 1,
    name: "parallel-test",
    steps: [
      {
        id: "p1",
        kind: "parallel",
        branches: [
          {
            id: "b1",
            steps: [{ id: "set-a", kind: "set", key: "a", value: "1" }],
          },
          {
            id: "b2",
            steps: [{ id: "set-b", kind: "set", key: "b", value: "2" }],
          },
        ],
      },
    ],
  };
  const run = await runtime.run(doc, { workspaceRoot: root });
  expect(run.status).toBe("completed");
  expect(run.values["a"]).toBe("1");
  expect(run.values["b"]).toBe("2");
  expect(
    (await store.events(run.id)).every((event) => event.runID === run.id),
  ).toBe(true);
});

test("parallel branch resume skips completed", async () => {
  const { root, store, runtime } = await makeRuntime();
  const doc: WorkflowDocument = {
    version: 1,
    name: "parallel-resume",
    steps: [
      { id: "p1-init", kind: "set", key: "init", value: "ok" },
      {
        id: "p1",
        kind: "parallel",
        branches: [
          {
            id: "bx",
            steps: [{ id: "set-x", kind: "set", key: "x", value: "10" }],
          },
          {
            id: "by",
            steps: [{ id: "set-y", kind: "set", key: "y", value: "20" }],
          },
        ],
      },
    ],
  };

  // First run
  let run = await runtime.run(
    doc,
    { workspaceRoot: root },
    "wf_parallel_resume_test",
  );
  expect(run.status).toBe("completed");
  expect(run.values["x"]).toBe("10");
  expect(run.values["y"]).toBe("20");
  const completedCount = run.events.filter(
    (e) => e.type === "step_completed",
  ).length;

  // Resume - should skip all completed steps
  run = await runtime.run(
    doc,
    { workspaceRoot: root },
    "wf_parallel_resume_test",
  );
  expect(run.status).toBe("completed");
  expect(run.completedStepIDs).toContain("p1-init");
  expect(run.completedStepIDs).toContain("set-x");
  expect(run.completedStepIDs).toContain("set-y");
  const resumedCompletedCount = run.events.filter(
    (e) => e.type === "step_completed",
  ).length;
  // Should not have duplicated step_completed events
  expect(resumedCompletedCount).toBe(completedCount);
});

// ── Each ────────────────────────────────────────────────────────────────────

test("each iterates over comma-separated values", async () => {
  const { root, runtime } = await makeRuntime();
  const doc: WorkflowDocument = {
    version: 1,
    name: "each-test",
    steps: [
      { id: "e-init", kind: "set", key: "items", value: "a,b,c" },
      {
        id: "e1",
        kind: "each",
        over: "items",
        as: "item",
        steps: [{ id: "inner-set", kind: "set", key: "last", value: "set" }],
      },
    ],
  };
  const run = await runtime.run(doc, { workspaceRoot: root });
  expect(run.status).toBe("completed");
  expect(run.values["last"]).toBe("set");
  // items should be cleared after each
  expect(run.values["item"]).toBeUndefined();
});

test("each with JSON array value", async () => {
  const { root, runtime } = await makeRuntime();
  const doc: WorkflowDocument = {
    version: 1,
    name: "each-json",
    steps: [
      {
        id: "e-init",
        kind: "set",
        key: "items",
        value: JSON.stringify(["x", "y"]),
      },
      {
        id: "e1",
        kind: "each",
        over: "items",
        as: "item",
        steps: [{ id: "log-item", kind: "set", key: "last", value: "set" }],
      },
    ],
  };
  const run = await runtime.run(doc, { workspaceRoot: root });
  expect(run.status).toBe("completed");
});

// ── JSON Parser ─────────────────────────────────────────────────────────────

test("parseWorkflowJSON valid document", () => {
  const doc = parseWorkflowJSON(`{
    "version": 1,
    "name": "test",
    "steps": [{ "id": "s1", "kind": "set", "key": "a", "value": "b" }]
  }`);
  expect(doc.name).toBe("test");
  expect(doc.steps).toHaveLength(1);
});

test("parseWorkflowJSON rejects invalid version", () => {
  expect(() =>
    parseWorkflowJSON(`{ "version": 2, "name": "x", "steps": [] }`),
  ).toThrow("expected version");
});

test("parseWorkflowJSON rejects missing name", () => {
  expect(() => parseWorkflowJSON(`{ "version": 1, "steps": [] }`)).toThrow(
    "name",
  );
});

// ── YAML Parser ─────────────────────────────────────────────────────────────

test("parseWorkflowYAML basic document", () => {
  const yaml = `
version: 1
name: test-yaml
steps:
  - id: s1
    kind: set
    key: a
    value: hello
  - id: s2
    kind: tool
    tool: write_file
    arguments:
      path: out.txt
      content: '{{a}}'
  - id: s3
    kind: wait
    ms: 100
`;
  const doc = parseWorkflowYAML(yaml);
  expect(doc.name).toBe("test-yaml");
  expect(doc.steps).toHaveLength(3);
  const setStep = doc.steps[0]!;
  expect(setStep).toEqual({ id: "s1", kind: "set", key: "a", value: "hello" });
});

test("parseWorkflowYAML branch with conditions", () => {
  const yaml = `
version: 1
name: branch-yaml
steps:
  - id: br1
    kind: branch
    branches:
      - condition: 'values.env == "prod"'
        steps:
          - id: bp
            kind: set
            key: result
            value: prod
      - steps:
          - id: bd
            kind: set
            key: result
            value: default
`;
  const doc = parseWorkflowYAML(yaml);
  expect(doc.name).toBe("branch-yaml");
  expect(doc.steps).toHaveLength(1);
  const br = doc.steps[0]!;
  expect(br.kind).toBe("branch");
  if (br.kind === "branch") {
    expect(br.branches).toHaveLength(2);
    expect(br.branches[0]!.condition).toBe('values.env == "prod"');
    expect(br.branches[1]!.condition).toBeUndefined();
  }
});

test("parseWorkflowYAML retry and timeout", () => {
  const yaml = `
version: 1
name: retry-yaml
steps:
  - id: r1
    kind: retry
    maxAttempts: 3
    step:
      id: inner-tool
      kind: tool
      tool: run_shell
      arguments:
        command: echo hello
  - id: t1
    kind: timeout
    ms: 5000
    step:
      id: inner-wait
      kind: wait
      ms: 100
`;
  const doc = parseWorkflowYAML(yaml);
  expect(doc.steps).toHaveLength(2);
  expect(doc.steps[0]!.kind).toBe("retry");
  if (doc.steps[0]!.kind === "retry") {
    expect(doc.steps[0]!.maxAttempts).toBe(3);
    expect(doc.steps[0]!.step.kind).toBe("tool");
  }
});

test("parseWorkflowYAML parallel", () => {
  const yaml = `
version: 1
name: parallel-yaml
steps:
  - id: p1
    kind: parallel
    branches:
      - id: b1
        steps:
          - id: pa
            kind: set
            key: a
            value: "1"
      - id: b2
        steps:
          - id: pb
            kind: set
            key: b
            value: "2"
`;
  const doc = parseWorkflowYAML(yaml);
  expect(doc.steps[0]!.kind).toBe("parallel");
  if (doc.steps[0]!.kind === "parallel") {
    expect(doc.steps[0]!.branches).toHaveLength(2);
  }
});

test("parseWorkflowYAML each", () => {
  const yaml = `
version: 1
name: each-yaml
steps:
  - id: e1
    kind: each
    over: items
    as: item
    steps:
      - id: ei
        kind: set
        key: last
        value: ok
`;
  const doc = parseWorkflowYAML(yaml);
  expect(doc.steps[0]!.kind).toBe("each");
});

test("parseWorkflowYAML quoted strings and scalars", () => {
  const yaml = `
version: 1
name: "quoted-name"
steps:
  - id: s1
    kind: set
    key: a
    value: 'single quoted'
  - id: s2
    kind: set
    key: b
    value: "double quoted"
`;
  const doc = parseWorkflowYAML(yaml);
  expect(doc.name).toBe("quoted-name");
  if (doc.steps[0]!.kind === "set")
    expect(doc.steps[0]!.value).toBe("single quoted");
  if (doc.steps[1]!.kind === "set")
    expect(doc.steps[1]!.value).toBe("double quoted");
});

test("parseWorkflowYAML error on duplicate id", () => {
  const yaml = `
version: 1
name: dup
steps:
  - id: s1
    kind: set
    key: a
    value: x
  - id: s1
    kind: set
    key: b
    value: y
`;
  expect(() => parseWorkflowYAML(yaml)).toThrow("duplicate step ID");
});

test("parseWorkflowYAML rich error on bad indent", () => {
  const yaml = `version: 1
name: bad-indent
steps:
  - id: s1
    kind: set
   key: a
    value: x
`;
  // The malformed key (wrong indent) is picked up by validation after YAML parsing
  expect(() => parseWorkflowYAML(yaml)).toThrow("expected");
});

// ── Condition evaluator ─────────────────────────────────────────────────────

test("evaluateCondition string equality", () => {
  expect(evaluateCondition('values.env == "prod"', { env: "prod" })).toBe(true);
  expect(evaluateCondition('values.env == "prod"', { env: "dev" })).toBe(false);
});

test("evaluateCondition string inequality", () => {
  expect(evaluateCondition('values.x != "a"', { x: "b" })).toBe(true);
  expect(evaluateCondition('values.x != "a"', { x: "a" })).toBe(false);
});

test("evaluateCondition numeric comparison", () => {
  expect(evaluateCondition("values.count > 5", { count: "10" })).toBe(true);
  expect(evaluateCondition("values.count > 5", { count: "3" })).toBe(false);
  expect(evaluateCondition("values.count <= 5", { count: "5" })).toBe(true);
});

test("evaluateCondition boolean logic", () => {
  expect(
    evaluateCondition('values.a == "1" and values.b == "2"', {
      a: "1",
      b: "2",
    }),
  ).toBe(true);
  expect(
    evaluateCondition('values.a == "1" and values.b == "3"', {
      a: "1",
      b: "2",
    }),
  ).toBe(false);
  expect(
    evaluateCondition('values.a == "1" or values.b == "3"', { a: "1", b: "2" }),
  ).toBe(true);
});

test("evaluateCondition parentheses and not", () => {
  expect(evaluateCondition('not values.x == "y"', { x: "z" })).toBe(true);
  expect(
    evaluateCondition(
      'values.x == "1" and (values.y == "2" or values.z == "3")',
      { x: "1", y: "2", z: "4" },
    ),
  ).toBe(true);
  expect(
    evaluateCondition(
      'values.x == "1" and (values.y == "2" or values.z == "3")',
      { x: "1", y: "5", z: "4" },
    ),
  ).toBe(false);
});

// ── Interpolation ───────────────────────────────────────────────────────────

test("interpolate replaces {{key}} placeholders", () => {
  const result = interpolate("Hello {{name}}, path={{path}}", {
    name: "World",
    path: "/tmp",
  });
  expect(result).toBe("Hello World, path=/tmp");
});

test("interpolate throws on missing key", () => {
  expect(() => interpolate("{{missing}}", {})).toThrow("not set");
});

// ── Resume semantics (comprehensive) ────────────────────────────────────────

test("resume skips completed branch inner steps", async () => {
  const { root, store, runtime } = await makeRuntime();
  const doc: WorkflowDocument = {
    version: 1,
    name: "resume-branch",
    steps: [
      { id: "s1", kind: "set", key: "env", value: "test" },
      {
        id: "b1",
        kind: "branch",
        branches: [
          {
            condition: 'values.env == "test"',
            steps: [
              { id: "inner-set", kind: "set", key: "result", value: "matched" },
            ],
          },
        ],
      },
    ],
  };

  const run1 = await runtime.run(
    doc,
    { workspaceRoot: root },
    "wf_resume_branch",
  );
  expect(run1.status).toBe("completed");
  const completed = run1.events.filter(
    (e) => e.type === "step_completed",
  ).length;

  const run2 = await runtime.run(
    doc,
    { workspaceRoot: root },
    "wf_resume_branch",
  );
  expect(run2.status).toBe("completed");
  const resumedCompleted = run2.events.filter(
    (e) => e.type === "step_completed",
  ).length;
  expect(resumedCompleted).toBe(completed);
});

test("resume retry skips completed inner step", async () => {
  const { root, store, runtime } = await makeRuntime();
  const doc: WorkflowDocument = {
    version: 1,
    name: "resume-retry",
    steps: [
      {
        id: "r1",
        kind: "retry",
        maxAttempts: 2,
        step: { id: "inner-step", kind: "set", key: "done", value: "yes" },
      },
    ],
  };

  await runtime.run(doc, { workspaceRoot: root }, "wf_resume_retry");
  const run2 = await runtime.run(
    doc,
    { workspaceRoot: root },
    "wf_resume_retry",
  );
  expect(run2.status).toBe("completed");
  expect(run2.values["done"]).toBe("yes");
});

test("resume each skips completed iterations", async () => {
  const { root, store, runtime } = await makeRuntime();
  const doc: WorkflowDocument = {
    version: 1,
    name: "resume-each",
    steps: [
      { id: "init", kind: "set", key: "items", value: "x,y,z" },
      {
        id: "e1",
        kind: "each",
        over: "items",
        as: "item",
        steps: [{ id: "iter-set", kind: "set", key: "current", value: "set" }],
      },
    ],
  };

  // Run to completion
  await runtime.run(doc, { workspaceRoot: root }, "wf_resume_each");
  const run2 = await runtime.run(
    doc,
    { workspaceRoot: root },
    "wf_resume_each",
  );
  expect(run2.status).toBe("completed");
  expect(run2.completedStepIDs).toContain("init");
  expect(run2.completedStepIDs).toContain("e1/iter-0");
  expect(run2.completedStepIDs).toContain("e1/iter-1");
  expect(run2.completedStepIDs).toContain("e1/iter-2");
});

// ── Value interpolation in tool arguments ───────────────────────────────────

test("tool arguments interpolate values", async () => {
  const { root, runtime } = await makeRuntime();
  const doc: WorkflowDocument = {
    version: 1,
    name: "interpolate-args",
    steps: [
      { id: "init", kind: "set", key: "filename", value: "greeting.txt" },
      {
        id: "write",
        kind: "tool",
        tool: "write_file",
        arguments: { path: "{{filename}}", content: "Hello" },
      },
    ],
  };
  const run = await runtime.run(doc, { workspaceRoot: root });
  expect(run.status).toBe("completed");
  expect(await readFile(join(root, "greeting.txt"), "utf8")).toBe("Hello");
});

// ── Cancellation ────────────────────────────────────────────────────────────

test("cancellation via AbortSignal stops workflow", async () => {
  const { root, runtime } = await makeRuntime();
  const controller = new AbortController();
  const doc: WorkflowDocument = {
    version: 1,
    name: "cancel-test",
    steps: [
      { id: "s1", kind: "set", key: "started", value: "yes" },
      {
        id: "long-wait",
        kind: "tool",
        tool: "run_shell",
        arguments: { command: "sleep 30" },
      },
    ],
  };

  setTimeout(() => controller.abort(), 10);
  const run = await runtime.run(
    doc,
    { workspaceRoot: root, signal: controller.signal },
    "wf_cancel_test",
  );
  expect(run.status).toBe("cancelled");
  expect(run.values["started"]).toBe("yes");
});

// ── Event journal integrity ─────────────────────────────────────────────────

test("no duplicate step_completed events on resume", async () => {
  const { root, store, runtime } = await makeRuntime();
  const doc: WorkflowDocument = {
    version: 1,
    name: "no-dup",
    steps: [
      { id: "a", kind: "set", key: "x", value: "1" },
      { id: "b", kind: "set", key: "y", value: "2" },
    ],
  };

  await runtime.run(doc, { workspaceRoot: root }, "wf_no_dup");
  const events = await store.events("wf_no_dup");
  const completed = events.filter((e) => e.type === "step_completed");
  expect(completed).toHaveLength(2);

  await runtime.run(doc, { workspaceRoot: root }, "wf_no_dup");
  const events2 = await store.events("wf_no_dup");
  const completed2 = events2.filter((e) => e.type === "step_completed");
  expect(completed2).toHaveLength(2);
});

// ── Complete workflow via YAML ──────────────────────────────────────────────

test("full YAML workflow: branch + retry + parallel + each", async () => {
  const { root, runtime } = await makeRuntime();
  const yaml = `
version: 1
name: full-yaml
steps:
  - id: init-env
    kind: set
    key: env
    value: test

  - id: init-items
    kind: set
    key: items
    value: "a,b"

  - id: br
    kind: branch
    branches:
      - condition: 'values.env == "test"'
        steps:
          - id: branch-set
            kind: set
            key: branch_hit
            value: "yes"

  - id: retry-tool
    kind: retry
    maxAttempts: 2
    step:
      id: inner-echo
      kind: tool
      tool: run_shell
      arguments:
        command: "echo 'retry ok'"

  - id: timeout-test
    kind: timeout
    ms: 5000
    step:
      id: inner-quick
      kind: wait
      ms: 1

  - id: par
    kind: parallel
    branches:
      - id: bx
        steps:
          - id: set-px
            kind: set
            key: px
            value: "parallel-x"
      - id: by
        steps:
          - id: set-py
            kind: set
            key: py
            value: "parallel-y"

  - id: each-test
    kind: each
    over: items
    as: item
    steps:
      - id: each-log
        kind: set
        key: last_item
        value: "done"
`;
  const run = await runtime.run(
    parseWorkflowYAML(yaml),
    { workspaceRoot: root },
    "wf_full_yaml_test",
  );
  expect(run.status).toBe("completed");
  expect(run.values["env"]).toBe("test");
  expect(run.values["branch_hit"]).toBe("yes");
  expect(run.values["px"]).toBe("parallel-x");
  expect(run.values["py"]).toBe("parallel-y");
  expect(run.values["last_item"]).toBe("done");
  expect(run.values["item"]).toBeUndefined();
});
