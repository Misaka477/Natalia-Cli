/**
 * The web tool family, as a separately packaged family.
 *
 * Depends on the framework for the tool-authoring surface, on the platform
 * package for shell quoting, and on the shell family for headless browser runs.
 * It knows nothing about the runtime or the capability kernel.
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { isWindows, shellQuote } from "@natalia/platform";
import {
  numberOr,
  optionalString,
  requireObject,
  requireString,
  runShell,
  workspacePath,
} from "@natalia/tools";
import type { Plugin, PluginManifest } from "@natalia/plugin";
import type {
  RuntimeTool,
  ToolExecutionContext,
  ToolFamily,
} from "@natalia/tools";

export const WEB_PLUGIN_ID = "natalia-tool-web";

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
      // The page's scripts are not content the model should read: a fetched
      // page goes to the model with its executable script blocks removed.
      finalizeContent(content) {
        return content.replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, "");
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


function sharedBrowserBase(): string | undefined {
  return process.env.NATALIA_BROWSER_BRIDGE_URL || undefined;
}

function sharedBrowserAvailable(): boolean {
  return Boolean(sharedBrowserBase());
}

function optionalTabId(value: unknown): string | number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return Number.isInteger(value) ? value : value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    const asNumber = Number(trimmed);
    if (Number.isInteger(asNumber) && String(asNumber) === trimmed)
      return asNumber;
    return trimmed;
  }
  return value as string;
}

async function browserBridgeCall(
  action: string,
  input: Record<string, unknown> = {},
  sessionID?: string,
): Promise<unknown> {
  const base = sharedBrowserBase();
  if (!base)
    throw new Error(
      "browser bridge is not available. Start it with: bun packages/browser-bridge/src/server.ts. If the extension is not installed, run: bun packages/browser-bridge/scripts/install.ts",
    );
  const payload = sessionID ? { ...input, sessionID } : input;
  const response = await fetch(`${base.replace(/\/$/, "")}/browser/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep raw text
  }
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? String((body as { error?: unknown }).error)
        : `browser bridge failed: HTTP ${response.status}`;
    throw new Error(message);
  }
  return body;
}

function browserScreenshotTool(): RuntimeTool {
  return {
    name: "browser_screenshot",
    description:
      "Capture a real screenshot from the shared browser when available; otherwise fall back to a headless Chrome/Chromium binary.",
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
      required: ["path"],
      additionalProperties: false,
    },
    async execute(input, context) {
      if (context.settings?.browserEnabled === false)
        throw new Error("browser tools are disabled by runtime configuration");
      const args = requireObject(input);
      const url = optionalString(args.url);
      const output = workspacePath(
        context.workspaceRoot,
        requireString(args.path, "path"),
      );
      await mkdir(dirname(output), { recursive: true });
      if (url) assertNetworkURL(url, context);

      if (sharedBrowserAvailable()) {
        let tabId: string | number | undefined;
        if (url) {
          const opened = (await browserBridgeCall("open", { url }, context.sessionID)) as {
            tabId?: string | number;
          };
          tabId = opened.tabId;
          if (!tabId) throw new Error("shared browser opened a tab but returned no id");
        }
        const result = (await browserBridgeCall("screenshot", {
          ...(tabId ? { tabId } : {}),
        }, context.sessionID)) as { data?: string };
        const data = String(result.data ?? "");
        const base64 = data.replace(/^data:image\/[^;]+;base64,/u, "");
        if (!base64)
          throw new Error("shared browser screenshot returned no image data");
        await writeFile(output, Buffer.from(base64, "base64"));
        return JSON.stringify({
          path: relative(context.workspaceRoot, output),
          via: "shared-browser",
        });
      }

      if (!url)
        throw new Error(
          "browser_screenshot without the shared browser bridge requires a url",
        );
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
          "shared browser bridge is unavailable and browser_screenshot fallback requires Chrome/Chromium; run Natalia Desktop to use the self-contained shared browser",
        );
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

function browserOpenTool(): RuntimeTool {
  return {
    name: "browser_open",
    description:
      "Open a new browser tab (optionally with a URL). This never navigates an existing tab.",
    requiresApproval: true,
    timeoutSec: 20,
    parameters: {
      type: "object",
      properties: {
        url: { type: "string" },
      },
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const url = optionalString(args.url);
      if (url) assertNetworkURL(url, context);
      return JSON.stringify(
        await browserBridgeCall("open", url ? { url } : {}, context?.sessionID),
        null,
        2,
      );
    },
  };
}

function browserCloseTool(): RuntimeTool {
  return {
    name: "browser_close",
    description:
      "Close a browser tab by id. tabId is optional; when omitted the active tab is closed.",
    requiresApproval: true,
    timeoutSec: 20,
    parameters: {
      type: "object",
      properties: {
        tabId: { type: ["string", "number"] },
      },
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const tabId = optionalTabId(args.tabId);
      return JSON.stringify(
        await browserBridgeCall("close", tabId ? { tabId } : {}, context?.sessionID),
        null,
        2,
      );
    },
  };
}

function browserTabsTool(): RuntimeTool {
  return {
    name: "browser_tabs",
    description:
      "List tabs in the shared Natalia browser. Requires the shared browser bridge (Desktop or a future BrowserDaemon).",
    requiresApproval: false,
    timeoutSec: 10,
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    async execute(_input, context) {
      return JSON.stringify(await browserBridgeCall("tabs", {}, context?.sessionID), null, 2);
    },
  };
}

function browserScanTool(): RuntimeTool {
  return {
    name: "browser_scan",
    description:
      "Scan a browser tab and return simplified page content (text-only by default). tabId is optional; when omitted the active tab is used.",
    requiresApproval: false,
    timeoutSec: 20,
    parameters: {
      type: "object",
      properties: {
        tabId: { type: ["string", "number"] },
        textOnly: { type: "boolean" },
        maxlen: { type: "number" },
        offset: { type: "number" },
      },
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const tabId = optionalTabId(args.tabId);
      return JSON.stringify(
        await browserBridgeCall("scan", {
          tabId,
          textOnly: args.textOnly === false ? false : true,
          maxlen: numberOr(args.maxlen, 35000),
          offset: numberOr(args.offset, 0),
        }, context?.sessionID),
        null,
        2,
      );
    },
  };
}

function browserExecuteJsTool(): RuntimeTool {
  return {
    name: "browser_execute_js",
    description:
      "Execute JavaScript in a browser tab. tabId is optional; when omitted the active tab is used. Returns the JS result and page diff when available.",
    requiresApproval: true,
    timeoutSec: 30,
    parameters: {
      type: "object",
      properties: {
        tabId: { type: "string" },
        script: { type: "string" },
      },
      required: ["script"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const tabId = optionalTabId(args.tabId);
      const script = requireString(args.script, "script");
      return JSON.stringify(
        await browserBridgeCall("execute_js", { tabId, script }, context?.sessionID),
        null,
        2,
      );
    },
  };
}

function browserNavigateTool(): RuntimeTool {
  return {
    name: "browser_navigate",
    description:
      "Navigate the browser to a URL. tabId is optional; when omitted the current active tab is navigated (no new tab is created). Returns requestedUrl and currentUrl.",
    requiresApproval: true,
    timeoutSec: 20,
    parameters: {
      type: "object",
      properties: {
        tabId: { type: "string" },
        url: { type: "string" },
      },
      required: ["url"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const url = requireString(args.url, "url");
      if (!/^https?:\/\//iu.test(url))
        throw new Error("browser_navigate requires http(s) URL");
      assertNetworkURL(url, context);
      const tabId = optionalTabId(args.tabId);
      const result = await browserBridgeCall(
        "navigate",
        { ...(tabId ? { tabId } : {}), url },
        context.sessionID,
      );
      return JSON.stringify(result, null, 2);
    },
  };
}

function browserClickTool(): RuntimeTool {
  return {
    name: "browser_click",
    description:
      "Click at x/y coordinates in a browser tab. tabId is optional; when omitted the active tab is used.",
    requiresApproval: true,
    timeoutSec: 20,
    parameters: {
      type: "object",
      properties: {
        tabId: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
      },
      required: ["x", "y"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const tabId = optionalTabId(args.tabId);
      const x = Number(args.x);
      const y = Number(args.y);
      if (!Number.isInteger(x) || !Number.isInteger(y))
        throw new Error("browser_click x/y must be integers");
      return JSON.stringify(
        await browserBridgeCall("click", { tabId, x, y }, context?.sessionID),
        null,
        2,
      );
    },
  };
}

function browserInputTool(): RuntimeTool {
  return {
    name: "browser_input",
    description:
      "Insert text into the active element of a browser tab. tabId is optional; when omitted the active tab is used.",
    requiresApproval: true,
    timeoutSec: 20,
    parameters: {
      type: "object",
      properties: {
        tabId: { type: "string" },
        text: { type: "string" },
      },
      required: ["text"],
      additionalProperties: false,
    },
    async execute(input, context) {
      const args = requireObject(input);
      const tabId = optionalTabId(args.tabId);
      const text = requireString(args.text, "text");
      return JSON.stringify(
        await browserBridgeCall("input", { tabId, text }, context?.sessionID),
        null,
        2,
      );
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
  browserOpenTool(),
  browserCloseTool(),
  browserTabsTool(),
  browserScanTool(),
  browserExecuteJsTool(),
  browserNavigateTool(),
  browserClickTool(),
  browserInputTool(),
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

export const WEB_PLUGIN_MANIFEST: PluginManifest = {
  apiVersion: 2,
  id: WEB_PLUGIN_ID,
  version: "1.0.0",
  name: "Web Tools",
  description: "Fetching and searching the web.",
  entry: "index.js",
  scope: "session",
  provides: [],
  requires: [],
  optionalRequires: [],
  conflicts: [],
  dependencies: [],
  hooks: {},
  integrationPoints: ["tools"],
};

export function createWebPlugin(): Plugin {
  return {
    manifest: WEB_PLUGIN_MANIFEST,
    setup(api) {
      for (const tool of webTools) api.tools.register(tool);
    },
  };
}
