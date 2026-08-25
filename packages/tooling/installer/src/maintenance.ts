import { resolveConfig, updateConfig, type ConfigPatch } from "@natalia/config";
import type { PluginPackageConfig } from "@natalia/contracts";
import { discoverPluginManifests } from "@natalia/plugin";
import {
  backupClosure,
  discardClosureBackup,
  loadNataliaLock,
  npmInstallArgs,
  packageDirectory,
  pluginClosurePaths,
  runNpm,
  restoreClosure,
  restoreFile,
  rollbackWith,
  snapshotFile,
  type PackageManagerRun,
} from "./closure";
import { serialized, type InstallerConfigOptions } from "./lifecycle";
import { sourceSpec } from "./package-metadata";

export type PluginDoctorFinding = {
  pluginID: string;
  code:
    | "config_missing"
    | "lock_missing"
    | "package_missing"
    | "manifest_mismatch";
  message: string;
};

type ReconcileSeams = {
  updateConfig?: typeof updateConfig;
  discardBackup?: typeof discardClosureBackup;
};

export async function doctorPlugins(
  workspaceRoot: string,
  options: InstallerConfigOptions = {},
): Promise<PluginDoctorFinding[]> {
  const lock = await loadNataliaLock(workspaceRoot);
  const { config } = await resolveConfig({ workspaceRoot, ...options });
  const findings: PluginDoctorFinding[] = [];
  for (const [id, entry] of Object.entries(lock.plugins)) {
    if (!config.plugins.packages[id])
      findings.push({
        pluginID: id,
        code: "config_missing",
        message: `plugin ${id} is locked but missing from config`,
      });
    const manifest = (
      await discoverPluginManifests(
        packageDirectory(
          pluginClosurePaths(workspaceRoot).pluginsDir,
          entry.packageName,
        ),
        { nodeModules: false },
      )
    )[0]?.manifest;
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
  options: InstallerConfigOptions = {},
  seams: ReconcileSeams = {},
) {
  return await serialized(workspaceRoot, async () => {
    const lock = await loadNataliaLock(workspaceRoot);
    const findings = await doctorPlugins(workspaceRoot, options);
    const paths = pluginClosurePaths(workspaceRoot);
    const resolved = await resolveConfig({ workspaceRoot, ...options });
    const configSnapshot = await snapshotFile(resolved.projectConfigPath);
    const closureSnapshot = await backupClosure(workspaceRoot);
    try {
      for (const finding of findings)
        if (finding.code === "package_missing") {
          const entry = lock.plugins[finding.pluginID];
          if (entry)
            await runPackageManager({
              cwd: workspaceRoot,
              args: npmInstallArgs(
                paths.pluginsDir,
                sourceSpec(entry.metadata.source),
              ),
            });
        }
      const packages: Record<string, PluginPackageConfig | undefined> = {};
      for (const [id, entry] of Object.entries(lock.plugins))
        packages[id] = {
          source: entry.metadata.source,
          version: entry.metadata.resolvedVersion,
          integrity: entry.metadata.integrity,
          signature: entry.metadata.signature,
          scope: entry.metadata.scope,
        };
      for (const id of Object.keys(resolved.config.plugins.packages))
        if (!lock.plugins[id]) packages[id] = undefined;
      await (seams.updateConfig ?? updateConfig)(
        workspaceRoot,
        { plugins: { packages } } as ConfigPatch,
        options,
      );
    } catch (error) {
      await rollbackWith(error, [
        async () => await restoreClosure(closureSnapshot),
        async () => await restoreFile(configSnapshot),
      ]);
    }
    const result: {
      reconciled: true;
      findings: PluginDoctorFinding[];
      remaining: PluginDoctorFinding[];
      cleanupWarning?: string;
    } = {
      reconciled: true as const,
      findings,
      remaining: await doctorPlugins(workspaceRoot, options),
    };
    try {
      await (seams.discardBackup ?? discardClosureBackup)(closureSnapshot);
    } catch (error) {
      result.cleanupWarning = errorMessage(error);
    }
    return result;
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
