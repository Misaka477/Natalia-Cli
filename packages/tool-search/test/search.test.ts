import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRegistry } from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";
import {
  createSearchPlugin,
  SEARCH_PLUGIN_ID,
  searchToolFamily,
  searchTools,
} from "../src";

test("the search family describes the tools it ships", () => {
  const family = searchToolFamily();
  expect(family.id).toBe("search");
  expect(family.scope).toBe("workspace");
  expect(family.tools).toEqual(searchTools);
});

test("the search plugin owns its stable tools and unloads cleanly", async () => {
  const tools = createToolRegistry([]);
  const registry = createPluginRegistry({ tools });
  await registry.loadBuiltin(createSearchPlugin());
  expect(registry.list()[0]).toMatchObject({
    id: SEARCH_PLUGIN_ID,
    scope: "workspace",
  });
  for (const tool of searchTools) expect(tools.has(tool.name)).toBe(true);
  await registry.unload(SEARCH_PLUGIN_ID);
  for (const tool of searchTools) expect(tools.has(tool.name)).toBe(false);
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

test("glob and grep preflight every exposed or read workspace path", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-search-policy-"));
  await writeFile(join(root, "allowed.ts"), "const value = 'needle';\n");
  await writeFile(join(root, "protected.ts"), "const secret = 'needle';\n");
  const checks: Array<{ toolName: string; paths: string[] }> = [];
  const context = {
    workspaceRoot: root,
    workspaceReadAuthorize: async (input: {
      toolName: string;
      paths: string[];
    }) => {
      checks.push(input);
      if (input.paths.includes("protected.ts")) throw new Error("protected");
    },
  };
  const tools = new Map(
    searchToolFamily().tools.map((tool) => [tool.name, tool]),
  );
  await expect(
    tools.get("glob")!.execute({ pattern: "*.ts" }, context),
  ).rejects.toThrow("protected");
  await expect(
    tools.get("grep")!.execute({ pattern: "needle", include: "*.ts" }, context),
  ).rejects.toThrow("protected");
  expect(checks).toEqual([
    { toolName: "glob", paths: ["allowed.ts", "protected.ts"] },
    { toolName: "grep", paths: ["allowed.ts"] },
    { toolName: "grep", paths: ["protected.ts"] },
  ]);
});
