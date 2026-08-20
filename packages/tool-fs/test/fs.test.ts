import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRegistry } from "@natalia/plugin";
import { createToolRegistry, validateToolParameters } from "@natalia/tools";
import { createFsPlugin, FS_PLUGIN_ID, fsToolFamily, fileTools } from "../src";

test("the fs family describes the tools it ships", () => {
  const family = fsToolFamily();
  expect(family.id).toBe("fs");
  expect(family.scope).toBe("workspace");
  expect(family.tools).toEqual(fileTools);
  for (const tool of family.tools) expect(tool.name).toBeString();
});

test("the fs plugin owns its stable tools and unloads cleanly", async () => {
  const tools = createToolRegistry([]);
  const registry = createPluginRegistry({ tools });
  await registry.loadBuiltin(createFsPlugin());
  expect(registry.list()[0]).toMatchObject({
    id: FS_PLUGIN_ID,
    scope: "workspace",
  });
  for (const tool of fileTools) expect(tools.has(tool.name)).toBe(true);
  await registry.unload(FS_PLUGIN_ID);
  for (const tool of fileTools) expect(tools.has(tool.name)).toBe(false);
});

test("read_file and write_file round-trip inside the workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-fs-"));
  const tools = new Map(fsToolFamily().tools.map((tool) => [tool.name, tool]));
  await tools
    .get("write_file")!
    .execute({ path: "dir/note.txt", content: "hi" }, { workspaceRoot: root });
  expect(
    await tools
      .get("read_file")!
      .execute({ path: "dir/note.txt" }, { workspaceRoot: root }),
  ).toBe("hi");
  await expect(
    tools
      .get("read_file")!
      .execute({ path: "../escape" }, { workspaceRoot: root }),
  ).rejects.toThrow(/outside workspace|path/u);
});

test("read_file accepts offset and length for autonomous pagination", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-fs-page-"));
  await writeFile(join(root, "lines.txt"), "one\ntwo\nthree\nfour\nfive\n");
  const read = fsToolFamily().tools.find(
    (candidate) => candidate.name === "read_file",
  )!;

  expect(read.parameters.properties).toMatchObject({
    offset: { type: "integer", minimum: 1 },
    length: { type: "integer", minimum: 1 },
  });
  expect(
    validateToolParameters(read.parameters, {
      path: "lines.txt",
      offset: 2,
      length: 2,
    }),
  ).toEqual([]);
  expect(
    validateToolParameters(read.parameters, {
      path: "lines.txt",
      offset: 0,
    }),
  ).toEqual([{ path: "offset", message: "must be at least 1" }]);
  expect(
    await read.execute(
      { path: "lines.txt", offset: 2, length: 2 },
      { workspaceRoot: root },
    ),
  ).toBe("two\nthree\n\n... 2 more lines; use offset=4 length=2 ...");
  expect(
    await read.execute(
      { path: "lines.txt", offset: 4, length: 2 },
      { workspaceRoot: root },
    ),
  ).toBe("four\nfive");
  await expect(
    read.execute(
      { path: "lines.txt", offset: 0, length: 2 },
      { workspaceRoot: root },
    ),
  ).rejects.toThrow("offset must be a positive integer");
});

test("read_file projects a read card from its output definition", () => {
  const tool = fsToolFamily().tools.find(
    (candidate) => candidate.name === "read_file",
  )!;
  const intent = tool.output?.presentResult?.(
    { path: "src/index.ts" },
    "export const x = 1;",
  );
  expect(intent).toMatchObject({
    kind: "read",
    title: "src/index.ts",
    summary: expect.stringMatching(/chars/u) as string,
    body: "export const x = 1;",
  });
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
  const tools = new Map(fsToolFamily().tools.map((tool) => [tool.name, tool]));
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

test("read_media_file reports native metadata without injecting bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-fs-media-"));
  await writeFile(
    join(root, "image.png"),
    new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  );
  const tools = new Map(fsToolFamily().tools.map((tool) => [tool.name, tool]));
  expect(
    await tools
      .get("read_media_file")!
      .execute({ path: "image.png" }, { workspaceRoot: root }),
  ).toContain('"kind": "png"');
});
