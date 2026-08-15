/**
 * The web tool family, as a separately packaged family.
 *
 * Depends on the framework for the tool-authoring surface, on the platform
 * package for shell quoting, and on the shell family for headless browser runs.
 * It knows nothing about the runtime or the capability kernel.
 */
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { isWindows, shellQuote } from "@natalia/platform";
import {
  numberOr,
  optionalString,
  requireObject,
  requireString,
  workspacePath,
} from "@natalia/tools";
import { runShell } from "@natalia/tool-shell";
import type {
  RuntimeTool,
  ToolExecutionContext,
  ToolFamily,
} from "@natalia/tools";

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
    output: {
      schema: {
        type: "object",
        properties: {
          status: { type: "number" },
          contentType: { type: "string" },
          body: { type: "string" },
        },
        required: ["status", "contentType", "body"],
        additionalProperties: false,
      },
      presentCall(args) {
        return {
          kind: "web",
          title: requireObject(args).url as string,
          summary: "fetch",
        };
      },
      presentResult(args, value) {
        const url = requireObject(args).url as string;
        const status = Number(/status=(\d+)/u.exec(value)?.[1] ?? "0");
        const contentType =
          /content-type=([^\n]*)/u.exec(value)?.[1] ?? "unknown";
        const body = value.split("\n").slice(2).join("\n") || "(empty body)";
        return {
          kind: "web",
          title: url,
          summary: `status ${status}`,
          body,
          meta: [
            ["content-type", contentType],
            ["status", String(status)],
          ],
        };
      },
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

export const webTools: RuntimeTool[] = [
  webFetchTool(),
  webSearchTool(),
  browserVisitTool(),
  browserScreenshotTool(),
];

/**
 * Session scope: these tools are only meaningful while the session using them
 * is alive; the network policy they enforce is the host's settings.
 */
export function webToolFamily(): ToolFamily {
  return {
    id: "web",
    name: "Web Tools",
    version: "1.0.0",
    description: "Fetching and searching the web.",
    scope: "session",
    tools: webTools,
  };
}
