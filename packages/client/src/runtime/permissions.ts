/**
 * Permission mode, profile and tool policy layers — runtime/permissions module.
 *
 * Owns the derivation of the agent and profile tool policy layers, the
 * permission-mode/profile reload on config change, and the extension gates
 * (skills/mcp/plugins). Reads host state and writes the shared permission
 * state through `RuntimeContext` ports at call time.
 */
import {
  deriveAgentToolPolicy,
  deriveProfileToolPolicy,
} from "../tool-policy-derivation";
import { derivePermissionSettings } from "../permission-settings";
import type { AgentDefinition } from "@natalia/agent";
import type { ConfigV3 } from "@natalia/contracts";
import type { ToolPolicyHookLayer } from "@natalia/runtime-services";
import type { SessionExecutionState } from "./context";
import type { RuntimeContext } from "./context";
import type { RealRuntimeClientOptions } from "../real-runtime";

type PermissionProfile = ConfigV3["permissionProfiles"][string];

export function createPermissions(
  ctx: RuntimeContext,
  options: RealRuntimeClientOptions,
) {
  return {
    applyAgentPolicy,
    agentPolicyLayer,
    permissionProfileLayer,
    reloadPermissionSettings,
    isToolAllowed,
    extensionEnabled,
    extensionToolPermission,
  };

  function applyAgentPolicy() {
    const {
      getSelectedAgent,
      getSelectedPermissionProfile,
      setAgentToolLayer,
      setPermissionProfileToolLayer,
    } = ctx.ports;
    setAgentToolLayer(agentPolicyLayer(getSelectedAgent()));
    setPermissionProfileToolLayer(
      permissionProfileLayer(getSelectedPermissionProfile()),
    );
  }

  function agentPolicyLayer(agent: AgentDefinition | undefined) {
    const { getTsRuntimeConfig, getToolPolicy } = ctx.ports;
    const tsRuntimeConfig = getTsRuntimeConfig();
    const mode = tsRuntimeConfig?.modes[tsRuntimeConfig.defaultMode];
    return getToolPolicy()!.createHookLayer(
      deriveAgentToolPolicy({ agent, mode }),
    );
  }

  function permissionProfileLayer(profile: PermissionProfile | undefined) {
    const { getToolPolicy } = ctx.ports;
    return getToolPolicy()!.createHookLayer(
      deriveProfileToolPolicy({ profile }),
    );
  }

  /**
   * Re-derives the permission mode and selected profile from the given config
   * and rebuilds the tool policy layers. Called at initialize and on every
   * config reload, so switching the default profile or flipping auto/ask in
   * the settings dialog takes effect immediately instead of after a restart.
   * A requested profile (options.permissionProfile) that vanished from disk
   * keeps the current selection; the caller decides whether that is fatal.
   */
  function reloadPermissionSettings(config: ConfigV3) {
    const {
      getPermissionMode,
      setSelectedPermissionProfile,
      setPermissionMode,
      setDefaultPermissionMode,
      setDefaultPermissionProfile,
    } = ctx.ports;
    const derived = derivePermissionSettings({
      config,
      requestedProfile: options.permissionProfile,
      optionMode: options.permissionMode,
      permissionMode: getPermissionMode(),
    });
    if (!derived.found) return;
    setSelectedPermissionProfile(derived.selectedProfile);
    setPermissionMode(derived.mode);
    setDefaultPermissionMode(derived.defaultMode);
    setDefaultPermissionProfile(derived.defaultProfile);
  }

  function isToolAllowed(
    toolName: string,
    exec: SessionExecutionState | undefined = ctx.ports.getActiveExec(),
  ) {
    const {
      getToolLayer,
      getAgentToolLayer,
      getPermissionProfileToolLayer,
      getModuleToolLayer,
      getModulePermissionToolLayer,
      getSelectedPermissionProfile,
    } = ctx.ports;
    // The module completion tool is system control, not a capability: it must
    // stay available even when a profile, agent or module allow-list forgets to
    // mention it, otherwise the model can never report completion and every
    // module stalls for a configuration reason nobody can see.
    if (options.taskModuleContext && toolName === "flow_module_complete")
      return true;
    return (
      getToolLayer().isToolAllowed(toolName) &&
      (exec
        ? agentPolicyLayer(exec.selectedAgent).isToolAllowed(toolName)
        : getAgentToolLayer().isToolAllowed(toolName)) &&
      (exec
        ? permissionProfileLayer(exec.permissionProfile).isToolAllowed(toolName)
        : getPermissionProfileToolLayer().isToolAllowed(toolName)) &&
      getModuleToolLayer().isToolAllowed(toolName) &&
      getModulePermissionToolLayer().isToolAllowed(toolName) &&
      extensionToolPermission(
        toolName,
        exec ? exec.permissionProfile : getSelectedPermissionProfile(),
      ).allowed
    );
  }

  function extensionEnabled(
    extension: "skills" | "mcp" | "plugins",
    profile:
      | PermissionProfile
      | undefined = ctx.ports.getSelectedPermissionProfile(),
  ) {
    return (
      profile?.extensions?.[extension] !== false &&
      options.taskModuleContext?.moduleExtensions?.[extension] !== false
    );
  }

  function extensionToolPermission(
    toolName: string,
    profile:
      | PermissionProfile
      | undefined = ctx.ports.getSelectedPermissionProfile(),
  ) {
    const extension =
      toolName === "skill_load"
        ? "skills"
        : toolName.startsWith("mcp_")
          ? "mcp"
          : toolName.startsWith("plugin_")
            ? "plugins"
            : undefined;
    if (!extension || extensionEnabled(extension, profile))
      return { allowed: true, diagnostics: [] };
    const source =
      options.taskModuleContext?.moduleExtensions?.[extension] === false
        ? "active module"
        : "permission profile";
    return {
      allowed: false,
      diagnostics: [`${extension} extensions are disabled by ${source}`],
    };
  }
}
