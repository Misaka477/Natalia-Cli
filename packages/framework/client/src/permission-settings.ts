/**
 * Permission profile derivation.
 *
 * This is the pure config→profile computation the runtime applies on config
 * load and reload. It returns the effective permission profile plus the
 * permission/default-mode bindings that follow from it, or `found: false` when
 * an explicitly requested profile does not exist (in which case nothing is
 * applied). Keeping it separate makes the load/reload path testable without the
 * runtime state it writes.
 */
import type { ConfigV3 } from "@natalia/contracts";

type PermissionProfile = ConfigV3["permissionProfiles"][string];
export type PermissionMode = PermissionProfile["approval"];

export type DerivedPermissionSettings =
  | { found: false }
  | {
      found: true;
      selectedProfile: PermissionProfile;
      mode: PermissionMode;
      defaultMode: PermissionMode;
      defaultProfile: PermissionProfile;
    };

export function derivePermissionSettings(input: {
  config: ConfigV3;
  requestedProfile: string | undefined;
  optionMode: PermissionMode | undefined;
  permissionMode: PermissionMode;
}): DerivedPermissionSettings {
  const { config, requestedProfile, optionMode, permissionMode } = input;
  const agentMode = config.agentModes[config.defaultAgentMode] ?? config.agentModes["ask"];
  const defaultProfile: PermissionProfile = {
    approval: agentMode?.approval ?? "ask",
    description: agentMode?.description ?? "",
    ...(agentMode?.allowedTools.length || agentMode?.excludedTools.length
      ? {
          permissions: {
            tools: {
              allow: agentMode?.allowedTools ?? [],
              exclude: agentMode?.excludedTools ?? [],
            },
          },
        }
      : {}),
    ...(agentMode?.commandRules ? { commandRules: agentMode.commandRules } : {}),
    ...(agentMode?.interactivePrograms
      ? { interactivePrograms: agentMode.interactivePrograms }
      : {}),
    extensions: {
      skills: agentMode?.skills !== false,
      mcp: true,
    },
  };

  if (requestedProfile) {
    const found =
      config.agentModes[requestedProfile] ?? config.permissionProfiles[requestedProfile];
    if (!found) return { found: false };
    const foundProfile: PermissionProfile = {
      approval: found.approval,
      description: "description" in found ? found.description ?? "" : "",
      ...("allowedTools" in found
        ? {
            permissions: {
              tools: {
                allow: found.allowedTools ?? [],
                exclude: (found as { excludedTools?: string[] }).excludedTools ?? [],
              },
            },
          }
        : {}),
      ...("commandRules" in found && found.commandRules
        ? { commandRules: found.commandRules }
        : {}),
      ...("interactivePrograms" in found && found.interactivePrograms
        ? { interactivePrograms: found.interactivePrograms }
        : {}),
      extensions: {
        skills: "skills" in found ? found.skills !== false : true,
        mcp: true,
      },
    };
    const nextMode = !optionMode && found ? foundProfile.approval : permissionMode;
    return {
      found: true,
      selectedProfile: foundProfile,
      mode: nextMode,
      defaultMode: nextMode,
      defaultProfile: foundProfile,
    };
  }

  const selectedProfile = defaultProfile;
  const nextMode =
    !optionMode && selectedProfile ? selectedProfile.approval : permissionMode;
  return {
    found: true,
    selectedProfile,
    mode: nextMode,
    defaultMode: nextMode,
    defaultProfile: selectedProfile,
  };
}
