import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  resolveTuiWorkspaceRoot,
  resolveWorkspaceInput,
  validateWorkspaceInput,
} from "../src/workspace";

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
  // An explicit override is used as given; `/tmp/...` is POSIX-shaped, so the
  // fixture spells the absolute path the host platform actually understands.
  const override =
    process.platform === "win32"
      ? join(tmpdir(), "natalia-explicit-workspace")
      : "/tmp/natalia-explicit-workspace";
  expect(await resolveTuiWorkspaceRoot({ cwd: "/ignored", override })).toBe(
    override,
  );
});

test("workspace input resolves relative paths from the current workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tui-switch-"));
  const sibling = join(root, "sibling");
  await mkdir(sibling);
  try {
    expect(resolveWorkspaceInput("../sibling", join(root, "current"))).toBe(
      sibling,
    );
    expect(validateWorkspaceInput("../sibling", join(root, "current"))).toBe(
      undefined,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("workspace input rejects missing paths and files", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tui-switch-"));
  const file = join(root, "not-a-directory");
  await Bun.write(file, "fixture");
  try {
    expect(validateWorkspaceInput("missing", root)).toBe(
      "Workspace directory does not exist",
    );
    expect(validateWorkspaceInput(file, root)).toBe(
      "Workspace path must be a directory",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
