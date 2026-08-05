import type {
  NataliaFlowDocument,
  PermissionProfile,
} from "@natalia/contracts";
import { createToolRegistry } from "@natalia/tools";
import {
  moduleToolPolicy,
  type NataliaFlowModuleType,
} from "@natalia/workflow";
import { createToolPolicyHookLayer } from "./tool-policy";

/** The system control tool is always available and is not a capability. */
const SYSTEM_MODULE_TOOL = "flow_module_complete";

export type EffectiveModulePermissions = {
  moduleID: string;
  moduleType: NataliaFlowModuleType;
  displayName: string;
  enabled: boolean;
  tools: { allowed: string[]; denied: string[] };
  commandRules: {
    profile?: { mode: string; commands: string[] };
    module?: { mode: string; commands: string[] };
  };
  interactivePrograms: string[];
  extensions: { skills: boolean; mcp: boolean; plugins: boolean };
  /** Set when the module cannot perform any of its own capabilities. */
  blocked?: string;
};

export type EffectiveFlowPermissions = {
  flowID: string;
  modules: EffectiveModulePermissions[];
  blocked: Array<{ moduleID: string; reason: string }>;
};

/**
 * Effective permissions each stage of a flow would actually get.
 *
 * This is a preview, not a boundary: the runtime recomputes every layer before
 * it executes anything. It exists because a stage whose whole capability bundle
 * is denied can never satisfy its completion conditions, and finding that out at
 * 02:00 by burning the retry budget is the worst way to learn it.
 *
 * It deliberately reuses the same pattern layers and extension gating as
 * enforcement, so the preview cannot drift from what the runtime will do.
 */
export function effectiveFlowPermissions(input: {
  profile?: PermissionProfile;
  flow: NataliaFlowDocument;
  /** Task-scoped tools that will exist for this task, if any. */
  taskCapabilities?: { reportIssue?: boolean; readDataSource?: boolean };
  toolNames?: readonly string[];
}): EffectiveFlowPermissions {
  const toolNames =
    input.toolNames ?? runtimeToolNames(input.taskCapabilities ?? {});
  const modules = input.flow.modules.map((module) =>
    effectiveModulePermissions({
      profile: input.profile,
      module,
      toolNames,
    }),
  );
  return {
    flowID: input.flow.flowID,
    modules,
    blocked: modules
      .filter((module) => module.enabled && module.blocked)
      .map((module) => ({
        moduleID: module.moduleID,
        reason: module.blocked!,
      })),
  };
}

export function effectiveModulePermissions(input: {
  profile?: PermissionProfile;
  module: NataliaFlowDocument["modules"][number];
  toolNames: readonly string[];
}): EffectiveModulePermissions {
  const { module, profile } = input;
  const bundle = moduleToolPolicy(module.type).allow;
  const moduleLayer = createToolPolicyHookLayer({ allow: bundle });
  const profileLayer = createToolPolicyHookLayer({
    allow: profile?.permissions?.tools?.allow,
    exclude: profile?.permissions?.tools?.exclude,
  });
  const extensions = {
    skills: profile?.extensions?.skills !== false,
    mcp: profile?.extensions?.mcp !== false,
    plugins: profile?.extensions?.plugins !== false,
  };
  const permitted = (name: string) =>
    // The completion tool is system control: the runtime keeps it available even
    // when a profile allow-list omits it, so the preview must agree.
    name === SYSTEM_MODULE_TOOL ||
    (profileLayer.isToolAllowed(name) && extensionAllowed(name, extensions));
  const inBundle = input.toolNames.filter((name) =>
    moduleLayer.isToolAllowed(name),
  );
  const allowed = inBundle.filter(permitted);
  const denied = inBundle.filter((name) => !permitted(name));
  const capabilities = allowed.filter((name) => name !== SYSTEM_MODULE_TOOL);
  const interactivePrograms = intersectPrograms(
    profile?.interactivePrograms?.allow,
    module.interactivePrograms?.allow,
  );
  return {
    moduleID: module.id,
    moduleType: module.type,
    displayName: module.displayName,
    enabled: module.enabled,
    tools: { allowed, denied },
    commandRules: {
      ...(profile?.commandRules
        ? {
            profile: {
              mode: profile.commandRules.mode,
              commands: profile.commandRules.rules.map((rule) => rule.command),
            },
          }
        : {}),
      ...(module.commandRules
        ? {
            module: {
              mode: module.commandRules.mode,
              commands: module.commandRules.rules.map((rule) => rule.command),
            },
          }
        : {}),
    },
    interactivePrograms,
    extensions,
    ...(capabilities.length
      ? {}
      : {
          blocked: blockedReason({
            moduleType: module.type,
            denied,
            bundle: bundle.filter((name) => name !== SYSTEM_MODULE_TOOL),
          }),
        }),
  };
}

function blockedReason(input: {
  moduleType: NataliaFlowModuleType;
  denied: string[];
  bundle: string[];
}) {
  if (input.denied.length)
    return `the ${input.moduleType} module has no usable tool: the permission profile denies ${input.denied.join(", ")}`;
  return `the ${input.moduleType} module has no usable tool: nothing matching ${input.bundle.join(", ")} exists for this task`;
}

function extensionAllowed(
  name: string,
  extensions: { skills: boolean; mcp: boolean; plugins: boolean },
) {
  if (name === "skill_load") return extensions.skills;
  if (name.startsWith("mcp_")) return extensions.mcp;
  if (name.startsWith("plugin_")) return extensions.plugins;
  return true;
}

function intersectPrograms(
  profile: ReadonlyArray<{ command: string }> | undefined,
  module: ReadonlyArray<{ command: string }> | undefined,
) {
  const profileCommands = (profile ?? []).map((rule) => rule.command);
  if (!module) return profileCommands;
  const moduleCommands = new Set(module.map((rule) => rule.command));
  return profileCommands.filter((command) => moduleCommands.has(command));
}

function runtimeToolNames(capabilities: {
  reportIssue?: boolean;
  readDataSource?: boolean;
}) {
  return [
    ...createToolRegistry().keys(),
    SYSTEM_MODULE_TOOL,
    ...(capabilities.reportIssue ? ["report_issue"] : []),
    ...(capabilities.readDataSource ? ["read_data_source"] : []),
  ];
}
