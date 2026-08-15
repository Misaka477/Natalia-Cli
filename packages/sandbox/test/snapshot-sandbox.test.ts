import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SnapshotStore } from "../src/snapshot-store";

test("SnapshotStore captures, diffs and promotes by content hash", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-snapshot-store-"));
  const store = new SnapshotStore(join(root, ".natalia", "snapshots"));
  const host = join(root, "host");
  await mkdir(host, { recursive: true });
  await writeFile(join(host, "a.txt"), "base content");
  const base = await store.capture(host);
  await store.saveIndex("s1", base);

  // A changed file and a new file are detected by hash; an unchanged one is not.
  const candidate = join(root, "candidate");
  await mkdir(candidate, { recursive: true });
  await writeFile(join(candidate, "a.txt"), "changed content");
  await writeFile(join(candidate, "b.txt"), "new");
  const changes = await store.diff(candidate, base);
  expect(changes.map((change) => change.path).sort()).toEqual([
    "a.txt",
    "b.txt",
  ]);
  expect(changes.find((change) => change.path === "a.txt")?.kind).toBe(
    "modify",
  );
  expect(changes.find((change) => change.path === "b.txt")?.kind).toBe("add");

  // Promote applies to the host; rollback restores the last-known-good.
  await store.promote("s1", candidate, host, changes);
  expect(await readFile(join(host, "a.txt"), "utf8")).toBe("changed content");
  expect(await readFile(join(host, "b.txt"), "utf8")).toBe("new");
  await store.rollback(host, "s1");
  expect(await readFile(join(host, "a.txt"), "utf8")).toBe("base content");
  expect(await readFile(join(host, "b.txt"), "utf8")).toBe("");
});
