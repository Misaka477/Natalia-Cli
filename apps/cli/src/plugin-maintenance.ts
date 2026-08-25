import {
  doctorPlugins,
  installPlugin,
  listInstalledPlugins,
  reconcilePlugins,
  setPluginEnabled,
  uninstallPlugin,
} from "@natalia/installer";
import { RUNTIME_PLUGIN_MANIFESTS } from "@natalia/client";
import { createPluginScaffold } from "./plugin-scaffold";

const runtimeManifests = Object.values(RUNTIME_PLUGIN_MANIFESTS);

export function isPluginMaintenanceCommand(argv: readonly string[]) {
  return argv[0] === "plugin";
}

export async function runPluginMaintenanceCommand(argv: readonly string[]) {
  const { action, target, workspaceRoot, pluginID, packageName } =
    parsePluginMaintenanceArgs(argv);
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
        workspaceRoot,
        spec: target!,
        config,
        runtimeManifests,
      }),
    );
    return;
  }
  if (action === "enable" || action === "disable") {
    const enabled = action === "enable";
    print(
      await setPluginEnabled({
        workspaceRoot,
        pluginID: target!,
        enabled,
        config,
        runtimeManifests,
      }),
    );
    return;
  }
  if (action === "uninstall") {
    print(
      await uninstallPlugin({
        workspaceRoot,
        pluginID: target!,
        config,
        runtimeManifests,
      }),
    );
    return;
  }
  if (action === "list") {
    print(
      await listInstalledPlugins(workspaceRoot, {
        ...config,
        runtimeManifests,
      }),
    );
    return;
  }
  if (action === "reconcile") {
    print(await reconcilePlugins(workspaceRoot, undefined, config));
    return;
  }
  if (action === "doctor") {
    print(await doctorPlugins(workspaceRoot, config));
    return;
  }
  throw new Error("unreachable plugin action");
}

export function parsePluginMaintenanceArgs(argv: readonly string[]) {
  const action = argv[1];
  const targetActions = new Set(["install", "uninstall", "enable", "disable"]);
  const noTargetActions = new Set(["list", "doctor", "reconcile"]);
  if (
    !action ||
    (action !== "create" &&
      !targetActions.has(action) &&
      !noTargetActions.has(action))
  )
    throw new Error(
      "plugin requires create, install, enable, disable, uninstall, list, reconcile, or doctor",
    );
  const positional: string[] = [];
  let workspaceRoot = process.cwd();
  let workspaceSeen = false;
  let pluginID: string | undefined;
  let packageName: string | undefined;
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index]!;
    if (value === "--workspace") {
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
      `plugin ${action} requires exactly one ${action === "install" ? "package spec" : "plugin id"}`,
    );
  if (noTargetActions.has(action) && positional.length)
    throw new Error(`plugin ${action} does not accept a target`);
  if (action === "create" && (positional.length !== 1 || !pluginID))
    throw new Error(
      "plugin create requires exactly one directory and --id <plugin-id>",
    );
  return {
    action,
    target: positional[0],
    workspaceRoot,
    pluginID,
    packageName,
  };
}
