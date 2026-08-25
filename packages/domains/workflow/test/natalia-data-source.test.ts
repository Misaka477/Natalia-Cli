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

test("misconfigured watermarks and positions fail closed", async () => {
  const { path } = await logFile("natalia-log-invalid-", "x\n");
  // The timestamp kind is only usable with a field name; there is no guessing.
  await expect(
    readDataSourceSince({ source: source(path, { kind: "timestamp" }) }),
  ).rejects.toThrow("without a timestampField");
  await expect(
    readDataSourceSince({ source: source(path), position: "2026-08-05" }),
  ).rejects.toThrow("non-offset watermark position");
  await expect(
    readDataSourceSince({ source: source(join(path, "missing")) }),
  ).rejects.toThrow();
});

function jsonLines(entries: Array<{ at: string; message: string }>) {
  return entries.map((entry) => `${JSON.stringify(entry)}\n`).join("");
}

function timestampSource(
  path: string,
  overrides: Partial<NataliaDataSource> = {},
) {
  return source(path, {
    kind: "timestamp",
    timestampField: "at",
    ...overrides,
  });
}

test("a timestamp watermark reads each line's own time and advances to the newest", async () => {
  const { path } = await logFile(
    "natalia-log-ts-first-",
    jsonLines([
      { at: "2026-08-05T01:00:00.000Z", message: "one" },
      { at: "2026-08-05T02:00:00.000Z", message: "two" },
    ]),
  );
  const first = await readDataSourceSince({ source: timestampSource(path) });
  expect(first).toMatchObject({
    kind: "timestamp",
    position: "2026-08-05T02:00:00.000Z",
    rotated: false,
  });
  expect(first.content.split("\n")).toHaveLength(2);
  await writeFile(
    path,
    jsonLines([
      { at: "2026-08-05T01:00:00.000Z", message: "one" },
      { at: "2026-08-05T02:00:00.000Z", message: "two" },
      { at: "2026-08-05T03:00:00.000Z", message: "three" },
    ]),
  );
  const second = await readDataSourceSince({
    source: timestampSource(path),
    position: first.position,
  });
  // At-least-once: the line sharing the watermark's instant comes back, and the
  // older line does not. Dropping a sibling written in the same instant would be
  // the one unrecoverable outcome.
  expect(second.content).toContain("three");
  expect(second.content).toContain("two");
  expect(second.content).not.toContain("one");
  expect(second.position).toBe("2026-08-05T03:00:00.000Z");
});

test("a rotated log keeps its timestamp watermark instead of rereading everything", async () => {
  const { path } = await logFile(
    "natalia-log-ts-rotate-",
    jsonLines([
      { at: "2026-08-05T01:00:00.000Z", message: "before rotation" },
      { at: "2026-08-05T02:00:00.000Z", message: "also before" },
    ]),
  );
  const first = await readDataSourceSince({ source: timestampSource(path) });
  // Rotation replaces the file with a shorter one, which is exactly what breaks
  // a byte offset. Here the surviving lines are simply older than the watermark.
  await writeFile(
    path,
    jsonLines([
      { at: "2026-08-05T02:00:00.000Z", message: "also before" },
      { at: "2026-08-05T04:00:00.000Z", message: "after rotation" },
    ]),
  );
  const second = await readDataSourceSince({
    source: timestampSource(path),
    position: first.position,
  });
  expect(second.content).toContain("after rotation");
  expect(second.content).not.toContain("before rotation");
  expect(second.position).toBe("2026-08-05T04:00:00.000Z");
});

test("nothing newer than the timestamp watermark returns nothing and holds position", async () => {
  const { path } = await logFile(
    "natalia-log-ts-idle-",
    jsonLines([{ at: "2026-08-05T01:00:00.000Z", message: "one" }]),
  );
  const read = await readDataSourceSince({
    source: timestampSource(path),
    position: "2026-08-05T05:00:00.000Z",
  });
  expect(read.content).toBe("");
  expect(read.position).toBe("2026-08-05T05:00:00.000Z");
});

test("a half-written line is left for the next read rather than failing", async () => {
  const { path } = await logFile(
    "natalia-log-ts-partial-",
    `${jsonLines([{ at: "2026-08-05T01:00:00.000Z", message: "complete" }])}{"at":"2026-08-05T02:0`,
  );
  const read = await readDataSourceSince({ source: timestampSource(path) });
  expect(read.content).toContain("complete");
  expect(read.position).toBe("2026-08-05T01:00:00.000Z");
});

test("a timestamp source that is not JSON lines fails closed", async () => {
  const { path } = await logFile(
    "natalia-log-ts-plain-",
    "plain text line\n{}\n",
  );
  await expect(
    readDataSourceSince({ source: timestampSource(path) }),
  ).rejects.toThrow("not JSON");
  const { path: missingField } = await logFile(
    "natalia-log-ts-field-",
    '{"time":"2026-08-05T01:00:00.000Z"}\n',
  );
  await expect(
    readDataSourceSince({ source: timestampSource(missingField) }),
  ).rejects.toThrow("without the timestamp field at");
  const { path: epoch } = await logFile(
    "natalia-log-ts-epoch-",
    '{"at":1785000000000}\n',
  );
  // Epoch numbers would force a seconds-or-milliseconds guess, and guessing
  // wrong moves the watermark by decades.
  await expect(
    readDataSourceSince({ source: timestampSource(epoch) }),
  ).rejects.toThrow("ISO-8601 string");
  const { path: garbage } = await logFile(
    "natalia-log-ts-garbage-",
    '{"at":"yesterday"}\n',
  );
  await expect(
    readDataSourceSince({ source: timestampSource(garbage) }),
  ).rejects.toThrow("unparsable timestamp");
});

test("a bounded timestamp read refuses to skip content it never saw", async () => {
  const { path } = await logFile(
    "natalia-log-ts-bound-",
    jsonLines([
      { at: "2026-08-05T01:00:00.000Z", message: "oldest" },
      { at: "2026-08-05T02:00:00.000Z", message: "middle" },
      { at: "2026-08-05T03:00:00.000Z", message: "newest" },
    ]),
  );
  // The window only reaches back over the last line, so the run cannot prove it
  // saw everything after the watermark. Failing loudly beats silent data loss;
  // the operator raises maxBytes or schedules the task more often.
  await expect(
    readDataSourceSince({
      source: timestampSource(path, { maxBytes: 60 }),
      position: "2026-08-05T00:30:00.000Z",
    }),
  ).rejects.toThrow("would skip content");
  // Without a watermark there is no promise to keep, so a tail window is fine.
  const first = await readDataSourceSince({
    source: timestampSource(path, { maxBytes: 60 }),
  });
  expect(first.content).toContain("newest");
  expect(first.content).not.toContain("oldest");
});
