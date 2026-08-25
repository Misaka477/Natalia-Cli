import { expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CapabilityRegistry } from "@natalia/capability";
import { createToolRegistry } from "@natalia/tools";
import {
  skillsPluginEntry,
  SKILLS_PLUGIN_ID,
} from "../src/runtime/plugin-config";
import { SKILL_SERVICE, type SkillService } from "@natalia/runtime-services";
import { createPluginsController } from "../src/plugins-controller";
import type { Plugin } from "@natalia/plugin";

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
    publish: () => undefined,
  });
  return { capabilityRegistry, tools, controller };
}

test("skills uses the same plugin activation path and owns its service and tool", async () => {
  const root = await skillWorkspace();
  const { capabilityRegistry, tools, controller } = host(root);
  controller.init();
  await controller.reconcileDesired(
    [skillsPluginEntry({ workspaceRoot: root })],
    {},
  );

  expect(capabilityRegistry.ownerOf("services", SKILL_SERVICE)).toBe(
    SKILLS_PLUGIN_ID,
  );
  expect(capabilityRegistry.ownerOf("tools", "skill_load")).toBe(
    SKILLS_PLUGIN_ID,
  );
  expect(
    capabilityRegistry
      .service<SkillService>(SKILL_SERVICE)
      ?.list()
      .map((skill) => skill.qualifiedName),
  ).toContain("project:review");
  expect(tools.has("skill_load")).toBe(true);
  expect(controller.list().map((plugin) => plugin.id)).toEqual([
    SKILLS_PLUGIN_ID,
  ]);

  await controller.close();
  expect(capabilityRegistry.has(SKILLS_PLUGIN_ID)).toBe(false);
  expect(capabilityRegistry.service(SKILL_SERVICE)).toBeUndefined();
  expect(tools.has("skill_load")).toBe(false);
});

test("failed default setup rolls back its capability", async () => {
  const root = await skillWorkspace();
  const { capabilityRegistry, controller } = host(root);
  controller.init();
  const broken: Plugin = {
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
  };
  await expect(
    controller.reconcileDesired(
      [
        {
          id: broken.manifest.id,
          enabled: true,
          fingerprint: "broken",
          manifest: broken.manifest,
          load: async () => broken,
        },
      ],
      {},
    ),
  ).rejects.toThrow("broken setup");
  expect(capabilityRegistry.has("natalia-broken")).toBe(false);
});
