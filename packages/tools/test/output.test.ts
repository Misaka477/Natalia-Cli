import { mkdtemp, readFile, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, test } from "bun:test";
import {
  boundToolOutput,
  cleanupToolOutput,
  MAX_TOOL_OUTPUT_BYTES,
  TOOL_OUTPUT_RETENTION_MS,
} from "../src";

test("tool output retention preserves complete output and bounds the preview", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-output-"));
  const output = `HEAD\n${"x".repeat(MAX_TOOL_OUTPUT_BYTES)}\nTAIL`;
  const bounded = await boundToolOutput(root, output);

  expect(bounded.outputPath).toBeDefined();
  expect(bounded.text).toContain("output truncated");
  expect(new TextEncoder().encode(bounded.text).byteLength).toBeLessThanOrEqual(MAX_TOOL_OUTPUT_BYTES);
  expect(await readFile(bounded.outputPath!, "utf8")).toBe(output);
});

test("small tool output remains inline without a managed file", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-output-small-"));
  expect(await boundToolOutput(root, "complete result")).toEqual({ text: "complete result" });
});

test("tool output cleanup removes only expired managed output files", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-output-cleanup-"));
  const directory = join(root, ".natalia", "tool-output");
  const old = join(directory, "tool-00000000-0000-0000-0000-000000000000.log");
  const recent = join(directory, "tool-11111111-1111-1111-1111-111111111111.log");
  const unrelated = join(directory, "keep.txt");
  await boundToolOutput(root, "x".repeat(MAX_TOOL_OUTPUT_BYTES + 1));
  await writeFile(old, "old");
  await writeFile(recent, "recent");
  await writeFile(unrelated, "keep");
  const expired = new Date(Date.now() - TOOL_OUTPUT_RETENTION_MS - 1);
  await utimes(old, expired, expired);

  expect(await cleanupToolOutput(root)).toBe(1);
  await expect(readFile(old, "utf8")).rejects.toThrow();
  expect(await readFile(recent, "utf8")).toBe("recent");
  expect(await readFile(unrelated, "utf8")).toBe("keep");
});
