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

export function createTauriBrowserSessionProvider(): BrowserSessionProvider {
  return {
    async open(url) {
      await callBrowserBridge("/browser/navigate", { url });
      return { sessionID: "default", url };
    },
    async navigate(sessionID, url) {
      await callBrowserBridge("/browser/navigate", { url });
      return { url };
    },
    async read(sessionID) {
      const result = await callBrowserBridge<{ text: string }>("/browser/read");
      return { text: result.text };
    },
    async click(sessionID, x, y) {
      const result = await callBrowserBridge<{ result: string }>("/browser/click", { x, y });
      return { ok: result.result === "ok" };
    },
    async input(sessionID, text) {
      const result = await callBrowserBridge<{ result: string }>("/browser/input", { text });
      return { ok: result.result === "ok" };
    },
    async screenshot(sessionID) {
      throw new Error("browser_screenshot is not implemented in the Tauri host yet");
    },
  };
}

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
        async execute(input, context) {
          const args = input as { url: string };
          return JSON.stringify(await resolve().open(args.url));
        },
      });
      api.tools.register({
        name: "browser_session_navigate",
        description: "Navigate the shared browser session to a URL.",
        parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
        async execute(input) {
          const args = input as { url: string };
          return JSON.stringify(await resolve().navigate("default", args.url));
        },
      });
      api.tools.register({
        name: "browser_session_read",
        description: "Read the current page text of the shared browser session.",
        parameters: { type: "object", properties: {}, required: [] },
        async execute() {
          return JSON.stringify(await resolve().read("default"));
        },
      });
      api.tools.register({
        name: "browser_session_click",
        description: "Click at coordinates in the shared browser session.",
        parameters: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
        async execute(input) {
          const args = input as { x: number; y: number };
          return JSON.stringify(await resolve().click("default", args.x, args.y));
        },
      });
      api.tools.register({
        name: "browser_session_input",
        description: "Type text into the shared browser session.",
        parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
        async execute(input) {
          const args = input as { text: string };
          return JSON.stringify(await resolve().input("default", args.text));
        },
      });
    },
  };
}

export default createBrowserPlugin(createTauriBrowserSessionProvider);
