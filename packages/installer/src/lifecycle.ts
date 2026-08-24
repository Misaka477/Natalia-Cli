import { randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import { join, resolve } from "node:path";
import { resolveConfig, updateConfig, type ConfigPatch } from "@natalia/config";
import {
  pluginPackageConfigSchema,
  type NataliaLock,
  type PluginPackageConfig,
} from "@natalia/contracts";
import type { PluginManifest } from "@natalia/plugin";
import { runtimeDefaultPlugin } from "./catalog";
import {
  loadNataliaLock,
  backupClosure,
  cleanupInstallStage,
  discardClosureBackup,
  npmInstallArgs,
  npmUninstallArgs,
  packageDirectory,
  pluginClosurePaths,
  runNpm,
  saveNataliaLock,
  restoreClosure,
  restoreFile,
  rollbackWith,
  snapshotFile,
  type PackageManagerRun,
} from "./closure";
import { validateStagedPackage } from "./package-metadata";

const workspaceOperations = new Map<string, Promise<void>>();

export async function serialized<T>(
  workspaceRoot: string,
  operation: () => Promise<T>,
) {
  const key = await realpath(resolve(workspaceRoot));
  const previous = workspaceOperations.get(key) ?? Promise.resolve();
  const result = previous.catch(() => undefined).then(operation);
  const pending = result.then(
    () => undefined,
    () => undefined,
  );
  workspaceOperations.set(key, pending);
  return await result.finally(() => {
    if (workspaceOperations.get(key) === pending)
      workspaceOperations.delete(key);
  });
}

export type InstallerConfigOptions = { globalPath?: string };
type LifecycleSeams = {
  saveLock?: typeof saveNataliaLock;
  updateConfig?: typeof updateConfig;
  cleanupStage?: typeof cleanupInstallStage;
  discardBackup?: typeof discardClosureBackup;
};

export async function installPlugin(input: {
  workspaceRoot: string;
  spec: string;
  runPackageManager?: PackageManagerRun;
  config?: InstallerConfigOptions;
  runtimeManifests?: readonly PluginManifest[];
  seams?: LifecycleSeams;
}) {
  return await serialized(input.workspaceRoot, async () => {
    const paths = pluginClosurePaths(input.workspaceRoot);
    const stage = join(paths.stagingDir, randomUUID());
    const run = input.runPackageManager ?? runNpm;
    let closureSnapshot: Awaited<ReturnType<typeof backupClosure>> | undefined;
    let lockSnapshot: Awaited<ReturnType<typeof snapshotFile>> | undefined;
    let configSnapshot: Awaited<ReturnType<typeof snapshotFile>> | undefined;
    let result:
      | {
          installed: true;
          pluginID: string;
          packageName: string;
          metadata: Awaited<
            ReturnType<typeof validateStagedPackage>
          >["metadata"];
          cleanupWarning?: string;
        }
      | undefined;
    try {
      await run({
        cwd: input.workspaceRoot,
        args: npmInstallArgs(stage, input.spec),
      });
      const staged = await validateStagedPackage(stage, input.spec);
      if (runtimeDefaultPlugin(staged.manifest.id, input.runtimeManifests))
        throw new Error(
          `plugin id is reserved by a runtime default: ${staged.manifest.id}`,
        );
      const beforeLock = await loadNataliaLock(input.workspaceRoot);
      assertPackageOwnership(
        beforeLock,
        staged.packageName,
        staged.manifest.id,
      );
      const resolved = await resolveConfig({
        workspaceRoot: input.workspaceRoot,
        ...input.config,
      });
      lockSnapshot = await snapshotFile(paths.lockPath);
      configSnapshot = await snapshotFile(resolved.projectConfigPath);
      closureSnapshot = await backupClosure(input.workspaceRoot);
      await run({
        cwd: input.workspaceRoot,
        args: npmInstallArgs(paths.pluginsDir, input.spec),
      });
      const live = await validateStagedPackage(
        paths.pluginsDir,
        input.spec,
        staged.packageName,
      );
      if (
        live.packageName !== staged.packageName ||
        live.manifest.id !== staged.manifest.id ||
        live.metadata.resolvedVersion !== staged.metadata.resolvedVersion
      )
        throw new Error("live plugin install does not match validated staging");
      const lock = structuredClone(beforeLock);
      lock.plugins[live.manifest.id] = {
        packageName: live.packageName,
        manifest: join(
          packageDirectory(paths.pluginsDir, live.packageName),
          live.relativeManifest,
        ),
        metadata: live.metadata,
      };
      await (input.seams?.saveLock ?? saveNataliaLock)(
        input.workspaceRoot,
        lock,
      );
      await (input.seams?.updateConfig ?? updateConfig)(
        input.workspaceRoot,
        {
          plugins: {
            enabled: { [live.manifest.id]: true },
            packages: {
              [live.manifest.id]: configPackage(live.metadata),
            },
          },
        },
        input.config,
      );
      result = {
        installed: true as const,
        pluginID: live.manifest.id,
        packageName: live.packageName,
        metadata: live.metadata,
      };
    } catch (error) {
      const closure = closureSnapshot;
      const lockFile = lockSnapshot;
      const configFile = configSnapshot;
      await rollbackWith(error, [
        ...(closure ? [async () => await restoreClosure(closure)] : []),
        ...(lockFile ? [async () => await restoreFile(lockFile)] : []),
        ...(configFile ? [async () => await restoreFile(configFile)] : []),
        async () =>
          await (input.seams?.cleanupStage ?? cleanupInstallStage)(
            stage,
            paths.stagingDir,
          ),
      ]);
    }
    const cleanupErrors: unknown[] = [];
    try {
      await (input.seams?.discardBackup ?? discardClosureBackup)(
        closureSnapshot!,
      );
    } catch (error) {
      cleanupErrors.push(error);
    }
    try {
      await (input.seams?.cleanupStage ?? cleanupInstallStage)(
        stage,
        paths.stagingDir,
      );
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (cleanupErrors.length)
      result!.cleanupWarning = cleanupErrors.map(errorMessage).join("; ");
    return result!;
  });
}

export async function setPluginEnabled(input: {
  workspaceRoot: string;
  pluginID: string;
  enabled: boolean;
  config?: InstallerConfigOptions;
  runtimeManifests?: readonly PluginManifest[];
  seams?: LifecycleSeams;
}) {
  return await serialized(input.workspaceRoot, async () => {
    const lock = await loadNataliaLock(input.workspaceRoot);
    if (
      !lock.plugins[input.pluginID] &&
      !runtimeDefaultPlugin(input.pluginID, input.runtimeManifests)
    )
      throw new Error(`unknown plugin: ${input.pluginID}`);
    await (input.seams?.updateConfig ?? updateConfig)(
      input.workspaceRoot,
      {
        plugins: { enabled: { [input.pluginID]: input.enabled } },
      },
      input.config,
    );
    return { pluginID: input.pluginID, enabled: input.enabled };
  });
}

export async function uninstallPlugin(input: {
  workspaceRoot: string;
  pluginID: string;
  runPackageManager?: PackageManagerRun;
  config?: InstallerConfigOptions;
  runtimeManifests?: readonly PluginManifest[];
  seams?: LifecycleSeams;
}) {
  return await serialized(input.workspaceRoot, async () => {
    const lock = await loadNataliaLock(input.workspaceRoot);
    const installed = lock.plugins[input.pluginID];
    if (!installed) {
      if (!runtimeDefaultPlugin(input.pluginID, input.runtimeManifests))
        throw new Error(`unknown plugin: ${input.pluginID}`);
      const resolved = await resolveConfig({
        workspaceRoot: input.workspaceRoot,
        ...input.config,
      });
      const configSnapshot = await snapshotFile(resolved.projectConfigPath);
      try {
        await (input.seams?.updateConfig ?? updateConfig)(
          input.workspaceRoot,
          { plugins: { enabled: { [input.pluginID]: false } } },
          input.config,
        );
      } catch (error) {
        await rollbackWith(error, [
          async () => await restoreFile(configSnapshot),
        ]);
      }
      return {
        uninstalled: false as const,
        pluginID: input.pluginID,
        enabled: false as const,
        disposition: "runtime default disabled" as const,
      };
    }
    const paths = pluginClosurePaths(input.workspaceRoot);
    const resolved = await resolveConfig({
      workspaceRoot: input.workspaceRoot,
      ...input.config,
    });
    const lockSnapshot = await snapshotFile(paths.lockPath);
    const configSnapshot = await snapshotFile(resolved.projectConfigPath);
    const closureSnapshot = await backupClosure(input.workspaceRoot);
    const removed = { [input.pluginID]: undefined };
    try {
      await (input.seams?.updateConfig ?? updateConfig)(
        input.workspaceRoot,
        {
          plugins: {
            packages: removed,
            enabled: removed,
            settings: removed,
            capabilities: removed,
            readOnly: removed,
          },
        } as ConfigPatch,
        input.config,
      );
      await (input.runPackageManager ?? runNpm)({
        cwd: input.workspaceRoot,
        args: npmUninstallArgs(paths.pluginsDir, installed.packageName),
      });
      delete lock.plugins[input.pluginID];
      await (input.seams?.saveLock ?? saveNataliaLock)(
        input.workspaceRoot,
        lock,
      );
    } catch (error) {
      await rollbackWith(error, [
        async () => await restoreClosure(closureSnapshot),
        async () => await restoreFile(lockSnapshot),
        async () => await restoreFile(configSnapshot),
      ]);
    }
    const result: {
      uninstalled: true;
      pluginID: string;
      disposition: "removed for next reconcile";
      cleanupWarning?: string;
    } = {
      uninstalled: true,
      pluginID: input.pluginID,
      disposition: "removed for next reconcile",
    };
    try {
      await (input.seams?.discardBackup ?? discardClosureBackup)(
        closureSnapshot,
      );
    } catch (error) {
      result.cleanupWarning = errorMessage(error);
    }
    return result;
  });
}

function assertPackageOwnership(
  lock: NataliaLock,
  packageName: string,
  pluginID: string,
) {
  const idOwner = lock.plugins[pluginID];
  if (idOwner && idOwner.packageName !== packageName)
    throw new Error(
      `plugin id ${pluginID} is already owned by package ${idOwner.packageName}`,
    );
  const packageOwner = Object.entries(lock.plugins).find(
    ([, entry]) => entry.packageName === packageName,
  );
  if (packageOwner && packageOwner[0] !== pluginID)
    throw new Error(
      `package ${packageName} is already installed as plugin ${packageOwner[0]}; changing plugin id to ${pluginID} is not supported`,
    );
}

function configPackage(metadata: {
  source: PluginPackageConfig["source"];
  resolvedVersion: string;
  integrity?: string;
  signature?: string;
  scope: PluginPackageConfig["scope"];
}): PluginPackageConfig {
  return pluginPackageConfigSchema.parse({
    source: metadata.source,
    version: metadata.resolvedVersion,
    integrity: metadata.integrity,
    signature: metadata.signature,
    scope: metadata.scope,
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
