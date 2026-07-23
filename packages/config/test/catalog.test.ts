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
import { configPatch, updateConfig, updateConfigAtScope } from "../src/service";

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
    const project = configV2Schema.parse(
      JSON.parse(
        await readFile(join(workspaceRoot, ".natalia", "config.json"), "utf8"),
      ),
    );
    const global = configV2Schema.parse(
      JSON.parse(
        await readFile(
          join(home, ".config", "natalia-cli", "config.json"),
          "utf8",
        ),
      ),
    );
    expect(project.runtime.maxStepsPerTurn).toBe(7);
    expect(global.context.compactionThresholdPercent).toBe(91);
    expect(project.context.compactionThresholdPercent).toBe(85);
    expect(global.runtime.maxStepsPerTurn).toBe(1000);
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
