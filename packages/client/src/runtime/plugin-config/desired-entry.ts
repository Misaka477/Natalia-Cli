import type {
  DesiredPluginEntry,
  Plugin,
  PluginManifest,
} from "@natalia/plugin";
import { PRODUCT_PLUGIN_MANIFESTS } from "./product-manifests";

type PluginDefinition = {
  id: string;
  enabled: boolean;
  manifest?: PluginManifest;
  create(): Plugin;
};

export function describePlugin(
  definition: PluginDefinition,
  identity: unknown = definition.enabled,
): DesiredPluginEntry {
  const manifest =
    definition.manifest ?? requiredProductManifest(definition.id);
  return {
    id: definition.id,
    enabled: definition.enabled,
    manifest,
    fingerprint: stableFingerprint(identity),
    load: async () => ({ ...definition.create(), manifest }),
  };
}

function requiredProductManifest(id: string): PluginManifest {
  const manifest = PRODUCT_PLUGIN_MANIFESTS[id];
  if (!manifest) throw new Error(`static default manifest missing: ${id}`);
  return manifest;
}

function stableFingerprint(value: unknown): string {
  return JSON.stringify(normalizeIdentity(value));
}

function normalizeIdentity(value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === "function") return "[function]";
  if (Array.isArray(value)) return value.map(normalizeIdentity);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeIdentity(child)]),
    );
  return value;
}
