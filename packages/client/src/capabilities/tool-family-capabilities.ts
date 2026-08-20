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
import {
  createToolRegistry,
  type RuntimeTool,
  type ToolFamily,
  type ToolRegistry,
} from "@natalia/tools";

/**
 * The tool families this host loads, in the order their tools are advertised.
 *
 * Every built-in tool family is now a built-in plugin loaded through the plugin
 * catalog; this static assembly intentionally contributes nothing. It remains as
 * the kernel path used when a host passes its own `families`, and as the test
 * surface for family capability semantics.
 *
 * `enabled` is the config's `tools.enabled`: a family that is `false` does not
 * load, and a family that is absent or `true` loads.
 */
export function builtinToolFamilies(
  enabled?: Record<string, boolean>,
): ToolFamily[] {
  return [];
}

/** Every built-in tool name, including the aliases a model may use. */
export function builtinToolNames(enabled?: Record<string, boolean>): string[] {
  const names = builtinToolFamilies(enabled).flatMap((family) => [
    ...family.tools.map((tool) => tool.name),
    ...Object.keys(family.aliases ?? {}),
  ]);
  if (enabled?.ask !== false) names.push("ask_user");
  if (enabled?.todo !== false) names.push("plan", "todo_read", "todo_write");
  if (enabled?.search !== false) names.push("glob", "grep");
  if (enabled?.fs !== false && enabled?.["fs-read"] !== false)
    names.push("read_file", "read_media_file", "image_read");
  if (enabled?.fs !== false && enabled?.["fs-write"] !== false)
    names.push("write_file", "edit_file", "apply_patch");
  if (enabled?.web !== false)
    names.push(
      "web_fetch",
      "web_search",
      "browser_visit",
      "browser_screenshot",
    );
  if (enabled?.shell !== false) names.push("run_shell");
  if (enabled?.agent !== false)
    names.push(
      "agent_spawn",
      "agent_list",
      "agent_status",
      "agent_output",
      "agent_wait",
      "agent_stop",
      "agent_resume",
      "agent_retry",
      "agent_attach",
      "agent_detach",
      "agent_cleanup",
      "agent_audit",
    );
  if (enabled?.terminal !== false)
    names.push(
      "interactive_terminal_start",
      "interactive_terminal_read",
      "interactive_terminal_search",
      "interactive_terminal_write",
      "interactive_terminal_send_line",
      "interactive_terminal_keys",
      "interactive_terminal_input",
      "interactive_terminal_snapshot",
      "interactive_terminal_resize",
      "interactive_terminal_request_human",
      "interactive_terminal_stop",
      "interactive_terminal_list",
      "terminal_observe",
      "interactive_start",
      "interactive_read",
      "interactive_search",
      "interactive_write",
      "interactive_send_line",
      "interactive_keys",
      "interactive_input",
      "interactive_snapshot",
      "interactive_resize",
      "interactive_stop",
      "interactive_list",
    );
  if (enabled?.sandbox !== false)
    names.push(
      "sandbox_create",
      "sandbox_execute",
      "sandbox_write",
      "sandbox_diff",
      "sandbox_merge",
      "sandbox_delete",
      "sandbox_resource_start",
      "sandbox_resource_list",
      "sandbox_resource_output",
      "sandbox_resource_stop",
    );
  if (enabled?.process !== false)
    names.push(
      "process_start",
      "process_list",
      "process_status",
      "process_output",
      "process_ready",
      "process_stop",
      "process_restart",
      "process_attach",
      "process_detach",
      "process_cleanup",
      "process_audit",
      "background_start",
      "background_list",
      "background_output",
      "background_stop",
      "background_restart",
      "background_cleanup",
      "background_audit",
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
    id: "fs-read",
    name: "Filesystem Read Tools",
    version: "1.0.0",
    description: "Reading workspace files and media metadata.",
    scope: "workspace",
    dependencies: [],
    tools: ["read_file", "read_media_file", "image_read"],
  },
  {
    id: "fs-write",
    name: "Filesystem Write Tools",
    version: "1.0.0",
    description: "Writing and editing workspace files.",
    scope: "workspace",
    dependencies: [],
    tools: ["write_file", "edit_file", "apply_patch"],
  },
  {
    id: "web",
    name: "Web Tools",
    version: "1.0.0",
    description: "Fetching and searching the web.",
    scope: "session",
    dependencies: [],
    tools: ["web_fetch", "web_search", "browser_visit", "browser_screenshot"],
  },
  {
    id: "shell",
    name: "Shell Tools",
    version: "1.0.0",
    description: "One-shot command execution.",
    scope: "session",
    dependencies: [],
    tools: ["run_shell"],
  },
  {
    id: "agent",
    name: "Subagent Tools",
    version: "1.0.0",
    description: "Delegating work to a subagent.",
    scope: "session",
    dependencies: [],
    tools: [
      "agent_spawn",
      "agent_list",
      "agent_status",
      "agent_output",
      "agent_wait",
      "agent_stop",
      "agent_resume",
      "agent_retry",
      "agent_attach",
      "agent_detach",
      "agent_cleanup",
      "agent_audit",
    ],
  },
  {
    id: "terminal",
    name: "Terminal Tools",
    version: "1.0.0",
    description: "Native terminal panes and interactive programs.",
    scope: "session",
    dependencies: [],
    tools: [
      "interactive_terminal_start",
      "interactive_terminal_read",
      "interactive_terminal_search",
      "interactive_terminal_write",
      "interactive_terminal_send_line",
      "interactive_terminal_keys",
      "interactive_terminal_input",
      "interactive_terminal_snapshot",
      "interactive_terminal_resize",
      "interactive_terminal_request_human",
      "interactive_terminal_stop",
      "interactive_terminal_list",
      "terminal_observe",
      "interactive_start",
      "interactive_read",
      "interactive_search",
      "interactive_write",
      "interactive_send_line",
      "interactive_keys",
      "interactive_input",
      "interactive_snapshot",
      "interactive_resize",
      "interactive_stop",
      "interactive_list",
    ],
  },
  {
    id: "sandbox",
    name: "Sandbox Tools",
    version: "1.0.0",
    description: "Isolated workspaces and their merge back.",
    scope: "workspace",
    dependencies: [],
    tools: [
      "sandbox_create",
      "sandbox_execute",
      "sandbox_write",
      "sandbox_diff",
      "sandbox_merge",
      "sandbox_delete",
      "sandbox_resource_start",
      "sandbox_resource_list",
      "sandbox_resource_output",
      "sandbox_resource_stop",
    ],
  },
  {
    id: "process",
    name: "Managed Process Tools",
    version: "1.0.0",
    description: "Long-running background processes.",
    scope: "session",
    dependencies: [],
    tools: [
      "process_start",
      "process_list",
      "process_status",
      "process_output",
      "process_ready",
      "process_stop",
      "process_restart",
      "process_attach",
      "process_detach",
      "process_cleanup",
      "process_audit",
      "background_start",
      "background_list",
      "background_output",
      "background_stop",
      "background_restart",
      "background_cleanup",
      "background_audit",
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
  families?: ToolFamily[];
  /** Config `tools.enabled`: a family that is `false` does not load. */
  enabled?: Record<string, boolean>;
}): { tools: ToolRegistry; outcome: ToolFamilyLoadOutcome } {
  const families = input.families ?? builtinToolFamilies(input.enabled);

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
