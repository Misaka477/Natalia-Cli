import {
  BUILTIN_TOOL_PLUGIN_MANIFESTS,
  PDF_PLUGIN_MANIFEST,
} from "@natalia/builtin-tool-plugins";
import type { PluginManifest } from "@natalia/plugin";
import { PRODUCT_PLUGIN_MANIFESTS } from "./product-manifests";

export const CLI_PLUGIN_MANIFEST: PluginManifest = {
  apiVersion: 2,
  id: "natalia-cli",
  version: "1.0.0",
  name: "CLI",
  description: "Process-level command-line interface adapter.",
  entry: "natalia:cli",
  scope: "process",
  provides: [],
  requires: [],
  optionalRequires: [],
  conflicts: [],
  dependencies: [],
  hooks: {},
  integrationPoints: ["adapters"],
};

export const RUNTIME_DEFAULT_PLUGIN_MANIFESTS: Readonly<
  Record<string, PluginManifest>
> = {
  ...PRODUCT_PLUGIN_MANIFESTS,
  ...BUILTIN_TOOL_PLUGIN_MANIFESTS,
  [PDF_PLUGIN_MANIFEST.id]: PDF_PLUGIN_MANIFEST,
  [CLI_PLUGIN_MANIFEST.id]: CLI_PLUGIN_MANIFEST,
};
