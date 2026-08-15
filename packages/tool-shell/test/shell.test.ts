import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shellToolFamily, shellTools, runShell } from "../src";

test("the shell family describes the tool it ships", () => {
  const family = shellToolFamily();
  expect(family.id).toBe("shell");
  expect(family.scope).toBe("session");
  expect(family.tools).toEqual(shellTools);
});

test("run_shell runs a command inside the workspace and reports exit", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-shell-"));
  const result = await runShell(
    "printf 'out'; printf 'err' >&2; exit 0",
    { workspaceRoot: root, settings: {} } as never,
    10,
  );
  expect(result).toContain("exit=0");
  expect(result).toContain("stdout:\nout");
  expect(result).toContain("stderr:\nerr");
});

test("run_shell rejects on a failing command with its output", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-tool-shell-"));
  await expect(
    runShell("exit 3", { workspaceRoot: root, settings: {} } as never, 10),
  ).rejects.toThrow(/exit=3/u);
});

test("run_shell projects a terminal card from its output definition", () => {
  const tool = shellToolFamily().tools.find(
    (candidate) => candidate.name === "run_shell",
  )!;
  const intent = tool.output?.presentResult(
    { command: "make build" },
    "exit=0\nstdout:\nbuilt ok\nstderr:\nwarn",
  );
  expect(intent).toMatchObject({
    kind: "terminal",
    title: "make build",
    summary: "exit 0",
    meta: [["exit", "0"]],
  });
  expect(intent?.body).toContain("built ok");
});
