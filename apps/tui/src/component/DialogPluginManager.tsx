import type { RuntimeClient } from "@natalia/contracts";
import {
  doctorPlugins,
  installPlugin,
  listInstalledPlugins,
  OFFICIAL_PLUGIN_PACKAGES,
  reconcilePlugins,
  reinstallOfficialPlugin,
  setPluginEnabled,
  uninstallPlugin,
  type OfficialPluginID,
  type PluginCatalogRow,
} from "@natalia/installer";
import { createResource, createSignal, Show } from "solid-js";
import { useToast } from "../context/toast";
import { DialogConfirm } from "../dialog/DialogConfirm";
import { DialogPrompt } from "../dialog/DialogPrompt";
import { DialogSelect } from "../dialog/DialogSelect";
import { useDialog } from "../dialog/provider";

const officialPluginIDs = new Set<string>(
  OFFICIAL_PLUGIN_PACKAGES.map(({ id }) => id),
);

export type PluginInstaller = {
  list: typeof listInstalledPlugins;
  install: typeof installPlugin;
  enable: typeof setPluginEnabled;
  uninstall: typeof uninstallPlugin;
  reinstallOfficial: typeof reinstallOfficialPlugin;
  doctor: typeof doctorPlugins;
  reconcile: typeof reconcilePlugins;
};

const defaultInstaller: PluginInstaller = {
  list: listInstalledPlugins,
  install: installPlugin,
  enable: setPluginEnabled,
  uninstall: uninstallPlugin,
  reinstallOfficial: reinstallOfficialPlugin,
  doctor: doctorPlugins,
  reconcile: reconcilePlugins,
};

export function DialogPluginManager(props: {
  workspaceRoot: string;
  pluginStoreRoot: string;
  backend: Pick<RuntimeClient, "reloadConfig">;
  distributionRoot: string;
  installer?: PluginInstaller;
}) {
  const dialog = useDialog();
  const toast = useToast();
  const installer = props.installer ?? defaultInstaller;
  const [busy, setBusy] = createSignal(false);
  const [plugins, { refetch }] = createResource(() =>
    installer.list({
      pluginStoreRoot: props.pluginStoreRoot,
      workspaceRoot: props.workspaceRoot,
    }),
  );

  const reload = async () => {
    if (!props.backend.reloadConfig)
      return "this runtime transport cannot reload plugin configuration";
    const result = await props.backend.reloadConfig();
    return result.applied
      ? undefined
      : (result.reason ?? "runtime refused plugin configuration reload");
  };

  const mutate = async (operation: () => Promise<unknown>, success: string) => {
    if (busy()) return false;
    setBusy(true);
    try {
      await operation();
      await refetch();
      const reloadWarning = await reload();
      toast.show(
        reloadWarning
          ? {
              variant: "warning",
              message: `${success}, but the runtime did not apply it: ${reloadWarning}`,
            }
          : { variant: "success", message: success },
      );
      return true;
    } catch (error) {
      toast.error(error);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openPlugin = (row: PluginCatalogRow) => {
    const official = officialPluginIDs.has(row.id);
    dialog.push(() => (
      <DialogSelect
        title={row.name ?? row.id}
        renderFilter={false}
        locked={busy()}
        options={[
          {
            title: row.enabled ? "Disable" : "Enable",
            value: "toggle",
            description: row.enabled
              ? "Stop loading this plugin"
              : "Load this plugin",
          },
          ...(official
            ? [
                {
                  title: "Reinstall Official Plugin",
                  value: "reinstall",
                  description: "Restore from the prebuilt distribution",
                },
              ]
            : []),
          {
            title: "Uninstall",
            value: "uninstall",
            description: "Remove this physical plugin package",
          },
        ]}
        onSelect={(option) => {
          if (option.value === "toggle") {
            void mutate(
              () =>
                installer.enable({
                  pluginStoreRoot: props.pluginStoreRoot,
                  workspaceRoot: props.workspaceRoot,
                  pluginID: row.id,
                  enabled: !row.enabled,
                }),
              `${row.id} ${row.enabled ? "disabled" : "enabled"}`,
            );
            return;
          }
          if (option.value === "reinstall" && official) {
            void mutate(
              () =>
                installer.reinstallOfficial({
                  pluginStoreRoot: props.pluginStoreRoot,
                  distributionRoot: props.distributionRoot,
                  pluginID: row.id as OfficialPluginID,
                }),
              `${row.id} reinstalled`,
            );
            return;
          }
          dialog.push(() => (
            <DialogConfirm
              title={`Uninstall ${row.id}`}
              message="Remove this plugin package from this Natalia installation?"
              defaultChoice="cancel"
              onConfirm={() =>
                void mutate(
                  () =>
                    installer.uninstall({
                      pluginStoreRoot: props.pluginStoreRoot,
                      pluginID: row.id,
                    }),
                  `${row.id} uninstalled`,
                )
              }
            />
          ));
        }}
      />
    ));
  };

  const openDoctor = () => {
    void (async () => {
      if (busy()) return;
      setBusy(true);
      try {
        const findings = await installer.doctor(props.pluginStoreRoot);
        if (!findings.length) {
          toast.show({
            variant: "success",
            message: "Plugin store is healthy",
          });
          return;
        }
        dialog.push(() => (
          <DialogSelect
            title="Plugin Store Audit"
            renderFilter={false}
            options={findings.map((finding) => ({
              title: finding.pluginID,
              value: finding.pluginID,
              description: finding.message,
              footer: finding.code,
              readonly: true,
            }))}
          />
        ));
      } catch (error) {
        toast.error(error);
      } finally {
        setBusy(false);
      }
    })();
  };

  const openReconcile = () => {
    dialog.push(() => (
      <DialogConfirm
        title="Repair Plugin Store"
        message="Reinstall packages reported missing from this Natalia plugin store? Manifest mismatches are left for a manual reinstall."
        defaultChoice="cancel"
        onConfirm={() =>
          void mutate(
            () => installer.reconcile(props.pluginStoreRoot),
            "Plugin store repaired",
          )
        }
      />
    ));
  };

  const openInstall = () => {
    dialog.push(() => (
      <DialogPrompt
        title="Install Plugin"
        description={() => "npm package, tarball, or local package path."}
        placeholder="Plugin package spec"
        onConfirm={(spec) => {
          const value = spec.trim();
          if (!value) return;
          void mutate(
            () =>
              installer.install({
                pluginStoreRoot: props.pluginStoreRoot,
                workspaceRoot: props.workspaceRoot,
                spec: value,
              }),
            "Plugin installed",
          ).then((installed) => {
            if (installed) dialog.pop();
          });
        }}
      />
    ));
  };

  return (
    <DialogSelect
      title="Installed Plugins"
      preserveSelection
      locked={busy()}
      options={[
        {
          title: "Install Plugin",
          value: "__install__",
          description: "Add a package, tarball, or local package",
          category: "Actions",
          onSelect: openInstall,
        },
        {
          title: "Audit Plugin Store",
          value: "__doctor__",
          description: "Check the instance plugin store for missing packages",
          category: "Actions",
          onSelect: openDoctor,
        },
        {
          title: "Repair Plugin Store",
          value: "__reconcile__",
          description: "Reinstall packages missing from the plugin store",
          category: "Actions",
          onSelect: openReconcile,
        },
        ...(plugins() ?? []).map((row) => ({
          title: row.name ?? row.id,
          value: row.id,
          description: `${row.version} · ${row.enabled ? "enabled" : "disabled"}`,
          footer: officialPluginIDs.has(row.id) ? "official" : row.scope,
          category: "Physical Plugins",
          onSelect: () => openPlugin(row),
        })),
      ]}
      emptyView={
        <Show
          when={!plugins.loading}
          fallback={<text>Loading installed plugins...</text>}
        >
          <text>No physical plugins installed</text>
        </Show>
      }
    />
  );
}
