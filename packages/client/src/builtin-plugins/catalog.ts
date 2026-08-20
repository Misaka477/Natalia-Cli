import { createPdfPlugin, PDF_PLUGIN_ID } from "@natalia/tool-pdf";
import type { Plugin } from "@natalia/plugin";
import type { Skill } from "@natalia/skills";
import type { ToolExecutionContext } from "@natalia/tools";
import {
  createSkillsPlugin,
  SKILLS_PLUGIN_ID,
  SKILLS_REGISTRY_SERVICE,
} from "./skills-plugin";

export { PDF_PLUGIN_ID, SKILLS_PLUGIN_ID, SKILLS_REGISTRY_SERVICE };

export type BuiltinPluginEntry = {
  id: string;
  enabled: boolean;
  create(): Plugin;
};

export function builtinPluginCatalog(input: {
  pdfEnabled: boolean;
  skills?: {
    workspaceRoot: string;
    userRoot?: string;
    remoteURLs?: string[];
    onLoad?: (
      skill: Skill,
      output: string,
      context: ToolExecutionContext,
    ) => void;
  };
}): BuiltinPluginEntry[] {
  return [
    {
      id: SKILLS_PLUGIN_ID,
      enabled: input.skills !== undefined,
      create: () => {
        if (!input.skills) throw new Error("skills plugin is disabled");
        return createSkillsPlugin(input.skills);
      },
    },
    {
      id: PDF_PLUGIN_ID,
      enabled: input.pdfEnabled,
      create: () => createPdfPlugin(),
    },
  ];
}
