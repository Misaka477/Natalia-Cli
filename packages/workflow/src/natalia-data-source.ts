import { open, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

export type NataliaDataSourceKind = "offset" | "timestamp";

export type NataliaDataSource = {
  /** Configuration key, also the watermark source name. */
  name: string;
  path: string;
  kind: NataliaDataSourceKind;
  maxBytes: number;
};

export type NataliaDataSourceRead = {
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
 * Reads the part of an append-only source that this execution has not consumed
 * yet. The source is any growing text file the operator points at: an
 * application log, an exported report, an audit trail, a build record.
 *
 * The position is owned by the runtime, not by the model: the caller passes the
 * committed watermark and receives the next position to stage. That keeps the
 * one genuinely deterministic step of an incremental task away from the least
 * deterministic component.
 */
export async function readDataSourceSince(input: {
  source: NataliaDataSource;
  /** Committed watermark position, as stored in the unattended state. */
  position?: string;
  maxBytes?: number;
  workspaceRoot?: string;
}): Promise<NataliaDataSourceRead> {
  const { source } = input;
  if (source.kind !== "offset")
    throw new Error(
      `data source ${source.name} uses the unsupported watermark kind ${source.kind}`,
    );
  const path = isAbsolute(source.path)
    ? source.path
    : resolve(input.workspaceRoot ?? process.cwd(), source.path);
  const previous = parsePosition(input.position, source.name);
  const size = (await stat(path)).size;
  // A shrunk file means the source was rotated or truncated, so the old offset
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
      `data source ${source} has a non-offset watermark position: ${position}`,
    );
  return Number.parseInt(position, 10);
}
