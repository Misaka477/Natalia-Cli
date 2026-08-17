/**
 * The runtime's effective config, as a kernel service.
 *
 * The service-injection slice (D2): a host capability declares that it provides
 * a service by name, any capability can resolve it by name through its context,
 * and the host refreshes it in place — which notifies subscribers. This is the
 * framework's first real service: plugins and tool families can read the
 * resolved config without depending on the host, and they learn about config
 * reloads by subscribing to service updates instead of polling.
 */
import type { CapabilityRegistryHost } from "@natalia/capability";
import type { ConfigV3 } from "@natalia/contracts";

export const RUNTIME_CONFIG_CAPABILITY_ID = "natalia-runtime-config";
export const RUNTIME_CONFIG_SERVICE = "runtime.config";

/** Loads the capability that provides the runtime's config as a service. */
export function registerRuntimeConfigCapability(
  registry: CapabilityRegistryHost,
  config: ConfigV3,
): { ok: true } | { ok: false; reason: string } {
  const result = registry.tryLoad(
    {
      id: RUNTIME_CONFIG_CAPABILITY_ID,
      name: "Runtime Config",
      version: "1.0.0",
      description: "The runtime's effective config, refreshed on reload.",
      scope: "workspace",
      grants: ["services"],
      provides: [RUNTIME_CONFIG_SERVICE],
    },
    (ctx) => ctx.contribute("services", RUNTIME_CONFIG_SERVICE, config),
  );
  return result.ok ? { ok: true } : { ok: false, reason: result.reason };
}

/**
 * Replaces the config service after a reload. The replace goes through the
 * kernel's contribution path, so a prior value is reported to subscribers as
 * the `providerBefore` of a service update.
 */
export function refreshRuntimeConfigService(
  registry: CapabilityRegistryHost,
  config: ConfigV3,
): void {
  registry.contribute(
    RUNTIME_CONFIG_CAPABILITY_ID,
    "services",
    RUNTIME_CONFIG_SERVICE,
    config,
  );
}
