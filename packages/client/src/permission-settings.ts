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
  const mode = config.modes[config.defaultMode];
  const modeProfile = mode?.permission
    ? config.permissionProfiles[mode.permission]
    : undefined;
  const defaultProfile = config.permissionProfiles[config.defaultPermission];

  if (requestedProfile) {
    const found = config.permissionProfiles[requestedProfile];
    if (!found) return { found: false };
    const nextMode = !optionMode && found ? found.approval : permissionMode;
    return {
      found: true,
      selectedProfile: found,
      mode: nextMode,
      defaultMode: nextMode,
      defaultProfile: found,
    };
  }

  const selectedProfile = modeProfile ?? defaultProfile;
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
