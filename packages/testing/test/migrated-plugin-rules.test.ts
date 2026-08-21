import { expect, test } from "bun:test";
import {
  findClientProductDependencyViolation,
  findClientToolDependencyViolation,
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
    [
      "natalia-tool-plugins",
      "createToolRegistryFromCapabilities({ registry })",
    ],
    ["natalia-workspace", "createWorkspaceWriteLock()"],
    ["natalia-terminal", "createTerminalController({})"],
    ["natalia-sandbox", "createSandboxController({})"],
    [
      "natalia-sandbox",
      'import { SnapshotSandboxManager } from "@natalia/sandbox"',
    ],
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

test("compaction migration protects both former consumers", () => {
  for (const path of [
    "packages/client/src/provider-runner.ts",
    "packages/client/src/real-runtime.ts",
  ])
    expect(
      findMigratedPluginViolations(
        path,
        "compactContext(ledger, compactor, options)",
      ),
    ).toEqual([expect.objectContaining({ pluginID: "natalia-compaction" })]);
});

test("transport migration protects the CLI composition root", () => {
  expect(
    findMigratedPluginViolations(
      "apps/cli/src/command-dispatcher.ts",
      "const server = createRuntimeHttpServer(options)",
    ),
  ).toEqual([expect.objectContaining({ pluginID: "natalia-transport" })]);
});

test("CLI adapter migration protects the executable bootstrap", () => {
  for (const source of [
    'import { dispatch } from "./command-dispatcher"',
    "createRealRuntimeClient(options)",
    "createHttpTransportPluginHost(options)",
  ])
    expect(
      findMigratedPluginViolations("apps/cli/src/main.ts", source),
    ).toEqual([expect.objectContaining({ pluginID: "natalia-cli" })]);
});

test("TUI adapter migration protects the executable bootstrap", () => {
  for (const source of [
    "const channel = new MessageChannel()",
    "const worker = new Worker(url)",
    "await runTuiShell(options)",
  ])
    expect(
      findMigratedPluginViolations("apps/tui/src/main.tsx", source),
    ).toEqual([expect.objectContaining({ pluginID: "natalia-tui" })]);
});

test("runtime UI migration protects status construction", () => {
  expect(
    findMigratedPluginViolations(
      "packages/client/src/real-runtime.ts",
      "createStatusSnapshotController(input)",
    ),
  ).toEqual([expect.objectContaining({ pluginID: "natalia-runtime-ui" })]);
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

test("client physical dependency guard excludes concrete tool packages", () => {
  for (const [path, source] of [
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createAskPlugin } from "@natalia/tool-ask"',
    ],
    [
      "packages/client/test/tool-catalogue.test.ts",
      'import { terminalTools } from "@natalia/tool-terminal"',
    ],
    ["packages/client/package.json", '"@natalia/tool-ask": "workspace:*"'],
    ["packages/client/tsconfig.json", '"path": "../tool-ask"'],
  ])
    expect(findClientToolDependencyViolation(path, source)).toBeString();

  expect(
    findClientToolDependencyViolation(
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { builtinToolPluginCatalog } from "@natalia/builtin-tool-plugins"',
    ),
  ).toBeUndefined();
});

test("client physical dependency guard excludes extracted product packages", () => {
  for (const [path, source] of [
    [
      "packages/client/src/real-runtime.ts",
      'import { loadNativeMCPTools } from "@natalia/mcp"',
    ],
    [
      "packages/client/test/mcp-controller.test.ts",
      'import type { MCPCatalogSnapshot } from "@natalia/mcp"',
    ],
    ["packages/client/package.json", '"@natalia/mcp": "workspace:*"'],
    ["packages/client/tsconfig.json", '"path": "../mcp"'],
  ])
    expect(findClientProductDependencyViolation(path, source)).toBeString();

  expect(
    findClientProductDependencyViolation(
      "packages/client/src/real-runtime.ts",
      'import { MCP_CONTROLLER_SERVICE } from "@natalia/mcp-plugin"',
    ),
  ).toBeUndefined();
  expect(
    findClientProductDependencyViolation(
      "packages/client/tsconfig.json",
      '"path": "../mcp-plugin"',
    ),
  ).toBeUndefined();
  expect(
    findClientProductDependencyViolation(
      "packages/client/src/fan-out.ts",
      'import type { SubagentRegistry } from "@natalia/subagent"',
    ),
  ).toBeString();
  expect(
    findClientProductDependencyViolation(
      "packages/client/src/fan-out.ts",
      'import type { SubagentRegistry } from "@natalia/subagents-plugin"',
    ),
  ).toBeUndefined();
  expect(
    findClientProductDependencyViolation(
      "packages/client/src/sandbox-controller.ts",
      'import { SnapshotSandboxManager } from "@natalia/sandbox"',
    ),
  ).toBeString();
  expect(
    findClientProductDependencyViolation(
      "packages/client/src/fan-out.ts",
      'import type { WorkspaceSandboxManager } from "@natalia/sandbox-plugin"',
    ),
  ).toBeUndefined();
  expect(
    findClientProductDependencyViolation(
      "packages/client/src/terminal-controller.ts",
      'import { NativeTerminalRegistry } from "@natalia/native-terminal"',
    ),
  ).toBeString();
  expect(
    findClientProductDependencyViolation(
      "packages/client/src/real-runtime.ts",
      'import type { NativeTerminalRegistry } from "@natalia/terminal-plugin"',
    ),
  ).toBeUndefined();
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
    "apps/cli/src/command-dispatcher.ts",
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
