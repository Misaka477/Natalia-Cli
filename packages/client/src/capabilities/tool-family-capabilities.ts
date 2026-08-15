/**
 * The built-in tool families, as capabilities.
 *
 * Before this, the framework's 39 tools were a static array pushed straight into
 * the `ToolRegistry`: the kernel did not own them, `tool.registered` reported
 * every one of them as owned by `natalia-runtime`, and nothing could remove a
 * family because nothing had ever contributed it. Here each family from
 * `builtinToolFamilies()` is loaded as one capability that contributes its own
 * tools, so the built-ins are on exactly the same footing as an external plugin:
 *
 *   - the kernel refuses a contribution outside the `tools` grant;
 *   - `ownerOf("tools", name)` names the family that provides a tool;
 *   - unloading a family releases its tools, because the kernel owns them.
 *
 * The runtime still never names a tool: it asks for the families and moves what
 * the kernel accepted into the registry the executor reads.
 */
import type {
  CapabilityRegistration,
  CapabilityRegistryHost,
} from "@natalia/capability";
import { todoToolFamily } from "@natalia/tool-todo";
import {
  agentToolFamily,
  askToolFamily,
  createToolRegistry,
  fsToolFamily,
  processToolFamily,
  sandboxToolFamily,
  searchToolFamily,
  shellToolFamily,
  terminalToolFamily,
  webToolFamily,
  ManagedProcessRegistry,
  type RuntimeTool,
  type ToolFamily,
  type ToolRegistry,
} from "@natalia/tools";

/**
 * The tool families this host loads, in the order their tools are advertised.
 *
 * Composition lives here, not in `@natalia/tools`, because the framework ships no
 * tools: a family is described by whoever packages it, and the host decides which
 * ones to load. `todo` already comes from its own package; the rest are described
 * by factories that still live next to their implementations, and moving one out
 * changes only its import here.
 *
 * This is also the effective built-in catalogue — the single list that says what
 * the model can call — so anything that needs to know the built-in tool names
 * reads it instead of keeping a second inventory.
 */
export function builtinToolFamilies(
  processRegistry = new ManagedProcessRegistry(),
): ToolFamily[] {
  return [
    fsToolFamily(),
    searchToolFamily(),
    todoToolFamily(),
    askToolFamily(),
    agentToolFamily(),
    terminalToolFamily(),
    sandboxToolFamily(),
    shellToolFamily(),
    processToolFamily(processRegistry),
    webToolFamily(),
  ];
}

/** Every built-in tool name, including the aliases a model may use. */
export function builtinToolNames(): string[] {
  return builtinToolFamilies().flatMap((family) => [
    ...family.tools.map((tool) => tool.name),
    ...Object.keys(family.aliases ?? {}),
  ]);
}

/** The capability id a family is loaded as. */
export function toolFamilyCapabilityID(familyID: string) {
  return `natalia-tool-${familyID}`;
}

export function toolFamilyRegistration(
  family: ToolFamily,
): CapabilityRegistration {
  return {
    id: toolFamilyCapabilityID(family.id),
    name: family.name,
    version: family.version,
    description: family.description,
    scope: family.scope,
    grants: ["tools"],
  };
}

export type ToolFamilyLoadOutcome = {
  /** Families the kernel accepted, in registration order. */
  loaded: Array<{ registration: CapabilityRegistration; tools: string[] }>;
  failed: Array<{ id: string; reason: string }>;
};

/**
 * Loads every built-in family into the kernel. A family that fails to load says
 * why and does not leave half its tools behind — `tryLoad` rolls the activation
 * back — so the caller can report the loss instead of serving a partial family.
 */
export function registerToolFamilyCapabilities(
  registry: CapabilityRegistryHost,
  families: ToolFamily[],
): ToolFamilyLoadOutcome {
  const loaded: ToolFamilyLoadOutcome["loaded"] = [];
  const failed: ToolFamilyLoadOutcome["failed"] = [];
  for (const family of families) {
    const registration = toolFamilyRegistration(family);
    const result = registry.tryLoad(registration, (capability) => {
      for (const tool of family.tools)
        capability.contribute("tools", tool.name, tool);
    });
    if (!result.ok) {
      failed.push({ id: registration.id, reason: result.reason });
      continue;
    }
    loaded.push({
      registration,
      tools: family.tools.map((tool) => tool.name),
    });
  }
  return { loaded, failed };
}

/**
 * Builds the tool registry the executor reads from the families the kernel
 * accepted.
 *
 * Only kernel-owned contributions get in: a family that failed to load is absent
 * from the registry too, rather than being half-present because its tools were
 * also listed somewhere else. Aliases are applied per family, so an alias cannot
 * outlive the family that named it.
 */
export function createToolRegistryFromCapabilities(input: {
  registry: CapabilityRegistryHost;
  processRegistry?: ManagedProcessRegistry;
  families?: ToolFamily[];
}): { tools: ToolRegistry; outcome: ToolFamilyLoadOutcome } {
  const families = input.families ?? builtinToolFamilies(input.processRegistry);

  const outcome = registerToolFamilyCapabilities(input.registry, families);
  const tools = createToolRegistry([]);
  const accepted = new Set(
    outcome.loaded.map((entry) => entry.registration.id),
  );
  for (const contribution of input.registry.contributions<RuntimeTool>("tools"))
    if (accepted.has(contribution.capabilityID))
      tools.set(contribution.name, contribution.payload);
  for (const family of families) {
    if (!accepted.has(toolFamilyCapabilityID(family.id))) continue;
    for (const [alias, target] of Object.entries(family.aliases ?? {}))
      if (tools.has(target)) tools.addAlias(alias, target);
  }
  return { tools, outcome };
}
