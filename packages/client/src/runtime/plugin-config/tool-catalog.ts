import { createAgentPlugin, AGENT_PLUGIN_ID } from "@natalia/plugin-tool-agent";
import { ASK_PLUGIN_ID, createAskPlugin } from "@natalia/plugin-tool-ask";
import {
  createFsReadPlugin,
  FS_READ_PLUGIN_ID,
} from "@natalia/plugin-tool-fs-read";
import {
  createFsWritePlugin,
  FS_WRITE_PLUGIN_ID,
} from "@natalia/plugin-tool-fs-write";
import { createPdfPlugin, PDF_PLUGIN_ID } from "@natalia/plugin-tool-pdf";
import {
  createProcessPlugin,
  PROCESS_PLUGIN_ID,
} from "@natalia/plugin-tool-process";
import {
  createSandboxPlugin,
  SANDBOX_PLUGIN_ID,
} from "@natalia/plugin-tool-sandbox";
import {
  createSearchPlugin,
  SEARCH_PLUGIN_ID,
} from "@natalia/plugin-tool-search";
import { createShellPlugin, SHELL_PLUGIN_ID } from "@natalia/plugin-tool-shell";
import {
  createTerminalPlugin,
  TERMINAL_PLUGIN_ID,
} from "@natalia/plugin-tool-terminal";
import { createTodoPlugin, TODO_PLUGIN_ID } from "@natalia/plugin-tool-todo";
import { createWebPlugin, WEB_PLUGIN_ID } from "@natalia/plugin-tool-web";
import type { Plugin, PluginManifest } from "@natalia/plugin";

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

export type ToolPluginEntry = {
  id: string;
  enabled: boolean;
  manifest: PluginManifest;
  create(): Plugin;
};

function toolManifest(
  apiVersion: 2,
  id: string,
  name: string,
  description: string,
  entry: string,
  scope: "session" | "workspace",
  provides: string[],
  integrationPoints: Array<"tools" | "services">,
): PluginManifest {
  return {
    apiVersion,
    id,
    version: "1.0.0",
    name,
    description,
    entry,
    scope,
    provides,
    requires: [],
    optionalRequires: [],
    conflicts: [],
    dependencies: [],
    hooks: {},
    integrationPoints,
  };
}

export const TOOL_PLUGIN_MANIFESTS = {
  [ASK_PLUGIN_ID]: toolManifest(
    2,
    ASK_PLUGIN_ID,
    "Interactive Question Tools",
    "Asking the user a structured question.",
    "natalia:tool-ask",
    "session",
    [],
    ["tools"],
  ),
  [TODO_PLUGIN_ID]: toolManifest(
    2,
    TODO_PLUGIN_ID,
    "Todo Tools",
    "The session's task list.",
    "natalia:tool-todo",
    "session",
    [],
    ["tools"],
  ),
  [SEARCH_PLUGIN_ID]: toolManifest(
    2,
    SEARCH_PLUGIN_ID,
    "Search Tools",
    "Finding files by name and content in the workspace.",
    "natalia:tool-search",
    "workspace",
    [],
    ["tools"],
  ),
  [FS_READ_PLUGIN_ID]: toolManifest(
    2,
    FS_READ_PLUGIN_ID,
    "Filesystem Read Tools",
    "Reading workspace files and media metadata.",
    "natalia:tool-fs-read",
    "workspace",
    [],
    ["tools"],
  ),
  [FS_WRITE_PLUGIN_ID]: toolManifest(
    2,
    FS_WRITE_PLUGIN_ID,
    "Filesystem Write Tools",
    "Writing and editing workspace files.",
    "natalia:tool-fs-write",
    "workspace",
    [],
    ["tools"],
  ),
  [WEB_PLUGIN_ID]: toolManifest(
    2,
    WEB_PLUGIN_ID,
    "Web Tools",
    "Fetching and searching the web.",
    "natalia:tool-web",
    "session",
    [],
    ["tools"],
  ),
  [SHELL_PLUGIN_ID]: toolManifest(
    2,
    SHELL_PLUGIN_ID,
    "Shell Tools",
    "One-shot command execution.",
    "natalia:tool-shell",
    "session",
    [],
    ["tools"],
  ),
  [AGENT_PLUGIN_ID]: toolManifest(
    2,
    AGENT_PLUGIN_ID,
    "Subagent Tools",
    "Delegating work to a subagent.",
    "natalia:tool-agent",
    "session",
    [],
    ["tools"],
  ),
  [TERMINAL_PLUGIN_ID]: toolManifest(
    2,
    TERMINAL_PLUGIN_ID,
    "Terminal Tools",
    "Native terminal panes and interactive programs.",
    "natalia:tool-terminal",
    "session",
    [],
    ["tools"],
  ),
  [SANDBOX_PLUGIN_ID]: toolManifest(
    2,
    SANDBOX_PLUGIN_ID,
    "Sandbox Tools",
    "Isolated workspaces and their merge back.",
    "natalia:tool-sandbox",
    "workspace",
    [],
    ["tools"],
  ),
  [PROCESS_PLUGIN_ID]: toolManifest(
    2,
    PROCESS_PLUGIN_ID,
    "Managed Process Tools",
    "Long-running background processes.",
    "natalia:tool-process",
    "session",
    ["managedProcessRegistry"],
    ["tools", "services"],
  ),
} satisfies Record<string, PluginManifest>;

export const PDF_PLUGIN_MANIFEST: PluginManifest = {
  apiVersion: 1,
  id: PDF_PLUGIN_ID,
  version: "1.0.0",
  name: "PDF Tools",
  description: "PDF text extraction and multimodal document reading.",
  entry: "natalia:tool-pdf",
  capabilities: ["tools"],
  scope: "workspace",
  provides: [],
  requires: [],
};

export function toolPluginCatalog(input: {
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
}): ToolPluginEntry[] {
  return [
    {
      id: ASK_PLUGIN_ID,
      enabled: input.askEnabled,
      manifest: TOOL_PLUGIN_MANIFESTS[ASK_PLUGIN_ID],
      create: () => createAskPlugin(),
    },
    {
      id: TODO_PLUGIN_ID,
      enabled: input.todoEnabled,
      manifest: TOOL_PLUGIN_MANIFESTS[TODO_PLUGIN_ID],
      create: () => createTodoPlugin(),
    },
    {
      id: SEARCH_PLUGIN_ID,
      enabled: input.searchEnabled,
      manifest: TOOL_PLUGIN_MANIFESTS[SEARCH_PLUGIN_ID],
      create: () => createSearchPlugin(),
    },
    {
      id: FS_READ_PLUGIN_ID,
      enabled: input.fsReadEnabled,
      manifest: TOOL_PLUGIN_MANIFESTS[FS_READ_PLUGIN_ID],
      create: () => createFsReadPlugin(),
    },
    {
      id: FS_WRITE_PLUGIN_ID,
      enabled: input.fsWriteEnabled,
      manifest: TOOL_PLUGIN_MANIFESTS[FS_WRITE_PLUGIN_ID],
      create: () => createFsWritePlugin(),
    },
    {
      id: WEB_PLUGIN_ID,
      enabled: input.webEnabled,
      manifest: TOOL_PLUGIN_MANIFESTS[WEB_PLUGIN_ID],
      create: () => createWebPlugin(),
    },
    {
      id: SHELL_PLUGIN_ID,
      enabled: input.shellEnabled,
      manifest: TOOL_PLUGIN_MANIFESTS[SHELL_PLUGIN_ID],
      create: () => createShellPlugin(),
    },
    {
      id: AGENT_PLUGIN_ID,
      enabled: input.agentEnabled,
      manifest: TOOL_PLUGIN_MANIFESTS[AGENT_PLUGIN_ID],
      create: () => createAgentPlugin(),
    },
    {
      id: TERMINAL_PLUGIN_ID,
      enabled: input.terminalEnabled,
      manifest: TOOL_PLUGIN_MANIFESTS[TERMINAL_PLUGIN_ID],
      create: () => createTerminalPlugin(),
    },
    {
      id: SANDBOX_PLUGIN_ID,
      enabled: input.sandboxEnabled,
      manifest: TOOL_PLUGIN_MANIFESTS[SANDBOX_PLUGIN_ID],
      create: () => createSandboxPlugin(),
    },
    {
      id: PROCESS_PLUGIN_ID,
      enabled: input.processEnabled,
      manifest: TOOL_PLUGIN_MANIFESTS[PROCESS_PLUGIN_ID],
      create: () => createProcessPlugin(),
    },
  ];
}

export function pdfPluginEntry(enabled: boolean): ToolPluginEntry {
  return {
    id: PDF_PLUGIN_ID,
    enabled,
    manifest: PDF_PLUGIN_MANIFEST,
    create: () => createPdfPlugin(),
  };
}
