/**
 * Extension precedence and override contract.
 * Lower number = higher priority (applied first).
 * Built-in = 0, MCP = 100, plugin = 200, workflow = 300.
 */
export type ExtensionPrecedence = {
  base: number;
  overridable: boolean;
  overrideOrigin?: string;
};

export const EXTENSION_PRECEDENCE = {
  builtin: 0,
  mcp: 100,
  plugin: 200,
  workflow: 300,
} as const;

/** What a capability declares at registration time. */
export type CapabilityRegistration = {
  id: string;
  name: string;
  version: string;
  description?: string;
  scope: "process" | "workspace" | "session";
  dependencies?: string[];
  grants: Array<
    "tools" | "commands" | "settings" | "workflows" | "projection" | "resources"
  >;
};

/** Controlled API the runtime provides to each loaded capability. */
export type CapabilityContext = {
  id: string;
  emit: (event: unknown) => void;
  onUnload: (fn: () => void) => void;
};

/** Tracks a loaded capability's state. */
type CapabilityInstance = {
  registration: CapabilityRegistration;
  context: CapabilityContext;
  unloadFns: Array<() => void>;
  loadedAt: number;
};

/**
 * Manages capability lifecycle: register, load, unload, rollback.
 * Each capability gets an isolated scope; load failure rolls back all
 * side effects for that capability without affecting others.
 */
export class CapabilityRegistry {
  private instances = new Map<string, CapabilityInstance>();
  private byGrant = new Map<string, Set<string>>();

  /** Register and activate a capability. Returns its controlled context. */
  load(registration: CapabilityRegistration): CapabilityContext {
    if (this.instances.has(registration.id))
      throw new Error(`Capability "${registration.id}" already loaded`);

    const unloadFns: Array<() => void> = [];
    const ctx: CapabilityContext = {
      id: registration.id,
      emit: (event: unknown) => {
        /* emitted back by the runtime integration */
      },
      onUnload: (fn) => unloadFns.push(fn),
    };

    const instance: CapabilityInstance = {
      registration,
      context: ctx,
      unloadFns,
      loadedAt: Date.now(),
    };

    this.instances.set(registration.id, instance);
    for (const grant of registration.grants) {
      if (!this.byGrant.has(grant)) this.byGrant.set(grant, new Set());
      this.byGrant.get(grant)!.add(registration.id);
    }

    return ctx;
  }

  /** Unload a capability: call its unload hooks, remove registrations. */
  unload(id: string): boolean {
    const instance = this.instances.get(id);
    if (!instance) return false;

    for (const fn of instance.unloadFns) {
      try {
        fn();
      } catch {
        /* cleanup best-effort */
      }
    }
    for (const grant of instance.registration.grants)
      this.byGrant.get(grant)?.delete(id);

    this.instances.delete(id);
    return true;
  }

  /** Unload all capabilities, in reverse load order. */
  unloadAll() {
    const ids = [...this.instances.keys()].reverse();
    for (const id of ids) this.unload(id);
  }

  /** Get all loaded capability registrations. */
  list(): CapabilityRegistration[] {
    return [...this.instances.values()].map((i) => i.registration);
  }

  /** Get capability IDs that hold a specific grant. */
  withGrant(grant: string): string[] {
    return [...(this.byGrant.get(grant) ?? [])];
  }

  /** Safe wrapper: attempt load, rollback on failure. */
  tryLoad(registration: CapabilityRegistration): CapabilityContext | undefined {
    try {
      return this.load(registration);
    } catch {
      this.unload(registration.id);
      return undefined;
    }
  }
}
