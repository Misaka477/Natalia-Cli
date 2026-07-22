import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";
import { relative, resolve, sep } from "node:path";
import fuzzysort from "fuzzysort";
import type {
  RuntimeWorkspaceContent,
  RuntimeWorkspaceFileEntry,
  RuntimeWorkspaceListPage,
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

type IgnoreRule = {
  base: string;
  directoryOnly: boolean;
  negated: boolean;
  pattern: RegExp;
};

const catalogs = new Map<
  string,
  {
    entries: RuntimeWorkspaceFileEntry[];
    expiresAt: number;
    ignoreRules: IgnoreRule[];
  }
>();
const maxSearchFileBytes = 1024 * 1024;
const maxReadFileBytes = 1024 * 1024;
const maxMediaIngestBytes = 20 * 1024 * 1024;
const maxReadPageBytes = 50 * 1024;
const maxReadLines = 2_000;
const maxReadLineChars = 2_000;

export async function findWorkspaceFiles(input: {
  workspaceRoot: string;
  query?: string;
  type?: "file" | "directory";
  limit?: number;
}): Promise<RuntimeWorkspaceFileEntry[]> {
  const root = await realpath(input.workspaceRoot);
  const cached = catalogs.get(root);
  const catalog =
    cached && cached.expiresAt > Date.now()
      ? cached
      : await refreshWorkspaceFiles(root);
  const query = input.query?.trim().toLowerCase() ?? "";
  const entries = input.type
    ? catalog.entries.filter((entry) => entry.type === input.type)
    : catalog.entries;
  if (!query)
    return [...entries]
      .sort(
        (left, right) =>
          left.path.length - right.path.length ||
          left.path.localeCompare(right.path),
      )
      .slice(0, Math.min(200, Math.max(1, input.limit ?? 50)));
  const results = fuzzysort.go(query, entries, {
    key: "path",
    limit: Math.min(200, Math.max(1, input.limit ?? 50)),
  });
  return results.map((result) => result.obj);
}

export function invalidateWorkspaceFiles(workspaceRoot: string) {
  catalogs.delete(resolve(workspaceRoot));
}

export async function listWorkspaceFiles(input: {
  workspaceRoot: string;
  path?: string;
  offset?: number;
  limit?: number;
}): Promise<RuntimeWorkspaceListPage> {
  const root = await realpath(input.workspaceRoot);
  const catalog = await workspaceCatalog(root);
  const directory = await resolveWorkspacePath(root, input.path ?? ".");
  if (!(await stat(directory)).isDirectory())
    throw new Error(`workspace path is not a directory: ${input.path ?? "."}`);
  const children = await readdir(directory, { withFileTypes: true });
  const entries = (
    await Promise.all(
      children.map(async (child) => {
        const candidatePath = relative(root, resolve(directory, child.name))
          .split(sep)
          .join("/");
        if (isIgnored(candidatePath, child.isDirectory(), catalog.ignoreRules))
          return;
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
  const offset = Math.max(1, input.offset ?? 1);
  const limit = Math.min(200, Math.max(1, input.limit ?? 50));
  const selected = entries.slice(offset - 1, offset - 1 + limit);
  const truncated = offset - 1 + selected.length < entries.length;
  return {
    entries: selected,
    truncated,
    ...(truncated ? { next: offset + selected.length } : {}),
  };
}

export async function readWorkspaceFile(input: {
  workspaceRoot: string;
  path: string;
  offset?: number;
  limit?: number;
}): Promise<RuntimeWorkspaceContent> {
  const root = await realpath(input.workspaceRoot);
  const path = await resolveWorkspacePath(root, input.path);
  const info = await stat(path);
  if (!info.isFile())
    throw new Error(`workspace path is not a file: ${input.path}`);
  const header = new Uint8Array(
    await Bun.file(path).slice(0, 12).arrayBuffer(),
  );
  const media = imageMime(header);
  if (media && info.size > maxMediaIngestBytes)
    throw new Error(
      `workspace media exceeds ${maxMediaIngestBytes} bytes: ${input.path}`,
    );
  if (!media && info.size > maxReadFileBytes)
    throw new Error(
      `workspace file exceeds ${maxReadFileBytes} bytes: ${input.path}`,
    );
  const bytes = new Uint8Array(await Bun.file(path).arrayBuffer());
  if (media)
    return {
      path: relative(root, path).split(sep).join("/"),
      content: Buffer.from(bytes).toString("base64"),
      encoding: "base64",
      mime: media,
    };
  const text = decodeUtf8(bytes);
  if (
    text !== undefined &&
    (bytes.length > maxReadPageBytes || input.offset || input.limit)
  ) {
    const offset = Math.max(1, input.offset ?? 1);
    const limit = Math.min(
      maxReadLines,
      Math.max(1, input.limit ?? maxReadLines),
    );
    const lines = text.endsWith("\n")
      ? text.slice(0, -1).replace(/\r$/u, "").split(/\r?\n/u)
      : text.split(/\r?\n/u);
    const selected: string[] = [];
    let usedBytes = 0;
    let next: number | undefined;
    for (let index = offset - 1; index < lines.length; index++) {
      if (selected.length >= limit) {
        next = index + 1;
        break;
      }
      const line = lines[index]!.slice(0, maxReadLineChars);
      const lineBytes =
        Buffer.byteLength(line, "utf8") + (selected.length ? 1 : 0);
      if (usedBytes + lineBytes > maxReadPageBytes) {
        next = index + 1;
        break;
      }
      selected.push(line);
      usedBytes += lineBytes;
    }
    if (!selected.length && offset > lines.length)
      throw new Error(`workspace read offset is out of range: ${offset}`);
    return {
      path: relative(root, path).split(sep).join("/"),
      content: selected.join("\n"),
      encoding: "utf8",
      mime: mimeType(path),
      offset,
      truncated: next !== undefined,
      ...(next === undefined ? {} : { next }),
    };
  }
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
  const catalog = await workspaceCatalog(root);
  const entries: RuntimeWorkspaceFileEntry[] = [];
  for await (const relativePath of new Bun.Glob(input.pattern).scan({
    cwd: directory,
    onlyFiles: true,
  })) {
    if (entries.length >= limit) break;
    if (
      isIgnored(
        relative(root, resolve(directory, relativePath)).split(sep).join("/"),
        false,
        catalog.ignoreRules,
      )
    )
      continue;
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
    const catalog = await workspaceCatalog(root);
    watchers = await watchDirectories(
      root,
      root,
      trigger,
      catalog.ignoreRules,
      new Set([root]),
    );
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
  let expression: RegExp;
  try {
    expression = new RegExp(input.query, "u");
  } catch {
    throw new Error(
      "workspace search query must be a valid regular expression",
    );
  }
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
  const ignoreRules = await loadIgnoreRules(root);
  const entries: RuntimeWorkspaceFileEntry[] = [];
  await collect(root, root, entries, 10_000, ignoreRules, new Set([root]));
  const catalog = { entries, expiresAt: Date.now() + 1_000, ignoreRules };
  catalogs.set(root, catalog);
  return catalog;
}

async function workspaceCatalog(root: string) {
  const cached = catalogs.get(root);
  if (cached && cached.expiresAt > Date.now()) return cached;
  return await refreshWorkspaceFiles(root);
}

async function collect(
  root: string,
  directory: string,
  output: RuntimeWorkspaceFileEntry[],
  maxEntries: number,
  ignoreRules: IgnoreRule[],
  visited: Set<string>,
): Promise<void> {
  if (output.length >= maxEntries) return;
  const children = await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  );
  for (const child of children) {
    if (output.length >= maxEntries) return;
    const path = resolve(directory, child.name);
    const real = await realpath(path).catch(() => undefined);
    if (!real || !contains(root, real)) continue;
    const relativePath = relative(root, path).split(sep).join("/");
    if (!relativePath) continue;
    const ignored = isIgnored(relativePath, child.isDirectory(), ignoreRules);
    if (ignored && !child.isDirectory()) continue;
    if (child.isDirectory()) {
      if (!ignored)
        output.push({ path: `${relativePath}/`, type: "directory" });
      if (
        (!ignored || ignoreRules.some((rule) => rule.negated)) &&
        !visited.has(real)
      ) {
        visited.add(real);
        await collect(root, real, output, maxEntries, ignoreRules, visited);
      }
      continue;
    }
    if (child.isFile()) output.push({ path: relativePath, type: "file" });
  }
}

async function watchDirectories(
  root: string,
  directory: string,
  onChange: () => void,
  ignoreRules: IgnoreRule[],
  visited: Set<string>,
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
    if (!child.isDirectory()) continue;
    const path = resolve(directory, child.name);
    const real = await realpath(path).catch(() => undefined);
    if (!real || !contains(root, real) || visited.has(real)) continue;
    const relativePath = relative(root, path).split(sep).join("/");
    if (
      isIgnored(relativePath, true, ignoreRules) &&
      !ignoreRules.some((rule) => rule.negated)
    )
      continue;
    visited.add(real);
    watchers.push(
      ...(await watchDirectories(root, real, onChange, ignoreRules, visited)),
    );
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
  const catalog = await workspaceCatalog(root);
  const info = await stat(real);
  if (isIgnored(relative(root, real), info.isDirectory(), catalog.ignoreRules))
    throw new Error("workspace path is ignored by filesystem policy");
  return real;
}

function isIgnored(path: string, directory: boolean, rules: IgnoreRule[]) {
  const normalized = path.split(/[\\/]/u).join("/");
  if (normalized.split("/").some((part) => ignoredDirectories.has(part)))
    return true;
  return rules.reduce<boolean>((ignored, rule) => {
    if (
      rule.base &&
      normalized !== rule.base &&
      !normalized.startsWith(`${rule.base}/`)
    )
      return ignored;
    const relativePath = normalized.slice(rule.base.length).replace(/^\//u, "");
    if (
      !relativePath ||
      (rule.directoryOnly && !directory && !relativePath.includes("/"))
    )
      return ignored;
    if (!rule.pattern.test(relativePath)) return ignored;
    return !rule.negated;
  }, false);
}

async function loadIgnoreRules(root: string) {
  const rules: IgnoreRule[] = [];
  await collectIgnoreRules(root, root, rules, new Set([root]));
  return rules;
}

async function collectIgnoreRules(
  root: string,
  directory: string,
  rules: IgnoreRule[],
  visited: Set<string>,
): Promise<void> {
  const relativeDirectory = relative(root, directory).split(sep).join("/");
  const ignorePath = resolve(directory, ".gitignore");
  const contents = await readFile(ignorePath, "utf8").catch(() => undefined);
  if (contents !== undefined) {
    for (const line of contents.split(/\r?\n/u)) {
      const rule = parseIgnoreRule(line, relativeDirectory);
      if (rule) rules.push(rule);
    }
  }
  const children = await readdir(directory, { withFileTypes: true }).catch(
    () => [],
  );
  for (const child of children) {
    if (!child.isDirectory() || ignoredDirectories.has(child.name)) continue;
    const childPath = resolve(directory, child.name);
    const real = await realpath(childPath).catch(() => undefined);
    if (!real || !contains(root, real) || visited.has(real)) continue;
    visited.add(real);
    await collectIgnoreRules(root, real, rules, visited);
  }
}

function parseIgnoreRule(line: string, base: string): IgnoreRule | undefined {
  const value = line.trimEnd();
  if (!value || value.startsWith("#")) return;
  const negated = value.startsWith("!") && !value.startsWith("\\!");
  const rawPattern = (negated ? value.slice(1) : value).replace(
    /^\\([#!])/u,
    "$1",
  );
  const directoryOnly = rawPattern.endsWith("/");
  const anchored = rawPattern.startsWith("/");
  const pattern = rawPattern.replace(/^\//u, "").replace(/\/$/u, "");
  if (!pattern) return;
  const body = globExpression(pattern);
  const prefix = anchored || pattern.includes("/") ? "^" : "^(?:.*/)?";
  return {
    base,
    directoryOnly,
    negated,
    pattern: new RegExp(`${prefix}${body}(?:/.*)?$`, "u"),
  };
}

function globExpression(pattern: string) {
  let expression = "";
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index];
    const next = pattern[index + 1];
    if (character === "*" && next === "*") {
      index++;
      if (pattern[index + 1] === "/") {
        index++;
        expression += "(?:.*/)?";
        continue;
      }
      expression += ".*";
      continue;
    }
    if (character === "*") {
      expression += "[^/]*";
      continue;
    }
    if (character === "?") {
      expression += "[^/]";
      continue;
    }
    expression += character.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&");
  }
  return expression;
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
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "gif") return "image/gif";
  if (extension === "webp") return "image/webp";
  return "text/plain";
}

function imageMime(bytes: Uint8Array) {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])
  )
    return "image/webp";
}

function startsWith(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((value, index) => bytes[index] === value);
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
  const prefix = include.includes("/") ? "" : "(?:.*/)?";
  return new RegExp(`^${prefix}${globExpression(include)}$`, "u").test(path);
}
