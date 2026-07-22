import { readdir, realpath, stat } from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";
import { relative, resolve, sep } from "node:path";
import type {
  RuntimeWorkspaceContent,
  RuntimeWorkspaceFileEntry,
} from "@natalia/contracts";

const ignoredDirectories = new Set([
  ".git",
  ".hg",
  ".svn",
  ".natalia",
  ".next",
  ".turbo",
  "__pycache__",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
]);

const catalogs = new Map<
  string,
  { entries: RuntimeWorkspaceFileEntry[]; expiresAt: number }
>();
const maxSearchFileBytes = 1024 * 1024;
const maxReadFileBytes = 1024 * 1024;

export async function findWorkspaceFiles(input: {
  workspaceRoot: string;
  query?: string;
  limit?: number;
}): Promise<RuntimeWorkspaceFileEntry[]> {
  const root = await realpath(input.workspaceRoot);
  const cached = catalogs.get(root);
  const entries =
    cached && cached.expiresAt > Date.now()
      ? cached.entries
      : await refreshWorkspaceFiles(root);
  const query = input.query?.trim().toLowerCase() ?? "";
  return [...entries]
    .filter((entry) => !query || entry.path.toLowerCase().includes(query))
    .sort((left, right) => {
      const leftPrefix = left.path.toLowerCase().startsWith(query) ? 0 : 1;
      const rightPrefix = right.path.toLowerCase().startsWith(query) ? 0 : 1;
      return (
        leftPrefix - rightPrefix ||
        left.path.length - right.path.length ||
        left.path.localeCompare(right.path)
      );
    })
    .slice(0, Math.min(200, Math.max(1, input.limit ?? 50)));
}

export function invalidateWorkspaceFiles(workspaceRoot: string) {
  catalogs.delete(resolve(workspaceRoot));
}

export async function listWorkspaceFiles(input: {
  workspaceRoot: string;
  path?: string;
}): Promise<RuntimeWorkspaceFileEntry[]> {
  const root = await realpath(input.workspaceRoot);
  const directory = await resolveWorkspacePath(root, input.path ?? ".");
  if (!(await stat(directory)).isDirectory())
    throw new Error(`workspace path is not a directory: ${input.path ?? "."}`);
  const children = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      children.map(async (child) => {
        if (child.isDirectory() && ignoredDirectories.has(child.name)) return;
        const path = resolve(directory, child.name);
        const real = await realpath(path).catch(() => undefined);
        if (!real || !contains(root, real)) return;
        const relativePath = relative(root, path).split(sep).join("/");
        if (child.isDirectory())
          return { path: `${relativePath}/`, type: "directory" as const };
        if (child.isFile())
          return { path: relativePath, type: "file" as const };
      }),
    )
  )
    .filter((entry): entry is RuntimeWorkspaceFileEntry => entry !== undefined)
    .sort((left, right) =>
      left.type === right.type
        ? left.path.localeCompare(right.path)
        : left.type === "directory"
          ? -1
          : 1,
    );
}

export async function readWorkspaceFile(input: {
  workspaceRoot: string;
  path: string;
}): Promise<RuntimeWorkspaceContent> {
  const root = await realpath(input.workspaceRoot);
  const path = await resolveWorkspacePath(root, input.path);
  const info = await stat(path);
  if (!info.isFile())
    throw new Error(`workspace path is not a file: ${input.path}`);
  if (info.size > maxReadFileBytes)
    throw new Error(
      `workspace file exceeds ${maxReadFileBytes} bytes: ${input.path}`,
    );
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  const text = decodeUtf8(bytes);
  return {
    path: relative(root, path).split(sep).join("/"),
    content: text ?? Buffer.from(bytes).toString("base64"),
    encoding: text === undefined ? "base64" : "utf8",
    mime: mimeType(path),
  };
}

export async function globWorkspaceFiles(input: {
  workspaceRoot: string;
  pattern: string;
  path?: string;
  limit?: number;
}): Promise<RuntimeWorkspaceFileEntry[]> {
  if (
    !input.pattern ||
    input.pattern.includes("..") ||
    input.pattern.startsWith("/")
  )
    throw new Error("workspace glob pattern must remain inside workspace");
  const root = await realpath(input.workspaceRoot);
  const directory = await resolveWorkspacePath(root, input.path ?? ".");
  if (!(await stat(directory)).isDirectory())
    throw new Error(`workspace path is not a directory: ${input.path ?? "."}`);
  const limit = Math.min(200, Math.max(1, input.limit ?? 50));
  const entries: RuntimeWorkspaceFileEntry[] = [];
  for await (const relativePath of new Bun.Glob(input.pattern).scan({
    cwd: directory,
    onlyFiles: true,
  })) {
    if (entries.length >= limit) break;
    if (isIgnored(relativePath)) continue;
    const path = resolve(directory, relativePath);
    const real = await realpath(path).catch(() => undefined);
    if (!real || !contains(root, real)) continue;
    entries.push({
      path: relative(root, path).split(sep).join("/"),
      type: "file",
    });
  }
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

export async function watchWorkspaceFiles(
  workspaceRoot: string,
  onChange: () => void,
) {
  const root = await realpath(workspaceRoot);
  let watchers: FSWatcher[] = [];
  let closed = false;
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;

  const refresh = async () => {
    if (closed) return;
    watchers.forEach((watcher) => watcher.close());
    watchers = await watchDirectories(root, root, trigger);
  };
  const trigger = () => {
    invalidateWorkspaceFiles(root);
    onChange();
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => void refresh(), 50);
  };
  await refresh();
  return () => {
    closed = true;
    if (refreshTimer) clearTimeout(refreshTimer);
    watchers.forEach((watcher) => watcher.close());
    watchers = [];
  };
}

export async function searchWorkspaceFiles(input: {
  workspaceRoot: string;
  query: string;
  include?: string;
  limit?: number;
}) {
  if (!input.query.trim())
    throw new Error("workspace search query is required");
  const expression = new RegExp(input.query, "u");
  const root = await realpath(input.workspaceRoot);
  const limit = Math.min(200, Math.max(1, input.limit ?? 50));
  const files = await findWorkspaceFiles({ workspaceRoot: root, limit: 200 });
  const matches: Array<{ path: string; line: number; text: string }> = [];
  for (const file of files) {
    if (matches.length >= limit) break;
    if (file.type !== "file" || !matchesInclude(file.path, input.include))
      continue;
    const content = await readSearchText(resolve(root, file.path));
    if (content === undefined) continue;
    for (const [index, line] of content.split(/\r?\n/u).entries()) {
      expression.lastIndex = 0;
      if (!expression.test(line)) continue;
      matches.push({
        path: file.path,
        line: index + 1,
        text: line.length > 2_000 ? `${line.slice(0, 2_000)}...` : line,
      });
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

async function refreshWorkspaceFiles(root: string) {
  const entries: RuntimeWorkspaceFileEntry[] = [];
  await collect(root, root, entries, 10_000);
  catalogs.set(root, { entries, expiresAt: Date.now() + 1_000 });
  return entries;
}

async function collect(
  root: string,
  directory: string,
  output: RuntimeWorkspaceFileEntry[],
  maxEntries: number,
): Promise<void> {
  if (output.length >= maxEntries) return;
  const children = await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  );
  for (const child of children) {
    if (output.length >= maxEntries) return;
    if (child.isDirectory() && ignoredDirectories.has(child.name)) continue;
    const path = resolve(directory, child.name);
    const real = await realpath(path).catch(() => undefined);
    if (!real || !contains(root, real)) continue;
    const relativePath = relative(root, path).split(sep).join("/");
    if (!relativePath) continue;
    if (child.isDirectory()) {
      output.push({ path: `${relativePath}/`, type: "directory" });
      await collect(root, real, output, maxEntries);
      continue;
    }
    if (child.isFile()) output.push({ path: relativePath, type: "file" });
  }
}

async function watchDirectories(
  root: string,
  directory: string,
  onChange: () => void,
): Promise<FSWatcher[]> {
  const watchers: FSWatcher[] = [];
  const children = await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  );
  try {
    watchers.push(watch(directory, { persistent: false }, onChange));
  } catch {
    return watchers;
  }
  for (const child of children) {
    if (!child.isDirectory() || ignoredDirectories.has(child.name)) continue;
    const path = resolve(directory, child.name);
    const real = await realpath(path).catch(() => undefined);
    if (!real || !contains(root, real)) continue;
    watchers.push(...(await watchDirectories(root, real, onChange)));
  }
  return watchers;
}

function contains(root: string, target: string) {
  return target === root || target.startsWith(`${root}${sep}`);
}

async function resolveWorkspacePath(root: string, input: string) {
  if (!input || input.startsWith("/") || input.split(/[\\/]/u).includes(".."))
    throw new Error("workspace path must remain inside workspace");
  const path = resolve(root, input);
  if (!contains(root, path))
    throw new Error("workspace path must remain inside workspace");
  const real = await realpath(path).catch(() => undefined);
  if (!real || !contains(root, real))
    throw new Error("workspace path must remain inside workspace");
  if (isIgnored(relative(root, real)))
    throw new Error("workspace path is ignored by filesystem policy");
  return real;
}

function isIgnored(path: string) {
  return path.split(/[\\/]/u).some((part) => ignoredDirectories.has(part));
}

function decodeUtf8(bytes: Uint8Array) {
  if (bytes.includes(0)) return undefined;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

function mimeType(path: string) {
  const extension = path.split(".").at(-1)?.toLowerCase();
  if (extension === "json") return "application/json";
  if (extension === "ts" || extension === "tsx") return "text/typescript";
  if (extension === "js" || extension === "jsx") return "text/javascript";
  if (extension === "md") return "text/markdown";
  if (extension === "html") return "text/html";
  if (extension === "css") return "text/css";
  return "text/plain";
}

async function readSearchText(path: string) {
  const file = Bun.file(path);
  if ((await file.size) > maxSearchFileBytes) return undefined;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.includes(0)) return undefined;
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function matchesInclude(path: string, include?: string) {
  if (!include) return true;
  const suffix = include.replace(/^\*\*/u, "").replace(/^\*/u, "");
  return path.endsWith(suffix);
}
