import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCliCommandAdapterHost } from "../src/cli-command-adapter";
import { parsePluginMaintenanceArgs } from "../src/plugin-maintenance";

test("CLI adapter host owns one idempotent instance", async () => {
  let starts = 0;
  let disposals = 0;
  const host = await createCliCommandAdapterHost(() => {
    starts += 1;
    return {
      done: Promise.resolve(),
      dispose() {
        disposals += 1;
      },
    };
  });
  expect(starts).toBe(1);
  await host.done;
  await host.close();
  await host.close();
  expect(disposals).toBe(1);
});

test("CLI adapter startup failure is surfaced without disposal", async () => {
  let starts = 0;
  await expect(
    createCliCommandAdapterHost(() => {
      starts += 1;
      throw new Error("CLI startup failed");
    }),
  ).rejects.toThrow("CLI startup failed");
  expect(starts).toBe(1);
});

test("plugin maintenance excludes framework transport", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-transport-maintenance-"));
  const listed = JSON.parse(text(runCli(root, "plugin", "list").stdout));
  expect(
    listed.some(
      (candidate: { id: string }) => candidate.id === "natalia-transport",
    ),
  ).toBe(false);
});

test("plugin maintenance parser rejects missing, extra, and unknown arguments", () => {
  for (const argv of [
    ["plugin", "enable"],
    ["plugin", "list", "extra"],
    ["plugin", "disable", "one", "two"],
    ["plugin", "list", "--unknown"],
    ["plugin", "list", "-x"],
    ["plugin", "list", "--workspace"],
    ["plugin", "list", "--workspace", "/one", "--workspace", "/two"],
  ]) {
    expect(() => parsePluginMaintenanceArgs(argv)).toThrow();
  }
});

function runCli(root: string, ...argv: string[]) {
  return Bun.spawnSync(
    [process.execPath, join(import.meta.dir, "..", "src", "main.ts"), ...argv],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
}

function text(value: Uint8Array) {
  return new TextDecoder().decode(value);
}
