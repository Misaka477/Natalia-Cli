import { expect, test } from "bun:test";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findWorkspaceFiles,
  globWorkspaceFiles,
  invalidateWorkspaceFiles,
  listWorkspaceFiles,
  readWorkspaceFile,
  searchWorkspaceFiles,
  watchWorkspaceFiles,
} from "../src/workspace-files";

test("workspace files stay contained and exclude internal directories", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workspace-files-"));
  const outside = await mkdtemp(
    join(tmpdir(), "natalia-workspace-files-outside-"),
  );
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "node_modules", "pkg"), { recursive: true });
  await writeFile(join(root, "src", "model.ts"), "export {}\n");
  await writeFile(join(root, "node_modules", "pkg", "hidden.ts"), "hidden\n");
  await writeFile(join(outside, "secret.ts"), "secret\n");
  await symlink(outside, join(root, "outside"));
  expect(
    await findWorkspaceFiles({ workspaceRoot: root, query: "mod" }),
  ).toEqual([{ path: "src/model.ts", type: "file" }]);
  expect(await findWorkspaceFiles({ workspaceRoot: root })).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        path: expect.stringContaining("node_modules"),
      }),
      expect.objectContaining({ path: expect.stringContaining("outside") }),
    ]),
  );
});

test("workspace file catalog avoids repeated scans until invalidated", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workspace-files-cache-"));
  await writeFile(join(root, "first.ts"), "export {}\n");
  expect(await findWorkspaceFiles({ workspaceRoot: root })).toEqual([
    { path: "first.ts", type: "file" },
  ]);
  await writeFile(join(root, "second.ts"), "export {}\n");
  expect(await findWorkspaceFiles({ workspaceRoot: root })).toEqual([
    { path: "first.ts", type: "file" },
  ]);
  invalidateWorkspaceFiles(root);
  expect(await findWorkspaceFiles({ workspaceRoot: root })).toEqual([
    { path: "first.ts", type: "file" },
    { path: "second.ts", type: "file" },
  ]);
});

test("workspace file catalog ranks non-contiguous fuzzy matches", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workspace-fuzzy-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "component-model.ts"), "export {}\n");
  await writeFile(join(root, "src", "command-menu.ts"), "export {}\n");
  await writeFile(join(root, "src", "model.ts"), "export {}\n");
  expect(
    await findWorkspaceFiles({ workspaceRoot: root, query: "cmt" }),
  ).toEqual([
    { path: "src/command-menu.ts", type: "file" },
    { path: "src/component-model.ts", type: "file" },
    { path: "src/model.ts", type: "file" },
  ]);
});

test("workspace file catalog filters fuzzy results by entry type", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workspace-find-type-"));
  await mkdir(join(root, "src", "models"), { recursive: true });
  await writeFile(join(root, "src", "model.ts"), "export {}\n");
  expect(
    await findWorkspaceFiles({
      workspaceRoot: root,
      query: "mod",
      type: "directory",
    }),
  ).toEqual([{ path: "src/models/", type: "directory" }]);
  expect(
    await findWorkspaceFiles({
      workspaceRoot: root,
      query: "mod",
      type: "file",
    }),
  ).toEqual([{ path: "src/model.ts", type: "file" }]);
});

test("workspace content search is text-only and line-aware", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workspace-search-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "match.ts"), "first\nneedle here\n");
  await writeFile(join(root, "src", "binary.bin"), "needle\0hidden");
  expect(
    await searchWorkspaceFiles({
      workspaceRoot: root,
      query: "needle",
      include: "*.ts",
    }),
  ).toEqual([{ path: "src/match.ts", line: 2, text: "needle here" }]);
  await expect(
    searchWorkspaceFiles({ workspaceRoot: root, query: "" }),
  ).rejects.toThrow("workspace search query is required");
});

test("workspace list, read, and glob retain containment and ignore policy", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workspace-api-"));
  await mkdir(join(root, "src"), { recursive: true });
  await mkdir(join(root, "node_modules", "pkg"), { recursive: true });
  await writeFile(join(root, "src", "model.ts"), "export const value = 1\n");
  await writeFile(join(root, "src", "data.bin"), "\0binary");
  await writeFile(join(root, "node_modules", "pkg", "hidden.ts"), "hidden\n");
  expect(await listWorkspaceFiles({ workspaceRoot: root })).toEqual({
    entries: [{ path: "src/", type: "directory" }],
    truncated: false,
  });
  expect(
    await globWorkspaceFiles({ workspaceRoot: root, pattern: "**/*.ts" }),
  ).toEqual([{ path: "src/model.ts", type: "file" }]);
  expect(
    await readWorkspaceFile({ workspaceRoot: root, path: "src/model.ts" }),
  ).toMatchObject({
    path: "src/model.ts",
    content: "export const value = 1\n",
    encoding: "utf8",
    mime: "text/typescript",
  });
  expect(
    await readWorkspaceFile({ workspaceRoot: root, path: "src/data.bin" }),
  ).toMatchObject({
    encoding: "base64",
  });
  await expect(
    listWorkspaceFiles({ workspaceRoot: root, path: "node_modules" }),
  ).rejects.toThrow("workspace path is ignored by filesystem policy");
  await expect(
    readWorkspaceFile({ workspaceRoot: root, path: "../outside" }),
  ).rejects.toThrow("workspace path must remain inside workspace");
});

test("workspace text reads paginate by line offset and byte budget", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workspace-read-page-"));
  await writeFile(
    join(root, "large.txt"),
    Array.from({ length: 2_005 }, (_, index) => `line-${index + 1}`).join("\n"),
  );
  const first = await readWorkspaceFile({
    workspaceRoot: root,
    path: "large.txt",
    limit: 2_000,
  });
  expect(first).toMatchObject({
    encoding: "utf8",
    offset: 1,
    truncated: true,
    next: 2_001,
  });
  expect(first.content.split("\n")).toHaveLength(2_000);
  const second = await readWorkspaceFile({
    workspaceRoot: root,
    path: "large.txt",
    offset: first.next,
  });
  expect(second).toMatchObject({
    content: "line-2001\nline-2002\nline-2003\nline-2004\nline-2005",
    offset: 2_001,
    truncated: false,
  });
  await expect(
    readWorkspaceFile({
      workspaceRoot: root,
      path: "large.txt",
      offset: 3_000,
    }),
  ).rejects.toThrow("workspace read offset is out of range");
});

test("workspace reads recognized images as bounded base64 media", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workspace-media-"));
  const png = Buffer.from("89504e470d0a1a0a00000000", "hex");
  const webp = Buffer.from("524946460000000057454250", "hex");
  await writeFile(join(root, "image.dat"), png);
  await writeFile(join(root, "image.webp"), webp);
  expect(
    await readWorkspaceFile({ workspaceRoot: root, path: "image.dat" }),
  ).toEqual({
    path: "image.dat",
    content: png.toString("base64"),
    encoding: "base64",
    mime: "image/png",
  });
  expect(
    await readWorkspaceFile({ workspaceRoot: root, path: "image.webp" }),
  ).toMatchObject({ encoding: "base64", mime: "image/webp" });
});

test("workspace directory lists use stable direct-child pagination", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workspace-list-page-"));
  await mkdir(join(root, "alpha"), { recursive: true });
  await mkdir(join(root, "beta"), { recursive: true });
  await writeFile(join(root, "a.txt"), "a\n");
  await writeFile(join(root, "b.txt"), "b\n");
  await writeFile(join(root, "alpha", "nested.txt"), "nested\n");
  expect(await listWorkspaceFiles({ workspaceRoot: root, limit: 2 })).toEqual({
    entries: [
      { path: "alpha/", type: "directory" },
      { path: "beta/", type: "directory" },
    ],
    truncated: true,
    next: 3,
  });
  expect(
    await listWorkspaceFiles({ workspaceRoot: root, offset: 3, limit: 2 }),
  ).toEqual({
    entries: [
      { path: "a.txt", type: "file" },
      { path: "b.txt", type: "file" },
    ],
    truncated: false,
  });
});

test("workspace filesystem APIs honor root and nested gitignore rules", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workspace-gitignore-"));
  await mkdir(join(root, "src", "generated"), { recursive: true });
  await mkdir(join(root, "nested"), { recursive: true });
  await mkdir(join(root, "keep"), { recursive: true });
  await writeFile(
    join(root, ".gitignore"),
    [
      "*.secret",
      "/root-only.txt",
      "generated/",
      "keep/*",
      "!keep/visible.txt",
    ].join("\n"),
  );
  await writeFile(join(root, "visible.ts"), "visible\n");
  await writeFile(join(root, "root-only.txt"), "hidden\n");
  await mkdir(join(root, "nested", "root-only.txt"));
  await writeFile(
    join(root, "nested", "root-only.txt", "visible.ts"),
    "visible\n",
  );
  await writeFile(join(root, "visible.secret"), "hidden\n");
  await writeFile(join(root, "src", "generated", "code.ts"), "hidden\n");
  await writeFile(join(root, "nested", ".gitignore"), "private/\n");
  await mkdir(join(root, "nested", "private"));
  await writeFile(join(root, "nested", "private", "hidden.ts"), "hidden\n");
  await writeFile(join(root, "keep", "hidden.txt"), "hidden\n");
  await writeFile(join(root, "keep", "visible.txt"), "visible\n");

  expect(await findWorkspaceFiles({ workspaceRoot: root, limit: 200 })).toEqual(
    expect.arrayContaining([
      { path: ".gitignore", type: "file" },
      { path: "visible.ts", type: "file" },
      { path: "nested/", type: "directory" },
      { path: "nested/root-only.txt/", type: "directory" },
      { path: "nested/root-only.txt/visible.ts", type: "file" },
      { path: "keep/", type: "directory" },
      { path: "keep/visible.txt", type: "file" },
    ]),
  );
  expect(
    await findWorkspaceFiles({ workspaceRoot: root, limit: 200 }),
  ).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: "root-only.txt" }),
      expect.objectContaining({ path: "visible.secret" }),
      expect.objectContaining({ path: "src/generated/code.ts" }),
      expect.objectContaining({ path: "nested/private/hidden.ts" }),
      expect.objectContaining({ path: "keep/hidden.txt" }),
    ]),
  );
  expect(
    await globWorkspaceFiles({ workspaceRoot: root, pattern: "**/*.ts" }),
  ).toEqual([
    { path: "nested/root-only.txt/visible.ts", type: "file" },
    { path: "visible.ts", type: "file" },
  ]);
  expect(
    await searchWorkspaceFiles({ workspaceRoot: root, query: "visible" }),
  ).toEqual([
    { path: ".gitignore", line: 5, text: "!keep/visible.txt" },
    { path: "visible.ts", line: 1, text: "visible" },
    { path: "keep/visible.txt", line: 1, text: "visible" },
    {
      path: "nested/root-only.txt/visible.ts",
      line: 1,
      text: "visible",
    },
  ]);
  await expect(
    readWorkspaceFile({ workspaceRoot: root, path: "root-only.txt" }),
  ).rejects.toThrow("workspace path is ignored by filesystem policy");
  await expect(
    listWorkspaceFiles({ workspaceRoot: root, path: "nested/private" }),
  ).rejects.toThrow("workspace path is ignored by filesystem policy");
});

test("workspace gitignore changes apply after catalog invalidation", async () => {
  const root = await mkdtemp(
    join(tmpdir(), "natalia-workspace-gitignore-cache-"),
  );
  await writeFile(join(root, "artifact.log"), "first\n");
  await writeFile(join(root, ".gitignore"), "*.log\n");
  expect(await findWorkspaceFiles({ workspaceRoot: root })).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ path: "artifact.log" })]),
  );
  await writeFile(join(root, ".gitignore"), "");
  invalidateWorkspaceFiles(root);
  expect(await findWorkspaceFiles({ workspaceRoot: root })).toEqual(
    expect.arrayContaining([{ path: "artifact.log", type: "file" }]),
  );
});

test("workspace catalog ignores symlink cycles", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workspace-cycle-"));
  await mkdir(join(root, "src", "nested"), { recursive: true });
  await writeFile(join(root, "src", "model.ts"), "export {}\n");
  await symlink("..", join(root, "src", "nested", "parent"));
  expect(await findWorkspaceFiles({ workspaceRoot: root, limit: 200 })).toEqual(
    expect.arrayContaining([{ path: "src/model.ts", type: "file" }]),
  );
});

test("workspace search validates regex and honors complete include globs", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workspace-search-glob-"));
  await mkdir(join(root, "src", "nested"), { recursive: true });
  await mkdir(join(root, "test"), { recursive: true });
  await writeFile(join(root, "src", "match.ts"), "needle\n");
  await writeFile(join(root, "src", "nested", "match.ts"), "needle\n");
  await writeFile(join(root, "test", "match.ts"), "needle\n");
  expect(
    await searchWorkspaceFiles({
      workspaceRoot: root,
      query: "needle",
      include: "src/*.ts",
    }),
  ).toEqual([{ path: "src/match.ts", line: 1, text: "needle" }]);
  await expect(
    searchWorkspaceFiles({ workspaceRoot: root, query: "[" }),
  ).rejects.toThrow(
    "workspace search query must be a valid regular expression",
  );
});

test("workspace watcher invalidates the catalog and watches new directories", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-workspace-watch-"));
  await writeFile(join(root, "first.ts"), "export {}\n");
  await findWorkspaceFiles({ workspaceRoot: root });
  let changes = 0;
  const stop = await watchWorkspaceFiles(root, () => changes++);
  await mkdir(join(root, "src"));
  await Bun.sleep(150);
  await writeFile(join(root, "src", "second.ts"), "export {}\n");
  await Bun.sleep(150);
  expect(changes).toBeGreaterThan(0);
  expect(await findWorkspaceFiles({ workspaceRoot: root })).toEqual(
    expect.arrayContaining([{ path: "src/second.ts", type: "file" }]),
  );
  stop();
});
