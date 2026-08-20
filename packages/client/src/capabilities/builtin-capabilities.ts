/**
 * Registration records for the built-in subsystems.
 *
 * Terminal, sandbox, MCP and checkpoint controllers are all real plugins now and
 * own their capability through the plugin lifecycle. No built-in subsystem is
 * constructed directly by the runtime anymore, so there are no visibility-only
 * records left to declare.
 */
import type {
  CapabilityRegistration,
  CapabilityRegistryHost,
} from "@natalia/capability";

export function builtinCapabilities(): CapabilityRegistration[] {
  return [];
}

export type CapabilityLoadedEvent = {
  type: "capability.loaded";
  id: string;
  apiVersion: 1;
  name: string;
  version: string;
  scope: CapabilityRegistration["scope"];
  grants: CapabilityRegistration["grants"];
};

export type CapabilityFailedEvent = {
  type: "capability.failed";
  id: string;
  reason: string;
};

/**
 * Loads each record and returns one durable event per outcome. A capability that
 * fails to load reports why instead of vanishing, so the journal never implies a
 * capability is present when it is not.
 */
export function registerBuiltinCapabilities(registry: CapabilityRegistryHost): {
  loaded: CapabilityLoadedEvent[];
  failed: CapabilityFailedEvent[];
} {
  const loaded: CapabilityLoadedEvent[] = [];
  const failed: CapabilityFailedEvent[] = [];
  for (const registration of builtinCapabilities()) {
    const result = registry.tryLoad(registration);
    if (!result.ok) {
      failed.push({
        type: "capability.failed",
        id: `cap:${registration.id}`,
        reason: result.reason,
      });
      continue;
    }
    loaded.push({
      type: "capability.loaded",
      id: `cap:${registration.id}`,
      apiVersion: 1,
      name: registration.name,
      version: registration.version,
      scope: registration.scope,
      grants: registration.grants,
    });
  }
  return { loaded, failed };
}
