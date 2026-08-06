import { open, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

export type NataliaDataSourceKind = "offset" | "timestamp";

export type NataliaDataSource = {
  /** Configuration key, also the watermark source name. */
  name: string;
  path: string;
  kind: NataliaDataSourceKind;
  maxBytes: number;
  /** Required by the timestamp kind: JSON field holding each line's time. */
  timestampField?: string;
};

export type NataliaDataSourceRead = {
  source: string;
  kind: NataliaDataSourceKind;
  /** Byte offset the read started from. */
  from: number;
  /** Byte offset the read ended at. */
  to: number;
  size: number;
  /** The file shrank, so the previous position no longer exists. */
  rotated: boolean;
  /** More content is already available beyond this read. */
  remaining: number;
  /** Watermark the caller should stage after consuming this content. Empty when the source held nothing to advance past. */
  position: string;
  /** Committed watermark this read continued from, when there was one. */
  since?: string;
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
 *
 * Two watermark kinds, for two different failure modes:
 *
 * - `offset` counts bytes. Exact and cheap, but a rotated file invalidates it,
 *   which is handled by rereading from the start.
 * - `timestamp` reads each line's own time out of a named JSON field. Rotation
 *   stops mattering, at the cost of requiring structured lines. Delivery is
 *   at-least-once: lines sharing the watermark's exact time are read again
 *   rather than risk dropping a sibling line written in the same instant.
 */
export async function readDataSourceSince(input: {
  source: NataliaDataSource;
  /** Committed watermark position, as stored in the unattended state. */
  position?: string;
  maxBytes?: number;
  workspaceRoot?: string;
}): Promise<NataliaDataSourceRead> {
  const { source } = input;
  const path = isAbsolute(source.path)
    ? source.path
    : resolve(input.workspaceRoot ?? process.cwd(), source.path);
  const size = (await stat(path)).size;
  const limit = Math.max(
    1,
    Math.min(input.maxBytes ?? source.maxBytes, source.maxBytes),
  );
  return source.kind === "timestamp"
    ? readByTimestamp({ source, path, size, limit, position: input.position })
    : readByOffset({ source, path, size, limit, position: input.position });
}

async function readByOffset(input: {
  source: NataliaDataSource;
  path: string;
  size: number;
  limit: number;
  position?: string;
}) {
  const previous = parseOffset(input.position, input.source.name);
  // A shrunk file means the source was rotated or truncated, so the old offset
  // points at content that no longer exists. Restarting from the beginning
  // reprocesses data, which is the safe direction; skipping ahead would lose it.
  const rotated = previous > input.size;
  const from = rotated ? 0 : previous;
  const length = Math.min(input.limit, input.size - from);
  const content = length > 0 ? await readSlice(input.path, from, length) : "";
  const to = from + length;
  return {
    source: input.source.name,
    kind: "offset" as const,
    from,
    to,
    size: input.size,
    rotated,
    remaining: Math.max(0, input.size - to),
    position: String(to),
    ...(input.position === undefined ? {} : { since: input.position }),
    content,
  };
}

async function readByTimestamp(input: {
  source: NataliaDataSource;
  path: string;
  size: number;
  limit: number;
  position?: string;
}) {
  const field = input.source.timestampField;
  if (!field)
    throw new Error(
      `data source ${input.source.name} uses timestamp watermarks without a timestampField`,
    );
  const since =
    input.position === undefined
      ? undefined
      : parseTimestamp(input.position, input.source.name, "watermark");
  // The newest lines are at the end, so a bounded read has to be a tail read.
  // Reading the head would return the same old lines forever once the file grows
  // past the limit.
  const from = Math.max(0, input.size - input.limit);
  const window =
    input.size > 0 ? await readSlice(input.path, from, input.size - from) : "";
  const lines = completeLines(window, from > 0);
  const parsed = lines.map((line) => ({
    line,
    at: lineTimestamp(line, field, input.source.name),
  }));
  if (since !== undefined && from > 0 && parsed.length && parsed[0]!.at > since)
    // The window starts after the watermark, so lines between them were never
    // read. Failing is the only honest option: advancing here would drop data
    // silently, which is exactly what a watermark exists to prevent.
    throw new Error(
      `data source ${input.source.name} would skip content before ${new Date(parsed[0]!.at).toISOString()}; raise maxBytes or read more often`,
    );
  const selected =
    since === undefined ? parsed : parsed.filter((entry) => entry.at >= since);
  const newest = parsed.reduce(
    (latest, entry) => (entry.at > latest ? entry.at : latest),
    since ?? Number.NEGATIVE_INFINITY,
  );
  return {
    source: input.source.name,
    kind: "timestamp" as const,
    from,
    to: input.size,
    size: input.size,
    // A rotated file is not special here: its lines simply carry their own time,
    // and anything at or after the watermark is read again.
    rotated: false,
    remaining: 0,
    position:
      newest === Number.NEGATIVE_INFINITY
        ? (input.position ?? "")
        : new Date(newest).toISOString(),
    ...(input.position === undefined ? {} : { since: input.position }),
    content: selected.map((entry) => entry.line).join("\n"),
  };
}

/**
 * Only newline-terminated lines are complete. A trailing fragment means the
 * writer is mid-append, so it is left for the next read instead of being parsed
 * into a hard error. A tail read also drops its first line, which begins before
 * the window.
 */
function completeLines(window: string, dropFirst: boolean) {
  const lines = window.split("\n");
  lines.pop();
  if (dropFirst) lines.shift();
  return lines.filter((line) => line.trim().length > 0);
}

function lineTimestamp(line: string, field: string, source: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    throw new Error(
      `data source ${source} expects JSON lines for timestamp watermarks, and one line is not JSON`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error(
      `data source ${source} expects one JSON object per line for timestamp watermarks`,
    );
  const value = (parsed as Record<string, unknown>)[field];
  if (value === undefined || value === null)
    throw new Error(
      `data source ${source} has a line without the timestamp field ${field}`,
    );
  if (typeof value !== "string")
    // Epoch numbers would force a guess between seconds and milliseconds, and a
    // wrong guess moves the watermark decades. The operator writes ISO-8601.
    throw new Error(
      `data source ${source} needs an ISO-8601 string in field ${field}`,
    );
  return parseTimestamp(value, source, `field ${field}`);
}

function parseTimestamp(value: string, source: string, origin: string) {
  const at = Date.parse(value);
  if (!Number.isFinite(at))
    throw new Error(
      `data source ${source} has an unparsable timestamp in ${origin}: ${value}`,
    );
  return at;
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

function parseOffset(position: string | undefined, source: string) {
  if (position === undefined) return 0;
  if (!/^\d+$/u.test(position))
    throw new Error(
      `data source ${source} has a non-offset watermark position: ${position}`,
    );
  return Number.parseInt(position, 10);
}
