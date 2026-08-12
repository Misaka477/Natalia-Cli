/**
 * Registration records for the built-in subsystems.
 *
 * Scope, honestly: terminal, sandbox, checkpoint and MCP are still constructed
 * directly by the runtime, so these records make them visible and auditable
 * through the capability registry rather than owning their wiring. They declare
 * no contributions, which is why they need no grants beyond the ones they name.
 *
 * The task-module capability in `task-module-capability.ts` is the opposite case
 * and the one to copy: it contributes its tools through the kernel, so the
 * runtime never names them.
 */
import type {
  CapabilityRegistration,
  CapabilityRegistryHost,
} from "@natalia/capability";

export function builtinCapabilities(): CapabilityRegistration[] {
  return [
    {
      id: "natalia-terminal",
      name: "Terminal",
      version: "1.0.0",
      scope: "session",
      grants: ["tools", "resources"],
    },
    {
      id: "natalia-sandbox",
      name: "Sandbox",
      version: "1.0.0",
      scope: "workspace",
      grants: ["tools", "resources"],
    },
    {
      id: "natalia-checkpoint",
      name: "Checkpoint",
      version: "1.0.0",
      scope: "workspace",
      grants: ["tools", "commands"],
    },
    {
      id: "natalia-mcp",
      name: "MCP Server",
      version: "1.0.0",
      scope: "session",
      grants: ["tools", "resources"],
    },
  ];
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
