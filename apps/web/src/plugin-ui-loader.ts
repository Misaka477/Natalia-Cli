import type { RuntimeClient } from "@natalia/contracts";
import type { UiPlugin, UiPluginHost } from "@natalia/ui-host";

type UiPluginFactory = () => UiPlugin;
type UiModule = {
  createUiPlugin?: UiPluginFactory;
  default?: UiPluginFactory;
};

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
    try {
      const moduleUrl = new URL(
        `/plugins/${encodeURIComponent(plugin.id)}/ui.js`,
        runtimeURL,
      ).href;
      const mod = await importPluginUiModule(moduleUrl, token);
      const factory = mod.createUiPlugin ?? mod.default;
      if (typeof factory !== "function") {
        console.warn(`[plugin-ui] ${plugin.id} does not export createUiPlugin`);
        continue;
      }
      const uiPlugin = factory();
      await host.load(uiPlugin);
      console.info(`[plugin-ui] loaded ${plugin.id}@${plugin.version}`);
    } catch (error) {
      console.warn(
        `[plugin-ui] failed to load ${plugin.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
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
