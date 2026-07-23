import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configV2Schema } from "@natalia/contracts";
import {
  buildModelCatalog,
  configureDiscoveredProviderModel,
  discoverProviderModels,
} from "../src/catalog";
import {
  configPatch,
  resolveConfig,
  updateConfig,
  updateConfigAtScope,
} from "../src/service";

test("discovers models from configured provider URL and persists selected model", async () => {
  const requests: Array<{ path: string; authorization: string | null }> = [];
  const server = Bun.serve({
    port: 0,
    fetch(request) {
      requests.push({
        path: new URL(request.url).pathname,
        authorization: request.headers.get("authorization"),
      });
      return Response.json({
        data: [{ id: "model-b" }, { id: "model-a" }, { id: "model-a" }],
      });
    },
  });
  const workspaceRoot = await mkdtemp(
    join(tmpdir(), "natalia-provider-config-"),
  );

  try {
    const models = await discoverProviderModels(
      "openai-compatible",
      server.url.toString(),
      "secret-key",
    );
    expect(models).toEqual(["model-a", "model-b"]);
    expect(requests).toEqual([
      { path: "/v1/models", authorization: "Bearer secret-key" },
    ]);

    const configured = configureDiscoveredProviderModel(
      configV2Schema.parse({ version: 2 }),
      {
        providerID: "private-provider",
        providerType: "openai-compatible",
        apiKey: "secret-key",
        baseURL: server.url.toString(),
        modelID: "model-b",
        discoveredModels: models,
      },
    );
    await updateConfig(workspaceRoot, configured);

    const persisted = configV2Schema.parse(
      JSON.parse(
        await readFile(join(workspaceRoot, ".natalia", "config.json"), "utf8"),
      ),
    );
    expect(persisted.defaultModel).toBe("private-provider_model-b");
    expect(persisted.providers["private-provider"]?.baseURL).toBe(
      server.url.toString().replace(/\/+$/u, ""),
    );
    expect(persisted.models[persisted.defaultModel]?.model).toBe("model-b");
  } finally {
    server.stop(true);
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects a model that provider discovery did not return", () => {
  expect(() =>
    configureDiscoveredProviderModel(configV2Schema.parse({ version: 2 }), {
      providerID: "private-provider",
      providerType: "openai-compatible",
      apiKey: "secret-key",
      baseURL: "https://example.invalid",
      modelID: "invented-model",
      discoveredModels: ["real-model"],
    }),
  ).toThrow("Model was not returned by provider");
});

test("writes settings mutations to the requested config scope", async () => {
  const workspaceRoot = await mkdtemp(
    join(tmpdir(), "natalia-config-write-scope-"),
  );
  const home = await mkdtemp(join(tmpdir(), "natalia-config-write-home-"));
  const previousHome = process.env.HOME;
  process.env.HOME = home;
  try {
    await updateConfigAtScope(
      workspaceRoot,
      { runtime: { maxStepsPerTurn: 7 } },
      "project",
    );
    await updateConfigAtScope(
      workspaceRoot,
      { context: { compactionThresholdPercent: 91 } },
      "global",
    );
    const project = JSON.parse(
      await readFile(join(workspaceRoot, ".natalia", "config.json"), "utf8"),
    );
    const global = JSON.parse(
      await readFile(
        join(home, ".config", "natalia-cli", "config.json"),
        "utf8",
      ),
    );
    expect(project).toEqual({ runtime: { maxStepsPerTurn: 7 } });
    expect(global).toEqual({ context: { compactionThresholdPercent: 91 } });
    const resolved = await resolveConfig({ workspaceRoot });
    expect(resolved.config.runtime.maxStepsPerTurn).toBe(7);
    expect(resolved.config.context.compactionThresholdPercent).toBe(91);
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    await rm(workspaceRoot, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test("config patches preserve complete changed records and delete removed records", () => {
  const base = configV2Schema.parse({
    version: 2,
    providers: {
      retained: { type: "openai", apiKey: "base-key" },
      removed: { type: "openai", apiKey: "remove-key" },
    },
  });
  const next = configV2Schema.parse({
    ...base,
    providers: {
      retained: {
        ...base.providers.retained,
        baseURL: "https://example.invalid",
      },
    },
  });
  expect(configPatch(base, next)).toMatchObject({
    providers: {
      retained: {
        type: "openai",
        apiKey: "base-key",
        baseURL: "https://example.invalid",
      },
      removed: undefined,
    },
  });
});

test("settings arrays and browser fields persist as a minimal selected-scope patch", async () => {
  const workspaceRoot = await mkdtemp(
    join(tmpdir(), "natalia-config-settings-surface-"),
  );
  const home = await mkdtemp(join(tmpdir(), "natalia-config-settings-home-"));
  const previousHome = process.env.HOME;
  process.env.HOME = home;
  try {
    const base = (await resolveConfig({ workspaceRoot })).config;
    const next = configV2Schema.parse({
      ...base,
      instructions: {
        ...base.instructions,
        extraFiles: ["AGENTS.md", "docs/local.md"],
      },
      browser: {
        ...base.browser,
        binary: "/usr/bin/chromium",
        userAgent: "Natalia test agent",
        persistentProfile: true,
        profileDir: ".natalia/browser-profile",
        locale: "zh-CN",
        timezone: "Asia/Shanghai",
        headers: { "x-browser-test": "enabled" },
      },
      security: { ...base.security, envAllowlist: ["SAFE_TOKEN", "PATH"] },
      webSearch: {
        ...base.webSearch,
        endpoint: "https://search.example/v1",
        providerPriority: ["configured", "duckduckgo"],
      },
      network: {
        ...base.network,
        allowedHosts: ["example.com", "*.example.net"],
        allowedSchemes: ["https"],
      },
      mcpServers: {
        ...base.mcpServers,
        local: {
          type: "stdio",
          command: "mcp-server",
          args: ["--stdio", "--scope", "test"],
          cwd: "tools/mcp",
          headers: { "x-mcp-key": "test-only" },
          environment: { MCP_MODE: "test" },
          timeoutSec: 45,
          allowedTools: ["read"],
          excludedTools: ["write"],
          readOnly: true,
          enabled: true,
        },
      },
      skills: { urls: ["https://skills.example/index.json"] },
      plugins: {
        enabled: { formatter: true },
        paths: [".natalia/plugins-extra"],
        capabilities: { formatter: ["tools"] },
        readOnly: { formatter: true },
      },
      checkpoint: { ...base.checkpoint, additionalDirs: ["generated"] },
      workspace: {
        ...base.workspace,
        root: "worktree",
        additionalDirs: ["shared"],
      },
      permissionProfiles: {
        ...base.permissionProfiles,
        guarded: { approval: "read_only", description: "Safe inspection" },
      },
      modes: {
        ...base.modes,
        review: {
          description: "Review only",
          systemPrompt: "Inspect changes and report findings.",
          model: "review-model",
          permission: "guarded",
          allowedTools: ["read_file", "grep"],
          excludedTools: ["run_shell"],
          mcpServers: ["docs"],
        },
      },
    });
    await updateConfigAtScope(
      workspaceRoot,
      configPatch(base, next),
      "project",
    );

    const resolved = (await resolveConfig({ workspaceRoot })).config;
    expect(resolved.workspace.root).toBe("worktree");
    expect(resolved.instructions.extraFiles).toEqual([
      "AGENTS.md",
      "docs/local.md",
    ]);
    expect(resolved.browser).toMatchObject({
      binary: "/usr/bin/chromium",
      userAgent: "Natalia test agent",
      persistentProfile: true,
      profileDir: ".natalia/browser-profile",
      locale: "zh-CN",
      timezone: "Asia/Shanghai",
      headers: { "x-browser-test": "enabled" },
    });
    expect(resolved.network).toMatchObject({
      allowedHosts: ["example.com", "*.example.net"],
      allowedSchemes: ["https"],
    });
    expect(resolved.security.envAllowlist).toEqual(["SAFE_TOKEN", "PATH"]);
    expect(resolved.webSearch.endpoint).toBe("https://search.example/v1");
    expect(resolved.webSearch.providerPriority).toEqual([
      "configured",
      "duckduckgo",
    ]);
    expect(resolved.mcpServers.local).toMatchObject({
      args: ["--stdio", "--scope", "test"],
      cwd: "tools/mcp",
      headers: { "x-mcp-key": "test-only" },
      environment: { MCP_MODE: "test" },
      allowedTools: ["read"],
      excludedTools: ["write"],
    });
    expect(resolved.skills.urls).toEqual(["https://skills.example/index.json"]);
    expect(resolved.plugins).toMatchObject({
      enabled: { formatter: true },
      paths: [".natalia/plugins-extra"],
      capabilities: { formatter: ["tools"] },
      readOnly: { formatter: true },
    });
    expect(resolved.checkpoint.additionalDirs).toEqual(["generated"]);
    expect(resolved.workspace.additionalDirs).toEqual(["shared"]);
    expect(resolved.permissionProfiles.guarded).toEqual({
      approval: "read_only",
      description: "Safe inspection",
    });
    expect(resolved.modes.review).toMatchObject({
      systemPrompt: "Inspect changes and report findings.",
      model: "review-model",
      permission: "guarded",
      allowedTools: ["read_file", "grep"],
      excludedTools: ["run_shell"],
      mcpServers: ["docs"],
    });
    const patch = JSON.parse(
      await readFile(join(workspaceRoot, ".natalia", "config.json"), "utf8"),
    );
    expect(patch).toMatchObject({
      workspace: { root: "worktree" },
      instructions: { extraFiles: ["AGENTS.md", "docs/local.md"] },
      browser: { binary: "/usr/bin/chromium" },
      security: { envAllowlist: ["SAFE_TOKEN", "PATH"] },
      mcpServers: {
        local: expect.objectContaining({
          args: ["--stdio", "--scope", "test"],
          headers: { "x-mcp-key": "test-only" },
          environment: { MCP_MODE: "test" },
        }),
      },
    });
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    await rm(workspaceRoot, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test("catalog excludes providers denied by the configured policy", () => {
  const config = configV2Schema.parse({
    version: 2,
    providers: {
      approved: { type: "openai-compatible", apiKey: "approved-key" },
      blocked: { type: "openai-compatible", apiKey: "blocked-key" },
    },
    models: {
      approved_model: { provider: "approved", model: "approved-model" },
      blocked_model: { provider: "blocked", model: "blocked-model" },
    },
    experimental: {
      policies: [
        { effect: "deny", action: "provider.use", resource: "*" },
        { effect: "allow", action: "provider.use", resource: "approved" },
      ],
    },
  });
  expect(buildModelCatalog(config)).toEqual([
    {
      id: "approved",
      name: "approved",
      type: "openai-compatible",
      configured: true,
      models: [
        {
          id: "approved-model",
          provider: "approved",
          capabilities: {
            toolCall: true,
            reasoning: true,
            thinking: true,
            imageInput: false,
            pdfInput: false,
          },
        },
      ],
    },
  ]);
});

test("catalog filters disabled and policy-denied models while preserving capabilities", () => {
  const config = configV2Schema.parse({
    version: 2,
    providers: { local: { type: "openai-compatible", apiKey: "key" } },
    models: {
      capable: {
        provider: "local",
        model: "capable",
        capabilities: { toolCall: false, reasoning: false, thinking: false },
      },
      disabled: { provider: "local", model: "disabled", enabled: false },
    },
  });
  expect(buildModelCatalog(config)[0]?.models).toEqual([
    {
      id: "capable",
      provider: "local",
      capabilities: {
        toolCall: false,
        reasoning: false,
        thinking: false,
        imageInput: false,
        pdfInput: false,
      },
    },
  ]);
});
