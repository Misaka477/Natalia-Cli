import {
  doctorPlugins,
  installPlugin,
  listInstalledPlugins,
  OFFICIAL_PLUGIN_PACKAGES,
  reconcilePlugins,
  reinstallOfficialPlugin,
  setPluginEnabled,
  uninstallPlugin,
} from "@natalia/installer";
import { createPluginScaffold } from "./plugin-scaffold";
import {
  officialPluginDistributionRoot,
  officialPluginID,
  pluginStoreRoot,
} from "./official-plugins";

export function isPluginMaintenanceCommand(argv: readonly string[]) {
  return argv[0] === "plugin";
}

export async function runPluginMaintenanceCommand(
  argv: readonly string[],
  parsed = parsePluginMaintenanceArgs(argv),
  lifecycle: { reinstallOfficialPlugin?: typeof reinstallOfficialPlugin } = {},
) {
  const { action, target, workspaceRoot, pluginID, packageName } = parsed;
  const config = process.env.NATALIA_CONFIG
    ? { globalPath: process.env.NATALIA_CONFIG }
    : {};
  const print = (value: unknown) => console.log(JSON.stringify(value, null, 2));

  if (action === "create") {
    print(
      await createPluginScaffold({
        directory: target!,
        pluginID: pluginID!,
        packageName,
      }),
    );
    return;
  }

  if (action === "install") {
    print(
      await installPlugin({
        pluginStoreRoot: pluginStoreRoot(),
        spec: target!,
      }),
    );
    return;
  }
  if (action === "enable" || action === "disable") {
    const enabled = action === "enable";
    print(
      await setPluginEnabled({
        pluginStoreRoot: pluginStoreRoot(),
        workspaceRoot,
        pluginID: target!,
        enabled,
        config,
      }),
    );
    return;
  }
  if (action === "uninstall") {
    print(
      await uninstallPlugin({
        pluginStoreRoot: pluginStoreRoot(),
        pluginID: target!,
      }),
    );
    return;
  }
  if (action === "list") {
    print(
      await listInstalledPlugins({
        pluginStoreRoot: pluginStoreRoot(),
        workspaceRoot,
        ...config,
      }),
    );
    return;
  }
  if (action === "reinstall") {
    print(
      await (lifecycle.reinstallOfficialPlugin ?? reinstallOfficialPlugin)({
        pluginStoreRoot: pluginStoreRoot(),
        distributionRoot: officialPluginDistributionRoot(),
        pluginID: officialPluginID(target!),
      }),
    );
    return;
  }
  if (action === "reconcile") {
    print(await reconcilePlugins(pluginStoreRoot()));
    return;
  }
  if (action === "doctor") {
    print(await doctorPlugins(pluginStoreRoot()));
    return;
  }
  throw new Error("unreachable plugin action");
}

export function parsePluginMaintenanceArgs(argv: readonly string[]) {
  const action = argv[1];
  const targetActions = new Set([
    "install",
    "reinstall",
    "uninstall",
    "enable",
    "disable",
  ]);
  const noTargetActions = new Set(["list", "doctor", "reconcile"]);
  const workspaceActions = new Set(["enable", "disable", "list"]);
  if (
    !action ||
    (action !== "create" &&
      !targetActions.has(action) &&
      !noTargetActions.has(action))
  )
    throw new Error(
      "plugin requires create, install, reinstall, enable, disable, uninstall, list, reconcile, or doctor",
    );
  const positional: string[] = [];
  let workspaceRoot = process.cwd();
  let workspaceSeen = false;
  let pluginID: string | undefined;
  let packageName: string | undefined;
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]!;
    if (value === "--workspace") {
      if (!workspaceActions.has(action))
        throw new Error(`plugin ${action} does not accept --workspace`);
      if (workspaceSeen)
        throw new Error("--workspace may only be specified once");
      workspaceSeen = true;
      const workspace = argv[++index];
      if (!workspace || workspace.startsWith("--"))
        throw new Error("--workspace requires a value");
      workspaceRoot = workspace;
      continue;
    }
    if (value === "--id" || value === "--package") {
      if (action !== "create") throw new Error(`unknown flag: ${value}`);
      const option = argv[++index];
      if (!option || option.startsWith("--"))
        throw new Error(`${value} requires a value`);
      if (value === "--id") {
        if (pluginID) throw new Error("--id may only be specified once");
        pluginID = option;
      } else {
        if (packageName)
          throw new Error("--package may only be specified once");
        packageName = option;
      }
      continue;
    }
    if (value.startsWith("-")) throw new Error(`unknown flag: ${value}`);
    positional.push(value);
  }
  if (targetActions.has(action) && positional.length !== 1)
    throw new Error(
      `plugin ${action} requires exactly one ${action === "install" ? "package spec" : action === "reinstall" ? "official plugin id" : "plugin id"}`,
    );
  if (noTargetActions.has(action) && positional.length)
    throw new Error(`plugin ${action} does not accept a target`);
  if (action === "create" && (positional.length !== 1 || !pluginID))
    throw new Error(
      "plugin create requires exactly one directory and --id <plugin-id>",
    );
  if (
    action === "reinstall" &&
    !OFFICIAL_PLUGIN_PACKAGES.some(({ id }) => id === positional[0])
  )
    throw new Error(`unknown official plugin: ${positional[0]}`);
  return {
    action,
    target: positional[0],
    workspaceRoot,
    pluginID,
    packageName,
  };
}
