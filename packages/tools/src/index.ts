import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { SubagentRegistry } from "@natalia/subagent";
import {
  detachedShellPrefix,
  isWindows,
  processTreeKillCommand,
  profileShellCommand,
  shellQuote,
  startDetachedProcess,
} from "@natalia/platform";
import {
  NativeTerminalRegistry,
  type NativeTerminalSession,
} from "@natalia/native-terminal";
import { WorkspaceSandboxManager } from "@natalia/sandbox";

import { agentTools } from "./agent-tools";
import { sandboxTools } from "./sandbox-tools";
import { terminalTools } from "./terminal-tools";
export { validateToolParameters, assertValidToolParameters } from "./validate";
export {
  boundToolOutput,
  cleanupToolOutput,
  MAX_TOOL_OUTPUT_BYTES,
  MAX_TOOL_OUTPUT_LINES,
  TOOL_OUTPUT_RETENTION_MS,
} from "./output";
import {
  numberOr,
  optionalInteger,
  optionalString,
  positiveNumberOr,
  positiveNumberOrUndefined,
  requireObject,
  requireString,
  workspacePath,
} from "./arguments";
import {
  isProcessRunning,
  ownsProcess,
  processFingerprint,
  readOptionalFile,
  safeToolEnv,
  sendProcessSignal,
  stopProcessTree,
  terminateChildProcessTree,
  truncateProcessOutput,
} from "./child-process";
import { ManagedProcessRegistry, managedProcessTools } from "./managed-process";
import type { RuntimeTool, ToolExecutionContext } from "./types";

export type {
  RuntimeTool,
  ToolExecutionBoundary,
  ToolExecutionContext,
  ToolSchema,
} from "./types";

export {
  ManagedProcessRegistry,
  type ManagedProcessInfo,
  type ManagedProcessStatus,
} from "./managed-process";
import {
  encodeTerminalKey,
  nativeTerminalReadPage,
  nativeTerminalSearchPage,
} from "./terminal-io";

export {
  encodeTerminalKey,
  nativeTerminalReadPage,
  nativeTerminalSearchPage,
} from "./terminal-io";

export { materializeTools } from "./invocation";
export type {
  ToolInvocation,
  ToolMaterialization,
  ToolSettlement,
} from "./invocation";
export class ToolRegistry extends Map<string, RuntimeTool> {
  private readonly aliases = new Map<string, string>();

  addAlias(alias: string, target: string) {
    if (!super.has(target))
      throw new Error(`cannot alias unknown tool: ${target}`);
    this.aliases.set(alias, target);
  }

  override get(name: string) {
    return super.get(this.aliases.get(name) ?? name);
  }

  override has(name: string) {
    return super.has(this.aliases.get(name) ?? name);
  }
}

export function createToolRegistry(
  tools?: RuntimeTool[],
  processRegistry?: ManagedProcessRegistry,
): ToolRegistry {
  const registry = new ToolRegistry(
    (tools ?? defaultTools(processRegistry)).map((tool) => [tool.name, tool]),
  );
  if (!tools)
    for (const [alias, target] of Object.entries(
      interactiveTerminalToolAliases,
    ))
      registry.addAlias(alias, target);
  return registry;
}

const interactiveTerminalToolAliases = {
  interactive_start: "interactive_terminal_start",
  interactive_read: "interactive_terminal_read",
  interactive_search: "interactive_terminal_search",
  interactive_write: "interactive_terminal_write",
  interactive_send_line: "interactive_terminal_send_line",
  interactive_keys: "interactive_terminal_keys",
  interactive_input: "interactive_terminal_input",
  interactive_snapshot: "interactive_terminal_snapshot",
  interactive_resize: "interactive_terminal_resize",
  interactive_stop: "interactive_terminal_stop",
  interactive_list: "interactive_terminal_list",
} as const;

export function defaultTools(
  processRegistry = new ManagedProcessRegistry(),
): RuntimeTool[] {
  const tools: RuntimeTool[] = [
    readFileTool(),
    writeFileTool(),
    editFileTool(),
    globTool(),
    grepTool(),
    todoReadTool(),
    todoWriteTool(),
    planTool(),
    askUserTool(),
    ...agentTools(),
    ...terminalTools(),
    ...sandboxTools(),
    runShellTool(),
    ...managedProcessTools(processRegistry),
    webFetchTool(),
    webSearchTool(),
    readMediaFileTool(),
    browserVisitTool(),
    browserScreenshotTool(),
  ];

  return tools;
}

function planTool(): RuntimeTool {
  return {
    name: "plan",
    description: "Create or update the durable workspace execution plan.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { items: { type: "array" } },
      required: ["items"],
      additionalProperties: false,
    },
    async execute(input, context) {
      return await todoWriteTool().execute(input, context);
    },
  };
}

function globTool(): RuntimeTool {
  return {
    name: "glob",
    description: "List workspace files matching a Bun glob pattern.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      },
      required: ["pattern"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const pattern = requireString(args.pattern, "pattern");
      if (isAbsolute(pattern) || pattern.includes(".."))
        throw new Error("glob pattern must remain inside workspace");
      const paths: string[] = [];
      for await (const path of new Bun.Glob(pattern).scan({
        cwd: context.workspaceRoot,
        onlyFiles: true,
      }))
        paths.push(path);
      paths.sort();
      const offset = Math.max(0, numberOr(args.offset, 0));
      const limit = Math.min(1000, Math.max(1, numberOr(args.limit, 200)));
      const page = paths.slice(offset, offset + limit);
      await context.workspaceReadAuthorize?.({ toolName: "glob", paths: page });
      return [
        ...page,
        paths.length > offset + limit
          ? `... ${paths.length - offset - limit} more; use offset=${offset + limit}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    },
  };
}

function grepTool(): RuntimeTool {
  return {
    name: "grep",
    description: "Search UTF-8 workspace files with a regular expression.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        include: { type: "string" },
        limit: { type: "number" },
      },
      required: ["pattern"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const expression = new RegExp(
        requireString(args.pattern, "pattern"),
        "u",
      );
      const include = optionalString(args.include) ?? "**/*";
      const limit = Math.min(1000, Math.max(1, numberOr(args.limit, 200)));
      const paths: string[] = [];
      for await (const relativePath of new Bun.Glob(include).scan({
        cwd: context.workspaceRoot,
        onlyFiles: true,
      }))
        paths.push(relativePath);
      paths.sort();
      const lines: string[] = [];
      for (const relativePath of paths) {
        if (lines.length >= limit) break;
        await context.workspaceReadAuthorize?.({
          toolName: "grep",
          paths: [relativePath],
        });
        let content: string;
        try {
          content = await readFile(
            resolve(context.workspaceRoot, relativePath),
            "utf8",
          );
        } catch {
          continue;
        }
        if (content.includes("\0")) continue;
        for (const [index, line] of content.split(/\r?\n/u).entries()) {
          expression.lastIndex = 0;
          if (!expression.test(line)) continue;
          lines.push(`${relativePath}:${index + 1}:${line}`);
          if (lines.length >= limit) break;
        }
      }
      return lines.length ? lines.join("\n") : "no matches";
    },
  };
}

type TodoItem = {
  content: string;
  status: "pending" | "in_progress" | "completed";
};

function todoReadTool(): RuntimeTool {
  return {
    name: "todo_read",
    description: "Read durable workspace todo items.",
    requiresApproval: false,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute(_input, context) {
      return JSON.stringify(await readTodos(context.workspaceRoot), null, 2);
    },
  };
}

function todoWriteTool(): RuntimeTool {
  return {
    name: "todo_write",
    description: "Replace durable workspace todo items.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: { items: { type: "array" } },
      required: ["items"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      if (!Array.isArray(args.items)) throw new Error("items must be an array");
      const items = args.items.map((item) => {
        const value = requireObject(item);
        const status = requireString(value.status, "items.status");
        if (!["pending", "in_progress", "completed"].includes(status))
          throw new Error("items.status is invalid");
        return {
          content: requireString(value.content, "items.content"),
          status,
        } as TodoItem;
      });
      await mkdir(resolve(context.workspaceRoot, ".natalia"), {
        recursive: true,
      });
      await writeFile(
        resolve(context.workspaceRoot, ".natalia", "todos.json"),
        `${JSON.stringify(items, null, 2)}\n`,
        { mode: 0o600 },
      );
      return `saved ${items.length} todo items`;
    },
  };
}

function askUserTool(): RuntimeTool {
  return {
    name: "ask_user",
    description:
      "Ask the user a structured question and wait for their answer.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        question: { type: "string" },
        options: { type: "array" },
        multiple: { type: "boolean" },
      },
      required: ["question", "options"],
      additionalProperties: false,
    },
    async execute(input, context) {
      if (!context.askQuestion)
        throw new Error("interactive question channel unavailable");
      const args = requireObject(input);
      if (!Array.isArray(args.options))
        throw new Error("options must be an array");
      const options = args.options.map((item) => ({ label: String(item) }));
      const answers = await context.askQuestion({
        title: optionalString(args.title) ?? "Question from Natalia",
        questions: [
          {
            id: "question_0",
            header: "Question",
            question: requireString(args.question, "question"),
            options,
            multiple: args.multiple === true,
            custom: true,
          },
        ],
      });
      return JSON.stringify({ answers }, null, 2);
    },
  };
}

async function readTodos(workspaceRoot: string): Promise<TodoItem[]> {
  try {
    const parsed = JSON.parse(
      await readFile(resolve(workspaceRoot, ".natalia", "todos.json"), "utf8"),
    ) as TodoItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function readFileTool(): RuntimeTool {
  return {
    name: "read_file",
    description: "Read a UTF-8 text file inside the workspace.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const path = workspacePath(
        context.workspaceRoot,
        requireString(args.path, "path"),
      );
      return await readFile(path, "utf8");
    },
  };
}

function writeFileTool(): RuntimeTool {
  return {
    name: "write_file",
    description: "Write a UTF-8 text file inside the workspace.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
        mode: { type: "number" },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const path = workspacePath(
        context.workspaceRoot,
        requireString(args.path, "path"),
      );
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, requireString(args.content, "content"));
      if (typeof args.mode === "number") await chmod(path, args.mode);
      return `wrote ${relative(context.workspaceRoot, path)}`;
    },
  };
}

function editFileTool(): RuntimeTool {
  return {
    name: "edit_file",
    description: "Replace exact text inside a UTF-8 workspace file.",
    requiresApproval: true,
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        oldText: { type: "string" },
        newText: { type: "string" },
      },
      required: ["path", "oldText", "newText"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const path = workspacePath(
        context.workspaceRoot,
        requireString(args.path, "path"),
      );
      const oldText = requireString(args.oldText, "oldText");
      const current = await readFile(path, "utf8");
      if (!current.includes(oldText)) throw new Error("oldText not found");
      const next = current.replace(
        oldText,
        requireString(args.newText, "newText"),
      );
      await writeFile(path, next);
      return `edited ${relative(context.workspaceRoot, path)}`;
    },
  };
}

function runShellTool(): RuntimeTool {
  return {
    name: "run_shell",
    description:
      "Run a shell command inside the workspace with output capture. The shell is always bash-compatible (Git Bash on Windows, native bash on Linux/Mac) — use POSIX syntax, not cmd.exe.",
    requiresApproval: true,
    timeoutSec: 120,
    parameters: {
      type: "object",
      properties: {
        command: { type: "string" },
        timeoutSec: { type: "number" },
      },
      required: ["command"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      return await runShell(
        requireString(args.command, "command"),
        context,
        numberOr(args.timeoutSec, 120),
      );
    },
  };
}

function webFetchTool(): RuntimeTool {
  return {
    name: "web_fetch",
    description: "Fetch an HTTP or HTTPS URL and return text content.",
    requiresApproval: false,
    timeoutSec: 30,
    parameters: {
      type: "object",
      properties: { url: { type: "string" }, maxBytes: { type: "number" } },
      required: ["url"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const url = requireString(args.url, "url");
      if (!/^https?:\/\//iu.test(url))
        throw new Error("web_fetch requires http(s) URL");
      assertNetworkURL(url, context);
      const response = await fetch(url, { signal: context.signal });
      const text = await response.text();
      return [
        `status=${response.status}`,
        `content-type=${response.headers.get("content-type") ?? "unknown"}`,
        text.slice(0, numberOr(args.maxBytes, 20000)),
      ].join("\n");
    },
  };
}

function webSearchTool(): RuntimeTool {
  return {
    name: "web_search",
    description:
      "Search the web through a configured endpoint, or DuckDuckGo HTML when no endpoint is configured.",
    requiresApproval: false,
    timeoutSec: 30,
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, maxBytes: { type: "number" } },
      required: ["query"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const search = selectWebSearchSource({
        endpoint:
          context.settings?.webSearchEndpoint ??
          process.env.NATALIA_WEB_SEARCH_URL,
        priority: context.settings?.webSearchProviderPriority,
      });
      const endpoint = search.endpoint;
      const url = new URL(endpoint);
      url.searchParams.set("q", requireString(args.query, "query"));
      assertNetworkURL(url.href, context);
      const response = await fetch(url, {
        headers: { "user-agent": "Natalia-TS7-Search/0.1" },
        signal: context.signal,
      });
      const text = await response.text();
      if (!response.ok)
        throw new Error(
          `web_search failed: HTTP ${response.status} from ${url.origin}`,
        );
      return [
        `status=${response.status}`,
        `content-type=${response.headers.get("content-type") ?? "unknown"}`,
        `source=${search.label}`,
        text.slice(0, numberOr(args.maxBytes, 20000)),
      ].join("\n");
    },
  };
}

function selectWebSearchSource(input: {
  endpoint?: string;
  priority?: string[];
}) {
  const priority = input.priority?.length
    ? input.priority
    : input.endpoint
      ? ["configured", "duckduckgo"]
      : ["duckduckgo"];
  for (const provider of priority) {
    if (provider === "configured" && input.endpoint)
      return { endpoint: input.endpoint, label: "configured endpoint" };
    if (provider === "duckduckgo")
      return {
        endpoint: "https://html.duckduckgo.com/html/",
        label: "DuckDuckGo HTML",
      };
  }
  if (input.endpoint)
    return {
      endpoint: input.endpoint,
      label: "configured endpoint (priority fallback)",
    };
  return {
    endpoint: "https://html.duckduckgo.com/html/",
    label: "DuckDuckGo HTML (priority fallback)",
  };
}

function readMediaFileTool(): RuntimeTool {
  return {
    name: "read_media_file",
    description:
      "Read binary/media file metadata inside the workspace without injecting raw bytes into context.",
    requiresApproval: false,
    parameters: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const path = workspacePath(
        context.workspaceRoot,
        requireString(requireObject(input).path, "path"),
      );
      const info = await stat(path);
      const data = await readFile(path);
      return JSON.stringify(
        {
          path: relative(context.workspaceRoot, path),
          size: info.size,
          mode: info.mode.toString(8),
          sha256: createHash("sha256").update(data).digest("hex"),
          kind: mediaKind(data),
        },
        null,
        2,
      );
    },
  };
}

function browserVisitTool(): RuntimeTool {
  return {
    name: "browser_visit",
    description:
      "Visit an HTTP(S) page through the TS runtime fetch-based browser adapter and return document metadata/text preview.",
    requiresApproval: false,
    timeoutSec: 30,
    parameters: {
      type: "object",
      properties: { url: { type: "string" }, maxBytes: { type: "number" } },
      required: ["url"],
      additionalProperties: false,
    },
    async execute(input, context) {
      if (context.settings?.browserEnabled === false)
        throw new Error("browser tools are disabled by runtime configuration");
      const args = requireObject(input);
      const url = requireString(args.url, "url");
      if (!/^https?:\/\//iu.test(url))
        throw new Error("browser_visit requires http(s) URL");
      assertNetworkURL(url, context);
      const response = await fetch(url, {
        headers: {
          "user-agent":
            context.settings?.browserUserAgent || "Natalia-TS7-Browser/0.1",
          ...context.settings?.browserHeaders,
        },
        signal: context.signal,
      });
      const html = await response.text();
      return JSON.stringify(
        {
          url: response.url,
          status: response.status,
          title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/iu)?.[1]?.trim(),
          textPreview: html
            .replace(/<script[\s\S]*?<\/script>/giu, " ")
            .replace(/<style[\s\S]*?<\/style>/giu, " ")
            .replace(/<[^>]+>/gu, " ")
            .replace(/\s+/gu, " ")
            .trim()
            .slice(0, numberOr(args.maxBytes, 12000)),
          contentType: response.headers.get("content-type") ?? "unknown",
        },
        null,
        2,
      );
    },
  };
}

function browserScreenshotTool(): RuntimeTool {
  return {
    name: "browser_screenshot",
    description:
      "Capture a real page screenshot through a Chrome/Chromium binary when available; otherwise emit an explicit TS diagnostic.",
    requiresApproval: true,
    timeoutSec: 60,
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
        path: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
      },
      required: ["url", "path"],
      additionalProperties: false,
    },
    async execute(input, context) {
      if (context.settings?.browserEnabled === false)
        throw new Error("browser tools are disabled by runtime configuration");
      const args = requireObject(input);
      const url = requireString(args.url, "url");
      const output = workspacePath(
        context.workspaceRoot,
        requireString(args.path, "path"),
      );
      await mkdir(dirname(output), { recursive: true });
      const chrome =
        context.settings?.browserBinary ??
        process.env.NATALIA_CHROME_BIN ??
        (await firstExecutable([
          "chromium",
          "chromium-browser",
          "google-chrome",
          "chrome",
          "msedge",
        ]));
      if (!chrome)
        throw new Error(
          "browser_screenshot requires Chrome/Chromium; set NATALIA_CHROME_BIN to enable the TS native browser adapter",
        );
      assertNetworkURL(url, context);
      const profile = context.settings?.browserPersistentProfile
        ? context.settings.browserProfileDir
          ? ` --user-data-dir=${shellQuote(workspacePath(context.workspaceRoot, context.settings.browserProfileDir))}`
          : ""
        : "";
      const locale = context.settings?.browserLocale
        ? ` --lang=${shellQuote(context.settings.browserLocale)}`
        : "";
      const timezone = context.settings?.browserTimezone
        ? ` --timezone=${shellQuote(context.settings.browserTimezone)}`
        : "";
      await runShell(
        `${shellQuote(chrome)} --headless=new --disable-gpu --no-sandbox --window-size=${Math.trunc(numberOr(args.width, 1280))},${Math.trunc(numberOr(args.height, 720))}${profile}${locale}${timezone} --screenshot=${shellQuote(output)} ${shellQuote(url)}`,
        context,
        60,
      );
      return JSON.stringify({ path: relative(context.workspaceRoot, output) });
    },
  };
}

async function runShell(
  command: string,
  context: ToolExecutionContext,
  timeoutSec: number,
) {
  await stat(context.workspaceRoot);
  const shell = profileShellCommand(command);
  return await new Promise<string>((resolvePromise, reject) => {
    const child = spawn(shell.executable, shell.args, {
      cwd: context.workspaceRoot,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: safeToolEnv(context.settings?.envAllowlist),
    });
    let settled = false;
    const finish = (result: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      context.signal?.removeEventListener("abort", abort);
      result();
    };
    const abort = () => {
      terminateChildProcessTree(child.pid);
      finish(() =>
        reject(context.signal?.reason ?? new Error("command cancelled")),
      );
    };
    const timer = setTimeout(() => {
      terminateChildProcessTree(child.pid);
      finish(() => reject(new Error(`command timed out after ${timeoutSec}s`)));
    }, timeoutSec * 1000);
    context.signal?.addEventListener("abort", abort, { once: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    child.on("error", (error) => {
      finish(() => reject(error));
    });
    child.on("close", (code) => {
      const output = [
        `exit=${code}`,
        stdout && `stdout:\n${stdout}`,
        stderr && `stderr:\n${stderr}`,
      ]
        .filter(Boolean)
        .join("\n");
      if (code === 0) finish(() => resolvePromise(output));
      else finish(() => reject(new Error(output)));
    });
  });
}

function assertNetworkURL(input: string, context: ToolExecutionContext) {
  const url = new URL(input);
  const allowedSchemes = context.settings?.allowedSchemes ?? ["https", "http"];
  if (!allowedSchemes.includes(url.protocol.slice(0, -1)))
    throw new Error(`network scheme is not allowed: ${url.protocol}`);
  const host = url.hostname.toLowerCase();
  const allowed = context.settings?.allowedHosts ?? [];
  const allowedGroups = context.settings?.allowedHostGroups ?? [allowed];
  const denied = context.settings?.deniedHosts ?? [];
  if (denied.some((pattern) => hostMatches(host, pattern)))
    throw new Error(`network host denied: ${host}`);
  if (
    allowedGroups.some(
      (group) =>
        group.length && !group.some((pattern) => hostMatches(host, pattern)),
    )
  )
    throw new Error(`network host is not allowed: ${host}`);
  const localhost =
    host === "localhost" || host === "::1" || host.startsWith("127.");
  if (localhost && context.settings?.allowLocalhost === false)
    throw new Error(`localhost network access is not allowed: ${host}`);
  const privateAddress = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/u.test(
    host,
  );
  if (privateAddress && context.settings?.allowPrivate === false)
    throw new Error(`private network access is not allowed: ${host}`);
}

function hostMatches(host: string, pattern: string) {
  const normalized = pattern.toLowerCase();
  return normalized.startsWith("*.")
    ? host.endsWith(normalized.slice(1))
    : host === normalized;
}

function mediaKind(data: Uint8Array) {
  const hex = [...data.slice(0, 12)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (hex.startsWith("89504e47")) return "png";
  if (hex.startsWith("ffd8ff")) return "jpeg";
  if (hex.startsWith("25504446")) return "pdf";
  if (hex.startsWith("47494638")) return "gif";
  return "binary";
}

async function firstExecutable(names: string[]) {
  // Resolved without a shell. The previous `bash -lc "command -v"` probe was
  // the one call site that bypassed the platform shell helper, and on Windows
  // a bare `bash` is the WSL launcher rather than Git bash, so the lookup ran
  // inside a Linux distro and could never see a Windows browser. Bun.which
  // performs the same PATH resolution on POSIX without spawning anything.
  for (const name of names) {
    const resolved = Bun.which(name);
    if (resolved) return resolved;
  }
  // Windows installers do not put browsers on PATH, so PATH resolution alone
  // never finds an installed Chrome or Edge. POSIX has no such well-known
  // locations and skips this entirely.
  if (!isWindows()) return undefined;
  const env = process.env;
  const roots = [
    env.LOCALAPPDATA,
    env.ProgramFiles,
    env.ProgramW6432,
    env["ProgramFiles(x86)"],
  ].filter((root): root is string => Boolean(root));
  const relative = [
    join("Google", "Chrome", "Application", "chrome.exe"),
    join("Chromium", "Application", "chrome.exe"),
    join("Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  for (const root of roots)
    for (const suffix of relative) {
      const candidate = join(root, suffix);
      if (existsSync(candidate)) return candidate;
    }
  return undefined;
}
