import { expect, test } from "bun:test";
import type { RuntimeClient } from "@natalia/contracts";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createHttpTransportPluginHost,
  TRANSPORT_PLUGIN_ID,
} from "../src/transport-plugin";

const client = {} as RuntimeClient;

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
