import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateToolParameters } from "@natalia/tools";
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
