import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ObjectStore } from "@natalia/object-store";
import { SnapshotSandboxManager } from "../src/snapshot-sandbox";
import { SnapshotStore } from "../src/snapshot-store";

test("SnapshotStore captures, diffs and promotes by content hash", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-snapshot-store-"));
  const store = new SnapshotStore(
    new ObjectStore(join(root, ".natalia", "objects")),
    join(root, ".natalia", "snapshots"),
  );
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
  const changes = await store.diff(candidate, base, new Map());
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

test("diff after a small change hashes only the changed file, not the whole tree", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-snapshot-perf-"));
  // A workspace with many files; only one will change.
  for (let index = 0; index < 40; index++)
    await writeFile(join(root, `file-${index}.txt`), `content ${index}`);
  await writeFile(join(root, "file.txt"), "base\n");

  let puts = 0;
  const store = new SnapshotStore(
    new (class extends ObjectStore {
      override async put(content: Buffer | string): Promise<string> {
        puts++;
        return await super.put(content);
      }
    })(join(root, ".natalia", "objects")),
    join(root, ".natalia", "snapshots"),
  );
  const countingManager = new SnapshotSandboxManager(root);
  await countingManager.initialize();
  // create hashes the whole tree once (the base capture).
  await countingManager.create("perf.1");
  // The agent changes one file.
  await writeFile(
    join(root, ".natalia", "sandboxes", "perf.1", "file.txt"),
    "edited\n",
  );
  // Re-index the candidate through the counting store: untouched files reuse
  // their objects by size/mtime; only the changed one is hashed.
  const candidateIndex = await store.capture(
    join(root, ".natalia", "sandboxes", "perf.1"),
  );
  const before = puts;
  await store.diff(
    join(root, ".natalia", "sandboxes", "perf.1"),
    (await store.loadIndex("perf.1"))!,
    candidateIndex,
  );
  // At most a couple of files were hashed, not the whole 41-file tree.
  expect(puts - before).toBeLessThanOrEqual(2);
});
