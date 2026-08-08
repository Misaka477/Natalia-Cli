/**
 * The capability kernel.
 *
 * A capability declares what it is allowed to contribute (`grants`) and then
 * contributes it. The registry owns every contribution, which is what makes the
 * two properties that matter true:
 *
 *   1. A capability cannot contribute outside its grants. Enforcement happens at
 *      contribution time and throws, rather than being recorded and ignored.
 *   2. Unloading releases everything it contributed. There is no path where a
 *      capability is gone but its tools are still callable.
 *
 * Contribution payloads are opaque here on purpose. This package sits on the
 * consumer-contract side of the dependency rules and must not import
 * `@natalia/tools` or the runtime, so it stores payloads by kind and name and the
 * host reads them back with the concrete type it knows:
 *
 *     for (const entry of registry.contributions<RuntimeTool>("tools"))
 *       tools.set(entry.name, entry.payload);
 *
 * That indirection is the whole point: a new capability adds a file and a
 * registration, and the host's wiring never changes.
 */

/**
 * Extension precedence and override contract.
 * Lower number = higher priority (applied first).
 *
 * Informational only: this registry refuses duplicate contribution names outright
 * rather than letting a later capability shadow an earlier one. Silent shadowing
 * is how a plugin would replace a policy-checked built-in tool, so an explicit
 * override protocol has to be designed before precedence can decide anything.
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

/**
 * What a capability may contribute. Deliberately identical to the grant names, so
 * "may I contribute this?" is a set membership test with nothing to interpret.
 */
export type CapabilityGrant =
  | "tools"
  | "commands"
  | "settings"
  | "workflows"
  | "projection"
  | "resources"
  | "listeners";

export type CapabilityScope = "process" | "workspace" | "session";

/** What a capability declares at registration time. */
export type CapabilityRegistration = {
  id: string;
  name: string;
  version: string;
  description?: string;
  scope: CapabilityScope;
  /** Capability ids that must already be loaded. Refused if any is missing. */
  dependencies?: string[];
  grants: CapabilityGrant[];
};

/** Controlled API the runtime provides to each loaded capability. */
export type CapabilityContext = {
  id: string;
  /**
   * Registers one contribution. Throws when the capability lacks the matching
   * grant, when the name is already taken, or when the capability is unloading.
   */
  contribute: (kind: CapabilityGrant, name: string, payload: unknown) => void;
  onUnload: (fn: () => void) => void;
};

export type CapabilityContribution<T = unknown> = {
  capabilityID: string;
  kind: CapabilityGrant;
  name: string;
  payload: T;
};

type CapabilityInstance = {
  registration: CapabilityRegistration;
  context: CapabilityContext;
  unloadFns: Array<() => void>;
  contributions: CapabilityContribution[];
  loadedAt: number;
  sealed: boolean;
};

export class CapabilityLoadError extends Error {
  readonly capabilityID: string;
  constructor(capabilityID: string, message: string) {
    super(message);
    this.name = "CapabilityLoadError";
    this.capabilityID = capabilityID;
  }
}

export class CapabilityRegistry {
  private instances = new Map<string, CapabilityInstance>();
  private byGrant = new Map<CapabilityGrant, Set<string>>();
  /** `kind\u0000name` -> owning capability id, so collisions are cheap to detect. */
  private owners = new Map<string, string>();

  /**
   * Registers a capability and runs `activate` to collect its contributions.
   *
   * `activate` runs inside the load, so a capability that throws half way through
   * leaves nothing behind: every contribution it already made is released before
   * the error propagates. Without that, a partial failure would leave orphan
   * tools registered to a capability that is not loaded.
   */
  load(
    registration: CapabilityRegistration,
    activate?: (context: CapabilityContext) => void,
  ): CapabilityContext {
    if (this.instances.has(registration.id))
      throw new CapabilityLoadError(
        registration.id,
        `capability "${registration.id}" is already loaded`,
      );
    for (const dependency of registration.dependencies ?? []) {
      if (dependency === registration.id)
        throw new CapabilityLoadError(
          registration.id,
          `capability "${registration.id}" depends on itself`,
        );
      if (!this.instances.has(dependency))
        throw new CapabilityLoadError(
          registration.id,
          `capability "${registration.id}" requires "${dependency}", which is not loaded`,
        );
    }

    const grants = new Set(registration.grants);
    const instance: CapabilityInstance = {
      registration,
      context: undefined as unknown as CapabilityContext,
      unloadFns: [],
      contributions: [],
      loadedAt: Date.now(),
      sealed: false,
    };
    const context: CapabilityContext = {
      id: registration.id,
      contribute: (kind, name, payload) => {
        if (instance.sealed)
          throw new CapabilityLoadError(
            registration.id,
            `capability "${registration.id}" cannot contribute after unload`,
          );
        if (!grants.has(kind))
          throw new CapabilityLoadError(
            registration.id,
            `capability "${registration.id}" contributed ${kind} "${name}" without the "${kind}" grant`,
          );
        if (!name)
          throw new CapabilityLoadError(
            registration.id,
            `capability "${registration.id}" contributed a ${kind} with no name`,
          );
        const key = contributionKey(kind, name);
        const existing = this.owners.get(key);
        if (existing !== undefined)
          throw new CapabilityLoadError(
            registration.id,
            `capability "${registration.id}" cannot contribute ${kind} "${name}": already provided by "${existing}"`,
          );
        this.owners.set(key, registration.id);
        instance.contributions.push({
          capabilityID: registration.id,
          kind,
          name,
          payload,
        });
      },
      onUnload: (fn) => {
        instance.unloadFns.push(fn);
      },
    };
    instance.context = context;

    this.instances.set(registration.id, instance);
    for (const grant of registration.grants) {
      const holders = this.byGrant.get(grant) ?? new Set<string>();
      holders.add(registration.id);
      this.byGrant.set(grant, holders);
    }

    if (activate) {
      try {
        activate(context);
      } catch (error) {
        this.unload(registration.id);
        throw error instanceof CapabilityLoadError
          ? error
          : new CapabilityLoadError(
              registration.id,
              `capability "${registration.id}" failed to activate: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
      }
    }

    return context;
  }

  /**
   * Attempts a load and reports why it failed instead of swallowing it. A silent
   * failure here would leave a consumer believing a capability is present.
   */
  tryLoad(
    registration: CapabilityRegistration,
    activate?: (context: CapabilityContext) => void,
  ):
    | { ok: true; context: CapabilityContext }
    | { ok: false; reason: string; error: Error } {
    try {
      return { ok: true, context: this.load(registration, activate) };
    } catch (error) {
      const wrapped = error instanceof Error ? error : new Error(String(error));
      return { ok: false, reason: wrapped.message, error: wrapped };
    }
  }

  /**
   * Loads several capabilities, ordering them so dependencies come first and
   * refusing a cycle rather than deadlocking or picking an arbitrary order.
   */
  loadAll(
    entries: Array<{
      registration: CapabilityRegistration;
      activate?: (context: CapabilityContext) => void;
    }>,
  ): {
    loaded: string[];
    failed: Array<{ id: string; reason: string }>;
  } {
    const order = resolveLoadOrder(
      entries.map((entry) => entry.registration),
      (id) => this.instances.has(id),
    );
    const loaded: string[] = [];
    const failed = [...order.unresolvable];
    for (const id of order.order) {
      const entry = entries.find((item) => item.registration.id === id);
      if (!entry) continue;
      const result = this.tryLoad(entry.registration, entry.activate);
      if (result.ok) loaded.push(id);
      else failed.push({ id, reason: result.reason });
    }
    return { loaded, failed };
  }

  /**
   * Unloads a capability, releasing every contribution it made. Dependents are
   * unloaded first, because leaving a capability whose dependency is gone is the
   * same broken state as never having loaded it.
   */
  unload(id: string): boolean {
    const instance = this.instances.get(id);
    if (!instance) return false;

    for (const dependent of this.dependentsOf(id)) this.unload(dependent);

    instance.sealed = true;
    for (const fn of instance.unloadFns) {
      try {
        fn();
      } catch {
        // A capability that throws while cleaning up must not prevent the rest of
        // its contributions from being released.
      }
    }
    for (const contribution of instance.contributions)
      this.owners.delete(contributionKey(contribution.kind, contribution.name));
    for (const grant of instance.registration.grants)
      this.byGrant.get(grant)?.delete(id);
    this.instances.delete(id);
    return true;
  }

  /** Unloads every capability, in reverse load order. */
  unloadAll(): void {
    for (const id of [...this.instances.keys()].reverse()) this.unload(id);
  }

  /**
   * Unloads every capability with this scope. This is what `scope` means
   * operationally: when a session ends, its session-scoped capabilities and their
   * contributions are gone.
   */
  unloadScope(scope: CapabilityScope): string[] {
    const ids = [...this.instances.values()]
      .filter((instance) => instance.registration.scope === scope)
      .map((instance) => instance.registration.id)
      .reverse();
    const unloaded: string[] = [];
    for (const id of ids) if (this.unload(id)) unloaded.push(id);
    return unloaded;
  }

  list(): CapabilityRegistration[] {
    return [...this.instances.values()].map(
      (instance) => instance.registration,
    );
  }

  has(id: string): boolean {
    return this.instances.has(id);
  }

  scopeOf(id: string): CapabilityScope | undefined {
    return this.instances.get(id)?.registration.scope;
  }

  /** Capability ids holding a grant. */
  withGrant(grant: CapabilityGrant): string[] {
    return [...(this.byGrant.get(grant) ?? [])];
  }

  /** Every contribution of one kind, typed by the host that knows the payload. */
  contributions<T>(kind: CapabilityGrant): Array<CapabilityContribution<T>> {
    const all: Array<CapabilityContribution<T>> = [];
    for (const instance of this.instances.values()) {
      for (const contribution of instance.contributions)
        if (contribution.kind === kind)
          all.push(contribution as CapabilityContribution<T>);
    }
    return all;
  }

  contribution<T>(kind: CapabilityGrant, name: string): T | undefined {
    const owner = this.owners.get(contributionKey(kind, name));
    if (owner === undefined) return undefined;
    const instance = this.instances.get(owner);
    const found = instance?.contributions.find(
      (contribution) =>
        contribution.kind === kind && contribution.name === name,
    );
    return found?.payload as T | undefined;
  }

  /** Which capability provides a contribution, for diagnostics and audit. */
  ownerOf(kind: CapabilityGrant, name: string): string | undefined {
    return this.owners.get(contributionKey(kind, name));
  }

  private dependentsOf(id: string): string[] {
    return [...this.instances.values()]
      .filter((instance) =>
        (instance.registration.dependencies ?? []).includes(id),
      )
      .map((instance) => instance.registration.id);
  }
}

function contributionKey(kind: CapabilityGrant, name: string): string {
  return `${kind}\u0000${name}`;
}

/**
 * Orders registrations so every dependency precedes its dependents. Entries in a
 * cycle, or depending on something neither present nor already loaded, are
 * reported instead of being loaded in a guessed order.
 */
export function resolveLoadOrder(
  registrations: CapabilityRegistration[],
  isLoaded: (id: string) => boolean = () => false,
): { order: string[]; unresolvable: Array<{ id: string; reason: string }> } {
  const pending = new Map(
    registrations.map((registration) => [registration.id, registration]),
  );
  const order: string[] = [];
  const unresolvable: Array<{ id: string; reason: string }> = [];
  const placed = new Set<string>();

  for (const registration of registrations) {
    for (const dependency of registration.dependencies ?? []) {
      if (!pending.has(dependency) && !isLoaded(dependency))
        unresolvable.push({
          id: registration.id,
          reason: `requires "${dependency}", which is not available`,
        });
    }
  }
  const blocked = new Set(unresolvable.map((entry) => entry.id));

  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const [id, registration] of pending) {
      if (placed.has(id) || blocked.has(id)) continue;
      const ready = (registration.dependencies ?? []).every(
        (dependency) =>
          placed.has(dependency) ||
          isLoaded(dependency) ||
          !pending.has(dependency),
      );
      if (!ready) continue;
      placed.add(id);
      order.push(id);
      progressed = true;
    }
  }
  for (const id of pending.keys()) {
    if (placed.has(id) || blocked.has(id)) continue;
    unresolvable.push({ id, reason: "dependency cycle" });
  }
  return { order, unresolvable };
}
