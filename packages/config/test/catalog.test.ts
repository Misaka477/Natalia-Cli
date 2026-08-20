import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configV3Schema, modelRefKey } from "@natalia/contracts";
import {
  buildModelCatalog,
  configureProviderModels,
  discoverProviderModels,
  resolveEffectiveModel,
} from "../src/catalog";
import {
  configPatch,
  resolveConfig,
  updateConfig,
  updateConfigAtScope,
} from "../src/service";

test("discovers models from configured provider URL and imports them in batch", async () => {
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
  const globalPath = join(workspaceRoot, "global.json");

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

    const configured = configureProviderModels(
      configV3Schema.parse({ version: 3 }),
      {
        providerID: "private-provider",
        providerName: "Private Gateway",
        driver: "openai-compatible",
        apiKey: "secret-key",
        baseURL: server.url.toString(),
        source: "discovery",
        modelIDs: models,
      },
    );
    await updateConfig(workspaceRoot, configured, { globalPath });

    const persisted = JSON.parse(await readFile(globalPath, "utf8"));
    expect(persisted.defaultModel).toEqual({
      provider: "private-provider",
      model: "model-a",
    });
    expect(persisted.providers["private-provider"]).toMatchObject({
      name: "Private Gateway",
      driver: "openai-compatible",
      connection: {
        baseURL: server.url.toString().replace(/\/+$/u, ""),
        apiKey: "secret-key",
      },
    });
    expect(
      persisted.catalog.providers["private-provider"]?.models,
    ).toMatchObject({
      "model-a": { source: "discovery" },
      "model-b": { source: "discovery" },
    });
  } finally {
    server.stop(true);
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("rejects a discovery import without credentials or model IDs", () => {
  expect(() =>
    configureProviderModels(configV3Schema.parse({ version: 3 }), {
      providerID: "private-provider",
      driver: "openai-compatible",
      source: "discovery",
      modelIDs: ["real-model"],
    }),
  ).toThrow("Provider API key is required for discovery");
  expect(() =>
    configureProviderModels(configV3Schema.parse({ version: 3 }), {
      providerID: "private-provider",
      driver: "openai-compatible",
      source: "manual",
      modelIDs: [],
    }),
  ).toThrow("At least one model ID is required");
});

test("manual import preserves existing overrides and an existing default model", () => {
  const base = configV3Schema.parse({
    version: 3,
    providers: {
      local: {
        name: "Local",
        driver: "openai-compatible",
        connection: { apiKey: "existing-key" },
      },
    },
    catalog: {
      providers: {
        local: {
          models: {
            m1: { name: "m1", source: "manual" },
          },
        },
      },
    },
    modelOverrides: {
      "local/m1": {
        enabled: true,
        requestDefaults: { temperature: 0.7, stream: false },
      },
    },
    defaultModel: { provider: "local", model: "m1" },
  });
  const next = configureProviderModels(base, {
    providerID: "local",
    providerName: "Renamed Gateway",
    driver: "openai-compatible",
    source: "manual",
    modelIDs: ["m1", "m2"],
  });
  // The user's override survives the re-import untouched.
  expect(next.modelOverrides["local/m1"]).toMatchObject({
    requestDefaults: { temperature: 0.7, stream: false },
  });
  expect(next.modelOverrides["local/m2"]).toBeUndefined();
  // The previous default stays; the provider name is user editable.
  expect(next.defaultModel).toEqual({ provider: "local", model: "m1" });
  expect(next.providers["local"]?.name).toBe("Renamed Gateway");
  // Existing catalog facts are preserved; new IDs are added with the source.
  expect(next.catalog.providers["local"]?.models["m1"]).toMatchObject({
    name: "m1",
    source: "manual",
  });
  expect(next.catalog.providers["local"]?.models["m2"]).toMatchObject({
    source: "manual",
    status: "stable",
  });
});

test("resolveEffectiveModel merges catalog facts, override and provider defaults", () => {
  const config = configV3Schema.parse({
    version: 3,
    providers: {
      local: {
        name: "Local",
        driver: "openai-compatible",
        connection: { apiKey: "key" },
        requestDefaults: {
          stream: false,
          headers: { "x-base": "1" },
          options: { baseOpt: 1 },
        },
      },
    },
    catalog: {
      providers: {
        local: {
          models: {
            m1: {
              name: "m1 name",
              capabilities: { thinking: false },
              limits: { maxOutputTokens: 2000 },
            },
          },
        },
      },
    },
    modelOverrides: {
      "local/m1": {
        requestDefaults: { temperature: 0.5, thinkingEnabled: false },
        requestOptions: { opt: 2 },
        headers: { "x-override": "2" },
      },
    },
  });
  const effective = resolveEffectiveModel(config, "local/m1");
  expect(effective).toMatchObject({
    name: "m1 name",
    capabilities: { thinking: false },
    limits: { maxOutputTokens: 2000 },
    requestDefaults: {
      temperature: 0.5,
      topP: null,
      // stream is not overridden, so the provider-level default wins.
      stream: false,
      thinkingEnabled: false,
      headers: { "x-base": "1", "x-override": "2" },
      options: { baseOpt: 1, opt: 2 },
    },
  });
  expect(modelRefKey(effective!.ref)).toBe("local/m1");
});

test("resolveEffectiveModel is undefined for an unknown provider or model", () => {
  const config = configV3Schema.parse({ version: 3 });
  expect(
    resolveEffectiveModel(config, { provider: "missing", model: "m" }),
  ).toBeUndefined();
  expect(
    resolveEffectiveModel(config, { provider: "p", model: "m" }),
  ).toBeUndefined();
});

test("NATALIA_MODEL makes a transient default model ref without mutating the catalog", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-env-model-"));
  try {
    const resolved = await resolveConfig({
      workspaceRoot,
      environment: { NATALIA_MODEL: "openai/gpt-test" },
    });
    expect(resolved.config.defaultModel).toEqual({
      provider: "openai",
      model: "gpt-test",
    });
    expect(resolved.config.catalog.providers.openai).toBeUndefined();
    expect(resolved.config.modelOverrides["openai/gpt-test"]).toBeUndefined();
    expect(resolved.sources).toContainEqual({
      scope: "environment",
      applied: true,
      diagnostic: "NATALIA_MODEL",
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("writes settings mutations to the requested config scope", async () => {
  const workspaceRoot = await mkdtemp(
    join(tmpdir(), "natalia-config-write-scope-"),
  );
  const home = await mkdtemp(join(tmpdir(), "natalia-config-write-home-"));
  const previousHome = process.env.HOME;
  const previousAppData = process.env.APPDATA;
  const previousUserProfile = process.env.USERPROFILE;
  // Global-scope resolution reads HOME on POSIX and APPDATA on Windows, so
  // the fixture points the platform's own variable at the temp home.
  process.env.HOME = home;
  if (process.platform === "win32") {
    process.env.APPDATA = home;
    process.env.USERPROFILE = home;
  }
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
    const globalConfigPath =
      process.platform === "win32"
        ? join(home, "natalia-cli", "config.json")
        : join(home, ".config", "natalia-cli", "config.json");
    const global = JSON.parse(await readFile(globalConfigPath, "utf8"));
    expect(project).toEqual({ runtime: { maxStepsPerTurn: 7 } });
    expect(global).toEqual({ context: { compactionThresholdPercent: 91 } });
    const resolved = await resolveConfig({ workspaceRoot });
    expect(resolved.config.runtime.maxStepsPerTurn).toBe(7);
    expect(resolved.config.context.compactionThresholdPercent).toBe(91);
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = previousAppData;
    if (previousUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previousUserProfile;
    await rm(workspaceRoot, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test("persists different context windows for individual provider models", async () => {
  const workspaceRoot = await mkdtemp(
    join(tmpdir(), "natalia-model-context-window-"),
  );
  const globalPath = join(workspaceRoot, "global.json");
  try {
    const base = configV3Schema.parse({
      version: 3,
      providers: {
        local: { name: "Local", driver: "openai-compatible" },
      },
      catalog: {
        providers: {
          local: {
            models: {
              small: { name: "Small" },
              large: { name: "Large" },
            },
          },
        },
      },
    });
    await updateConfigAtScope(
      workspaceRoot,
      { providers: base.providers, catalog: base.catalog },
      "global",
      { globalPath },
    );
    const next = structuredClone(base);
    next.catalog.providers.local!.models.small!.limits.contextWindow = 32768;
    next.catalog.providers.local!.models.large!.limits.contextWindow = 262144;
    await updateConfigAtScope(
      workspaceRoot,
      configPatch(base, next),
      "global",
      { globalPath },
    );

    const resolved = (
      await resolveConfig({ workspaceRoot, globalPath, environment: {} })
    ).config;
    expect(
      resolved.catalog.providers.local?.models.small?.limits.contextWindow,
    ).toBe(32768);
    expect(
      resolved.catalog.providers.local?.models.large?.limits.contextWindow,
    ).toBe(262144);
    expect(JSON.parse(await readFile(globalPath, "utf8"))).toMatchObject({
      catalog: {
        providers: {
          local: {
            models: {
              small: { limits: { contextWindow: 32768 } },
              large: { limits: { contextWindow: 262144 } },
            },
          },
        },
      },
    });
  } finally {
    await rm(workspaceRoot, { recursive: true, force: true });
  }
});

test("config patches preserve complete changed records and delete removed records", () => {
  const base = configV3Schema.parse({
    version: 3,
    providers: {
      retained: {
        name: "Retained",
        driver: "openai",
        connection: { apiKey: "base-key" },
      },
      removed: {
        name: "Removed",
        driver: "openai",
        connection: { apiKey: "remove-key" },
      },
    },
  });
  const next = configV3Schema.parse({
    ...base,
    providers: {
      retained: {
        ...base.providers.retained,
        connection: {
          ...base.providers.retained.connection,
          baseURL: "https://example.invalid",
        },
      },
    },
  });
  expect(configPatch(base, next)).toMatchObject({
    providers: {
      retained: {
        name: "Retained",
        driver: "openai",
        connection: {
          apiKey: "base-key",
          baseURL: "https://example.invalid",
        },
      },
      removed: undefined,
    },
  });
});

test("config patches delete removed plugin package records", () => {
  const base = configV3Schema.parse({
    version: 3,
    plugins: {
      packages: {
        "fixture.plugin": {
          source: { type: "registry", spec: "@fixture/plugin" },
          version: "1.0.0",
          scope: "workspace",
        },
      },
    },
  });
  const next = configV3Schema.parse({
    ...base,
    plugins: { ...base.plugins, packages: {} },
  });
  expect(configPatch(base, next)).toMatchObject({
    plugins: { packages: { "fixture.plugin": undefined } },
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
    const next = configV3Schema.parse({
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
        guarded: {
          approval: "read_only",
          description: "Safe inspection",
          permissions: { tools: { allow: ["read_file"] } },
          commandRules: {
            mode: "whitelist",
            rules: [{ command: "git diff", reason: "inspect changes" }],
          },
          extensions: { skills: false, mcp: false, plugins: false },
        },
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
      permissions: { tools: { allow: ["read_file"], exclude: [] } },
      commandRules: {
        mode: "whitelist",
        rules: [{ command: "git diff", reason: "inspect changes" }],
      },
      extensions: { skills: false, mcp: false, plugins: false },
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
  const config = configV3Schema.parse({
    version: 3,
    providers: {
      approved: {
        name: "Approved",
        driver: "openai-compatible",
        connection: { apiKey: "approved-key" },
      },
      blocked: {
        name: "Blocked",
        driver: "openai-compatible",
        connection: { apiKey: "blocked-key" },
      },
    },
    catalog: {
      providers: {
        approved: { models: { "approved-model": { name: "approved-model" } } },
        blocked: { models: { "blocked-model": { name: "blocked-model" } } },
      },
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
      name: "Approved",
      driver: "openai-compatible",
      configured: true,
      models: [
        {
          id: "approved-model",
          provider: "approved",
          name: "approved-model",
          capabilities: {
            toolCall: true,
            reasoning: true,
            thinking: true,
            imageInput: false,
            pdfInput: false,
            videoInput: false,
          },
          limits: { contextWindow: "auto" },
          status: "stable",
          source: "discovery",
        },
      ],
    },
  ]);
});

test("catalog filters disabled and policy-denied models while preserving capabilities", () => {
  const config = configV3Schema.parse({
    version: 3,
    providers: {
      local: {
        name: "Local",
        driver: "openai-compatible",
        connection: { apiKey: "key" },
      },
    },
    catalog: {
      providers: {
        local: {
          models: {
            capable: {
              name: "capable",
              capabilities: {
                toolCall: false,
                reasoning: false,
                thinking: false,
              },
            },
            disabled: { name: "disabled" },
            denied: { name: "denied" },
          },
        },
      },
    },
    modelOverrides: {
      "local/disabled": { enabled: false },
    },
    experimental: {
      policies: [
        { effect: "deny", action: "provider.use", resource: "local/denied" },
      ],
    },
  });
  const models = buildModelCatalog(config)[0]?.models;
  expect(models?.map((model) => model.id)).toEqual(["capable"]);
  expect(models?.[0]).toMatchObject({
    capabilities: {
      toolCall: false,
      reasoning: false,
      thinking: false,
      imageInput: false,
      pdfInput: false,
      videoInput: false,
    },
  });
});
