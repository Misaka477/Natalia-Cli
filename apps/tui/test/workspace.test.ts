import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveTuiWorkspaceRoot } from "../src/workspace";

test("TUI resolves the nearest Git project root rather than its package directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tui-workspace-"));
  try {
    const tuiDir = join(root, "apps", "tui");
    await mkdir(join(root, ".git"));
    await mkdir(tuiDir, { recursive: true });
    expect(await resolveTuiWorkspaceRoot({ cwd: tuiDir })).toBe(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("TUI workspace override wins over Git discovery", async () => {
  expect(
    await resolveTuiWorkspaceRoot({
      cwd: "/ignored",
      override: "/tmp/natalia-explicit-workspace",
    }),
  ).toBe("/tmp/natalia-explicit-workspace");
});
