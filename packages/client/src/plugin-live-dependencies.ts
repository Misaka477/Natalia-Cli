import {
  resolvePluginDependencies,
  type PluginManifest,
  type createPluginRegistry,
} from "@natalia/plugin";

export function hasLivePluginDependencies(
  registry: ReturnType<typeof createPluginRegistry>,
  manifest: PluginManifest | undefined,
) {
  if (!manifest || manifest.apiVersion !== 2) return true;
  const mounted = registry.list();
  const available = mounted.filter((candidate) => {
    const status = registry.status(candidate.id)?.status;
    return status === "active" || status === "pending";
  });
  const resolution = resolvePluginDependencies([manifest], available, mounted);
  return resolution.denied.length === 0 && resolution.pending.length === 0;
}

export function pluginSettingsFingerprint(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value))
    return `[${value.map(pluginSettingsFingerprint).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, child]) =>
          `${JSON.stringify(key)}:${pluginSettingsFingerprint(child)}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
}
