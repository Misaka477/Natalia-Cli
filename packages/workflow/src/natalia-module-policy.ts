import type { NataliaFlowDocument } from "@natalia/contracts";

export type NataliaFlowModuleType =
  NataliaFlowDocument["modules"][number]["type"];

export type NataliaModuleToolPolicy = {
  allow: string[];
};

const MODULE_TOOL_ALLOWLISTS: Record<NataliaFlowModuleType, string[]> = {
  read_search: ["read_file", "glob", "grep", "read_media_file"],
  terminal: ["interactive_terminal_*", "terminal_observe"],
  shell_command: ["run_shell"],
  workspace_changes: ["read_file", "glob", "grep", "write_file", "edit_file"],
  web_fetch: ["web_fetch", "web_search", "browser_visit", "browser_screenshot"],
  skills: ["skill_load"],
  mcp: ["mcp_*"],
  plugins: ["plugin_*"],
  subagents: ["agent_*"],
  report_output: [],
};

export function moduleToolPolicy(
  type: NataliaFlowModuleType,
): NataliaModuleToolPolicy {
  return {
    allow: ["flow_module_complete", ...MODULE_TOOL_ALLOWLISTS[type]],
  };
}
