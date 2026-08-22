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
    "packages/client/src/runtime-assembly.ts",
    "runtime assembly must remain in the composition root until metadata-driven loading replaces it",
  ],
]);

/** Prevent deleted transitional architecture seams from being recreated. */
export function findForbiddenRepositoryPathViolation(
  path: string,
): string | undefined {
  return forbiddenRepositoryPaths.get(path.replaceAll("\\", "/"));
}

const clientToolImplementationImport =
  /(?:from\s+|import\s*\(|require\s*\()\s*["']@natalia\/tool-[a-z-]+["']/u;
const clientToolImplementationDependency = /["']@natalia\/tool-[a-z-]+["']/u;
const clientToolImplementationReference = /["']\.\.\/tool-[a-z-]+["']/u;

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
  "agent",
  "mcp",
  "native-terminal",
  "sandbox",
  "skills",
  "subagent",
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
 * Allowlist of packages the client composition root may depend on: the kernel,
 * built-in plugin host packages and testing utilities. Any other @natalia
 * workspace dependency is a concrete product package leaking back into the
 * client closure and must be rejected (Phase 4 dependency closure).
 */
const clientClosureAllowlist = [
  "agent-plugin",
  "attachment-plugin",
  "builtin-tool-plugins",
  "capability",
  "checkpoint-plugin",
  "collaboration-plugin",
  "compaction-plugin",
  "config",
  "context-ledger-plugin",
  "contracts",
  "governance-ledger-plugin",
  "mcp-plugin",
  "object-store",
  "platform",
  "plugin",
  "provider-model-plugin",
  "runtime",
  "retry-plugin",
  "runtime-config-plugin",
  "runtime-ui-plugin",
  "sandbox-plugin",
  "session",
  "session-store-plugin",
  "skills-plugin",
  "subagents-plugin",
  "task-workflow-plugin",
  "terminal-plugin",
  "testing",
  "tools",
  "turn-orchestration-plugin",
  "ui-model",
  "work-ledger-plugin",
  "workspace-plugin",
  "workflow",
  "workflow-scheduler-plugin",
];

/** Keep the client dependency closure free of non-kernel product packages. */
export function findClientClosureViolation(
  path: string,
  text: string,
): string | undefined {
  const normalized = path.replaceAll("\\", "/");
  const allowed = new Set(clientClosureAllowlist);
  if (normalized === "packages/client/package.json") {
    const dependencyPattern = /"@natalia\/([a-z0-9-]+)":\s*"workspace:\*"/gu;
    for (const match of text.matchAll(dependencyPattern)) {
      const name = match[1];
      if (!allowed.has(name))
        return `client manifest depends on non-kernel package @natalia/${name}`;
    }
  }
  if (normalized === "packages/client/tsconfig.json") {
    const referencePattern = /"(\.\.\/)([a-z0-9-]+)"/gu;
    for (const match of text.matchAll(referencePattern)) {
      const name = match[2];
      if (!allowed.has(name))
        return `client TypeScript project references non-kernel package ${name}`;
    }
  }
  return undefined;
}

export const migratedPluginRules: readonly MigratedPluginRule[] = [
  {
    id: "natalia-skills",
    targets: ["packages/client/src/real-runtime.ts"],
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
    ],
  },
  {
    id: "natalia-tool-pdf",
    targets: ["packages/client/src/real-runtime.ts"],
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
      {
        description: "task module tool construction",
        pattern:
          /\b(?:registerTaskModuleCapability|taskModuleCapability|taskModuleTools)\b/u,
      },
    ],
  },
  {
    id: "natalia-runtime-config",
    targets: [
      "packages/client/src/real-runtime.ts",
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
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
      {
        description: "direct local family loading",
        pattern:
          /\b(?:loadLocalToolFamilies|reloadLocalToolFamily|watchLocalToolFamilies)\b/u,
      },
    ],
  },
  {
    id: "natalia-tool-plugins",
    targets: ["packages/client/src/real-runtime.ts"],
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
      "packages/client/src/real-runtime.ts",
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
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
      {
        description: "direct terminal controller construction",
        pattern: /\bcreateTerminalController\b/u,
      },
    ],
  },
  {
    id: "natalia-sandbox",
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
      {
        description: "direct sandbox implementation import",
        pattern: /from\s+["']@natalia\/sandbox["']/u,
      },
      {
        description: "direct sandbox controller construction",
        pattern: /\bcreateSandboxController\b/u,
      },
    ],
  },
  {
    id: "natalia-mcp",
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
      {
        description: "direct mcp controller construction",
        pattern: /\bcreateMcpController\b/u,
      },
    ],
  },
  {
    id: "natalia-checkpoint",
    targets: [
      "packages/client/src/real-runtime.ts",
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
    targets: ["packages/client/src/real-runtime.ts"],
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
      "packages/client/src/real-runtime.ts",
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
    ],
  },
  {
    id: "natalia-team",
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
      {
        description: "direct team tool construction",
        pattern: /\b(?:createTeamFanoutTool|createTeamReviewTool)\b/u,
      },
    ],
  },
  {
    id: "natalia-tool-pipeline",
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
      {
        description: "direct policy construction in the host",
        pattern:
          /(?<!\.)\b(?:createToolPolicyHookLayer|evaluatePermissionRules|workspaceWritePathForTool|commandTextForTool)\b/u,
      },
    ],
  },
  {
    id: "natalia-collaboration",
    targets: [
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/capability-execution-host.ts",
      "packages/client/src/worker.ts",
      "packages/client/src/workflow-execution-scheduler.ts",
      "packages/client/src/builtin-plugins/workflow-scheduler-plugin.ts",
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
    ],
  },
  {
    id: "natalia-context-ledger",
    targets: [
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
      "packages/client/src/real-runtime.ts",
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
    if (!rule.targets.includes(normalized)) continue;
    for (const forbidden of rule.forbidden)
      if (forbidden.pattern.test(text))
        violations.push({
          pluginID: rule.id,
          description: forbidden.description,
        });
  }
  return violations;
}
