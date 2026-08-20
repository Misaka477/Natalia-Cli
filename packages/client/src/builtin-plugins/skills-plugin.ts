import type { Plugin } from "@natalia/plugin";
import {
  createSkillLoadTool,
  discoverSkills,
  type Skill,
} from "@natalia/skills";
import type { ToolExecutionContext } from "@natalia/tools";

export const SKILLS_PLUGIN_ID = "natalia-skills";
export const SKILLS_REGISTRY_SERVICE = "skills.registry";

export function createSkillsPlugin(input: {
  workspaceRoot: string;
  userRoot?: string;
  remoteURLs?: string[];
  onLoad?: (
    skill: Skill,
    output: string,
    context: ToolExecutionContext,
  ) => void;
}): Plugin {
  return {
    manifest: {
      apiVersion: 1,
      id: SKILLS_PLUGIN_ID,
      version: "1.0.0",
      name: "Skills",
      description: "Discovered project, user and remote skills.",
      entry: "natalia:skills",
      capabilities: ["tools"],
      scope: "workspace",
      provides: [SKILLS_REGISTRY_SERVICE],
      requires: [],
    },
    async setup(api) {
      const skills = await discoverSkills({
        workspaceRoot: input.workspaceRoot,
        ...(input.userRoot ? { userRoot: input.userRoot } : {}),
        ...(input.remoteURLs ? { remoteURLs: input.remoteURLs } : {}),
      });
      api.services.provide(SKILLS_REGISTRY_SERVICE, skills);
      api.tools.register(
        createSkillLoadTool({ registry: () => skills, onLoad: input.onLoad }),
      );
    },
  };
}
