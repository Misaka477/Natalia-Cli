import { expect, test } from "bun:test";
import {
  findClientClosureViolation,
  findClientProductDependencyViolation,
  findClientToolDependencyViolation,
  findForbiddenRepositoryPathViolation,
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

test("MCP migration rejects raw tool registry wiring", () => {
  for (const path of [
    "packages/client/src/builtin-plugins/catalog.ts",
    "packages/mcp-plugin/src/mcp-runtime.ts",
    "packages/mcp-plugin/src/mcp-controller.ts",
    "packages/mcp-plugin/src/mcp-controller-plugin.ts",
  ])
    expect(
      findMigratedPluginViolations(
        path,
        "const tools: ToolRegistry = registry",
      ),
    ).toContainEqual(expect.objectContaining({ pluginID: "natalia-mcp" }));
});

test("MCP migration keeps connection routing inside its operational service", () => {
  for (const [path, source] of [
    [
      "packages/client/src/real-runtime.ts",
      'import type { McpController } from "@natalia/mcp-plugin"',
    ],
    [
      "packages/client/src/real-runtime.ts",
      "const mcpAccess: McpAccess = controller.access",
    ],
    [
      "packages/provider-model-plugin/src/provider-runner.ts",
      "for (const access of input.mcpAccess()) await access.readResource(server, uri)",
    ],
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      "createMcpController({})",
    ],
    [
      "packages/mcp-plugin/src/index.ts",
      'export type { McpController, McpAccess } from "./mcp-controller"',
    ],
    [
      "packages/mcp-plugin/src/mcp-controller-plugin.ts",
      "export const MCP_CONTROLLER_SERVICE = 'mcp.controller'",
    ],
  ] as const)
    expect(findMigratedPluginViolations(path, source)).toContainEqual(
      expect.objectContaining({ pluginID: "natalia-mcp" }),
    );

  for (const [path, source] of [
    [
      "packages/client/src/real-runtime.ts",
      'import type { McpService } from "@natalia/mcp-plugin"',
    ],
    [
      "packages/provider-model-plugin/src/provider-runner.ts",
      "const result = await input.mcp()?.readResource(server, uri)",
    ],
    [
      "packages/mcp-plugin/src/index.ts",
      'export type { McpService } from "./mcp-controller"',
    ],
  ] as const)
    expect(findMigratedPluginViolations(path, source)).toEqual([]);
});

test("terminal migration rejects concrete native types in client composition", () => {
  for (const source of [
    'import type { NativeTerminalRegistry } from "@natalia/terminal-plugin"',
    "function publicNativeTerminal(session: NativeTerminalSession) {}",
  ])
    expect(findMigratedPluginViolations(target, source)).toContainEqual(
      expect.objectContaining({ pluginID: "natalia-terminal" }),
    );
});

test("terminal migration rejects backend leaks across service consumers", () => {
  for (const [path, source] of [
    [
      "packages/client/src/real-runtime.ts",
      "const registry = terminalController?.get()",
    ],
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      "external?: NativeTerminalRegistry",
    ],
    ["packages/tools/src/types.ts", "nativeTerminal?: NativeTerminalRegistry"],
    [
      "packages/tool-terminal/src/index.ts",
      "function info(session: NativeTerminalSession) {}",
    ],
    [
      "packages/terminal-plugin/src/index.ts",
      "export { NativeTerminalRegistry } from '@natalia/native-terminal'",
    ],
  ] as const)
    expect(findMigratedPluginViolations(path, source)).toContainEqual(
      expect.objectContaining({ pluginID: "natalia-terminal" }),
    );
});

test("sandbox migration rejects backend leaks across service consumers", () => {
  for (const [path, source] of [
    [
      "packages/client/src/real-runtime.ts",
      "const manager = sandboxController?.get()",
    ],
    ["packages/tools/src/types.ts", "sandboxes?: WorkspaceSandboxManager"],
    [
      "packages/tool-sandbox/src/index.ts",
      "function use(manager: WorkspaceSandboxManager) {}",
    ],
    [
      "packages/team-plugin/src/fan-out.ts",
      "sandboxes: SnapshotSandboxManager",
    ],
    [
      "packages/sandbox-plugin/src/index.ts",
      "export { WorktreeSandboxManager } from '@natalia/sandbox'",
    ],
  ] as const)
    expect(findMigratedPluginViolations(path, source)).toContainEqual(
      expect.objectContaining({ pluginID: "natalia-sandbox" }),
    );
});

test("subagents migration rejects backend leaks across service consumers", () => {
  for (const [path, source] of [
    [
      "packages/tools/src/types.ts",
      'import type { SubagentRegistry } from "@natalia/subagent"',
    ],
    [
      "packages/tool-agent/src/index.ts",
      "function execute(registry: SubagentRegistry) {}",
    ],
    ["packages/team-plugin/src/team-plugin.ts", "subagentsController?.get()"],
    [
      "packages/subagents-plugin/src/index.ts",
      'export { SubagentRegistry } from "@natalia/subagent"',
    ],
  ] as const)
    expect(findMigratedPluginViolations(path, source)).toContainEqual(
      expect.objectContaining({ pluginID: "natalia-subagents" }),
    );
});

test("local tools migration rejects client-owned implementations", () => {
  for (const [path, source] of [
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createLocalToolsPlugin } from "./local-tools-plugin"',
    ],
    [
      "packages/client/src/builtin-plugins/local-tools-plugin.ts",
      "export function createLocalToolsPlugin() {}",
    ],
    [
      "packages/client/src/capabilities/local-tool-families.ts",
      "export async function discoverLocalToolFamilies() {}",
    ],
  ] as const) {
    expect(findMigratedPluginViolations(path, source)).toEqual([
      expect.objectContaining({ pluginID: "natalia-local-tools" }),
    ]);
  }
  expect(
    findMigratedPluginViolations(
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createLocalToolsPlugin } from "@natalia/local-tools-plugin"',
    ),
  ).toEqual([]);
});

test("task module migration rejects client-owned implementations", () => {
  for (const [path, source] of [
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createTaskModulePlugin } from "./task-module-plugin"',
    ],
    [
      "packages/client/src/builtin-plugins/task-module-plugin.ts",
      "export function createTaskModulePlugin() {}",
    ],
    [
      "packages/client/src/capabilities/task-module-tools.ts",
      "export function createFlowModuleCompleteTool() {}",
    ],
  ] as const) {
    expect(findMigratedPluginViolations(path, source)).toEqual([
      expect.objectContaining({ pluginID: "natalia-task-module" }),
    ]);
  }
  expect(
    findMigratedPluginViolations(
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createTaskModulePlugin } from "@natalia/task-module-plugin"',
    ),
  ).toEqual([]);
});

test("team migration rejects client-owned implementations", () => {
  for (const [path, source] of [
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createTeamPlugin } from "./team-plugin"',
    ],
    [
      "packages/client/src/builtin-plugins/team-plugin.ts",
      "export function createTeamPlugin() {}",
    ],
    [
      "packages/client/src/team-tools.ts",
      "export function createTeamFanoutTool() {}",
    ],
    ["packages/client/src/fan-out.ts", "export async function runFanOut() {}"],
    [
      "packages/client/src/agent-team-prompts.ts",
      'export const TEAM_MODE_DIRECTIVE = "team"',
    ],
  ] as const) {
    expect(findMigratedPluginViolations(path, source)).toContainEqual(
      expect.objectContaining({ pluginID: "natalia-team" }),
    );
  }
  expect(
    findMigratedPluginViolations(
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createTeamPlugin } from "@natalia/team-plugin"',
    ),
  ).toEqual([]);
});

test("tool pipeline migration rejects client-owned implementations", () => {
  for (const [path, source] of [
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createToolPipelinePlugin } from "./tool-pipeline-plugin"',
    ],
    [
      "packages/client/src/builtin-plugins/tool-pipeline-plugin.ts",
      "export function createToolPipelinePlugin() {}",
    ],
    [
      "packages/client/src/tool-policy.ts",
      "export function evaluatePermissionRules() {}",
    ],
    [
      "packages/client/src/bash-command-policy.ts",
      "export async function parseBashSimpleCommand() {}",
    ],
  ] as const) {
    expect(findMigratedPluginViolations(path, source)).toContainEqual(
      expect.objectContaining({ pluginID: "natalia-tool-pipeline" }),
    );
  }
  expect(
    findMigratedPluginViolations(
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createToolPipelinePlugin } from "@natalia/tool-pipeline-plugin"',
    ),
  ).toEqual([]);
});

test("retry migration protects provider runner", () => {
  expect(
    findMigratedPluginViolations(
      "packages/client/src/provider-runner.ts",
      "runStreamingWithRetry(context, operation)",
    ),
  ).toEqual([expect.objectContaining({ pluginID: "natalia-retry" })]);
});

test("collaboration migration protects the extracted implementation", () => {
  for (const [path, source] of [
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createCollaborationPlugin } from "./collaboration-plugin"',
    ],
    [
      "packages/client/src/real-runtime.ts",
      'import type { InteractiveWaiter } from "./interactive-waiter"',
    ],
    [
      "packages/client/src/real-runtime.ts",
      'import { buildMailboxQueued } from "./mailbox-ledger"',
    ],
    [
      "packages/client/src/mailbox-tool.ts",
      "export function createMailboxAcknowledgeTool() {}",
    ],
  ])
    expect(findMigratedPluginViolations(path, source)).toEqual([
      expect.objectContaining({ pluginID: "natalia-collaboration" }),
    ]);

  expect(
    findMigratedPluginViolations(
      "packages/client/src/real-runtime.ts",
      'import type { InteractiveWaiter } from "@natalia/collaboration-plugin"',
    ),
  ).toEqual([]);
});

test("workspace migration protects the extracted implementation", () => {
  for (const [path, source] of [
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createWorkspacePlugin } from "./workspace-plugin"',
    ],
    [
      "packages/client/src/real-runtime.ts",
      'import type { WorkspaceWriteLock } from "./workspace-write-lock"',
    ],
    [
      "packages/client/src/workspace-files-controller.ts",
      'import { watchWorkspaceFiles } from "./workspace-files"',
    ],
    [
      "packages/client/src/workspace-files.ts",
      "export async function findWorkspaceFiles() {}",
    ],
  ])
    expect(findMigratedPluginViolations(path, source)).toEqual([
      expect.objectContaining({ pluginID: "natalia-workspace" }),
    ]);

  expect(
    findMigratedPluginViolations(
      "packages/client/src/real-runtime.ts",
      'import type { WorkspaceWriteLock } from "@natalia/workspace-plugin"',
    ),
  ).toEqual([]);
});

test("task workflow migration protects the extracted implementation", () => {
  for (const [path, source] of [
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createTaskWorkflowPlugin } from "./task-workflow-plugin"',
    ],
    [
      "packages/client/src/real-runtime.ts",
      'import type { TaskWorkflowController } from "./task-workflow-controller"',
    ],
    [
      "packages/client/src/task-document.ts",
      "export async function saveTaskDocument() {}",
    ],
    [
      "packages/client/src/systemd-adapter.ts",
      "export async function configureTaskSystemd() {}",
    ],
  ])
    expect(findMigratedPluginViolations(path, source)).toEqual([
      expect.objectContaining({ pluginID: "natalia-task-workflow" }),
    ]);

  expect(
    findMigratedPluginViolations(
      "packages/client/src/real-runtime.ts",
      'import type { TaskWorkflowController } from "@natalia/task-workflow-plugin"',
    ),
  ).toEqual([]);
});

test("runtime config migration rejects client-owned implementations", () => {
  for (const [path, source] of [
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createRuntimeConfigPlugin } from "./runtime-config-plugin"',
    ],
    [
      "packages/client/src/real-runtime.ts",
      'import { refreshRuntimeConfigService } from "./builtin-plugins/runtime-config-plugin"',
    ],
  ])
    expect(findMigratedPluginViolations(path, source)).toEqual([
      expect.objectContaining({ pluginID: "natalia-runtime-config" }),
    ]);
  expect(
    findMigratedPluginViolations(
      "packages/client/src/real-runtime.ts",
      'import { refreshRuntimeConfigService } from "@natalia/runtime-config-plugin"',
    ),
  ).toEqual([]);
});

test("session store migration rejects client-owned implementations", () => {
  for (const [path, source] of [
    [
      "packages/client/src/real-runtime.ts",
      'import type { SessionStoreController } from "./session-store-controller"',
    ],
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createSessionStoreControllerPlugin } from "./session-store-controller-plugin"',
    ],
    [
      "packages/client/src/builtin-plugins/turn-orchestration-plugin.ts",
      'import { SESSION_STORE_PLUGIN_ID } from "./session-store-controller-plugin"',
    ],
  ])
    expect(findMigratedPluginViolations(path, source)).toEqual([
      expect.objectContaining({ pluginID: "natalia-session-store" }),
    ]);
  expect(
    findMigratedPluginViolations(
      "packages/client/src/real-runtime.ts",
      'import type { SessionStoreController } from "@natalia/session-store-plugin"',
    ),
  ).toEqual([]);

  for (const [path, source] of [
    [
      "packages/client/src/real-runtime.ts",
      'import { SqliteSessionStore } from "@natalia/session"',
    ],
    [
      "packages/client/test/real-runtime.test.ts",
      "const store = new JsonSessionStore()",
    ],
    ["packages/client/src/real-runtime.ts", "sessionStoreController?.sqlite()"],
    ["packages/client/src/real-runtime.ts", "sessionStoreController.json()"],
  ] as const)
    expect(findMigratedPluginViolations(path, source)).toContainEqual(
      expect.objectContaining({ pluginID: "natalia-session-store" }),
    );

  expect(
    findMigratedPluginViolations(
      "packages/session-store-plugin/src/index.ts",
      'export { SqliteSessionStore } from "@natalia/session"',
    ),
  ).toContainEqual(
    expect.objectContaining({ pluginID: "natalia-session-store" }),
  );
  expect(
    findMigratedPluginViolations(
      "packages/client/test/real-runtime.test.ts",
      'import { SessionStoreTestDatabase } from "@natalia/testing"',
    ),
  ).toEqual([]);
});

test("retry migration rejects client-owned retry implementations", () => {
  for (const [path, source] of [
    [
      "packages/client/src/provider-runner.ts",
      'import type { RetryService } from "./retry-service"',
    ],
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createRetryPlugin } from "./retry-plugin"',
    ],
    [
      "packages/client/src/real-runtime.ts",
      'import { RETRY_SERVICE } from "./builtin-plugins/retry-plugin"',
    ],
  ])
    expect(findMigratedPluginViolations(path, source)).toEqual([
      expect.objectContaining({ pluginID: "natalia-retry" }),
    ]);
  expect(
    findMigratedPluginViolations(
      "packages/client/src/provider-runner.ts",
      'import type { RetryService } from "@natalia/retry-plugin"',
    ),
  ).toEqual([]);
});

test("context ledger migration rejects client-owned implementations", () => {
  for (const [path, source] of [
    [
      "packages/client/src/real-runtime.ts",
      'import type { ContextLedgerFactory } from "./context-ledger-factory"',
    ],
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createContextLedgerPlugin } from "./context-ledger-plugin"',
    ],
    [
      "packages/client/src/real-runtime.ts",
      'import { CONTEXT_LEDGER_FACTORY_SERVICE } from "./builtin-plugins/context-ledger-plugin"',
    ],
  ])
    expect(findMigratedPluginViolations(path, source)).toEqual([
      expect.objectContaining({ pluginID: "natalia-context-ledger" }),
    ]);
  expect(
    findMigratedPluginViolations(
      "packages/client/src/real-runtime.ts",
      'import type { ContextLedgerFactory } from "@natalia/context-ledger-plugin"',
    ),
  ).toEqual([]);
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

test("attachment migration rejects client-owned implementations", () => {
  for (const [path, source] of [
    [
      "packages/client/src/provider-runner.ts",
      'import type { AttachmentService } from "./attachment-service"',
    ],
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createAttachmentPlugin } from "./attachment-plugin"',
    ],
    [
      "packages/client/src/real-runtime.ts",
      'import { ATTACHMENT_SERVICE } from "./builtin-plugins/attachment-plugin"',
    ],
  ])
    expect(findMigratedPluginViolations(path, source)).toEqual([
      expect.objectContaining({ pluginID: "natalia-attachment" }),
    ]);
  expect(
    findMigratedPluginViolations(
      "packages/client/src/provider-runner.ts",
      'import type { AttachmentService } from "@natalia/attachment-plugin"',
    ),
  ).toEqual([]);
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

test("compaction migration rejects client-owned implementations", () => {
  for (const [path, source] of [
    [
      "packages/client/src/provider-runner.ts",
      'import type { CompactionService } from "./compaction-service"',
    ],
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createCompactionPlugin } from "./compaction-plugin"',
    ],
    [
      "packages/client/src/real-runtime.ts",
      'import { COMPACTION_SERVICE } from "./builtin-plugins/compaction-plugin"',
    ],
  ])
    expect(findMigratedPluginViolations(path, source)).toEqual([
      expect.objectContaining({ pluginID: "natalia-compaction" }),
    ]);
  expect(
    findMigratedPluginViolations(
      "packages/client/src/provider-runner.ts",
      'import type { CompactionService } from "@natalia/compaction-plugin"',
    ),
  ).toEqual([]);
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

test("runtime UI migration protects the extracted implementation", () => {
  for (const [path, source] of [
    [
      "packages/client/src/real-runtime.ts",
      "createStatusSnapshotController(input)",
    ],
    [
      "packages/client/src/real-runtime.ts",
      'import { statusSnapshot } from "./status-controller"',
    ],
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createRuntimeUiPlugin } from "./runtime-ui-plugin"',
    ],
    [
      "packages/client/src/status-controller.ts",
      "export function statusSnapshot() {}",
    ],
  ])
    expect(findMigratedPluginViolations(path, source)).toEqual([
      expect.objectContaining({ pluginID: "natalia-runtime-ui" }),
    ]);

  expect(
    findMigratedPluginViolations(
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createRuntimeUiPlugin } from "@natalia/runtime-ui-plugin"',
    ),
  ).toEqual([]);
});

test("turn orchestration migration protects the extracted implementation", () => {
  for (const [path, source] of [
    ["packages/client/src/real-runtime.ts", "createTurnController(input)"],
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createTurnOrchestrationPlugin } from "./turn-orchestration-plugin"',
    ],
    [
      "packages/client/src/turn-controller.ts",
      "export function createTurnController() {}",
    ],
  ])
    expect(findMigratedPluginViolations(path, source)).toEqual([
      expect.objectContaining({ pluginID: "natalia-turn-orchestration" }),
    ]);

  expect(
    findMigratedPluginViolations(
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createTurnOrchestrationPlugin } from "@natalia/turn-orchestration-plugin"',
    ),
  ).toEqual([]);
});

test("provider model migration protects the extracted implementation", () => {
  for (const [path, source] of [
    ["packages/client/src/real-runtime.ts", "createProviderRunner(input)"],
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createProviderModelPlugin } from "./provider-model-plugin"',
    ],
    [
      "packages/client/src/provider-model-controller.ts",
      "export function createProviderModelController() {}",
    ],
    [
      "packages/client/src/provider-runner.ts",
      "export function createProviderRunner() {}",
    ],
  ])
    expect(findMigratedPluginViolations(path, source)).toEqual([
      expect.objectContaining({ pluginID: "natalia-provider-model" }),
    ]);

  expect(
    findMigratedPluginViolations(
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createProviderModelPlugin } from "@natalia/provider-model-plugin"',
    ),
  ).toEqual([]);
});

test("work ledger migration protects the extracted implementation", () => {
  for (const [path, source] of [
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createWorkLedgerPlugin } from "./work-ledger-plugin"',
    ],
    [
      "packages/client/src/real-runtime.ts",
      'import type { WorkLedgerController } from "./work-ledger-controller"',
    ],
    [
      "packages/client/src/work-ledger-controller.ts",
      "export function createWorkLedgerController() {}",
    ],
    [
      "packages/client/src/drift-evaluator.ts",
      "export function createDriftEvaluator() {}",
    ],
    ["packages/client/src/work-graph.ts", "export const WORK_GRAPH_KIND = {}"],
  ]) {
    const violations = findMigratedPluginViolations(path, source);
    expect(
      violations.some(
        (violation) => violation.pluginID === "natalia-work-ledger",
      ),
      `${path}: ${source}`,
    ).toBe(true);
  }

  expect(
    findMigratedPluginViolations(
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createWorkLedgerPlugin } from "@natalia/work-ledger-plugin"',
    ),
  ).toEqual([]);
});

test("checkpoint migration protects the extracted implementation", () => {
  for (const [path, source] of [
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createCheckpointControllerPlugin } from "./checkpoint-controller-plugin"',
    ],
    [
      "packages/client/src/real-runtime.ts",
      'import type { CheckpointController } from "./checkpoint-controller"',
    ],
    [
      "packages/client/src/checkpoint-controller.ts",
      "export function createCheckpointController() {}",
    ],
    [
      "packages/client/src/builtin-plugins/checkpoint-controller-plugin.ts",
      "export function createCheckpointControllerPlugin() {}",
    ],
  ])
    expect(findMigratedPluginViolations(path, source)).toEqual([
      expect.objectContaining({ pluginID: "natalia-checkpoint" }),
    ]);

  expect(
    findMigratedPluginViolations(
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createCheckpointControllerPlugin } from "@natalia/checkpoint-plugin"',
    ),
  ).toEqual([]);
});

test("governance ledger migration protects the extracted implementation", () => {
  for (const [path, source] of [
    [
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createGovernanceLedgerPlugin } from "./governance-ledger-plugin"',
    ],
    [
      "packages/client/src/real-runtime.ts",
      'import type { GovernanceLedgerController } from "./governance-ledger-controller"',
    ],
    [
      "packages/client/src/constitution-ledger.ts",
      "export function seedConstitutionRules() {}",
    ],
    [
      "packages/client/src/evidence-ledger.ts",
      "export function buildEvidenceRecorded() {}",
    ],
  ])
    expect(findMigratedPluginViolations(path, source)).toEqual([
      expect.objectContaining({ pluginID: "natalia-governance-ledger" }),
    ]);

  expect(
    findMigratedPluginViolations(
      "packages/client/src/builtin-plugins/catalog.ts",
      'import { createGovernanceLedgerPlugin } from "@natalia/governance-ledger-plugin"',
    ),
  ).toEqual([]);
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
      'import { MCP_SERVICE } from "@natalia/mcp-plugin"',
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
  expect(
    findClientProductDependencyViolation(
      "packages/client/src/provider-runner.ts",
      'import { authorizeSkillTool } from "@natalia/skills"',
    ),
  ).toBeString();
  expect(
    findClientProductDependencyViolation(
      "packages/client/src/provider-runner.ts",
      'import { authorizeSkillTool } from "@natalia/skills-plugin"',
    ),
  ).toBeUndefined();
  expect(
    findClientProductDependencyViolation(
      "packages/client/src/real-runtime.ts",
      'import { agentsFromConfig } from "@natalia/agent"',
    ),
  ).toBeUndefined();
  expect(
    findClientProductDependencyViolation(
      "packages/client/src/real-runtime.ts",
      'import { agentsFromConfig } from "@natalia/agent-plugin"',
    ),
  ).toBeString();
});

test("client dependency closure rejects any non-kernel package", () => {
  expect(
    findClientClosureViolation(
      "packages/client/package.json",
      '"@natalia/tool-shell": "workspace:*"',
    ),
  ).toBeString();
  expect(
    findClientClosureViolation(
      "packages/client/package.json",
      '"@natalia/capability": "workspace:*"',
    ),
  ).toBeUndefined();
  expect(
    findClientClosureViolation(
      "packages/client/package.json",
      '"@natalia/agent": "workspace:*"',
    ),
  ).toBeUndefined();
  expect(
    findClientClosureViolation(
      "packages/client/tsconfig.json",
      '"path": "../transport"',
    ),
  ).toBeString();
  expect(
    findClientClosureViolation(
      "packages/client/tsconfig.json",
      '"path": "../mcp-plugin"',
    ),
  ).toBeUndefined();
  expect(
    findClientClosureViolation(
      "packages/client/package.json",
      '"@natalia/retry-plugin": "workspace:*"',
    ),
  ).toBeUndefined();
  expect(
    findClientClosureViolation(
      "packages/client/package.json",
      '"@natalia/context-ledger-plugin": "workspace:*"',
    ),
  ).toBeUndefined();
  expect(
    findClientClosureViolation(
      "packages/client/package.json",
      '"@natalia/compaction-plugin": "workspace:*"',
    ),
  ).toBeUndefined();
  expect(
    findClientClosureViolation(
      "packages/client/package.json",
      '"@natalia/attachment-plugin": "workspace:*"',
    ),
  ).toBeUndefined();
  expect(
    findClientClosureViolation(
      "packages/client/package.json",
      '"@natalia/runtime-config-plugin": "workspace:*"',
    ),
  ).toBeUndefined();
  expect(
    findClientClosureViolation(
      "packages/client/package.json",
      '"@natalia/session-store-plugin": "workspace:*"',
    ),
  ).toBeUndefined();
  expect(
    findClientClosureViolation(
      "packages/client/package.json",
      '"@natalia/runtime-ui-plugin": "workspace:*"',
    ),
  ).toBeUndefined();
  expect(
    findClientClosureViolation(
      "packages/client/package.json",
      '"@natalia/turn-orchestration-plugin": "workspace:*"',
    ),
  ).toBeUndefined();
  expect(
    findClientClosureViolation(
      "packages/client/package.json",
      '"@natalia/provider-model-plugin": "workspace:*"',
    ),
  ).toBeUndefined();
  expect(
    findClientClosureViolation(
      "packages/client/package.json",
      '"@natalia/work-ledger-plugin": "workspace:*"',
    ),
  ).toBeUndefined();
  expect(
    findClientClosureViolation(
      "packages/client/package.json",
      '"@natalia/governance-ledger-plugin": "workspace:*"',
    ),
  ).toBeUndefined();
  expect(
    findClientClosureViolation(
      "packages/client/package.json",
      '"@natalia/collaboration-plugin": "workspace:*"',
    ),
  ).toBeUndefined();
  expect(
    findClientClosureViolation(
      "packages/client/test/sandbox-controller.test.ts",
      'import { createSandboxController } from "../src/sandbox-controller"',
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
    "packages/client/src/real-runtime.ts",
    "packages/client/src/builtin-plugins/catalog.ts",
    "packages/client/src/capability-execution-host.ts",
    "packages/client/test/capability-execution-host.test.ts",
    "packages/client/test/worker.test.ts",
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

test("the deleted runtime assembly seam cannot be recreated", () => {
  expect(
    findForbiddenRepositoryPathViolation(
      "packages/client/src/runtime-assembly.ts",
    ),
  ).toMatch(/must not be recreated/u);
  expect(
    findForbiddenRepositoryPathViolation(
      "packages\\client\\src\\runtime-assembly.ts",
    ),
  ).toMatch(/must not be recreated/u);
  expect(
    findForbiddenRepositoryPathViolation("packages/client/src/real-runtime.ts"),
  ).toBeUndefined();
});

test("workflow scheduler migration protects the extracted implementation", () => {
  for (const [path, source] of [
    [
      "packages/client/src/capability-execution-host.ts",
      'import { WorkflowExecutionScheduler } from "./workflow-execution-scheduler"',
    ],
    [
      "packages/client/src/workflow-execution-scheduler.ts",
      "export class WorkflowExecutionScheduler {}",
    ],
    [
      "packages/client/src/builtin-plugins/workflow-scheduler-plugin.ts",
      "export function createWorkflowSchedulerPlugin() {}",
    ],
  ])
    expect(findMigratedPluginViolations(path, source)).toContainEqual(
      expect.objectContaining({ pluginID: "natalia-workflow-scheduler" }),
    );

  expect(
    findMigratedPluginViolations(
      "packages/client/src/capability-execution-host.ts",
      'import type { WorkflowExecutionSchedulerService } from "@natalia/workflow-scheduler-plugin"',
    ),
  ).toEqual([]);

  for (const source of [
    'export { WorkflowExecutionScheduler } from "@natalia/workflow-scheduler-plugin"',
    'export { createWorkflowSchedulerPluginHost } from "@natalia/workflow-scheduler-plugin"',
  ])
    expect(
      findMigratedPluginViolations("packages/client/src/index.ts", source),
    ).toContainEqual(
      expect.objectContaining({ pluginID: "natalia-workflow-scheduler" }),
    );

  expect(
    findMigratedPluginViolations(
      "packages/workflow-scheduler-plugin/src/index.ts",
      'export { WorkflowExecutionScheduler } from "./workflow-execution-scheduler"',
    ),
  ).toContainEqual(
    expect.objectContaining({ pluginID: "natalia-workflow-scheduler" }),
  );
  expect(
    findMigratedPluginViolations(
      "packages/workflow-scheduler-plugin/src/index.ts",
      'export type { WorkflowExecutionSchedulerService } from "./workflow-execution-scheduler"',
    ),
  ).toEqual([]);
  expect(
    findMigratedPluginViolations(
      "apps/cli/src/command-dispatcher.ts",
      'import { createWorkflowSchedulerPluginHost } from "@natalia/client"',
    ),
  ).toContainEqual(
    expect.objectContaining({ pluginID: "natalia-workflow-scheduler" }),
  );
  expect(
    findMigratedPluginViolations(
      "apps/tui/src/runtime-worker.ts",
      'import { createWorkflowSchedulerPluginHost } from "@natalia/workflow-scheduler-plugin"',
    ),
  ).toEqual([]);
  expect(
    findMigratedPluginViolations(
      "packages/workflow-scheduler-plugin/src/workflow-scheduler-plugin.ts",
      "return { scheduler, service: <T>(name: string) => capabilities.service<T>(name) }",
    ),
  ).toContainEqual(
    expect.objectContaining({ pluginID: "natalia-workflow-scheduler" }),
  );
});
