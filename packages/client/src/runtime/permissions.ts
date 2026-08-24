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
import type { PermissionProfileCommandRules } from "@natalia/tools";
import type { ToolPolicyHookLayer } from "@natalia/runtime-services";
import {
  TOOL_POLICY_SERVICE,
  type ToolPolicyService,
} from "@natalia/runtime-services";
import type { SessionExecutionState } from "./context";
import type { RuntimeContext } from "./context";
import type { RealRuntimeClientOptions } from "./options";

type PermissionProfile = ConfigV3["permissionProfiles"][string];

export function createPermissions(
  ctx: RuntimeContext,
  options: RealRuntimeClientOptions,
) {
  return {
    applyAgentPolicy,
    createToolPolicyLayer,
    agentPolicyLayer,
    permissionProfileLayer,
    reloadPermissionSettings,
    isToolAllowed,
    extensionEnabled,
    extensionToolPermission,
  };

  function applyAgentPolicy() {}

  function agentPolicyLayer(agent: AgentDefinition | undefined) {
    const { getTsRuntimeConfig, resolveService } = ctx.ports;
    const tsRuntimeConfig = getTsRuntimeConfig();
    const mode = tsRuntimeConfig?.modes[tsRuntimeConfig.defaultMode];
    return resolveService<ToolPolicyService>(
      TOOL_POLICY_SERVICE,
    )!.createHookLayer(deriveAgentToolPolicy({ agent, mode }));
  }

  function permissionProfileLayer(profile: PermissionProfile | undefined) {
    return ctx.ports
      .resolveService<ToolPolicyService>(TOOL_POLICY_SERVICE)!
      .createHookLayer(deriveProfileToolPolicy({ profile }));
  }

  function createToolPolicyLayer(
    exec: SessionExecutionState | undefined = ctx.ports.getActiveExec(),
  ): ToolPolicyHookLayer {
    const policy =
      ctx.ports.resolveService<ToolPolicyService>(TOOL_POLICY_SERVICE);
    if (!policy)
      throw new Error("tool pipeline unavailable (natalia-tool-pipeline)");
    const agent = exec?.selectedAgent ?? ctx.ports.getSelectedAgent();
    const profile =
      exec?.permissionProfile ?? ctx.ports.getSelectedPermissionProfile();
    const base = policy.createHookLayer(options.toolPolicy);
    const agentLayer = agentPolicyLayer(agent);
    const profileLayer = permissionProfileLayer(profile);
    const moduleLayer = policy.createHookLayer(
      options.taskModuleContext
        ? ctx.state.initialize.moduleToolPolicy(
            options.taskModuleContext.moduleType,
          )
        : undefined,
    );
    const modulePermissionLayer = policy.createHookLayer(
      options.taskModuleContext?.modulePermissions?.tools,
    );
    const layers = [
      base,
      agentLayer,
      profileLayer,
      moduleLayer,
      modulePermissionLayer,
    ];
    return {
      ...policy.createHookLayer(undefined, {
        preExecute: async (event) => {
          if (
            options.taskModuleContext &&
            event.toolName === "flow_module_complete"
          )
            return { allowed: true, diagnostics: [] };
          for (const layer of layers) {
            const result = await layer.preExecute(event);
            if (!result.allowed) {
              if (layer === moduleLayer)
                return {
                  ...result,
                  diagnostics: [
                    `blocked outside active ${options.taskModuleContext?.moduleType} module: ${event.toolName}`,
                  ],
                };
              return result;
            }
          }
          const args = ctx.ports.tryParseToolArguments(event.arguments);
          for (const rules of [
            agent?.permissions,
            profile?.permissions,
            options.taskModuleContext?.modulePermissions,
          ]) {
            const result = policy.evaluatePermissionRules(
              rules,
              event.toolName,
              args,
              ctx.ports.getWorkspaceRoot(),
            );
            if (!result.allowed) return result;
          }
          const terminalCommandBuffer = ctx.ports.getTerminalCommandBuffer();
          const bufferedProfileCommandPermission =
            await terminalCommandBuffer.evaluate(
              [
                profile?.commandRules,
                options.taskModuleContext?.moduleCommandRules,
              ].filter((rules): rules is PermissionProfileCommandRules =>
                Boolean(rules),
              ),
              event.toolName,
              args,
              [
                profile?.interactivePrograms,
                options.taskModuleContext?.moduleInteractivePrograms,
              ],
            );
          const profileCommandPermission =
            bufferedProfileCommandPermission ??
            (await ctx.state.initialize.evaluatePermissionProfileCommandRules(
              profile?.commandRules,
              event.toolName,
              args,
            ));
          if (!profileCommandPermission.allowed)
            return profileCommandPermission;
          if (!bufferedProfileCommandPermission) {
            const moduleCommandPermission =
              await ctx.state.initialize.evaluatePermissionProfileCommandRules(
                options.taskModuleContext?.moduleCommandRules,
                event.toolName,
                args,
                "active module",
              );
            if (!moduleCommandPermission.allowed)
              return moduleCommandPermission;
          }
          const extensionResult = extensionToolPermission(
            event.toolName,
            profile,
          );
          if (!extensionResult.allowed) return extensionResult;
          return (
            (await options.hooks?.preExecute?.(event)) ?? {
              allowed: true,
              diagnostics: [],
            }
          );
        },
        postExecute: options.hooks?.postExecute,
      }),
      isToolAllowed: (toolName: string) =>
        layers.every((layer) => layer.isToolAllowed(toolName)),
    };
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
    const { getSelectedPermissionProfile } = ctx.ports;
    // The module completion tool is system control, not a capability: it must
    // stay available even when a profile, agent or module allow-list forgets to
    // mention it, otherwise the model can never report completion and every
    // module stalls for a configuration reason nobody can see.
    if (options.taskModuleContext && toolName === "flow_module_complete")
      return true;
    return (
      createToolPolicyLayer(exec).isToolAllowed(toolName) &&
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
