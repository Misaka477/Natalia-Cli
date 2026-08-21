import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CLI_PLUGIN_ID,
  createCliCommandAdapterHost,
  createCliCommandAdapterPlugin,
} from "../src/cli-command-adapter";

test("CLI plugin registration is inert", () => {
  let starts = 0;
  const plugin = createCliCommandAdapterPlugin(() => {
    starts += 1;
    return { done: Promise.resolve(), dispose() {} };
  });
  expect(starts).toBe(0);
  expect(plugin.manifest).toMatchObject({
    apiVersion: 2,
    integrationPoints: ["adapters"],
  });
});

test("CLI adapter host owns one idempotent instance", async () => {
  let starts = 0;
  let disposals = 0;
  const host = await createCliCommandAdapterHost({}, () => {
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

test("disabled CLI adapter creates no command resources", async () => {
  let starts = 0;
  await expect(
    createCliCommandAdapterHost({ enabled: false }, () => {
      starts += 1;
      return { done: Promise.resolve(), dispose() {} };
    }),
  ).rejects.toThrow(`CLI plugin is disabled (${CLI_PLUGIN_ID})`);
  expect(starts).toBe(0);
});

test("CLI adapter startup failure is surfaced without disposal", async () => {
  let starts = 0;
  await expect(
    createCliCommandAdapterHost({}, () => {
      starts += 1;
      throw new Error("CLI startup failed");
    }),
  ).rejects.toThrow("CLI startup failed");
  expect(starts).toBe(1);
});

test("plugin maintenance can recover a disabled builtin CLI", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-disabled-"));
  await mkdir(join(root, ".natalia"), { recursive: true });
  const configPath = join(root, ".natalia", "config.json");
  await writeFile(
    configPath,
    JSON.stringify({
      version: 3,
      plugins: { enabled: { [CLI_PLUGIN_ID]: false } },
    }),
  );

  const disabled = runCli(root, "tool", "list");
  expect(disabled.exitCode).not.toBe(0);
  expect(text(disabled.stderr)).toContain(
    `CLI plugin is disabled (${CLI_PLUGIN_ID})`,
  );

  const listed = runCli(root, "plugin", "list");
  expect(listed.exitCode).toBe(0);
  expect(JSON.parse(text(listed.stdout))).toContainEqual({
    id: CLI_PLUGIN_ID,
    enabled: false,
    builtin: true,
  });

  const enabled = runCli(root, "plugin", "enable", CLI_PLUGIN_ID);
  expect(enabled.exitCode).toBe(0);
  expect(JSON.parse(text(enabled.stdout))).toMatchObject({
    id: CLI_PLUGIN_ID,
    enabled: true,
    builtin: true,
  });
  expect(
    JSON.parse(await readFile(configPath, "utf8")).plugins.enabled[
      CLI_PLUGIN_ID
    ],
  ).toBe(true);
  expect(runCli(root, "tool", "list").exitCode).toBe(0);
});

test("builtin CLI cannot be installed or uninstalled", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-builtin-"));
  for (const action of ["install", "uninstall"]) {
    const child = runCli(root, "plugin", action, CLI_PLUGIN_ID);
    expect(child.exitCode).not.toBe(0);
    expect(text(child.stderr)).toContain(
      `plugin ${action} cannot operate on builtin ${CLI_PLUGIN_ID}`,
    );
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
