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
import { agentToolFamily } from "@natalia/tool-agent";
import {
  ManagedProcessRegistry,
  processToolFamily,
} from "@natalia/tool-process";
import { sandboxToolFamily } from "@natalia/tool-sandbox";
import { shellToolFamily } from "@natalia/tool-shell";
import { terminalToolFamily } from "@natalia/tool-terminal";
import { webToolFamily } from "@natalia/tool-web";
import {
  createToolRegistry,
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
 *
 * `enabled` is the config's `tools.enabled`: a family that is `false` does not
 * load, and a family that is absent or `true` loads. The filter happens here, so
 * a disabled family's tools never reach the kernel or the executor registry.
 */
export function builtinToolFamilies(
  processRegistry = new ManagedProcessRegistry(),
  enabled?: Record<string, boolean>,
): ToolFamily[] {
  return [
    agentToolFamily(),
    terminalToolFamily(),
    sandboxToolFamily(),
    shellToolFamily(),
    processToolFamily(processRegistry),
    webToolFamily(),
  ].filter((family) => enabled?.[family.id] !== false);
}

/** Every built-in tool name, including the aliases a model may use. */
export function builtinToolNames(enabled?: Record<string, boolean>): string[] {
  const names = builtinToolFamilies(undefined, enabled).flatMap((family) => [
    ...family.tools.map((tool) => tool.name),
    ...Object.keys(family.aliases ?? {}),
  ]);
  if (enabled?.ask !== false) names.push("ask_user");
  if (enabled?.todo !== false) names.push("plan", "todo_read", "todo_write");
  if (enabled?.search !== false) names.push("glob", "grep");
  if (enabled?.fs !== false)
    names.push(
      "read_file",
      "write_file",
      "edit_file",
      "read_media_file",
      "image_read",
    );
  return names;
}

/** Metadata for migrated families retained by the deprecated `tool` CLI. */
export const migratedBuiltinToolFamilies = [
  {
    id: "ask",
    name: "Interactive Question Tools",
    version: "1.0.0",
    description: "Asking the user a structured question.",
    scope: "session",
    dependencies: [],
    tools: ["ask_user"],
  },
  {
    id: "todo",
    name: "Todo Tools",
    version: "1.0.0",
    description: "The session's task list.",
    scope: "session",
    dependencies: [],
    tools: ["plan", "todo_read", "todo_write"],
  },
  {
    id: "search",
    name: "Search Tools",
    version: "1.0.0",
    description: "Finding files by name and content in the workspace.",
    scope: "workspace",
    dependencies: [],
    tools: ["glob", "grep"],
  },
  {
    id: "fs",
    name: "Filesystem Tools",
    version: "1.0.0",
    description: "Reading, writing and editing workspace files.",
    scope: "workspace",
    dependencies: [],
    tools: [
      "read_file",
      "write_file",
      "edit_file",
      "read_media_file",
      "image_read",
    ],
  },
] as const;

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
    // A family's dependencies are the capabilities of the families it names, so
    // the kernel refuses the load when one of them is missing — a disabled
    // dependency is a missing capability, and the failure says so.
    ...(family.dependencies?.length
      ? {
          dependencies: family.dependencies.map(toolFamilyCapabilityID),
        }
      : {}),
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
 *
 * Families are ordered by their dependencies first, so a dependent family is
 * never tried before the family it names: the kernel would otherwise refuse it
 * with "not loaded" even when everything is present.
 */
export function registerToolFamilyCapabilities(
  registry: CapabilityRegistryHost,
  families: ToolFamily[],
): ToolFamilyLoadOutcome {
  const loaded: ToolFamilyLoadOutcome["loaded"] = [];
  const failed: ToolFamilyLoadOutcome["failed"] = [];
  for (const family of orderedFamilies(families)) {
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

/** Dependencies first, stable otherwise, so tryLoad never races its own input. */
function orderedFamilies(families: ToolFamily[]): ToolFamily[] {
  const byID = new Map(families.map((family) => [family.id, family]));
  const ordered: ToolFamily[] = [];
  const visited = new Set<string>();
  const visit = (family: ToolFamily) => {
    if (visited.has(family.id)) return;
    visited.add(family.id);
    for (const dependency of family.dependencies ?? []) {
      const dependencyFamily = byID.get(dependency);
      if (dependencyFamily) visit(dependencyFamily);
    }
    ordered.push(family);
  };
  for (const family of families) visit(family);
  return ordered;
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
/**
 * Applies the config's `tools.enabled` to an already-assembled runtime.
 *
 * The full catalogue loads at construction (the executor registry and the
 * task-module collision check are built before config resolves), so a disabled
 * family is removed here instead: its capability is unloaded from the kernel —
 * which cascades to any family that depends on it — and its tools are dropped
 * from the executor registry, so they can never be called. `tool.registered` is
 * published after this runs, so a disabled family never appears in it.
 *
 * @returns the families that were enabled but cascade-disabled because a family
 * they depend on is disabled, each with the reason.
 */
export function applyToolFamilyEnabledFilter(input: {
  tools: ToolRegistry;
  registry: CapabilityRegistryHost;
  families: ToolFamily[];
  enabled?: Record<string, boolean>;
}): Array<{ id: string; reason: string }> {
  const enabledIDs = new Set(
    input.families
      .filter((family) => input.enabled?.[family.id] !== false)
      .map((family) => family.id),
  );
  for (const family of input.families)
    if (!enabledIDs.has(family.id))
      input.registry.unload(toolFamilyCapabilityID(family.id));
  // The kernel cascades an unload to dependents, so a family can be gone even
  // though it was not itself disabled. What is actually loaded decides what
  // stays in the executor registry.
  const loadedIDs = new Set(
    input.families
      .filter((family) => input.registry.has(toolFamilyCapabilityID(family.id)))
      .map((family) => family.id),
  );
  const loadedNames = new Set(
    input.families
      .filter((family) => loadedIDs.has(family.id))
      .flatMap((family) => [
        ...family.tools.map((tool) => tool.name),
        ...Object.keys(family.aliases ?? {}),
      ]),
  );
  for (const family of input.families)
    for (const tool of family.tools)
      if (!loadedNames.has(tool.name)) input.tools.delete(tool.name);
  const cascaded: Array<{ id: string; reason: string }> = [];
  for (const family of input.families) {
    if (!enabledIDs.has(family.id)) continue;
    if (loadedIDs.has(family.id)) continue;
    const disabledDependencies = (family.dependencies ?? []).filter(
      (dependency) => !enabledIDs.has(dependency),
    );
    cascaded.push({
      id: family.id,
      reason: `depends on disabled tool family: ${disabledDependencies.join(", ")}`,
    });
  }
  return cascaded;
}

export function createToolRegistryFromCapabilities(input: {
  registry: CapabilityRegistryHost;
  processRegistry?: ManagedProcessRegistry;
  families?: ToolFamily[];
  /** Config `tools.enabled`: a family that is `false` does not load. */
  enabled?: Record<string, boolean>;
}): { tools: ToolRegistry; outcome: ToolFamilyLoadOutcome } {
  const families =
    input.families ?? builtinToolFamilies(input.processRegistry, input.enabled);

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
