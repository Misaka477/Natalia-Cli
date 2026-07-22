import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "bun:test";
import { createRealRuntimeClient } from "../src";
import type { RuntimeEvent } from "@natalia/contracts";
import type {
  ProviderStreamRequest,
  StreamingProvider,
} from "@natalia/runtime";
import { providerError } from "@natalia/runtime";
import { createToolRegistry } from "@natalia/tools";
import { resolveConfig } from "@natalia/config";

test("real runtime client streams provider output and persists replayable session", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-real-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_real",
    provider: scriptedProvider("hello from provider"),
  });
  client.start((event) => events.push(event));

  await client.submit("Say hello");

  expect(events.map((event) => event.type)).toEqual(
    expect.arrayContaining([
      "session.created",
      "session.ready",
      "turn.submitted",
      "checkpoint.created",
      "content.delta",
      "content.done",
      "turn.finished",
    ]),
  );
  expect(
    events
      .filter((event) => event.type === "content.delta")
      .map((event) => event.text)
      .join(""),
  ).toBe("hello from provider");
  const persisted = JSON.parse(
    await readFile(
      join(root, ".natalia", "sessions", "ses_ts7_real.json"),
      "utf8",
    ),
  ) as { events: RuntimeEvent[]; inbox?: Array<Record<string, unknown>> };
  expect(
    persisted.events.some((event) => event.type === "turn.submitted"),
  ).toBe(true);

  const replay: RuntimeEvent[] = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_real",
    provider: scriptedProvider("unused"),
  });
  reopened.start((event) => replay.push(event));
  await waitFor(() => replay.some((event) => event.type === "session.ready"));
  expect(
    replay.some(
      (event) =>
        event.type === "content.done" && event.text === "hello from provider",
    ),
  ).toBe(true);
});

test("runtime status and diagnostics expose only published safe state", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-status-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_status",
    provider: scriptedProvider("ready"),
  });
  client.start(() => undefined);
  client.diagnostic("provider key is configured", "info");
  const status = await client.runtimeStatus?.();
  const diagnostics = await client.diagnostics?.(1);
  expect(status).toMatchObject({
    type: "status.snapshot",
    model: "scripted-model",
  });
  expect(diagnostics).toMatchObject([
    {
      level: "info",
      message: "provider key is configured",
      at: expect.any(String),
    },
  ]);
});

test("durable diagnostics restore on runtime reopen and render through the command", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-diagnostic-replay-"));
  const sessionID = "ses_diagnostic_replay";
  const first = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: scriptedProvider("first"),
  });
  first.start(() => undefined);
  await first.runtimeStatus?.();
  first.diagnostic("persisted safe warning", "warning");
  await first.dispose?.();
  const events: RuntimeEvent[] = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: scriptedProvider("reopened"),
  });
  reopened.start((event) => events.push(event));
  expect(await reopened.diagnostics?.()).toMatchObject([
    {
      level: "warning",
      message: "persisted safe warning",
      at: expect.any(String),
    },
  ]);
  await reopened.submit("/diagnostics 1");
  expect(
    events
      .filter((event) => event.type === "content.delta")
      .map((event) => event.text)
      .join("\n"),
  ).toContain("warning: persisted safe warning");
});

test("TS config applies retry/context/checkpoint policy to an explicit provider", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-effective-config-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      runtime: {
        maxStepsPerTurn: 4,
        retry: {
          maxAttemptsPerStep: 1,
          initialBackoffMs: 1,
          maxBackoffMs: 1,
          jitterMs: 0,
        },
      },
      context: { compactionThresholdPercent: 90, reservedOutputTokens: 4096 },
      defaultModel: "configured",
      models: {
        configured: { provider: "configured", model: "configured-model" },
      },
      providers: { configured: { type: "openai", apiKey: "test-config-key" } },
      checkpoint: {
        enabled: false,
        maxFiles: 1,
        maxBytes: 1024,
        ignore: [],
        additionalDirs: [],
      },
    }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_effective_config",
    provider: scriptedProvider("effective config"),
  });
  client.start((event) => events.push(event));
  await client.submit("hello");
  expect(events.some((event) => event.type === "checkpoint.created")).toBe(
    false,
  );
  expect(
    events.some(
      (event) =>
        event.type === "context.status" &&
        event.thresholdPercent === 90 &&
        event.reserved === 4096,
    ),
  ).toBe(true);
});

test("configured agent selection supplies the provider system prompt and tool policy", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-agent-selection-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      agents: {
        reviewer: {
          description: "Review changes",
          systemPrompt: "Review only with evidence.",
          allowedTools: ["read_file"],
        },
      },
      defaultAgent: "reviewer",
    }),
  );
  const requests: ProviderStreamRequest[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_agent_selection",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("review this");
  const request = requests[0];
  expect(request).toBeDefined();
  expect(request!.messages[0]).toMatchObject({
    role: "system",
    content: "Review only with evidence.",
  });
  expect(request!.tools?.map((tool) => tool.name)).toEqual(["read_file"]);
});

test("runtime discovers configured remote skills through the local cache", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-remote-skill-runtime-"));
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/skills/index.json")
        return Response.json({
          skills: [{ name: "remote", version: "1", files: ["SKILL.md"] }],
        });
      if (path === "/skills/remote/SKILL.md")
        return new Response(
          "---\nname: remote\ndescription: Remote\n---\nRemote guidance",
        );
      return new Response("missing", { status: 404 });
    },
  });
  try {
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        skills: { urls: [`${server.url}skills/`] },
      }),
    );
    expect(
      (await resolveConfig({ workspaceRoot: root })).config.skills.urls,
    ).toEqual([`${server.url}skills/`]);
    const events: RuntimeEvent[] = [];
    const client = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: "ses_remote_skill_runtime",
      provider: scriptedProvider("done"),
    });
    client.start((event) => events.push(event));
    await client.submit("/skills");
    expect(
      events
        .filter((event) => event.type === "content.delta")
        .map((event) => event.text)
        .join("\n"),
    ).toContain("remote: Remote");
  } finally {
    server.stop(true);
  }
});

test("runtime loads a local manifest plugin and exposes its owned tool", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugin-runtime-"));
  const pluginRoot = join(root, ".natalia", "plugins", "demo");
  await mkdir(pluginRoot, { recursive: true });
  await writeFile(
    join(pluginRoot, "natalia.plugin.json"),
    JSON.stringify({
      apiVersion: 1,
      id: "demo.plugin",
      version: "1.0.0",
      name: "Demo",
      description: "",
      entry: "index.ts",
      capabilities: ["tools"],
    }),
  );
  await writeFile(
    join(pluginRoot, "index.ts"),
    "export default { setup(api) { api.tools.register({ name: 'echo', description: 'Echo', requiresApproval: false, parameters: { type: 'object', properties: {} }, async execute() { return 'plugin ok'; } }) } }",
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_plugin_runtime",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool"))
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "plugin",
                name: "plugin_demo_plugin_echo",
                arguments: "{}",
              },
            ],
          };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("run plugin");
  expect(events).toContainEqual({
    type: "plugin.update",
    id: "demo.plugin",
    status: "loaded",
    detail: undefined,
  });
  expect(
    events.some(
      (event) =>
        event.type === "tool.update" &&
        event.name === "plugin_demo_plugin_echo" &&
        event.status === "succeeded",
    ),
  ).toBe(true);
  await client.dispose?.();
  expect(events).toContainEqual({
    type: "plugin.update",
    id: "demo.plugin",
    status: "unloaded",
    detail: undefined,
  });
});

test("runtime persists workflow lifecycle events from workflow_run", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workflow-runtime-"));
  const workflow = JSON.stringify({
    version: 1,
    name: "runtime-workflow",
    steps: [{ id: "set", kind: "set", key: "result", value: "ok" }],
  });
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_workflow_runtime",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool"))
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "workflow",
                name: "workflow_run",
                arguments: JSON.stringify({ workflow, runID: "wf_runtime" }),
              },
            ],
          };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("run workflow");
  const lifecycle = events.filter(
    (event): event is Extract<RuntimeEvent, { type: "workflow.update" }> =>
      event.type === "workflow.update",
  );
  expect(lifecycle.map((event) => event.event)).toEqual([
    "run_started",
    "step_started",
    "step_completed",
    "run_completed",
  ]);
  expect(lifecycle.at(-1)).toMatchObject({
    runID: "wf_runtime",
    workflow: "runtime-workflow",
    status: "completed",
  });
  const history = await client.history?.();
  expect(
    history?.events.some(
      (item) =>
        item.event.type === "workflow.update" &&
        item.event.runID === "wf_runtime",
    ),
  ).toBe(true);
});

test("runtime projects exact durable interactive PTY actions", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pty-runtime-"));
  const events: RuntimeEvent[] = [];
  const handled = new Set<string>();
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_pty_runtime",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        const text = [...request.messages]
          .reverse()
          .find((message) => message.role === "user")?.content;
        if (typeof text === "string" && !handled.has(text)) {
          handled.add(text);
          const call =
            text === "start pty"
              ? {
                  id: "start",
                  name: "interactive_start",
                  arguments: JSON.stringify({
                    id: "tty_runtime",
                    command: "cat",
                  }),
                }
              : text === "write pty"
                ? {
                    id: "write",
                    name: "interactive_write",
                    arguments: JSON.stringify({
                      id: "tty_runtime",
                      input: "secret",
                      sensitive: true,
                    }),
                  }
                : {
                    id: "stop",
                    name: "interactive_stop",
                    arguments: JSON.stringify({ id: "tty_runtime" }),
                  };
          yield { type: "tool_call" as const, calls: [call] };
        }
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("start pty");
  await client.submit("write pty");
  await client.submit("stop pty");
  const actions = events.filter(
    (event): event is Extract<RuntimeEvent, { type: "pty.action" }> =>
      event.type === "pty.action",
  );
  expect(actions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ action: "submit", redacted: true }),
      expect.objectContaining({ action: "exit", redacted: false }),
    ]),
  );
  const history = await client.history?.();
  expect(
    history?.events.some(
      (item) =>
        item.event.type === "pty.timeline" &&
        item.event.summary === "sensitive input supplied",
    ),
  ).toBe(true);
  await client.dispose?.();
});

test("agent permissions block configured file and command execution at tool boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-agent-permissions-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      agents: {
        locked: {
          description: "Locked",
          permissions: {
            files: {
              writePaths: [
                { pattern: "secret.txt", allow: false, reason: "protected" },
              ],
            },
            commands: { denyPatterns: ["rm\\s"] },
          },
        },
      },
      defaultAgent: "locked",
    }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_agent_permissions",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool")) {
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "write",
                name: "write_file",
                arguments: JSON.stringify({
                  path: "secret.txt",
                  content: "no",
                }),
              },
              {
                id: "shell",
                name: "run_shell",
                arguments: JSON.stringify({ command: "rm secret.txt" }),
              },
            ],
          };
        }
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("try protected actions");
  const failures = events.filter(
    (event): event is Extract<RuntimeEvent, { type: "tool.update" }> =>
      event.type === "tool.update" && event.status === "failed",
  );
  expect(events.map((event) => event.type)).toContain("tool.update");
  expect(JSON.stringify(failures)).toContain("protected");
  expect(JSON.stringify(failures)).toContain("command matches deny pattern");
});

test("agent permissions apply network, environment, and output redaction boundaries", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-agent-boundary-permissions-"),
  );
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      agents: {
        guarded: {
          description: "Guarded",
          permissions: {
            network: { allowLocalhost: false },
            env: { allowlist: [] },
            redactOutput: true,
          },
        },
      },
      defaultAgent: "guarded",
    }),
  );
  process.env.NATALIA_AGENT_BOUNDARY_SECRET = "should-not-leak";
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_agent_boundary_permissions",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool")) {
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "web",
                name: "web_fetch",
                arguments: JSON.stringify({ url: "http://127.0.0.1:9" }),
              },
              {
                id: "shell",
                name: "run_shell",
                arguments: JSON.stringify({
                  command:
                    "printf 'token=visible\\nsecret=$NATALIA_AGENT_BOUNDARY_SECRET'",
                }),
              },
            ],
          };
        }
        yield { type: "done" as const };
      },
    },
  });
  try {
    client.start((event) => events.push(event));
    await client.submit("check boundaries");
    const results = events.filter(
      (event): event is Extract<RuntimeEvent, { type: "tool.update" }> =>
        event.type === "tool.update" && Boolean(event.result),
    );
    expect(results.map((event) => event.result).join(" ")).toContain(
      "localhost network access is not allowed",
    );
    const shell =
      results.find((event) => event.name === "run_shell")?.result ?? "";
    expect(shell).toContain("token=[REDACTED]");
    expect(shell).not.toContain("should-not-leak");
  } finally {
    delete process.env.NATALIA_AGENT_BOUNDARY_SECRET;
  }
});

test("runtime agent selection applies only at the next provider turn boundary", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-agent-boundary-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      agents: {
        first: { description: "First", systemPrompt: "first system" },
        second: { description: "Second", systemPrompt: "second system" },
      },
      defaultAgent: "first",
    }),
  );
  const requests: ProviderStreamRequest[] = [];
  let release: (() => void) | undefined;
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_agent_boundary",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        if (requests.length === 1)
          await new Promise<void>((resolve) => (release = resolve));
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  const first = client.submit("first");
  while (!release) await Bun.sleep(1);
  client.selectAgent?.("second");
  expect(events).toContainEqual({
    type: "agent.selection",
    name: "second",
    pending: true,
  });
  release();
  await first;
  await client.submit("second");
  expect(requests[0]?.messages[0]).toMatchObject({ content: "first system" });
  expect(requests[1]?.messages[0]).toMatchObject({ content: "second system" });
  expect(events).toContainEqual({
    type: "agent.selection",
    name: "second",
    pending: false,
  });
});

test("committed agent selection restores when a session runtime is reopened", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-agent-replay-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      agents: {
        first: { description: "First", systemPrompt: "first system" },
        second: { description: "Second", systemPrompt: "second system" },
      },
      defaultAgent: "first",
    }),
  );
  const sessionID = "ses_agent_replay";
  const first = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: scriptedProvider("first"),
  });
  first.start(() => undefined);
  await first.submit("initialize runtime");
  first.selectAgent?.("second");
  await first.dispose?.();

  const requests: ProviderStreamRequest[] = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID,
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        yield { type: "done" as const };
      },
    },
  });
  reopened.start(() => undefined);
  await reopened.submit("after reopen");
  expect(requests[0]?.messages[0]).toMatchObject({ content: "second system" });
});

test("agent model and variant overrides apply when the next provider turn starts", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-agent-model-override-"));
  const requests: Array<Record<string, unknown>> = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      requests.push((await request.json()) as Record<string, unknown>);
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  try {
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai",
            apiKey: "local-key",
            baseURL: server.url.toString(),
          },
        },
        models: {
          alpha: { provider: "local", model: "alpha" },
          beta: {
            provider: "local",
            model: "beta",
            variants: { careful: { model: "beta-careful", temperature: 0.2 } },
          },
        },
        defaultModel: "alpha",
        agents: {
          first: { description: "First", model: "alpha" },
          second: { description: "Second", model: "beta", variant: "careful" },
        },
        defaultAgent: "first",
      }),
    );
    const client = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: "ses_agent_model_override",
    });
    client.start(() => undefined);
    await client.submit("first");
    client.selectAgent?.("second");
    await client.submit("second");
    expect(requests.map((request) => request.model)).toEqual([
      "alpha",
      "beta-careful",
    ]);
    expect(requests[1]?.temperature).toBe(0.2);
  } finally {
    server.stop(true);
  }
});

test("runtime model selections persist across reopen and expose safe catalogs", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-runtime-model-selection-"),
  );
  const requests: Array<Record<string, unknown>> = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      requests.push((await request.json()) as Record<string, unknown>);
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  try {
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai",
            apiKey: "local-key",
            baseURL: server.url.toString(),
          },
        },
        models: {
          alpha: { provider: "local", model: "alpha" },
          beta: {
            provider: "local",
            model: "beta",
            variants: { careful: { model: "beta-careful", temperature: 0.2 } },
          },
        },
        defaultModel: "alpha",
      }),
    );
    const sessionID = "ses_runtime_model_selection" as const;
    const client = createRealRuntimeClient({ workspaceRoot: root, sessionID });
    client.start(() => undefined);
    expect(await client.modelCatalog?.()).toEqual([
      { id: "alpha", name: "alpha", provider: "local", variants: [] },
      { id: "beta", name: "beta", provider: "local", variants: ["careful"] },
    ]);
    await client.selectModel?.("beta", "careful");
    expect(await client.modelSelection?.()).toEqual({
      modelID: "beta",
      variant: "careful",
    });
    await client.submit("selected model");
    expect(requests[0]).toMatchObject({
      model: "beta-careful",
      temperature: 0.2,
    });
    await client.dispose?.();

    const reopened = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID,
    });
    reopened.start(() => undefined);
    await reopened.submit("restored model");
    expect(requests[1]).toMatchObject({
      model: "beta-careful",
      temperature: 0.2,
    });
  } finally {
    server.stop(true);
  }
});

test("runtime skill catalog exposes discovery metadata without skill body", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-skill-catalog-"));
  await mkdir(join(root, ".natalia", "skills", "release"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "skills", "release", "SKILL.md"),
    "---\nname: release\ndescription: Prepare release evidence\nrequire-approval: true\n---\nSECRET SKILL BODY",
  );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_skill_catalog",
    provider: scriptedProvider("unused"),
  });
  client.start(() => undefined);
  expect(await client.skills?.()).toEqual([
    {
      name: "release",
      qualifiedName: "project:release",
      description: "Prepare release evidence",
      source: "project",
      requireApproval: true,
      sandboxRequired: false,
    },
  ]);
});

test("runtime exposes contained workspace filesystem APIs", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-workspace-api-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "main.ts"), "const needle = true\n");
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_workspace_api",
    provider: scriptedProvider("unused"),
  });
  client.start(() => undefined);
  expect(await client.workspaceList?.()).toEqual([
    { path: "src/", type: "directory" },
  ]);
  expect(await client.workspaceGlob?.({ pattern: "**/*.ts" })).toEqual([
    { path: "src/main.ts", type: "file" },
  ]);
  expect(await client.workspaceRead?.({ path: "src/main.ts" })).toMatchObject({
    content: "const needle = true\n",
    encoding: "utf8",
  });
  expect(await client.workspaceSearch?.({ query: "needle" })).toEqual([
    { path: "src/main.ts", line: 1, text: "const needle = true" },
  ]);
});

test("runtime session management uses durable metadata and protects the active session", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-session-management-"));
  const activeID = "ses_runtime_session_active" as const;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: activeID,
    provider: scriptedProvider("unused"),
  });
  client.start(() => undefined);
  await client.submit("active session");
  const duplicated = await client.sessionDuplicate?.(activeID, "Copy");
  expect(duplicated).toMatchObject({ title: "Copy", pinned: false });
  await client.sessionPin?.(duplicated!.id, true);
  await client.sessionRename?.(duplicated!.id, "Renamed copy");
  await client.sessionTouch?.(duplicated!.id);
  expect(await client.sessionList?.()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: duplicated!.id, title: "Renamed copy", pinned: true }),
    ]),
  );
  await expect(client.sessionDelete?.(activeID)).rejects.toThrow(
    "cannot delete the active runtime session",
  );
  expect(await client.sessionDelete?.(duplicated!.id)).toMatchObject({
    id: duplicated!.id,
  });
});

test("runtime filesystem slash commands use the protected catalog", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-runtime-workspace-command-"),
  );
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "main.ts"), "const needle = true\n");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_workspace_command",
    provider: scriptedProvider("unused"),
  });
  client.start((event) => events.push(event));
  await client.submit("/files main");
  await client.submit("/search needle");
  expect(
    events
      .filter((event) => event.type === "content.delta")
      .map((event) => event.text),
  ).toEqual(["src/main.ts", "src/main.ts:1:const needle = true"]);
});

test("model slash commands share catalog and durable selection behavior", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-runtime-model-command-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      providers: {
        local: {
          type: "openai",
          apiKey: "local-key",
          baseURL: "http://127.0.0.1:9",
        },
      },
      models: {
        alpha: { provider: "local", model: "alpha" },
        beta: {
          provider: "local",
          model: "beta",
          variants: { fast: { model: "beta-fast" } },
        },
      },
      defaultModel: "alpha",
    }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_runtime_model_command",
  });
  client.start((event) => events.push(event));
  await client.submit("/models");
  expect(
    events.filter((event) => event.type === "content.delta").at(-1),
  ).toMatchObject({
    text: expect.stringContaining("beta: beta @ local (fast)"),
  });
  await client.submit("/model beta fast");
  expect(events).toContainEqual({
    type: "model.selection",
    modelID: "beta",
    variant: "fast",
  });
});

test("configured provider policy denies a selected model without starting a provider request", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-provider-policy-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      providers: {
        local: {
          type: "openai",
          apiKey: "local-key",
          baseURL: "http://127.0.0.1:9",
        },
      },
      models: { blocked: { provider: "local", model: "blocked" } },
      defaultModel: "blocked",
      experimental: {
        policies: [
          { effect: "deny", action: "provider.use", resource: "local/blocked" },
        ],
      },
    }),
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_provider_policy",
  });
  client.start((event) => events.push(event));
  await client.submit("policy blocked");
  expect(events).toContainEqual(
    expect.objectContaining({
      type: "diagnostic",
      level: "error",
      message: expect.stringContaining("No real provider configured"),
    }),
  );
});

test("model capability disables provider-visible tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-model-capabilities-"));
  const requests: ProviderStreamRequest[] = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      requests.push((await request.json()) as ProviderStreamRequest);
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  try {
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai",
            apiKey: "key",
            baseURL: server.url.toString(),
          },
        },
        models: {
          text: {
            provider: "local",
            model: "text",
            capabilities: {
              toolCall: false,
              reasoning: false,
              thinking: false,
            },
          },
        },
        defaultModel: "text",
      }),
    );
    const client = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: "ses_model_capabilities",
    });
    client.start(() => undefined);
    await client.submit("no tools");
    expect(requests[0]?.tools).toBeUndefined();
  } finally {
    server.stop(true);
  }
});

test("workspace image attachment is stored privately and lowered for OpenAI-compatible provider", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-image-attachment-"));
  const requests: Array<Record<string, unknown>> = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      requests.push((await request.json()) as Record<string, unknown>);
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  try {
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(
      join(root, "image.png"),
      Buffer.from("89504e470d0a1a0a", "hex"),
    );
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai",
            apiKey: "key",
            baseURL: server.url.toString(),
          },
        },
        models: {
          vision: {
            provider: "local",
            model: "vision",
            capabilities: { imageInput: true },
          },
        },
        defaultModel: "vision",
      }),
    );
    const client = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: "ses_image_attachment",
    });
    client.start(() => undefined);
    await client.submitInput?.({ text: "inspect", attachments: ["image.png"] });
    const history = await client.history?.();
    expect(
      history?.events.find((item) => item.event.type === "turn.submitted")
        ?.event,
    ).toMatchObject({ attachments: [{ mediaType: "image/png" }] });
    const messages = requests[0]?.messages as Array<{
      role: string;
      content: unknown;
    }>;
    const user = messages.find((message) => message.role === "user");
    expect(user?.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "image_url",
          image_url: expect.objectContaining({
            url: expect.stringMatching(/^data:image\/png;base64,/u),
          }),
        }),
      ]),
    );
    expect(await readdir(join(root, ".natalia", "attachments"))).toHaveLength(
      1,
    );
    await client.dispose?.();
    const reopened = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: "ses_image_attachment",
    });
    reopened.start(() => undefined);
    await reopened.submit("follow up");
    const followUpMessages = requests[1]?.messages as Array<{
      role: string;
      content: unknown;
    }>;
    expect(
      followUpMessages.find((message) => message.role === "user")?.content,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "image_url",
          image_url: expect.objectContaining({
            url: expect.stringMatching(/^data:image\/png;base64,/u),
          }),
        }),
      ]),
    );
    await reopened.dispose?.();
  } finally {
    server.stop(true);
  }
});

test("runtime injects a UTF-8 text attachment into the active provider turn", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-text-attachment-"));
  const requests: Array<Record<string, unknown>> = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      requests.push((await request.json()) as Record<string, unknown>);
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  try {
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(join(root, "notes.md"), "evidence");
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "openai",
            apiKey: "key",
            baseURL: server.url.toString(),
          },
        },
        models: { text: { provider: "local", model: "text" } },
        defaultModel: "text",
      }),
    );
    const client = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: "ses_text_attachment",
    });
    client.start(() => undefined);
    await client.submitInput?.({ text: "review", attachments: ["notes.md"] });
    const messages = requests[0]?.messages as Array<{
      role: string;
      content: string;
    }>;
    expect(
      messages.find((message) => message.role === "user")?.content,
    ).toContain("[Attachment: notes.md]\nevidence");
  } finally {
    server.stop(true);
  }
});

test("runtime lowers a PDF attachment through the Anthropic adapter", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-pdf-attachment-"));
  const requests: Array<Record<string, unknown>> = [];
  const server = Bun.serve({
    port: 0,
    fetch: async (request) => {
      requests.push((await request.json()) as Record<string, unknown>);
      return new Response("data: [DONE]\n\n", {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  try {
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(join(root, "report.pdf"), "%PDF-1.7\n");
    await writeFile(
      join(root, ".natalia", "config.json"),
      JSON.stringify({
        version: 2,
        providers: {
          local: {
            type: "anthropic",
            apiKey: "key",
            baseURL: server.url.toString(),
          },
        },
        models: {
          pdf: {
            provider: "local",
            model: "pdf",
            capabilities: { pdfInput: true },
          },
        },
        defaultModel: "pdf",
      }),
    );
    const client = createRealRuntimeClient({
      workspaceRoot: root,
      sessionID: "ses_pdf_attachment",
    });
    client.start(() => undefined);
    await client.submitInput?.({ text: "read", attachments: ["report.pdf"] });
    const messages = requests[0]?.messages as Array<{
      content: Array<{ type?: string; source?: { media_type?: string } }>;
    }>;
    expect(
      messages[0]?.content.find((part) => part.type === "document"),
    ).toMatchObject({ source: { media_type: "application/pdf" } });
  } finally {
    server.stop(true);
  }
});

test("agent MCP server scope limits provider-visible MCP tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-agent-mcp-scope-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      agents: { scoped: { description: "Scoped", mcpServers: ["one"] } },
      defaultAgent: "scoped",
    }),
  );
  const tools = createToolRegistry([]);
  for (const name of ["mcp_one_echo", "mcp_two_echo"]) {
    tools.set(name, {
      name,
      description: name,
      requiresApproval: false,
      parameters: { type: "object", properties: {} },
      async execute() {
        return "ok";
      },
    });
  }
  const requests: ProviderStreamRequest[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_agent_mcp_scope",
    tools,
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("scope MCP tools");
  expect(requests[0]?.tools?.map((tool) => tool.name)).toContain(
    "mcp_one_echo",
  );
  expect(requests[0]?.tools?.map((tool) => tool.name)).not.toContain(
    "mcp_two_echo",
  );
});

test("agent MCP scope includes only its server prompt and resource tools", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-agent-mcp-catalog-scope-"),
  );
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 2,
      agents: { scoped: { description: "Scoped", mcpServers: ["one"] } },
      defaultAgent: "scoped",
    }),
  );
  const tools = createToolRegistry([]);
  for (const name of [
    "mcp_one_prompt_get",
    "mcp_one_resource_read",
    "mcp_two_prompt_get",
    "mcp_two_resource_read",
  ]) {
    tools.set(name, {
      name,
      description: name,
      requiresApproval: false,
      parameters: { type: "object", properties: {} },
      async execute() {
        return "ok";
      },
    });
  }
  const requests: ProviderStreamRequest[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_agent_mcp_catalog_scope",
    tools,
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request);
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("scope MCP catalog tools");
  const names = requests[0]?.tools?.map((tool) => tool.name) ?? [];
  expect(names).toEqual(
    expect.arrayContaining(["mcp_one_prompt_get", "mcp_one_resource_read"]),
  );
  expect(names).not.toEqual(
    expect.arrayContaining(["mcp_two_prompt_get", "mcp_two_resource_read"]),
  );
});

test("real runtime client routes checkpoint slash commands to real store", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-checkpoint-"));
  await writeFile(join(root, "test_example.py"), "print('ok')\n");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_checkpoint",
    provider: scriptedProvider("unused"),
  });
  client.start((event) => events.push(event));
  await waitFor(() => events.some((event) => event.type === "session.ready"));
  await client.submit("/checkpoint");
  await writeFile(join(root, "created_after.py"), "print('new')\n");
  await client.submit("/rollback checkpoint_1 --dry-run");

  expect(
    events.some(
      (event) =>
        event.type === "checkpoint.created" && event.reason === "manual",
    ),
  ).toBe(true);
  expect(
    events.some(
      (event) => event.type === "rollback.previewed" && event.preview.dryRun,
    ),
  ).toBe(true);
});

test("real runtime client executes model tool calls with approval policy", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-tools-"));
  await writeFile(join(root, "input.txt"), "tool data\n");
  const events: RuntimeEvent[] = [];
  const provider = toolCallingProvider();
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_tools",
    provider,
    permissionMode: "auto",
  });
  client.start((event) => events.push(event));
  await client.submit("Read input.txt");

  expect(
    events.some(
      (event) =>
        event.type === "tool.update" &&
        event.name === "read_file" &&
        event.status === "succeeded",
    ),
  ).toBe(true);
  expect(
    events
      .filter((event) => event.type === "content.delta")
      .map((event) => event.text)
      .join(""),
  ).toContain("tool said: tool data");
  expect(
    provider.requests
      .at(-1)
      ?.messages.some(
        (message) =>
          message.role === "tool" && message.content.includes("tool data"),
      ),
  ).toBe(true);
});

test("write approval uses a compact preview and preserves raw request detail", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-approval-preview-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_approval_preview",
    provider: approvalWriteProvider(),
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.submit("write a note");
  const approval = events.find(
    (event): event is Extract<RuntimeEvent, { type: "approval.request" }> =>
      event.type === "approval.request",
  )!;
  expect(approval.preview).toContain("Write long-note.md");
  expect(approval.preview.length).toBeLessThan(300);
  expect(approval.detail).toContain('"content"');
});

test("cancelling a pending approval settles the active turn without polling", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-approval-cancel-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_approval_cancel",
    provider: approvalWriteProvider(),
  });
  let cancelled = false;
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request" && !cancelled) {
      cancelled = true;
      client.cancel("approval cancelled");
    }
  });

  await client.submit("write then cancel");
  expect(events.some((event) => event.type === "turn.cancelled")).toBe(true);
  expect(
    events.some(
      (event) =>
        event.type === "turn.finished" && event.stopReason === "cancelled",
    ),
  ).toBe(true);
  expect(
    events.filter(
      (event) =>
        event.type === "turn.finished" && event.stopReason === "cancelled",
    ),
  ).toHaveLength(1);
});

test("provider admission is persisted before the provider turn begins", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-admission-"));
  let started = false;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_admission",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        started = true;
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const submitted = await client.submit("persist me first");
  expect(started).toBe(true);
  const stored = JSON.parse(
    await readFile(
      join(root, ".natalia", "sessions", "ses_ts7_admission.json"),
      "utf8",
    ),
  ) as { events: RuntimeEvent[]; inbox?: Array<Record<string, unknown>> };
  expect(
    stored.events.some(
      (event) => event.type === "turn.submitted" && event.id === submitted.id,
    ),
  ).toBe(true);
  expect(stored.inbox).toMatchObject([
    {
      id: submitted.id,
      text: "persist me first",
      delivery: "steer",
      promotedAt: expect.any(String),
    },
  ]);
});

test("queued input wakes an idle session after durable admission", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-queued-input-"));
  let started = false;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_queued_input",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        started = true;
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const submitted = await client.submitInput!({
    text: "wait for idle",
    delivery: "queue",
  });
  for (let index = 0; index < 50 && !started; index++) await Bun.sleep(1);
  expect(started).toBe(true);
  const stored = JSON.parse(
    await readFile(
      join(root, ".natalia", "sessions", "ses_ts7_queued_input.json"),
      "utf8",
    ),
  ) as { inbox?: Array<Record<string, unknown>> };
  expect(stored.inbox).toMatchObject([
    { id: submitted.id, text: "wait for idle", delivery: "queue" },
  ]);
  expect(stored.inbox?.[0]?.promotedAt).toEqual(expect.any(String));
});

test("queued input promotes after the active steer turn becomes idle", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-queued-promotion-"));
  const requests: string[] = [];
  let release: (() => void) | undefined;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_queued_promotion",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push(request.messages.at(-1)?.content ?? "");
        if (requests.length === 1)
          await new Promise<void>((resolve) => (release = resolve));
        yield { type: "content" as const, text: "done" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  const first = client.submit("first");
  while (!release) await Bun.sleep(1);
  const queued = await client.submitInput!({
    text: "queued",
    delivery: "queue",
  });
  release();
  await first;
  expect(requests).toEqual(["first", "queued"]);
  const stored = JSON.parse(
    await readFile(
      join(root, ".natalia", "sessions", "ses_ts7_queued_promotion.json"),
      "utf8",
    ),
  ) as { inbox?: Array<{ id: string; promotedAt?: string }> };
  expect(
    stored.inbox?.find((item) => item.id === queued.id)?.promotedAt,
  ).toEqual(expect.any(String));
});

test("exact input retry does not duplicate a completed provider turn", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-input-retry-"));
  let calls = 0;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_input_retry",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        calls++;
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submitInput!({
    id: "turn_retry",
    text: "same",
    delivery: "steer",
  });
  await client.submitInput!({
    id: "turn_retry",
    text: "same",
    delivery: "steer",
  });
  expect(calls).toBe(1);
  await expect(
    client.submitInput!({
      id: "turn_retry",
      text: "different",
      delivery: "steer",
    }),
  ).rejects.toThrow("session input conflicts");
});

test("restart resumes a pending queued input but does not replay interrupted provider work", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-restart-queue-"));
  await mkdir(join(root, ".natalia", "sessions"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "sessions", "ses_ts7_restart_queue.json"),
    JSON.stringify({
      id: "ses_ts7_restart_queue",
      title: "Interrupted",
      createdAt: "2026-07-21T00:00:00.000Z",
      cancelled: false,
      resumable: true,
      events: [
        {
          type: "turn.submitted",
          id: "turn_interrupted",
          text: "unsafe to replay",
          byteLength: 16,
          lineCount: 1,
          sha256: "test",
        },
      ],
      inbox: [
        {
          id: "turn_queued",
          sessionID: "ses_ts7_restart_queue",
          text: "safe queued",
          delivery: "queue",
          admittedAt: "2026-07-21T00:00:00.000Z",
        },
      ],
    }),
  );

  const events: RuntimeEvent[] = [];
  let calls = 0;
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_restart_queue",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        calls++;
        yield { type: "done" as const };
      },
    },
  });
  reopened.start((event) => events.push(event));
  for (let index = 0; index < 50 && !calls; index++) await Bun.sleep(1);
  expect(calls).toBe(1);
  expect(
    events.some(
      (event) =>
        event.type === "diagnostic" &&
        event.message.includes("incomplete provider work"),
    ),
  ).toBe(true);
});

test("runtime history supplies a stable local cursor without SQLite", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-history-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_history",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("one");
  await client.submit("two");
  const first = await client.history!({ limit: 1 });
  expect(first.events).toHaveLength(1);
  expect(first.hasMore).toBe(true);
  const next = await client.history!({
    after: first.events[0]!.seq,
    limit: 100,
  });
  expect(next.events[0]!.seq).toBe(first.events[0]!.seq + 1);
});

test("durable history retains full assistant settlement without live fragments", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-durable-content-"));
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_durable_content",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "content" as const, text: "hello " };
        yield { type: "content" as const, text: "world" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("greet");
  const stored = JSON.parse(
    await readFile(
      join(root, ".natalia", "sessions", "ses_ts7_durable_content.json"),
      "utf8",
    ),
  ) as { events: RuntimeEvent[] };
  expect(stored.events.some((event) => event.type === "content.delta")).toBe(
    false,
  );
  expect(
    stored.events.find((event) => event.type === "content.done"),
  ).toMatchObject({ text: "hello world" });
});

test("restart restores the latest durable context checkpoint before later events", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-context-epoch-"));
  const requests: Array<{
    messages: Array<{ role: string; content: string }>;
  }> = [];
  const first = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_context_epoch",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "content" as const, text: "first answer" };
        yield { type: "done" as const };
      },
    },
  });
  first.start(() => undefined);
  await first.submit("first question");
  const persisted = JSON.parse(
    await readFile(
      join(root, ".natalia", "sessions", "ses_ts7_context_epoch.json"),
      "utf8",
    ),
  ) as { events: RuntimeEvent[] };
  expect(
    persisted.events.some((event) => event.type === "context.checkpoint"),
  ).toBe(true);

  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_context_epoch",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push({
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        });
        yield { type: "done" as const };
      },
    },
  });
  const reopenedEvents: RuntimeEvent[] = [];
  reopened.start((event) => reopenedEvents.push(event));
  await Bun.sleep(5);
  const initializationFailure = reopenedEvents.find(
    (event) => event.type === "diagnostic" && event.level === "error",
  );
  expect(initializationFailure).toBeUndefined();
  await reopened.submit("second question");
  expect(requests[0]?.messages).toEqual(
    expect.arrayContaining([
      { role: "user", content: "first question" },
      { role: "assistant", content: "first answer" },
      { role: "user", content: "second question" },
    ]),
  );
});

test("context-limit compaction persists a durable context epoch", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-context-compaction-"));
  let attempts = 0;
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_context_compaction",
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        attempts++;
        if (attempts === 1)
          throw providerError({
            kind: "context_limit",
            message: "context limit",
          });
        yield { type: "content" as const, text: "recovered" };
        yield { type: "done" as const };
      },
    },
  });
  client.start(() => undefined);
  await client.submit("compact then retry");
  const stored = JSON.parse(
    await readFile(
      join(root, ".natalia", "sessions", "ses_ts7_context_compaction.json"),
      "utf8",
    ),
  ) as { events: RuntimeEvent[] };
  expect(
    stored.events.some((event) => event.type === "context.checkpoint"),
  ).toBe(true);
});

test("SQLite restart restores context from epoch baseline without duplicate history", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-ts7-sqlite-context-epoch-"),
  );
  const first = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_sqlite_context_epoch",
    useSqliteStore: true,
    provider: {
      provider: "test",
      model: "test",
      async *stream() {
        yield { type: "content" as const, text: "first answer" };
        yield { type: "done" as const };
      },
    },
  });
  first.start(() => undefined);
  await first.submit("first question");

  const requests: Array<{
    messages: Array<{ role: string; content: string }>;
  }> = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_sqlite_context_epoch",
    useSqliteStore: true,
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        requests.push({
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        });
        yield { type: "done" as const };
      },
    },
  });
  reopened.start(() => undefined);
  await reopened.submit("second question");
  const restored = requests[0]!.messages;
  expect(
    restored.filter((message) => message.content === "first question"),
  ).toHaveLength(1);
  expect(
    restored.filter((message) => message.content === "first answer"),
  ).toHaveLength(1);
  expect(
    restored.filter((message) => message.content === "second question"),
  ).toHaveLength(1);
});

test("restart projects unresolved interactive requests from durable events", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-ts7-interactive-restart-"),
  );
  await mkdir(join(root, ".natalia", "sessions"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "sessions", "ses_ts7_interactive_restart.json"),
    JSON.stringify({
      id: "ses_ts7_interactive_restart",
      title: "Interactive",
      createdAt: "2026-07-21T00:00:00.000Z",
      cancelled: false,
      resumable: true,
      events: [
        {
          type: "approval.request",
          id: "approval_open",
          title: "Write",
          preview: "file",
        },
        {
          type: "approval.request",
          id: "approval_closed",
          title: "Shell",
          preview: "pwd",
        },
        { type: "approval.response", id: "approval_closed", decision: "once" },
        { type: "question.request", id: "question_open", title: "Choice" },
      ],
    }),
  );
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_interactive_restart",
    provider: toolCallingProvider(),
  });
  client.start(() => undefined);
  expect(await client.pendingInteractive!()).toMatchObject({
    approvals: [{ id: "approval_open" }],
    questions: [{ id: "question_open" }],
  });
  client.respondApproval({ requestID: "approval_open", decision: "once" });
  client.respondQuestion({ requestID: "question_open", answers: [["answer"]] });
  expect(await client.pendingInteractive!()).toEqual({
    approvals: [],
    questions: [],
  });
});

test("provider can load a discovered skill through the canonical tool path", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-skill-tool-"));
  const skillRoot = join(root, ".natalia", "skills", "review");
  await mkdir(join(skillRoot, "references"), { recursive: true });
  await writeFile(
    join(skillRoot, "SKILL.md"),
    "---\nname: review\ndescription: Review\n---\nReview guidance",
  );
  await writeFile(join(skillRoot, "references", "guide.md"), "guide");
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_skill_tool",
    permissionMode: "auto",
    provider: {
      provider: "test",
      model: "test",
      async *stream(request) {
        if (!request.messages.some((message) => message.role === "tool")) {
          yield {
            type: "tool_call" as const,
            calls: [
              {
                id: "call_skill",
                name: "skill_load",
                arguments: JSON.stringify({ name: "review" }),
              },
            ],
          };
          yield { type: "done" as const };
          return;
        }
        yield { type: "content" as const, text: "skill loaded" };
        yield { type: "done" as const };
      },
    },
  });
  client.start((event) => events.push(event));
  await client.submit("load review skill");
  expect(
    events.some(
      (event) =>
        event.type === "tool.update" &&
        event.name === "skill_load" &&
        event.status === "succeeded",
    ),
  ).toBe(true);
  expect(
    events.some(
      (event) => event.type === "content.done" && event.text === "skill loaded",
    ),
  ).toBe(true);
});

test("two local clients serialize provider turns for one durable session", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-shared-session-"));
  const order: string[] = [];
  let releaseFirst: (() => void) | undefined;
  const provider = (label: string) => ({
    provider: "test",
    model: "test",
    async *stream() {
      order.push(`${label}:start`);
      if (label === "first")
        await new Promise<void>((resolve) => (releaseFirst = resolve));
      order.push(`${label}:end`);
      yield { type: "done" as const };
    },
  });
  const first = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_shared_session",
    provider: provider("first"),
  });
  const second = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_shared_session",
    provider: provider("second"),
  });
  first.start(() => undefined);
  second.start(() => undefined);
  const firstSubmit = first.submit("one");
  while (!releaseFirst) await Bun.sleep(1);
  const secondSubmit = second.submit("two");
  await Bun.sleep(2);
  expect(order).toEqual(["first:start"]);
  releaseFirst?.();
  await Promise.all([firstSubmit, secondSubmit]);
  expect(order).toEqual([
    "first:start",
    "first:end",
    "second:start",
    "second:end",
  ]);
});

test("real runtime client discovers and activates native Skills", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-skills-"));
  const skillRoot = join(root, ".natalia", "skills", "read-only");
  await mkdir(skillRoot, { recursive: true });
  await writeFile(
    join(skillRoot, "SKILL.md"),
    "---\nname: read-only\ndescription: Read files only\nallowed-tools: [read_file]\n---\nInspect before changing.",
  );
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_skills",
    provider: scriptedProvider("unused"),
  });
  client.start((event) => events.push(event));
  await waitFor(() => events.some((event) => event.type === "session.ready"));
  await client.submit("/skills");
  await client.submit("/skill read-only");
  expect(
    events.some(
      (event) =>
        event.type === "content.delta" &&
        event.text.includes("project:read-only"),
    ),
  ).toBe(true);
  expect(
    events.some(
      (event) =>
        event.type === "content.delta" &&
        event.text.includes("activated skill project:read-only"),
    ),
  ).toBe(true);
});

test("real runtime client provides provider-independent doctor and help commands", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-doctor-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_doctor",
    legacyConfigPath: join(root, "no-legacy-config.yaml"),
  });
  client.start((event) => events.push(event));
  await waitFor(() => events.some((event) => event.type === "session.ready"));
  await client.submit("/doctor");
  await client.submit("/help");

  const output = events
    .filter((event) => event.type === "content.delta")
    .map((event) => event.text)
    .join("\n");
  expect(output).toContain("Natalia TS7 runtime doctor");
  expect(output).toContain("provider: not configured");
  expect(output).toContain("/checkpoint");
});

test("real runtime client falls back to active legacy Go provider config without leaking key", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-legacy-provider-"));
  const configPath = join(root, "legacy-config.yaml");
  await writeFile(
    configPath,
    [
      "default_profile: default",
      "providers:",
      "  legacy:",
      "    base_url: https://legacy.example/v1",
      "    api_key: legacy-ts7-secret",
      "profiles:",
      "  default:",
      "    provider: legacy",
      "    model: legacy-model",
    ].join("\n"),
  );
  const events: RuntimeEvent[] = [];
  process.env.NATALIA_LEGACY_FALLBACK = "1";
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_legacy_provider",
    legacyConfigPath: configPath,
  });
  client.start((event) => events.push(event));
  await waitFor(() => events.some((event) => event.type === "session.ready"));
  await client.submit("/doctor");
  delete process.env.NATALIA_LEGACY_FALLBACK;

  const serialized = JSON.stringify(events);
  expect(serialized).toContain("legacy_go_config");
  expect(serialized).toContain("legacy/legacy-model");
  expect(serialized).not.toContain("legacy-ts7-secret");
});

test("real runtime client records provider usage checkpoints", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-usage-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_usage",
    provider: usageProvider(),
  });
  client.start((event) => events.push(event));
  await client.submit("Track usage");

  expect(
    events.some(
      (event) =>
        event.type === "context.status" &&
        event.used === 15 &&
        event.source === "exact_checkpoint",
    ),
  ).toBe(true);
});

test("real runtime client publishes provider chunks before stream completion", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-live-stream-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_live_stream",
    provider: delayedStreamingProvider(),
  });
  client.start((event) => events.push(event));
  const submission = client.submit("stream live");
  await waitFor(() =>
    events.some(
      (event) => event.type === "content.delta" && event.text === "first ",
    ),
  );
  expect(events.some((event) => event.type === "turn.finished")).toBe(false);
  await submission;
  expect(
    events
      .filter((event) => event.type === "content.delta")
      .map((event) => event.text)
      .join(""),
  ).toBe("first second");
});

test("real runtime client compacts once and retries on context-limit errors", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-context-limit-"));
  const events: RuntimeEvent[] = [];
  const provider = contextLimitThenSuccessProvider();
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_context_limit",
    provider,
  });
  client.start((event) => events.push(event));
  await client.submit("Recover context");

  expect(provider.calls).toBe(3);
  expect(
    events.some(
      (event) => event.type === "context.limit.recovery" && event.compacted,
    ),
  ).toBe(true);
  expect(
    events.some((event) => event.type === "compaction.end" && event.success),
  ).toBe(true);
  expect(
    events.some(
      (event) => event.type === "content.delta" && event.text === "recovered",
    ),
  ).toBe(true);
});

test("real runtime client writes inside its selected workspace after approval", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-workspace-tool-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_workspace_tool",
    provider: writeFileProvider(),
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "approval.request")
      client.respondApproval({ requestID: event.id, decision: "once" });
  });
  await client.submit("create a workspace file");

  expect(await readFile(join(root, "hello-ts7.txt"), "utf8")).toBe(
    "hello from TS7\n",
  );
  expect(
    events.some(
      (event) => event.type === "tool.update" && event.status === "succeeded",
    ),
  ).toBe(true);
});

test("durable session replay preserves tool-call pairs for the next provider turn", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-replay-tools-"));
  await writeFile(join(root, "input.txt"), "replay-ok\n");
  const initial = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_replay_tools",
    provider: toolCallingProvider(),
    permissionMode: "auto",
  });
  initial.start(() => {});
  await initial.submit("read the input");

  const requests: ProviderStreamRequest[] = [];
  const reopened = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_replay_tools",
    permissionMode: "auto",
    provider: {
      provider: "scripted-replay",
      model: "scripted-replay-model",
      async *stream(request) {
        requests.push(request);
        yield { type: "content", text: "replay continuation works" };
        yield { type: "done" };
      },
    },
  });
  reopened.start(() => {});
  await reopened.submit("continue");
  const restoredTool = requests[0]?.messages.find(
    (message) => message.role === "tool",
  );
  expect(restoredTool).toMatchObject({
    toolCallID: "call_read",
    content: "replay-ok\n",
  });
});

test("real runtime client routes ask_user tool calls through question response", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-question-tool-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_question_tool",
    provider: questionToolProvider(),
  });
  client.start((event) => {
    events.push(event);
    if (event.type === "question.request")
      client.respondQuestion({ requestID: event.id, answers: [["yes"]] });
  });
  await client.submit("ask a question");
  expect(events.some((event) => event.type === "question.request")).toBe(true);
  expect(
    events.some(
      (event) =>
        event.type === "content.delta" && event.text === "answer received",
    ),
  ).toBe(true);
});

test("real runtime client spawns and projects a TS/Bun subagent lifecycle", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-subagent-tool-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_subagent_tool",
    provider: subagentProvider(),
    permissionMode: "auto",
  });
  client.start((event) => events.push(event));
  await client.submit("delegate a focused task");
  await waitFor(() =>
    events.some(
      (event) =>
        event.type === "subagent.update" && event.status === "completed",
    ),
  );
  expect(
    events.some(
      (event) =>
        event.type === "subagent.update" &&
        event.text?.includes("child result"),
    ),
  ).toBe(true);
  expect(
    events.some(
      (event) =>
        event.type === "content.delta" && event.text === "parent complete",
    ),
  ).toBe(true);
  const lifecycle = events.filter(
    (event): event is Extract<RuntimeEvent, { type: "subagent.update" }> =>
      event.type === "subagent.update",
  );
  expect(
    lifecycle.every(
      (event) => event.parentSessionID === "ses_ts7_subagent_tool",
    ),
  ).toBe(true);
  expect(lifecycle.every((event) => event.continuation === 0)).toBe(true);
  const history = await client.history?.();
  expect(
    history?.events.some(
      (item) =>
        item.event.type === "subagent.update" &&
        item.event.parentSessionID === "ses_ts7_subagent_tool",
    ),
  ).toBe(true);
});

test("subagent executes TS native workspace tools before reporting completion", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-ts7-subagent-tools-"));
  const events: RuntimeEvent[] = [];
  const client = createRealRuntimeClient({
    workspaceRoot: root,
    sessionID: "ses_ts7_subagent_tools",
    provider: subagentToolProvider(),
    permissionMode: "auto",
  });
  client.start((event) => events.push(event));
  await client.submit("delegate a file task");
  await waitFor(() =>
    events.some(
      (event) =>
        event.type === "subagent.update" && event.status === "completed",
    ),
  );
  expect(await readFile(join(root, "agent-test.txt"), "utf8")).toBe(
    "agent test success",
  );
  expect(
    events.some(
      (event) =>
        event.type === "subagent.update" &&
        event.text?.includes("tool write_file"),
    ),
  ).toBe(true);
});

function scriptedProvider(text: string): StreamingProvider {
  return {
    provider: "scripted",
    model: "scripted-model",
    async *stream(_request: ProviderStreamRequest) {
      yield { type: "content", text };
      yield { type: "done" };
    },
  };
}

function usageProvider(): StreamingProvider {
  return {
    provider: "scripted-usage",
    model: "scripted-usage-model",
    async *stream(_request: ProviderStreamRequest) {
      yield { type: "content", text: "usage ok" };
      yield { type: "usage", inputTokens: 10, outputTokens: 5 };
      yield { type: "done" };
    },
  };
}

function contextLimitThenSuccessProvider(): StreamingProvider & {
  calls: number;
} {
  return {
    provider: "scripted-context-limit",
    model: "scripted-context-limit-model",
    calls: 0,
    async *stream(this: StreamingProvider & { calls: number }) {
      this.calls++;
      if (this.calls === 1)
        throw providerError({
          kind: "context_limit",
          message: "context length exceeded",
        });
      yield { type: "content", text: "recovered" };
      yield { type: "done" };
    },
  };
}

function toolCallingProvider(): StreamingProvider & {
  requests: ProviderStreamRequest[];
} {
  const requests: ProviderStreamRequest[] = [];
  return {
    provider: "scripted-tools",
    model: "scripted-tool-model",
    requests,
    async *stream(request: ProviderStreamRequest) {
      requests.push(request);
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_read",
              name: "read_file",
              arguments: JSON.stringify({ path: "input.txt" }),
            },
          ],
        };
        yield { type: "done" };
        return;
      }
      yield { type: "content", text: "tool said: tool data" };
      yield { type: "done" };
    },
  };
}

function writeFileProvider(): StreamingProvider {
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
              arguments: JSON.stringify({
                path: "hello-ts7.txt",
                content: "hello from TS7\n",
              }),
            },
          ],
        };
        yield { type: "done" };
        return;
      }
      yield { type: "content", text: "file created" };
      yield { type: "done" };
    },
  };
}

function approvalWriteProvider(): StreamingProvider {
  return {
    provider: "scripted-approval-write",
    model: "scripted-approval-write-model",
    async *stream(request: ProviderStreamRequest) {
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_approval_write",
              name: "write_file",
              arguments: JSON.stringify({
                path: "long-note.md",
                content: "long content ".repeat(100),
              }),
            },
          ],
        };
        yield { type: "done" };
        return;
      }
      yield { type: "content", text: "file created" };
      yield { type: "done" };
    },
  };
}

function questionToolProvider(): StreamingProvider {
  return {
    provider: "scripted-question",
    model: "scripted-question-model",
    async *stream(request: ProviderStreamRequest) {
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_question",
              name: "ask_user",
              arguments: JSON.stringify({
                question: "Continue?",
                options: ["yes", "no"],
              }),
            },
          ],
        };
        yield { type: "done" };
        return;
      }
      yield { type: "content", text: "answer received" };
      yield { type: "done" };
    },
  };
}

function delayedStreamingProvider(): StreamingProvider {
  return {
    provider: "scripted-delayed",
    model: "scripted-delayed-model",
    async *stream(_request: ProviderStreamRequest) {
      yield { type: "content", text: "first " };
      await Bun.sleep(80);
      yield { type: "content", text: "second" };
      yield { type: "done" };
    },
  };
}

function subagentProvider(): StreamingProvider {
  return {
    provider: "scripted-subagent",
    model: "scripted-subagent-model",
    async *stream(request: ProviderStreamRequest) {
      if (request.messages[0]?.role === "system") {
        yield { type: "content", text: "child result" };
        yield { type: "done" };
        return;
      }
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_subagent",
              name: "agent_spawn",
              arguments: JSON.stringify({ task: "child task" }),
            },
          ],
        };
        yield { type: "done" };
        return;
      }
      yield { type: "content", text: "parent complete" };
      yield { type: "done" };
    },
  };
}

function subagentToolProvider(): StreamingProvider {
  return {
    provider: "scripted-subagent-tools",
    model: "scripted-subagent-tools-model",
    async *stream(request: ProviderStreamRequest) {
      const isChild = request.messages.some(
        (message) => message.content === "child file task",
      );
      if (
        isChild &&
        !request.messages.some((message) => message.role === "tool")
      ) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_child_write",
              name: "write_file",
              arguments: JSON.stringify({
                path: "agent-test.txt",
                content: "agent test success",
              }),
            },
          ],
        };
        yield { type: "done" };
        return;
      }
      if (isChild) {
        yield { type: "content", text: "created agent-test.txt successfully" };
        yield { type: "done" };
        return;
      }
      if (!request.messages.some((message) => message.role === "tool")) {
        yield {
          type: "tool_call",
          calls: [
            {
              id: "call_subagent_tools",
              name: "agent_spawn",
              arguments: JSON.stringify({ task: "child file task" }),
            },
          ],
        };
        yield { type: "done" };
        return;
      }
      yield { type: "content", text: "parent complete" };
      yield { type: "done" };
    },
  };
}

async function waitFor(predicate: () => boolean) {
  for (let index = 0; index < 50; index++) {
    if (predicate()) return;
    await Bun.sleep(10);
  }
  throw new Error("timed out waiting for condition");
}
