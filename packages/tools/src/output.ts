import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const MAX_TOOL_OUTPUT_BYTES = 50 * 1024;
export const MAX_TOOL_OUTPUT_LINES = 2_000;
export const TOOL_OUTPUT_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

export type BoundedToolOutput = {
  text: string;
  outputPath?: string;
};

export async function boundToolOutput(
  workspaceRoot: string,
  output: string,
): Promise<BoundedToolOutput> {
  if (
    new TextEncoder().encode(output).byteLength <= MAX_TOOL_OUTPUT_BYTES &&
    output.split("\n").length <= MAX_TOOL_OUTPUT_LINES
  )
    return { text: output };

  const directory = join(workspaceRoot, ".natalia", "tool-output");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const outputPath = join(directory, `tool-${randomUUID()}.log`);
  await writeFile(outputPath, output, { encoding: "utf8", mode: 0o600, flag: "wx" });
  const marker = `... output truncated; full content saved to ${outputPath} ...`;
  return { text: preview(output, marker), outputPath };
}

export async function cleanupToolOutput(workspaceRoot: string, now = Date.now()) {
  const directory = join(workspaceRoot, ".natalia", "tool-output");
  let entries: string[];
  try {
    entries = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
  let removed = 0;
  for (const entry of entries) {
    if (!/^tool-[0-9a-f-]+\.log$/u.test(entry)) continue;
    const path = join(directory, entry);
    const info = await stat(path);
    if (now - info.mtimeMs < TOOL_OUTPUT_RETENTION_MS) continue;
    await rm(path);
    removed++;
  }
  return removed;
}

function preview(output: string, marker: string) {
  const lines = output.split("\n");
  const markerBytes = new TextEncoder().encode(marker).byteLength;
  const contentBytes = Math.max(0, MAX_TOOL_OUTPUT_BYTES - markerBytes - 4);
  const head = takeBytes(
    lines.slice(0, Math.ceil((MAX_TOOL_OUTPUT_LINES - 3) / 2)).join("\n"),
    Math.ceil(contentBytes / 2),
  );
  const tail = takeBytes(
    lines.slice(-Math.floor((MAX_TOOL_OUTPUT_LINES - 3) / 2)).join("\n"),
    Math.floor(contentBytes / 2),
  );
  return `${head}\n\n${marker}\n\n${tail}`;
}

function takeBytes(value: string, maximum: number) {
  let bytes = 0;
  let result = "";
  for (const char of value) {
    const size = new TextEncoder().encode(char).byteLength;
    if (bytes + size > maximum) break;
    result += char;
    bytes += size;
  }
  return result;
}
