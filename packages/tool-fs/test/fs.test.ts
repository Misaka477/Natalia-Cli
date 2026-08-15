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

test("read_file projects a read card from its output definition", () => {
  const tool = fsToolFamily().tools.find(
    (candidate) => candidate.name === "read_file",
  )!;
  const intent = tool.output?.render(
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
