import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConfigV2, saveConfigFile } from "@natalia/config";
import {
  JsonSessionStore,
  SqliteSessionStore,
  createSessionRecord,
} from "@natalia/session";
import type { RuntimeClient } from "@natalia/contracts";
import { createRuntimeHttpServer } from "@natalia/transport";
import {
  attachTerminalReadOnly,
  deleteLocalSession,
  duplicateLocalSession,
  exportLocalSessionMetadata,
  importLocalSessionMetadata,
  doctorReport,
  listLocalSessions,
  parseAttachmentFlags,
  promptArguments,
  renameLocalSession,
  setLocalSessionPinned,
  sessionTable,
  showLocalSession,
  workspaceFilesystemCommand,
  externalTerminalLaunchCommand,
} from "../src";

test("CLI task validate resolves a workspace task and flow without running it", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-"));
  await mkdir(join(root, ".natalia", "flows"), { recursive: true });
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "flows", "review.yaml"),
    "kind: natalia-flow\nversion: 1\nflowID: flow_review\ndisplayName: Review\nmodules:\n  - id: read\n    type: read_search\n    displayName: Read\n",
  );
  await writeFile(
    join(root, ".natalia", "tasks", "nightly.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_nightly\ndisplayName: Nightly\nschedule: daily 01:00\nprompt: Review changes.\npermissionProfile: unattended\nflow:\n  flowID: flow_review\n",
  );
  const child = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "validate",
      "nightly.yaml",
      "--workspace",
      root,
      "--json",
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(child.exitCode).toBe(0);
  expect(JSON.parse(new TextDecoder().decode(child.stdout))).toMatchObject({
    status: "valid",
    taskID: "task_nightly",
    flowID: "flow_review",
    modules: 1,
  });
});

test("CLI task validate fails closed for a missing flow", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-task-missing-"));
  await mkdir(join(root, ".natalia", "tasks"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "tasks", "missing.yaml"),
    "kind: natalia-task\nversion: 1\ntaskID: task_missing\ndisplayName: Missing\nschedule: daily 01:00\nprompt: Review changes.\npermissionProfile: unattended\nflow:\n  flowID: flow_missing\n",
  );
  const child = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "task",
      "validate",
      "missing.yaml",
      "--workspace",
      root,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(child.exitCode).not.toBe(0);
  expect(new TextDecoder().decode(child.stderr)).toContain(
    "natalia flow not found",
  );
});

test("CLI session helpers list and delete local durable sessions", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-sessions-"));
  const store = new JsonSessionStore(join(root, ".natalia", "sessions"));
  const record = createSessionRecord(
    "ses_cli" as import("@natalia/contracts").SessionID,
    "CLI session",
  );
  record.events.push({ type: "diagnostic", level: "info", message: "saved" });
  record.inbox = [
    {
      id: "input",
      sessionID: record.id,
      text: "pending",
      delivery: "queue",
      admittedAt: "2026-01-01T00:00:00.000Z",
      admittedSeq: 1,
    },
  ];
  await store.save(record);
  expect(await listLocalSessions(root)).toMatchObject([
    { id: "ses_cli", events: 1, pendingInputs: 1 },
  ]);
  expect(sessionTable(await listLocalSessions(root))).toContain("CLI session");
  expect(await deleteLocalSession("ses_cli", root)).toEqual({
    id: "ses_cli",
    deleted: true,
    removedAttachments: 0,
  });
  expect(await listLocalSessions(root)).toEqual([]);
});

test("CLI session helpers list and show SQLite-backed unattended episodes", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-sqlite-sessions-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  const store = new SqliteSessionStore(join(root, ".natalia", "sessions.db"));
  const id = "ses_unattended_episode" as import("@natalia/contracts").SessionID;
  store.create(id, "Natalia unattended episode epi_unattended_episode");
  store.appendEvents(id, [
    {
      type: "turn.submitted",
      id: "turn",
      text: "/doctor",
      byteLength: 7,
      lineCount: 1,
      sha256: "doctor",
      episodeID: "epi_unattended_episode",
    },
    {
      type: "turn.finished",
      id: "turn",
      stopReason: "done",
      episodeID: "epi_unattended_episode",
    },
  ]);
  store.close();

  expect(await listLocalSessions(root)).toContainEqual(
    expect.objectContaining({ id, events: 2 }),
  );
  expect(await showLocalSession(id, root)).toMatchObject({
    id,
    events: 2,
    pendingInputs: 0,
  });
});

test("CLI session metadata export/import omits event and attachment contents", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-session-bundle-"));
  const store = new JsonSessionStore(join(root, ".natalia", "sessions"));
  const record = createSessionRecord(
    "ses_bundle" as import("@natalia/contracts").SessionID,
    "Bundle source",
  );
  record.metadata = { pinned: true };
  record.events.push({
    type: "content.delta",
    id: "turn",
    text: "private content",
  });
  await store.save(record);
  const bundle = await exportLocalSessionMetadata("ses_bundle", root);
  expect(JSON.stringify(bundle)).not.toContain("private content");
  expect(bundle).toMatchObject({
    version: 1,
    source: { id: "ses_bundle" },
    pinned: true,
  });
  expect(
    await importLocalSessionMetadata(bundle, {
      workspaceRoot: root,
      id: "ses_bundle_import",
    }),
  ).toEqual({
    id: "ses_bundle_import",
    title: "Bundle source",
    importedFrom: "ses_bundle",
  });
  expect(await showLocalSession("ses_bundle_import", root)).toMatchObject({
    events: 0,
    pinned: true,
  });
});

test("CLI session delete reclaims an attachment orphaned by the removed session", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-delete-attachment-"));
  const store = new JsonSessionStore(join(root, ".natalia", "sessions"));
  const record = createSessionRecord(
    "ses_attachment" as import("@natalia/contracts").SessionID,
    "Attachment session",
  );
  record.events.push({
    type: "turn.submitted",
    id: "turn",
    text: "inspect",
    byteLength: 7,
    lineCount: 1,
    sha256: "turn",
    attachments: [
      {
        id: "att_cli",
        path: ".natalia/attachments/att_cli-image.png",
        filename: "image.png",
        mediaType: "image/png",
        byteLength: 8,
        sha256: "attachment",
      },
    ],
  });
  await store.save(record);
  const attachmentRoot = join(root, ".natalia", "attachments");
  await mkdir(attachmentRoot, { recursive: true });
  await writeFile(
    join(attachmentRoot, "att_cli-image.png"),
    "orphan after delete",
  );
  expect(await deleteLocalSession("ses_attachment", root)).toMatchObject({
    deleted: true,
    removedAttachments: 1,
  });
  expect(
    await Bun.file(join(attachmentRoot, "att_cli-image.png")).exists(),
  ).toBe(false);
});

test("CLI run attachment flags preserve prompt text and validate values", () => {
  expect(
    promptArguments([
      "inspect",
      "this",
      "--attach",
      "image.png",
      "--attach",
      "notes.md",
    ]),
  ).toEqual({ text: "inspect this", attachments: ["image.png", "notes.md"] });
  expect(
    promptArguments(["inspect", "--json", "--attach", "image.png"]),
  ).toEqual({ text: "inspect", attachments: ["image.png"] });
  expect(() => parseAttachmentFlags(["--attach"])).toThrow(
    "--attach requires a workspace-relative path",
  );
  expect(() => parseAttachmentFlags(["--attach", "--json"])).toThrow(
    "--attach requires a workspace-relative path",
  );
});

test("CLI filesystem commands share protected workspace APIs", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-filesystem-"));
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "main.ts"), "const answer = 42\n");
  expect(
    await workspaceFilesystemCommand({ action: "list", workspaceRoot: root }),
  ).toEqual({
    entries: [{ path: "src/", type: "directory" }],
    truncated: false,
  });
  expect(
    await workspaceFilesystemCommand({
      action: "read",
      workspaceRoot: root,
      path: "src/main.ts",
      offset: 1,
      limit: 1,
    }),
  ).toMatchObject({ offset: 1, truncated: false });
  expect(
    await workspaceFilesystemCommand({
      action: "glob",
      workspaceRoot: root,
      pattern: "**/*.ts",
    }),
  ).toEqual([{ path: "src/main.ts", type: "file" }]);
  expect(
    await workspaceFilesystemCommand({
      action: "search",
      workspaceRoot: root,
      query: "answer",
    }),
  ).toEqual([{ path: "src/main.ts", line: 1, text: "const answer = 42" }]);
  await expect(
    workspaceFilesystemCommand({
      action: "read",
      workspaceRoot: root,
      path: "../outside",
    }),
  ).rejects.toThrow("workspace path must remain inside workspace");
});

test("CLI session helpers expose safe metadata and local mutations", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-session-actions-"));
  const store = new JsonSessionStore(join(root, ".natalia", "sessions"));
  const record = createSessionRecord(
    "ses_actions" as import("@natalia/contracts").SessionID,
    "Initial title",
  );
  record.events.push({
    type: "content.delta",
    id: "turn",
    text: "private event detail",
  });
  await store.save(record);
  expect(await showLocalSession("ses_actions", root)).toMatchObject({
    id: "ses_actions",
    title: "Initial title",
    events: 1,
  });
  expect(await renameLocalSession("ses_actions", "Renamed", root)).toEqual({
    id: "ses_actions",
    title: "Renamed",
  });
  expect(await setLocalSessionPinned("ses_actions", true, root)).toEqual({
    id: "ses_actions",
    pinned: true,
  });
  expect(
    await duplicateLocalSession("ses_actions", {
      newID: "ses_copy",
      title: "Copy",
      workspaceRoot: root,
    }),
  ).toEqual({ id: "ses_copy", title: "Copy", duplicatedFrom: "ses_actions" });
  expect(
    (await listLocalSessions(root)).map((session) => session.id).sort(),
  ).toEqual(["ses_actions", "ses_copy"]);
});

test("CLI doctor reports safe config/model/session availability", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-doctor-"));
  const config = defaultConfigV2();
  config.providers.local = {
    type: "openai",
    apiKey: "local-key",
    enabled: true,
    customHeaders: {},
  };
  config.models.local = {
    provider: "local",
    model: "model",
    enabled: true,
    capabilities: {
      toolCall: true,
      reasoning: true,
      thinking: true,
      imageInput: false,
      pdfInput: false,
    },
    contextWindow: "auto",
    maxOutputTokens: null,
    temperature: null,
    topP: null,
    reasoningEffort: null,
    thinkingEnabled: true,
    stream: true,
    requestTimeoutSec: null,
    variants: {},
  };
  config.defaultModel = "local";
  const path = join(root, "config.json");
  await saveConfigFile(config, path);
  expect(
    await doctorReport({ configPath: path, workspaceRoot: root }),
  ).toMatchObject({
    defaultModel: { selected: true },
    sessions: { count: 0 },
    sources: [
      { scope: "defaults", applied: true },
      { scope: "global", path, applied: true },
      {
        scope: "project",
        path: join(root, ".natalia", "config.json"),
        applied: false,
        diagnostic: "missing",
      },
    ],
  });
});

test("CLI terminal attach renders a daemon framebuffer read-only", async () => {
  const viewerActions: string[] = [];
  const client = {
    start() {},
    cancel() {},
    async terminalViewerRegister() {
      viewerActions.push("register");
      return {};
    },
    async terminalViewerControl(input: { action: string }) {
      viewerActions.push(input.action);
      return {};
    },
    async terminalObserve(input: { afterRevision: number }) {
      const session = {
        id: "tty_cli",
        command: "claude",
        cwd: "/repo",
        status: "exited",
        attached: true,
        rows: 2,
        cols: 8,
        transcript: "Hi",
        tail: "Hi",
        startedAt: "2026-01-01T00:00:00.000Z",
        target: { kind: "host", cwd: "/repo" },
        ownership: "model",
        revision: 1,
        screen: {
          rows: 2,
          cols: 8,
          buffer: "alternate",
          cursor: { row: 0, col: 2, visible: true },
          lines: [
            [
              ["H", 1, 0x1000000 + 0x0c2238, undefined, 1],
              ["i", 1],
            ],
            [],
          ],
          text: "Hi",
        },
      } as const;
      return {
        session,
        afterRevision: input.afterRevision,
        changed: true,
        reason: "exited" as const,
      };
    },
  } as unknown as RuntimeClient;
  const server = createRuntimeHttpServer({ client });
  const frames: string[] = [];
  try {
    const session = await attachTerminalReadOnly({
      id: "tty_cli",
      url: server.url,
      pollMs: 1,
      write: (frame) => frames.push(frame),
    });
    expect(session?.status).toBe("exited");
    expect(frames.join("")).toContain("\x1b[1;38;2;12;34;56mH");
    expect(frames.at(0)).toContain("\x1b[?1049h");
    expect(frames.at(-1)).toContain("\x1b[?1049l");
    expect(viewerActions).toEqual(["register", "unregister"]);
  } finally {
    server.stop(true);
  }
});

test("CLI terminal attach reconnects after a transient observation failure", async () => {
  const viewerActions: string[] = [];
  let attempts = 0;
  const client = {
    start() {},
    cancel() {},
    async terminalViewerRegister() {
      viewerActions.push("register");
      return {};
    },
    async terminalViewerControl(input: { action: string }) {
      viewerActions.push(input.action);
      return {};
    },
    async terminalObserve() {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary bridge failure");
      return {
        session: {
          id: "tty_reconnect",
          command: "cat",
          cwd: "/repo",
          status: "exited",
          attached: true,
          rows: 1,
          cols: 4,
          transcript: "ok",
          tail: "ok",
          startedAt: "2026-01-01T00:00:00.000Z",
          revision: 2,
          screen: {
            rows: 1,
            cols: 4,
            buffer: "normal",
            cursor: { row: 0, col: 2, visible: true },
            lines: [["o", "k"].map((char) => [char, 1])],
            text: "ok",
          },
        },
        afterRevision: 0,
        changed: true,
        reason: "exited" as const,
      };
    },
  } as unknown as RuntimeClient;
  const server = createRuntimeHttpServer({ client });
  const frames: string[] = [];
  try {
    await expect(
      attachTerminalReadOnly({
        id: "tty_reconnect",
        url: server.url,
        reconnectDelayMs: 1,
        write: (frame) => frames.push(frame),
      }),
    ).resolves.toMatchObject({ status: "exited" });
    expect(attempts).toBe(2);
    expect(viewerActions).toEqual(["register", "register", "unregister"]);
    expect(frames.join("")).toContain("ok");
    expect(frames.at(-1)).toContain("\x1b[?1049l");
  } finally {
    server.stop(true);
  }
});

test("CLI external terminal launcher uses platform-specific argument forms", () => {
  const executable = ["bun", "apps/cli/src/main.ts"];
  expect(
    externalTerminalLaunchCommand({
      id: "tty_1",
      executable,
      which: (name) => (name === "kitty" ? "/usr/bin/kitty" : null),
    }),
  ).toEqual(["kitty", "--", ...executable, "terminal", "attach", "tty_1"]);
  expect(
    externalTerminalLaunchCommand({
      id: "tty_1",
      executable,
      preferred: "wezterm",
      which: () => "/usr/bin/wezterm",
    }),
  ).toEqual([
    "wezterm",
    "start",
    "--",
    ...executable,
    "terminal",
    "attach",
    "tty_1",
  ]);
  expect(
    externalTerminalLaunchCommand({
      id: "tty_1",
      executable,
      preferred: "kitty",
      takeControl: true,
      secureInput: true,
      which: () => "/usr/bin/kitty",
    }),
  ).toEqual([
    "kitty",
    "--",
    ...executable,
    "terminal",
    "attach",
    "tty_1",
    "--take-control",
    "--secure-input",
  ]);
  expect(
    externalTerminalLaunchCommand({
      id: "tty_1",
      executable,
      which: () => null,
    }),
  ).toBeUndefined();
  expect(
    externalTerminalLaunchCommand({
      id: "tty_1",
      executable,
      preferred: "kitty",
      takeControl: true,
      which: () => "/usr/bin/kitty",
    }),
  ).toEqual([
    "kitty",
    "--",
    ...executable,
    "terminal",
    "attach",
    "tty_1",
    "--take-control",
  ]);
});
