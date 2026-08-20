import { createPdfPlugin, PDF_PLUGIN_ID } from "@natalia/tool-pdf";
import { ASK_PLUGIN_ID, createAskPlugin } from "@natalia/tool-ask";
import { createTodoPlugin, TODO_PLUGIN_ID } from "@natalia/tool-todo";
import { createSearchPlugin, SEARCH_PLUGIN_ID } from "@natalia/tool-search";
import { createFsReadPlugin, FS_READ_PLUGIN_ID } from "@natalia/tool-fs-read";
import {
  createFsWritePlugin,
  FS_WRITE_PLUGIN_ID,
} from "@natalia/tool-fs-write";
import { createWebPlugin, WEB_PLUGIN_ID } from "@natalia/tool-web";
import { createShellPlugin, SHELL_PLUGIN_ID } from "@natalia/tool-shell";
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
  FS_READ_PLUGIN_ID,
  FS_WRITE_PLUGIN_ID,
  PDF_PLUGIN_ID,
  SEARCH_PLUGIN_ID,
  SHELL_PLUGIN_ID,
  SKILLS_PLUGIN_ID,
  SKILLS_REGISTRY_SERVICE,
  TODO_PLUGIN_ID,
  WEB_PLUGIN_ID,
};

export type BuiltinPluginEntry = {
  id: string;
  enabled: boolean;
  create(): Plugin;
};

export function builtinPluginCatalog(input: {
  askEnabled: boolean;
  fsReadEnabled: boolean;
  fsWriteEnabled: boolean;
  pdfEnabled: boolean;
  searchEnabled: boolean;
  shellEnabled: boolean;
  todoEnabled: boolean;
  webEnabled: boolean;
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
      id: TODO_PLUGIN_ID,
      enabled: input.todoEnabled,
      create: () => createTodoPlugin(),
    },
    {
      id: SEARCH_PLUGIN_ID,
      enabled: input.searchEnabled,
      create: () => createSearchPlugin(),
    },
    {
      id: FS_READ_PLUGIN_ID,
      enabled: input.fsReadEnabled,
      create: () => createFsReadPlugin(),
    },
    {
      id: FS_WRITE_PLUGIN_ID,
      enabled: input.fsWriteEnabled,
      create: () => createFsWritePlugin(),
    },
    {
      id: WEB_PLUGIN_ID,
      enabled: input.webEnabled,
      create: () => createWebPlugin(),
    },
    {
      id: SHELL_PLUGIN_ID,
      enabled: input.shellEnabled,
      create: () => createShellPlugin(),
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
