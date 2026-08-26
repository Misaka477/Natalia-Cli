import { stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeOfficialPlugins } from "@natalia/installer";

export async function resolveOfficialPluginsDistribution() {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(dirname(process.execPath), "plugins"),
    resolve(moduleDirectory, "plugins"),
    resolve(moduleDirectory, "../../../dist/ts/plugins"),
  ];
  for (const candidate of new Set(candidates)) {
    if (await isDirectory(candidate)) return candidate;
  }
  throw new Error(
    `prebuilt official plugins were not found (checked ${candidates.join(", ")}); build the release distribution before starting Natalia from source`,
  );
}

export async function initializeTuiOfficialPlugins(
  seams: {
    resolveDistribution?: () => Promise<string>;
    initialize?: typeof initializeOfficialPlugins;
  } = {},
) {
  const distributionRoot = await (
    seams.resolveDistribution ?? resolveOfficialPluginsDistribution
  )();
  await (seams.initialize ?? initializeOfficialPlugins)({
    pluginStoreRoot: resolve(distributionRoot, "..", "plugin-store"),
    distributionRoot,
  });
  return distributionRoot;
}

export async function resolveTuiPluginStore() {
  return resolve(
    await resolveOfficialPluginsDistribution(),
    "..",
    "plugin-store",
  );
}

async function isDirectory(path: string) {
  return await stat(path)
    .then((entry) => entry.isDirectory())
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
      throw error;
    });
}
