import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fsToolFamily, fileTools } from "../src";

test("the fs family describes the tools it ships", () => {
  const family = fsToolFamily();
  expect(family.id).toBe("fs");
  expect(family.scope).toBe("workspace");
  expect(family.tools).toEqual(fileTools);
  for (const tool of family.tools) expect(tool.name).toBeString();
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
