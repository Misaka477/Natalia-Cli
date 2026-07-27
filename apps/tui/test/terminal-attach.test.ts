import { expect, test } from "bun:test";
import type { RuntimeClient } from "@natalia/contracts";
import { openExternalTerminal } from "../src/terminal-attach";

test("TUI restores the native Terminal Hub without choosing a pane", async () => {
  let opened = 0;
  const backend = {
    cancel() {},
    async nativeTerminalList() {
      return [];
    },
    async nativeTerminalOpenHub() {
      opened += 1;
      return { muxWindowID: 7 };
    },
  } as unknown as RuntimeClient;
  await openExternalTerminal({ backend });
  expect(opened).toBe(1);
});
