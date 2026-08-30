import {
  initializeOfficialPlugins,
  loadNataliaLock,
  saveNataliaLock,
  OFFICIAL_PLUGIN_PACKAGES,
  type OfficialPluginID,
} from "@natalia/installer";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const runtimeCommands = new Set(["serve", "run", "eval", "ui", "record"]);
const daemonCommands = new Set(["daemon", "daemon-status", "daemon-stop"]);
const taskCommands = new Set(["task", "flow"]);
const localCommands = new Set([
  "diagnose",
  "status",
  "workgraph",
  "doctor",
  "session",
  "fs",
  "trust",
  "replay",
]);

export function isRecognizedHostCommand(argv: readonly string[]) {
  const command = argv[0];
  if (!command) return true;
  return (
    runtimeCommands.has(command) ||
    daemonCommands.has(command) ||
    taskCommands.has(command) ||
    localCommands.has(command)
  );
}

export function officialPluginDistributionRoot() {
  if (
    process.env.NODE_ENV === "test" &&
    process.env.NATALIA_TEST_OFFICIAL_PLUGIN_DISTRIBUTION
  )
    return resolve(process.env.NATALIA_TEST_OFFICIAL_PLUGIN_DISTRIBUTION);
  if (process.env.NATALIA_TS_VERSION)
    return resolve(import.meta.dir, "plugins");
  if (process.env.NATALIA_DEV_PLUGIN_DISTRIBUTION)
    return resolve(process.env.NATALIA_DEV_PLUGIN_DISTRIBUTION);
  return resolve(import.meta.dir, "../../../dist/ts/plugins");
}

const DEV_PLUGIN_PACKAGES: ReadonlyArray<{
  id: OfficialPluginID;
  directory: string;
  source: string;
}> = [
  {
    id: "natalia-tool-terminal",
    directory: "natalia-tool-terminal",
    source: "packages/plugins/native-terminal",
  },
];

async function pathExists(path: string) {
  return await access(path).then(
    () => true,
    () => false,
  );
}

async function syncDevOfficialPlugins() {
  if (process.env.NATALIA_TS_VERSION) return;
  const workspaceRoot = resolve(import.meta.dir, "../../..");
  for (const plugin of DEV_PLUGIN_PACKAGES) {
    const official = OFFICIAL_PLUGIN_PACKAGES.find(
      (entry) => entry.id === plugin.id,
    );
    if (!official) continue;
    const sourceDir = resolve(workspaceRoot, plugin.source);
    const sourceEntry = resolve(sourceDir, "src", "index.ts");
    if (!(await pathExists(sourceEntry))) continue;
    const storeRoot = pluginStoreRoot();
    const packageRoot = resolve(
      storeRoot,
      "node_modules",
      ...official.packageName.split("/"),
    );
    await rm(packageRoot, { recursive: true, force: true });
    await mkdir(packageRoot, { recursive: true });
    const specifier = pathToFileURL(sourceEntry).href;
    await writeFile(
      join(packageRoot, "index.ts"),
      `export { default } from ${JSON.stringify(specifier)};\n`,
    );
    for (const name of ["package.json", "LICENSE"]) {
      const from = resolve(sourceDir, name);
      if (await pathExists(from)) await cp(from, resolve(packageRoot, name));
    }
    const manifest = JSON.parse(
      await readFile(resolve(sourceDir, "natalia.plugin.json"), "utf8"),
    ) as { entry?: string; [key: string]: unknown };
    manifest.entry = "index.ts";
    const manifestPath = join(packageRoot, "natalia.plugin.json");
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const lock = await loadNataliaLock(storeRoot);
    lock.plugins[official.id] = {
      packageName: official.packageName,
      manifest: manifestPath,
      metadata: {
        id: official.id,
        source: { type: "path", path: sourceDir },
        resolvedVersion: "1.0.0",
        scope: "session",
        dependencies: [],
      },
    };
    await saveNataliaLock(storeRoot, lock);
  }
}

export function pluginStoreRoot() {
  return resolve(officialPluginDistributionRoot(), "..", "plugin-store");
}

export async function initializeCliOfficialPlugins(
  initialize: typeof initializeOfficialPlugins = initializeOfficialPlugins,
) {
  const result = await initialize({
    pluginStoreRoot: pluginStoreRoot(),
    distributionRoot: officialPluginDistributionRoot(),
  });
  if (initialize === initializeOfficialPlugins) await syncDevOfficialPlugins();
  return result;
}

export async function initializeOfficialPluginsForHostCommand(
  argv: readonly string[],
  initialize: typeof initializeOfficialPlugins = initializeOfficialPlugins,
) {
  if (!isRecognizedHostCommand(argv)) return false;
  await initializeCliOfficialPlugins(initialize);
  return true;
}

export function officialPluginID(value: string): OfficialPluginID {
  return value as OfficialPluginID;
}
