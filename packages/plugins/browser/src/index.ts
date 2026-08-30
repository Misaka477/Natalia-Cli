import type { Plugin, PluginManifest } from "@natalia/plugin";

export const BROWSER_SESSION_SERVICE = "browser.session";

export const BROWSER_PLUGIN_ID = "natalia-browser";

export const BROWSER_PLUGIN_MANIFEST: PluginManifest = {
  apiVersion: 2,
  id: BROWSER_PLUGIN_ID,
  version: "1.0.0",
  name: "Browser",
  description: "Interactive browser session shared by humans and the model.",
  entry: "index.js",
  scope: "session",
  provides: [BROWSER_SESSION_SERVICE],
  requires: [],
  optionalRequires: [],
  conflicts: [],
  dependencies: [],
  hooks: {},
  integrationPoints: ["tools", "services"],
};

const BROWSER_BRIDGE_URL = "http://127.0.0.1:8788";

async function callBrowserBridge<T>(path: string, input?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${BROWSER_BRIDGE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input ?? {}),
  });
  const body = (await response.json()) as T & { error?: string };
  if (!response.ok || body.error)
    throw new Error(body.error ?? `browser bridge ${path} failed`);
  return body;
}

export function createDesktopBrowserSessionProvider(): BrowserSessionProvider {
  return {
    async open(url) {
      const result = await callBrowserBridge<{ sessionID?: string; tabId?: string; url: string }>(
        "/browser/open",
        { url },
      );
      return { sessionID: result.sessionID || result.tabId || "default", url: result.url || url };
    },
    async navigate(sessionID, url) {
      await callBrowserBridge("/browser/navigate", { url, sessionID, tabId: sessionID });
      return { url };
    },
    async read(sessionID) {
      const result = await callBrowserBridge<{ text: string }>("/browser/read", {
        sessionID,
        tabId: sessionID,
      });
      return { text: result.text };
    },
    async click(sessionID, x, y) {
      const result = await callBrowserBridge<{ result: string }>("/browser/click", {
        x,
        y,
        sessionID,
        tabId: sessionID,
      });
      return { ok: result.result === "ok" };
    },
    async input(sessionID, text) {
      const result = await callBrowserBridge<{ result: string }>("/browser/input", {
        text,
        sessionID,
        tabId: sessionID,
      });
      return { ok: result.result === "ok" };
    },
    async screenshot(sessionID) {
      const result = await callBrowserBridge<{ data: string }>("/browser/screenshot", {
        sessionID,
        tabId: sessionID,
      });
      return { data: result.data };
    },
  };
}

export const createTauriBrowserSessionProvider = createDesktopBrowserSessionProvider;

export type BrowserSessionProvider = {
  open(url: string): Promise<{ sessionID: string; url: string }>;
  navigate(sessionID: string, url: string): Promise<{ url: string }>;
  read(sessionID: string): Promise<{ text: string }>;
  click(sessionID: string, x: number, y: number): Promise<{ ok: boolean }>;
  input(sessionID: string, text: string): Promise<{ ok: boolean }>;
  screenshot(sessionID: string): Promise<{ data: string }>;
};

export function createBrowserPlugin(
  provider: () => BrowserSessionProvider | undefined,
): Plugin {
  return {
    manifest: BROWSER_PLUGIN_MANIFEST,
    setup(api) {
      const resolve = () => {
        const current = provider();
        if (!current)
          throw new Error("browser session provider is not configured");
        return current;
      };
      api.services.provide(BROWSER_SESSION_SERVICE, {
        open: (url) => resolve().open(url),
        navigate: (sessionID, url) => resolve().navigate(sessionID, url),
        read: (sessionID) => resolve().read(sessionID),
        click: (sessionID, x, y) => resolve().click(sessionID, x, y),
        input: (sessionID, text) => resolve().input(sessionID, text),
        screenshot: (sessionID) => resolve().screenshot(sessionID),
      });
      api.tools.register({
        name: "browser_session_open",
        description: "Open a URL in the shared browser session.",
        parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
        async execute(input) {
          const args = input as { url: string };
          return JSON.stringify(await resolve().open(args.url));
        },
      });
      api.tools.register({
        name: "browser_session_navigate",
        description: "Navigate a browser tab to a URL. Omit sessionID to use the active tab.",
        parameters: {
          type: "object",
          properties: { url: { type: "string" }, sessionID: { type: "string" } },
          required: ["url"],
        },
        async execute(input) {
          const args = input as { url: string; sessionID?: string };
          return JSON.stringify(await resolve().navigate(args.sessionID || "default", args.url));
        },
      });
      api.tools.register({
        name: "browser_session_read",
        description: "Read the current page text of a browser tab.",
        parameters: { type: "object", properties: { sessionID: { type: "string" } }, required: [] },
        async execute(input) {
          const args = input as { sessionID?: string };
          return JSON.stringify(await resolve().read(args.sessionID || "default"));
        },
      });
      api.tools.register({
        name: "browser_session_click",
        description: "Click at coordinates in a browser tab.",
        parameters: {
          type: "object",
          properties: { x: { type: "number" }, y: { type: "number" }, sessionID: { type: "string" } },
          required: ["x", "y"],
        },
        async execute(input) {
          const args = input as { x: number; y: number; sessionID?: string };
          return JSON.stringify(await resolve().click(args.sessionID || "default", args.x, args.y));
        },
      });
      api.tools.register({
        name: "browser_session_input",
        description: "Type text into a browser tab.",
        parameters: {
          type: "object",
          properties: { text: { type: "string" }, sessionID: { type: "string" } },
          required: ["text"],
        },
        async execute(input) {
          const args = input as { text: string; sessionID?: string };
          return JSON.stringify(await resolve().input(args.sessionID || "default", args.text));
        },
      });
      api.tools.register({
        name: "browser_session_screenshot",
        description: "Capture a screenshot of a browser tab.",
        parameters: { type: "object", properties: { sessionID: { type: "string" } }, required: [] },
        async execute(input) {
          const args = input as { sessionID?: string };
          return JSON.stringify(await resolve().screenshot(args.sessionID || "default"));
        },
      });
    },
  };
}

export default createBrowserPlugin(createDesktopBrowserSessionProvider);
