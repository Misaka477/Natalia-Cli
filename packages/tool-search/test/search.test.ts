import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { searchToolFamily, searchTools } from "../src";

test("the search family describes the tools it ships", () => {
  const family = searchToolFamily();
  expect(family.id).toBe("search");
  expect(family.scope).toBe("workspace");
  expect(family.tools).toEqual(searchTools);
});

test("glob finds the files it should and nothing outside the workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-search-"));
  await writeFile(join(root, "a.ts"), "export const a = 1;\n");
  await writeFile(join(root, "b.js"), "const b = 2;\n");
  const tools = new Map(
    searchToolFamily().tools.map((tool) => [tool.name, tool]),
  );
  const listed = await tools
    .get("glob")!
    .execute({ pattern: "**/*.ts" }, { workspaceRoot: root });
  expect(listed).toContain("a.ts");
  expect(listed).not.toContain("b.js");
  await expect(
    tools.get("glob")!.execute({ pattern: "../**/*" }, { workspaceRoot: root }),
  ).rejects.toThrow(/must remain inside workspace/u);
});

test("grep matches a line with its path and number", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-search-"));
  await writeFile(join(root, "x.txt"), "first\nneedle here\nlast\n");
  const tools = new Map(
    searchToolFamily().tools.map((tool) => [tool.name, tool]),
  );
  const result = await tools
    .get("grep")!
    .execute({ pattern: "needle" }, { workspaceRoot: root });
  expect(result).toContain("x.txt:2:needle here");
});
