import { expect, test } from "bun:test";
import type { RuntimeTool } from "@anthelia/tools";
import type { RuntimeContext } from "@anthelia/substrate";
import { createChatTools } from "@natalia/collab";

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

test("Nia run_shell wrapper enforces the read-only policy", async () => {
  const runShell = tool("run_shell");
  let executed = 0;
  runShell.execute = async () => {
    executed += 1;
    return "ok";
  };
  const ctx = {
    state: {
      tools: new Map([[runShell.name, runShell]]),
    },
    ports: {
      getActiveExec: () => undefined,
      currentSessionSnapshot: () => undefined,
      createCollabChatTool: () => tool("collab_chat"),
    },
  } as unknown as RuntimeContext;
  const chatTools = createChatTools(ctx);
  const niaShell = chatTools
    .niaChatTools()
    .find((item) => item.name === "run_shell")!;
  const context = { workspaceRoot: process.cwd() };
  await expect(
    niaShell.execute({ command: "git commit -m test" }, context),
  ).rejects.toThrow(/read-only/u);
  expect(executed).toBe(0);
  await expect(
    niaShell.execute({ command: "git status" }, context),
  ).resolves.toBe("ok");
  expect(executed).toBe(1);
});
