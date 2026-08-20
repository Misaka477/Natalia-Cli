import { expect, test } from "bun:test";
import { CapabilityRegistry } from "@natalia/capability";
import type { ToolFamily } from "@natalia/tools";
import {
  applyToolFamilyEnabledFilter,
  builtinToolFamilies,
  builtinToolNames,
  createToolRegistryFromCapabilities,
  registerToolFamilyCapabilities,
  toolFamilyCapabilityID,
  toolFamilyRegistration,
} from "../src/capabilities/tool-family-capabilities";

// The built-in tools are capabilities now, so they must be assemblable without a
// runtime. If any of this needed a real client, nothing would have been decoupled.
// Every built-in family is a plugin now, so the family-capability machinery below
// is exercised with synthetic families rather than host-built ones.

function syntheticFamily(id: string): ToolFamily {
  return {
    id,
    name: id,
    version: "1.0.0",
    description: `synthetic ${id}`,
    scope: "session",
    tools: [
      {
        name: `${id}_run`,
        description: "Run",
        requiresApproval: false,
        parameters: { type: "object", properties: {} },
        async execute() {
          return "ok";
        },
      },
    ],
  };
}

test("the static built-in catalogue is empty after the plugin migration", () => {
  expect(builtinToolFamilies()).toEqual([]);
  // The effective built-in catalogue still names every migrated family tool.
  expect(builtinToolNames()).toContain("ask_user");
  expect(builtinToolNames()).toEqual(
    expect.arrayContaining(["plan", "todo_read", "todo_write"]),
  );
  expect(builtinToolNames()).toEqual(expect.arrayContaining(["glob", "grep"]));
  expect(builtinToolNames()).toEqual(
    expect.arrayContaining(["read_file", "write_file", "edit_file"]),
  );
  expect(builtinToolNames()).toContain("apply_patch");
  expect(builtinToolNames()).toContain("web_fetch");
  expect(builtinToolNames()).toContain("run_shell");
  expect(builtinToolNames()).toContain("agent_spawn");
  expect(builtinToolNames()).toContain("interactive_terminal_start");
  expect(builtinToolNames()).toContain("interactive_start");
  expect(builtinToolNames()).toContain("sandbox_create");
  expect(builtinToolNames()).toContain("process_start");
  expect(builtinToolNames()).toContain("background_start");
  // Family switches gate the names independently.
  expect(builtinToolNames({ ask: false })).not.toContain("ask_user");
  expect(builtinToolNames({ todo: false })).not.toContain("todo_read");
  expect(builtinToolNames({ search: false })).not.toContain("glob");
  expect(builtinToolNames({ fs: false })).not.toContain("read_file");
  expect(builtinToolNames({ "fs-read": false })).not.toContain("read_file");
  expect(builtinToolNames({ "fs-write": false })).not.toContain("apply_patch");
  expect(builtinToolNames({ web: false })).not.toContain("web_search");
  expect(builtinToolNames({ shell: false })).not.toContain("run_shell");
  expect(builtinToolNames({ agent: false })).not.toContain("agent_retry");
  expect(builtinToolNames({ terminal: false })).not.toContain(
    "terminal_observe",
  );
  expect(builtinToolNames({ sandbox: false })).not.toContain("sandbox_merge");
  expect(builtinToolNames({ process: false })).not.toContain("process_start");
});

test("each family declares exactly the tools grant", () => {
  const family = syntheticFamily("alpha");
  const registration = toolFamilyRegistration(family);
  expect(registration.id).toBe(`natalia-tool-${family.id}`);
  expect(registration.grants).toEqual(["tools"]);
  expect(registration.scope).toBe(family.scope);
});

test("every tool is owned by the family that contributed it", () => {
  const registry = new CapabilityRegistry();
  const family = syntheticFamily("alpha");
  const { tools, outcome } = createToolRegistryFromCapabilities({
    registry,
    families: [family],
  });
  expect(outcome.failed).toEqual([]);
  for (const tool of family.tools) {
    expect(tools.has(tool.name)).toBe(true);
    expect(registry.ownerOf("tools", tool.name)).toBe(
      toolFamilyCapabilityID(family.id),
    );
  }
  // Nothing is in the registry that the kernel does not own: a tool the kernel
  // never accepted must not be callable.
  for (const name of tools.keys())
    expect(registry.ownerOf("tools", name)).toBeString();
});

test("unloading a family removes its tools from the kernel", () => {
  const registry = new CapabilityRegistry();
  const family = syntheticFamily("alpha");
  createToolRegistryFromCapabilities({ registry, families: [family] });
  expect(registry.unload(toolFamilyCapabilityID("alpha"))).toBe(true);
  for (const tool of family.tools)
    expect(registry.ownerOf("tools", tool.name)).toBeUndefined();
  expect(registry.has(toolFamilyCapabilityID("alpha"))).toBe(false);
});

test("a family that fails to load leaves none of its tools callable", () => {
  const registry = new CapabilityRegistry();
  const good = syntheticFamily("good");
  const broken: ToolFamily = {
    ...syntheticFamily("broken"),
    tools: [
      ...syntheticFamily("broken").tools,
      { ...syntheticFamily("broken").tools[0]!, name: "" },
    ],
  };
  const { tools, outcome } = createToolRegistryFromCapabilities({
    registry,
    families: [good, broken],
  });
  expect(outcome.failed.map((entry) => entry.id)).toEqual([
    toolFamilyCapabilityID("broken"),
  ]);
  // Activation rolled back, so the family is absent rather than half-present:
  // the tools it had already contributed before the bad one are gone too.
  for (const tool of broken.tools) expect(tools.has(tool.name)).toBe(false);
  // The good family still loads.
  expect(tools.has("good_run")).toBe(true);
});

test("registering the same families twice is refused, not silently doubled", () => {
  const registry = new CapabilityRegistry();
  const families = [syntheticFamily("alpha")];
  expect(registerToolFamilyCapabilities(registry, families).failed).toEqual([]);
  const second = registerToolFamilyCapabilities(registry, families);
  expect(second.loaded).toEqual([]);
  expect(second.failed.length).toBe(families.length);
  for (const failure of second.failed)
    expect(failure.reason).toMatch(/already loaded/u);
});

test("applyToolFamilyEnabledFilter removes a disabled family after assembly", () => {
  const registry = new CapabilityRegistry();
  const family = syntheticFamily("alpha");
  const { tools } = createToolRegistryFromCapabilities({
    registry,
    families: [family],
  });
  expect(tools.has("alpha_run")).toBe(true);
  const cascaded = applyToolFamilyEnabledFilter({
    tools,
    registry,
    families: [family],
    enabled: { alpha: false },
  });
  expect(cascaded).toEqual([]);
  for (const tool of family.tools) expect(tools.has(tool.name)).toBe(false);
  expect(registry.has(toolFamilyCapabilityID("alpha"))).toBe(false);
});

test("a family that depends on a disabled one is cascade-disabled with a reason", () => {
  const registry = new CapabilityRegistry();
  const dependent: ToolFamily = {
    ...syntheticFamily("dependent"),
    dependencies: ["base"],
  };
  const base = syntheticFamily("base");
  const { tools } = createToolRegistryFromCapabilities({
    registry,
    families: [base, dependent],
  });
  expect(tools.has("dependent_run")).toBe(true);

  const cascaded = applyToolFamilyEnabledFilter({
    tools,
    registry,
    families: [base, dependent],
    enabled: { base: false },
  });
  expect(cascaded).toEqual([
    { id: "dependent", reason: expect.stringContaining("base") as string },
  ]);
  expect(tools.has("base_run")).toBe(false);
  expect(tools.has("dependent_run")).toBe(false);
  expect(registry.has(toolFamilyCapabilityID("dependent"))).toBe(false);
});

test("dependency ordering lets a dependent load after its dependency", () => {
  const registry = new CapabilityRegistry();
  const dependent: ToolFamily = {
    ...syntheticFamily("later"),
    dependencies: ["earlier"],
  };
  const earlier = syntheticFamily("earlier");
  // Dependent listed first on purpose: ordering must fix it, not the caller.
  const outcome = registerToolFamilyCapabilities(registry, [
    dependent,
    earlier,
  ]);
  expect(outcome.failed).toEqual([]);
  expect(registry.has(toolFamilyCapabilityID("later"))).toBe(true);
  expect(registry.has(toolFamilyCapabilityID("earlier"))).toBe(true);
});
