import { expect, test } from "bun:test";
import { CapabilityRegistry } from "@natalia/capability";
import { todoToolFamily } from "@natalia/tool-todo";
import {
  builtinToolFamilies,
  builtinToolNames,
  createToolRegistryFromCapabilities,
  registerToolFamilyCapabilities,
  toolFamilyCapabilityID,
  toolFamilyRegistration,
} from "../src/capabilities/tool-family-capabilities";

// The built-in tools are capabilities now, so they must be assemblable without a
// runtime. If any of this needed a real client, nothing would have been decoupled.

test("the host composes the built-in catalogue from families", () => {
  const families = builtinToolFamilies();
  expect(families.length).toBeGreaterThan(1);
  for (const family of families) {
    expect(family.tools.length).toBeGreaterThan(0);
    expect(family.scope).toBeString();
  }
  // The family list is the built-in inventory: the names policy knows are the
  // names the families provide, aliases included, with no second list anywhere.
  expect(new Set(builtinToolNames())).toEqual(
    new Set(
      families.flatMap((family) => [
        ...family.tools.map((tool) => tool.name),
        ...Object.keys(family.aliases ?? {}),
      ]),
    ),
  );
});

test("a family packaged outside the framework loads like any other", () => {
  // `@natalia/tool-todo` depends on the tool-authoring surface only. If the host
  // had to special-case it, the packaging shape would not be reusable.
  const registry = new CapabilityRegistry();
  const { tools } = createToolRegistryFromCapabilities({ registry });
  for (const tool of todoToolFamily().tools) {
    expect(tools.has(tool.name)).toBe(true);
    expect(registry.ownerOf("tools", tool.name)).toBe("natalia-tool-todo");
  }
  expect(builtinToolFamilies().map((family) => family.id)).toContain("todo");
});

test("each family declares exactly the tools grant", () => {
  for (const family of builtinToolFamilies()) {
    const registration = toolFamilyRegistration(family);
    expect(registration.id).toBe(`natalia-tool-${family.id}`);
    expect(registration.grants).toEqual(["tools"]);
    expect(registration.scope).toBe(family.scope);
  }
});

test("every built-in tool is owned by the family that contributed it", () => {
  const registry = new CapabilityRegistry();
  const { tools, outcome } = createToolRegistryFromCapabilities({ registry });
  expect(outcome.failed).toEqual([]);
  for (const family of builtinToolFamilies())
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
  createToolRegistryFromCapabilities({ registry });
  const todo = builtinToolFamilies().find((family) => family.id === "todo")!;
  expect(registry.unload(toolFamilyCapabilityID("todo"))).toBe(true);
  for (const tool of todo.tools)
    expect(registry.ownerOf("tools", tool.name)).toBeUndefined();
  // Other families are untouched — unload releases one family's contributions,
  // not the catalogue.
  expect(registry.ownerOf("tools", "read_file")).toBe(
    toolFamilyCapabilityID("fs"),
  );
});

test("terminal aliases survive the kernel round trip", () => {
  const registry = new CapabilityRegistry();
  const { tools } = createToolRegistryFromCapabilities({ registry });
  // The alias resolves to the same tool the family contributed, so the shorter
  // name a model may use is not silently missing after the move to the kernel.
  expect(tools.get("interactive_start")).toBe(
    tools.get("interactive_terminal_start"),
  );
});

test("a family that fails to load leaves none of its tools callable", () => {
  const registry = new CapabilityRegistry();
  const broken = builtinToolFamilies().map((family) =>
    family.id === "todo"
      ? {
          ...family,
          tools: [...family.tools, { ...family.tools[0]!, name: "" }],
        }
      : family,
  );
  const { tools, outcome } = createToolRegistryFromCapabilities({
    registry,
    families: broken,
  });
  expect(outcome.failed.map((entry) => entry.id)).toEqual([
    toolFamilyCapabilityID("todo"),
  ]);
  // Activation rolled back, so the family is absent rather than half-present:
  // the tools it had already contributed before the bad one are gone too.
  const todo = builtinToolFamilies().find((family) => family.id === "todo")!;
  for (const tool of todo.tools) expect(tools.has(tool.name)).toBe(false);
  expect(tools.has("read_file")).toBe(true);
});

test("registering the same families twice is refused, not silently doubled", () => {
  const registry = new CapabilityRegistry();
  const families = builtinToolFamilies();
  expect(registerToolFamilyCapabilities(registry, families).failed).toEqual([]);
  const second = registerToolFamilyCapabilities(registry, families);
  expect(second.loaded).toEqual([]);
  expect(second.failed.length).toBe(families.length);
  for (const failure of second.failed)
    expect(failure.reason).toMatch(/already loaded/u);
});
