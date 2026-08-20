import { expect, test } from "bun:test";
import { CapabilityRegistry } from "@natalia/capability";
import {
  applyToolFamilyEnabledFilter,
  builtinToolFamilies,
  builtinToolNames,
  createToolRegistryFromCapabilities,
  registerToolFamilyCapabilities,
  toolFamilyCapabilityID,
  toolFamilyRegistration,
} from "../src/capabilities/tool-family-capabilities";
import type { ToolFamily } from "@natalia/tools";

// The built-in tools are capabilities now, so they must be assemblable without a
// runtime. If any of this needed a real client, nothing would have been decoupled.

test("the host composes the built-in catalogue from families", () => {
  const families = builtinToolFamilies();
  // After the plugin migrations, `process` is the last static family; the rest
  // load through the built-in plugin catalog.
  expect(families.length).toBe(1);
  for (const family of families) {
    expect(family.tools.length).toBeGreaterThan(0);
    expect(family.scope).toBeString();
  }
  const staticNames = families.flatMap((family) => [
    ...family.tools.map((tool) => tool.name),
    ...Object.keys(family.aliases ?? {}),
  ]);
  expect(staticNames).not.toContain("ask_user");
  expect(staticNames).not.toContain("todo_read");
  expect(staticNames).not.toContain("glob");
  expect(staticNames).not.toContain("read_file");
  expect(builtinToolNames()).toEqual(expect.arrayContaining(staticNames));
  expect(builtinToolNames()).toContain("ask_user");
  expect(builtinToolNames()).toEqual(
    expect.arrayContaining(["plan", "todo_read", "todo_write"]),
  );
  expect(builtinToolNames()).toEqual(expect.arrayContaining(["glob", "grep"]));
  expect(builtinToolNames()).toEqual(
    expect.arrayContaining(["read_file", "write_file", "edit_file"]),
  );
  expect(builtinToolNames()).toContain("apply_patch");
  expect(builtinToolNames({ ask: false })).not.toContain("ask_user");
  expect(builtinToolNames({ todo: false })).not.toContain("todo_read");
  expect(builtinToolNames({ search: false })).not.toContain("glob");
  expect(builtinToolNames({ fs: false })).not.toContain("read_file");
  expect(builtinToolNames({ fs: false })).not.toContain("write_file");
  expect(builtinToolNames({ "fs-read": false })).not.toContain("read_file");
  expect(builtinToolNames({ "fs-read": false })).toContain("write_file");
  expect(builtinToolNames({ "fs-write": false })).not.toContain("apply_patch");
  expect(builtinToolNames({ "fs-write": false })).toContain("read_file");
  expect(staticNames).not.toContain("web_fetch");
  expect(builtinToolNames()).toContain("web_fetch");
  expect(builtinToolNames({ web: false })).not.toContain("web_search");
  expect(staticNames).not.toContain("run_shell");
  expect(builtinToolNames()).toContain("run_shell");
  expect(builtinToolNames({ shell: false })).not.toContain("run_shell");
  expect(staticNames).not.toContain("agent_spawn");
  expect(builtinToolNames()).toContain("agent_spawn");
  expect(builtinToolNames({ agent: false })).not.toContain("agent_retry");
  expect(staticNames).not.toContain("interactive_terminal_start");
  expect(builtinToolNames()).toContain("interactive_terminal_start");
  expect(builtinToolNames()).toContain("interactive_start");
  expect(builtinToolNames({ terminal: false })).not.toContain(
    "terminal_observe",
  );
  expect(staticNames).not.toContain("sandbox_create");
  expect(builtinToolNames()).toContain("sandbox_create");
  expect(builtinToolNames({ sandbox: false })).not.toContain("sandbox_merge");
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
  const process = builtinToolFamilies().find(
    (family) => family.id === "process",
  )!;
  expect(registry.unload(toolFamilyCapabilityID("process"))).toBe(true);
  for (const tool of process.tools)
    expect(registry.ownerOf("tools", tool.name)).toBeUndefined();
  expect(registry.has(toolFamilyCapabilityID("process"))).toBe(false);
});

test("a family that fails to load leaves none of its tools callable", () => {
  const registry = new CapabilityRegistry();
  const broken = builtinToolFamilies().map((family) =>
    family.id === "process"
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
    toolFamilyCapabilityID("process"),
  ]);
  // Activation rolled back, so the family is absent rather than half-present:
  // the tools it had already contributed before the bad one are gone too.
  const process = builtinToolFamilies().find(
    (family) => family.id === "process",
  )!;
  for (const tool of process.tools) expect(tools.has(tool.name)).toBe(false);
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

test("config enabled=false keeps a static family out of the registry entirely", () => {
  const registry = new CapabilityRegistry();
  const { tools } = createToolRegistryFromCapabilities({
    registry,
    enabled: { process: false },
  });
  const process = builtinToolFamilies().find(
    (family) => family.id === "process",
  )!;
  for (const tool of process.tools) expect(tools.has(tool.name)).toBe(false);
  expect(registry.has(toolFamilyCapabilityID("process"))).toBe(false);
});

test("applyToolFamilyEnabledFilter removes a disabled family after assembly", () => {
  const registry = new CapabilityRegistry();
  const { tools } = createToolRegistryFromCapabilities({ registry });
  expect(tools.has("process_start")).toBe(true);
  const cascaded = applyToolFamilyEnabledFilter({
    tools,
    registry,
    families: builtinToolFamilies(),
    enabled: { process: false },
  });
  expect(cascaded).toEqual([]);
  const process = builtinToolFamilies().find(
    (family) => family.id === "process",
  )!;
  for (const tool of process.tools) expect(tools.has(tool.name)).toBe(false);
  expect(registry.has(toolFamilyCapabilityID("process"))).toBe(false);
});

test("a family that depends on a disabled one is cascade-disabled with a reason", () => {
  const registry = new CapabilityRegistry();
  const dependent: ToolFamily = {
    id: "dependent",
    name: "Dependent",
    version: "1.0.0",
    description: "Depends on the base family.",
    scope: "session",
    dependencies: ["base"],
    tools: [
      {
        name: "dependent_run",
        description: "Run",
        requiresApproval: false,
        parameters: { type: "object", properties: {} },
        async execute() {
          return "ok";
        },
      },
    ],
  };
  const base: ToolFamily = {
    id: "base",
    name: "Base",
    version: "1.0.0",
    description: "The dependency.",
    scope: "session",
    tools: [
      {
        name: "base_run",
        description: "Run",
        requiresApproval: false,
        parameters: { type: "object", properties: {} },
        async execute() {
          return "ok";
        },
      },
    ],
  };
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
    id: "later",
    name: "Later",
    version: "1.0.0",
    description: "Depends on the earlier family.",
    scope: "session",
    dependencies: ["earlier"],
    tools: [
      {
        name: "later_run",
        description: "Run",
        requiresApproval: false,
        parameters: { type: "object", properties: {} },
        async execute() {
          return "ok";
        },
      },
    ],
  };
  const earlier: ToolFamily = {
    id: "earlier",
    name: "Earlier",
    version: "1.0.0",
    description: "The dependency.",
    scope: "session",
    tools: [
      {
        name: "earlier_run",
        description: "Run",
        requiresApproval: false,
        parameters: { type: "object", properties: {} },
        async execute() {
          return "ok";
        },
      },
    ],
  };
  // Dependent listed first on purpose: ordering must fix it, not the caller.
  const outcome = registerToolFamilyCapabilities(registry, [
    dependent,
    earlier,
  ]);
  expect(outcome.failed).toEqual([]);
  expect(registry.has(toolFamilyCapabilityID("later"))).toBe(true);
  expect(registry.has(toolFamilyCapabilityID("earlier"))).toBe(true);
});
