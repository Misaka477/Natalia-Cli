import {
  initializeOfficialPlugins,
  type OfficialPluginID,
} from "@natalia/installer";
import { resolve } from "node:path";

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
  return process.env.NATALIA_TS_VERSION
    ? resolve(import.meta.dir, "plugins")
    : resolve(import.meta.dir, "../../../dist/ts/plugins");
}

export function pluginStoreRoot() {
  return resolve(officialPluginDistributionRoot(), "..", "plugin-store");
}

export async function initializeCliOfficialPlugins(
  initialize: typeof initializeOfficialPlugins = initializeOfficialPlugins,
) {
  return await initialize({
    pluginStoreRoot: pluginStoreRoot(),
    distributionRoot: officialPluginDistributionRoot(),
  });
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
