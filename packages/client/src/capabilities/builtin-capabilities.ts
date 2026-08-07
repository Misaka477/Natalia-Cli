/**
 * Registration records for the built-in subsystems.
 *
 * Honest scope: this is a **catalogue**, not a wiring mechanism. Terminal,
 * sandbox, checkpoint and MCP are still constructed directly by the runtime;
 * these records only make them visible and auditable through the capability
 * registry. `CapabilityRegistry` does not enforce `scope`, does not resolve
 * `dependencies`, and does not check that a contribution matches its `grants`
 * subsystem nothing and removing it takes nothing away.
 *
 * The value of extracting it is narrow and real: the records are now data a
 * test can assert against, and adding one no longer means editing the runtime
 * closure. Making registration actually own the wiring is a later slice and
 * requires grant enforcement in `@natalia/capability` first.
 */
import type { CapabilityRegistration } from "@natalia/capability";

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

/**
 * Loads each record and returns one durable event per capability that actually
 * loaded. A record that fails to load produces no event, so the journal never
 * claims a capability is present when it is not.
 */
export function registerBuiltinCapabilities(registry: {
  tryLoad(registration: CapabilityRegistration): unknown;
}): CapabilityLoadedEvent[] {
  const events: CapabilityLoadedEvent[] = [];
  for (const registration of builtinCapabilities()) {
    if (!registry.tryLoad(registration)) continue;
    events.push({
      type: "capability.loaded",
      id: `cap:${registration.id}`,
      apiVersion: 1,
      name: registration.name,
      version: registration.version,
      scope: registration.scope,
      grants: registration.grants,
    });
  }
  return events;
}
