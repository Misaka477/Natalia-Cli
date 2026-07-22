import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  addPromptStash,
  loadLocalTuiState,
  MAX_PROMPT_STASH_BYTES,
  removePromptStash,
  saveLocalTuiState,
  trackModelUsage,
  sortModelOptions,
  selectActiveAgent,
} from "../src/local";
import {
  buildModelOptions,
  unavailableModelSummary,
} from "../src/component/DialogModel";
import { configV2Schema } from "@natalia/contracts";

test("local TUI state persists model/session/MCP preferences", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-local-tui-"));
  try {
    const state = await loadLocalTuiState(root);
    state.pinnedSessions.push("ses_1");
    state.favoriteModels.push("step/flash");
    state.mcpEnabled.server = false;
    state.promptStash.push({ input: "resume release notes", timestamp: 1 });
    await saveLocalTuiState(root, state);
    expect(await loadLocalTuiState(root)).toMatchObject({
      pinnedSessions: ["ses_1"],
      favoriteModels: ["step/flash"],
      mcpEnabled: { server: false },
      promptStash: [{ input: "resume release notes", timestamp: 1 }],
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("prompt stash trims, bounds, and removes workspace-local drafts", () => {
  const entries = addPromptStash([], "first\n");
  expect(entries).toHaveLength(1);
  expect(entries[0]?.input).toBe("first");
  expect(addPromptStash(entries, "x".repeat(MAX_PROMPT_STASH_BYTES + 1))).toBe(
    entries,
  );
  expect(removePromptStash(entries, 0)).toEqual([]);
});

test("prompt stash keeps only the newest bounded entries", () => {
  const entries = Array.from({ length: 51 }, (_, index) => index).reduce(
    (stash, index) => addPromptStash(stash, `draft ${index}`, index),
    [] as ReturnType<typeof addPromptStash>,
  );
  expect(entries).toHaveLength(50);
  expect(entries[0]?.input).toBe("draft 1");
});

test("model selector excludes unavailable policy and credential configurations", () => {
  const config = configV2Schema.parse({
    version: 2,
    providers: {
      usable: { type: "openai", apiKey: "test" },
      missing: { type: "openai" },
    },
    models: {
      valid: { provider: "usable", model: "valid" },
      disabled: { provider: "usable", model: "disabled", enabled: false },
      unavailable: { provider: "missing", model: "unavailable" },
    },
  });
  expect(
    buildModelOptions(config, { favoriteModels: [], recentModels: [] }).map(
      (option) => option.value,
    ),
  ).toEqual(["valid"]);
  expect(unavailableModelSummary(config)).toContain("disabled: model_disabled");
  expect(unavailableModelSummary(config)).toContain(
    "unavailable: provider_credentials_unavailable",
  );
});

test("local TUI state persists the selected agent per workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-local-agent-"));
  try {
    await selectActiveAgent(root, "reviewer");
    expect((await loadLocalTuiState(root)).activeAgent).toBe("reviewer");
    await selectActiveAgent(root);
    expect((await loadLocalTuiState(root)).activeAgent).toBeUndefined();
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
      primary: {
        type: "openai",
        apiKey: "test",
        baseURL: "https://example.test/v1",
      },
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
