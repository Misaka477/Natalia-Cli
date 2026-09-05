import type { PluginCatalogEntry, RuntimeClient } from "@natalia/contracts";
import type { UiPlugin, UiPluginHost } from "@natalia/ui-host";

type UiPluginFactory = () => UiPlugin;
type UiModule = {
  createUiPlugin?: UiPluginFactory;
  default?: UiPluginFactory;
};

/** Maps loaded UI plugin ids back to the runtime plugin they came from. */
const uiSourceByPluginId = new Map<string, string>();

/**
 * Loads every enabled/installed plugin's renderer-side UI bundle through the
 * same path used for official and third-party plugins.
 *
 * The runtime serves a single deterministic URL per plugin:
 *
 *   GET /plugins/<pluginId>/ui.js
 *
 * This loader deliberately does not know which plugins are "official"; it only
 * follows the plugin catalog.
 */
export async function loadPluginUiBundles(
  host: UiPluginHost,
  runtime: RuntimeClient,
  runtimeURL: string,
  token?: string,
): Promise<void> {
  const catalog = (await runtime.pluginCatalog?.()) ?? [];
  for (const plugin of catalog) {
    if (!plugin.enabled || !plugin.installed || !plugin.ui?.entry) continue;
    await loadOnePluginUi(host, runtimeURL, plugin, token);
  }
}

/**
 * Reconciles the UI host with the current plugin catalog:
 *
 * - loads UI for newly enabled plugins
 * - unloads UI for disabled/removed plugins
 *
 * Runtime plugins, whether they carry UI or not, remain fully managed by the
 * plugin manager through pluginInstall/Uninstall/SetEnabled; this function only
 * keeps the renderer-side panels in sync with that catalog.
 */
export async function syncPluginUiBundles(
  host: UiPluginHost,
  runtime: RuntimeClient,
  runtimeURL: string,
  token?: string,
): Promise<void> {
  const catalog = (await runtime.pluginCatalog?.()) ?? [];
  const enabled = new Set(
    catalog
      .filter((plugin) => plugin.enabled && plugin.installed && plugin.ui?.entry)
      .map((plugin) => plugin.id),
  );

  for (const [uiPluginId, runtimePluginId] of [...uiSourceByPluginId]) {
    if (enabled.has(runtimePluginId)) continue;
    try {
      await host.unload(uiPluginId);
    } catch (error) {
      console.warn(
        `[plugin-ui] failed to unload ${uiPluginId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    uiSourceByPluginId.delete(uiPluginId);
  }

  for (const plugin of catalog) {
    if (!enabled.has(plugin.id)) continue;
    if ([...uiSourceByPluginId.values()].includes(plugin.id)) continue;
    await loadOnePluginUi(host, runtimeURL, plugin, token);
  }
}

async function loadOnePluginUi(
  host: UiPluginHost,
  runtimeURL: string,
  plugin: PluginCatalogEntry,
  token?: string,
): Promise<void> {
  if (!plugin.ui?.entry) return;
  try {
    const moduleUrl = new URL(
      `/plugins/${encodeURIComponent(plugin.id)}/ui.js`,
      runtimeURL,
    ).href;
    const mod = await importPluginUiModule(moduleUrl, token);
    const factory = mod.createUiPlugin ?? mod.default;
    if (typeof factory !== "function") {
      console.warn(`[plugin-ui] ${plugin.id} does not export createUiPlugin`);
      return;
    }
    const uiPlugin = factory();
    await host.load(uiPlugin);
    uiSourceByPluginId.set(uiPlugin.id, plugin.id);
    await loadPluginUiCss(runtimeURL, plugin.id, token);
    console.info(`[plugin-ui] loaded ${plugin.id}@${plugin.version}`);
  } catch (error) {
    console.warn(
      `[plugin-ui] failed to load ${plugin.id}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function loadPluginUiCss(
  runtimeURL: string,
  pluginId: string,
  token?: string,
): Promise<void> {
  try {
    const url = new URL(
      `/plugins/${encodeURIComponent(pluginId)}/ui.css`,
      runtimeURL,
    ).href;
    const headers = token ? { authorization: `Bearer ${token}` } : undefined;
    const response = await fetch(url, { headers });
    if (!response.ok) return; // CSS is optional; missing assets are normal.
    const css = await response.text();
    const existing = document.querySelector<HTMLStyleElement>(
      `style[data-natalia-plugin-ui-css="${pluginId}"]`,
    );
    if (existing) existing.textContent = css;
    else {
      const style = document.createElement("style");
      style.setAttribute("data-natalia-plugin-ui-css", pluginId);
      style.textContent = css;
      document.head.append(style);
    }
  } catch (error) {
    console.warn(
      `[plugin-ui] failed to load css for ${pluginId}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function importPluginUiModule(
  url: string,
  token?: string,
): Promise<UiModule> {
  const headers = token ? { authorization: `Bearer ${token}` } : undefined;
  const response = await fetch(url, { headers });
  if (!response.ok)
    throw new Error(
      `plugin ui request failed (${response.status} ${response.statusText})`,
    );
  const code = await response.text();
  const blob = new Blob([code], { type: "text/javascript" });
  const blobURL = URL.createObjectURL(blob);
  try {
    return (await import(/* @vite-ignore */ blobURL)) as UiModule;
  } finally {
    URL.revokeObjectURL(blobURL);
  }
}
