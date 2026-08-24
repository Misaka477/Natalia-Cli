import type {
  MigratedPluginRule,
  MigratedPluginViolation,
} from "./migrated-plugin-rule-types";
import { migratedPluginRules1 } from "./migrated-plugin-rules-1";
import { migratedPluginRules2 } from "./migrated-plugin-rules-2";
import { migratedPluginRules3 } from "./migrated-plugin-rules-3";
import { migratedPluginRules4 } from "./migrated-plugin-rules-4";

export type {
  MigratedPluginRule,
  MigratedPluginViolation,
} from "./migrated-plugin-rule-types";
const forbiddenRepositoryPaths = new Map([
  [
    "packages/agent-plugin/package.json",
    "deleted agent re-export facade must not be recreated",
  ],
  [
    "packages/skills/package.json",
    "merged skills implementation package must not be recreated",
  ],
  [
    "packages/skills/src/index.ts",
    "merged skills implementation package must not be recreated",
  ],
  [
    "packages/mcp/package.json",
    "merged MCP implementation package must not be recreated",
  ],
  [
    "packages/mcp/src/index.ts",
    "merged MCP implementation package must not be recreated",
  ],
  [
    "packages/client/src/runtime-assembly.ts",
    "deleted runtime assembly seam must not be recreated",
  ],
  [
    "packages/builtin-plugins/package.json",
    "deleted built-in plugin classification must not be recreated",
  ],
  [
    "packages/builtin-tool-plugins/package.json",
    "deleted built-in tool plugin classification must not be recreated",
  ],
  [
    "packages/sandbox-plugin/package.json",
    "merged sandbox controller package must not be recreated",
  ],
  [
    "packages/collaboration-plugin/package.json",
    "merged collaboration framework package must not be recreated",
  ],
  [
    "packages/workflow-scheduler-plugin/package.json",
    "merged workflow scheduler framework package must not be recreated",
  ],
  [
    "apps/cli/src/transport-plugin.ts",
    "framework transport plugin wrapper must not be recreated",
  ],
  [
    "packages/checkpoint-plugin/package.json",
    "merged checkpoint package must not be recreated",
  ],
  [
    "packages/attachment-plugin/package.json",
    "merged attachments framework package must not be recreated",
  ],
  [
    "packages/context-ledger-plugin/package.json",
    "merged context ledger framework package must not be recreated",
  ],
  [
    "packages/retry-plugin/package.json",
    "merged retry framework package must not be recreated",
  ],
  [
    "packages/runtime-config-plugin/package.json",
    "merged runtime config framework package must not be recreated",
  ],
  [
    "packages/tool-pipeline-plugin/package.json",
    "merged tool policy framework package must not be recreated",
  ],
  [
    "packages/workspace-plugin/package.json",
    "merged workspace framework package must not be recreated",
  ],
  [
    "packages/compaction-plugin/package.json",
    "merged compaction framework package must not be recreated",
  ],
  [
    "packages/session-store-plugin/package.json",
    "merged session store framework package must not be recreated",
  ],
  [
    "packages/provider-model-plugin/package.json",
    "merged provider/model framework package must not be recreated",
  ],
  [
    "packages/turn-orchestration-plugin/package.json",
    "merged turn orchestration framework package must not be recreated",
  ],
  [
    "packages/runtime-ui-plugin/package.json",
    "merged runtime status framework package must not be recreated",
  ],
  [
    "packages/work-ledger-plugin/package.json",
    "merged work ledger framework package must not be recreated",
  ],
  [
    "packages/governance-ledger-plugin/package.json",
    "merged governance ledger framework package must not be recreated",
  ],
]);

/** Prevent deleted transitional architecture seams from being recreated. */
export function findForbiddenRepositoryPathViolation(
  path: string,
): string | undefined {
  return forbiddenRepositoryPaths.get(path.replaceAll("\\", "/"));
}

const runtimePluginCatalogDirectory =
  "packages/client/src/runtime/plugin-config/";
const productPluginImport = /from\s+["']@natalia\/plugin-[a-z-]+["']/u;
const productPluginFactory = /\bcreate[A-Z][A-Za-z0-9]*Plugin\s*\(/u;
const migratedServiceImport = new RegExp(
  String.raw`(?:import|export)\s*(?:type\s*)?\{[^}]*\b(?:ATTACHMENT_SERVICE|AttachmentService|CHECKPOINT_FACTORY_SERVICE|CheckpointFactory|COMPACTION_SERVICE|CompactionService|CONTEXT_LEDGER_FACTORY_SERVICE|ContextLedgerFactory|GOVERNANCE_LEDGER_CONTROLLER_SERVICE|GovernanceLedgerController|InteractiveWaiter|MCP_SERVICE|McpService|PROVIDER_MODEL_CONTROLLER_SERVICE|ProviderModelController|RETRY_SERVICE|RetryService|SANDBOX_SERVICE|SandboxService|SESSION_STORE_CONTROLLER_SERVICE|SessionStoreController|STATUS_SNAPSHOT_CONTROLLER_SERVICE|StatusSnapshotController|SUBAGENTS_SERVICE|SubagentsService|TASK_WORKFLOW_CONTROLLER_SERVICE|TaskWorkflowController|TERMINAL_CONTROLLER_SERVICE|TerminalController|TOOL_POLICY_SERVICE|ToolPolicyService|TURN_CONTROLLER_SERVICE|TurnController|WORK_LEDGER_CONTROLLER_SERVICE|WorkLedgerController|WORKSPACE_FILES_SERVICE|WorkspaceFilesController|WORKSPACE_MUTATIONS_SERVICE|MutationRegistry|WORKSPACE_WRITE_LOCK_SERVICE|WorkspaceWriteLock)\b[^}]*\}\s*from\s*['"]@natalia\/(?:collaboration|compaction|governance-ledger|mcp|provider-model|runtime-ui|session-store|subagents|task-workflow|terminal|turn-orchestration|work-ledger)-plugin['"]`,
  "u",
);

/** Keep product factory assembly in runtime's ordinary desired catalog. */
export function findRuntimePluginCatalogViolation(
  path: string,
  text: string,
): string | undefined {
  const normalized = path.replaceAll("\\", "/");
  if (normalized.startsWith("packages/testing/")) return undefined;
  if (
    normalized.startsWith("packages/client/src/runtime/") &&
    !normalized.startsWith(runtimePluginCatalogDirectory) &&
    (productPluginImport.test(text) || productPluginFactory.test(text))
  )
    return "runtime product plugin assembly belongs in the ordinary desired catalog";
  if (
    /\b(?:builtinPluginCatalog|computeBuiltinPluginGates|computeBuiltinFeatureGates|DefaultPluginEntry)\b/u.test(
      text,
    )
  )
    return "built-in plugin classification must not be recreated";
  return undefined;
}

/** Runtime service definitions are owned by the shared definition package. */
export function findClientServiceContractViolation(
  path: string,
  text: string,
): string | undefined {
  if (
    path.startsWith("packages/client/src/") &&
    migratedServiceImport.test(text)
  )
    return "client must import migrated service types and keys from @natalia/runtime-services";
  return undefined;
}

const migratedClientPluginSurface = new RegExp(
  String.raw`(?:import|export)\s*(?:type\s*)?\{[^}]*\b(?:parseToolArguments|tryParseToolArguments|createToolPolicyHookLayer|ToolPolicyHookLayer|WorkflowExecutionEventStream|WorkflowExecutionEvent|WorkflowExecutionHandle|WorkflowExecutionStatus|WorkflowExecutionSchedulerService)\b[^}]*\}\s*from\s*["']@natalia\/[a-z-]+-plugin["']`,
  "u",
);
const clientProviderPluginIDImport = new RegExp(
  String.raw`(?:import|export)\s*(?:type\s*)?\{[^}]*\b[A-Z][A-Z0-9_]*_PLUGIN_ID\b[^}]*\}\s*from\s*["']@natalia\/[a-z-]+-plugin["']`,
  "u",
);
const runtimeCompositionRoot = "packages/client/src/runtime/main.ts";
const runtimeCompositionDirectory = "packages/client/src/runtime/composition/";

function isRuntimeCompositionPath(path: string) {
  return (
    path === runtimeCompositionRoot ||
    path.startsWith(runtimeCompositionDirectory)
  );
}

/** Pure contracts and helpers must not be sourced from provider packages. */
export function findClientPluginSurfaceViolation(
  path: string,
  text: string,
): string | undefined {
  const normalized = path.replaceAll("\\", "/");
  if (normalized.startsWith(runtimePluginCatalogDirectory)) return undefined;
  if (
    isRuntimeCompositionPath(normalized) &&
    /(?:from\s+|import\s*\()\s*["']@natalia\/[^"']*-plugin["']/u.test(text)
  )
    return "client runtime composition root must not import provider plugin packages";
  if (
    /packages\/client\/(?:src|test)\//u.test(normalized) &&
    (migratedClientPluginSurface.test(text) ||
      clientProviderPluginIDImport.test(text))
  )
    return "client imports a migrated pure surface or plugin ID from a plugin package";
  return undefined;
}

const clientToolImplementationImport =
  /(?:from\s+|import\s*\(|require\s*\()\s*["']@natalia\/tool-(?!pipeline-plugin["'])(?!policy["'])[a-z-]+["']/u;
const clientToolImplementationDependency =
  /["']@natalia\/tool-(?!pipeline-plugin["'])(?!policy["'])[a-z-]+["']/u;
const clientToolImplementationReference =
  /["']\.\.\/tool-(?!pipeline-plugin["'])(?!policy["'])[a-z-]+["']/u;

/** Keep concrete tool implementations outside the client package boundary. */
export function findClientToolDependencyViolation(
  path: string,
  text: string,
): string | undefined {
  const normalized = path.replaceAll("\\", "/");
  if (normalized.startsWith(runtimePluginCatalogDirectory)) return undefined;
  if (
    /packages\/client\/(?:src|test)\//u.test(normalized) &&
    !normalized.startsWith(runtimePluginCatalogDirectory) &&
    clientToolImplementationImport.test(text)
  )
    return "client project imports a concrete tool package";
  if (normalized === "packages/client/package.json") return undefined;
  if (normalized === "packages/client/tsconfig.json") return undefined;
  return undefined;
}

/**
 * Keep concrete product packages outside the client boundary once a plugin
 * package owns them. The list grows as each controller is extracted; an entry
 * must not be added until the client no longer imports the package anywhere.
 */
const clientProductPackages = [
  "agent-plugin",
  "mcp",
  "native-terminal",
  "skills",
  "subagent",
  "task-workflow-plugin",
];

/** Keep concrete product packages outside the client package boundary. */
export function findClientProductDependencyViolation(
  path: string,
  text: string,
): string | undefined {
  const normalized = path.replaceAll("\\", "/");
  const alternation = clientProductPackages.join("|");
  const importPattern = new RegExp(
    `(?:from\\s+|import\\s*\\(|require\\s*\\()\\s*["']@natalia\\/(?:${alternation})["']`,
    "u",
  );
  const dependencyPattern = new RegExp(
    `["']@natalia\\/(?:${alternation})["']`,
    "u",
  );
  const referencePattern = new RegExp(
    `["']\\.\\.\\/(?:${alternation})["']`,
    "u",
  );
  if (
    /packages\/client\/(?:src|test)\//u.test(normalized) &&
    !normalized.startsWith(runtimePluginCatalogDirectory) &&
    importPattern.test(text)
  )
    return "client project imports a concrete product package";
  if (
    normalized === "packages/client/package.json" &&
    dependencyPattern.test(text)
  )
    if (/-plugin["']/u.test(text)) return undefined;
    else return "client manifest depends on a concrete product package";
  if (
    normalized === "packages/client/tsconfig.json" &&
    referencePattern.test(text)
  )
    if (/-plugin["']/u.test(text)) return undefined;
    else
      return "client TypeScript project references a concrete product package";
  return undefined;
}

/**
 * Runtime configuration may depend on ordinary plugin packages so it can
 * declare the product's initial desired graph. No bundle gets privileged.
 */
const clientClosureAllowlist = [
  "agent",
  "attachments",
  "capability",
  "checkpoint",
  "collaboration",
  "compaction",
  "config",
  "context-ledger",
  "contracts",
  "governance-ledger",
  "platform",
  "plugin",
  "provider-model",
  "retry",
  "runtime",
  "runtime-config",
  "runtime-services",
  "runtime-status",
  "sandbox",
  "session",
  "session-store",
  "subagents",
  "terminal",
  "testing",
  "tool-policy",
  "tools",
  "turn-orchestration",
  "ui-model",
  "work-ledger",
  "workflow",
  "workspace",
];

/** Keep the client dependency closure free of non-kernel product packages. */
export function findClientClosureViolation(
  path: string,
  text: string,
): string | undefined {
  const normalized = path.replaceAll("\\", "/");
  const allowed = new Set(clientClosureAllowlist);
  if (normalized === "packages/client/package.json") {
    const manifest = JSON.parse(
      text.trimStart().startsWith("{") ? text : `{"dependencies":{${text}}}`,
    ) as {
      dependencies?: Record<string, string>;
    };
    for (const name of Object.keys(manifest.dependencies ?? {}))
      if (
        name === "@natalia/builtin-plugins" ||
        name === "@natalia/builtin-tool-plugins"
      )
        return `client manifest recreates deleted plugin classification ${name}`;
      else if (
        name.startsWith("@natalia/") &&
        !allowed.has(name.slice(9)) &&
        !name.startsWith("@natalia/plugin-")
      )
        return `client manifest depends on non-kernel package ${name}`;
  }
  return undefined;
}

export const migratedPluginRules: readonly MigratedPluginRule[] = [
  migratedPluginRules1[0]!,
  migratedPluginRules2[0]!,
  migratedPluginRules3[0]!,
  migratedPluginRules4[0]!,
  migratedPluginRules2[1]!,
  migratedPluginRules3[1]!,
  migratedPluginRules4[1]!,
  migratedPluginRules1[1]!,
  migratedPluginRules2[2]!,
  migratedPluginRules3[2]!,
  migratedPluginRules4[2]!,
  migratedPluginRules1[2]!,
  migratedPluginRules2[3]!,
  migratedPluginRules3[3]!,
  migratedPluginRules4[3]!,
  migratedPluginRules1[3]!,
  migratedPluginRules2[4]!,
  migratedPluginRules4[4]!,
  migratedPluginRules2[5]!,
  migratedPluginRules3[4]!,
  migratedPluginRules1[4]!,
  migratedPluginRules2[6]!,
  migratedPluginRules1[5]!,
  migratedPluginRules3[5]!,
  migratedPluginRules2[7]!,
  migratedPluginRules4[5]!,
  migratedPluginRules1[6]!,
  migratedPluginRules2[8]!,
  migratedPluginRules3[6]!,
  migratedPluginRules2[9]!,
  migratedPluginRules1[7]!,
  migratedPluginRules4[6]!,
  migratedPluginRules2[10]!,
  migratedPluginRules1[8]!,
  migratedPluginRules3[7]!,
  migratedPluginRules4[7]!,
  migratedPluginRules3[8]!,
  migratedPluginRules2[11]!,
  migratedPluginRules1[9]!,
  migratedPluginRules4[8]!,
  migratedPluginRules2[12]!,
  migratedPluginRules3[9]!,
  migratedPluginRules1[10]!,
  migratedPluginRules4[9]!,
  migratedPluginRules3[10]!,
  migratedPluginRules2[13]!,
  migratedPluginRules4[10]!,
  migratedPluginRules4[11]!,
  migratedPluginRules4[12]!,
];

export function findMigratedPluginViolations(
  path: string,
  text: string,
  rules: readonly MigratedPluginRule[] = migratedPluginRules,
): MigratedPluginViolation[] {
  const normalized = path.replaceAll("\\", "/");
  const violations: MigratedPluginViolation[] = [];
  for (const rule of rules) {
    const protectsRuntimeComposition = rule.targets.includes(
      runtimeCompositionRoot,
    );
    if (
      !rule.targets.includes(normalized) &&
      !(protectsRuntimeComposition && isRuntimeCompositionPath(normalized))
    )
      continue;
    for (const forbidden of rule.forbidden)
      if (forbidden.pattern.test(text))
        violations.push({
          pluginID: rule.id,
          description: forbidden.description,
        });
  }
  return violations;
}
