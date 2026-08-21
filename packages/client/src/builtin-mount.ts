/**
 * Runtime plugin mount sequence.
 *
 * This is the one assembly seam the composition root delegates to: initialize
 * the plugin controller without local (external) plugins, mount the built-in
 * catalog in order, then load external plugins. Keeping this sequence in one
 * named function makes the bootstrap ordering explicit and testable, and keeps
 * the runtime's product behavior out of the mount bookkeeping.
 *
 * Order is significant: the registry is created first, then built-ins mount in
 * catalog order (later entries may depend on earlier services), then external
 * plugins load last. Built-ins are instantiated lazily through `create()` so an
 * enabled flag can skip construction entirely.
 */
import type { BuiltinPluginEntry } from "./builtin-plugins/catalog";
import type { createPluginsController } from "./plugins-controller";

export async function mountRuntimePlugins(input: {
  controller: ReturnType<typeof createPluginsController>;
  builtins: BuiltinPluginEntry[];
  settings: Record<string, unknown> | undefined;
  loadExternal: boolean;
}): Promise<void> {
  await input.controller.init({ loadLocal: false });
  for (const entry of input.builtins) {
    if (!entry.enabled) continue;
    await input.controller.loadBuiltin(
      entry.create(),
      input.settings?.[entry.id],
    );
  }
  if (input.loadExternal) await input.controller.loadLocal();
}
