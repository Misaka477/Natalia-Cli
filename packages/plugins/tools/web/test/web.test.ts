import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPluginRegistry } from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";
import {
  createWebPlugin,
  WEB_PLUGIN_ID,
  webToolFamily,
  webTools,
} from "../src";

test("the web family describes the tools it ships", () => {
  const family = webToolFamily();
  expect(family.id).toBe("web");
  expect(family.scope).toBe("session");
  expect(family.tools).toEqual(webTools);
});

test("the web plugin owns its tools and unloads cleanly", async () => {
  const tools = createToolRegistry([]);
  const registry = createPluginRegistry({ tools });
  await registry.load(createWebPlugin());
  expect(registry.list()[0]).toMatchObject({
    id: WEB_PLUGIN_ID,
    scope: "session",
  });
  for (const tool of webTools) expect(tools.has(tool.name)).toBe(true);
  await registry.unload(WEB_PLUGIN_ID);
  for (const tool of webTools) expect(tools.has(tool.name)).toBe(false);
});

test("web_fetch enforces the network policy before reaching the network", async () => {
  const tool = webToolFamily().tools.find(
    (candidate) => candidate.name === "web_fetch",
  )!;
  await expect(
    tool.execute({ url: "file:///etc/passwd" }, { settings: {} } as never),
  ).rejects.toThrow(/http\(s\)/u);
  await expect(
    tool.execute({ url: "http://localhost:8080" }, {
      settings: { allowLocalhost: false },
    } as never),
  ).rejects.toThrow(/localhost/u);
});

test("web_fetch finalizes fetched content by stripping script blocks", () => {
  const tool = webToolFamily().tools.find(
    (candidate) => candidate.name === "web_fetch",
  )!;
  const content = `<html><script>alert(1)</script><p>hello</p><script type="module">run()</script></html>`;
  const finalized = tool.output!.finalizeContent!(content);
  expect(finalized).not.toContain("alert(1)");
  expect(finalized).not.toContain("run()");
  expect(finalized).toContain("<p>hello</p>");
});


test("web_search uses a native configured endpoint without proxying Go", async () => {
  const saved = process.env.NATALIA_WEB_SEARCH_URL;
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      expect(new URL(request.url).searchParams.get("q")).toBe("Natalia TS7");
      return new Response("native search result");
    },
  });
  process.env.NATALIA_WEB_SEARCH_URL = server.url.toString();
  const tool = webToolFamily().tools.find(
    (candidate) => candidate.name === "web_search",
  )!;
  try {
    await expect(
      tool.execute({ query: "Natalia TS7" }, { workspaceRoot: tmpdir() }),
    ).resolves.toContain("native search result");
  } finally {
    server.stop(true);
    if (saved) process.env.NATALIA_WEB_SEARCH_URL = saved;
    else delete process.env.NATALIA_WEB_SEARCH_URL;
  }
});

test("web_search selects the configured endpoint only when its priority permits", async () => {
  const configured = Bun.serve({
    port: 0,
    fetch: () => new Response("configured provider result"),
  });
  const tool = webToolFamily().tools.find(
    (candidate) => candidate.name === "web_search",
  )!;
  try {
    await expect(
      tool.execute(
        { query: "priority" },
        {
          workspaceRoot: tmpdir(),
          settings: {
            webSearchEndpoint: configured.url.toString(),
            webSearchProviderPriority: ["configured", "duckduckgo"],
            allowLocalhost: true,
          },
        },
      ),
    ).resolves.toContain("configured provider result");
  } finally {
    configured.stop(true);
  }
});


test("shared browser tools delegate to the desktop browser bridge", async () => {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      calls.push({ path: url.pathname, body });
      if (url.pathname === "/browser/tabs")
        return Response.json({
          activeId: "tab_1",
          tabs: [
            { id: "tab_1", url: "https://example.com", title: "Example", active: true },
          ],
        });
      if (url.pathname === "/browser/scan")
        return Response.json({
          url: "https://example.com",
          title: "Example",
          text: "hello",
          html: "<body>hello</body>",
          truncated: false,
          textOnly: true,
        });
      if (url.pathname === "/browser/execute_js")
        return Response.json({ result: "ok", tabId: "tab_1" });
      if (url.pathname === "/browser/open")
        return Response.json({ ok: true, tabId: "tab_2", url: "https://example.org" });
      if (url.pathname === "/browser/navigate")
        return Response.json({ ok: true, tabId: "tab_1", url: "https://example.org" });
      if (url.pathname === "/browser/click")
        return Response.json({ result: "ok", tabId: "tab_1" });
      if (url.pathname === "/browser/input")
        return Response.json({ result: "ok", tabId: "tab_1" });
      if (url.pathname === "/browser/screenshot")
        return Response.json({ data: "data:image/png;base64,QUJD" });
      return new Response("not found", { status: 404 });
    },
  });
  const saved = process.env.NATALIA_BROWSER_BRIDGE_URL;
  process.env.NATALIA_BROWSER_BRIDGE_URL = server.url.toString();
  const root = await mkdtemp(join(tmpdir(), "natalia-web-bridge-test-"));
  try {
    const family = webToolFamily();

    const tabs = (await family.tools.find((tool) => tool.name === "browser_tabs")!.execute(
      {},
      { workspaceRoot: root } as never,
    )) as string;
    expect(tabs).toContain("tab_1");

    const scanned = (await family.tools.find((tool) => tool.name === "browser_scan")!.execute(
      { tabId: "tab_1" },
      { workspaceRoot: root } as never,
    )) as string;
    expect(scanned).toContain("hello");

    const executed = (await family.tools.find((tool) => tool.name === "browser_execute_js")!.execute(
      { tabId: "tab_1", script: "document.title" },
      { workspaceRoot: root } as never,
    )) as string;
    expect(executed).toContain("ok");

    const navigated = (await family.tools.find((tool) => tool.name === "browser_navigate")!.execute(
      { tabId: "tab_1", url: "https://example.org" },
      { workspaceRoot: root, settings: { allowedSchemes: ["https"], allowedHosts: ["example.org"] } } as never,
    )) as string;
    expect(navigated).toContain("tab_1");

    const clicked = (await family.tools.find((tool) => tool.name === "browser_click")!.execute(
      { tabId: "tab_1", x: 10, y: 20 },
      { workspaceRoot: root } as never,
    )) as string;
    expect(clicked).toContain("ok");

    const input = (await family.tools.find((tool) => tool.name === "browser_input")!.execute(
      { tabId: "tab_1", text: "hello" },
      { workspaceRoot: root } as never,
    )) as string;
    expect(input).toContain("ok");

    const screenshotPath = join(root, "shot.png");
    const shot = (await family.tools.find((tool) => tool.name === "browser_screenshot")!.execute(
      { url: "https://example.org", path: "shot.png" },
      { workspaceRoot: root, settings: { allowedSchemes: ["https"], allowedHosts: ["example.org"] } } as never,
    )) as string;
    expect(shot).toContain("shared-browser");
    expect(require("node:fs").readFileSync(screenshotPath)).toEqual(Buffer.from([0x41, 0x42, 0x43]));

    const paths = calls.map((call) => call.path);
    expect(paths).toContain("/browser/tabs");
    expect(paths).toContain("/browser/scan");
    expect(paths).toContain("/browser/execute_js");
    expect(paths).toContain("/browser/screenshot");
  } finally {
    server.stop(true);
    if (saved) process.env.NATALIA_BROWSER_BRIDGE_URL = saved;
    else delete process.env.NATALIA_BROWSER_BRIDGE_URL;
  }
});
