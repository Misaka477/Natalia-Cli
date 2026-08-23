import type { Plugin, PluginManifest } from "@natalia/plugin";
import { PRODUCT_PLUGIN_MANIFESTS } from "./product-manifests";

export type DefaultPluginEntry = {
  id: string;
  enabled: boolean;
  /** Stable owner-defined identity for desired-state reconciliation. */
  fingerprint: string;
  manifest: PluginManifest;
  create(): Plugin;
};

type DefaultPluginDefinition = Omit<
  DefaultPluginEntry,
  "fingerprint" | "manifest"
> & { manifest?: PluginManifest };

export function describeDefault(
  definition: DefaultPluginDefinition,
  identity: unknown = definition.enabled,
): DefaultPluginEntry {
  return {
    ...definition,
    manifest: definition.manifest ?? requiredProductManifest(definition.id),
    fingerprint: stableFingerprint(identity),
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
