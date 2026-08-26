import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCliCommandAdapterHost } from "../src/cli-command-adapter";
import {
  parsePluginMaintenanceArgs,
  runPluginMaintenanceCommand,
} from "../src/plugin-maintenance";
import { initializeOfficialPluginsForHostCommand } from "../src/official-plugins";

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

test("recognized host commands initialize official plugins in the distribution sibling store", async () => {
  const calls: Array<{
    pluginStoreRoot: string;
    distributionRoot: string;
  }> = [];
  for (const command of ["run", "daemon-status", "task", "status"]) {
    expect(
      await initializeOfficialPluginsForHostCommand(
        [command],
        async (input) => {
          calls.push(input);
          return { initialized: false, installed: [] };
        },
      ),
    ).toBe(true);
  }
  expect(calls).toHaveLength(4);
  expect(
    calls.every(({ pluginStoreRoot }) =>
      pluginStoreRoot.endsWith("dist/ts/plugin-store"),
    ),
  ).toBe(true);
  expect(
    calls.every(({ distributionRoot }) =>
      distributionRoot.endsWith("dist/ts/plugins"),
    ),
  ).toBe(true);
  expect(
    calls.every(
      ({ pluginStoreRoot, distributionRoot }) =>
        pluginStoreRoot === join(distributionRoot, "..", "plugin-store"),
    ),
  ).toBe(true);
  expect(
    calls.every(
      ({ pluginStoreRoot }) => !pluginStoreRoot.includes("workspace"),
    ),
  ).toBe(true);
});

test("unknown and deprecated command paths do not initialize plugins", async () => {
  let calls = 0;
  for (const argv of [["unknown"], ["--once"], ["--diagnostics"]])
    expect(
      await initializeOfficialPluginsForHostCommand(argv, async () => {
        calls += 1;
        return { initialized: false, installed: [] };
      }),
    ).toBe(false);
  expect(calls).toBe(0);
});

test("the default local status path initializes official plugins", async () => {
  let calls = 0;
  expect(
    await initializeOfficialPluginsForHostCommand([], async () => {
      calls += 1;
      return { initialized: false, installed: [] };
    }),
  ).toBe(true);
  expect(calls).toBe(1);
});

test("official reinstall has explicit parsing and lifecycle routing", async () => {
  const parsed = parsePluginMaintenanceArgs([
    "plugin",
    "reinstall",
    "natalia-tool-ask",
  ]);
  let routed:
    | {
        pluginID: string;
        pluginStoreRoot: string;
        distributionRoot: string;
      }
    | undefined;
  const originalLog = console.log;
  console.log = () => undefined;
  try {
    await runPluginMaintenanceCommand([], parsed, {
      reinstallOfficialPlugin: async (input) => {
        routed = input;
        return { installed: true } as never;
      },
    });
  } finally {
    console.log = originalLog;
  }
  expect(routed).toMatchObject({
    pluginID: "natalia-tool-ask",
  });
  expect(routed!.distributionRoot.endsWith("dist/ts/plugins")).toBe(true);
  expect(routed!.pluginStoreRoot.endsWith("dist/ts/plugin-store")).toBe(true);
  expect(routed!.pluginStoreRoot).toBe(
    join(routed!.distributionRoot, "..", "plugin-store"),
  );
  expect(routed!.pluginStoreRoot).not.toContain("/workspace");
  for (const argv of [
    ["plugin", "install", "demo", "--workspace", "/workspace"],
    ["plugin", "uninstall", "demo", "--workspace", "/workspace"],
    ["plugin", "reinstall", "natalia-tool-ask", "--workspace", "/workspace"],
    ["plugin", "doctor", "--workspace", "/workspace"],
    ["plugin", "reconcile", "--workspace", "/workspace"],
  ])
    expect(() => parsePluginMaintenanceArgs(argv)).toThrow(
      "does not accept --workspace",
    );
  expect(() =>
    parsePluginMaintenanceArgs(["plugin", "reinstall", "not-official"]),
  ).toThrow("unknown official plugin");
});

test("plugin maintenance excludes framework transport", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-transport-maintenance-"));
  await mkdir(join(root, ".natalia"));
  await writeFile(
    join(root, ".natalia", "official-plugins-initialized-v1"),
    "initialized\n",
  );
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
    ["plugin", "create", "demo"],
    ["plugin", "create", "demo", "--id"],
    ["plugin", "create", "one", "two", "--id", "demo.plugin"],
    ["plugin", "install", "demo", "--id", "demo.plugin"],
  ]) {
    expect(() => parsePluginMaintenanceArgs(argv)).toThrow();
  }
});

test("plugin create writes a publishable JavaScript package", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-plugin-create-"));
  const directory = join(root, "demo-plugin");
  const result = runCli(
    root,
    "plugin",
    "create",
    directory,
    "--id",
    "demo.plugin",
    "--package",
    "@demo/natalia-plugin",
  );
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(text(result.stdout))).toMatchObject({
    created: true,
    directory,
    pluginID: "demo.plugin",
    packageName: "@demo/natalia-plugin",
  });
  const manifest = JSON.parse(
    await readFile(join(directory, "natalia.plugin.json"), "utf8"),
  );
  const packageJSON = JSON.parse(
    await readFile(join(directory, "package.json"), "utf8"),
  );
  expect(manifest).toMatchObject({
    id: "demo.plugin",
    entry: "src/index.js",
    hooks: {},
    integrationPoints: ["commands"],
  });
  expect(packageJSON).toMatchObject({
    name: "@demo/natalia-plugin",
    files: ["src", "natalia.plugin.json"],
    exports: { ".": "./src/index.js" },
  });
  expect(await readFile(join(directory, "src", "index.js"), "utf8")).toContain(
    "definePlugin",
  );
  expect(
    runCli(root, "plugin", "create", directory, "--id", "demo.plugin").exitCode,
  ).not.toBe(0);
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
