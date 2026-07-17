import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfigFile, saveConfigFile } from "../src/file";
import { migrateConfig, migrationSummaryText } from "../src/migration";
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
