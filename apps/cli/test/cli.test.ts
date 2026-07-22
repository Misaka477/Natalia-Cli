import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConfigV2, saveConfigFile } from "@natalia/config";
import { JsonSessionStore, createSessionRecord } from "@natalia/session";
import {
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
} from "../src";

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
