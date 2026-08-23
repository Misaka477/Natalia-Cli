import type { MigratedPluginRule } from "./migrated-plugin-rule-types";

export const migratedPluginRules2: readonly MigratedPluginRule[] = [
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
];
