import type { PluginManifest } from "@natalia/plugin";
import { PRODUCT_PLUGIN_MANIFESTS } from "./product-manifests";
import { PDF_PLUGIN_MANIFEST, TOOL_PLUGIN_MANIFESTS } from "./tool-catalog";

export const RUNTIME_PLUGIN_MANIFESTS: Readonly<
  Record<string, PluginManifest>
> = {
  ...PRODUCT_PLUGIN_MANIFESTS,
  ...TOOL_PLUGIN_MANIFESTS,
  [PDF_PLUGIN_MANIFEST.id]: PDF_PLUGIN_MANIFEST,
};
