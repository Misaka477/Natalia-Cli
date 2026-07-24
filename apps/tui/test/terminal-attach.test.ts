import { expect, test } from "bun:test";
import type { RuntimeClient } from "@natalia/contracts";
import { callRuntimeRPC } from "@natalia/transport";
import {
  resolveTerminalCLIExecutable,
  terminalAttachBridge,
} from "../src/terminal-attach";

test("TUI terminal attach bridge is private, reusable, and event-stream free", async () => {
  let starts = 0;
  const backend = {
    start() {
      starts++;
    },
    cancel() {},
    async ptyList() {
      return [];
    },
  } as unknown as RuntimeClient;
  const bridge = terminalAttachBridge(backend);
  expect(terminalAttachBridge(backend)).toBe(bridge);
  expect(starts).toBe(0);
  await expect(
    callRuntimeRPC({ url: bridge.url, method: "pty.list" }),
  ).rejects.toThrow("HTTP 401");
  expect(
    await callRuntimeRPC<unknown[]>({
      url: bridge.url,
      token: bridge.token,
      method: "pty.list",
    }),
  ).toEqual([]);
  expect(
    await fetch(new URL("/events", bridge.url), {
      headers: { authorization: `Bearer ${bridge.token}` },
    }).then((response) => response.status),
  ).toBe(404);
  bridge.stop();
});

test("TUI terminal attach resolves configured, installed and bundled CLI commands", () => {
  expect(
    resolveTerminalCLIExecutable({
      configured: '["custom-natalia","--local"]',
    }),
  ).toEqual(["custom-natalia", "--local"]);
  expect(
    resolveTerminalCLIExecutable({
      which: (name) => (name === "natalia-ts" ? "/usr/bin/natalia-ts" : null),
    }),
  ).toEqual(["/usr/bin/natalia-ts"]);
  expect(
    resolveTerminalCLIExecutable({
      which: () => null,
      argv: ["bun", "/opt/natalia/natalia-ts.js"],
      execPath: "/usr/bin/bun",
    }),
  ).toEqual(["/usr/bin/bun", "/opt/natalia/natalia-ts.js"]);
});
