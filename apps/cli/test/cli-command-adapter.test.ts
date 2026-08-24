import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CLI_PLUGIN_ID,
  createCliCommandAdapterHost,
  createCliCommandAdapterPlugin,
} from "../src/cli-command-adapter";
import { parsePluginMaintenanceArgs } from "../src/plugin-maintenance";
import {
  TRANSPORT_PLUGIN_ID,
  TRANSPORT_PLUGIN_MANIFEST,
} from "../src/transport-plugin";

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
    name: "CLI",
    version: "1.0.0",
    scope: "process",
    enabled: false,
    installed: true,
    source: { type: "runtime" },
    packageName: null,
  });

  const enabled = runCli(root, "plugin", "enable", CLI_PLUGIN_ID);
  expect(enabled.exitCode).toBe(0);
  expect(JSON.parse(text(enabled.stdout))).toMatchObject({
    pluginID: CLI_PLUGIN_ID,
    enabled: true,
  });
  expect(
    JSON.parse(await readFile(configPath, "utf8")).plugins.enabled[
      CLI_PLUGIN_ID
    ],
  ).toBe(true);
  expect(runCli(root, "trust", "list", "--workspace", root).exitCode).toBe(0);
});

test("builtin CLI uninstall durably disables the runtime default", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-cli-builtin-"));
  const child = runCli(root, "plugin", "uninstall", CLI_PLUGIN_ID);
  expect(child.exitCode).toBe(0);
  expect(JSON.parse(text(child.stdout))).toMatchObject({
    pluginID: CLI_PLUGIN_ID,
    enabled: false,
    disposition: "runtime default disabled",
  });
});

test("plugin maintenance catalogs and recovers the CLI transport", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-transport-maintenance-"));
  const listed = JSON.parse(text(runCli(root, "plugin", "list").stdout));
  const row = listed.find(
    (candidate: { id: string }) => candidate.id === TRANSPORT_PLUGIN_ID,
  );
  expect(row).toEqual({
    id: TRANSPORT_PLUGIN_MANIFEST.id,
    name: TRANSPORT_PLUGIN_MANIFEST.name,
    version: TRANSPORT_PLUGIN_MANIFEST.version,
    scope: TRANSPORT_PLUGIN_MANIFEST.scope,
    enabled: true,
    installed: true,
    source: { type: "runtime" },
    packageName: null,
  });
  const keys = Object.keys(row).sort();
  expect(
    listed.every(
      (candidate: object) =>
        JSON.stringify(Object.keys(candidate).sort()) === JSON.stringify(keys),
    ),
  ).toBe(true);

  expect(runCli(root, "plugin", "disable", TRANSPORT_PLUGIN_ID).exitCode).toBe(
    0,
  );
  expect(transportEnabled(root)).toBe(false);
  expect(runCli(root, "plugin", "enable", TRANSPORT_PLUGIN_ID).exitCode).toBe(
    0,
  );
  expect(transportEnabled(root)).toBe(true);
  expect(
    runCli(root, "plugin", "uninstall", TRANSPORT_PLUGIN_ID).exitCode,
  ).toBe(0);
  expect(transportEnabled(root)).toBe(false);
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

function transportEnabled(root: string) {
  const rows = JSON.parse(text(runCli(root, "plugin", "list").stdout));
  return rows.find(
    (candidate: { id: string }) => candidate.id === TRANSPORT_PLUGIN_ID,
  ).enabled;
}
