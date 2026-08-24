import type { MigratedPluginRule } from "./migrated-plugin-rule-types";

export const migratedPluginRules3: readonly MigratedPluginRule[] = [
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
    id: "natalia-task-module",
    targets: ["packages/client/src/runtime/main.ts"],
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
    id: "natalia-sandbox",
    targets: [
      "packages/client/src/runtime/main.ts",
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
    id: "natalia-checkpoint",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/runtime/checkpoint-runtime.ts",
      "packages/client/src/runtime/turn-runner.ts",
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
      {
        description: "client-owned checkpoint controller cache",
        pattern: /\b(?:controllerBySession|initBySession)\b/u,
      },
      {
        description: "checkpoint controller backend escape hatch",
        pattern: /\bcontroller\.get\(\)\./u,
      },
    ],
  },
  {
    id: "natalia-team",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/index.ts",
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
    id: "natalia-work-ledger",
    targets: ["packages/client/src/runtime/main.ts"],
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
    id: "natalia-attachment",
    targets: [
      "packages/client/src/runtime/main.ts",
      "packages/client/src/runtime/commands/slash-action.ts",
    ],
    forbidden: [
      {
        description: "direct attachment helper use",
        pattern:
          /\b(?:attachmentDataURL|attachmentText|cleanupUnreferencedAttachments|isTextAttachment|referencedAttachmentsForSessions|storeLocalAttachments)\b/u,
      },
      {
        description: "client-owned attachment command implementation",
        pattern: /["']\/attach\b/u,
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
];
