import { expect, test } from "bun:test";
import { terminalToolFamily, terminalTools } from "../src";

test("the terminal family describes the tools it ships", () => {
  const family = terminalToolFamily();
  expect(family.id).toBe("terminal");
  expect(family.scope).toBe("session");
  expect(family.tools.map((tool) => tool.name)).toEqual(
    terminalTools().map((tool) => tool.name),
  );
});

test("the terminal family declares the interactive aliases", () => {
  const family = terminalToolFamily();
  expect(family.aliases?.interactive_start).toBe("interactive_terminal_start");
  expect(family.aliases?.interactive_input).toBe("interactive_terminal_input");
});

test("terminal tools refuse without the native terminal host", async () => {
  const tool = terminalToolFamily().tools.find(
    (candidate) => candidate.name === "interactive_terminal_start",
  )!;
  await expect(
    tool.execute({}, { workspaceRoot: "/tmp" } as never),
  ).rejects.toThrow(/Native Terminal Host is unavailable/u);
});
