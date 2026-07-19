import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfigFile, saveConfigFile } from "../src/file";
import { migrateConfig, migrationSummaryText } from "../src/migration";
import {
  diagnoseLegacyGoWorkspace,
  exportLegacyGoWorkspaceBundle,
  importLegacyGoWorkspaceBundle,
  rollbackLegacyGoWorkspaceBundle,
  VersionedMigrationRegistry,
} from "../src/registry";
import { loadOrCreateConfigFile } from "../src/file";
import { resolveConfig } from "../src/service";
import { createSetupSnapshot } from "../src/setup";

test("config v2 migration keeps zero/null/omitted semantics and new defaults", () => {
  const migrated = migrateConfig({
    providers: { openai: { type: "openai", api_key: "secret-token" } },
    default_profile: "default",
    profiles: {
      default: {
        provider: "openai",
        model: "gpt-5.5",
        max_context: 200000,
        max_tokens: 0,
        max_steps: 0,
        timeout_sec: 0,
      },
    },
  });
  const model = migrated.config.models.default;
  expect(model.contextWindow).toBe(200000);
  expect(model.maxOutputTokens).toBeNull();
  expect(migrated.config.runtime.maxStepsPerTurn).toBe(1000);
  expect(migrated.config.runtime.timeouts.requestSec).toBe(120);
  expect(migrated.config.context.compactionEnabled).toBe(true);
  expect(migrated.config.context.compactionThresholdPercent).toBe(85);
  expect(migrated.config.context.reservedOutputTokens).toBe("auto");
  expect(migrated.config.checkpoint.enabled).toBe(true);
  expect(migrated.config.checkpoint.additionalDirs).toEqual([]);
});

test("migration summary redacts secrets and preserves explicit 8192", () => {
  const migrated = migrateConfig({
    providers: { openai: { type: "openai", api_key: "sk-live-secret" } },
    profiles: { default: { provider: "openai", model: "x", max_tokens: 8192 } },
  });
  expect(migrated.config.models.default.maxOutputTokens).toBe(8192);
  const text = migrationSummaryText(migrated.summary);
  expect(text).not.toContain("sk-live-secret");
  expect(text).toContain("8192 preserved");
});

test("setup snapshot exposes detection source and manual override", () => {
  const migrated = migrateConfig({
    profiles: { default: { provider: "openai", model: "gpt-5.5" } },
  });
  const snapshot = createSetupSnapshot(migrated.config, "default", {
    tokens: 200000,
    source: "known_catalog",
    confidence: "medium",
    diagnostic: "catalog",
  });
  expect(snapshot.contextWindow.manualOverrideAllowed).toBe(true);
  expect(snapshot.contextWindow.source).toBe("known_catalog");
  expect(snapshot.outputLimit.semantics).toBe("omitted");
  expect(snapshot.secretFields).toContain("providers.*.apiKey");
});

test("config v2 save/load roundtrip preserves omitted output limit", async () => {
  const dir = await mkdtemp(join(tmpdir(), "natalia-config-v2-"));
  try {
    const path = join(dir, "config.yaml");
    const config = migrateConfig({
      profiles: { default: { provider: "openai", model: "gpt-5.5" } },
    }).config;
    await saveConfigFile(config, path);
    const loaded = await loadConfigFile(path);
    expect(loaded.config.version).toBe(2);
    expect(loaded.config.models.default.maxOutputTokens).toBeNull();
    expect(loaded.summary.changed).toEqual([]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("versioned migration registry applies steps and reports unsupported versions", async () => {
  const registry = new VersionedMigrationRegistry<{
    version: number;
    value: string;
  }>(2);
  registry.register({
    id: "legacy-to-v1",
    fromVersion: "legacy",
    toVersion: 1,
    apply: (input) => ({ ...input, version: 1, value: `${input.value}:v1` }),
  });
  registry.register({
    id: "v1-to-v2",
    fromVersion: 1,
    toVersion: 2,
    apply: (input) => ({ ...input, version: 2, value: `${input.value}:v2` }),
  });

  const migrated = await registry.migrate({
    fromVersion: "legacy",
    value: { version: 0, value: "start" },
  });
  expect(migrated.applied).toEqual(["legacy-to-v1", "v1-to-v2"]);
  expect(migrated.value).toEqual({ version: 2, value: "start:v1:v2" });

  const unsupported = await registry.migrate({
    fromVersion: 99,
    value: { version: 99, value: "old" },
  });
  expect(unsupported.diagnostics[0]).toMatchObject({
    code: "migration.unsupported_version",
    supported: false,
  });
});

test("legacy Go workspace diagnostics and migration bundle are explicit", async () => {
  const dir = await mkdtemp(join(tmpdir(), "natalia-legacy-diagnostics-"));
  try {
    await writeFile(join(dir, "config.yaml"), "profiles: {}\n");
    await mkdir(join(dir, "sessions"));
    await mkdir(join(dir, "checkpoints"));
    await mkdir(join(dir, "skills"));
    await mkdir(join(dir, "workflows"));
    const diagnostics = await diagnoseLegacyGoWorkspace(dir);
    expect(
      diagnostics.some(
        (item) => item.code === "legacy.config_yaml" && item.supported,
      ),
    ).toBe(true);
    expect(
      diagnostics.some(
        (item) => item.code === "legacy.checkpoints_manifest" && item.supported,
      ),
    ).toBe(true);
    expect(
      diagnostics.some(
        (item) => item.code === "legacy.workflows_bundle" && item.supported,
      ),
    ).toBe(true);
    const bundle = await exportLegacyGoWorkspaceBundle({
      legacyRoot: dir,
      outputPath: join(dir, "bundle", "legacy.json"),
    });
    expect(bundle.format).toBe("natalia-ts7-legacy-workspace-bundle");
    expect(bundle.artifacts.some((item) => item.path === "config.yaml")).toBe(
      true,
    );
    const targetRoot = join(dir, "ts-target");
    const imported = await importLegacyGoWorkspaceBundle({
      bundlePath: join(dir, "bundle", "legacy.json"),
      targetRoot,
    });
    expect(imported).toMatchObject({ artifactCount: expect.any(Number) });
    expect(imported.receipt.id).toMatch(/^mig_/u);
    expect(
      await readFile(
        join(targetRoot, ".natalia", "migration-receipt.json"),
        "utf8",
      ),
    ).toContain(imported.receipt.id);
    expect(
      await importLegacyGoWorkspaceBundle({
        bundlePath: join(dir, "bundle", "legacy.json"),
        targetRoot,
      }),
    ).toMatchObject({
      alreadyApplied: true,
      receipt: { id: imported.receipt.id },
    });
    expect(await rollbackLegacyGoWorkspaceBundle({ targetRoot })).toMatchObject(
      {
        rolledBack: true,
        receiptID: imported.receipt.id,
      },
    );
    expect(await rollbackLegacyGoWorkspaceBundle({ targetRoot })).toMatchObject(
      {
        rolledBack: false,
      },
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("TS config settings store creates a schema-valid config when absent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "natalia-config-create-"));
  try {
    const result = await loadOrCreateConfigFile(join(dir, "config.json"));
    expect(result.config.version).toBe(2);
    expect(result.config.defaultModel).toBe("");
    expect(result.summary.changed).toContain("created default TS config");
    expect(await readFile(join(dir, "config.json"), "utf8")).toContain(
      '"version": 2',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("layered config preserves defaults and gives project precedence", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-config-layered-"));
  const globalPath = join(root, "global.json");
  const projectPath = join(root, ".natalia", "config.json");
  try {
    await mkdir(join(root, ".natalia"), { recursive: true });
    await writeFile(
      globalPath,
      JSON.stringify({
        version: 2,
        models: {
          default: { provider: "openai", model: "global-model" },
        },
      }),
    );
    await writeFile(
      projectPath,
      JSON.stringify({
        version: 2,
        models: {
          default: { provider: "openai", model: "project-model" },
        },
        context: { compactionThresholdPercent: 90 },
      }),
    );
    const resolved = await resolveConfig({ workspaceRoot: root, globalPath });
    expect(resolved.config.models.default.model).toBe("project-model");
    expect(resolved.config.context.compactionEnabled).toBe(true);
    expect(resolved.config.context.compactionThresholdPercent).toBe(90);
    expect(resolved.sources.filter((source) => source.applied)).toHaveLength(3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
