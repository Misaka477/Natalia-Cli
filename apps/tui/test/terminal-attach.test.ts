import { expect, test } from "bun:test";
import type { RuntimeClient } from "@natalia/contracts";
import { openExternalTerminal } from "../src/terminal-attach";

test("TUI focuses the existing native terminal pane", async () => {
  const focused: string[] = [];
  const backend = {
    cancel() {},
    async nativeTerminalList() {
      return [];
    },
    async nativeTerminalFocus(id: string) {
      focused.push(id);
      return {};
    },
  } as unknown as RuntimeClient;
  await openExternalTerminal({ backend, id: "terminal_test" });
  expect(focused).toEqual(["terminal_test"]);
});
