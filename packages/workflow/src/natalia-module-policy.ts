import type { NataliaFlowDocument } from "@natalia/contracts";

export type NataliaFlowModuleType =
  NataliaFlowDocument["modules"][number]["type"];

export type NataliaModuleToolPolicy = {
  allow: string[];
};

const MODULE_TOOL_ALLOWLISTS: Record<NataliaFlowModuleType, string[]> = {
  read_search: [
    "read_file",
    "glob",
    "grep",
    "read_media_file",
    "read_data_source",
  ],
  terminal: ["interactive_terminal_*", "terminal_observe"],
  shell_command: ["run_shell"],
  workspace_changes: ["read_file", "glob", "grep", "write_file", "edit_file"],
  web_fetch: ["web_fetch", "web_search", "browser_visit", "browser_screenshot"],
  skills: ["skill_load"],
  mcp: ["mcp_*"],
  plugins: ["plugin_*"],
  subagents: ["agent_*"],
  report_output: ["report_issue"],
};

export function moduleToolPolicy(
  type: NataliaFlowModuleType,
): NataliaModuleToolPolicy {
  return {
    allow: ["flow_module_complete", ...MODULE_TOOL_ALLOWLISTS[type]],
  };
}

/**
 * Tools whose success is the only mechanically checkable proof that a stage of
 * this type produced what the stage exists to produce. Only `report_output`
 * qualifies today: "the finding left this machine" is decidable from a tool
 * record, whereas "the required terminal check reached a terminal state" is a
 * condition the user declares, and the platform does not guess at it. An empty
 * list means the generic "at least one successful tool call" floor is the whole
 * platform floor for that type.
 */
const MODULE_ARTIFACT_TOOLS: Partial<Record<NataliaFlowModuleType, string[]>> =
  {
    report_output: ["report_issue"],
  };

export function moduleArtifactTools(type: NataliaFlowModuleType): string[] {
  return MODULE_ARTIFACT_TOOLS[type] ?? [];
}
