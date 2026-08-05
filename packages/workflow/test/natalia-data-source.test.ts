import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDataSourceSince, type NataliaDataSource } from "../src";

async function logFile(prefix: string, content: string) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  const path = join(root, "app.log");
  await writeFile(path, content);
  return { root, path };
}

function source(path: string, overrides: Partial<NataliaDataSource> = {}) {
  return {
    name: "app",
    path,
    kind: "offset" as const,
    maxBytes: 1024,
    ...overrides,
  };
}

test("a first read consumes the whole log and reports the next position", async () => {
  const { path } = await logFile("natalia-log-first-", "line one\nline two\n");
  const read = await readDataSourceSince({ source: source(path) });
  expect(read).toMatchObject({
    source: "app",
    from: 0,
    to: 18,
    size: 18,
    rotated: false,
    remaining: 0,
    content: "line one\nline two\n",
  });
});

test("a later read only returns what was appended since the watermark", async () => {
  const { path } = await logFile("natalia-log-append-", "line one\n");
  const first = await readDataSourceSince({ source: source(path) });
  await writeFile(path, "line one\nline two\n");
  const second = await readDataSourceSince({
    source: source(path),
    position: String(first.to),
  });
  expect(second).toMatchObject({
    from: 9,
    to: 18,
    content: "line two\n",
    rotated: false,
  });
});

test("nothing new returns an empty read that keeps the position", async () => {
  const { path } = await logFile("natalia-log-idle-", "only line\n");
  const first = await readDataSourceSince({ source: source(path) });
  const second = await readDataSourceSince({
    source: source(path),
    position: String(first.to),
  });
  expect(second).toMatchObject({
    from: 10,
    to: 10,
    content: "",
    remaining: 0,
  });
});

test("a bounded read reports how much is still waiting", async () => {
  const { path } = await logFile("natalia-log-bounded-", "abcdefghij");
  const read = await readDataSourceSince({
    source: source(path, { maxBytes: 4 }),
  });
  expect(read).toMatchObject({
    from: 0,
    to: 4,
    content: "abcd",
    remaining: 6,
  });
  // A caller cannot ask for more than the configured bound.
  const capped = await readDataSourceSince({
    source: source(path, { maxBytes: 4 }),
    maxBytes: 1000,
  });
  expect(capped.to).toBe(4);
});

test("a rotated log restarts from the beginning instead of skipping content", async () => {
  const { path } = await logFile("natalia-log-rotate-", "long original line\n");
  const first = await readDataSourceSince({ source: source(path) });
  expect(first.to).toBe(19);
  // The file was rotated and the new one is shorter than the old position.
  await writeFile(path, "fresh\n");
  const second = await readDataSourceSince({
    source: source(path),
    position: String(first.to),
  });
  expect(second).toMatchObject({
    rotated: true,
    from: 0,
    to: 6,
    content: "fresh\n",
  });
});

test("a relative log path resolves inside the workspace", async () => {
  const { root } = await logFile("natalia-log-relative-", "workspace line\n");
  const read = await readDataSourceSince({
    source: source("app.log"),
    workspaceRoot: root,
  });
  expect(read.content).toBe("workspace line\n");
});

test("unsupported watermark kinds and positions fail closed", async () => {
  const { path } = await logFile("natalia-log-invalid-", "x\n");
  await expect(
    readDataSourceSince({ source: source(path, { kind: "timestamp" }) }),
  ).rejects.toThrow("unsupported watermark kind");
  await expect(
    readDataSourceSince({ source: source(path), position: "2026-08-05" }),
  ).rejects.toThrow("non-offset watermark position");
  await expect(
    readDataSourceSince({ source: source(join(path, "missing")) }),
  ).rejects.toThrow();
});
