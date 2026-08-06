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
  interactivePrograms: string[] | "any";
  extensions: { skills: boolean; mcp: boolean; plugins: boolean };
  /** Workspace path scopes the module itself configured, when any. */
  pathRules?: { read: string[]; write: string[] };
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
  const modulePermissionLayer = createToolPolicyHookLayer({
    allow: module.permissions?.tools?.allow,
    exclude: module.permissions?.tools?.exclude,
  });
  const profileLayer = createToolPolicyHookLayer({
    allow: profile?.permissions?.tools?.allow,
    exclude: profile?.permissions?.tools?.exclude,
  });
  const extensions = {
    skills:
      profile?.extensions?.skills !== false &&
      module.extensions?.skills !== false,
    mcp: profile?.extensions?.mcp !== false && module.extensions?.mcp !== false,
    plugins:
      profile?.extensions?.plugins !== false &&
      module.extensions?.plugins !== false,
  };
  const permitted = (name: string) =>
    // The completion tool is system control: the runtime keeps it available even
    // when a profile allow-list omits it, so the preview must agree.
    name === SYSTEM_MODULE_TOOL ||
    (profileLayer.isToolAllowed(name) &&
      modulePermissionLayer.isToolAllowed(name) &&
      extensionAllowed(name, extensions));
  const inBundle = input.toolNames.filter((name) =>
    moduleLayer.isToolAllowed(name),
  );
  const allowed = inBundle.filter(permitted);
  const denied = inBundle.filter((name) => !permitted(name));
  const capabilities = allowed.filter((name) => name !== SYSTEM_MODULE_TOOL);
  const interactivePrograms = intersectPrograms(
    profile?.interactivePrograms,
    module.interactivePrograms,
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
    ...(module.permissions?.files
      ? {
          pathRules: {
            read: module.permissions.files.readPaths?.map(pathRuleLabel) ?? [],
            write:
              module.permissions.files.writePaths?.map(pathRuleLabel) ?? [],
          },
        }
      : {}),
    ...(capabilities.length
      ? {}
      : {
          blocked: blockedReason({
            moduleType: module.type,
            denied,
            bundle: bundle.filter((name) => name !== SYSTEM_MODULE_TOOL),
            moduleExtensions: module.extensions,
          }),
        }),
  };
}

function pathRuleLabel(rule: { pattern: string; allow?: boolean }) {
  return `${rule.allow === true ? "allow" : "deny"} ${rule.pattern}`;
}

function blockedReason(input: {
  moduleType: NataliaFlowModuleType;
  denied: string[];
  bundle: string[];
  moduleExtensions?: { skills?: boolean; mcp?: boolean; plugins?: boolean };
}) {
  const moduleDisabled = input.denied.filter((tool) => {
    const extension = extensionForTool(tool);
    return extension && input.moduleExtensions?.[extension] === false;
  });
  if (moduleDisabled.length)
    return `the ${input.moduleType} module has no usable tool: the active module disables ${moduleDisabled.join(", ")}`;
  if (input.denied.length)
    return `the ${input.moduleType} module has no usable tool: the permission profile denies ${input.denied.join(", ")}`;
  return `the ${input.moduleType} module has no usable tool: nothing matching ${input.bundle.join(", ")} exists for this task`;
}

function extensionAllowed(
  name: string,
  extensions: { skills: boolean; mcp: boolean; plugins: boolean },
) {
  const extension = extensionForTool(name);
  if (extension) return extensions[extension];
  return true;
}

function extensionForTool(
  name: string,
): "skills" | "mcp" | "plugins" | undefined {
  if (name === "skill_load") return "skills";
  if (name.startsWith("mcp_")) return "mcp";
  if (name.startsWith("plugin_")) return "plugins";
  return undefined;
}

function intersectPrograms(
  profile:
    | { allowAny?: boolean; allow: ReadonlyArray<{ command: string }> }
    | undefined,
  module:
    | { allowAny?: boolean; allow: ReadonlyArray<{ command: string }> }
    | undefined,
): string[] | "any" {
  const layers = [profile, module].filter(
    (layer): layer is NonNullable<typeof layer> =>
      Boolean(layer && (layer.allowAny || layer.allow.length)),
  );
  if (!layers.length) return [];
  const first = layers[0]!;
  let effective: string[] | "any" = first.allowAny
    ? "any"
    : first.allow.map((rule) => rule.command);
  for (const layer of layers.slice(1)) {
    if (effective === "any")
      effective = layer.allowAny
        ? "any"
        : layer.allow.map((rule) => rule.command);
    else if (!layer.allowAny) {
      const commands = new Set(layer.allow.map((rule) => rule.command));
      effective = effective.filter((command) => commands.has(command));
    }
  }
  return effective;
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
