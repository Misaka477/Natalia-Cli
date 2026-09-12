import { expect, test } from "bun:test";
import type { RuntimeTool } from "@natalia/tools";
import type { RuntimeContext } from "../src/runtime/context";
import { createChatTools } from "../src/runtime/collaboration/chat-tools";

function tool(name: string): RuntimeTool {
  return {
    name,
    description: name,
    requiresApproval: false,
    parameters: { type: "object", properties: {}, additionalProperties: false },
    async execute() {
      return "ok";
    },
  };
}

test("Nia exposes run_shell for verification while Navi does not", () => {
  const readFile = tool("read_file");
  const runShell = tool("run_shell");
  const ctx = {
    state: {
      tools: new Map([
        [readFile.name, readFile],
        [runShell.name, runShell],
      ]),
    },
    ports: {
      getActiveExec: () => undefined,
      currentSessionSnapshot: () => undefined,
      createCollabChatTool: () => tool("collab_chat"),
    },
  } as unknown as RuntimeContext;
  const chatTools = createChatTools(ctx);
  expect(chatTools.niaChatTools().map((item) => item.name)).toContain(
    "run_shell",
  );
  expect(chatTools.naviChatTools().map((item) => item.name)).not.toContain(
    "run_shell",
  );
});
