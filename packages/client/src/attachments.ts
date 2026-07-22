import { copyFile, mkdir, readdir, realpath, rm, stat } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { basename, join, relative, resolve } from "node:path";
import type { LocalAttachment } from "@natalia/contracts";
import type { SessionRecord } from "@natalia/session";
import { modelVisibleEvents } from "@natalia/session";

const maxAttachmentBytes = 8 * 1024 * 1024;
const maxTextAttachmentBytes = 1024 * 1024;

export async function storeLocalAttachments(input: {
  workspaceRoot: string;
  paths: string[];
}) {
  const root = resolve(input.workspaceRoot);
  const store = join(root, ".natalia", "attachments");
  await mkdir(store, { recursive: true, mode: 0o700 });
  return await Promise.all(
    input.paths.map(async (path) => {
      const source = await realpath(resolve(root, path));
      if (relative(root, source).startsWith(".."))
        throw new Error(`attachment path escapes workspace: ${path}`);
      const info = await stat(source);
      if (!info.isFile()) throw new Error(`attachment is not a file: ${path}`);
      if (info.size > maxAttachmentBytes)
        throw new Error(
          `attachment exceeds ${maxAttachmentBytes} bytes: ${path}`,
        );
      const bytes = new Uint8Array(await Bun.file(source).arrayBuffer());
      const mediaType = mediaTypeForBytes(bytes, basename(source));
      if (!mediaType)
        throw new Error(`attachment type is unsupported: ${path}`);
      const id = `att_${randomUUID().replace(/-/gu, "")}`;
      const target = join(store, `${id}-${basename(source)}`);
      await copyFile(source, target, 0);
      return {
        id,
        path: relative(root, target),
        filename: basename(source),
        mediaType,
        byteLength: info.size,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      } satisfies LocalAttachment;
    }),
  );
}

export async function attachmentDataURL(
  workspaceRoot: string,
  attachment: LocalAttachment,
) {
  const root = resolve(workspaceRoot);
  const path = await realpath(resolve(root, attachment.path));
  if (relative(join(root, ".natalia", "attachments"), path).startsWith(".."))
    throw new Error(`attachment store path escapes root: ${attachment.id}`);
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  return `data:${attachment.mediaType};base64,${Buffer.from(bytes).toString("base64")}`;
}

export async function attachmentText(
  workspaceRoot: string,
  attachment: LocalAttachment,
) {
  if (!isTextAttachment(attachment))
    throw new Error(`attachment is not text: ${attachment.id}`);
  if (attachment.byteLength > maxTextAttachmentBytes)
    throw new Error(
      `text attachment exceeds ${maxTextAttachmentBytes} bytes: ${attachment.filename}`,
    );
  const root = resolve(workspaceRoot);
  const path = await realpath(resolve(root, attachment.path));
  if (relative(join(root, ".natalia", "attachments"), path).startsWith(".."))
    throw new Error(`attachment store path escapes root: ${attachment.id}`);
  return new TextDecoder("utf-8", { fatal: true })
    .decode(await Bun.file(path).arrayBuffer())
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export function isTextAttachment(attachment: LocalAttachment) {
  return (
    attachment.mediaType.startsWith("text/") ||
    attachment.mediaType === "application/json"
  );
}

export async function cleanupUnreferencedAttachments(input: {
  workspaceRoot: string;
  attachments: LocalAttachment[];
}) {
  const store = join(resolve(input.workspaceRoot), ".natalia", "attachments");
  const referenced = new Set(
    input.attachments.map((attachment) => basename(attachment.path)),
  );
  const entries = await readdir(store, { withFileTypes: true }).catch(() => []);
  const orphaned = entries.filter(
    (entry) =>
      entry.isFile() &&
      entry.name.startsWith("att_") &&
      !referenced.has(entry.name),
  );
  await Promise.all(
    orphaned.map((entry) => rm(join(store, entry.name), { force: true })),
  );
  return orphaned.map((entry) => entry.name);
}

export function referencedAttachmentsForSessions(sessions: SessionRecord[]) {
  return sessions.flatMap((record) => {
    const checkpoint = [...record.events]
      .reverse()
      .find((event) => event.type === "context.checkpoint");
    const checkpointAttachments =
      checkpoint?.type === "context.checkpoint"
        ? checkpoint.snapshot.entries.flatMap(
            (entry) => entry.attachments ?? [],
          )
        : [];
    return [
      ...checkpointAttachments,
      ...modelVisibleEvents(record.events).flatMap((event) =>
        event.type === "turn.submitted" ? (event.attachments ?? []) : [],
      ),
      ...(record.inbox?.flatMap((input) => input.attachments ?? []) ?? []),
    ];
  });
}

function mediaTypeForBytes(
  bytes: Uint8Array,
  filename: string,
): LocalAttachment["mediaType"] | undefined {
  const header = [...bytes.slice(0, 8)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (header === "89504e470d0a1a0a") return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  )
    return "application/pdf";
  try {
    if (
      !/\.(txt|md|markdown|json|csv|log|yaml|yml|ts|tsx|js|jsx|py|go|rs|java|css|html|xml)$/iu.test(
        filename,
      )
    )
      return undefined;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.includes("\0")) return undefined;
    const trimmed = text.trimStart();
    if (trimmed.startsWith("{") || trimmed.startsWith("["))
      return "application/json";
    return "text/plain";
  } catch {
    // Non-UTF-8 binary is intentionally unsupported.
  }
  return undefined;
}
