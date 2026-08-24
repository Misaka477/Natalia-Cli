import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveConfig, updateConfig } from "@natalia/config";
import {
  doctorPlugins,
  installPlugin,
  listInstalledPlugins,
  loadNataliaLock,
  reconcilePlugins,
  saveNataliaLock,
  setPluginEnabled,
  uninstallPlugin,
  type PackageManagerRun,
} from "../src";
import { rollbackWith } from "../src/closure";

const packageName = "@fixture/natalia-plugin";
const pluginID = "fixture.plugin";

function fixturePackageManager(runs: string[][]): PackageManagerRun {
  return async ({ args }) => {
    runs.push(args);
    const prefix = args[args.indexOf("--prefix") + 1]!;
    const packageDir = join(
      prefix,
      "node_modules",
      "@fixture",
      "natalia-plugin",
    );
    if (args[0] === "uninstall") {
      await rm(packageDir, { recursive: true, force: true });
      return;
    }
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
        id: pluginID,
        version: "1.2.3",
        name: "Fixture",
        entry: "index.ts",
        scope: "workspace",
      }),
    );
    await writeFile(join(packageDir, "index.ts"), "export default {};");
  };
}

async function installedWorkspace() {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-transaction-"));
  const runs: string[][] = [];
  const runPackageManager = fixturePackageManager(runs);
  await installPlugin({
    workspaceRoot,
    spec: `${packageName}@1.2.3`,
    runPackageManager,
  });
  return { workspaceRoot, runs, runPackageManager };
}

async function transactionState(workspaceRoot: string) {
  const natalia = join(workspaceRoot, ".natalia");
  return Promise.all(
    [
      "plugins/package.json",
      "plugins/package-lock.json",
      "natalia.lock",
      "config.json",
    ].map(async (path) => readFile(join(natalia, path), "utf8")),
  );
}

test("plugin lifecycle stages, catalogs, toggles, reconciles, and fully uninstalls", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-installer-"));
  const runs: string[][] = [];
  const runPackageManager = fixturePackageManager(runs);
  const installed = await installPlugin({
    workspaceRoot,
    spec: `${packageName}@1.2.3`,
    runPackageManager,
  });
  expect(installed).toMatchObject({
    installed: true,
    pluginID,
    packageName,
    metadata: { resolvedVersion: "1.2.3", integrity: "sha512-fixture" },
  });
  expect(runs).toHaveLength(2);
  expect(runs[0]!.join(" ")).toContain("plugin-staging");
  expect(runs[1]!.join(" ")).toContain("plugins");
  expect(await doctorPlugins(workspaceRoot)).toEqual([]);

  const rows = await listInstalledPlugins(workspaceRoot);
  expect(rows.find((row) => row.id === "natalia-cli")).toMatchObject({
    name: "CLI",
    installed: true,
    source: { type: "runtime" },
    packageName: null,
  });
  expect(rows.find((row) => row.id === pluginID)).toMatchObject({
    name: "Fixture",
    installed: true,
    packageName,
  });
  expect(rows.map((row) => row.id)).toEqual(
    [...rows.map((row) => row.id)].sort(),
  );
  expect(
    new Set(rows.map((row) => Object.keys(row).sort().join(","))).size,
  ).toBe(1);

  await setPluginEnabled({ workspaceRoot, pluginID, enabled: false });
  await setPluginEnabled({
    workspaceRoot,
    pluginID: "natalia-tool-todo",
    enabled: false,
  });
  const toggled = JSON.parse(
    await readFile(join(workspaceRoot, ".natalia", "config.json"), "utf8"),
  );
  expect(toggled.plugins.enabled).toMatchObject({
    [pluginID]: false,
    "natalia-tool-todo": false,
  });
  expect(toggled.tools?.enabled).toBeUndefined();

  await updateConfig(workspaceRoot, {
    plugins: {
      settings: { [pluginID]: { key: true } },
      capabilities: { [pluginID]: ["tools"] },
      readOnly: { [pluginID]: true },
    },
  });
  await uninstallPlugin({ workspaceRoot, pluginID, runPackageManager });
  expect((await loadNataliaLock(workspaceRoot)).plugins).toEqual({});
  const config = (await resolveConfig({ workspaceRoot })).config.plugins;
  for (const key of [
    "packages",
    "enabled",
    "settings",
    "capabilities",
    "readOnly",
  ] as const)
    expect(config[key][pluginID]).toBeUndefined();
});

test("invalid staged install leaves no live package, lock, or config", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-invalid-"));
  const runPackageManager: PackageManagerRun = async ({ args }) => {
    const prefix = args[args.indexOf("--prefix") + 1]!;
    const packageDir = join(prefix, "node_modules", "invalid-plugin");
    await mkdir(packageDir, { recursive: true });
    await writeFile(
      join(prefix, "package.json"),
      JSON.stringify({ dependencies: { "invalid-plugin": "1.0.0" } }),
    );
    await writeFile(
      join(prefix, "package-lock.json"),
      JSON.stringify({
        packages: { "node_modules/invalid-plugin": { version: "1.0.0" } },
      }),
    );
  };
  await expect(
    installPlugin({ workspaceRoot, spec: "invalid-plugin", runPackageManager }),
  ).rejects.toThrow("exactly one natalia.plugin.json");
  expect(existsSync(join(workspaceRoot, ".natalia", "plugins"))).toBe(false);
  expect(existsSync(join(workspaceRoot, ".natalia", "natalia.lock"))).toBe(
    false,
  );
  expect(existsSync(join(workspaceRoot, ".natalia", "config.json"))).toBe(
    false,
  );
});

test("uninstalling a runtime default durably disables it", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-default-off-"));
  const result = await uninstallPlugin({
    workspaceRoot,
    pluginID: "natalia-tool-todo",
  });
  expect(result).toMatchObject({
    uninstalled: false,
    enabled: false,
    disposition: "runtime default disabled",
  });
  expect(
    (await resolveConfig({ workspaceRoot })).config.plugins.enabled[
      "natalia-tool-todo"
    ],
  ).toBe(false);
});

test("runtime default uninstall restores config after a reported write failure", async () => {
  const workspaceRoot = await mkdtemp(
    join(tmpdir(), "natalia-default-rollback-"),
  );
  const configPath = join(workspaceRoot, ".natalia", "config.json");
  await mkdir(join(workspaceRoot, ".natalia"), { recursive: true });
  const before = '{"version":3,"plugins":{"enabled":{"natalia-cli":false}}}\n';
  await writeFile(configPath, before);
  await expect(
    uninstallPlugin({
      workspaceRoot,
      pluginID: "natalia-tool-todo",
      seams: {
        updateConfig: async (root, patch, options) => {
          await updateConfig(root, patch, options);
          throw new Error("config write failed");
        },
      },
    }),
  ).rejects.toThrow("config write failed");
  expect(await readFile(configPath, "utf8")).toBe(before);
});

test("plugin doctor reports and reconciles a package missing from disk", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-doctor-"));
  const runs: string[][] = [];
  const runPackageManager = fixturePackageManager(runs);
  await installPlugin({
    workspaceRoot,
    spec: `${packageName}@1.2.3`,
    runPackageManager,
  });
  await rm(
    join(
      workspaceRoot,
      ".natalia",
      "plugins",
      "node_modules",
      "@fixture",
      "natalia-plugin",
    ),
    { recursive: true },
  );
  expect(await doctorPlugins(workspaceRoot)).toContainEqual(
    expect.objectContaining({ code: "package_missing" }),
  );
  await reconcilePlugins(workspaceRoot, runPackageManager);
  expect(await doctorPlugins(workspaceRoot)).toEqual([]);
});

test("reinstall restores the complete working closure after live npm failure", async () => {
  const { workspaceRoot, runPackageManager } = await installedWorkspace();
  const before = await transactionState(workspaceRoot);
  let runs = 0;
  await expect(
    installPlugin({
      workspaceRoot,
      spec: `${packageName}@2.0.0`,
      runPackageManager: async (input) => {
        runs += 1;
        await runPackageManager(input);
        if (runs === 2) {
          await writeFile(
            join(input.args[input.args.indexOf("--prefix") + 1]!, "corrupt"),
            "yes",
          );
          throw new Error("live npm failed");
        }
      },
    }),
  ).rejects.toThrow("live npm failed");
  expect(await transactionState(workspaceRoot)).toEqual(before);
  expect(
    existsSync(join(workspaceRoot, ".natalia", "plugins", "corrupt")),
  ).toBe(false);
});

test("install restores closure, lock, and config after metadata commit failures", async () => {
  for (const failure of ["lock", "config"] as const) {
    const { workspaceRoot, runPackageManager } = await installedWorkspace();
    const before = await transactionState(workspaceRoot);
    await expect(
      installPlugin({
        workspaceRoot,
        spec: `${packageName}@1.2.3`,
        runPackageManager,
        seams:
          failure === "lock"
            ? {
                saveLock: async (root, lock) => {
                  await saveNataliaLock(root, lock);
                  throw new Error("lock write failed");
                },
              }
            : {
                updateConfig: async (root, patch, options) => {
                  await updateConfig(root, patch, options);
                  throw new Error("config write failed");
                },
              },
      }),
    ).rejects.toThrow(`${failure} write failed`);
    expect(await transactionState(workspaceRoot)).toEqual(before);
  }
});

test("committed install reports staging cleanup failure as a warning", async () => {
  const workspaceRoot = await mkdtemp(
    join(tmpdir(), "natalia-cleanup-warning-"),
  );
  const result = await installPlugin({
    workspaceRoot,
    spec: packageName,
    runPackageManager: fixturePackageManager([]),
    seams: {
      cleanupStage: async () => {
        throw new Error("staging cleanup failed");
      },
    },
  });
  expect(result).toMatchObject({
    installed: true,
    pluginID,
    cleanupWarning: "staging cleanup failed",
  });
  expect(
    (await loadNataliaLock(workspaceRoot)).plugins[pluginID],
  ).toBeDefined();
});

test("install keeps its live closure when a missing backup cannot be discarded", async () => {
  const workspaceRoot = await mkdtemp(
    join(tmpdir(), "natalia-discard-install-"),
  );
  const result = await installPlugin({
    workspaceRoot,
    spec: packageName,
    runPackageManager: fixturePackageManager([]),
    seams: {
      discardBackup: async (snapshot) => {
        await rm(snapshot.backup, { recursive: true, force: true });
        throw new Error("missing backup cleanup failed");
      },
    },
  });
  expect(result.cleanupWarning).toContain("missing backup cleanup failed");
  expect(
    existsSync(
      join(
        workspaceRoot,
        ".natalia",
        "plugins",
        "node_modules",
        "@fixture",
        "natalia-plugin",
      ),
    ),
  ).toBe(true);
  expect(
    (await loadNataliaLock(workspaceRoot)).plugins[pluginID],
  ).toBeDefined();
});

test("failed install aggregates staging cleanup failure after original error", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-cleanup-error-"));
  const original = new Error("package manager failed");
  const cleanup = new Error("staging cleanup failed");
  try {
    await installPlugin({
      workspaceRoot,
      spec: packageName,
      runPackageManager: async () => {
        throw original;
      },
      seams: {
        cleanupStage: async () => {
          throw cleanup;
        },
      },
    });
  } catch (error) {
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([original, cleanup]);
  }
});

test("install rejects duplicate plugin IDs and package manifest ID changes", async () => {
  const { workspaceRoot } = await installedWorkspace();
  const manager =
    (name: string, id: string): PackageManagerRun =>
    async ({ args }) => {
      const prefix = args[args.indexOf("--prefix") + 1]!;
      const dir = join(prefix, "node_modules", name);
      await mkdir(dir, { recursive: true });
      await writeFile(
        join(prefix, "package.json"),
        JSON.stringify({ dependencies: { [name]: "1.0.0" } }),
      );
      await writeFile(
        join(prefix, "package-lock.json"),
        JSON.stringify({
          packages: { [`node_modules/${name}`]: { version: "1.0.0" } },
        }),
      );
      await writeFile(
        join(dir, "natalia.plugin.json"),
        JSON.stringify({
          apiVersion: 1,
          id,
          version: "1.0.0",
          name,
          entry: "index.ts",
          scope: "workspace",
        }),
      );
      await writeFile(join(dir, "index.ts"), "export default {};");
    };
  await expect(
    installPlugin({
      workspaceRoot,
      spec: "other-package",
      runPackageManager: manager("other-package", pluginID),
    }),
  ).rejects.toThrow("already owned");
  await expect(
    installPlugin({
      workspaceRoot,
      spec: packageName,
      runPackageManager: manager(packageName, "changed.id"),
    }),
  ).rejects.toThrow("changing plugin id");
});

test("uninstall rolls back config, closure, and lock on every mutation failure", async () => {
  for (const failure of ["config", "npm", "lock"] as const) {
    const { workspaceRoot, runPackageManager } = await installedWorkspace();
    const before = await transactionState(workspaceRoot);
    await expect(
      uninstallPlugin({
        workspaceRoot,
        pluginID,
        runPackageManager:
          failure === "npm"
            ? async (input) => {
                await runPackageManager(input);
                throw new Error("npm uninstall failed");
              }
            : runPackageManager,
        seams:
          failure === "config"
            ? {
                updateConfig: async () => {
                  throw new Error("config removal failed");
                },
              }
            : failure === "lock"
              ? {
                  saveLock: async (root, lock) => {
                    await saveNataliaLock(root, lock);
                    throw new Error("lock removal failed");
                  },
                }
              : undefined,
      }),
    ).rejects.toThrow();
    expect(await transactionState(workspaceRoot)).toEqual(before);
  }
});

test("uninstall keeps its committed closure after partial backup disposal fails", async () => {
  const { workspaceRoot, runPackageManager } = await installedWorkspace();
  const result = await uninstallPlugin({
    workspaceRoot,
    pluginID,
    runPackageManager,
    seams: {
      discardBackup: async (snapshot) => {
        await rm(join(snapshot.backup, "node_modules"), {
          recursive: true,
          force: true,
        });
        throw new Error("partial backup cleanup failed");
      },
    },
  });
  expect(result).toMatchObject({
    uninstalled: true,
    cleanupWarning: "partial backup cleanup failed",
  });
  expect(
    existsSync(join(workspaceRoot, ".natalia", "plugins", "package.json")),
  ).toBe(true);
  expect(
    existsSync(
      join(
        workspaceRoot,
        ".natalia",
        "plugins",
        "node_modules",
        "@fixture",
        "natalia-plugin",
      ),
    ),
  ).toBe(false);
  expect(
    (await loadNataliaLock(workspaceRoot)).plugins[pluginID],
  ).toBeUndefined();
});

test("reconcile restores closure and config when a second package repair fails", async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), "natalia-reconcile-npm-"));
  const paths = join(workspaceRoot, ".natalia");
  await mkdir(join(paths, "plugins"), { recursive: true });
  await writeFile(join(paths, "plugins", "sentinel"), "before");
  const configPath = join(paths, "config.json");
  const configBefore = '{"version":3,"plugins":{"enabled":{}}}\n';
  await writeFile(configPath, configBefore);
  await saveNataliaLock(workspaceRoot, {
    version: 1,
    plugins: {
      "first.plugin": lockEntry("first-package", "first.plugin"),
      "second.plugin": lockEntry("second-package", "second.plugin"),
    },
  });
  let repairs = 0;
  await expect(
    reconcilePlugins(workspaceRoot, async ({ args }) => {
      repairs += 1;
      const prefix = args[args.indexOf("--prefix") + 1]!;
      await writeFile(join(prefix, `repair-${repairs}`), "changed");
      if (repairs === 2) throw new Error("second repair failed");
    }),
  ).rejects.toThrow("second repair failed");
  expect(await readFile(join(paths, "plugins", "sentinel"), "utf8")).toBe(
    "before",
  );
  expect(existsSync(join(paths, "plugins", "repair-1"))).toBe(false);
  expect(existsSync(join(paths, "plugins", "repair-2"))).toBe(false);
  expect(await readFile(configPath, "utf8")).toBe(configBefore);
});

test("reconcile restores repaired packages after a config failure", async () => {
  const workspaceRoot = await mkdtemp(
    join(tmpdir(), "natalia-reconcile-config-"),
  );
  const paths = join(workspaceRoot, ".natalia");
  await mkdir(join(paths, "plugins"), { recursive: true });
  const configPath = join(paths, "config.json");
  const configBefore = '{"version":3,"plugins":{"enabled":{}}}\n';
  await writeFile(configPath, configBefore);
  await saveNataliaLock(workspaceRoot, {
    version: 1,
    plugins: { [pluginID]: lockEntry(packageName, pluginID) },
  });
  await expect(
    reconcilePlugins(
      workspaceRoot,
      fixturePackageManager([]),
      {},
      {
        updateConfig: async (root, patch, options) => {
          await updateConfig(root, patch, options);
          throw new Error("reconcile config failed");
        },
      },
    ),
  ).rejects.toThrow("reconcile config failed");
  expect(
    existsSync(
      join(paths, "plugins", "node_modules", "@fixture", "natalia-plugin"),
    ),
  ).toBe(false);
  expect(await readFile(configPath, "utf8")).toBe(configBefore);
});

test("package validation enforces package, manifest, entry, and lock boundaries", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-boundary-"));
  const manager =
    (
      mode: "dependency" | "entryEscape" | "packageEscape" | "missing",
    ): PackageManagerRun =>
    async ({ args }) => {
      const prefix = args[args.indexOf("--prefix") + 1]!;
      const dir = join(prefix, "node_modules", "boundary-plugin");
      const packageRoot =
        mode === "packageEscape" ? join(prefix, "outside-package") : dir;
      await mkdir(packageRoot, { recursive: true });
      if (mode === "packageEscape") {
        await mkdir(join(prefix, "node_modules"), { recursive: true });
        await symlink(packageRoot, dir, "dir");
      }
      await writeFile(
        join(prefix, "package.json"),
        JSON.stringify({ dependencies: { "boundary-plugin": "1.0.0" } }),
      );
      await writeFile(
        join(prefix, "package-lock.json"),
        JSON.stringify({
          packages:
            mode === "missing"
              ? {}
              : { "node_modules/boundary-plugin": { version: "1.0.0" } },
        }),
      );
      await writeFile(
        join(packageRoot, "natalia.plugin.json"),
        JSON.stringify({
          apiVersion: 1,
          id: "boundary.plugin",
          version: "1.0.0",
          name: "Boundary",
          entry: "index.ts",
          scope: "workspace",
        }),
      );
      if (mode === "entryEscape") {
        await writeFile(join(prefix, "outside.ts"), "export default {};");
        await symlink(
          join(prefix, "outside.ts"),
          join(packageRoot, "index.ts"),
        );
      } else
        await writeFile(join(packageRoot, "index.ts"), "export default {};");
      if (mode === "dependency") {
        const dependency = join(dir, "node_modules", "dependency");
        await mkdir(dependency, { recursive: true });
        await writeFile(join(dependency, "natalia.plugin.json"), "{}");
      }
    };
  await expect(
    installPlugin({
      workspaceRoot: root,
      spec: "boundary-plugin",
      runPackageManager: manager("entryEscape"),
    }),
  ).rejects.toThrow("entry escapes");
  await expect(
    installPlugin({
      workspaceRoot: root,
      spec: "boundary-plugin",
      runPackageManager: manager("packageEscape"),
    }),
  ).rejects.toThrow("package escapes node_modules");
  await expect(
    installPlugin({
      workspaceRoot: root,
      spec: "boundary-plugin",
      runPackageManager: manager("missing"),
    }),
  ).rejects.toThrow("package-lock is missing");
  const installed = await installPlugin({
    workspaceRoot: root,
    spec: "boundary-plugin",
    runPackageManager: manager("dependency"),
  });
  expect(installed?.pluginID).toBe("boundary.plugin");
});

test("rollback attempts every restoration and aggregates failures", async () => {
  const attempts: string[] = [];
  const original = new Error("mutation failed");
  const firstRestore = new Error("closure restore failed");
  try {
    await rollbackWith(original, [
      async () => {
        attempts.push("closure");
        throw firstRestore;
      },
      async () => {
        attempts.push("lock");
      },
      async () => {
        attempts.push("config");
      },
    ]);
  } catch (error) {
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([original, firstRestore]);
  }
  expect(attempts).toEqual(["closure", "lock", "config"]);
});

test("real and symlink workspace paths share one operation queue", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-realpath-"));
  const alias = `${root}-alias`;
  await symlink(root, alias, "dir");
  let active = 0;
  let maximum = 0;
  const base = fixturePackageManager([]);
  const manager: PackageManagerRun = async (input) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await base(input);
    active -= 1;
  };
  await Promise.all([
    installPlugin({
      workspaceRoot: root,
      spec: packageName,
      runPackageManager: manager,
    }),
    installPlugin({
      workspaceRoot: alias,
      spec: packageName,
      runPackageManager: manager,
    }),
  ]);
  expect(maximum).toBe(1);
});

test("custom global config participates in maintenance reads and writes", async () => {
  const root = await mkdtemp(join(tmpdir(), "natalia-custom-config-"));
  const globalPath = join(root, "custom-global.json");
  await writeFile(
    globalPath,
    JSON.stringify({
      version: 3,
      plugins: { enabled: { "natalia-cli": false } },
    }),
  );
  expect(
    (await listInstalledPlugins(root, { globalPath })).find(
      (row) => row.id === "natalia-cli",
    )?.enabled,
  ).toBe(false);
  await setPluginEnabled({
    workspaceRoot: root,
    pluginID: "natalia-cli",
    enabled: true,
    config: { globalPath },
  });
  expect(
    (await resolveConfig({ workspaceRoot: root, globalPath })).config.plugins
      .enabled["natalia-cli"],
  ).toBe(true);
});

function lockEntry(packageName: string, id: string) {
  return {
    packageName,
    manifest: `.natalia/plugins/node_modules/${packageName}/natalia.plugin.json`,
    metadata: {
      id,
      source: { type: "registry" as const, spec: `${packageName}@1.2.3` },
      resolvedVersion: "1.2.3",
      integrity: "sha512-fixture",
      scope: "workspace" as const,
      dependencies: [],
    },
  };
}
