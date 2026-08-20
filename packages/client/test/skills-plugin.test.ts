import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CapabilityRegistry } from "@natalia/capability";
import { createToolRegistry } from "@natalia/tools";
import type { SkillRegistry } from "@natalia/skills";
import {
  createSkillsPlugin,
  SKILLS_PLUGIN_ID,
  SKILLS_REGISTRY_SERVICE,
} from "../src/builtin-plugins/skills-plugin";
import { createPluginsController } from "../src/plugins-controller";

async function skillWorkspace() {
  const root = await mkdtemp(join(tmpdir(), "natalia-skills-plugin-"));
  await mkdir(join(root, ".natalia", "skills", "review"), {
    recursive: true,
  });
  await writeFile(
    join(root, ".natalia", "skills", "review", "SKILL.md"),
    "---\nname: review\ndescription: Review guidance\n---\nBody",
  );
  return root;
}

function host(workspaceRoot: string) {
  const capabilityRegistry = new CapabilityRegistry();
  const tools = createToolRegistry([]);
  const controller = createPluginsController({
    workspaceRoot,
    tools,
    capabilityRegistry,
    pluginPaths: () => [],
    pluginEnabled: () => undefined,
    pluginCapabilities: () => undefined,
    pluginReadOnly: () => undefined,
    pluginSettings: () => undefined,
    publish: () => undefined,
    syncGlobalCommands: () => undefined,
  });
  return { capabilityRegistry, tools, controller };
}

test("skills uses the same plugin activation path and owns its service and tool", async () => {
  const root = await skillWorkspace();
  const { capabilityRegistry, tools, controller } = host(root);
  await controller.init({ loadLocal: false });
  await controller.loadBuiltin(createSkillsPlugin({ workspaceRoot: root }));

  expect(capabilityRegistry.ownerOf("services", SKILLS_REGISTRY_SERVICE)).toBe(
    SKILLS_PLUGIN_ID,
  );
  expect(capabilityRegistry.ownerOf("tools", "skill_load")).toBe(
    SKILLS_PLUGIN_ID,
  );
  expect(
    capabilityRegistry
      .service<SkillRegistry>(SKILLS_REGISTRY_SERVICE)
      ?.list()
      .map((skill) => skill.qualifiedName),
  ).toContain("project:review");
  expect(tools.has("skill_load")).toBe(true);
  expect(controller.list()).toEqual([]);

  await controller.close();
  expect(capabilityRegistry.has(SKILLS_PLUGIN_ID)).toBe(false);
  expect(capabilityRegistry.service(SKILLS_REGISTRY_SERVICE)).toBeUndefined();
  expect(tools.has("skill_load")).toBe(false);
});

test("failed built-in setup rolls back its capability", async () => {
  const root = await skillWorkspace();
  const { capabilityRegistry, controller } = host(root);
  await controller.init({ loadLocal: false });
  await expect(
    controller.loadBuiltin({
      manifest: {
        apiVersion: 1,
        id: "natalia-broken",
        version: "1.0.0",
        name: "Broken",
        description: "",
        entry: "natalia:broken",
        capabilities: ["tools"],
        scope: "workspace",
        provides: [],
        requires: [],
      },
      setup() {
        throw new Error("broken setup");
      },
    }),
  ).rejects.toThrow("broken setup");
  expect(capabilityRegistry.has("natalia-broken")).toBe(false);
});
