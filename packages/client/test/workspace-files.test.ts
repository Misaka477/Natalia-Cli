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
  expect(await listWorkspaceFiles({ workspaceRoot: root })).toEqual([
    { path: "src/", type: "directory" },
  ]);
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
