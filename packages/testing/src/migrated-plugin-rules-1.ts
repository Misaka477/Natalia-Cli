import type { MigratedPluginRule } from "./migrated-plugin-rule-types";

export const migratedPluginRules1: readonly MigratedPluginRule[] = [
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
    id: "natalia-collaboration",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/builtin-plugins/catalog.ts",
      "packages/client/src/builtin-plugins/collaboration-plugin.ts",
      "packages/client/src/interactive-waiter.ts",
      "packages/client/src/mailbox-ledger.ts",
      "packages/client/src/mailbox-tool.ts",
      "packages/client/src/runtime/initialize/collaboration-tools.ts",
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
          /export (?:async )?function (?:createCollaborationPlugin|buildMailboxQueued|buildMailboxStatus|createMailboxAcknowledgeTool|registerCollaborationTools)\b/u,
      },
      {
        description: "direct collaboration tool registration in the host",
        pattern:
          /\b(?:mailbox_acknowledge|collab_respond|collab_inbox|collab_ask)\b/u,
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
];
