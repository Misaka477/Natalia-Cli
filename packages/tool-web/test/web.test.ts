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
  await registry.loadBuiltin(createWebPlugin());
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

test("browser_visit enforces the network policy and honours browser settings", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-web-browser-"));
  let browserHeaders: Headers | undefined;
  const server = Bun.serve({
    port: 0,
    fetch: (request) => {
      browserHeaders = request.headers;
      return new Response("<title>TS Browser</title><main>browser-ok</main>");
    },
  });
  const tool = webToolFamily().tools.find(
    (candidate) => candidate.name === "browser_visit",
  )!;
  try {
    expect(
      await tool.execute(
        { url: server.url.toString() },
        {
          workspaceRoot: root,
          settings: {
            allowLocalhost: true,
            allowedSchemes: ["http"],
            browserUserAgent: "Natalia browser test",
            browserHeaders: { "x-natalia-test": "enabled" },
          },
        },
      ),
    ).toContain("browser-ok");
    expect(browserHeaders?.get("user-agent")).toBe("Natalia browser test");
    expect(browserHeaders?.get("x-natalia-test")).toBe("enabled");
    await expect(
      tool.execute(
        { url: server.url.toString() },
        { workspaceRoot: root, settings: { allowLocalhost: false } },
      ),
    ).rejects.toThrow("localhost network access is not allowed");
    await expect(
      tool.execute(
        { url: server.url.toString() },
        { workspaceRoot: root, settings: { allowedSchemes: ["https"] } },
      ),
    ).rejects.toThrow("network scheme is not allowed");
    await expect(
      tool.execute(
        { url: server.url.toString() },
        { workspaceRoot: root, settings: { browserEnabled: false } },
      ),
    ).rejects.toThrow("browser tools are disabled");
  } finally {
    server.stop(true);
  }
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
