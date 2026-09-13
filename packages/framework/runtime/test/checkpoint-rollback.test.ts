import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  symlink,
  writeFile,
  rm,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "bun:test";
import type { RuntimeEvent } from "@natalia/contracts";
import { appendSessionEvent, createSessionRecord } from "@natalia/session";
import {
  CheckpointStore,
  ContextLedger,
  initializeDefaultCheckpointStore,
  runCheckpointCommand,
  type CheckpointRuntimeResource,
} from "../src";

/**
 * These fixtures create filesystem symlinks, which Windows refuses without
 * Developer Mode or an elevated process. The behaviour under test is the
 * ledger's handling of symlinked entries, so the tests are skipped when the
 * machine cannot create symlinks rather than failing on setup.
 */
const symlinkSupported = await probeSymlinkSupport();
const symlinkTest = symlinkSupported ? test : test.skip;

async function probeSymlinkSupport(): Promise<boolean> {
  const root = await mkdtemp(join(tmpdir(), "natalia-symlink-probe-"));
  try {
    await symlink("target", join(root, "link"));
    return true;
  } catch {
    return false;
  } finally {
    await rm(root, { recursive: true, force: true }).catch(() => undefined);
  }
}

// Python is only a stand-in for "a real external program wrote and ran a file
// here", not a subject of these tests. The interpreter is named `python3` on
// most POSIX distributions and `python` on Windows, so resolve whichever
// exists rather than hard-coding one and losing the whole scenario elsewhere.
function pythonInterpreter() {
  for (const candidate of ["python3", "python"]) {
    try {
      // spawnSync throws ENOENT rather than reporting failure when the
      // executable is absent, so probing has to be guarded.
      const probe = Bun.spawnSync([candidate, "--version"], {
        stdout: "ignore",
        stderr: "ignore",
      });
      if (probe.success) return candidate;
    } catch {
      continue;
    }
  }
  return undefined;
}

test("default baseline, user scenario rollback and session restore remain durable", async () => {
  const root = await tempWorkspace();
  const events: RuntimeEvent[] = [];
  const ledger = new ContextLedger();
  ledger.add({ id: "user-1", role: "user", content: "checkpoint" });
  const store = await initializeDefaultCheckpointStore({
    sessionID: "ses_checkpoint_user",
    workspaceRoot: root,
    context: ledger,
    onEvent: (event) => events.push(event),
  });

  expect((await store.list()).map((record) => record.id)).toEqual([
    "checkpoint_0",
  ]);
  ledger.add({ id: "assistant-1", role: "assistant", content: "writing file" });
  await writeFile(join(root, "test_example.py"), "print('ok')\n");
  const interpreter = pythonInterpreter();
  if (interpreter) {
    const run = Bun.spawnSync([interpreter, join(root, "test_example.py")]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout.toString().trim()).toBe("ok");
  }
  ledger.add({
    id: "tool-call",
    role: "tool_call",
    content: "write_file test_example.py",
  });
  ledger.add({
    id: "tool-result",
    role: "tool_result",
    content: "created test_example.py",
  });
  ledger.recordProviderUsage(20, 5);
  await store.createCheckpoint({
    reason: "manual",
    context: ledger,
    step: 3,
    status: "ran python",
    name: "ran python",
  });

  expect(await readFile(join(root, "test_example.py"), "utf8")).toContain("ok");
  const preview = await store.rollbackTo("checkpoint_0", { context: ledger });
  expect(
    preview.changes.some(
      (change) => change.kind === "delete" && change.path === "test_example.py",
    ),
  ).toBe(true);
  await expect(
    readFile(join(root, "test_example.py"), "utf8"),
  ).rejects.toMatchObject({ code: "ENOENT" });
  expect(ledger.snapshot().entries.map((entry) => entry.id)).toEqual([
    "user-1",
  ]);
  expect(ledger.journalStatus()).toMatchObject({
    journalOffset: 1,
    messageCount: 1,
  });
  expect(events.map((event) => event.type)).toContain("checkpoint.created");
  expect(events.map((event) => event.type)).toContain("rollback.end");

  const restored = await CheckpointStore.open({
    sessionID: "ses_checkpoint_user",
    workspaceRoot: root,
  });
  const restoredRecords = await restored.list();
  const safety = restoredRecords.find(
    (record) => record.reason === "rollback_safety",
  );
  expect(safety).toBeDefined();
  expect(restoredRecords.map((record) => record.id)).toEqual([
    "checkpoint_0",
    safety!.id,
  ]);
  await restored.rollbackTo(safety!.id, { context: ledger });
  expect(await readFile(join(root, "test_example.py"), "utf8")).toContain("ok");
});

symlinkTest(
  "manifest tracks modify delete rename mode symlink and reuses objects",
  async () => {
    const root = await tempWorkspace();
    const ledger = new ContextLedger();
    await writeFile(join(root, "a.txt"), "same\n");
    await writeFile(join(root, "delete.txt"), "remove\n");
    await mkdir(join(root, "dir"));
    await writeFile(join(root, "dir", "target.txt"), "target\n");
    await symlink("dir/target.txt", join(root, "link.txt"));
    const store = await initializeDefaultCheckpointStore({
      sessionID: "ses_manifest",
      workspaceRoot: root,
      context: ledger,
    });
    const baseline = (await store.list())[0]!;
    const baselineManifest = await store.loadManifest(baseline);
    expect(baselineManifest.entries["link.txt"]?.kind).toBe("symlink");

    await writeFile(join(root, "a.txt"), "changed\n");
    await rm(join(root, "delete.txt"));
    await rename(join(root, "dir", "target.txt"), join(root, "renamed.txt"));
    await chmod(join(root, "a.txt"), 0o755);
    await store.createCheckpoint({
      reason: "manual",
      context: ledger,
      step: 1,
    });
    const changed = (await store.list()).at(-1)!;
    expect(changed.changes.map((change) => change.kind)).toEqual(
      expect.arrayContaining(["modify", "delete", "rename", "mode"]),
    );
    const changedManifest = await store.loadManifest(changed);
    expect(changedManifest.entries["link.txt"]?.kind).toBe("symlink");
    await store.rollbackTo("checkpoint_0", { context: ledger });
    expect(await readFile(join(root, "a.txt"), "utf8")).toBe("same\n");
    expect((await lstat(join(root, "a.txt"))).mode & 0o777).toBe(0o644);
    expect(await readFile(join(root, "delete.txt"), "utf8")).toBe("remove\n");
    expect((await lstat(join(root, "link.txt"))).isSymbolicLink()).toBe(true);

    await store.gcObjects(true);
    // Objects now live in the shared content-addressed library, not the
    // per-session checkpoint dir.
    const buckets = await readdir(join(root, ".natalia", "objects"));
    const hashes = (
      await Promise.all(
        buckets.map((bucket) =>
          readdir(join(root, ".natalia", "objects", bucket)),
        ),
      )
    ).flat();
    expect(new Set(hashes).size).toBe(hashes.length);
  },
);

test("concurrent checkpoint creation assigns unique durable sequences", async () => {
  const root = await tempWorkspace();
  const ledger = new ContextLedger();
  const store = await CheckpointStore.open({
    sessionID: "ses_checkpoint_concurrent",
    workspaceRoot: root,
  });
  const records = await Promise.all(
    [1, 2, 3].map((step) =>
      store.createCheckpoint({ reason: "manual", context: ledger, step }),
    ),
  );
  expect(records.map((record) => record.sequence)).toEqual([0, 1, 2]);
  expect((await store.list()).map((record) => record.id)).toEqual([
    "checkpoint_0",
    "checkpoint_1",
    "checkpoint_2",
  ]);
});

test("rollback refuses to mutate when its safety checkpoint is incomplete", async () => {
  const root = await tempWorkspace();
  const ledger = new ContextLedger();
  const store = await CheckpointStore.open({
    sessionID: "ses_checkpoint_safety",
    workspaceRoot: root,
    maxFiles: 1,
  });
  await store.createCheckpoint({
    reason: "baseline",
    context: ledger,
    step: 0,
  });
  await writeFile(join(root, "first.txt"), "first\n");
  await writeFile(join(root, "second.txt"), "second\n");
  await expect(
    store.rollbackTo("checkpoint_0", { context: ledger }),
  ).rejects.toThrow("rollback safety checkpoint is incomplete");
  expect(await readFile(join(root, "second.txt"), "utf8")).toBe("second\n");
});

symlinkTest(
  "incomplete checkpoint and ignored files are visible and guarded",
  async () => {
    const root = await tempWorkspace();
    const ledger = new ContextLedger();
    await writeFile(join(root, "tracked.txt"), "tracked\n");
    await writeFile(join(root, "ignored.log"), "ignored\n");
    await symlink("/tmp", join(root, "escape"));
    const events: RuntimeEvent[] = [];
    const store = await CheckpointStore.open({
      sessionID: "ses_incomplete",
      workspaceRoot: root,
      ignore: ["*.log", "ignored.log"],
      additionalDirs: ["../outside"],
      onEvent: (event) => events.push(event),
    });
    const record = await store.createCheckpoint({
      reason: "manual",
      context: ledger,
      step: 1,
    });
    expect(record.complete).toBe(false);
    expect(record.errors.join("\n")).toContain("symlink outside");
    expect(record.errors.join("\n")).toContain(
      "additional directory is outside the managed workspace",
    );
    const recordManifest = await store.loadManifest(record);
    expect(recordManifest.entries["ignored.log"]).toBeUndefined();
    expect(events.map((event) => event.type)).toContain("checkpoint.failed");
    expect(events.map((event) => event.type)).not.toContain(
      "checkpoint.created",
    );
    const failed = events.find(
      (event): event is Extract<RuntimeEvent, { type: "checkpoint.failed" }> =>
        event.type === "checkpoint.failed",
    );
    expect(failed?.errors).toEqual(
      expect.arrayContaining([
        "checkpoint contains a symlink outside the managed workspace",
      ]),
    );
    expect(JSON.stringify(failed)).not.toContain("escape");
    expect(JSON.stringify(failed)).not.toContain("/tmp");
    await expect(
      store.rollbackTo(record.id, { context: ledger }),
    ).rejects.toThrow("incomplete");
  },
);

test("checkpoint structurally excludes its own stores even without .natalia/ ignore", async () => {
  const root = await tempWorkspace();
  const ledger = new ContextLedger();
  await writeFile(join(root, ".nataliaignore"), "# no .natalia rule\n");
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "main.ts"), "export {}\n");
  const store = await initializeDefaultCheckpointStore({
    sessionID: "ses_checkpoint_self_exclusion",
    workspaceRoot: root,
    context: ledger,
  });
  const [baseline] = await store.list();
  const baselineManifest = await store.loadManifest(baseline!);
  const paths = Object.keys(baselineManifest.entries);
  expect(paths).toContain("src/main.ts");
  expect(paths.some((path) => path.startsWith(".natalia/objects/"))).toBe(
    false,
  );
  expect(paths.some((path) => path.startsWith(".natalia/checkpoints/"))).toBe(
    false,
  );
  expect(paths).not.toContain(".nataliaignore");
});

symlinkTest(
  "large ignored workspace fixtures do not make a durable checkpoint incomplete",
  async () => {
    const root = await tempWorkspace();
    const ledger = new ContextLedger();
    const events: Array<
      Extract<
        RuntimeEvent,
        { type: "checkpoint.created" | "checkpoint.failed" }
      >
    > = [];
    await mkdir(join(root, "source"), { recursive: true });
    await mkdir(join(root, "fixture-output"), { recursive: true });
    await writeFile(join(root, ".nataliaignore"), "/fixture-output\n");
    await Promise.all(
      Array.from({ length: 750 }, (_, index) =>
        writeFile(join(root, "source", `${index}.txt`), `entry ${index}\n`),
      ),
    );
    await symlink(
      "/not-a-managed-target",
      join(root, "fixture-output", "broken"),
    );
    const store = await initializeDefaultCheckpointStore({
      sessionID: "ses_checkpoint_large_ignored_fixture",
      workspaceRoot: root,
      context: ledger,
      onEvent: (event) => {
        if (
          event.type === "checkpoint.created" ||
          event.type === "checkpoint.failed"
        )
          events.push(event);
      },
    });

    const [baseline] = await store.list();
    expect(baseline).toMatchObject({ complete: true });
    const baselineManifest = await store.loadManifest(baseline!);
    expect(Object.keys(baselineManifest.entries)).toHaveLength(751);
    expect(baselineManifest.entries["fixture-output/broken"]).toBeUndefined();
    expect(events).toEqual([
      expect.objectContaining({ type: "checkpoint.created", complete: true }),
    ]);
    expect(
      await store.previewRollback("checkpoint_0", ledger, [], true),
    ).toMatchObject({
      checkpointID: "checkpoint_0",
      complete: true,
      dryRun: true,
    });
    expect(
      await store.rollbackTo("checkpoint_0", { context: ledger, dryRun: true }),
    ).toMatchObject({ complete: true, dryRun: true });
  },
);

test("rollback failure restores safety checkpoint for workspace and context", async () => {
  const root = await tempWorkspace();
  const ledger = new ContextLedger();
  await writeFile(join(root, "file.txt"), "before\n");
  const store = await initializeDefaultCheckpointStore({
    sessionID: "ses_transaction",
    workspaceRoot: root,
    context: ledger,
  });
  ledger.add({ id: "assistant", role: "assistant", content: "after" });
  await writeFile(join(root, "file.txt"), "after\n");
  await store.createCheckpoint({ reason: "manual", context: ledger, step: 1 });
  await expect(
    store.rollbackTo("checkpoint_0", {
      context: ledger,
      failContextRestore: true,
    }),
  ).rejects.toThrow("injected context rollback failure");
  expect(await readFile(join(root, "file.txt"), "utf8")).toBe("after\n");
  expect(ledger.snapshot().entries.map((entry) => entry.id)).toEqual([
    "assistant",
  ]);
});

test("dry-run preview includes running PTY Sandbox workflow modal policy", async () => {
  const root = await tempWorkspace();
  const ledger = new ContextLedger();
  const events: string[] = [];
  const store = await initializeDefaultCheckpointStore({
    sessionID: "ses_resources",
    workspaceRoot: root,
    context: ledger,
    onEvent: (event) => events.push(event.type),
  });
  const resources: CheckpointRuntimeResource[] = [
    {
      kind: "terminal",
      id: "pty_1",
      status: "running",
      summary: "interactive shell",
    },
    {
      kind: "sandbox",
      id: "box_1",
      status: "preserve_dirty",
      summary: "dirty sandbox",
    },
    {
      kind: "workflow",
      id: "wf_1",
      status: "pending",
      summary: "pending workflow",
    },
    {
      kind: "pending_modal",
      id: "apr_1",
      status: "pending",
      summary: "approval modal",
    },
  ];
  const preview = await store.previewRollback(
    "checkpoint_0",
    ledger,
    resources,
    true,
  );
  expect(preview.dryRun).toBe(true);
  expect(preview.resources.map((resource) => resource.action)).toEqual([
    "stop",
    "preserve_dirty",
    "stop",
    "invalidate",
  ]);
  expect(events).toContain("rollback.previewed");
});

test("rollback applies resource policies and projects restored context", async () => {
  const root = await tempWorkspace();
  const ledger = new ContextLedger();
  ledger.add({ id: "baseline", role: "user", content: "baseline" });
  const store = await initializeDefaultCheckpointStore({
    sessionID: "ses_resource_apply",
    workspaceRoot: root,
    context: ledger,
  });
  ledger.add({ id: "later", role: "user", content: "later" });
  const policies: string[] = [];
  let restored = 0;
  await store.rollbackTo("checkpoint_0", {
    context: ledger,
    resources: [
      { kind: "terminal", id: "pty_1", status: "running", summary: "shell" },
      {
        kind: "sandbox",
        id: "box_1",
        status: "preserve_dirty",
        summary: "dirty",
      },
    ],
    onResourcePolicy: async (policy) => {
      policies.push(`${policy.kind}:${policy.action}`);
    },
    onContextRestored: async () => {
      restored++;
    },
  });
  expect(policies).toEqual(["terminal:stop"]);
  expect(restored).toBe(1);
  expect(ledger.snapshot().entries.map((entry) => entry.id)).toEqual([
    "baseline",
  ]);
});

test("commands, typed events and session replay are stable", async () => {
  const root = await tempWorkspace();
  const ledger = new ContextLedger();
  const session = createSessionRecord("ses_projection", "projection");
  const store = await initializeDefaultCheckpointStore({
    sessionID: "ses_projection",
    workspaceRoot: root,
    context: ledger,
    onEvent: (event) => appendSessionEvent(session, event),
  });
  await writeFile(join(root, "file.txt"), "content\n");
  const created = await runCheckpointCommand(store, ledger, "/checkpoint");
  expect(created.output).toContain("checkpoint_1");
  const listed = await runCheckpointCommand(
    store,
    ledger,
    "/checkpoints --limit 5",
  );
  expect(listed.output).toContain("files=1");
  const dryRun = await runCheckpointCommand(
    store,
    ledger,
    "/rollback checkpoint_0 --dry-run",
  );
  expect(dryRun.output).toContain("dry-run");
  const rollback = await runCheckpointCommand(store, ledger, "/rollback last");
  expect(rollback.output).toContain("rollback");

  const checkpointEvent = session.events.find(
    (event) => event.type === "checkpoint.created",
  )!;
  expect(checkpointEvent.type).toBe("checkpoint.created");
  expect(session.events.map((event) => event.type)).toEqual(
    expect.arrayContaining([
      "checkpoint.created",
      "rollback.previewed",
      "rollback.end",
    ]),
  );
});

test("disabled and initialization failure emit visible diagnostics", async () => {
  const root = await tempWorkspace();
  const disabled: string[] = [];
  await CheckpointStore.open({
    sessionID: "ses_disabled",
    workspaceRoot: root,
    enabled: false,
    onEvent: (event) => disabled.push(event.type),
  });
  expect(disabled).toEqual(["checkpoint.unavailable"]);

  const failed: string[] = [];
  const fileStore = join(root, "not-a-dir");
  await writeFile(fileStore, "x");
  await CheckpointStore.open({
    sessionID: "ses_failed",
    workspaceRoot: root,
    storeDir: fileStore,
    onEvent: (event) => failed.push(event.type),
  });
  expect(failed).toEqual(["checkpoint.unavailable"]);
});

test("checkpoint rename persists a user label in the journal", async () => {
  const root = await tempWorkspace();
  const ledger = new ContextLedger();
  const store = await initializeDefaultCheckpointStore({
    sessionID: "ses_rename",
    workspaceRoot: root,
    context: ledger,
  });
  const renamed = await store.rename("checkpoint_0", "  before tools  ");
  expect(renamed.name).toBe("before tools");
  const reopened = await CheckpointStore.open({
    sessionID: "ses_rename",
    workspaceRoot: root,
  });
  expect((await reopened.list())[0]?.name).toBe("before tools");
});

/**
 * The A + CDC contract in one test: an append-only session must store only the
 * new entries per checkpoint (so the journal stays tiny and does not grow
 * quadratically), yet every materialized context must be byte-identical to the
 * full snapshot it replaced, and a rollback must restore one exactly.
 */
test("append-only checkpoints stay small and replay their contexts exactly", async () => {
  const root = await tempWorkspace();
  const ledger = new ContextLedger();
  const store = await initializeDefaultCheckpointStore({
    sessionID: "ses_delta_replay",
    workspaceRoot: root,
    context: ledger,
  });
  const expected: string[][] = [[]];
  const N = 60;
  for (let index = 1; index <= N; index++) {
    ledger.add({
      id: `m${index}`,
      role: "user",
      content: `message ${index} `.repeat(40),
    });
    await store.createCheckpoint({
      reason: "manual",
      context: ledger,
      step: index,
      status: "manual",
    });
    expected.push(ledger.snapshot().entries.map((entry) => entry.id));
  }

  const records = await store.list();
  expect(records.length).toBe(N + 1);
  // Listings carry only the scalar header — no ledger entries materialized.
  expect(records.every((record) => record.context === undefined)).toBe(true);

  let naiveBytes = 0;
  for (let index = 0; index <= N; index++) {
    const record = records[index]!;
    expect(record.contextMeta.entryCount).toBe(expected[index]!.length);
    const full = await store.get(record.id);
    expect(full?.context?.entries.map((entry) => entry.id)).toEqual(
      expected[index],
    );
    naiveBytes += Buffer.byteLength(JSON.stringify(full!.context!));
  }

  const journalBytes = (
    await readFile(
      join(
        root,
        ".natalia",
        "checkpoints",
        "ses_delta_replay",
        "journal.jsonl",
      ),
    )
  ).byteLength;
  // Full snapshots would be ~sum(index * entrySize); deltas should be a small
  // fraction of that, not merely "smaller".
  expect(journalBytes * 5).toBeLessThan(naiveBytes);

  // Rolling back the ledger must restore the exact entries of a middle
  // checkpoint, reconstructed from its delta chain.
  const middle = records[Math.floor(N / 2)]!;
  const live = new ContextLedger();
  for (let index = 0; index < N * 2; index++)
    live.add({ id: `live${index}`, role: "user", content: "live state" });
  await store.rollbackTo(middle.id, { context: live });
  expect(live.snapshot().entries.map((entry) => entry.id)).toEqual(
    expected[middle.sequence]!,
  );
});

/**
 * A legacy v2 journal (inline manifest + context) must be migrated in place to
 * v3 on first open, keep its `.v2-backup`, preserve every record and replay
 * each context exactly.
 */
test("a v2 journal migrates to v3 and keeps every checkpoint", async () => {
  const root = await tempWorkspace();
  const ledger = new ContextLedger();
  const store = await initializeDefaultCheckpointStore({
    sessionID: "ses_migrate_v2",
    workspaceRoot: root,
    context: ledger,
  });
  const expected: string[][] = [[]];
  for (let index = 1; index <= 5; index++) {
    ledger.add({ id: `m${index}`, role: "user", content: `turn ${index}` });
    await store.createCheckpoint({
      reason: "manual",
      context: ledger,
      step: index,
      status: "manual",
    });
    expected.push(ledger.snapshot().entries.map((entry) => entry.id));
  }
  const journalPath = join(
    root,
    ".natalia",
    "checkpoints",
    "ses_migrate_v2",
    "journal.jsonl",
  );
  // Rewrite the file in the legacy inline shape.
  const full = await store
    .list()
    .then(async (records) =>
      Promise.all(records.map((record) => store.get(record.id))),
    );
  await writeFile(
    journalPath,
    `${full
      .map((record) =>
        JSON.stringify({
          ...record,
          schemaVersion: 2,
          context: record!.context,
        }),
      )
      .join("\n")}\n`,
  );

  // Re-open: the migration runs before the journal is read.
  const reopened = await CheckpointStore.open({
    sessionID: "ses_migrate_v2",
    workspaceRoot: root,
  });
  const migrated = await reopened.list();
  expect(migrated.length).toBe(6);
  for (let index = 0; index < migrated.length; index++) {
    const record = await reopened.get(migrated[index]!.id);
    expect(record?.context?.entries.map((entry) => entry.id)).toEqual(
      expected[index],
    );
  }
  const rewritten = await readFile(journalPath, "utf8");
  expect(rewritten).toContain('"schemaVersion":3');
  expect(rewritten).not.toContain('"schemaVersion":2');
  await lstat(`${journalPath}.v2-backup`);
});

/**
 * Sub-4KB payloads (the common case: a tool call adds one or two entries) are
 * inlined in the journal line instead of becoming one-block chunk files, which
 * is where most of the small-file overhead came from.
 */
test("small checkpoint payloads are inlined instead of chunked", async () => {
  const root = await tempWorkspace();
  const ledger = new ContextLedger();
  const store = await initializeDefaultCheckpointStore({
    sessionID: "ses_inline",
    workspaceRoot: root,
    context: ledger,
  });
  ledger.add({ id: "m1", role: "user", content: "small turn" });
  await store.createCheckpoint({
    reason: "manual",
    context: ledger,
    step: 1,
    status: "manual",
  });
  const journal = await readFile(
    join(root, ".natalia", "checkpoints", "ses_inline", "journal.jsonl"),
    "utf8",
  );
  expect(journal).toContain('"inline"');
  expect(journal).not.toContain('"ref"');
  // No chunk files were needed at all for these small payloads.
  const chunkFiles = await countFiles(
    join(root, ".natalia", "chunks", "ses_inline"),
  );
  expect(chunkFiles).toBe(0);
});

async function countFiles(root: string): Promise<number> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
  let count = 0;
  for (const entry of entries)
    count += entry.isDirectory()
      ? await countFiles(join(root, entry.name))
      : entry.isFile()
        ? 1
        : 0;
  return count;
}

/**
 * Regression: appending one checkpoint must not read (or rewrite) the whole
 * journal. The old path called `list()` in `ensureBaseline` and again in
 * `createCheckpointLocked`, then serialized every record back out. On a long
 * session the journal reaches hundreds of MB, so each turn's
 * `createTurnCheckpoint` stalled before the provider ran — the fix reads only
 * the journal tail and appends one line. `list()` is spied on because a full
 * read is exactly what regressed; asserting on wall-clock time would be flaky.
 */
test("a checkpoint appends without reading the whole journal", async () => {
  const root = await tempWorkspace();
  const ledger = new ContextLedger();
  ledger.add({ id: "user-1", role: "user", content: "checkpoint" });
  const store = await initializeDefaultCheckpointStore({
    sessionID: "ses_append_only",
    workspaceRoot: root,
    context: ledger,
  });

  const realList = store.list.bind(store);
  let listCalls = 0;
  store.list = async () => {
    listCalls += 1;
    return await realList();
  };

  // Both entry points on the turn path: the baseline existence check and the
  // turn's own checkpoint creation.
  await store.ensureBaseline(ledger, 0);
  const created = await store.createCheckpoint({
    reason: "turn_begin",
    context: ledger,
    step: 1,
    status: "turn_begin",
  });
  expect(listCalls).toBe(0);

  // Correctness is unchanged: the record is appended with the next sequence
  // and stays visible to a full read.
  expect(created.sequence).toBe(1);
  expect((await realList()).map((record) => record.id)).toEqual([
    "checkpoint_0",
    "checkpoint_1",
  ]);
});

test("list() omits the manifest and loadManifest rebuilds it on demand", async () => {
  const root = await tempWorkspace();
  const ledger = new ContextLedger();
  await writeFile(join(root, "a.txt"), "one\n");
  const store = await initializeDefaultCheckpointStore({
    sessionID: "ses_manifest_lazy",
    workspaceRoot: root,
    context: ledger,
  });
  const [summary] = await store.list();
  // Scalars stay available without materializing the (potentially huge) entries.
  expect(summary!.manifest).toBeUndefined();
  expect(summary!.manifestMeta.complete).toBe(true);
  expect(summary!.manifestMeta.entryCount).toBeGreaterThan(0);
  // The full manifest is rebuilt on demand from the stored delta chain.
  const manifest = await store.loadManifest(summary!);
  expect(Object.keys(manifest.entries)).toContain("a.txt");
  // A full get() carries both context and manifest.
  const full = await store.get(summary!.id);
  expect(full?.manifest).toBeDefined();
  expect(Object.keys(full!.manifest!.entries)).toContain("a.txt");
});

async function tempWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "natalia-checkpoint-"));
  await writeFile(join(root, ".gitignore"), "ignored.log\n");
  return root;
}
