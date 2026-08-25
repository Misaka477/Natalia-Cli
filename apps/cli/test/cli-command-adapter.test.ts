import { expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
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
