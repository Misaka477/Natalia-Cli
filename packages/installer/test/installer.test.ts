import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveConfig } from "@natalia/config";
import {
  doctorPlugins,
  installPlugin,
  listInstalledPlugins,
  loadNataliaLock,
  reconcilePlugins,
  setPluginEnabled,
  uninstallPlugin,
  type PackageManagerRun,
} from "../src";

test("plugin closure installs, toggles, diagnoses, reconciles, and uninstalls", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-installer-"));
  const packageName = "@fixture/natalia-plugin";
  const packageDir = join(
    workspaceRoot,
    ".natalia",
    "plugins",
    "node_modules",
    "@fixture",
    "natalia-plugin",
  );
  const runs: string[][] = [];
  const runPackageManager: PackageManagerRun = async ({ args }) => {
    runs.push(args);
    if (args[0] === "uninstall") {
      await rm(packageDir, { recursive: true, force: true });
      return;
    }
    const prefix = join(workspaceRoot, ".natalia", "plugins");
    await mkdir(packageDir, { recursive: true });
    await writeFile(
      join(prefix, "package.json"),
      JSON.stringify({ dependencies: { [packageName]: "1.2.3" } }),
    );
    await writeFile(
      join(prefix, "package-lock.json"),
      JSON.stringify({
        lockfileVersion: 3,
        packages: {
          [`node_modules/${packageName}`]: {
            version: "1.2.3",
            integrity: "sha512-fixture",
          },
        },
      }),
    );
    await writeFile(
      join(packageDir, "natalia.plugin.json"),
      JSON.stringify({
        apiVersion: 2,
        id: "fixture.plugin",
        version: "1.2.3",
        name: "Fixture",
        entry: "index.ts",
        scope: "workspace",
      }),
    );
    await writeFile(join(packageDir, "index.ts"), "export default {};");
  };

  const installed = await installPlugin({
    workspaceRoot,
    spec: `${packageName}@1.2.3`,
    runPackageManager,
  });
  expect(installed).toMatchObject({
    installed: true,
    pluginID: "fixture.plugin",
    packageName,
    metadata: {
      resolvedVersion: "1.2.3",
      integrity: "sha512-fixture",
    },
  });
  expect(runs[0]).toContain("--ignore-scripts");
  expect(
    (await loadNataliaLock(workspaceRoot)).plugins["fixture.plugin"],
  ).toBeDefined();
  expect((await resolveConfig({ workspaceRoot })).config.plugins).toMatchObject(
    {
      enabled: { "fixture.plugin": true },
      packages: { "fixture.plugin": { version: "1.2.3" } },
    },
  );
  expect(await doctorPlugins(workspaceRoot)).toEqual([]);

  await setPluginEnabled({
    workspaceRoot,
    pluginID: "fixture.plugin",
    enabled: false,
  });
  expect(await listInstalledPlugins(workspaceRoot)).toEqual([
    expect.objectContaining({ id: "fixture.plugin", enabled: false }),
  ]);

  const configPath = join(workspaceRoot, ".natalia", "config.json");
  const config = JSON.parse(await readFile(configPath, "utf8"));
  delete config.plugins.packages["fixture.plugin"];
  await writeFile(configPath, JSON.stringify(config));
  expect(await doctorPlugins(workspaceRoot)).toEqual([
    expect.objectContaining({ code: "config_missing" }),
  ]);
  await reconcilePlugins(workspaceRoot, runPackageManager);
  expect(await doctorPlugins(workspaceRoot)).toEqual([]);

  await uninstallPlugin({
    workspaceRoot,
    pluginID: "fixture.plugin",
    runPackageManager,
  });
  expect((await loadNataliaLock(workspaceRoot)).plugins).toEqual({});
  expect(
    (await resolveConfig({ workspaceRoot })).config.plugins.packages[
      "fixture.plugin"
    ],
  ).toBeUndefined();
  expect(runs[1]?.[0]).toBe("uninstall");
});

test("plugin doctor reports a package missing from disk", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-doctor-"));
  await mkdir(join(workspaceRoot, ".natalia"), { recursive: true });
  await writeFile(
    join(workspaceRoot, ".natalia", "natalia.lock"),
    JSON.stringify({
      version: 1,
      plugins: {
        "missing.plugin": {
          packageName: "missing-package",
          manifest: "missing",
          metadata: {
            id: "missing.plugin",
            source: { type: "registry", spec: "missing-package" },
            resolvedVersion: "1.0.0",
            scope: "workspace",
            dependencies: [],
          },
        },
      },
    }),
  );
  expect(await doctorPlugins(workspaceRoot)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: "config_missing" }),
      expect.objectContaining({ code: "package_missing" }),
    ]),
  );
});
