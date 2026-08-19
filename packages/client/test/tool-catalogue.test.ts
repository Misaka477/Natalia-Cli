import { expect, test } from "bun:test";
import { CapabilityRegistry } from "@natalia/capability";
import { createToolRegistryFromCapabilities } from "../src/capabilities/tool-family-capabilities";

/** The catalogue the host actually assembles, through the kernel. */
function builtinRegistry() {
  return createToolRegistryFromCapabilities({
    registry: new CapabilityRegistry(),
  }).tools;
}

/**
 * The built-in tool catalogue, pinned.
 *
 * It lives with the host because the host composes it: the families come from
 * `@natalia/tools` and from separately packaged ones like `@natalia/tool-todo`,
 * and only the assembled result is the surface a model sees.
 *
 * This is a policy surface, not an inventory: a tool that quietly disappears
 * changes what the model can do, a name that changes breaks every transcript and
 * permission rule that referenced it, and an approval flag that flips changes what
 * runs without asking a human first. All three are easy to do by accident while
 * moving code between files, and none of them fail any behavioural test — the
 * remaining tests here exercise tools they name explicitly, so a dropped tool is
 * invisible to them.
 *
 * Adding a tool is expected to fail this test. Update the list deliberately, and
 * state the approval boundary you chose.
 */
const catalogue: Array<
  [name: string, requiresApproval: boolean, timeoutSec?: number]
> = [
  ["agent_attach", false],
  ["agent_audit", false],
  ["agent_cleanup", true],
  ["agent_detach", false],
  ["agent_list", false],
  ["agent_output", false],
  ["agent_resume", false],
  ["agent_retry", true],
  ["agent_spawn", true],
  ["agent_status", false],
  ["agent_stop", true],
  ["agent_wait", false],
  ["ask_user", false],
  ["background_audit", false],
  ["background_cleanup", true],
  ["background_list", false],
  ["background_output", false],
  ["background_restart", true],
  ["background_start", true],
  ["background_stop", true],
  ["browser_screenshot", true, 60],
  ["browser_visit", false, 30],
  ["edit_file", true],
  ["glob", false],
  ["grep", false],
  ["interactive_terminal_input", true],
  ["interactive_terminal_keys", true],
  ["interactive_terminal_list", false],
  ["interactive_terminal_read", false],
  ["interactive_terminal_request_human", false],
  ["interactive_terminal_resize", false],
  ["interactive_terminal_search", false],
  ["interactive_terminal_send_line", true],
  ["interactive_terminal_snapshot", false],
  ["interactive_terminal_start", true],
  ["interactive_terminal_stop", true],
  ["interactive_terminal_write", true],
  ["plan", true],
  ["process_attach", false],
  ["process_audit", false],
  ["process_cleanup", true],
  ["process_detach", false],
  ["process_list", false],
  ["process_output", false],
  ["process_ready", false],
  ["process_restart", true],
  ["process_start", true],
  ["process_status", false],
  ["process_stop", true],
  ["read_file", false],
  ["read_media_file", false],
  ["image_read", false],
  ["run_shell", true, 120],
  ["sandbox_create", true],
  ["sandbox_delete", true],
  ["sandbox_diff", false],
  ["sandbox_execute", true],
  ["sandbox_merge", true],
  ["sandbox_resource_list", false],
  ["sandbox_resource_output", false],
  ["sandbox_resource_start", true],
  ["sandbox_resource_stop", true],
  ["sandbox_write", true],
  ["terminal_observe", false, 35],
  ["todo_read", false],
  ["todo_write", true],
  ["web_fetch", false, 30],
  ["web_search", false, 30],
  ["write_file", true],
];

test("the built-in tool catalogue is exactly this, with these approval boundaries", () => {
  const registry = builtinRegistry();
  const actual = [...registry.entries()]
    .map(
      ([name, tool]) =>
        [name, tool.requiresApproval, tool.timeoutSec] as [
          string,
          boolean,
          number | undefined,
        ],
    )
    .sort((left, right) => left[0].localeCompare(right[0]));
  const expected = catalogue
    .map(
      ([name, requiresApproval, timeoutSec]) =>
        [name, requiresApproval, timeoutSec] as [
          string,
          boolean,
          number | undefined,
        ],
    )
    .sort((left, right) => left[0].localeCompare(right[0]));
  expect(actual).toEqual(expected);
});

test("the interactive terminal aliases resolve to the tools they stand for", () => {
  // The short names are what a model tends to reach for; they are registered as
  // aliases rather than duplicate tools so there is one implementation and one
  // approval boundary per action.
  const registry = builtinRegistry();
  for (const [alias, target] of [
    ["interactive_start", "interactive_terminal_start"],
    ["interactive_read", "interactive_terminal_read"],
    ["interactive_search", "interactive_terminal_search"],
    ["interactive_write", "interactive_terminal_write"],
    ["interactive_send_line", "interactive_terminal_send_line"],
    ["interactive_keys", "interactive_terminal_keys"],
    ["interactive_input", "interactive_terminal_input"],
    ["interactive_snapshot", "interactive_terminal_snapshot"],
    ["interactive_resize", "interactive_terminal_resize"],
    ["interactive_stop", "interactive_terminal_stop"],
    ["interactive_list", "interactive_terminal_list"],
  ] as const) {
    expect(registry.get(alias)?.name).toBe(target);
    // `has` resolves aliases too, so a caller can check either name...
    expect(registry.has(alias)).toBe(true);
    // ...but an alias must not become a second entry in the catalogue.
    expect([...registry.keys()]).not.toContain(alias);
  }
});
