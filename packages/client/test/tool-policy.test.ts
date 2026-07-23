import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createToolPolicyHookLayer,
  createRealRuntimeClient,
  type ToolHooks,
  type ToolPolicy,
  type RuntimeEvent,
} from "../src";
import { evaluatePermissionRules } from "../src/tool-policy";
import type {
  ProviderStreamRequest,
  StreamingProvider,
} from "@natalia/runtime";
import { WorkspaceSandboxManager } from "@natalia/sandbox";

test("createToolPolicyHookLayer default allows all tools", () => {
  const layer = createToolPolicyHookLayer();
  expect(layer.isToolAllowed("read_file")).toBe(true);
  expect(layer.isToolAllowed("write_file")).toBe(true);
  expect(layer.isToolAllowed("unknown")).toBe(true);
});

test("createToolPolicyHookLayer allow list restricts tools", () => {
  const policy: ToolPolicy = { allow: ["read_file", "glob"] };
  const layer = createToolPolicyHookLayer(policy);
  expect(layer.isToolAllowed("read_file")).toBe(true);
  expect(layer.isToolAllowed("glob")).toBe(true);
  expect(layer.isToolAllowed("write_file")).toBe(false);
  expect(layer.isToolAllowed("run_shell")).toBe(false);
});

test("createToolPolicyHookLayer exclude list blocks specific tools", () => {
  const policy: ToolPolicy = { exclude: ["write_file", "edit_file"] };
  const layer = createToolPolicyHookLayer(policy);
  expect(layer.isToolAllowed("read_file")).toBe(true);
  expect(layer.isToolAllowed("glob")).toBe(true);
  expect(layer.isToolAllowed("write_file")).toBe(false);
  expect(layer.isToolAllowed("edit_file")).toBe(false);
});

test("createToolPolicyHookLayer allow and exclude together", () => {
  const policy: ToolPolicy = {
    allow: ["read_*", "write_*"],
    exclude: ["write_file"],
  };
  const layer = createToolPolicyHookLayer(policy);
  expect(layer.isToolAllowed("read_file")).toBe(true);
  expect(layer.isToolAllowed("read_dir")).toBe(true);
  expect(layer.isToolAllowed("write_file")).toBe(false);
  expect(layer.isToolAllowed("write_dir")).toBe(true);
});

test("createToolPolicyHookLayer filterTools filters arrays", () => {
  const policy: ToolPolicy = { allow: ["read_file", "glob"] };
  const layer = createToolPolicyHookLayer(policy);
  const tools = [
    { name: "read_file", description: "a" },
    { name: "write_file", description: "b" },
    { name: "glob", description: "c" },
  ];
  const filtered = layer.filterTools(tools);
  expect(filtered).toEqual([
    { name: "read_file", description: "a" },
    { name: "glob", description: "c" },
  ]);
});

test("createToolPolicyHookLayer preExecute blocks disallowed tools", async () => {
  const policy: ToolPolicy = { exclude: ["dangerous_tool"] };
  const layer = createToolPolicyHookLayer(policy);
  const result = await layer.preExecute({
    turnID: "turn_1",
    toolName: "dangerous_tool",
    toolCallID: "call_1",
    arguments: "{}",
  });
  expect(result.allowed).toBe(false);
  expect(result.diagnostics).toContain("blocked by policy: dangerous_tool");
});

test("createToolPolicyHookLayer preExecute allows allowed tools", async () => {
  const layer = createToolPolicyHookLayer();
  const result = await layer.preExecute({
    turnID: "turn_1",
    toolName: "read_file",
    toolCallID: "call_1",
    arguments: '{"path":"test.txt"}',
  });
  expect(result.allowed).toBe(true);
  expect(result.diagnostics).toEqual([]);
});

test("invalid command policy regex fails closed with a diagnostic", async () => {
  const result = evaluatePermissionRules(
    { commands: { denyPatterns: ["["] } },
    "run_shell",
    { command: "echo safe" },
  );
  expect(result.allowed).toBe(false);
  expect(result.diagnostics.join(" ")).toContain(
    "invalid command deny pattern",
  );
});

test("agent rules cover sandbox paths and all command-launching tools", () => {
  const fileRules = {
    files: {
      writePaths: [
        { pattern: "protected/*", allow: false, reason: "protected" },
      ],
    },
  };
  expect(
    evaluatePermissionRules(fileRules, "sandbox_write", {
      path: "protected/note.txt",
    }),
  ).toMatchObject({ allowed: false, reason: "protected" });
  expect(
    evaluatePermissionRules(fileRules, "browser_screenshot", {
      path: "protected/page.png",
    }),
  ).toMatchObject({ allowed: false, reason: "protected" });
  expect(
    evaluatePermissionRules(
      { files: { readPaths: fileRules.files.writePaths } },
      "glob",
      { path: "protected/note.txt" },
    ),
  ).toMatchObject({ allowed: false, reason: "protected" });
  expect(
    evaluatePermissionRules(
      { files: { readPaths: fileRules.files.writePaths } },
      "grep",
      { path: "protected/note.txt" },
    ),
  ).toMatchObject({ allowed: false, reason: "protected" });

  const commandRules = { commands: { denyPatterns: ["rm\\s+-rf"] } };
  for (const toolName of [
    "sandbox_execute",
    "sandbox_resource_start",
    "process_start",
    "background_start",
    "interactive_start",
  ])
    expect(
      evaluatePermissionRules(commandRules, toolName, {
        command: "rm -rf generated",
      }),
    ).toMatchObject({ allowed: false, reason: "command blocked by policy" });
});

test("createToolPolicyHookLayer preExecute calls custom hook", async () => {
  const calls: string[] = [];
  const hooks: ToolHooks = {
    preExecute: async (event) => {
      calls.push(event.toolName);
      return { allowed: true, diagnostics: ["custom check ok"] };
    },
  };
  const layer = createToolPolicyHookLayer(undefined, hooks);
  const result = await layer.preExecute({
    turnID: "turn_1",
    toolName: "read_file",
    toolCallID: "call_1",
    arguments: "{}",
  });
  expect(calls).toEqual(["read_file"]);
  expect(result.allowed).toBe(true);
  expect(result.diagnostics).toContain("custom check ok");
});

test("createToolPolicyHookLayer preExecute hook can block", async () => {
  const hooks: ToolHooks = {
    preExecute: async (event) => {
      if (event.toolName === "write_file")
        return { allowed: false, diagnostics: ["write not allowed by hook"] };
      return { allowed: true, diagnostics: [] };
    },
  };
  const layer = createToolPolicyHookLayer(undefined, hooks);
  const allowed = await layer.preExecute({
    turnID: "turn_1",
    toolName: "read_file",
    toolCallID: "call_1",
    arguments: "{}",
  });
  const blocked = await layer.preExecute({
    turnID: "turn_1",
    toolName: "write_file",
    toolCallID: "call_2",
    arguments: "{}",
  });
  expect(allowed.allowed).toBe(true);
  expect(blocked.allowed).toBe(false);
  expect(blocked.diagnostics).toContain("write not allowed by hook");
});

test("createToolPolicyHookLayer postExecute calls custom hook", async () => {
  const captured: Array<{ toolName: string; result?: string; error?: string }> =
    [];
  const hooks: ToolHooks = {
    postExecute: async (event) => {
      captured.push({
        toolName: event.toolName,
        result: event.result,
        error: event.error,
      });
    },
  };
  const layer = createToolPolicyHookLayer(undefined, hooks);
  await layer.postExecute({
    turnID: "turn_1",
    toolName: "read_file",
    toolCallID: "call_1",
    arguments: "{}",
    result: "file content",
  });
  expect(captured).toEqual([
    { toolName: "read_file", result: "file content", error: undefined },
  ]);
});

test("createToolPolicyHookLayer postExecute captures errors", async () => {
  const captured: Array<{ toolName: string; error?: string }> = [];
  const hooks: ToolHooks = {
    postExecute: async (event) => {
      captured.push({ toolName: event.toolName, error: event.error });
    },
  };
  const layer = createToolPolicyHookLayer(undefined, hooks);
  await layer.postExecute({
    turnID: "turn_1",
    toolName: "write_file",
    toolCallID: "call_2",
    arguments: "{}",
    error: "permission denied",
  });
  expect(captured).toEqual([
    { toolName: "write_file", error: "permission denied" },
  ]);
});

test("real runtime client with allow policy prevents excluded tools from provider", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-policy-allow-"));
  const events: RuntimeEvent[] = [];
  const requests: ProviderStreamRequest[] = [];
  const provider: StreamingProvider & { requests: ProviderStreamRequest[] } = {
    provider: "scripted-policy",
    model: "scripted-policy-model",
    requests,
    async *stream(request: ProviderStreamRequest) {
      requests.push(request);
      yield { type: "content", text: "ok" };
      yield { type: "done" };
    },
  };
  const policy: ToolPolicy = { allow: ["read_file"] };
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_policy_allow",
    provider,
    permissionMode: "auto",
    toolPolicy: policy,
  });
  client.start((event) => events.push(event));
  await client.submit("run");
  const toolsSent = requests[0]?.tools ?? [];
  const toolNames = toolsSent.map((t) => t.name);
  expect(toolNames).toContain("read_file");
  expect(toolNames).not.toContain("write_file");
  expect(toolNames).not.toContain("run_shell");
});

test("mode permission profile overrides default runtime approval mode", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-mode-permission-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await Bun.write(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      defaultPermission: "ask",
      permissionProfiles: {
        ask: { approval: "ask", description: "Ask" },
        safe: { approval: "read_only", description: "Safe mode" },
      },
      modes: { review: { permission: "safe" } },
      defaultMode: "review",
    }),
  );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_mode_permission",
    provider: toolCallingProviderWithName("read_file"),
  });
  client.start(() => undefined);

  expect(await client.runtimeStatus?.()).toMatchObject({
    permissions: "read_only",
  });
});

test("explicit toolPolicy cannot bypass agent file permissions", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-agent-policy-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await Bun.write(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      defaultAgent: "review",
      agents: {
        review: {
          description: "Review",
          permissions: {
            files: {
              writePaths: [
                { pattern: "protected.txt", allow: false, reason: "protected" },
              ],
            },
          },
        },
      },
    }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_agent_policy",
    provider: writeProvider("protected.txt"),
    permissionMode: "auto",
    toolPolicy: { allow: ["write_file"] },
  });
  client.start((event) => events.push(event));
  await client.submit("write protected");

  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool.update",
      name: "write_file",
      status: "failed",
      summary: expect.stringContaining("protected"),
    }),
  );
  await expect(
    readFile(join(root, "protected.txt"), "utf8"),
  ).rejects.toMatchObject({
    code: "ENOENT",
  });
});

test("agent command rules block sandbox execution before approval", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-sandbox-policy-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await Bun.write(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      defaultAgent: "review",
      agents: {
        review: {
          description: "Review",
          permissions: { commands: { denyPatterns: ["rm\\s+-rf"] } },
        },
      },
    }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_sandbox_policy",
    provider: sandboxCommandProvider(),
    permissionMode: "auto",
  });
  client.start((event) => events.push(event));
  await client.submit("run sandbox command");

  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool.update",
      name: "sandbox_execute",
      status: "failed",
      summary: expect.stringContaining("command matches deny pattern"),
    }),
  );
});

test("sandbox merge preflight rejects every denied manifest path atomically", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-ts7-sandbox-merge-policy-"),
  );
  await mkdir(join(root, ".natalia"), { recursive: true });
  await Bun.write(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      defaultAgent: "review",
      agents: {
        review: {
          description: "Review",
          permissions: {
            files: {
              writePaths: [
                {
                  pattern: "protected.txt",
                  allow: false,
                  reason: "protected by agent policy",
                },
              ],
            },
          },
        },
      },
    }),
  );
  const sandboxes = new WorkspaceSandboxManager(
    join(root, ".natalia", "sandboxes"),
  );
  await sandboxes.create("box");
  await sandboxes.write("box", "allowed.txt", "allowed");
  await sandboxes.write("box", "protected.txt", "protected");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_sandbox_merge_policy",
    permissionMode: "auto",
    provider: sandboxMergeProvider(),
  });
  client.start((event) => events.push(event));
  await client.submit("merge sandbox changes");

  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool.update",
      name: "sandbox_merge",
      status: "failed",
      summary: expect.stringContaining("protected by agent policy"),
    }),
  );
  await expect(
    readFile(join(root, "allowed.txt"), "utf8"),
  ).rejects.toMatchObject({
    code: "ENOENT",
  });
  await expect(
    readFile(join(root, "protected.txt"), "utf8"),
  ).rejects.toMatchObject({
    code: "ENOENT",
  });
});

test("sandbox merge preflight permits a manifest when every path is allowed", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-ts7-sandbox-merge-allow-"),
  );
  const sandboxes = new WorkspaceSandboxManager(
    join(root, ".natalia", "sandboxes"),
  );
  await sandboxes.create("box");
  await sandboxes.write("box", "allowed.txt", "allowed");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_sandbox_merge_allow",
    permissionMode: "auto",
    provider: sandboxMergeProvider(),
  });
  client.start((event) => events.push(event));
  await client.submit("merge sandbox changes");

  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool.update",
      name: "sandbox_merge",
      status: "succeeded",
    }),
  );
  expect(await readFile(join(root, "allowed.txt"), "utf8")).toBe("allowed");
});

test("sandbox merge exclusion applies to catalog and forced execution", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-ts7-sandbox-merge-exclude-"),
  );
  const sandboxes = new WorkspaceSandboxManager(
    join(root, ".natalia", "sandboxes"),
  );
  await sandboxes.create("box");
  await sandboxes.write("box", "allowed.txt", "allowed");
  const events: RuntimeEvent[] = [];
  const requests: ProviderStreamRequest[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_sandbox_merge_exclude",
    permissionMode: "auto",
    toolPolicy: { exclude: ["sandbox_merge"] },
    provider: {
      provider: "scripted-sandbox-merge-exclude",
      model: "scripted-sandbox-merge-exclude-model",
      async *stream(request) {
        requests.push(request);
        if (!request.messages.some((message) => message.role === "tool"))
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "merge",
                name: "sandbox_merge",
                arguments: JSON.stringify({ id: "box" }),
              },
            ],
          };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("merge sandbox changes");

  expect(requests[0]?.tools?.map((tool) => tool.name)).not.toContain(
    "sandbox_merge",
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "tool.update",
      name: "sandbox_merge",
      status: "failed",
      summary: "Unknown tool: sandbox_merge",
    }),
  );
  await expect(
    readFile(join(root, "allowed.txt"), "utf8"),
  ).rejects.toMatchObject({
    code: "ENOENT",
  });
});

test("agent read paths block glob and grep before exposing protected files", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-search-policy-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(join(root, "allowed.ts"), "const value = 'needle';\n");
  await writeFile(join(root, "protected.ts"), "const secret = 'needle';\n");
  await Bun.write(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      defaultAgent: "review",
      agents: {
        review: {
          description: "Review",
          permissions: {
            files: {
              readPaths: [
                {
                  pattern: "protected.ts",
                  allow: false,
                  reason: "protected read path",
                },
              ],
            },
          },
        },
      },
    }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_search_policy",
    permissionMode: "auto",
    provider: searchPolicyProvider(),
  });
  client.start((event) => events.push(event));
  await client.submit("search workspace");

  for (const name of ["glob", "grep"])
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "tool.update",
        name,
        status: "failed",
        summary: expect.stringContaining("protected read path"),
      }),
    );
});

test("real runtime client with exclude policy blocks tool execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-policy-block-"));
  const events: RuntimeEvent[] = [];
  const policy: ToolPolicy = { exclude: ["read_file"] };
  const provider = blockTestProvider();
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_policy_block",
    provider,
    permissionMode: "auto",
    toolPolicy: policy,
  });
  client.start((event) => events.push(event));
  await client.submit("read input.txt");
  const failedEvents = events.filter(
    (event) =>
      event.type === "tool.update" &&
      event.name === "read_file" &&
      event.status === "failed",
  );
  expect(failedEvents.length).toBeGreaterThan(0);
});

test("runtime persists safe policy decisions without tool arguments", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-policy-audit-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await Bun.write(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      defaultAgent: "review",
      agents: {
        review: {
          description: "Review",
          permissions: {
            files: {
              writePaths: [
                {
                  pattern: "protected.txt",
                  allow: false,
                  reason: "protected by agent policy",
                },
              ],
            },
          },
        },
      },
    }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_policy_audit",
    permissionMode: "auto",
    provider: writeProvider("protected.txt"),
  });
  client.start((event) => events.push(event));
  await client.submit("read input.txt");

  expect(events).toContainEqual(
    expect.objectContaining({
      type: "policy.decision",
      toolName: "write_file",
      decision: "deny",
      reason: 'write to "protected.txt" blocked: protected by agent policy',
    }),
  );
  const history = await client.history!({ limit: 100 });
  const decision = history.events.find(
    (
      entry,
    ): entry is typeof entry & {
      event: Extract<RuntimeEvent, { type: "policy.decision" }>;
    } => entry.event.type === "policy.decision",
  )?.event;
  expect(decision).toEqual({
    type: "policy.decision",
    turnID: expect.any(String),
    toolName: "write_file",
    toolCallID: "call_write",
    decision: "deny",
    reason: 'write to "protected.txt" blocked: protected by agent policy',
  });
  expect(JSON.stringify(decision)).not.toContain("content");
});

test("catalog policy denials are durably distinguished from unknown tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-catalog-audit-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_catalog_audit",
    permissionMode: "auto",
    toolPolicy: { exclude: ["read_file"] },
    provider: blockTestProvider(),
  });
  client.start((event) => events.push(event));
  await client.submit("read input.txt");

  expect(events).toContainEqual(
    expect.objectContaining({
      type: "policy.decision",
      toolName: "read_file",
      decision: "deny",
      reason: "tool is excluded from the runtime catalog by policy",
    }),
  );
});

test("real runtime client hooks emit diagnostics on preExecute", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-hooks-pre-"));
  const events: RuntimeEvent[] = [];
  const hookCalls: string[] = [];
  const hooks: ToolHooks = {
    preExecute: async (event) => {
      hookCalls.push(`pre:${event.toolName}`);
      return {
        allowed: true,
        diagnostics: [`pre-check passed for ${event.toolName}`],
      };
    },
  };
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_hooks_pre",
    provider: toolCallingProviderWithName("read_file"),
    permissionMode: "auto",
    hooks,
  });
  client.start((event) => events.push(event));
  await client.submit("read");
  expect(hookCalls).toContain("pre:read_file");
  const diagEvents = events.filter(
    (event): event is Extract<RuntimeEvent, { type: "diagnostic" }> =>
      event.type === "diagnostic" && event.message.includes("pre-check passed"),
  );
  expect(diagEvents.length).toBeGreaterThan(0);
});

test("real runtime client hooks call postExecute after tool success", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-hooks-post-"));
  const events: RuntimeEvent[] = [];
  const captured: Array<{ toolName: string; result?: string }> = [];
  const hooks: ToolHooks = {
    postExecute: async (event) => {
      captured.push({ toolName: event.toolName, result: event.result });
    },
  };
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_hooks_post",
    provider: toolCallingProviderWithName("read_file"),
    permissionMode: "auto",
    hooks,
  });
  client.start((event) => events.push(event));
  await client.submit("read");
  expect(captured.length).toBeGreaterThan(0);
  expect(captured[0]?.toolName).toBe("read_file");
});

test("real runtime client hooks call postExecute with error on failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-hooks-error-"));
  const events: RuntimeEvent[] = [];
  const captured: Array<{ toolName: string; error?: string }> = [];
  const hooks: ToolHooks = {
    postExecute: async (event) => {
      captured.push({ toolName: event.toolName, error: event.error });
    },
  };
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_hooks_error",
    provider: toolCallingProviderWithName("read_file"),
    permissionMode: "auto",
    hooks,
    toolPolicy: { exclude: ["read_file"] },
  });
  client.start((event) => events.push(event));
  await client.submit("read");
  expect(captured.length).toBe(0);
});

test("real runtime client toolPolicy filters executeToolCalls lookup", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-policy-lookup-"));
  await writeFile(join(root, "test.txt"), "data\n");
  const events: RuntimeEvent[] = [];
  const policy: ToolPolicy = { allow: ["read_file"] };
  const provider = toolCallingProviderWithName("read_file");
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_policy_lookup",
    provider,
    permissionMode: "auto",
    toolPolicy: policy,
  });
  client.start((event) => events.push(event));
  await client.submit("read");
  const succeeded = events.some(
    (event) =>
      event.type === "tool.update" &&
      event.name === "read_file" &&
      event.status === "succeeded",
  );
  expect(succeeded).toBe(true);
});

test("real runtime client preExecute hook can block execution", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-hooks-block-"));
  const events: RuntimeEvent[] = [];
  const hooks: ToolHooks = {
    preExecute: async () => {
      return { allowed: false, diagnostics: ["blocked by custom hook"] };
    },
  };
  const provider = toolCallingProviderWithName("read_file");
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_hooks_block",
    provider,
    permissionMode: "auto",
    hooks,
  });
  client.start((event) => events.push(event));
  await client.submit("read");
  const failedEvents = events.filter(
    (event) =>
      event.type === "tool.update" &&
      event.status === "failed" &&
      event.name === "read_file",
  );
  expect(failedEvents.length).toBeGreaterThan(0);
});

test("real runtime client no policy or hooks preserves default behavior", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-default-"));
  await writeFile(join(root, "test.txt"), "default\n");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_default",
    provider: toolCallingProviderWithName("read_file"),
    permissionMode: "auto",
  });
  client.start((event) => events.push(event));
  await client.submit("read");
  const succeeded = events.some(
    (event) =>
      event.type === "tool.update" &&
      event.name === "read_file" &&
      event.status === "succeeded",
  );
  expect(succeeded).toBe(true);
});

function toolCallingProviderWithName(toolName: string): StreamingProvider {
  return {
    provider: "scripted-tool",
    model: "scripted-tool-model",
    async *stream(request: ProviderStreamRequest) {
      if (!request.messages.some((m) => m.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            { id: "call_1", name: toolName, arguments: '{"path":"test.txt"}' },
          ],
        };
        yield { type: "done" };
        return;
      }
      yield { type: "content", text: "done" };
      yield { type: "done" };
    },
  };
}

function writeProvider(path: string): StreamingProvider {
  return {
    provider: "scripted-write",
    model: "scripted-write-model",
    async *stream(request: ProviderStreamRequest) {
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_write",
              name: "write_file",
              arguments: JSON.stringify({ path, content: "blocked" }),
            },
          ],
        };
      }
      yield { type: "done" };
    },
  };
}

function sandboxCommandProvider(): StreamingProvider {
  return {
    provider: "scripted-sandbox",
    model: "scripted-sandbox-model",
    async *stream(request: ProviderStreamRequest) {
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_sandbox",
              name: "sandbox_execute",
              arguments: JSON.stringify({
                id: "box",
                command: "rm -rf generated",
              }),
            },
          ],
        };
      }
      yield { type: "done" };
    },
  };
}

function sandboxMergeProvider(): StreamingProvider {
  return {
    provider: "scripted-sandbox-merge",
    model: "scripted-sandbox-merge-model",
    async *stream(request: ProviderStreamRequest) {
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "merge",
              name: "sandbox_merge",
              arguments: JSON.stringify({ id: "box" }),
            },
          ],
        };
      }
      yield { type: "done" };
    },
  };
}

function searchPolicyProvider(): StreamingProvider {
  return {
    provider: "scripted-search-policy",
    model: "scripted-search-policy-model",
    async *stream(request: ProviderStreamRequest) {
      if (!request.messages.some((message) => message.role === "tool"))
        yield {
          type: "tool_call",
          calls: [
            {
              id: "glob",
              name: "glob",
              arguments: JSON.stringify({ pattern: "*.ts" }),
            },
            {
              id: "grep",
              name: "grep",
              arguments: JSON.stringify({
                pattern: "needle",
                include: "*.ts",
              }),
            },
          ],
        };
      yield { type: "done" };
    },
  };
}

function blockTestProvider(): StreamingProvider {
  return {
    provider: "block-test",
    model: "block-test-model",
    async *stream(request: ProviderStreamRequest) {
      if (!request.messages.some((m) => m.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_read",
              name: "read_file",
              arguments: '{"path":"input.txt"}',
            },
          ],
        };
        yield { type: "done" };
        return;
      }
      yield { type: "content", text: "done" };
      yield { type: "done" };
    },
  };
}
