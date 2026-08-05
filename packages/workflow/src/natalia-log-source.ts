import { open, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

export type NataliaLogSourceKind = "offset" | "timestamp";

export type NataliaLogSource = {
  /** Configuration key, also the watermark source name. */
  name: string;
  path: string;
  kind: NataliaLogSourceKind;
  maxBytes: number;
};

export type NataliaLogSourceRead = {
  source: string;
  /** Byte offset the read started from. */
  from: number;
  /** Byte offset the next read should start from. */
  to: number;
  size: number;
  /** The file shrank, so the previous position no longer exists. */
  rotated: boolean;
  /** More content is already available beyond this read. */
  remaining: number;
  content: string;
};

/**
 * Reads the part of a log that this execution has not consumed yet.
 *
 * The position is owned by the runtime, not by the model: the caller passes the
 * committed watermark and receives the next position to stage. That keeps the
 * one genuinely deterministic step of an unattended log scan away from the least
 * deterministic component.
 */
export async function readLogSourceSince(input: {
  source: NataliaLogSource;
  /** Committed watermark position, as stored in the unattended state. */
  position?: string;
  maxBytes?: number;
  workspaceRoot?: string;
}): Promise<NataliaLogSourceRead> {
  const { source } = input;
  if (source.kind !== "offset")
    throw new Error(
      `log source ${source.name} uses the unsupported watermark kind ${source.kind}`,
    );
  const path = isAbsolute(source.path)
    ? source.path
    : resolve(input.workspaceRoot ?? process.cwd(), source.path);
  const previous = parsePosition(input.position, source.name);
  const size = (await stat(path)).size;
  // A shrunk file means the log was rotated or truncated, so the old offset
  // points at content that no longer exists. Restarting from the beginning
  // reprocesses data, which is the safe direction; skipping ahead would lose it.
  const rotated = previous > size;
  const from = rotated ? 0 : previous;
  const limit = Math.max(
    1,
    Math.min(input.maxBytes ?? source.maxBytes, source.maxBytes),
  );
  const length = Math.min(limit, size - from);
  const content = length > 0 ? await readSlice(path, from, length) : "";
  const to = from + length;
  return {
    source: source.name,
    from,
    to,
    size,
    rotated,
    remaining: Math.max(0, size - to),
    content,
  };
}

async function readSlice(path: string, from: number, length: number) {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, from);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

function parsePosition(position: string | undefined, source: string) {
  if (position === undefined) return 0;
  if (!/^\d+$/u.test(position))
    throw new Error(
      `log source ${source} has a non-offset watermark position: ${position}`,
    );
  return Number.parseInt(position, 10);
}
