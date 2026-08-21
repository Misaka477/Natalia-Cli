/**
 * Built-in plugin feature gates.
 *
 * These are the config-derived booleans the runtime feeds into the plugin
 * catalog to decide which built-in plugins are mounted. They are pure: nothing
 * but the resolved config, whether the caller supplied a custom tool registry,
 * and the permission-profile extension gates. Keeping them in one named
 * function makes the catalog assembly free of ~fifty lines of boolean
 * provenance and lets the gate logic be tested on its own.
 */
import type { ConfigV3 } from "@natalia/contracts";
import {
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
} from "./builtin-plugins/catalog";

export type BuiltinFeatureGates = {
  askEnabled: boolean;
  todoEnabled: boolean;
  searchEnabled: boolean;
  fsReadEnabled: boolean;
  fsWriteEnabled: boolean;
  webEnabled: boolean;
  shellEnabled: boolean;
  agentEnabled: boolean;
  terminalEnabled: boolean;
  sandboxEnabled: boolean;
  processEnabled: boolean;
  pdfEnabled: boolean;
};

export function computeBuiltinFeatureGates(input: {
  config: ConfigV3 | undefined;
  hasCustomTools: boolean;
  extensionEnabled(name: "skills" | "mcp" | "plugins"): boolean;
}): BuiltinFeatureGates {
  const { config, hasCustomTools, extensionEnabled } = input;
  // A caller-supplied tool registry replaces the built-in families entirely.
  const builtins = !hasCustomTools;
  const tool = (name: keyof NonNullable<ConfigV3["tools"]["enabled"]>) =>
    builtins && config?.tools?.enabled?.[name] !== false;
  const plugin = (id: string) => config?.plugins?.enabled?.[id] !== false;

  return {
    askEnabled: tool("ask") && plugin(ASK_PLUGIN_ID),
    todoEnabled: tool("todo") && plugin(TODO_PLUGIN_ID),
    searchEnabled: tool("search") && plugin(SEARCH_PLUGIN_ID),
    fsReadEnabled: tool("fs") && plugin(FS_READ_PLUGIN_ID),
    fsWriteEnabled: tool("fs") && plugin(FS_WRITE_PLUGIN_ID),
    webEnabled: tool("web") && plugin(WEB_PLUGIN_ID),
    shellEnabled: tool("shell") && plugin(SHELL_PLUGIN_ID),
    agentEnabled: tool("agent") && plugin(AGENT_PLUGIN_ID),
    terminalEnabled: tool("terminal") && plugin(TERMINAL_PLUGIN_ID),
    sandboxEnabled: tool("sandbox") && plugin(SANDBOX_PLUGIN_ID),
    processEnabled: tool("process") && plugin(PROCESS_PLUGIN_ID),
    pdfEnabled: extensionEnabled("plugins") && plugin(PDF_PLUGIN_ID),
  };
}
