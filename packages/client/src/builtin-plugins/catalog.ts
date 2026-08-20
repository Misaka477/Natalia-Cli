import { createPdfPlugin, PDF_PLUGIN_ID } from "@natalia/tool-pdf";
import { ASK_PLUGIN_ID, createAskPlugin } from "@natalia/tool-ask";
import type { Plugin } from "@natalia/plugin";
import type { Skill } from "@natalia/skills";
import type { ToolExecutionContext } from "@natalia/tools";
import {
  createSkillsPlugin,
  SKILLS_PLUGIN_ID,
  SKILLS_REGISTRY_SERVICE,
} from "./skills-plugin";

export {
  ASK_PLUGIN_ID,
  PDF_PLUGIN_ID,
  SKILLS_PLUGIN_ID,
  SKILLS_REGISTRY_SERVICE,
};

export type BuiltinPluginEntry = {
  id: string;
  enabled: boolean;
  create(): Plugin;
};

export function builtinPluginCatalog(input: {
  askEnabled: boolean;
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
      id: ASK_PLUGIN_ID,
      enabled: input.askEnabled,
      create: () => createAskPlugin(),
    },
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
