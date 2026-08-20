import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { resolveConfig, updateConfig, type ConfigPatch } from "@natalia/config";
import {
  pluginPackageConfigSchema,
  pluginPackageSourceSchema,
  type PluginPackageConfig,
  type PluginPackageSource,
} from "@natalia/contracts";
import {
  discoverPluginManifests,
  type PluginInstallationMetadata,
} from "@natalia/plugin";

const lockEntrySchema = z.object({
  packageName: z.string().min(1),
  manifest: z.string().min(1),
  metadata: z.object({
    id: z.string().min(1),
    source: pluginPackageSourceSchema,
    resolvedVersion: z.string().min(1),
    integrity: z.string().min(1).optional(),
    signature: z.string().min(1).optional(),
    scope: z.enum(["process", "workspace", "session"]),
    dependencies: z.array(
      z.object({
        id: z.string().min(1),
        resolvedVersion: z.string().min(1),
        optional: z.boolean().optional(),
        peer: z.boolean().optional(),
      }),
    ),
  }),
});

export const nataliaLockSchema = z.object({
  version: z.literal(1),
  plugins: z.record(lockEntrySchema).default({}),
});
export type NataliaLock = z.infer<typeof nataliaLockSchema>;
export type PluginDoctorFinding = {
  pluginID: string;
  code:
    | "config_missing"
    | "lock_missing"
    | "package_missing"
    | "manifest_mismatch";
  message: string;
};

export function pluginClosurePaths(workspaceRoot: string) {
  const nataliaDir = resolve(workspaceRoot, ".natalia");
  return {
    nataliaDir,
    pluginsDir: join(nataliaDir, "plugins"),
    lockPath: join(nataliaDir, "natalia.lock"),
  };
}

export async function loadNataliaLock(
  workspaceRoot: string,
): Promise<NataliaLock> {
  const { lockPath } = pluginClosurePaths(workspaceRoot);
  try {
    return nataliaLockSchema.parse(
      JSON.parse(await readFile(lockPath, "utf8")),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { version: 1, plugins: {} };
    throw error;
  }
}

export async function saveNataliaLock(
  workspaceRoot: string,
  lock: NataliaLock,
) {
  const parsed = nataliaLockSchema.parse(lock);
  const { lockPath } = pluginClosurePaths(workspaceRoot);
  await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 });
  const temporary = `${lockPath}.tmp-${randomUUID()}`;
  try {
    await writeFile(temporary, `${JSON.stringify(parsed, null, 2)}\n`, {
      mode: 0o600,
    });
    await rename(temporary, lockPath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export type PackageManagerRun = (input: {
  args: string[];
  cwd: string;
}) => Promise<void>;

const runNpm: PackageManagerRun = async ({ args, cwd }) => {
  const child = Bun.spawn(["npm", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  if (exitCode !== 0)
    throw new Error(
      `npm ${args.join(" ")} failed: ${(stderr || stdout).trim()}`,
    );
};

export async function installPlugin(input: {
  workspaceRoot: string;
  spec: string;
  runPackageManager?: PackageManagerRun;
}) {
  const paths = pluginClosurePaths(input.workspaceRoot);
  await mkdir(paths.pluginsDir, { recursive: true, mode: 0o700 });
  const before = await closureDependencies(paths.pluginsDir);
  await (input.runPackageManager ?? runNpm)({
    cwd: input.workspaceRoot,
    args: [
      "install",
      "--no-audit",
      "--no-fund",
      "--ignore-scripts",
      "--save-exact",
      "--prefix",
      paths.pluginsDir,
      input.spec,
    ],
  });
  const after = await closureDependencies(paths.pluginsDir);
  const packageName = resolveInstalledPackageName(input.spec, before, after);
  const packageDir = packageDirectory(paths.pluginsDir, packageName);
  const [{ manifest, path: manifestPath } = {}] =
    await discoverPluginManifests(packageDir);
  if (!manifest || !manifestPath)
    throw new Error(
      `installed package ${packageName} has no natalia.plugin.json`,
    );
  const packageLock = await readPackageLock(paths.pluginsDir);
  const packageRecord = packageLock.packages?.[
    `node_modules/${packageName}`
  ] as { version?: string; integrity?: string } | undefined;
  const resolvedVersion = packageRecord?.version ?? manifest.version;
  if (resolvedVersion !== manifest.version)
    throw new Error(
      `plugin ${manifest.id} manifest version ${manifest.version} does not match installed package ${resolvedVersion}`,
    );
  const source = packageSource(input.spec);
  const metadata: PluginInstallationMetadata = {
    id: manifest.id,
    source,
    resolvedVersion,
    ...(packageRecord?.integrity ? { integrity: packageRecord.integrity } : {}),
    scope: manifest.scope,
    dependencies:
      manifest.apiVersion === 2
        ? manifest.dependencies.map((dependency) => ({
            id: dependency.id,
            resolvedVersion: "unresolved",
            optional: dependency.optional,
            peer: dependency.peer,
          }))
        : [],
  };
  const lock = await loadNataliaLock(input.workspaceRoot);
  lock.plugins[manifest.id] = {
    packageName,
    manifest: manifestPath,
    metadata,
  };
  await saveNataliaLock(input.workspaceRoot, lock);
  await updateConfig(input.workspaceRoot, {
    plugins: {
      enabled: { [manifest.id]: true },
      packages: {
        [manifest.id]: configPackage(metadata),
      },
    },
  });
  return {
    installed: true as const,
    pluginID: manifest.id,
    packageName,
    metadata,
  };
}

export async function setPluginEnabled(input: {
  workspaceRoot: string;
  pluginID: string;
  enabled: boolean;
}) {
  const lock = await loadNataliaLock(input.workspaceRoot);
  if (!lock.plugins[input.pluginID])
    throw new Error(`plugin is not installed: ${input.pluginID}`);
  await updateConfig(input.workspaceRoot, {
    plugins: { enabled: { [input.pluginID]: input.enabled } },
  });
  return { pluginID: input.pluginID, enabled: input.enabled };
}

export async function uninstallPlugin(input: {
  workspaceRoot: string;
  pluginID: string;
  runPackageManager?: PackageManagerRun;
}) {
  const lock = await loadNataliaLock(input.workspaceRoot);
  const installed = lock.plugins[input.pluginID];
  if (!installed) throw new Error(`plugin is not installed: ${input.pluginID}`);
  const paths = pluginClosurePaths(input.workspaceRoot);
  await (input.runPackageManager ?? runNpm)({
    cwd: input.workspaceRoot,
    args: [
      "uninstall",
      "--no-audit",
      "--no-fund",
      "--ignore-scripts",
      "--prefix",
      paths.pluginsDir,
      installed.packageName,
    ],
  });
  delete lock.plugins[input.pluginID];
  await saveNataliaLock(input.workspaceRoot, lock);
  await updateConfig(input.workspaceRoot, {
    plugins: {
      enabled: { [input.pluginID]: false },
      packages: { [input.pluginID]: undefined },
    },
  } as ConfigPatch);
  return { uninstalled: true as const, pluginID: input.pluginID };
}

export async function listInstalledPlugins(workspaceRoot: string) {
  const lock = await loadNataliaLock(workspaceRoot);
  const { config } = await resolveConfig({ workspaceRoot });
  return Object.values(lock.plugins).map((entry) => ({
    id: entry.metadata.id,
    version: entry.metadata.resolvedVersion,
    packageName: entry.packageName,
    enabled: config.plugins.enabled[entry.metadata.id] !== false,
    source: entry.metadata.source,
  }));
}

export async function doctorPlugins(
  workspaceRoot: string,
): Promise<PluginDoctorFinding[]> {
  const lock = await loadNataliaLock(workspaceRoot);
  const { config } = await resolveConfig({ workspaceRoot });
  const findings: PluginDoctorFinding[] = [];
  for (const [id, entry] of Object.entries(lock.plugins)) {
    if (!config.plugins.packages[id])
      findings.push({
        pluginID: id,
        code: "config_missing",
        message: `plugin ${id} is locked but missing from config`,
      });
    const manifests = await discoverPluginManifests(
      packageDirectory(
        pluginClosurePaths(workspaceRoot).pluginsDir,
        entry.packageName,
      ),
    );
    const manifest = manifests[0]?.manifest;
    if (!manifest)
      findings.push({
        pluginID: id,
        code: "package_missing",
        message: `plugin ${id} package is missing from the installation closure`,
      });
    else if (
      manifest.id !== id ||
      manifest.version !== entry.metadata.resolvedVersion
    )
      findings.push({
        pluginID: id,
        code: "manifest_mismatch",
        message: `plugin ${id} manifest does not match natalia.lock`,
      });
  }
  for (const id of Object.keys(config.plugins.packages))
    if (!lock.plugins[id])
      findings.push({
        pluginID: id,
        code: "lock_missing",
        message: `plugin ${id} is configured but missing from natalia.lock`,
      });
  return findings;
}

export async function reconcilePlugins(
  workspaceRoot: string,
  runPackageManager: PackageManagerRun = runNpm,
) {
  const lock = await loadNataliaLock(workspaceRoot);
  const findings = await doctorPlugins(workspaceRoot);
  const paths = pluginClosurePaths(workspaceRoot);
  for (const finding of findings)
    if (finding.code === "package_missing") {
      const entry = lock.plugins[finding.pluginID];
      if (!entry) continue;
      await runPackageManager({
        cwd: workspaceRoot,
        args: [
          "install",
          "--no-audit",
          "--no-fund",
          "--ignore-scripts",
          "--save-exact",
          "--prefix",
          paths.pluginsDir,
          sourceSpec(entry.metadata.source),
        ],
      });
    }
  const { config } = await resolveConfig({ workspaceRoot });
  const packages: Record<string, PluginPackageConfig | undefined> = {};
  for (const [id, entry] of Object.entries(lock.plugins))
    packages[id] = configPackage(entry.metadata);
  for (const id of Object.keys(config.plugins.packages))
    if (!lock.plugins[id]) packages[id] = undefined;
  await updateConfig(workspaceRoot, {
    plugins: { packages },
  } as ConfigPatch);
  return {
    reconciled: true as const,
    findings,
    remaining: await doctorPlugins(workspaceRoot),
  };
}

function configPackage(
  metadata: PluginInstallationMetadata,
): PluginPackageConfig {
  return pluginPackageConfigSchema.parse({
    source: metadata.source,
    version: metadata.resolvedVersion,
    integrity: metadata.integrity,
    signature: metadata.signature,
    scope: metadata.scope,
  });
}

function packageSource(spec: string): PluginPackageSource {
  if (spec.startsWith("git+") || spec.endsWith(".git"))
    return { type: "git", url: spec };
  if (/^(?:https?:).*\.(?:tgz|tar\.gz)$/iu.test(spec))
    return { type: "tarball", url: spec };
  if (spec.startsWith("file:") || spec.startsWith(".") || spec.startsWith("/"))
    return { type: "path", path: spec.replace(/^file:/u, "") };
  return { type: "registry", spec };
}

function sourceSpec(source: PluginPackageSource) {
  if (source.type === "registry") return source.spec;
  if (source.type === "path") return `file:${source.path}`;
  if (source.type === "tarball") return source.url;
  return source.ref ? `${source.url}#${source.ref}` : source.url;
}

async function closureDependencies(prefix: string) {
  try {
    const value = JSON.parse(
      await readFile(join(prefix, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
    };
    return value.dependencies ?? {};
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

function resolveInstalledPackageName(
  spec: string,
  before: Record<string, string>,
  after: Record<string, string>,
) {
  const changed = Object.keys(after).filter(
    (name) => before[name] !== after[name],
  );
  if (changed.length === 1) return changed[0]!;
  const requested = packageNameFromSpec(spec);
  if (requested && after[requested]) return requested;
  throw new Error(
    `could not identify installed plugin package for ${spec}; changed dependencies: ${changed.join(", ") || "none"}`,
  );
}

function packageNameFromSpec(spec: string) {
  if (spec.startsWith("@")) {
    const separator = spec.indexOf("@", 1);
    return separator === -1 ? spec : spec.slice(0, separator);
  }
  if (/^[a-z0-9_.-]+(?:@.*)?$/iu.test(spec)) return spec.split("@")[0];
  return undefined;
}

function packageDirectory(prefix: string, packageName: string) {
  return join(prefix, "node_modules", ...packageName.split("/"));
}

async function readPackageLock(prefix: string) {
  return JSON.parse(
    await readFile(join(prefix, "package-lock.json"), "utf8"),
  ) as {
    packages?: Record<string, unknown>;
  };
}
