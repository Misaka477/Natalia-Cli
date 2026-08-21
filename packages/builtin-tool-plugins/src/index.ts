import { createAgentPlugin, AGENT_PLUGIN_ID } from "@natalia/tool-agent";
import { ASK_PLUGIN_ID, createAskPlugin } from "@natalia/tool-ask";
import { createFsReadPlugin, FS_READ_PLUGIN_ID } from "@natalia/tool-fs-read";
import {
  createFsWritePlugin,
  FS_WRITE_PLUGIN_ID,
} from "@natalia/tool-fs-write";
import { createPdfPlugin, PDF_PLUGIN_ID } from "@natalia/tool-pdf";
import { createProcessPlugin, PROCESS_PLUGIN_ID } from "@natalia/tool-process";
import { createSandboxPlugin, SANDBOX_PLUGIN_ID } from "@natalia/tool-sandbox";
import { createSearchPlugin, SEARCH_PLUGIN_ID } from "@natalia/tool-search";
import { createShellPlugin, SHELL_PLUGIN_ID } from "@natalia/tool-shell";
import {
  createTerminalPlugin,
  TERMINAL_PLUGIN_ID,
} from "@natalia/tool-terminal";
import { createTodoPlugin, TODO_PLUGIN_ID } from "@natalia/tool-todo";
import { createWebPlugin, WEB_PLUGIN_ID } from "@natalia/tool-web";
import type { Plugin } from "@natalia/plugin";

export {
  AGENT_PLUGIN_ID,
  ASK_PLUGIN_ID,
  FS_READ_PLUGIN_ID,
  FS_WRITE_PLUGIN_ID,
  PDF_PLUGIN_ID,
  PROCESS_PLUGIN_ID,
  SANDBOX_PLUGIN_ID,
  SEARCH_PLUGIN_ID,
  SHELL_PLUGIN_ID,
  TERMINAL_PLUGIN_ID,
  TODO_PLUGIN_ID,
  WEB_PLUGIN_ID,
};

export type BuiltinToolPluginEntry = {
  id: string;
  enabled: boolean;
  create(): Plugin;
};

export function builtinToolPluginCatalog(input: {
  agentEnabled: boolean;
  askEnabled: boolean;
  fsReadEnabled: boolean;
  fsWriteEnabled: boolean;
  processEnabled: boolean;
  sandboxEnabled: boolean;
  searchEnabled: boolean;
  shellEnabled: boolean;
  terminalEnabled: boolean;
  todoEnabled: boolean;
  webEnabled: boolean;
}): BuiltinToolPluginEntry[] {
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
      id: AGENT_PLUGIN_ID,
      enabled: input.agentEnabled,
      create: () => createAgentPlugin(),
    },
    {
      id: TERMINAL_PLUGIN_ID,
      enabled: input.terminalEnabled,
      create: () => createTerminalPlugin(),
    },
    {
      id: SANDBOX_PLUGIN_ID,
      enabled: input.sandboxEnabled,
      create: () => createSandboxPlugin(),
    },
    {
      id: PROCESS_PLUGIN_ID,
      enabled: input.processEnabled,
      create: () => createProcessPlugin(),
    },
  ];
}

export function builtinPdfPluginEntry(
  enabled: boolean,
): BuiltinToolPluginEntry {
  return {
    id: PDF_PLUGIN_ID,
    enabled,
    create: () => createPdfPlugin(),
  };
}
