export {
  createSkillsPlugin,
  SKILLS_PLUGIN_ID,
  SKILLS_PLUGIN_MANIFEST,
} from "./skills-plugin";
export {
  authorizeSkillTool,
  createSkillLoadTool,
  discoverSkills,
  readSkillResource,
  runSkillScript,
  type Skill,
  type SkillRegistry,
} from "./skills";
import type { SessionID } from "@natalia/contracts";
import type { Plugin, PluginAPI } from "@natalia/plugin";
import type { ToolExecutionContext } from "@natalia/tools";
import { createSkillsPlugin, SKILLS_PLUGIN_MANIFEST } from "./skills-plugin";
import type { Skill } from "./skills";

export const SKILLS_INPUT_SERVICE = "skills.input";
export type SkillsRuntimeInput = {
  workspaceRoot: string;
  userRoot?: string;
  remoteURLs?: string[];
  onLoad?: (
    skill: Skill,
    output: string,
    context: ToolExecutionContext,
  ) => void;
  commandSession?: {
    active(sessionID: SessionID): Skill | undefined;
    activate(sessionID: SessionID, skill: Skill): void;
  };
};

export default function skillsPlugin(): Plugin {
  let instance: Plugin | undefined;
  return {
    manifest: {
      ...SKILLS_PLUGIN_MANIFEST,
      entry: "index.js",
      requires: [SKILLS_INPUT_SERVICE],
    },
    async setup(api: PluginAPI) {
      const input = api.services.get<SkillsRuntimeInput>(SKILLS_INPUT_SERVICE);
      if (!input)
        throw new Error(`missing runtime service: ${SKILLS_INPUT_SERVICE}`);
      instance = createSkillsPlugin(input);
      await instance.setup(api);
    },
    async dispose() {
      await instance?.dispose?.();
      instance = undefined;
    },
  };
}
