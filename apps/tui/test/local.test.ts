import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadLocalTuiState,
  saveLocalTuiState,
  trackModelUsage,
  sortModelOptions,
} from "../src/local";
import { buildModelOptions } from "../src/component/DialogModel";
import { configV2Schema } from "@natalia/contracts";

test("local TUI state persists model/session/MCP preferences", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-local-tui-"));
  try {
    const state = await loadLocalTuiState(root);
    state.pinnedSessions.push("ses_1");
    state.favoriteModels.push("step/flash");
    state.mcpEnabled.server = false;
    await saveLocalTuiState(root, state);
    expect(await loadLocalTuiState(root)).toMatchObject({
      pinnedSessions: ["ses_1"],
      favoriteModels: ["step/flash"],
      mcpEnabled: { server: false },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("trackModelUsage records model with dedup and recency", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-local-recent-"));
  try {
    await trackModelUsage(root, "gpt-4");
    await trackModelUsage(root, "claude-3");
    await trackModelUsage(root, "gpt-4");
    const state = await loadLocalTuiState(root);
    expect(state.recentModels).toEqual(["gpt-4", "claude-3"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("sortModelOptions places favorites then recents first", () => {
  const names = ["a", "b", "c", "d", "e"];
  expect(sortModelOptions(names, ["e", "c"], ["b"])).toEqual([
    "e",
    "c",
    "b",
    "a",
    "d",
  ]);
});

test("model selector groups valid favorites and recents without duplicates", () => {
  const config = configV2Schema.parse({
    version: 2,
    providers: {
      primary: { type: "openai", apiKey: "test", baseURL: "https://example.test/v1" },
    },
    models: {
      alpha: { provider: "primary", model: "alpha", contextWindow: "auto" },
      beta: { provider: "primary", model: "beta", contextWindow: "auto" },
      gamma: { provider: "primary", model: "gamma", contextWindow: "auto" },
    },
    defaultModel: "beta",
  });
  const options = buildModelOptions(config, {
    favoriteModels: ["beta", "missing"],
    recentModels: ["alpha", "beta"],
  });
  expect(options.map((option) => [option.value, option.category])).toEqual([
    ["beta", "Favorites"],
    ["alpha", "Recent"],
    ["gamma", "primary"],
  ]);
  expect(options[0]?.footer).toBe("default");
});
