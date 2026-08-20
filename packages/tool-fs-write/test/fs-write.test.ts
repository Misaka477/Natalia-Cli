import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRegistry } from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";
import {
  createFsWritePlugin,
  FS_WRITE_PLUGIN_ID,
  fsWriteToolFamily,
  writeFileTools,
} from "../src";

test("the fs-write family describes the write tools it ships", () => {
  const family = fsWriteToolFamily();
  expect(family.id).toBe("fs-write");
  expect(family.scope).toBe("workspace");
  expect(family.tools).toEqual(writeFileTools);
  for (const tool of family.tools) {
    expect(tool.name).toBeString();
    expect(tool.requiresApproval).toBe(true);
  }
});

test("the fs-write plugin owns its tools and unloads cleanly", async () => {
  const tools = createToolRegistry([]);
  const registry = createPluginRegistry({ tools });
  await registry.loadBuiltin(createFsWritePlugin());
  expect(registry.list()[0]).toMatchObject({
    id: FS_WRITE_PLUGIN_ID,
    scope: "workspace",
  });
  for (const tool of writeFileTools) expect(tools.has(tool.name)).toBe(true);
  await registry.unload(FS_WRITE_PLUGIN_ID);
  for (const tool of writeFileTools) expect(tools.has(tool.name)).toBe(false);
});

test("write_file and edit_file go through the write lock", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-fs-write-"));
  const writes: Array<{ toolName: string; path: string }> = [];
  const context = {
    workspaceRoot: root,
    workspaceWriteAuthorize: async (input: {
      toolName: string;
      path: string;
    }) => {
      writes.push(input);
    },
  };
  const tools = new Map(
    fsWriteToolFamily().tools.map((tool) => [tool.name, tool]),
  );
  await tools
    .get("write_file")!
    .execute({ path: "example.txt", content: "hello" }, context);
  expect(
    await tools
      .get("edit_file")!
      .execute(
        { path: "example.txt", oldText: "hello", newText: "updated" },
        context,
      ),
  ).toBe("edited example.txt");
  const { readFile } = await import("node:fs/promises");
  expect(await readFile(join(root, "example.txt"), "utf8")).toBe("updated");
  expect(writes).toEqual([
    { toolName: "write_file", path: join(root, "example.txt") },
    { toolName: "edit_file", path: join(root, "example.txt") },
  ]);
});

test("apply_patch edits several files in one call and authorizes each path", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-fs-write-patch-"));
  await writeFile(join(root, "a.ts"), "const a = 1;\nconst b = 2;\n");
  await writeFile(join(root, "c.ts"), "const c = 3;\n");
  const writes: Array<{ toolName: string; path: string }> = [];
  const context = {
    workspaceRoot: root,
    workspaceWriteAuthorize: async (input: {
      toolName: string;
      path: string;
    }) => {
      writes.push(input);
    },
  };
  const tools = new Map(
    fsWriteToolFamily().tools.map((tool) => [tool.name, tool]),
  );
  const patch = [
    "--- a/a.ts",
    "+++ b/a.ts",
    "@@ -1,2 +1,2 @@",
    " const a = 1;",
    "-const b = 2;",
    "+const b = 20;",
    "--- a/c.ts",
    "+++ b/c.ts",
    "@@ -1,1 +1,1 @@",
    "-const c = 3;",
    "+const c = 30;",
  ].join("\n");
  const result = await tools.get("apply_patch")!.execute({ patch }, context);
  expect(result).toContain("2 files");
  expect(result).toContain("a.ts");
  expect(result).toContain("c.ts");
  const { readFile } = await import("node:fs/promises");
  expect(await readFile(join(root, "a.ts"), "utf8")).toBe(
    "const a = 1;\nconst b = 20;\n",
  );
  expect(await readFile(join(root, "c.ts"), "utf8")).toBe("const c = 30;\n");
  expect(writes).toEqual([
    { toolName: "apply_patch", path: join(root, "a.ts") },
    { toolName: "apply_patch", path: join(root, "c.ts") },
  ]);
});

test("apply_patch changes nothing when a hunk does not match", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-tool-fs-write-patch-fail-"),
  );
  await writeFile(join(root, "a.ts"), "const a = 1;\n");
  const tools = new Map(
    fsWriteToolFamily().tools.map((tool) => [tool.name, tool]),
  );
  const patch = [
    "--- a/a.ts",
    "+++ b/a.ts",
    "@@ -1,1 +1,1 @@",
    "-does not exist",
    "+replacement",
  ].join("\n");
  await expect(
    tools.get("apply_patch")!.execute({ patch }, { workspaceRoot: root }),
  ).rejects.toThrow(/did not match/u);
  const { readFile } = await import("node:fs/promises");
  expect(await readFile(join(root, "a.ts"), "utf8")).toBe("const a = 1;\n");
});

test("apply_patch creates a new file from a /dev/null diff", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-tool-fs-write-patch-new-"),
  );
  const tools = new Map(
    fsWriteToolFamily().tools.map((tool) => [tool.name, tool]),
  );
  const patch = [
    "--- /dev/null",
    "+++ b/notes.txt",
    "@@ -0,0 +1,1 @@",
    "+fresh",
  ].join("\n");
  const result = await tools
    .get("apply_patch")!
    .execute({ patch }, { workspaceRoot: root });
  expect(result).toContain("notes.txt");
  const { readFile } = await import("node:fs/promises");
  expect(await readFile(join(root, "notes.txt"), "utf8")).toBe("fresh\n");
});
