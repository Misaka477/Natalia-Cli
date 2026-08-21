import { expect, test } from "bun:test";
import {
  findMigratedPluginViolations,
  type MigratedPluginRule,
} from "../src/migrated-plugin-rules";

const target = "packages/client/src/real-runtime.ts";

test("migrated plugin rules retain built-in plugin protections", () => {
  for (const [pluginID, source] of [
    ["natalia-skills", "createSkillsController()"],
    ["natalia-skills", "discoverSkills()"],
    ["natalia-skills", "createSkillLoadTool()"],
    ["natalia-tool-pdf", 'import { x } from "@natalia/tool-pdf"'],
    ["natalia-tool-pdf", "createPdfPlugin()"],
    ["natalia-tool-ask", 'import { askTools } from "@natalia/tool-ask"'],
    ["natalia-tool-todo", 'import { todoTools } from "@natalia/tool-todo"'],
    [
      "natalia-tool-search",
      'import { searchTools } from "@natalia/tool-search"',
    ],
    [
      "natalia-tool-fs-read",
      'import { readFileTools } from "@natalia/tool-fs-read"',
    ],
    [
      "natalia-tool-fs-write",
      'import { writeFileTools } from "@natalia/tool-fs-write"',
    ],
    ["natalia-tool-web", 'import { webTools } from "@natalia/tool-web"'],
    ["natalia-tool-shell", 'import { shellTools } from "@natalia/tool-shell"'],
    ["natalia-tool-agent", 'import { agentTools } from "@natalia/tool-agent"'],
    [
      "natalia-tool-terminal",
      'import { terminalTools } from "@natalia/tool-terminal"',
    ],
    [
      "natalia-tool-sandbox",
      'import { sandboxTools } from "@natalia/tool-sandbox"',
    ],
    [
      "natalia-tool-process",
      'import { managedProcessTools } from "@natalia/tool-process"',
    ],
    ["natalia-task-module", "taskModuleTools(context)"],
    [
      "natalia-runtime-config",
      "registerRuntimeConfigCapability(registry, cfg)",
    ],
    ["natalia-local-tools", "loadLocalToolFamilies({ roots })"],
    ["natalia-workspace", "createWorkspaceWriteLock()"],
    ["natalia-terminal", "createTerminalController({})"],
    ["natalia-sandbox", "createSandboxController({})"],
    ["natalia-mcp", "createMcpController({})"],
    ["natalia-checkpoint", "createCheckpointController({})"],
    ["natalia-subagents", "createSubagentsController({})"],
    ["natalia-session-store", "createSessionStoreController({})"],
    ["natalia-team", "createTeamFanoutTool({})"],
    [
      "natalia-tool-pipeline",
      "evaluatePermissionRules(rules, name, args, root)",
    ],
    ["natalia-collaboration", "createInteractiveWaiter({})"],
    ["natalia-provider-model", "createProviderRunner({})"],
    ["natalia-provider-model", "const runnerBySession = new Map()"],
    ["natalia-provider-model", "let chatAbort = new AbortController()"],
    [
      "natalia-task-workflow",
      'import { saveTaskDocument } from "./task-document"',
    ],
    ["natalia-task-workflow", "new NataliaDocumentStore(root)"],
    ["natalia-context-ledger", "new ContextLedger()"],
    ["natalia-context-ledger", "restoreContextFromEvents(context, events)"],
    [
      "natalia-work-ledger",
      'import { buildPlanTransition } from "./plan-ledger"',
    ],
    [
      "natalia-governance-ledger",
      'import { recordDecision } from "./constitution-ledger"',
    ],
    [
      "natalia-turn-orchestration",
      'import { createTurnController } from "./turn-controller"',
    ],
    ["natalia-turn-orchestration", "createTurnController({})"],
    ["natalia-retry", "runWithRetry(context, operation)"],
    [
      "natalia-attachment",
      'import { storeLocalAttachments } from "./attachments"',
    ],
  ])
    expect(findMigratedPluginViolations(target, source)).toContainEqual(
      expect.objectContaining({ pluginID }),
    );
});

test("retry migration protects provider runner", () => {
  expect(
    findMigratedPluginViolations(
      "packages/client/src/provider-runner.ts",
      "runStreamingWithRetry(context, operation)",
    ),
  ).toEqual([expect.objectContaining({ pluginID: "natalia-retry" })]);
});

test("attachment migration protects all former consumers", () => {
  for (const path of [
    "packages/client/src/provider-runner.ts",
    "packages/client/src/session-store-controller.ts",
  ])
    expect(
      findMigratedPluginViolations(path, "attachmentDataURL(root, attachment)"),
    ).toEqual([expect.objectContaining({ pluginID: "natalia-attachment" })]);
});

test("tool migrations protect the legacy static capability root", () => {
  for (const [pluginID, source] of [
    ["natalia-tool-ask", "askToolFamily()"],
    ["natalia-tool-todo", "todoToolFamily()"],
    ["natalia-tool-search", "searchToolFamily()"],
    ["natalia-tool-fs-read", "fsReadToolFamily()"],
    ["natalia-tool-fs-write", "fsWriteToolFamily()"],
    ["natalia-tool-web", "webToolFamily()"],
    ["natalia-tool-shell", "shellToolFamily()"],
    ["natalia-tool-agent", "agentToolFamily()"],
    ["natalia-tool-terminal", "terminalToolFamily()"],
    ["natalia-tool-sandbox", "sandboxToolFamily()"],
    ["natalia-tool-process", "processToolFamily()"],
  ])
    expect(
      findMigratedPluginViolations(
        "packages/client/src/capabilities/tool-family-capabilities.ts",
        source,
      ),
    ).toEqual([expect.objectContaining({ pluginID })]);
});

test("migrated plugin rules only protect declared composition roots", () => {
  expect(
    findMigratedPluginViolations(
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createPdfPlugin } from "@natalia/tool-pdf"',
    ),
  ).toEqual([]);
  expect(
    findMigratedPluginViolations(
      target,
      "builtinPluginCatalog(); entry.create()",
    ),
  ).toEqual([]);
  expect(
    findMigratedPluginViolations(
      "packages\\client\\src\\real-runtime.ts",
      "createPdfReadTool()",
    ),
  ).toEqual([expect.objectContaining({ pluginID: "natalia-tool-pdf" })]);
});

test("migrated plugin matcher accepts new declarative rules", () => {
  const rules: MigratedPluginRule[] = [
    {
      id: "natalia-example",
      targets: [target],
      forbidden: [
        { description: "direct construction", pattern: /createExample/u },
      ],
    },
  ];
  expect(
    findMigratedPluginViolations(target, "createExample()", rules),
  ).toEqual([
    { pluginID: "natalia-example", description: "direct construction" },
  ]);
});

test("workflow scheduler migration protects host construction sites", () => {
  for (const path of [
    "packages/client/src/capability-execution-host.ts",
    "apps/cli/src/main.ts",
    "apps/tui/src/runtime-worker.ts",
  ])
    expect(
      findMigratedPluginViolations(
        path,
        "const scheduler = new WorkflowExecutionScheduler()",
      ),
    ).toContainEqual(
      expect.objectContaining({ pluginID: "natalia-workflow-scheduler" }),
    );
});
