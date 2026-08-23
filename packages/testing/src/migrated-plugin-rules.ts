export type MigratedPluginRule = {
  id: string;
  targets: readonly string[];
  forbidden: ReadonlyArray<{ description: string; pattern: RegExp }>;
};

export type MigratedPluginViolation = {
  pluginID: string;
  description: string;
};
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

const builtinCatalogOwner = "packages/builtin-plugins/src/index.ts";
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
  {
    id: "natalia-skills",
    targets: ["packages/client/src/runtime/main.ts"],
    forbidden: [
      {
        description: "legacy skills controller",
        pattern: /\bcreateSkillsController\b/u,
      },
      {
        description: "direct skills discovery",
        pattern: /\bdiscoverSkills\b/u,
      },
      {
        description: "direct skill tool construction",
        pattern: /\bcreateSkillLoadTool\b/u,
      },
      {
        description: "direct skills plugin import",
        pattern: /from\s+["']@natalia\/skills-plugin["']/u,
      },
    ],
  },
  {
    id: "natalia-tool-pdf",
    targets: ["packages/client/src/runtime/main.ts"],
    forbidden: [
      {
        description: "direct PDF package import",
        pattern: /from\s+["']@natalia\/tool-pdf["']/u,
      },
      {
        description: "direct PDF factory construction",
        pattern: /\bcreatePdf(?:Plugin|ReadTool)\b/u,
      },
    ],
  },
  {
    id: "natalia-tool-ask",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/capabilities/tool-family-capabilities.ts",
    ],
    forbidden: [
      {
        description: "direct ask package import",
        pattern: /from\s+["']@natalia\/tool-ask["']/u,
      },
      {
        description: "direct ask tool construction",
        pattern: /\b(?:askToolFamily|askTools|createAskPlugin)\b/u,
      },
    ],
  },
  {
    id: "natalia-tool-todo",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/capabilities/tool-family-capabilities.ts",
    ],
    forbidden: [
      {
        description: "direct todo package import",
        pattern: /from\s+["']@natalia\/tool-todo["']/u,
      },
      {
        description: "direct todo tool construction",
        pattern: /\b(?:todoToolFamily|todoTools|createTodoPlugin)\b/u,
      },
    ],
  },
  {
    id: "natalia-tool-search",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/capabilities/tool-family-capabilities.ts",
    ],
    forbidden: [
      {
        description: "direct search package import",
        pattern: /from\s+["']@natalia\/tool-search["']/u,
      },
      {
        description: "direct search tool construction",
        pattern: /\b(?:searchToolFamily|searchTools|createSearchPlugin)\b/u,
      },
    ],
  },
  {
    id: "natalia-tool-fs-read",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/capabilities/tool-family-capabilities.ts",
    ],
    forbidden: [
      {
        description: "direct fs-read package import",
        pattern: /from\s+["']@natalia\/tool-fs-read["']/u,
      },
      {
        description: "direct fs-read tool construction",
        pattern: /\b(?:fsReadToolFamily|readFileTools|createFsReadPlugin)\b/u,
      },
    ],
  },
  {
    id: "natalia-tool-fs-write",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/capabilities/tool-family-capabilities.ts",
    ],
    forbidden: [
      {
        description: "direct fs-write package import",
        pattern: /from\s+["']@natalia\/tool-fs-write["']/u,
      },
      {
        description: "direct fs-write tool construction",
        pattern:
          /\b(?:fsWriteToolFamily|writeFileTools|createFsWritePlugin)\b/u,
      },
    ],
  },
  {
    id: "natalia-tool-web",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/capabilities/tool-family-capabilities.ts",
    ],
    forbidden: [
      {
        description: "direct web package import",
        pattern: /from\s+["']@natalia\/tool-web["']/u,
      },
      {
        description: "direct web tool construction",
        pattern: /\b(?:webToolFamily|webTools|createWebPlugin)\b/u,
      },
    ],
  },
  {
    id: "natalia-tool-shell",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/capabilities/tool-family-capabilities.ts",
    ],
    forbidden: [
      {
        description: "direct shell package import",
        pattern: /from\s+["']@natalia\/tool-shell["']/u,
      },
      {
        description: "direct shell tool construction",
        pattern: /\b(?:shellToolFamily|shellTools|createShellPlugin)\b/u,
      },
    ],
  },
  {
    id: "natalia-tool-agent",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/capabilities/tool-family-capabilities.ts",
    ],
    forbidden: [
      {
        description: "direct agent package import",
        pattern: /from\s+["']@natalia\/tool-agent["']/u,
      },
      {
        description: "direct agent tool construction",
        pattern: /\b(?:agentToolFamily|agentTools|createAgentPlugin)\b/u,
      },
    ],
  },
  {
    id: "natalia-tool-terminal",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/capabilities/tool-family-capabilities.ts",
    ],
    forbidden: [
      {
        description: "direct terminal package import",
        pattern: /from\s+["']@natalia\/tool-terminal["']/u,
      },
      {
        description: "direct terminal tool construction",
        pattern:
          /\b(?:terminalToolFamily|terminalTools|createTerminalPlugin)\b/u,
      },
    ],
  },
  {
    id: "natalia-tool-sandbox",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/capabilities/tool-family-capabilities.ts",
    ],
    forbidden: [
      {
        description: "direct sandbox package import",
        pattern: /from\s+["']@natalia\/tool-sandbox["']/u,
      },
      {
        description: "direct sandbox tool construction",
        pattern: /\b(?:sandboxToolFamily|sandboxTools|createSandboxPlugin)\b/u,
      },
    ],
  },
  {
    id: "natalia-tool-process",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/capabilities/tool-family-capabilities.ts",
    ],
    forbidden: [
      {
        description: "direct process package import",
        pattern: /from\s+["']@natalia\/tool-process["']/u,
      },
      {
        description: "direct process tool construction",
        pattern:
          /\b(?:processToolFamily|managedProcessTools|createProcessPlugin|ManagedProcessRegistry)\b/u,
      },
    ],
  },
  {
    id: "natalia-task-module",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/task-module-plugin.ts",
      "packages/client/src/capabilities/task-module-tools.ts",
    ],
    forbidden: [
      {
        description: "task module tool construction",
        pattern:
          /\b(?:registerTaskModuleCapability|taskModuleCapability|taskModuleTools)\b/u,
      },
      {
        description: "direct task module implementation import",
        pattern:
          /from\s+["'](?:\.\/task-module-plugin|\.\/builtin-plugins\/task-module-plugin|\.\/capabilities\/task-module-tools|\.\.\/capabilities\/task-module-tools)["']/u,
      },
      {
        description: "direct task module plugin package import",
        pattern: /from\s+["']@natalia\/task-module-plugin["']/u,
      },
      {
        description: "client-owned task module implementation",
        pattern:
          /export\s+(?:async\s+)?function\s+(?:taskModuleTools|createTaskModulePlugin|createFlowModuleCompleteTool|createReportIssueTool|createReadDataSourceTool)\b/u,
      },
    ],
  },
  {
    id: "natalia-runtime-config",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/runtime-config-plugin.ts",
    ],
    forbidden: [
      {
        description: "direct runtime config implementation import",
        pattern:
          /from\s+["'](?:\.\/runtime-config-plugin|\.\/builtin-plugins\/runtime-config-plugin)["']/u,
      },
      {
        description: "runtime config capability registration",
        pattern:
          /\b(?:registerRuntimeConfigCapability|RUNTIME_CONFIG_CAPABILITY_ID)\b/u,
      },
    ],
  },
  {
    id: "natalia-local-tools",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/local-tools-plugin.ts",
      "packages/client/src/capabilities/local-tool-families.ts",
    ],
    forbidden: [
      {
        description: "direct local family loading",
        pattern:
          /\b(?:loadLocalToolFamilies|reloadLocalToolFamily|watchLocalToolFamilies)\b/u,
      },
      {
        description: "direct local tools implementation import",
        pattern:
          /from\s+["'](?:\.\/(?:builtin-plugins\/)?local-tools-plugin|\.\/capabilities\/local-tool-families|\.\.\/capabilities\/local-tool-families)["']/u,
      },
      {
        description: "client-owned local tools implementation",
        pattern:
          /export (?:async )?function (?:createLocalToolsPlugin|discoverLocalToolFamilies|loadLocalToolFamilies|reloadLocalToolFamily|watchLocalToolFamilies)\b/u,
      },
    ],
  },
  {
    id: "natalia-tool-plugins",
    targets: ["packages/client/src/runtime/main.ts"],
    forbidden: [
      {
        description: "legacy built-in tool-family bootstrap",
        pattern:
          /\b(?:applyToolFamilyEnabledFilter|builtinToolFamilies|createToolRegistryFromCapabilities|registerToolFamilyCapabilities)\b/u,
      },
    ],
  },
  {
    id: "natalia-workspace",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/workspace-plugin.ts",
      "packages/client/src/mutation-registry.ts",
      "packages/client/src/workspace-change-auditor.ts",
      "packages/client/src/workspace-files-controller.ts",
      "packages/client/src/workspace-files.ts",
      "packages/client/src/workspace-observation.ts",
      "packages/client/src/workspace-write-lock.ts",
    ],
    forbidden: [
      {
        description: "direct workspace component construction",
        pattern:
          /\b(?:createWorkspaceWriteLock|createMutationRegistry|createWorkspaceFilesController)\b/u,
      },
      {
        description: "direct workspace implementation import",
        pattern:
          /from\s+["'](?:\.\.?\/)*(?:mutation-registry|workspace-change-auditor|workspace-files-controller|workspace-files|workspace-observation|workspace-write-lock|workspace-plugin|builtin-plugins\/workspace-plugin)["']/u,
      },
      {
        description: "client-owned workspace implementation",
        pattern:
          /export (?:async )?function (?:createWorkspacePlugin|createWorkspaceChangeAuditor|findWorkspaceFiles|watchWorkspaceFiles)\b/u,
      },
    ],
  },
  {
    id: "natalia-terminal",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/tools/src/types.ts",
      "packages/tool-terminal/src/index.ts",
      "packages/terminal-plugin/src/index.ts",
    ],
    forbidden: [
      {
        description: "direct terminal controller construction",
        pattern: /\bcreateTerminalController\b/u,
      },
      {
        description: "concrete native terminal type in client composition",
        pattern: /\b(?:NativeTerminalRegistry|NativeTerminalSession)\b/u,
      },
      {
        description: "terminal controller backend escape hatch",
        pattern: /\bterminalController\?*\.get\s*\(/u,
      },
      {
        description: "client-owned native terminal session projection",
        pattern: /\bpublicNativeTerminal\b/u,
      },
    ],
  },
  {
    id: "natalia-sandbox",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/tools/src/types.ts",
      "packages/tool-sandbox/src/index.ts",
      "packages/team-plugin/src/fan-out.ts",
      "packages/team-plugin/src/team-tools.ts",
      "packages/team-plugin/src/team-plugin.ts",
      "packages/sandbox-plugin/src/index.ts",
    ],
    forbidden: [
      {
        description: "direct sandbox implementation import",
        pattern: /from\s+["']@natalia\/sandbox["']/u,
      },
      {
        description: "direct sandbox controller construction",
        pattern: /\bcreateSandboxController\b/u,
      },
      {
        description: "concrete sandbox backend type in service consumers",
        pattern:
          /\b(?:WorkspaceSandboxManager|SnapshotSandboxManager|WorktreeSandboxManager)\b/u,
      },
      {
        description: "sandbox controller backend escape hatch",
        pattern: /\bsandboxController\?*\.get\s*\(/u,
      },
      {
        description: "concrete sandbox controller type outside its owner",
        pattern: /\bSandboxController\b/u,
      },
      {
        description: "legacy sandbox controller service",
        pattern: /\bSANDBOX_CONTROLLER_SERVICE\b|["']sandbox\.controller["']/u,
      },
    ],
  },
  {
    id: "natalia-subagents",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/tools/src/types.ts",
      "packages/tool-agent/src/index.ts",
      "packages/team-plugin/src/fan-out.ts",
      "packages/team-plugin/src/team-tools.ts",
      "packages/team-plugin/src/team-plugin.ts",
      "packages/subagents-plugin/src/index.ts",
    ],
    forbidden: [
      {
        description: "direct subagent implementation import",
        pattern: /from\s+["']@natalia\/subagent["']/u,
      },
      {
        description: "concrete subagent backend type in service consumers",
        pattern: /\bSubagentRegistry\b/u,
      },
      {
        description: "subagents controller backend escape hatch",
        pattern: /\bsubagentsController\?*\.get\s*\(\s*\)/u,
      },
      {
        description: "concrete subagents controller type outside its owner",
        pattern: /\bSubagentsController\b/u,
      },
      {
        description: "legacy subagents controller service",
        pattern:
          /\bSUBAGENTS_CONTROLLER_SERVICE\b|["']subagents\.controller["']/u,
      },
    ],
  },
  {
    id: "natalia-mcp",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/provider-model-plugin/src/provider-runner.ts",
    ],
    forbidden: [
      {
        description: "direct mcp controller construction",
        pattern: /\bcreateMcpController\b/u,
      },
      {
        description: "concrete mcp controller type outside its owner",
        pattern: /\bMcpController\b/u,
      },
      {
        description: "mcp access collection escape hatch",
        pattern: /\b(?:McpAccess|mcpAccess)\b/u,
      },
      {
        description: "legacy mcp controller service",
        pattern: /\bMCP_CONTROLLER_SERVICE\b/u,
      },
    ],
  },
  {
    id: "natalia-mcp",
    targets: [
      "packages/mcp-plugin/src/index.ts",
      "packages/mcp-plugin/src/mcp-controller-plugin.ts",
    ],
    forbidden: [
      {
        description: "concrete mcp controller exported by public barrel",
        pattern:
          /export\s+(?:type\s+)?\{[^}]*\b(?:McpAccess|McpController)\b[^}]*\}\s+from\s+["']\.\/mcp-controller["']/u,
      },
      {
        description: "legacy mcp controller service exported publicly",
        pattern: /\bMCP_CONTROLLER_SERVICE\b/u,
      },
      {
        description: "legacy mcp controller plugin exported publicly",
        pattern: /\bcreateMcpControllerPlugin\b/u,
      },
    ],
  },
  {
    id: "natalia-mcp",
    targets: [
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/mcp-plugin/src/mcp-runtime.ts",
      "packages/mcp-plugin/src/mcp-controller.ts",
      "packages/mcp-plugin/src/mcp-controller-plugin.ts",
    ],
    forbidden: [
      {
        description: "raw MCP tool registry wiring",
        pattern: /\bToolRegistry\b/u,
      },
    ],
  },
  {
    id: "natalia-checkpoint",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/checkpoint-controller-plugin.ts",
      "packages/client/src/checkpoint-controller.ts",
    ],
    forbidden: [
      {
        description: "direct checkpoint controller construction",
        pattern: /\bcreateCheckpointController\b/u,
      },
      {
        description: "direct checkpoint implementation import",
        pattern:
          /from\s+["'](?:\.\/checkpoint-controller|\.\.\/checkpoint-controller|\.\/checkpoint-controller-plugin|\.\/builtin-plugins\/checkpoint-controller-plugin)["']/u,
      },
      {
        description: "client-owned checkpoint plugin implementation",
        pattern: /export function createCheckpointControllerPlugin\b/u,
      },
    ],
  },
  {
    id: "natalia-subagents",
    targets: ["packages/client/src/runtime/main.ts"],
    forbidden: [
      {
        description: "direct subagents controller construction",
        pattern: /\bcreateSubagentsController\b/u,
      },
    ],
  },
  {
    id: "natalia-session-store",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/turn-orchestration-plugin.ts",
      "packages/client/src/session-store-controller.ts",
      "packages/client/src/builtin-plugins/session-store-controller-plugin.ts",
    ],
    forbidden: [
      {
        description: "direct session store implementation import",
        pattern:
          /from\s+["'](?:\.\/session-store-controller|\.\/session-store-controller-plugin|\.\/builtin-plugins\/session-store-controller-plugin)["']/u,
      },
      {
        description: "direct session store controller construction",
        pattern: /\bcreateSessionStoreController\b/u,
      },
      {
        description: "concrete session store type outside testing fixture",
        pattern: /\b(?:JsonSessionStore|SqliteSessionStore)\b/u,
      },
      {
        description: "session store backend accessor",
        pattern: /\bsessionStoreController\?*\.(?:json|sqlite)\s*\(/u,
      },
    ],
  },
  {
    id: "natalia-session-store",
    targets: [
      "packages/client/test/real-runtime.test.ts",
      "packages/client/test/session-store-controller.test.ts",
    ],
    forbidden: [
      {
        description: "concrete session store type outside testing fixture",
        pattern: /\b(?:JsonSessionStore|SqliteSessionStore)\b/u,
      },
      {
        description: "session store backend accessor",
        pattern: /\bcontroller\.(?:json|sqlite)\s*\(/u,
      },
    ],
  },
  {
    id: "natalia-session-store",
    targets: ["packages/session-store-plugin/src/index.ts"],
    forbidden: [
      {
        description: "concrete session store exported by plugin barrel",
        pattern:
          /export\s+(?:type\s+)?\{[^}]*\b(?:JsonSessionStore|SqliteSessionStore)\b[^}]*\}/u,
      },
    ],
  },
  {
    id: "natalia-team",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/index.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/team-plugin.ts",
      "packages/client/src/team-tools.ts",
      "packages/client/src/fan-out.ts",
      "packages/client/src/agent-team-prompts.ts",
    ],
    forbidden: [
      {
        description: "direct team tool construction",
        pattern: /\b(?:createTeamFanoutTool|createTeamReviewTool)\b/u,
      },
      {
        description: "direct team implementation import",
        pattern:
          /from\s+["'](?:\.\/(?:builtin-plugins\/)?team-plugin|\.\/team-tools|\.\/fan-out|\.\/agent-team-prompts|\.\.\/team-tools|\.\.\/fan-out)["']/u,
      },
      {
        description: "direct team plugin package import",
        pattern: /from\s+["']@natalia\/team-plugin["']/u,
      },
      {
        description: "client-owned team implementation",
        pattern:
          /export\s+(?:async\s+)?(?:function|const)\s+(?:createTeamPlugin|createTeamFanoutTool|createTeamReviewTool|runFanOut|reviewPRs|validateOwnershipMap|ORCHESTRATOR_SYSTEM_PROMPT|TEAM_MODE_DIRECTIVE)\b/u,
      },
    ],
  },
  {
    id: "natalia-tool-pipeline",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/tool-pipeline-plugin.ts",
      "packages/client/src/tool-policy.ts",
      "packages/client/src/bash-command-policy.ts",
    ],
    forbidden: [
      {
        description: "direct policy construction in the host",
        pattern:
          /(?<!\.)\b(?:createToolPolicyHookLayer|evaluatePermissionRules|workspaceWritePathForTool|commandTextForTool)\b/u,
      },
      {
        description: "direct tool pipeline implementation import",
        pattern:
          /from\s+["'](?:\.\/(?:builtin-plugins\/)?tool-pipeline-plugin|\.\/tool-policy|\.\/bash-command-policy|\.\.\/tool-policy|\.\.\/bash-command-policy)["']/u,
      },
      {
        description: "client-owned tool pipeline implementation",
        pattern:
          /export\s+(?:async\s+)?(?:function|class|const)\s+(?:createToolPipelinePlugin|createToolPolicyHookLayer|evaluatePermissionRules|TerminalCommandBuffer|parseBashSimpleCommand)\b/u,
      },
    ],
  },
  {
    id: "natalia-collaboration",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/collaboration-plugin.ts",
      "packages/client/src/interactive-waiter.ts",
      "packages/client/src/mailbox-ledger.ts",
      "packages/client/src/mailbox-tool.ts",
    ],
    forbidden: [
      {
        description: "direct waiter construction in the host",
        pattern: /\bcreateInteractiveWaiter\b/u,
      },
      {
        description: "direct collaboration implementation import",
        pattern:
          /from\s+["'](?:\.\.?\/)*(?:interactive-waiter|mailbox-ledger|mailbox-tool|collaboration-plugin|builtin-plugins\/collaboration-plugin)["']/u,
      },
      {
        description: "client-owned collaboration implementation",
        pattern:
          /export function (?:createCollaborationPlugin|buildMailboxQueued|buildMailboxStatus|createMailboxAcknowledgeTool)\b/u,
      },
    ],
  },
  {
    id: "natalia-provider-model",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/provider-model-plugin.ts",
      "packages/client/src/provider-model-controller.ts",
      "packages/client/src/provider-runner.ts",
    ],
    forbidden: [
      {
        description: "direct provider runner construction in the host",
        pattern: /(?<!\.)\bcreateProviderRunner\b/u,
      },
      {
        description: "host-owned provider runner cache",
        pattern: /(?<!\.)\brunnerBySession\b/u,
      },
      {
        description: "host-owned live chat abort state",
        pattern: /(?<!\.)\bchatAbort\b/u,
      },
      {
        description: "direct provider model implementation import",
        pattern:
          /from\s+["'](?:\.\/provider-model-controller|\.\/provider-runner|\.\/provider-model-plugin|\.\/builtin-plugins\/provider-model-plugin)["']/u,
      },
      {
        description: "direct provider model plugin package import",
        pattern: /from\s+["']@natalia\/provider-model-plugin["']/u,
      },
      {
        description: "client-owned provider model plugin construction",
        pattern: /export function createProviderModelPlugin\b/u,
      },
      {
        description: "client-owned provider model controller",
        pattern: /export function createProviderModelController\b/u,
      },
    ],
  },
  {
    id: "natalia-task-workflow",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/task-workflow-plugin.ts",
      "packages/client/src/task-workflow-controller.ts",
      "packages/client/src/task-preflight.ts",
      "packages/client/src/task-document.ts",
      "packages/client/src/flow-document.ts",
      "packages/client/src/task-overview.ts",
      "packages/client/src/workflow-document-catalog.ts",
      "packages/client/src/workflow-contributions.ts",
      "packages/client/src/systemd-adapter.ts",
    ],
    forbidden: [
      {
        description: "direct task/workflow implementation import",
        pattern:
          /from\s+["'](?:\.\.?\/)*(?:task-workflow-controller|task-preflight|task-document|flow-document|workflow-contributions|systemd-adapter|task-workflow-plugin|builtin-plugins\/task-workflow-plugin)["']/u,
      },
      {
        description: "direct workflow document store access",
        pattern: /(?<!\.)\bNataliaDocumentStore\b/u,
      },
      {
        description: "client-owned task workflow implementation",
        pattern:
          /export (?:async )?function (?:createTaskWorkflowPlugin|createTaskWorkflowController|saveTaskDocument|saveFlowDocument|configureTaskSystemd|workflowContributionsProjection)\b/u,
      },
    ],
  },
  {
    id: "natalia-workflow-scheduler",
    targets: [
      "packages/client/src/index.ts",
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/capability-execution-host.ts",
      "packages/client/src/worker.ts",
      "packages/client/src/workflow-execution-scheduler.ts",
      "packages/client/src/builtin-plugins/workflow-scheduler-plugin.ts",
      "packages/client/test/capability-execution-host.test.ts",
      "packages/client/test/worker.test.ts",
      "apps/cli/src/command-dispatcher.ts",
      "apps/tui/src/runtime-worker.ts",
    ],
    forbidden: [
      {
        description: "direct workflow scheduler construction",
        pattern: /\bnew\s+WorkflowExecutionScheduler\b/u,
      },
      {
        description: "direct workflow scheduler implementation import",
        pattern:
          /from\s+["'](?:\.\.?\/)*(?:workflow-execution-scheduler|workflow-scheduler-plugin|builtin-plugins\/workflow-scheduler-plugin)["']/u,
      },
      {
        description: "client-owned workflow scheduler implementation",
        pattern:
          /export (?:class WorkflowExecutionScheduler|function createWorkflowSchedulerPlugin)\b/u,
      },
      {
        description: "concrete workflow scheduler type outside its owner",
        pattern: /\bWorkflowExecutionScheduler\b/u,
      },
      {
        description: "workflow scheduler host imported through client facade",
        pattern:
          /import\s*\{[^}]*\bcreateWorkflowSchedulerPluginHost\b[^}]*\}\s*from\s*["']@natalia\/client["']/u,
      },
    ],
  },
  {
    id: "natalia-workflow-scheduler",
    targets: [
      "packages/client/src/index.ts",
      "packages/workflow-scheduler-plugin/src/index.ts",
      "packages/workflow-scheduler-plugin/src/workflow-scheduler-plugin.ts",
    ],
    forbidden: [
      {
        description: "workflow scheduler composition re-exported by client",
        pattern:
          /export\s+(?:type\s+)?\{[^}]*\b(?:createWorkflowSchedulerPluginHost|WORKFLOW_SCHEDULER_PLUGIN_ID|WORKFLOW_SCHEDULER_SERVICE)\b[^}]*\}\s+from\s+["']@natalia\/workflow-scheduler-plugin["']/u,
      },
      {
        description: "concrete workflow scheduler exported by public barrel",
        pattern:
          /export\s+(?:type\s+)?\{[^}]*\bWorkflowExecutionScheduler\b[^}]*\}\s+from\s+["']\.\/workflow-execution-scheduler["']/u,
      },
      {
        description: "workflow scheduler host generic service escape hatch",
        pattern:
          /return\s*\{\s*scheduler\s*,[\s\S]{0,200}?\bservice\s*:\s*<T>\s*\([^)]*\)\s*=>/u,
      },
    ],
  },
  {
    id: "natalia-context-ledger",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/compaction-service.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/compaction-plugin.ts",
    ],
    forbidden: [
      {
        description: "direct context ledger implementation import",
        pattern:
          /from\s+["'](?:\.\/context-ledger-factory|\.\/context-ledger-plugin|\.\/builtin-plugins\/context-ledger-plugin)["']/u,
      },
      {
        description: "direct context ledger construction",
        pattern: /\bnew\s+ContextLedger\b/u,
      },
      {
        description: "host-owned context event recovery",
        pattern: /\brestoreContextFromEvents\b/u,
      },
    ],
  },
  {
    id: "natalia-work-ledger",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/interactive-waiter.ts",
      "packages/client/src/checkpoint-controller.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/governance-ledger-plugin.ts",
      "packages/client/src/builtin-plugins/work-ledger-plugin.ts",
      "packages/client/src/work-ledger-controller.ts",
      "packages/client/src/plan-ledger.ts",
      "packages/client/src/drift-evaluator.ts",
      "packages/client/src/work-graph.ts",
    ],
    forbidden: [
      {
        description: "direct work ledger implementation import",
        pattern:
          /from\s+["'](?:\.\.?\/)*(?:plan-ledger|drift-evaluator|work-graph|work-ledger-controller|work-ledger-plugin|builtin-plugins\/work-ledger-plugin)["']/u,
      },
      {
        description: "client-owned work ledger implementation",
        pattern:
          /export function (?:createWorkLedgerPlugin|createWorkLedgerController|buildPlanDraftCreated|createDriftEvaluator)\b/u,
      },
      {
        description: "client-owned work graph implementation",
        pattern: /export const WORK_GRAPH_KIND\b/u,
      },
    ],
  },
  {
    id: "natalia-governance-ledger",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/governance-ledger-plugin.ts",
      "packages/client/src/governance-ledger-controller.ts",
      "packages/client/src/constitution-ledger.ts",
      "packages/client/src/evidence-ledger.ts",
    ],
    forbidden: [
      {
        description: "direct governance ledger implementation import",
        pattern:
          /from\s+["'](?:\.\.?\/)*(?:constitution-ledger|evidence-ledger|governance-ledger-controller|governance-ledger-plugin|builtin-plugins\/governance-ledger-plugin)["']/u,
      },
      {
        description: "client-owned governance ledger implementation",
        pattern:
          /export (?:const SELF_PROTECTION_RULES|function (?:createGovernanceLedgerPlugin|createGovernanceLedgerController|seedConstitutionRules|recordDecision|buildEvidenceRecorded|buildCompletionRecorded))/u,
      },
    ],
  },
  {
    id: "natalia-turn-orchestration",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/turn-orchestration-plugin.ts",
      "packages/client/src/turn-controller.ts",
    ],
    forbidden: [
      {
        description: "direct turn controller implementation import",
        pattern:
          /from\s+["'](?:\.\/turn-controller|\.\.\/turn-controller|\.\/builtin-plugins\/turn-orchestration-plugin|\.\/turn-orchestration-plugin)["']/u,
      },
      {
        description: "direct turn controller construction",
        pattern: /\bcreateTurnController\b/u,
      },
      {
        description: "client-owned turn orchestration implementation",
        pattern: /export function createTurnOrchestrationPlugin\b/u,
      },
    ],
  },
  {
    id: "natalia-retry",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/provider-runner.ts",
      "packages/client/src/compaction-service.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/compaction-plugin.ts",
      "packages/client/src/builtin-plugins/provider-model-plugin.ts",
    ],
    forbidden: [
      {
        description: "direct retry implementation import",
        pattern:
          /from\s+["'](?:\.\/retry-service|\.\/retry-plugin|\.\/builtin-plugins\/retry-plugin)["']/u,
      },
      {
        description: "direct retry runner use",
        pattern: /\b(?:runWithRetry|runStreamingWithRetry)\b/u,
      },
    ],
  },
  {
    id: "natalia-attachment",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/provider-runner.ts",
      "packages/client/src/session-store-controller.ts",
      "packages/client/src/index.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/provider-model-plugin.ts",
      "packages/client/src/builtin-plugins/session-store-controller-plugin.ts",
      "apps/cli/src/index.ts",
    ],
    forbidden: [
      {
        description: "direct attachment implementation import",
        pattern:
          /from\s+["'](?:\.\/attachments|\.\/attachment-service|\.\/attachment-plugin|\.\/builtin-plugins\/attachment-plugin)["']/u,
      },
    ],
  },
  {
    id: "natalia-attachment",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/provider-runner.ts",
      "packages/client/src/session-store-controller.ts",
    ],
    forbidden: [
      {
        description: "direct attachment helper use",
        pattern:
          /\b(?:attachmentDataURL|attachmentText|cleanupUnreferencedAttachments|isTextAttachment|referencedAttachmentsForSessions|storeLocalAttachments)\b/u,
      },
    ],
  },
  {
    id: "natalia-compaction",
    targets: [
      "packages/client/src/provider-runner.ts",
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/provider-model-plugin.ts",
    ],
    forbidden: [
      {
        description: "direct compaction implementation import",
        pattern:
          /from\s+["'](?:\.\/compaction-service|\.\/compaction-plugin|\.\/builtin-plugins\/compaction-plugin)["']/u,
      },
      {
        description: "direct compaction runtime orchestration",
        pattern:
          /\b(?:compactContext|compactionTrigger|providerCompactor|recoverContextLimitOnce)\b/u,
      },
    ],
  },
  {
    id: "natalia-transport",
    targets: ["apps/cli/src/command-dispatcher.ts"],
    forbidden: [
      {
        description: "direct HTTP transport server lifecycle",
        pattern: /\bcreateRuntimeHttpServer\b/u,
      },
    ],
  },
  {
    id: "natalia-cli",
    targets: ["apps/cli/src/main.ts"],
    forbidden: [
      {
        description: "direct CLI command dispatcher lifecycle",
        pattern:
          /(?:from\s+["']\.\/command-dispatcher["']|\bcreateRealRuntimeClient\b|\bcreateHttpTransportPluginHost\b|\bcreateWorkflowSchedulerPluginHost\b)/u,
      },
    ],
  },
  {
    id: "natalia-tui",
    targets: ["apps/tui/src/main.tsx"],
    forbidden: [
      {
        description: "direct TUI renderer lifecycle",
        pattern: /\b(?:runTuiShell|createCliRenderer)\b/u,
      },
      {
        description: "direct TUI worker lifecycle",
        pattern: /\b(?:createWorkerRuntimeClient|MessageChannel|Worker)\b/u,
      },
    ],
  },
  {
    id: "natalia-runtime-ui",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/runtime-ui-plugin.ts",
      "packages/client/src/status-controller.ts",
    ],
    forbidden: [
      {
        description: "direct status controller construction",
        pattern: /\bcreateStatusSnapshotController\b/u,
      },
      {
        description: "client-owned runtime UI implementation import",
        pattern:
          /from\s+["'](?:\.\/status-controller|\.\.\/status-controller|\.\/runtime-ui-plugin|\.\/builtin-plugins\/runtime-ui-plugin)["']/u,
      },
      {
        description: "client-owned runtime UI implementation",
        pattern: /export function (?:createRuntimeUiPlugin|statusSnapshot)\b/u,
      },
    ],
  },
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
