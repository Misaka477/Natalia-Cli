export type MigratedPluginRule = {
  id: string;
  targets: readonly string[];
  forbidden: ReadonlyArray<{ description: string; pattern: RegExp }>;
};

export type MigratedPluginViolation = {
  pluginID: string;
  description: string;
};

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
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
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
    id: "natalia-workspace",
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
      {
        description: "direct workspace component construction",
        pattern:
          /\b(?:createWorkspaceWriteLock|createMutationRegistry|createWorkspaceFilesController)\b/u,
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
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
      {
        description: "direct checkpoint controller construction",
        pattern: /\bcreateCheckpointController\b/u,
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
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
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
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
      {
        description: "direct waiter construction in the host",
        pattern: /\bcreateInteractiveWaiter\b/u,
      },
    ],
  },
  {
    id: "natalia-provider-model",
    targets: ["packages/client/src/real-runtime.ts"],
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
    ],
  },
  {
    id: "natalia-task-workflow",
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
      {
        description: "direct task/workflow implementation import",
        pattern:
          /from\s+["']\.\/(?:task-controller|task-preflight|task-document|flow-document|task-overview|workflow-document-catalog|workflow-contributions)["']/u,
      },
      {
        description: "direct workflow document store access",
        pattern: /(?<!\.)\bNataliaDocumentStore\b/u,
      },
    ],
  },
  {
    id: "natalia-workflow-scheduler",
    targets: [
      "packages/client/src/capability-execution-host.ts",
      "apps/cli/src/command-dispatcher.ts",
      "apps/tui/src/runtime-worker.ts",
    ],
    forbidden: [
      {
        description: "direct workflow scheduler construction",
        pattern: /\bnew\s+WorkflowExecutionScheduler\b/u,
      },
    ],
  },
  {
    id: "natalia-context-ledger",
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
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
    ],
    forbidden: [
      {
        description: "direct work ledger implementation import",
        pattern:
          /from\s+["']\.\/(?:plan-ledger|drift-evaluator|work-graph)["']/u,
      },
    ],
  },
  {
    id: "natalia-governance-ledger",
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
      {
        description: "direct governance ledger implementation import",
        pattern: /from\s+["']\.\/(?:constitution-ledger|evidence-ledger)["']/u,
      },
    ],
  },
  {
    id: "natalia-turn-orchestration",
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
      {
        description: "direct turn controller implementation import",
        pattern: /from\s+["']\.\/turn-controller["']/u,
      },
      {
        description: "direct turn controller construction",
        pattern: /\bcreateTurnController\b/u,
      },
    ],
  },
  {
    id: "natalia-retry",
    targets: [
      "packages/client/src/real-runtime.ts",
      "packages/client/src/provider-runner.ts",
    ],
    forbidden: [
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
    ],
    forbidden: [
      {
        description: "direct attachment implementation import",
        pattern: /from\s+["']\.\/attachments["']/u,
      },
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
    ],
    forbidden: [
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
    targets: ["packages/client/src/real-runtime.ts"],
    forbidden: [
      {
        description: "direct status controller construction",
        pattern: /\bcreateStatusSnapshotController\b/u,
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
