import { resolveConfig, updateConfig } from "@natalia/config";
import {
  doctorPlugins,
  installPlugin,
  listInstalledPlugins,
  reconcilePlugins,
  setPluginEnabled,
  uninstallPlugin,
} from "@natalia/installer";
import { CLI_PLUGIN_ID } from "./cli-command-adapter";

export function isPluginMaintenanceCommand(argv: readonly string[]) {
  return argv[0] === "plugin";
}

export async function runPluginMaintenanceCommand(argv: readonly string[]) {
  const action = argv[1];
  const target = argv[2];
  const workspaceRoot = valueAfter(argv, "--workspace") ?? process.cwd();
  const print = (value: unknown) => console.log(JSON.stringify(value, null, 2));

  if (action === "install") {
    if (!target) throw new Error("plugin install requires a package spec");
    assertNotBuiltinPackageOperation(action, target);
    print(await installPlugin({ workspaceRoot, spec: target }));
    return;
  }
  if (action === "enable" || action === "disable") {
    if (!target) throw new Error(`plugin ${action} requires a plugin id`);
    const enabled = action === "enable";
    if (target === CLI_PLUGIN_ID) {
      const config = await updateConfig(
        workspaceRoot,
        { plugins: { enabled: { [CLI_PLUGIN_ID]: enabled } } },
        process.env.NATALIA_CONFIG
          ? { globalPath: process.env.NATALIA_CONFIG }
          : {},
      );
      print({ id: CLI_PLUGIN_ID, enabled, builtin: true, config });
      return;
    }
    print(await setPluginEnabled({ workspaceRoot, pluginID: target, enabled }));
    return;
  }
  if (action === "uninstall") {
    if (!target) throw new Error("plugin uninstall requires a plugin id");
    assertNotBuiltinPackageOperation(action, target);
    print(await uninstallPlugin({ workspaceRoot, pluginID: target }));
    return;
  }
  if (action === "list" || action === "status") {
    const resolved = await resolveConfig({
      workspaceRoot,
      ...(process.env.NATALIA_CONFIG
        ? { globalPath: process.env.NATALIA_CONFIG }
        : {}),
    });
    print([
      {
        id: CLI_PLUGIN_ID,
        enabled: resolved.config.plugins.enabled[CLI_PLUGIN_ID] !== false,
        builtin: true,
      },
      ...(await listInstalledPlugins(workspaceRoot)),
    ]);
    return;
  }
  if (action === "reconcile") {
    print(await reconcilePlugins(workspaceRoot));
    return;
  }
  if (action === "doctor") {
    print(await doctorPlugins(workspaceRoot));
    return;
  }
  throw new Error(
    "plugin requires install, enable, disable, uninstall, list, status, reconcile, or doctor",
  );
}

function assertNotBuiltinPackageOperation(action: string, target: string) {
  if (target === CLI_PLUGIN_ID)
    throw new Error(
      `plugin ${action} cannot operate on builtin ${CLI_PLUGIN_ID}`,
    );
}

function valueAfter(argv: readonly string[], flag: string) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}
