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
    "packages/agent-plugin/src/index.ts",
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
    "packages/client/src/builtin-plugins/catalog.ts",
    "built-in plugin catalog belongs to @natalia/builtin-plugins",
  ],
]);

/** Prevent deleted transitional architecture seams from being recreated. */
export function findForbiddenRepositoryPathViolation(
  path: string,
): string | undefined {
  return forbiddenRepositoryPaths.get(path.replaceAll("\\", "/"));
}

const builtinCatalogOwner = "packages/builtin-plugins/src/catalog.ts";
const productPluginImport =
  /from\s+["']@natalia\/(?:builtin-tool-plugins|[a-z-]+-plugin)["']/u;
const productPluginFactory = /\bcreate[A-Z][A-Za-z0-9]*Plugin\s*\(/u;
const migratedServiceImport = new RegExp(
  String.raw`(?:import|export)\s*(?:type\s*)?\{[^}]*\b(?:ATTACHMENT_SERVICE|AttachmentService|CHECKPOINT_FACTORY_SERVICE|CheckpointFactory|COMPACTION_SERVICE|CompactionService|CONTEXT_LEDGER_FACTORY_SERVICE|ContextLedgerFactory|GOVERNANCE_LEDGER_CONTROLLER_SERVICE|GovernanceLedgerController|InteractiveWaiter|MCP_SERVICE|McpService|PROVIDER_MODEL_CONTROLLER_SERVICE|ProviderModelController|RETRY_SERVICE|RetryService|SANDBOX_SERVICE|SandboxService|SESSION_STORE_CONTROLLER_SERVICE|SessionStoreController|STATUS_SNAPSHOT_CONTROLLER_SERVICE|StatusSnapshotController|SUBAGENTS_SERVICE|SubagentsService|TASK_WORKFLOW_CONTROLLER_SERVICE|TaskWorkflowController|TERMINAL_CONTROLLER_SERVICE|TerminalController|TOOL_POLICY_SERVICE|ToolPolicyService|TURN_CONTROLLER_SERVICE|TurnController|WORK_LEDGER_CONTROLLER_SERVICE|WorkLedgerController|WORKSPACE_FILES_SERVICE|WorkspaceFilesController|WORKSPACE_MUTATIONS_SERVICE|MutationRegistry|WORKSPACE_WRITE_LOCK_SERVICE|WorkspaceWriteLock)\b[^}]*\}\s*from\s*['"]@natalia\/(?:attachment|checkpoint|collaboration|compaction|context-ledger|governance-ledger|mcp|provider-model|retry|runtime-ui|sandbox|session-store|subagents|task-workflow|terminal|tool-pipeline|turn-orchestration|work-ledger|workspace)-plugin['"]`,
  "u",
);

/** Keep product factory assembly in the single built-in catalog owner. */
export function findBuiltinCatalogOwnershipViolation(
  path: string,
  text: string,
): string | undefined {
  const normalized = path.replaceAll("\\", "/");
  if (
    normalized.startsWith("packages/client/src/builtin-plugins/") &&
    (productPluginImport.test(text) || productPluginFactory.test(text))
  )
    return "client built-in plugin modules must not statically assemble product factories";
  if (
    normalized !== builtinCatalogOwner &&
    /\b(?:function|const)\s+builtinPluginCatalog\b/u.test(text)
  )
    return "built-in plugin catalog has more than one owner";
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
  if (
    isRuntimeCompositionPath(path.replaceAll("\\", "/")) &&
    /(?:from\s+|import\s*\()\s*["']@natalia\/(?!builtin-plugins["'])[^"']*-plugin["']/u.test(
      text,
    )
  )
    return "client runtime composition root must not import provider plugin packages";
  if (
    /packages\/client\/(?:src|test)\//u.test(path.replaceAll("\\", "/")) &&
    (migratedClientPluginSurface.test(text) ||
      clientProviderPluginIDImport.test(text))
  )
    return "client imports a migrated pure surface or plugin ID from a plugin package";
  return undefined;
}

const clientToolImplementationImport =
  /(?:from\s+|import\s*\(|require\s*\()\s*["']@natalia\/tool-(?!pipeline-plugin["'])[a-z-]+["']/u;
const clientToolImplementationDependency =
  /["']@natalia\/tool-(?!pipeline-plugin["'])[a-z-]+["']/u;
const clientToolImplementationReference =
  /["']\.\.\/tool-(?!pipeline-plugin["'])[a-z-]+["']/u;

/** Keep concrete tool implementations outside the client package boundary. */
export function findClientToolDependencyViolation(
  path: string,
  text: string,
): string | undefined {
  const normalized = path.replaceAll("\\", "/");
  if (
    /packages\/client\/(?:src|test)\//u.test(normalized) &&
    clientToolImplementationImport.test(text)
  )
    return "client project imports a concrete tool package";
  if (
    normalized === "packages/client/package.json" &&
    clientToolImplementationDependency.test(text)
  )
    return "client manifest depends on a concrete tool package";
  if (
    normalized === "packages/client/tsconfig.json" &&
    clientToolImplementationReference.test(text)
  )
    return "client TypeScript project references a concrete tool package";
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
  "sandbox",
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
    importPattern.test(text)
  )
    return "client project imports a concrete product package";
  if (
    normalized === "packages/client/package.json" &&
    dependencyPattern.test(text)
  )
    return "client manifest depends on a concrete product package";
  if (
    normalized === "packages/client/tsconfig.json" &&
    referencePattern.test(text)
  )
    return "client TypeScript project references a concrete product package";
  return undefined;
}

/**
 * Production packages the generic client runtime may depend on. Product
 * providers belong behind the built-in bundle or a service definition; tests
 * may depend on provider fixtures through devDependencies.
 */
const clientClosureAllowlist = [
  "agent",
  "builtin-plugins",
  "capability",
  "config",
  "contracts",
  "platform",
  "plugin",
  "runtime",
  "runtime-services",
  "session",
  "testing",
  "tools",
  "ui-model",
  "workflow",
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
      if (name.startsWith("@natalia/") && !allowed.has(name.slice(9)))
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
