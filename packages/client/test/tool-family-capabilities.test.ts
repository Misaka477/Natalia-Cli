import { expect, test } from "bun:test";
import { CapabilityRegistry } from "@natalia/capability";
import type { ToolFamily } from "@natalia/tools";
import {
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

test("the effective tool catalogue names migrated plugin tools", () => {
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
    expect(failure.reason).toMatch(/already registered/u);
});

test("dependency ordering registers a dependent after its dependency", () => {
  const registry = new CapabilityRegistry();
  const dependent: ToolFamily = {
    ...syntheticFamily("later"),
    dependencies: ["earlier"],
  };
  const earlier = syntheticFamily("earlier");
  // Dependent listed first on purpose: ordering must fix it, not the caller.
  const { tools, outcome } = createToolRegistryFromCapabilities({
    registry,
    families: [dependent, earlier],
  });
  expect(outcome.failed).toEqual([]);
  expect(outcome.loaded.map((entry) => entry.registration.id)).toEqual([
    toolFamilyCapabilityID("earlier"),
    toolFamilyCapabilityID("later"),
  ]);
  expect(tools.has("earlier_run")).toBe(true);
  expect(tools.has("later_run")).toBe(true);
  expect(registry.has(toolFamilyCapabilityID("later"))).toBe(true);
  expect(registry.has(toolFamilyCapabilityID("earlier"))).toBe(true);
});
