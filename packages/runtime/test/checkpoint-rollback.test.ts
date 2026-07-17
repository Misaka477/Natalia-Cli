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
import { appendSessionEvent, createSessionRecord } from "@natalia/session";
import {
  CheckpointStore,
  ContextLedger,
  initializeDefaultCheckpointStore,
  runCheckpointCommand,
  type CheckpointRuntimeResource,
} from "../src";

test("default baseline, user scenario rollback and session restore remain durable", async () => {
  const root = await tempWorkspace();
  const events: string[] = [];
  const ledger = new ContextLedger();
  ledger.add({ id: "user-1", role: "user", content: "checkpoint" });
  const store = await initializeDefaultCheckpointStore({
    sessionID: "ses_checkpoint_user",
    workspaceRoot: root,
    context: ledger,
    onEvent: (event) => events.push(event.type),
  });

  expect((await store.list()).map((record) => record.id)).toEqual([
    "checkpoint_0",
  ]);
  ledger.add({ id: "assistant-1", role: "assistant", content: "writing file" });
  await writeFile(join(root, "test_example.py"), "print('ok')\n");
  const run = Bun.spawnSync(["python3", join(root, "test_example.py")]);
  expect(run.exitCode).toBe(0);
  expect(run.stdout.toString()).toBe("ok\n");
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
  expect(events).toContain("checkpoint.created");
  expect(events).toContain("rollback.end");

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

test("manifest tracks modify delete rename mode symlink and reuses objects", async () => {
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
  const baseline = (await store.list())[0];
  expect(baseline?.manifest.entries["link.txt"]?.kind).toBe("symlink");

  await writeFile(join(root, "a.txt"), "changed\n");
  await rm(join(root, "delete.txt"));
  await rename(join(root, "dir", "target.txt"), join(root, "renamed.txt"));
  await chmod(join(root, "a.txt"), 0o755);
  await store.createCheckpoint({ reason: "manual", context: ledger, step: 1 });
  const changed = (await store.list()).at(-1)!;
  expect(changed.changes.map((change) => change.kind)).toEqual(
    expect.arrayContaining(["modify", "delete", "rename", "mode"]),
  );
  expect(changed.manifest.entries["link.txt"]?.kind).toBe("symlink");
  await store.rollbackTo("checkpoint_0", { context: ledger });
  expect(await readFile(join(root, "a.txt"), "utf8")).toBe("same\n");
  expect((await lstat(join(root, "a.txt"))).mode & 0o777).toBe(0o644);
  expect(await readFile(join(root, "delete.txt"), "utf8")).toBe("remove\n");
  expect((await lstat(join(root, "link.txt"))).isSymbolicLink()).toBe(true);

  await store.gcObjects(true);
  const buckets = await readdir(
    join(root, ".natalia", "checkpoints", "ses_manifest", "objects"),
  );
  const hashes = (
    await Promise.all(
      buckets.map((bucket) =>
        readdir(
          join(
            root,
            ".natalia",
            "checkpoints",
            "ses_manifest",
            "objects",
            bucket,
          ),
        ),
      ),
    )
  ).flat();
  expect(new Set(hashes).size).toBe(hashes.length);
});

test("incomplete checkpoint and ignored files are visible and guarded", async () => {
  const root = await tempWorkspace();
  const ledger = new ContextLedger();
  await writeFile(join(root, "tracked.txt"), "tracked\n");
  await writeFile(join(root, "ignored.log"), "ignored\n");
  await symlink("/tmp", join(root, "escape"));
  const events: string[] = [];
  const store = await CheckpointStore.open({
    sessionID: "ses_incomplete",
    workspaceRoot: root,
    ignore: ["*.log", "ignored.log"],
    additionalDirs: ["../outside"],
    onEvent: (event) => events.push(event.type),
  });
  const record = await store.createCheckpoint({
    reason: "manual",
    context: ledger,
    step: 1,
  });
  expect(record.complete).toBe(false);
  expect(record.errors.join("\n")).toContain("symlink escapes workspace root");
  expect(record.errors.join("\n")).toContain(
    "additional dir escapes workspace root",
  );
  expect(record.manifest.entries["ignored.log"]).toBeUndefined();
  expect(events).toContain("checkpoint.failed");
  await expect(
    store.rollbackTo(record.id, { context: ledger }),
  ).rejects.toThrow("incomplete");
});

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
      kind: "pty",
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

async function tempWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "natalia-checkpoint-"));
  await writeFile(join(root, ".gitignore"), "ignored.log\n");
  return root;
}
