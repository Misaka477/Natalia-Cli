/**
 * The built-in tool families, as capabilities.
 *
 * Before this, the framework's 39 tools were a static array pushed straight into
 * the `ToolRegistry`: the kernel did not own them, `tool.registered` reported
 * every one of them as owned by `natalia-runtime`, and nothing could remove a
 * family because nothing had ever contributed it. Here each family from
 * `builtinToolFamilies()` is loaded as one capability that contributes its own
 * tools, so the built-ins are on exactly the same footing as an external plugin:
 *
 *   - the kernel refuses a contribution outside the `tools` grant;
 *   - `ownerOf("tools", name)` names the family that provides a tool;
 *   - unloading a family releases its tools, because the kernel owns them.
 *
 * The runtime still never names a tool: it asks for the families and moves what
 * the kernel accepted into the registry the executor reads.
 */
import type { ToolFamily } from "@natalia/tools";
export {
  createToolRegistryFromCapabilities,
  registerToolFamilyCapabilities,
  toolFamilyCapabilityID,
  toolFamilyRegistration,
  type ToolFamilyLoadOutcome,
} from "./tool-family-registry";

/**
 * The tool families this host loads, in the order their tools are advertised.
 *
 * Every built-in tool family is now a built-in plugin loaded through the plugin
 * catalog; this static assembly intentionally contributes nothing. It remains as
 * the kernel path used when a host passes its own `families`, and as the test
 * surface for family capability semantics.
 */
export function builtinToolFamilies(): ToolFamily[] {
  return [];
}

/** Every built-in tool name, including the aliases a model may use. */
export function builtinToolNames(): string[] {
  const names = builtinToolFamilies().flatMap((family) => [
    ...family.tools.map((tool) => tool.name),
    ...Object.keys(family.aliases ?? {}),
  ]);
  names.push(
    "ask_user",
    "plan",
    "todo_read",
    "todo_write",
    "glob",
    "grep",
    "read_file",
    "read_media_file",
    "image_read",
    "write_file",
    "edit_file",
    "apply_patch",
    "web_fetch",
    "web_search",
    "browser_visit",
    "browser_screenshot",
    "run_shell",
    "agent_spawn",
    "agent_list",
    "agent_status",
    "agent_output",
    "agent_wait",
    "agent_stop",
    "agent_resume",
    "agent_retry",
    "agent_attach",
    "agent_detach",
    "agent_cleanup",
    "agent_audit",
    "interactive_terminal_start",
    "interactive_terminal_read",
    "interactive_terminal_search",
    "interactive_terminal_write",
    "interactive_terminal_send_line",
    "interactive_terminal_keys",
    "interactive_terminal_input",
    "interactive_terminal_snapshot",
    "interactive_terminal_resize",
    "interactive_terminal_request_human",
    "interactive_terminal_stop",
    "interactive_terminal_list",
    "terminal_observe",
    "interactive_start",
    "interactive_read",
    "interactive_search",
    "interactive_write",
    "interactive_send_line",
    "interactive_keys",
    "interactive_input",
    "interactive_snapshot",
    "interactive_resize",
    "interactive_stop",
    "interactive_list",
    "sandbox_create",
    "sandbox_execute",
    "sandbox_write",
    "sandbox_diff",
    "sandbox_merge",
    "sandbox_delete",
    "sandbox_resource_start",
    "sandbox_resource_list",
    "sandbox_resource_output",
    "sandbox_resource_stop",
    "process_start",
    "process_list",
    "process_status",
    "process_output",
    "process_ready",
    "process_stop",
    "process_restart",
    "process_attach",
    "process_detach",
    "process_cleanup",
    "process_audit",
    "background_start",
    "background_list",
    "background_output",
    "background_stop",
    "background_restart",
    "background_cleanup",
    "background_audit",
  );
  return names;
}

/** Metadata for migrated families retained by the deprecated `tool` CLI. */
export const migratedBuiltinToolFamilies = [
  {
    id: "ask",
    name: "Interactive Question Tools",
    version: "1.0.0",
    description: "Asking the user a structured question.",
    scope: "session",
    dependencies: [],
    tools: ["ask_user"],
  },
  {
    id: "todo",
    name: "Todo Tools",
    version: "1.0.0",
    description: "The session's task list.",
    scope: "session",
    dependencies: [],
    tools: ["plan", "todo_read", "todo_write"],
  },
  {
    id: "search",
    name: "Search Tools",
    version: "1.0.0",
    description: "Finding files by name and content in the workspace.",
    scope: "workspace",
    dependencies: [],
    tools: ["glob", "grep"],
  },
  {
    id: "fs-read",
    name: "Filesystem Read Tools",
    version: "1.0.0",
    description: "Reading workspace files and media metadata.",
    scope: "workspace",
    dependencies: [],
    tools: ["read_file", "read_media_file", "image_read"],
  },
  {
    id: "fs-write",
    name: "Filesystem Write Tools",
    version: "1.0.0",
    description: "Writing and editing workspace files.",
    scope: "workspace",
    dependencies: [],
    tools: ["write_file", "edit_file", "apply_patch"],
  },
  {
    id: "web",
    name: "Web Tools",
    version: "1.0.0",
    description: "Fetching and searching the web.",
    scope: "session",
    dependencies: [],
    tools: ["web_fetch", "web_search", "browser_visit", "browser_screenshot"],
  },
  {
    id: "shell",
    name: "Shell Tools",
    version: "1.0.0",
    description: "One-shot command execution.",
    scope: "session",
    dependencies: [],
    tools: ["run_shell"],
  },
  {
    id: "agent",
    name: "Subagent Tools",
    version: "1.0.0",
    description: "Delegating work to a subagent.",
    scope: "session",
    dependencies: [],
    tools: [
      "agent_spawn",
      "agent_list",
      "agent_status",
      "agent_output",
      "agent_wait",
      "agent_stop",
      "agent_resume",
      "agent_retry",
      "agent_attach",
      "agent_detach",
      "agent_cleanup",
      "agent_audit",
    ],
  },
  {
    id: "terminal",
    name: "Terminal Tools",
    version: "1.0.0",
    description: "Native terminal panes and interactive programs.",
    scope: "session",
    dependencies: [],
    tools: [
      "interactive_terminal_start",
      "interactive_terminal_read",
      "interactive_terminal_search",
      "interactive_terminal_write",
      "interactive_terminal_send_line",
      "interactive_terminal_keys",
      "interactive_terminal_input",
      "interactive_terminal_snapshot",
      "interactive_terminal_resize",
      "interactive_terminal_request_human",
      "interactive_terminal_stop",
      "interactive_terminal_list",
      "terminal_observe",
      "interactive_start",
      "interactive_read",
      "interactive_search",
      "interactive_write",
      "interactive_send_line",
      "interactive_keys",
      "interactive_input",
      "interactive_snapshot",
      "interactive_resize",
      "interactive_stop",
      "interactive_list",
    ],
  },
  {
    id: "sandbox",
    name: "Sandbox Tools",
    version: "1.0.0",
    description: "Isolated workspaces and their merge back.",
    scope: "workspace",
    dependencies: [],
    tools: [
      "sandbox_create",
      "sandbox_execute",
      "sandbox_write",
      "sandbox_diff",
      "sandbox_merge",
      "sandbox_delete",
      "sandbox_resource_start",
      "sandbox_resource_list",
      "sandbox_resource_output",
      "sandbox_resource_stop",
    ],
  },
  {
    id: "process",
    name: "Managed Process Tools",
    version: "1.0.0",
    description: "Long-running background processes.",
    scope: "session",
    dependencies: [],
    tools: [
      "process_start",
      "process_list",
      "process_status",
      "process_output",
      "process_ready",
      "process_stop",
      "process_restart",
      "process_attach",
      "process_detach",
      "process_cleanup",
      "process_audit",
      "background_start",
      "background_list",
      "background_output",
      "background_stop",
      "background_restart",
      "background_cleanup",
      "background_audit",
    ],
  },
] as const;
