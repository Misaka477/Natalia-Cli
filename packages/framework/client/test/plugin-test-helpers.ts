import {
  cp,
  link,
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
  rm,
  stat,
} from "node:fs/promises";
import { afterEach } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  initializeOfficialPlugins,
  OFFICIAL_PLUGIN_PACKAGES,
  type PackageManagerRun,
} from "@natalia/installer";
import {
  createRealRuntimeClient as createRuntimeClient,
  type RealRuntimeClientOptions,
} from "../src";
import { pluginManifestSchema } from "@natalia/plugin";

const officialPluginDistribution = resolve("dist", "ts", "plugins");
const officialPluginTestWorkspaces = resolve(
  "dist",
  "ts",
  "client-test-workspaces",
);
const officialPluginConfigFixture = "official-plugin-config.test.json";
const officialPluginStoreSuffix = "-plugin-store";
const testWorkspaces = new Set<string>();

afterEach(async () => {
  const workspaces = [...testWorkspaces];
  testWorkspaces.clear();
  await Promise.all(
    workspaces.map((workspace) =>
      rm(workspace, { recursive: true, force: true }),
    ),
  );
});

export async function officialPluginWorkspace(prefix: string) {
  await assertOfficialPluginDistribution();
  await mkdir(officialPluginTestWorkspaces, { recursive: true });
  const workspaceRoot = await mkdtemp(
    join(officialPluginTestWorkspaces, basename(prefix)),
  );
  testWorkspaces.add(workspaceRoot);
  const pluginStoreRoot = officialPluginStoreRoot(workspaceRoot);
  testWorkspaces.add(pluginStoreRoot);
  await initializeOfficialPlugins({
    pluginStoreRoot,
    distributionRoot: officialPluginDistribution,
    runPackageManager: installPrebuiltPackage,
  });
  const configPath = join(workspaceRoot, ".natalia", "config.json");
  await mkdir(join(workspaceRoot, ".natalia"), { recursive: true });
  await writeFile(configPath, JSON.stringify({ version: 3 }));
  await writeFile(
    join(workspaceRoot, ".natalia", officialPluginConfigFixture),
    await readFile(configPath),
  );
  return workspaceRoot;
}

export function createOfficialRuntimeClient(
  options: RealRuntimeClientOptions = {},
) {
  restoreOfficialPluginConfig(options.workspaceRoot ?? process.cwd());
  const capabilityRegistry = options.capabilityRegistry;
  const client = createRuntimeClient({
    ...options,
    pluginStoreRoot:
      options.pluginStoreRoot ??
      officialPluginStoreRoot(options.workspaceRoot ?? process.cwd()),
    ...(capabilityRegistry ? { capabilityRegistry } : {}),
  });
  const reloadConfig = client.reloadConfig?.bind(client);
  if (reloadConfig)
    client.reloadConfig = async () => {
      restoreOfficialPluginConfig(options.workspaceRoot ?? process.cwd());
      return await reloadConfig();
    };
  const dispose = client.dispose?.bind(client);
  if (dispose)
    client.dispose = async () => {
      await dispose();
    };
  return client;
}

export function officialPluginStoreRoot(workspaceRoot: string) {
  return `${workspaceRoot}${officialPluginStoreSuffix}`;
}

export async function installFixturePlugin(
  workspaceRoot: string,
  sourceRoot: string,
) {
  const manifest = pluginManifestSchema.parse(
    JSON.parse(await readFile(join(sourceRoot, "natalia.plugin.json"), "utf8")),
  );
  const pluginStoreRoot = officialPluginStoreRoot(workspaceRoot);
  const packageName = `fixture-${manifest.id}`;
  const packageRoot = join(pluginStoreRoot, "node_modules", packageName);
  await rm(packageRoot, { recursive: true, force: true });
  await mkdir(dirname(packageRoot), { recursive: true });
  await cp(sourceRoot, packageRoot, { recursive: true });
  const manifestPath = join(packageRoot, "natalia.plugin.json");
  const lockPath = join(pluginStoreRoot, "natalia.lock");
  const lock = await readJSONFile<{
    version: 1;
    plugins: Record<string, unknown>;
  }>(lockPath, { version: 1, plugins: {} });
  lock.plugins[manifest.id] = {
    packageName,
    manifest: manifestPath,
    metadata: {
      id: manifest.id,
      source: { type: "path", path: sourceRoot },
      resolvedVersion: manifest.version,
      scope: manifest.scope,
      dependencies: [],
    },
  };
  await writeFile(lockPath, JSON.stringify(lock));
}

export function restoreOfficialPluginConfig(workspaceRoot: string) {
  const fixturePath = join(
    workspaceRoot,
    ".natalia",
    officialPluginConfigFixture,
  );
  if (!existsSync(fixturePath)) return;
  const configPath = join(workspaceRoot, ".natalia", "config.json");
  try {
    const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
      plugins?: PluginConfig;
    };
    const current = existsSync(configPath)
      ? (JSON.parse(readFileSync(configPath, "utf8")) as {
          plugins?: PluginConfig;
        })
      : {};
    current.plugins = {
      ...fixture.plugins,
      ...current.plugins,
      enabled: {
        ...fixture.plugins?.enabled,
        ...current.plugins?.enabled,
      },
      packages: {
        ...fixture.plugins?.packages,
        ...current.plugins?.packages,
      },
    };
    writeFileSync(configPath, JSON.stringify(current));
  } catch {
    // Invalid config is intentional in rollback and diagnostic tests.
  }
}

type PluginConfig = {
  paths?: string[];
  enabled?: Record<string, boolean>;
  packages?: Record<string, unknown>;
};

async function assertOfficialPluginDistribution() {
  for (const { directory } of OFFICIAL_PLUGIN_PACKAGES) {
    const manifest = join(
      officialPluginDistribution,
      directory,
      "natalia.plugin.json",
    );
    try {
      await readFile(manifest);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new Error(
          `framework client tests require prebuilt official plugins at ${officialPluginDistribution}; run ts:build first (missing ${manifest})`,
        );
      throw error;
    }
  }
}

const installPrebuiltPackage: PackageManagerRun = async ({ args }) => {
  if (args[0] !== "install")
    throw new Error(`unsupported test package-manager operation: ${args[0]}`);
  const prefix = args[args.indexOf("--prefix") + 1];
  const source = args.at(-1);
  if (!prefix || !source)
    throw new Error("invalid test package-manager install arguments");
  const packageJSON = JSON.parse(
    await readFile(join(source, "package.json"), "utf8"),
  ) as { name: string; version: string; files?: string[] };
  const target = join(prefix, "node_modules", ...packageJSON.name.split("/"));
  await mkdir(target, { recursive: true });
  for (const file of new Set([
    "package.json",
    "natalia.plugin.json",
    ...(packageJSON.files ?? []),
  ])) {
    // Native executable packaging is verified by the release lifecycle test.
    // Framework tests need the plugin module, not a 165 MB copy per workspace.
    if (file === "wezterm") continue;
    const destination = join(target, file);
    await mkdir(dirname(destination), { recursive: true });
    const sourcePath = join(source, file);
    if ((await stat(sourcePath)).isDirectory())
      await cp(sourcePath, destination, { recursive: true });
    else await link(sourcePath, destination);
  }

  const dependencies = await readJSON<Record<string, string>>(
    join(prefix, "package.json"),
    "dependencies",
  );
  dependencies[packageJSON.name] = packageJSON.version;
  await writeFile(
    join(prefix, "package.json"),
    JSON.stringify({ dependencies }),
  );
  const lockPath = join(prefix, "package-lock.json");
  const packages = await readJSON<Record<string, unknown>>(
    lockPath,
    "packages",
  );
  packages[`node_modules/${packageJSON.name}`] = {
    version: packageJSON.version,
  };
  await writeFile(lockPath, JSON.stringify({ lockfileVersion: 3, packages }));
};

async function readJSON<T extends object>(
  path: string,
  key: string,
): Promise<T> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as Record<
      string,
      unknown
    >;
    return (value[key] as T | undefined) ?? ({} as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {} as T;
    throw error;
  }
}

async function readJSONFile<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw error;
  }
}

/**
 * Test helper: makes `@natalia/*` resolvable from a plugin workspace outside
 * the repo (bun resolves bare specifiers by walking up from the importing
 * file, and `/tmp` workspaces have no bun.lock/workspace context). Real
 * deployments must provide the same resolution — see the plugin guide's
 * dependency-resolution note.
 */
export async function installPluginSdkLinks(root: string) {
  const scoped = join(root, "node_modules", "@natalia");
  await mkdir(scoped, { recursive: true });
  for (const pkg of ["plugin", "contracts"]) {
    const target = join(scoped, pkg);
    try {
      await symlink(join(process.cwd(), "packages", pkg), target, "dir");
    } catch {
      // Windows without Developer Mode cannot create directory symlinks, and a
      // hard failure here would mask the plugin-loading behaviour under test.
      // A copy resolves identically inside the test process. The packages'
      // own node_modules links (bun junctions) cannot be copied either, so
      // they are excluded: `@natalia/contracts` resolves from the sibling
      // copy, and anything else resolves up through the repository root.
      await cp(join(process.cwd(), "packages", pkg), target, {
        recursive: true,
        filter: (source) => !source.includes(`${sep}node_modules${sep}`),
      });
    }
  }
}

/**
 * The plugin SDK entry as a file URL for plugin test fixtures. Bare-specifier
 * resolution from a /tmp workspace is unreliable inside a test process that
 * has already resolved the specifier from the repo (bun caches resolution by
 * context), so fixtures import the SDK by absolute URL. A Windows drive path
 * must be a file URL: bun parses a raw `E:\...` import specifier as an
 * unix-style path and mangles the drive letter.
 */
export function pluginSdkImportPath(): string {
  return pathToFileURL(
    join(process.cwd(), "packages", "core", "plugin", "src", "index.ts"),
  ).href;
}
