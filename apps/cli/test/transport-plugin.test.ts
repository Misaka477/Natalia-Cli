import { expect, test } from "bun:test";
import { CapabilityRegistry } from "@natalia/capability";
import type { RuntimeClient } from "@natalia/contracts";
import { createPluginRegistry } from "@natalia/plugin";
import { createToolRegistry } from "@natalia/tools";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createHttpTransportPlugin,
  createHttpTransportPluginHost,
  TRANSPORT_PLUGIN_ID,
} from "../src/transport-plugin";

const client = {} as RuntimeClient;

test("transport plugin registration does not create a server", async () => {
  let creations = 0;
  const kernel = new CapabilityRegistry();
  const registry = createPluginRegistry({
    tools: createToolRegistry([]),
    contribute: (manifest) => {
      expect(
        kernel.tryLoad({
          id: manifest.id,
          name: manifest.name,
          version: manifest.version,
          scope: manifest.scope,
          grants: ["adapters"],
          provides: [],
        }).ok,
      ).toBe(true);
      return (kind, name, payload) => {
        kernel.contribute(manifest.id, kind, name, payload);
        return () => undefined;
      };
    },
  });
  const plugin = createHttpTransportPlugin(() => {
    creations += 1;
    throw new Error("must not materialize during setup");
  });
  await registry.loadBuiltin(plugin);
  expect(creations).toBe(0);
  expect(
    kernel.contribution("adapters", "transport.http.server"),
  ).toBeDefined();
  await registry.unloadAll();
});

test("transport plugin owns the HTTP server lifecycle", async () => {
  const host = await createHttpTransportPluginHost({
    client,
    port: 0,
    events: false,
  });
  const url = host.server.url.toString();
  expect(
    await fetch(`${url}/healthz`).then((response) => response.json()),
  ).toEqual({ ok: true, apiVersion: 1 });

  await host.close();
  await host.close();
  const stoppedURL = new URL(url);
  const rebound = Bun.serve({
    hostname: stoppedURL.hostname,
    port: Number(stoppedURL.port),
    fetch: () => new Response("rebound"),
  });
  expect(rebound.port).toBe(Number(stoppedURL.port));
  rebound.stop(true);
});

test("disabled transport plugin creates no listening server", async () => {
  await expect(
    createHttpTransportPluginHost({
      client,
      port: 0,
      events: false,
      enabled: false,
    }),
  ).rejects.toThrow(`transport plugin is disabled (${TRANSPORT_PLUGIN_ID})`);
});

test("CLI serve fails closed before creating runtime state", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-transport-disabled-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  await writeFile(
    join(root, ".natalia", "config.json"),
    JSON.stringify({
      version: 3,
      plugins: { enabled: { [TRANSPORT_PLUGIN_ID]: false } },
    }),
  );
  const child = Bun.spawnSync(
    [
      process.execPath,
      join(import.meta.dir, "..", "src", "main.ts"),
      "serve",
      "8787",
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  expect(child.exitCode).not.toBe(0);
  expect(new TextDecoder().decode(child.stderr)).toContain(
    `transport plugin is disabled (${TRANSPORT_PLUGIN_ID})`,
  );
  expect(
    await Array.fromAsync(
      new Bun.Glob(".natalia/{sessions,attachments}/**").scan(root),
    ),
  ).toEqual([]);
});
