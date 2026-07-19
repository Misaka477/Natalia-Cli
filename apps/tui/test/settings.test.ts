import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  defaultTuiPreferences,
  loadTuiPreferences,
  saveTuiPreferences,
  tuiPreferencePatch,
} from "../src/settings";
import { tuiConfigPath } from "../src/config";

test("TUI preferences persist atomically per workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tui-settings-"));
  try {
    expect(await loadTuiPreferences(root)).toEqual(defaultTuiPreferences);
    await saveTuiPreferences(root, {
      ...defaultTuiPreferences,
      toolDetails: "expanded",
      density: "compact",
      followBottom: false,
    });
    expect(await loadTuiPreferences(root)).toMatchObject({
      toolDetails: "expanded",
      density: "compact",
      followBottom: false,
      theme: "natalia-dark",
      prompt: { maxHeight: 8 },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("TUI preference patches preserve layered global and project values", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tui-layered-"));
  const home = await mkdtemp(join(tmpdir(), "natalia-tui-layered-home-"));
  const previousHome = process.env.HOME;
  process.env.HOME = home;
  try {
    const global = { ...defaultTuiPreferences, density: "compact" as const };
    const project = { ...global, followBottom: false };
    await saveTuiPreferences(
      root,
      tuiPreferencePatch(defaultTuiPreferences, global),
      "global",
    );
    await saveTuiPreferences(
      root,
      tuiPreferencePatch(global, project),
      "project",
    );

    expect(await loadTuiPreferences(root)).toMatchObject({
      density: "compact",
      followBottom: false,
    });
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test("TUI preferences write to the selected project or global scope", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tui-scope-"));
  const home = await mkdtemp(join(tmpdir(), "natalia-tui-home-"));
  const previousHome = process.env.HOME;
  process.env.HOME = home;
  try {
    const project = { ...defaultTuiPreferences, density: "compact" as const };
    const global = { ...defaultTuiPreferences, followBottom: false };
    await saveTuiPreferences(root, project, "project");
    await saveTuiPreferences(root, global, "global");

    expect(
      JSON.parse(await readFile(tuiConfigPath(root, "project"), "utf8")),
    ).toMatchObject({
      density: "compact",
    });
    expect(
      JSON.parse(await readFile(tuiConfigPath(root, "global"), "utf8")),
    ).toMatchObject({
      followBottom: false,
    });
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    await rm(root, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});
