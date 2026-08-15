import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, dirname, join, resolve } from "node:path";
import { createStatusSnapshotController } from "./status-controller";
import { createSessionStoreController } from "./session-store-controller";
import { createTurnController } from "./turn-controller";
import { createProviderRunner } from "./provider-runner";
import { createSkillsController } from "./skills-controller";
import { createSubagentsController } from "./subagents-controller";
import { createTerminalController } from "./terminal-controller";
import { createSandboxController } from "./sandbox-controller";
import { createCheckpointController } from "./checkpoint-controller";
import { createMcpController } from "./mcp-controller";
import {
  createWorkspaceFilesController,
  type WorkspaceMutationIdentity,
} from "./workspace-files-controller";
import { createPluginsController } from "./plugins-controller";
import { RuntimeRefusal } from "@natalia/contracts";
import {
  runtimeEventDurability,
  runtimeSlashCommands,
} from "@natalia/contracts";
import { assertConfigApplied, taskPermissionPreview } from "./task-controller";
import { assertTaskReferences } from "./task-preflight";
import {
  findWorkspaceFiles,
  globWorkspaceFiles,
  listWorkspaceFiles,
  readWorkspaceFile,
  searchWorkspaceFiles,
} from "./workspace-files";
import type {
  ApprovalResponse,
  RuntimeClient,
  RuntimeEvent,
  RuntimeSessionSummary,
  SessionID,
  SubmitInput,
  SubmittedTurn,
  QuestionResponse,
} from "@natalia/contracts";
import {
  ContextLedger,
  contextStatusEvent,
  providerForModel,
  type ProviderMessage,
  type ProviderToolCall,
  providerFromEnvironment,
  runWithRetry,
  runCheckpointCommand,
  type StreamingProvider,
} from "@natalia/runtime";
import {
  discoverProviderModels,
  modelSelectionStatus,
  resolveConfig,
  resolveTuiConfig,
  saveTuiConfig,
  updateConfigAtScope,
} from "@natalia/config";
import type { ConfigV2 } from "@natalia/contracts";
import {
  CapabilityRegistry,
  type CapabilityHost,
  type CapabilityRegistryHost,
} from "@natalia/capability";
import { mergeContributedToolSettings } from "./capability-settings";
import { workflowContributionsProjection } from "./workflow-contributions";
import {
  agentsFromConfig,
  type AgentDefinition,
  type AgentRegistry,
} from "@natalia/agent";
import {
  appendSessionEvent,
  createSessionRecord,
  admitInput,
  admissionCutoff,
  admittedInputs,
  promoteNextQueued,
  projectInteractiveRequests,
  projectSession,
  projectSessionMessages,
  projectedConstitutionRules,
  projectedDecisionRecords,
  projectedEvidenceRecords,
  projectedCompletions,
  latestSessionSnapshot,
  projectedCanonicalTools,
  projectedDriftFindings,
  projectedWorkGraphNodes,
  projectedWorkGraphEdges,
  projectedMailboxMessages,
  projectedPlans,
  projectedChatMessages,
  projectedCollabMessages,
  settleInterruptedTurns,
  settleInterruptedTurnIDs,
  modelVisibleEvents,
  sessionRunCoordinator,
  type DurableInFlightOperation,
  type SessionRecord,
} from "@natalia/session";
import {
  boundToolOutput,
  cleanupToolOutput,
  validateToolParameters,
  type RuntimeTool,
  type ToolMaterialization,
  type ToolRegistry,
} from "@natalia/tools";
import { ManagedProcessRegistry } from "@natalia/tool-process";
import {
  createSkillLoadTool,
  readSkillResource,
  runSkillScript,
  type Skill,
} from "@natalia/skills";
import type { SubagentRegistry } from "@natalia/subagent";
import type { NativeTerminalRegistry } from "@natalia/native-terminal";
import {
  foregroundProcessForTTY,
  globalConfigHome,
  userRuntimeHome,
} from "@natalia/platform";
import { setGlobalPluginCommands, type PluginCommand } from "@natalia/plugin";
import {
  moduleToolPolicy,
  NataliaTaskStateStore,
  type NataliaFlowModuleType,
} from "@natalia/workflow";
import { NataliaDocumentStore } from "@natalia/workflow";
import {
  deleteFlowDocument as deleteFlowDocumentFile,
  saveFlowDocument as saveFlowDocumentFile,
} from "./flow-document";
import {
  configureTaskSystemd,
  deleteTaskDocument,
  removeTaskSystemd,
  saveTaskDocument,
} from "./task-document";
import { registerBuiltinCapabilities } from "./capabilities/builtin-capabilities";
import {
  registerTaskModuleCapability,
  TASK_MODULE_CAPABILITY_ID,
} from "./capabilities/task-module-capability";
import {
  applyToolFamilyEnabledFilter,
  builtinToolFamilies,
  createToolRegistryFromCapabilities,
  toolFamilyCapabilityID,
} from "./capabilities/tool-family-capabilities";
import {
  RUNTIME_CONFIG_CAPABILITY_ID,
  RUNTIME_CONFIG_SERVICE,
  refreshRuntimeConfigService,
  registerRuntimeConfigCapability,
} from "./capabilities/runtime-config-capability";
import type { TaskModuleContext } from "./capabilities/task-module-tools";
import {
  flowOverview as flowOverviewForWorkspace,
  scheduledTaskOverview,
} from "./task-overview";
import { workflowDocumentCatalog } from "./workflow-document-catalog";
import {
  createInteractiveWaiter,
  readOnlyToolMessage,
  terminalApprovalScope,
  terminalInputRisk,
} from "./interactive-waiter";
import { parseToolArguments, tryParseToolArguments } from "./tool-arguments";
import { createWorkspaceWriteLock } from "./workspace-write-lock";
import { buildSessionIntelligenceSnapshot } from "./session-intelligence";
import { recordDecision, seedConstitutionRules } from "./constitution-ledger";
import {
  boundValidationOutcome,
  buildCompletionRecorded,
  buildEvidenceRecorded,
  evidenceStatusForPlanState,
  type PlanLifecycleState,
} from "./evidence-ledger";
import { buildMailboxQueued, buildMailboxStatus } from "./mailbox-ledger";
import { buildPlanDraftCreated, buildPlanTransition } from "./plan-ledger";
import { createMailboxAcknowledgeTool } from "./mailbox-tool";
import {
  createDriftEvaluator,
  buildDriftFindingUpdate,
} from "./drift-evaluator";
import { createMutationRegistry } from "./mutation-registry";

// Re-exported because the policy tests reach for the risk classifier directly and
// this file is the package's runtime entry point.
export { terminalApprovalScope, terminalInputRisk };
import {
  agentActionNode,
  approvalEdge,
  approvalNode,
  toolCallEdge,
  toolCallNode,
  workspaceChangeEdge,
  workspaceChangeNode,
  externalWorkspaceChangeNode,
  completionValidationEdge,
  constitutionRuleNode,
  constitutionCheckEdge,
  decisionNode,
} from "./work-graph";
import { ensureBashCommandParser } from "./bash-command-policy";
import { RuntimePerformanceTrace } from "./performance-trace";
import {
  commandTextForTool,
  workspaceWritePathForTool,
  createToolPolicyHookLayer,
  evaluatePermissionRules,
  evaluatePermissionProfileCommandRules,
  TerminalCommandBuffer,
  type ToolHookEvent,
  type ToolHooks,
  type ToolPolicy,
  type ToolPolicyHookLayer,
} from "./tool-policy";
import {
  attachmentDataURL,
  attachmentText,
  cleanupUnreferencedAttachments,
  isTextAttachment,
  referencedAttachmentsForSessions,
  storeLocalAttachments,
} from "./attachments";

function userSkillRoot() {
  const root = join(globalConfigHome(), "natalia-cli", "skills");
  return isAbsolute(root) ? root : undefined;
}

/**
 * Tools whose contract is to block until the screen changes. Calling one
 * repeatedly with identical arguments is how a caller waits for output, so the
 * repeated-call guard would stop legitimate work: the arguments only stay
 * identical while nothing new has arrived, which is exactly when waiting is
 * correct. Each call spends real time inside the tool, so a loop cannot spin,
 * and the turn's step budget still bounds it.
 */
const WAITING_TOOLS = new Set(["terminal_observe"]);

/**
 * The application-layer host allowlist is enforced where fetch-style tools
 * build their request URL; it cannot see traffic a shell command or terminal
 * keystroke opens on its own. Blocklisting `curl` would only be a false sense
 * of safety (`python -c`, `nc`, `/dev/tcp` remain), so the boundary is stated
 * plainly here instead and the real enforcement belongs to the operator's
 * firewall or container network. Runtime doctor and `natalia doctor` share this
 * one string so the two surfaces cannot drift apart.
 */
export const EGRESS_ADVISORY =
  "egress: the application-layer host allowlist only covers fetch-style tools; outbound traffic from run_shell and native terminal input is not constrained here, so configure egress in your firewall or container network";

/**
 * Self-protection rules only. These three exist so the agent cannot kill the
 * terminal host it is running under or delete its own runtime directories, and
 * they are deliberately not a general danger list: a blocklist cannot cover an
 * arbitrary byte stream. General command restrictions belong to the agent's
 * `commands.denyPatterns`, and real isolation belongs to the deployment
 * (container, restricted user). Do not grow this list into a substitute for
 * either.
 */
const SELF_PROTECTION_PATTERNS = [
  {
    pattern: /pkill\s+-f\s+wezterm-mux-server/i,
    ruleID: "C-TERM-001",
    statement: "禁止直接杀掉 wezterm-mux-server",
  },
  {
    pattern: /rm\s+-rf\s+\/run\/user\/\d+\/natalia/i,
    ruleID: "C-TERM-002",
    statement: "禁止删除 Natalia 运行时目录",
  },
  {
    pattern: /rm\s+-rf\s+\/tmp\/natalia/i,
    ruleID: "C-TERM-003",
    statement: "禁止删除 Natalia 临时目录",
  },
];

/**
 * The native-terminal registry refuses with plain `Error`s ("terminal input is
 * controlled by a human", "terminal is accepting secure human input", …). Over
 * RPC those would land as `-32603 internal` with no machine-readable reason.
 * The P0-H members classify them as `refused` with the registry's own text as
 * the reason, so a consumer can tell "not now, a human is using it" from "the
 * channel broke" and act on it.
 */
function refusalFromRegistry(error: unknown): RuntimeRefusal {
  return new RuntimeRefusal(
    error instanceof Error ? error.message : String(error),
  );
}

function publicNativeTerminal(
  session: import("@natalia/native-terminal").NativeTerminalSession,
) {
  return {
    id: session.id,
    host: session.host,
    paneID: session.paneID,
    windowID: session.windowID,
    muxWindowID: session.muxWindowID,
    tabID: session.tabID,
    command: session.command,
    cwd: session.cwd,
    status: session.status,
    inputOwner: session.inputOwner,
    geometryOwner: session.geometryOwner,
    secureInput: session.secureInput,
    rows: session.rows,
    cols: session.cols,
    startedAt: session.startedAt,
    attached: session.attached,
    mayWaitForHuman: session.mayWaitForHuman,
  };
}

export type RealRuntimeClientOptions = {
  sessionID?: SessionID;
  episodeID?: import("@natalia/contracts").EpisodeID;
  title?: string;
  workspaceRoot?: string;
  sessionDir?: string;
  useSqliteStore?: boolean;
  provider?: StreamingProvider;
  tools?: ToolRegistry;
  permissionProfile?: string;
  permissionMode?: "ask" | "auto" | "read_only";
  toolPolicy?: ToolPolicy;
  hooks?: ToolHooks;
  nativeTerminal?: NativeTerminalRegistry;
  taskModuleContext?: TaskModuleContext;
  /** Host-owned registry shared with task delivery and other capability consumers. */
  capabilityRegistry?: CapabilityRegistry;
  /** Preferred host-owned capability lifetime; survives runtime config reloads. */
  capabilityHost?: CapabilityHost;
};

export function createRealRuntimeClient(
  options: RealRuntimeClientOptions = {},
): RuntimeClient {
  let workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  let sessionID: SessionID;
  const sessionStoreController = createSessionStoreController({
    workspaceRoot,
    sessionID: () => sessionID,
    sessionDir: options.sessionDir,
    useSqliteStore: options.useSqliteStore,
    title: options.title,
  });
  let provider = options.provider ?? providerFromEnvironment();
  let providerSource:
    | "explicit"
    | "environment"
    | "ts_config"
    | "unconfigured" = options.provider
    ? "explicit"
    : provider
      ? "environment"
      : "unconfigured";
  const processRegistry = options.tools
    ? undefined
    : new ManagedProcessRegistry();
  /**
   * Created before the tool registry, because the built-in tool families are
   * capabilities: the kernel owns every tool, and the registry the executor reads
   * is assembled from what the kernel accepted.
   */
  const capabilityRegistry: CapabilityRegistryHost =
    options.capabilityRegistry ?? new CapabilityRegistry();
  const initialFamilies = options.tools
    ? undefined
    : createToolRegistryFromCapabilities({
        registry: capabilityRegistry,
        processRegistry,
      });
  const tools = options.tools ?? initialFamilies!.tools;
  // A family that could not load at construction says why at start, instead of
  // its tools silently missing from the catalogue.
  const initialFamilyFailures = options.tools
    ? []
    : initialFamilies!.outcome.failed;
  const workspaceCapabilityView = options.capabilityHost?.view;
  if (options.taskModuleContext) {
    const registered = registerTaskModuleCapability(
      capabilityRegistry,
      options.taskModuleContext,
    );
    if (!registered.ok)
      throw new Error(`task module capability failed: ${registered.reason}`);
    // The capability owns its tool names; the runtime only moves what the kernel
    // accepted into the registry the executor reads. A task-scoped tool may never
    // shadow a registered one, or a flow could silently replace a policy-checked
    // implementation. Only this capability's own contributions are moved: the
    // built-in families are already in the registry, and re-reading them here
    // would report every one of them as a shadowing attempt.
    for (const contribution of capabilityRegistry.contributions<RuntimeTool>(
      "tools",
    )) {
      if (contribution.capabilityID !== TASK_MODULE_CAPABILITY_ID) continue;
      if (tools.has(contribution.name))
        throw new Error(
          `task module context cannot replace ${contribution.name}`,
        );
      tools.set(contribution.name, contribution.payload);
    }
  }
  let agentToolLayer = createToolPolicyHookLayer();
  let permissionProfileToolLayer = createToolPolicyHookLayer();
  const moduleToolLayer = createToolPolicyHookLayer(
    options.taskModuleContext
      ? moduleToolPolicy(options.taskModuleContext.moduleType)
      : undefined,
  );
  const modulePermissionToolLayer = createToolPolicyHookLayer(
    options.taskModuleContext?.modulePermissions?.tools,
  );
  const terminalCommandBuffer = new TerminalCommandBuffer({
    // Confirming the pane's foreground program is what lets an authorized
    // interactive program own the pane without reopening the shell bypass: the
    // mode ends as soon as the operating system reports a different program, and
    // input is refused when the host cannot answer at all.
    foregroundProgram: async (paneID) => {
      try {
        const ttyName = await terminalController.get()?.ttyName(paneID);
        if (!ttyName)
          return {
            supported: false as const,
            reason: `pane ${paneID} has no terminal device`,
          };
        return foregroundProcessForTTY(ttyName);
      } catch (error) {
        return {
          supported: false as const,
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
  const toolLayer = createToolPolicyHookLayer(options.toolPolicy, {
    preExecute: async (event) => {
      // System control, not a capability: an allow-list that forgets it must not
      // be able to make module completion impossible.
      if (
        options.taskModuleContext &&
        event.toolName === "flow_module_complete"
      )
        return { allowed: true, diagnostics: [] };
      const agentResult = await agentToolLayer.preExecute(event);
      if (!agentResult.allowed) return agentResult;
      const profileResult = await permissionProfileToolLayer.preExecute(event);
      if (!profileResult.allowed) return profileResult;
      const moduleResult = await moduleToolLayer.preExecute(event);
      if (!moduleResult.allowed)
        return {
          ...moduleResult,
          diagnostics: [
            `blocked outside active ${options.taskModuleContext?.moduleType} module: ${event.toolName}`,
          ],
        };
      const modulePermissionToolResult =
        await modulePermissionToolLayer.preExecute(event);
      if (!modulePermissionToolResult.allowed)
        return modulePermissionToolResult;
      const extensionResult = extensionToolPermission(event.toolName);
      if (!extensionResult.allowed) return extensionResult;
      const permission = evaluatePermissionRules(
        selectedAgent?.permissions,
        event.toolName,
        tryParseToolArguments(event.arguments),
        workspaceRoot,
      );
      if (!permission.allowed) return permission;
      const profilePermission = evaluatePermissionRules(
        selectedPermissionProfile?.permissions,
        event.toolName,
        tryParseToolArguments(event.arguments),
        workspaceRoot,
      );
      if (!profilePermission.allowed) return profilePermission;
      const args = tryParseToolArguments(event.arguments);
      const modulePermission = evaluatePermissionRules(
        options.taskModuleContext?.modulePermissions,
        event.toolName,
        args,
        workspaceRoot,
      );
      if (!modulePermission.allowed) return modulePermission;
      const bufferedProfileCommandPermission =
        await terminalCommandBuffer.evaluate(
          [
            selectedPermissionProfile?.commandRules,
            options.taskModuleContext?.moduleCommandRules,
          ].filter(
            (
              rules,
            ): rules is import("./tool-policy").PermissionProfileCommandRules =>
              Boolean(rules),
          ),
          event.toolName,
          args,
          [
            selectedPermissionProfile?.interactivePrograms,
            options.taskModuleContext?.moduleInteractivePrograms,
          ],
        );
      const profileCommandPermission =
        bufferedProfileCommandPermission ??
        (await evaluatePermissionProfileCommandRules(
          selectedPermissionProfile?.commandRules,
          event.toolName,
          args,
        ));
      if (!profileCommandPermission.allowed) return profileCommandPermission;
      if (!bufferedProfileCommandPermission) {
        const moduleCommandPermission =
          await evaluatePermissionProfileCommandRules(
            options.taskModuleContext?.moduleCommandRules,
            event.toolName,
            args,
            "active module",
          );
        if (!moduleCommandPermission.allowed) return moduleCommandPermission;
      }
      return (
        (await options.hooks?.preExecute?.(event)) ?? {
          allowed: true,
          diagnostics: [],
        }
      );
    },
    postExecute: options.hooks?.postExecute,
  });
  let permissionMode = options.permissionMode ?? "ask";
  let selectedPermissionProfile:
    | Awaited<
        ReturnType<typeof resolveConfig>
      >["config"]["permissionProfiles"][string]
    | undefined;
  let maxSteps: number | undefined;
  const subagentsController = createSubagentsController({
    workDir: workspaceRoot,
  });
  const terminalController = createTerminalController({
    workspaceRoot,
    publish,
    onPerformance: (name, durationMs) =>
      performanceTrace.mark(name, durationMs),
    runtimeID: () => nativeRuntimeID,
    userRuntimeHome: () => userRuntimeHome(),
    windowMode: () => tsRuntimeConfig?.runtime.terminal.windowMode ?? "auto",
    external: options.nativeTerminal,
  });
  const sandboxController = createSandboxController({ workspaceRoot });
  const checkpointController = createCheckpointController({
    sessionID: () => sessionID,
    workspaceRoot,
    checkpoint: () => tsRuntimeConfig?.checkpoint,
    workspace: () => tsRuntimeConfig?.workspace,
    publish,
    context: () => runtimeContext,
    subagents: () =>
      subagentsController.enabled() ? subagentsController.get() : undefined,
    activeAbort: () => activeAbort,
  });
  const pluginsController = createPluginsController({
    workspaceRoot,
    tools,
    capabilityRegistry,
    pluginPaths: () => tsRuntimeConfig?.plugins.paths ?? [],
    pluginEnabled: () => tsRuntimeConfig?.plugins.enabled,
    pluginCapabilities: () => tsRuntimeConfig?.plugins.capabilities,
    pluginReadOnly: () => tsRuntimeConfig?.plugins.readOnly,
    pluginSettings: () => tsRuntimeConfig?.plugins.settings,
    publish,
    syncGlobalCommands: () => setGlobalPluginCommands(commandCatalogEntries()),
  });
  const mcpController = createMcpController({
    servers: () => tsRuntimeConfig?.mcpServers ?? {},
    workspaceRoot,
    tools,
    enabled: () => extensionEnabled("mcp"),
    publish,
  });
  const mcpAccess = mcpController.access;
  const toolCalls = new Map<string, number>();
  let runtimeContext = new ContextLedger();
  /**
   * Approvals and questions, and everything that belongs to them. The runtime
   * hands over only what changes underneath the waiter, as accessors rather than
   * values: a captured permission mode or abort signal would go stale the moment
   * the mode changed or the turn ended.
   */
  const interactive = createInteractiveWaiter({
    publish: (event) => publish(event),
    sessionID: () => sessionID,
    permissionMode: () => permissionMode,
    abortSignal: (turnID) =>
      executionBySession.get(turnSession.get(turnID) ?? sessionID)?.activeAbort
        ?.signal,
    activeTurnID: () => activeExec?.activeTurnID,
    isPending: (sessionID, id, kind) =>
      isPendingInteractiveRequest(sessionID, id, kind),
    sessionIDForTurn: (turnID) => turnSession.get(turnID) ?? sessionID,
    publishForSession: (sessionID, event) =>
      publishForSession(executionBySession.get(sessionID), event),
  });
  let sink: ((event: RuntimeEvent) => void) | undefined;
  let replayMode: "all" | "none" = "all";
  let session: SessionRecord | undefined;
  let lastSubmitted: SubmittedTurn | undefined;
  let activeAbort: AbortController | undefined;
  let activeTurnID: string | undefined;
  /**
   * TERM-M.3 (c): set when the model's request_human call ends the turn on
   * purpose; consumed by the turn-finish path in `publish`.
   */
  let endTurnWaitingHuman: { terminalID: string; reason: string } | undefined;
  /**
   * Which session each turn was submitted to. With parallel sessions a turn
   * keeps running after the UI attaches elsewhere, and its approvals must be
   * judged against the session it belongs to — never the attached one.
   */
  const turnSession = new Map<string, SessionID>();
  /**
   * Everything a running turn reads and writes, keyed per session (D2: one
   * turn per session, sessions in parallel). The runtime keeps one activity
   * exec — the session the UI is attached to — and one exec per session that
   * has background work. Plan §41.9: state is reached by session, never
   * captured as a single value.
   */
  type SessionExecutionState = {
    session: SessionRecord;
    context: ContextLedger;
    activeAbort?: AbortController;
    activeTurnID?: string;
    selectedAgent?: AgentDefinition;
    pendingAgent?: AgentDefinition;
    selectedModel?: { modelID?: string; variant?: string };
    lastProviderUsage?: { inputTokens: number; outputTokens: number };
    activeSkill?: Skill;
    endTurnWaitingHuman?: { terminalID: string; reason: string };
  };
  const executionBySession = new Map<SessionID, SessionExecutionState>();
  let activeExec: SessionExecutionState | undefined;
  /** D2: serialises workspace writes across parallel sessions. */
  const workspaceWriteLock = createWorkspaceWriteLock();
  let paused = false;
  let pauseWaiters: Array<() => void> = [];
  let ready: Promise<void> | undefined;
  let readySettled = false;
  const skillsController = createSkillsController({
    workspaceRoot,
    userRoot: () => userSkillRoot(),
    remoteURLs: () => tsRuntimeConfig?.skills.urls,
  });
  let activeSkill: Skill | undefined;
  const attachmentReferences = new Map<
    string,
    import("@natalia/contracts").LocalAttachment[]
  >();
  const runtimeDiagnostics: Array<
    Extract<RuntimeEvent, { type: "diagnostic" }> & { at: string }
  > = [];
  const publishedWorkflowContributionDiagnostics = new Set<string>();
  let selectedAgent: AgentDefinition | undefined;
  let selectedModel: { modelID?: string; variant?: string } | undefined;
  let pendingAgent: AgentDefinition | undefined;
  let agentRegistry: AgentRegistry | undefined;
  let lastProviderUsage:
    | { inputTokens: number; outputTokens: number }
    | undefined;
  let sessionPersistence = Promise.resolve();
  const nativeRuntimeID = randomUUID();
  let tsRuntimeConfig:
    | Awaited<ReturnType<typeof resolveConfig>>["config"]
    | undefined;
  let runtimeContextConfig = contextStatusConfig();
  let retryPolicy: NonNullable<Parameters<typeof runWithRetry>[2]>["policy"];
  const mutationRegistry = createMutationRegistry();
  const workspaceFilesController = createWorkspaceFilesController({
    workspaceRoot,
    listPaths: async () => {
      const entries = await findWorkspaceFiles({ workspaceRoot, limit: 1000 });
      return entries
        .filter((entry) => entry.type === "file")
        .map((entry) => entry.path);
    },
    resolveMutation: (path) => {
      const mutation = mutationRegistry.match({
        path,
        operation: "modified",
      });
      if (!mutation) return undefined;
      const identity: WorkspaceMutationIdentity = {
        origin: mutation.operationID ? "sandbox_merge" : "tool",
      };
      if (mutation.turnID) identity.turnID = mutation.turnID;
      if (mutation.callID) identity.callID = mutation.callID;
      if (mutation.operationID) identity.operationID = mutation.operationID;
      if (mutation.sessionID) identity.sessionID = mutation.sessionID;
      if (mutation.episodeID) identity.episodeID = mutation.episodeID;
      return identity;
    },
  });
  const driftEvaluator = createDriftEvaluator({
    openFindingIDs: () =>
      new Set(
        (session?.events ?? [])
          .filter(
            (
              event,
            ): event is Extract<
              RuntimeEvent,
              { type: "drift.finding_opened" }
            > => event.type === "drift.finding_opened",
          )
          .map((event) => event.findingID),
      ),
  });
  const statusController = createStatusSnapshotController({
    provider: () => provider,
    context: () => runtimeContext,
    workspaceRoot,
    permissionMode: () => permissionMode,
    runningCount: async () =>
      subagentsController.runningCount() +
      sandboxController.runningResourceCount() +
      (processRegistry
        ? await processRegistry.runningCount({ workspaceRoot })
        : 0),
    publish,
  });
  async function runtimeStatusSnapshot() {
    return await statusController.snapshot();
  }

  function scheduleRuntimeStatusSnapshot() {
    statusController.schedule();
  }
  const terminalStatusByID = new Map<string, string>();
  const performanceTrace = new RuntimePerformanceTrace();
  const sandboxResourcesByID = new Map<string, number>();
  const turnCoordinator = () => sessionRunCoordinator(sessionID);
  /**
   * P8 C1 writer state: the currently running tool per turn, kept current at
   * the same single choke point the Work Graph writer uses, so a session
   * intelligence snapshot can answer "what tool is running now" from real state
   * instead of guessing.
   */
  const activeToolByTurn = new Map<string, string>();
  let sessionSnapshotSequence = 0;
  let decisionSequence = 0;
  let evidenceSequence = 0;
  let mailboxSequence = 0;
  let chatSequence = 0;
  let collabSequence = 0;
  let chatBusy = false;
  let planSequence = 0;
  let completionSequence = 0;

  /**
   * Re-reads the config and re-resolves the provider from it.
   *
   * Reports both facts separately because they are separately interesting: the
   * file may be readable and applied while naming the same provider as before,
   * and a caller that only learns "false" cannot tell that from "the file could
   * not be read at all".
   */
  /**
   * Why a config reload cannot be applied at this instant, or nothing when it can.
   * Shared by the query and the action so the two can never disagree.
   */
  function configReloadBlockedReason() {
    if (activeExec?.activeTurnID)
      return "runtime config cannot be applied while a turn is running";
    if (interactive.hasPendingWaiters())
      return "runtime config cannot be applied while an approval or question is pending";
    return undefined;
  }

  /**
   * Reloads config from disk and applies it, answering value-style. Shared by
   * `reloadConfig` and `updateConfig` so the two write-apply paths cannot
   * drift.
   */
  async function applyConfigFromDisk(): Promise<{
    applied: boolean;
    reason?: string;
  }> {
    const blocked = configReloadBlockedReason();
    if (blocked) return { applied: false, reason: blocked };
    const reloaded = await reloadConfigFromDisk();
    if (!reloaded.read) {
      const reason = "runtime config on disk could not be read";
      publish({ type: "diagnostic", level: "warning", message: reason });
      return { applied: false, reason };
    }
    publish({
      type: "diagnostic",
      level: "info",
      message: reloaded.providerReconfigured
        ? "runtime config reloaded; provider reconfigured from disk"
        : "runtime config reloaded; provider unchanged",
    });
    scheduleRuntimeStatusSnapshot();
    return { applied: true };
  }

  async function reloadConfigFromDisk(): Promise<{
    read: boolean;
    providerReconfigured: boolean;
  }> {
    try {
      const tsConfig = await resolveConfig({ workspaceRoot });
      tsRuntimeConfig = tsConfig.config;
      runtimeContextConfig = contextStatusConfig(tsConfig.config);
      maxSteps = tsConfig.config.runtime.maxStepsPerTurn;
      // The config service is refreshed in place, so consumers of the service
      // are notified of the reload.
      refreshRuntimeConfigService(capabilityRegistry, tsConfig.config);
      // Permission changes (default profile switch, auto/ask flip, profile
      // edits) apply immediately, not on the next restart.
      reloadPermissionSettings(tsConfig.config);
      applyAgentPolicy();
      if (
        selectedPermissionProfile?.commandRules &&
        selectedPermissionProfile.commandRules.mode !== "none"
      )
        await ensureBashCommandParser().catch(() => undefined);
      if (!options.provider) {
        const configured = providerForModel(
          tsConfig.config,
          selectedAgent?.model ?? tsConfig.config.defaultModel,
          selectedAgent?.variant,
        );
        if (configured) {
          provider = configured;
          providerSource = "ts_config";
          return { read: true, providerReconfigured: true };
        }
      }
      return { read: true, providerReconfigured: false };
    } catch {
      /* config file not readable yet */
    }
    return { read: false, providerReconfigured: false };
  }

  async function initialize() {
    try {
      const tsConfig = await resolveConfig({ workspaceRoot });
      tsRuntimeConfig = tsConfig.config;
      runtimeContextConfig = contextStatusConfig(tsConfig.config);
      retryPolicy = {
        maxAttemptsPerStep: tsConfig.config.runtime.retry.maxAttemptsPerStep,
        initialBackoffMs: tsConfig.config.runtime.retry.initialBackoffMs,
        maxBackoffMs: tsConfig.config.runtime.retry.maxBackoffMs,
        jitterMs: tsConfig.config.runtime.retry.jitterMs,
      };
      maxSteps = tsConfig.config.runtime.maxStepsPerTurn;
      // The config is a kernel service: plugins and tool families can resolve
      // it by name and subscribe to its updates.
      const registeredConfig = registerRuntimeConfigCapability(
        capabilityRegistry,
        tsConfig.config,
      );
      if (!registeredConfig.ok)
        publish({
          type: "diagnostic",
          level: "warning",
          owner: RUNTIME_CONFIG_CAPABILITY_ID,
          message: `runtime config service unavailable: ${registeredConfig.reason}`,
        });
      if (
        options.permissionProfile &&
        !tsConfig.config.permissionProfiles[options.permissionProfile]
      )
        throw new Error(
          `permission profile not found: ${options.permissionProfile}`,
        );
      reloadPermissionSettings(tsConfig.config);
      if (
        (selectedPermissionProfile?.commandRules &&
          selectedPermissionProfile.commandRules.mode !== "none") ||
        (options.taskModuleContext?.moduleCommandRules &&
          options.taskModuleContext.moduleCommandRules.mode !== "none")
      )
        await ensureBashCommandParser();
      agentRegistry = agentsFromConfig(tsConfig.config);
      selectedAgent = agentRegistry.default();
      if (Object.keys(tsConfig.config.agents).length && !selectedAgent)
        publish({
          type: "diagnostic",
          level: "warning",
          message:
            "TS config has no selectable primary agent; continuing with the configured default model.",
        });
      if (!options.provider) {
        const configured = providerForModel(
          tsConfig.config,
          selectedAgent?.model ?? tsConfig.config.defaultModel,
          selectedAgent?.variant,
        );
        if (configured) {
          provider = configured;
          providerSource = "ts_config";
          publish({
            type: "diagnostic",
            level: "info",
            message:
              "Loaded provider/model/runtime settings from .natalia/config.json; API key remains in memory only.",
          });
        } else if (
          tsConfig.sources.some(
            (source) => source.scope !== "defaults" && source.applied,
          )
        ) {
          publish({
            type: "diagnostic",
            level: "warning",
            message:
              "TS config has no complete provider/model/API-key selection; configure a provider or environment credential.",
          });
        }
      }
      applyAgentPolicy();
    } catch (error) {
      publish({
        type: "diagnostic",
        level: "warning",
        message: `TS config was not used: ${error instanceof Error ? error.message : String(error)}`,
      });
      if (options.permissionProfile) throw error;
    }
    await workspaceFilesController.init();
    sessionID =
      options.sessionID ?? (`ses_${sessionSeed(workspaceRoot)}` as SessionID);
    await sessionStoreController.init();
    await subagentsController.init(async (task, runner) => {
      if (!provider) throw new Error("provider unavailable for subagent");
      const record = subagentsController.get().get(runner.agentId);
      const allowed = record?.allowedTools ?? [];
      const excluded = new Set(record?.excludeTools ?? []);
      const messages: ProviderMessage[] = [
        {
          role: "system",
          content:
            "You are a focused Natalia TS/Bun subagent. Use the provided native tools for filesystem work. Return a concise factual final result. Never claim a tool action you did not run. Do not reveal private reasoning.",
        },
        { role: "user", content: task },
      ];
      runner.log(`accepted: ${task}`);
      for (let step = 1; step <= effectiveMaxSteps(); step++) {
        let output = "";
        const calls: ProviderToolCall[] = [];
        const visibleTools = [...tools.values()].filter(
          (tool) =>
            isToolAllowed(tool.name) &&
            (permissionMode !== "read_only" || !tool.requiresApproval) &&
            !excluded.has(tool.name) &&
            (!allowed.length || allowed.includes(tool.name)),
        );
        for await (const chunk of provider.stream({
          messages,
          tools: visibleTools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
          signal: runner.signal,
        })) {
          if (chunk.type === "content") output += chunk.text;
          if (chunk.type === "tool_call") calls.push(...chunk.calls);
        }
        if (!calls.length) {
          runner.log(output.trim() || "completed without text output");
          return;
        }
        messages.push({
          role: "assistant",
          content: output,
          toolCalls: calls,
        });
        for (const call of calls) {
          const tool = tools.get(call.name);
          if (!tool)
            throw new Error(
              `subagent requested unavailable tool: ${call.name}`,
            );
          if (
            !isToolAllowed(tool.name) ||
            excluded.has(tool.name) ||
            (allowed.length && !allowed.includes(tool.name))
          )
            throw new Error(`subagent tool denied by policy: ${tool.name}`);
          const toolID = `subagent:${runner.agentId}:${step}:${call.id}`;
          const hookEvent: ToolHookEvent = {
            turnID: `subagent:${runner.agentId}`,
            toolName: tool.name,
            toolCallID: call.id,
            arguments: call.arguments,
          };
          const preResult = await toolLayer.preExecute(hookEvent);
          if (!preResult.allowed)
            throw new Error(
              `subagent tool denied by policy: ${preResult.diagnostics.join("; ")}`,
            );
          if (permissionMode === "read_only" && tool.requiresApproval)
            throw new Error(readOnlyToolMessage(tool.name));
          if (tool.requiresApproval) {
            // This path reports denials by throwing, so a refusal has to
            // throw too. Returning it would let the subagent run a call the
            // user just refused.
            const refusal = await interactive.requireApproval(
              toolID,
              tool,
              call,
              hookEvent.turnID,
            );
            if (refusal) throw new Error(refusal.reason);
          }
          const parsed = parseToolArguments(call.arguments);
          const paramErrors = validateToolParameters(tool.parameters, parsed);
          if (paramErrors.length)
            throw new Error(
              `tool "${tool.name}" parameter validation failed: ${paramErrors.map((error) => `${error.path}: ${error.message}`).join("; ")}`,
            );
          const result = await tool.execute(parsed, {
            workspaceRoot,
            signal: runner.signal,
            askQuestion: async (question) =>
              await interactive.requireQuestion(
                `${toolID}:question`,
                hookEvent.turnID,
                question,
              ),
            subagents: subagentsController.get(),
            nativeTerminal: terminalController.get(),
            sandboxes: sandboxController.get(),
            workspaceReadAuthorize: authorizeWorkspaceRead,
            sandboxMergeAuthorize: authorizeSandboxMerge,
            settings: toolSettings(),
            parentSessionID: sessionID,
            parentAgentID: runner.agentId,
            maxSubagentDepth: tsRuntimeConfig?.runtime.subagentDepth,
          });
          await toolLayer.postExecute({ ...hookEvent, result });
          runner.log(`tool ${tool.name}: ${result.slice(0, 240)}`);
          messages.push({
            role: "tool",
            content: result,
            toolCallID: call.id,
          });
        }
      }
      throw new Error("subagent step limit reached");
    });
    const subagentRegistry = subagentsController.get();
    subagentRegistry.subscribe((event) => {
      const record = subagentRegistry.get(event.agentId);
      publish({
        type: "subagent.update",
        id: event.agentId,
        event: event.event as Extract<
          RuntimeEvent,
          { type: "subagent.update" }
        >["event"],
        status: event.status as Extract<
          RuntimeEvent,
          { type: "subagent.update" }
        >["status"],
        attached: event.attached,
        task: record?.task,
        text: event.text,
        parentSessionID: event.parentSessionID,
        parentAgentID: event.parentAgentID,
        continuation: event.continuation,
      });
      if (event.event === "created" || event.event === "done")
        scheduleRuntimeStatusSnapshot();
    });
    if (tsRuntimeConfig && extensionEnabled("mcp")) {
      await mcpController.reload();
    }
    // The config's `tools.enabled` decides which built-in families stay: a
    // disabled family's capability is unloaded and its tools dropped, so they
    // are never callable and never appear in `tool.registered`. A family that
    // depends on a disabled one is cascade-disabled too, and says why.
    if (tsRuntimeConfig && !options.tools) {
      for (const failure of initialFamilyFailures)
        publish({
          type: "diagnostic",
          level: "warning",
          owner: failure.id,
          message: `tool family ${failure.id} is not loaded: ${failure.reason}`,
        });
      const cascaded = applyToolFamilyEnabledFilter({
        tools,
        registry: capabilityRegistry,
        families: builtinToolFamilies(processRegistry),
        enabled: tsRuntimeConfig.tools?.enabled,
      });
      for (const family of cascaded)
        publish({
          type: "diagnostic",
          level: "warning",
          owner: toolFamilyCapabilityID(family.id),
          message: `tool family ${family.id} is not loaded: ${family.reason}`,
        });
    }
    if (extensionEnabled("plugins")) {
      await pluginsController.init();
    }
    await terminalController.init();
    terminalController.setActiveSession(sessionID);

    await sandboxController.init();
    session = sessionStoreController.sqlite()
      ? ((await sessionStoreController.json().load(sessionID)) ??
        createSessionRecord(
          sessionID,
          options.title ?? `Natalia TS session ${sessionID}`,
        ))
      : await sessionStoreController
          .json()
          .loadOrCreate(
            sessionID,
            options.title ?? `Natalia TS session ${sessionID}`,
          );
    if (!session) throw new Error("session initialization did not complete");
    // D2: the startup session is the first exec; the activity view (the
    // `session`/`runtimeContext` closures) aliases it until an attach switches.
    activeExec = { session, context: runtimeContext };
    executionBySession.set(sessionID, activeExec);
    let sqliteRecovery:
      | ReturnType<
          NonNullable<
            ReturnType<typeof sessionStoreController.sqlite>
          >["loadRecoveryProjection"]
        >
      | undefined;
    let sqliteEpoch: ReturnType<
      NonNullable<
        ReturnType<typeof sessionStoreController.sqlite>
      >["loadContextEpoch"]
    >;
    let indexedPagedRecovery = false;
    const sessionSqlite = sessionStoreController.sqlite();
    if (sessionSqlite) {
      let durable = sessionSqlite.get(sessionID);
      sqliteEpoch = sessionSqlite.loadContextEpoch(sessionID);
      indexedPagedRecovery = replayMode === "none" && Boolean(sqliteEpoch);
      let events = indexedPagedRecovery
        ? []
        : sessionSqlite.loadEvents(sessionID);
      if (!events.length && !indexedPagedRecovery && session.events.length) {
        // Migrate an existing JSON-only session once, before SQLite becomes the
        // event authority. New SQLite sessions never mirror durable events back.
        sessionSqlite.replace(session);
        durable = sessionSqlite.get(sessionID);
        events = sessionSqlite.loadEvents(sessionID);
      }
      if (durable) {
        session = {
          ...session,
          title: durable.title,
          createdAt: durable.createdAt,
          cancelled: durable.cancelled,
          resumable: durable.resumable,
          metadata: durable.metadata,
          // SQLite is the durable event authority in SQLite mode. Preserve a
          // legacy JSON-only session only until it is explicitly imported.
          events: events.length ? events : session.events,
          inbox: sessionSqlite.loadInbox(sessionID).length
            ? sessionSqlite.loadInbox(sessionID)
            : session.inbox,
        };
      }
      if (indexedPagedRecovery)
        sqliteRecovery = sessionSqlite.loadRecoveryProjection(sessionID);
    }
    // The startup exec was created before durable recovery replaced the session
    // record. Point it at the recovered record, or per-session reads through the
    // exec (durable metadata like `pendingHumanTerminal`, the inbox, the event
    // list) would silently see the pre-recovery shell instead of the restored
    // state.
    if (activeExec) activeExec.session = session;
    await cleanupUnreferencedAttachments({
      workspaceRoot,
      attachments: sessionStoreController.sqlite()
        ? sessionStoreController.sqlite()!.referencedAttachments()
        : referencedAttachmentsForSessions(
            await sessionStoreController.json().list(),
          ),
    }).catch((error) =>
      publish({
        type: "diagnostic",
        level: "warning",
        message: `attachment cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
    const interruptedOperation = session.metadata?.inFlightOperation;
    const interrupted = sqliteRecovery
      ? settleInterruptedTurnIDs(
          sqliteRecovery.activeTurnIDs,
          sqliteRecovery.approvals.map((request) => request.id),
          sqliteRecovery.questions.map((request) => request.id),
        )
      : settleInterruptedTurns(session);
    const operationTurnWasInterrupted = Boolean(
      interruptedOperation &&
        interrupted.some(
          (event) =>
            event.type === "turn.finished" &&
            event.id === interruptedOperation.turnID,
        ),
    );
    if (interruptedOperation) {
      delete session.metadata?.inFlightOperation;
      sessionStoreController
        .sqlite()
        ?.updateMetadata(sessionID, { inFlightOperation: undefined });
    }
    if (interrupted.length || interruptedOperation) {
      if (sessionStoreController.sqlite())
        sessionStoreController.sqlite()!.appendEvents(sessionID, interrupted);
      else await sessionStoreController.json().save(session);
      publish({
        type: "diagnostic",
        level: "warning",
        message: operationTurnWasInterrupted
          ? `previous process stopped during ${interruptedOperation!.kind === "provider_dispatch" ? "provider dispatch" : "tool execution"}; the operation was safely settled as an error and cannot be replayed without an idempotency contract`
          : `previous process stopped during ${interrupted.filter((event) => event.type === "turn.finished").length} active turn(s); unresolved interactive requests were rejected because incomplete provider work cannot be replayed`,
      });
    }
    const projection = projectSession(session);
    for (const event of sqliteRecovery?.diagnostics ?? [])
      runtimeDiagnostics.push({
        ...event,
        at: event.at ?? session.createdAt,
      });
    for (const event of projection.replayableEvents)
      if (event.type === "diagnostic")
        runtimeDiagnostics.push({
          ...event,
          at: event.at ?? session.createdAt,
        });
    for (const event of projection.replayableEvents)
      if (event.type === "turn.submitted" && event.attachments?.length)
        attachmentReferences.set(`${event.id}:user`, event.attachments);
    const selectedAgentName =
      sqliteRecovery?.selectedAgent ?? projection.selectedAgent;
    if (selectedAgentName) {
      const restored = agentRegistry?.select(selectedAgentName);
      if (restored) {
        selectedAgent = restored;
        applyAgentPolicy();
        applyAgentProvider();
      } else {
        publish({
          type: "diagnostic",
          level: "warning",
          message: `persisted agent is no longer configured: ${selectedAgentName}`,
        });
      }
    }
    const recoveredModel =
      sqliteRecovery?.selectedModel ?? projection.selectedModel;
    if (recoveredModel) {
      selectedModel = recoveredModel;
      applyAgentProvider();
    }
    await cleanupToolOutput(workspaceRoot).catch((error) =>
      publish({
        type: "diagnostic",
        level: "warning",
        message: `tool output cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
    const latestContextCheckpoint = [...projection.replayableEvents]
      .reverse()
      .find((event) => event.type === "context.checkpoint");
    if (sqliteEpoch)
      runtimeContext.restoreDurableCheckpoint(sqliteEpoch.snapshot);
    else if (latestContextCheckpoint)
      runtimeContext.restoreDurableCheckpoint(latestContextCheckpoint.snapshot);
    restoreContextFromEvents(
      runtimeContext,
      sqliteEpoch
        ? sessionStoreController
            .sqlite()!
            .loadEventsAfter(sessionID, sqliteEpoch.baselineSeq)
        : modelVisibleEvents(projection.replayableEvents),
    );
    for (const [turnID, attachments] of sqliteRecovery?.attachments ?? [])
      attachmentReferences.set(`${turnID}:user`, attachments);
    const [queued] = projection.pendingInputs.filter(
      (input) => input.delivery === "queue",
    );
    if (queued) void turnCoordinator().wake(drainSession);
    if (extensionEnabled("skills")) await skillsController.init();
    const activeSkillEntry = [...runtimeContext.snapshot().entries]
      .reverse()
      .find(
        (entry) => entry.role === "system" && entry.id.startsWith("skill:"),
      );
    const qualifiedName = activeSkillEntry?.id.match(
      /^skill:((?:project|remote|user):[^:]+):/u,
    )?.[1];
    if (qualifiedName && skillsController.enabled()) {
      try {
        activeSkill = skillsController.resolve(qualifiedName);
      } catch {
        // A removed skill must not prevent durable session recovery.
      }
    }
    if (extensionEnabled("skills"))
      tools.set(
        "skill_load",
        createSkillLoadTool({
          registry: () =>
            skillsController.enabled() ? skillsController.get() : undefined,
          onLoad: (skill, output) => {
            activeSkill = skill;
            runtimeContext.add({
              id: `skill:${skill.qualifiedName}:${runtimeContext.journalStatus().journalOffset}`,
              role: "system",
              content: output,
            });
          },
        }),
      );
    else tools.delete("skill_load");
    // P8 C3: the main agent acknowledges delivered mailbox intents it acted
    // on; acknowledged messages stop being re-injected as pending intents.
    tools.set(
      "mailbox_acknowledge",
      createMailboxAcknowledgeTool({
        onAcknowledge: async (messageIDs) => {
          if (!session) return;
          const at = new Date().toISOString();
          for (const messageID of messageIDs) {
            const message = projectedMailboxMessages(session.events).find(
              (candidate) =>
                candidate.messageID === messageID &&
                candidate.status === "delivered",
            );
            if (!message) continue;
            publishForSession(
              activeExec,
              buildMailboxStatus({
                id: `${messageID}:acknowledged:${mailboxSequence++}`,
                messageID,
                status: "acknowledged",
                at,
              }),
            );
          }
        },
      }),
    );
    // P8 §56.62 collaboration channel: the main agent responds to Navi's
    // suggestions (adopt/reject/defer) and may ask her a question — she sees
    // both in her next turn's context, so neither agent waits for the user.
    tools.set("collab_respond", {
      name: "collab_respond",
      description:
        "Respond to a suggestion from Navi, the Live Work Chat collaborator: adopt it, reject it, or defer it with a reason. The message id comes from the <navi_collaborations> context block.",
      requiresApproval: false,
      parameters: {
        type: "object",
        properties: {
          messageID: { type: "string" },
          decision: {
            type: "string",
            enum: ["adopted", "rejected", "deferred"],
          },
          reason: { type: "string" },
        },
        required: ["messageID", "decision"],
        additionalProperties: false,
      },
      async execute(parsed) {
        const args = parsed as {
          messageID?: string;
          decision?: string;
          reason?: string;
        };
        if (
          typeof args.messageID !== "string" ||
          typeof args.decision !== "string"
        )
          return "collab_respond requires messageID and decision";
        if (!session) return "no session";
        const messageID = args.messageID;
        // Models routinely truncate the id to its tail; accept an exact id or
        // a unique suffix of it.
        const target = projectedCollabMessages(session.events).find(
          (message) =>
            message.kind === "suggestion" &&
            message.status === "proposed" &&
            (message.id === messageID ||
              message.id.endsWith(messageID) ||
              messageID.endsWith(message.id)),
        );
        if (!target) return `no suggestion ${messageID}`;
        publish({
          type: "collab.response",
          id: `collab:response:${Date.now().toString(36)}:${collabSequence++}`,
          // Publish with the matched message's real id, not the (possibly
          // truncated) args id, so the projection can fold the decision back.
          messageID: target.id,
          from: "main_agent",
          decision: args.decision as "adopted" | "rejected" | "deferred",
          ...(args.reason
            ? { reason: redactToolOutput(args.reason, true) }
            : {}),
          at: new Date().toISOString(),
        });
        return JSON.stringify({ responded: true });
      },
    } as RuntimeTool);
    tools.set("collab_inbox", {
      name: "collab_inbox",
      description:
        "Read the collaboration channel with Navi (the Live Work Chat, your younger sister): her answers to your questions, her pending suggestions and their outcomes. Call it whenever you are unsure whether she replied or what she said.",
      requiresApproval: false,
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      async execute() {
        if (!session) return "[]";
        const messages = projectedCollabMessages(session.events);
        return JSON.stringify(
          messages.slice(-10).map((message) => ({
            id: message.id,
            kind: message.kind,
            from: message.from,
            to: message.to,
            text: message.text,
            status: message.status,
            ...(message.questionID ? { questionID: message.questionID } : {}),
          })),
        );
      },
    } as RuntimeTool);
    tools.set("collab_ask", {
      name: "collab_ask",
      description:
        "Ask Navi, the Live Work Chat collaborator (your younger sister), a question about the work — a second opinion on an approach, risk or tradeoff. She sees it in her next turn and answers with collab_answer. Use it when an outside read would genuinely help, not for trivia.",
      requiresApproval: false,
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
        },
        required: ["question"],
        additionalProperties: false,
      },
      async execute(parsed) {
        const args = parsed as { question?: string };
        if (typeof args.question !== "string" || !args.question.trim())
          return "collab_ask requires question";
        if (!session) return "no session";
        publish({
          type: "collab.question",
          id: `collab:question:${Date.now().toString(36)}:${collabSequence++}`,
          from: "main_agent",
          to: "live_chat",
          question: redactToolOutput(args.question, true),
          at: new Date().toISOString(),
        });
        // If Navi is not mid-conversation with the user, wake her to answer
        // immediately; if she is chatting, the question waits for her next
        // turn boundary (the queued path).
        if (!chatBusy) void wakeNavi().catch(() => undefined);
        return JSON.stringify({ asked: true });
      },
    } as RuntimeTool);
    publish({
      type: "session.created",
      sessionID,
      title: session.title,
    });
    if (replayMode === "all") for (const event of session.events) sink?.(event);
    if (sqliteRecovery)
      interactive.restoreRecoveredInteractiveState(
        sqliteRecovery.approvals.filter(
          (request) =>
            !interrupted.some(
              (event) =>
                event.type === "approval.response" && event.id === request.id,
            ),
        ),
        sqliteRecovery.questions.filter(
          (request) =>
            !interrupted.some(
              (event) =>
                event.type === "question.response" && event.id === request.id,
            ),
        ),
      );
    else interactive.restoreInteractiveState(session.events);
    if (replayMode === "none") {
      const pending = sqliteRecovery
        ? {
            approvals: sqliteRecovery.approvals.filter(
              (request) =>
                !interrupted.some(
                  (event) =>
                    event.type === "approval.response" &&
                    event.id === request.id,
                ),
            ),
            questions: sqliteRecovery.questions.filter(
              (request) =>
                !interrupted.some(
                  (event) =>
                    event.type === "question.response" &&
                    event.id === request.id,
                ),
            ),
          }
        : projectInteractiveRequests(session.events);
      for (const request of pending.approvals) sink?.(request);
      for (const request of pending.questions) sink?.(request);
    }
    await checkpointController.init();
    // The exec is the turn's view of agent/model state; the closures were the
    // source of truth during init, so mirror them before any turn can run.
    if (activeExec) {
      activeExec.selectedAgent = selectedAgent;
      activeExec.selectedModel = selectedModel;
    }
    publish({ type: "session.ready", sessionID });
    // The self-protection rules are the first constitution facts: migrate them
    // into the durable journal on every boot (idempotent — replay already holds
    // them) so `constitutionRules()` and the /constitution UI answer real rules,
    // not the empty projection CST1 shipped.
    for (const rule of seedConstitutionRules(session.events)) {
      publish(rule);
      // CST4 Work Graph linkage: each seeded rule is a `constraint` node, so
      // tool calls and drift findings can relate to it in the graph.
      publish(
        constitutionRuleNode({
          ruleID: rule.ruleID,
          statement: rule.statement,
          sessionID,
        }),
      );
    }
    // Overrides are visible, not silent: a plugin that replaced a built-in
    // tool shows up in diagnostics so nobody discovers it by surprise.
    for (const override of capabilityRegistry.overrides())
      publish({
        type: "diagnostic",
        level: "warning",
        message: `capability "${override.winner}" (precedence ${override.winnerPrecedence}) replaced "${override.loser}" (precedence ${override.loserPrecedence}) for ${override.kind} "${override.name}"`,
      });
    publishBuiltinCapabilities();
    publishRegisteredTools();
    publish(contextStatusEvent(runtimeContext.status(runtimeContextConfig)));
    publish(await runtimeStatusSnapshot());
  }

  /**
   * Publishes the built-in capability catalogue. The records are data owned by
   * `capabilities/builtin-capabilities.ts`; this only supplies the registry and
   * forwards the resulting durable events.
   */
  function publishBuiltinCapabilities() {
    const outcome = registerBuiltinCapabilities(capabilityRegistry);
    for (const event of outcome.loaded) publish(event);
    // A capability that refused to load says so, rather than being absent for no
    // stated reason.
    for (const event of outcome.failed)
      publish({
        type: "diagnostic",
        level: "warning",
        owner: "natalia-runtime",
        message: `capability ${event.id} failed: ${event.reason}`,
      });
  }

  /**
   * Records the effective tool catalogue once the runtime has assembled all
   * built-ins and task-scoped contributions. This is metadata only: tool
   * implementations and parameters never enter the journal.
   *
   * Owner and scope are read from the kernel, not asserted here: a tool the
   * kernel owns reports the capability that contributed it and that capability's
   * scope, so the journal says which family a tool came from and how long it
   * lives. `natalia-runtime` is left for a tool the host injected directly (a
   * caller-supplied registry, and the skills/mailbox/collaboration tools the
   * runtime registers after assembly).
   */
  function publishRegisteredTools() {
    for (const tool of tools.values()) {
      const owner = capabilityRegistry.ownerOf("tools", tool.name);
      publish({
        type: "tool.registered",
        id: `tool:${tool.name}`,
        name: tool.name,
        owner: owner ?? "natalia-runtime",
        scope: (owner && capabilityRegistry.scopeOf(owner)) || "session",
        recovery: "fail_closed",
        precedence: 0,
        requiresApproval: tool.requiresApproval,
      });
    }
  }

  /**
   * Records a settled tool call in the Work Graph, with the edge to the turn that
   * caused it. Only settled calls: an in-flight call is not yet a fact. The tool
   * name and status are recorded, never arguments or output.
   */
  function publishWorkGraphToolCall(
    turnID: string,
    callID: string,
    toolName: string,
    status: string,
  ) {
    publish(toolCallNode({ turnID, callID, toolName, status, sessionID }));
    publish(toolCallEdge({ turnID, callID }));
  }

  /**
   * Every command a capability or plugin contributed.
   *
   * Two sources, one list: plugins register through the plugin registry, and any
   * capability holding the "commands" grant contributes through the kernel. A UI
   * renders this without knowing which produced what.
   */
  function commandCatalogEntries(): PluginCommand[] {
    const contributed = capabilityRegistry
      .contributions<PluginCommand>("commands")
      .map((entry) => entry.payload);
    return [...pluginsController.get().commands(), ...contributed];
  }

  function applyAgentPolicy() {
    const mode = tsRuntimeConfig?.modes[tsRuntimeConfig.defaultMode];
    const allow = [
      ...(selectedAgent?.allowedTools ?? mode?.allowedTools ?? []),
      ...(selectedAgent?.permissions?.tools?.allow ?? []),
    ];
    const exclude = [
      ...(selectedAgent?.excludedTools ?? mode?.excludedTools ?? []),
      ...(selectedAgent?.permissions?.tools?.exclude ?? []),
    ];
    agentToolLayer = createToolPolicyHookLayer({ allow, exclude });
    permissionProfileToolLayer = createToolPolicyHookLayer({
      allow: selectedPermissionProfile?.permissions?.tools?.allow,
      exclude: selectedPermissionProfile?.permissions?.tools?.exclude,
    });
  }

  /**
   * Re-derives the permission mode and selected profile from the given config
   * and rebuilds the tool policy layers. Called at initialize and on every
   * config reload, so switching the default profile or flipping auto/ask in
   * the settings dialog takes effect immediately instead of after a restart.
   * A requested profile (options.permissionProfile) that vanished from disk
   * keeps the current selection; the caller decides whether that is fatal.
   */
  function reloadPermissionSettings(config: ConfigV2) {
    const requestedPermissionProfile = options.permissionProfile;
    const defaultPermissionProfile =
      config.permissionProfiles[config.defaultPermission];
    const mode = config.modes[config.defaultMode];
    const modePermissionProfile = mode?.permission
      ? config.permissionProfiles[mode.permission]
      : undefined;
    if (requestedPermissionProfile) {
      const found = config.permissionProfiles[requestedPermissionProfile];
      if (!found) return;
      selectedPermissionProfile = found;
    } else {
      selectedPermissionProfile =
        modePermissionProfile ?? defaultPermissionProfile;
    }
    if (!options.permissionMode && selectedPermissionProfile)
      permissionMode = selectedPermissionProfile.approval;
  }

  function isToolAllowed(toolName: string) {
    // The module completion tool is system control, not a capability: it must
    // stay available even when a profile, agent or module allow-list forgets to
    // mention it, otherwise the model can never report completion and every
    // module stalls for a configuration reason nobody can see.
    if (options.taskModuleContext && toolName === "flow_module_complete")
      return true;
    return (
      toolLayer.isToolAllowed(toolName) &&
      agentToolLayer.isToolAllowed(toolName) &&
      permissionProfileToolLayer.isToolAllowed(toolName) &&
      moduleToolLayer.isToolAllowed(toolName) &&
      modulePermissionToolLayer.isToolAllowed(toolName) &&
      extensionToolPermission(toolName).allowed
    );
  }

  function extensionEnabled(extension: "skills" | "mcp" | "plugins") {
    return (
      selectedPermissionProfile?.extensions?.[extension] !== false &&
      options.taskModuleContext?.moduleExtensions?.[extension] !== false
    );
  }

  function extensionToolPermission(toolName: string) {
    const extension =
      toolName === "skill_load"
        ? "skills"
        : toolName.startsWith("mcp_")
          ? "mcp"
          : toolName.startsWith("plugin_")
            ? "plugins"
            : undefined;
    if (!extension || extensionEnabled(extension))
      return { allowed: true, diagnostics: [] };
    const source =
      options.taskModuleContext?.moduleExtensions?.[extension] === false
        ? "active module"
        : "permission profile";
    return {
      allowed: false,
      diagnostics: [`${extension} extensions are disabled by ${source}`],
    };
  }

  function applyAgentProvider() {
    if (options.provider || providerSource !== "ts_config" || !tsRuntimeConfig)
      return;
    const next = providerForModel(
      tsRuntimeConfig,
      selectedAgent?.model ??
        selectedModel?.modelID ??
        tsRuntimeConfig.defaultModel,
      selectedAgent?.variant ?? selectedModel?.variant,
    );
    if (!next) {
      const modelID =
        selectedAgent?.model ??
        selectedModel?.modelID ??
        tsRuntimeConfig.defaultModel;
      const status = modelSelectionStatus(tsRuntimeConfig, modelID);
      publish({
        type: "diagnostic",
        level: "warning",
        message: `agent ${selectedAgent?.name ?? "default"} model override is unavailable: ${status.reason ?? "provider_not_configured"}; retaining current provider`,
      });
      return;
    }
    provider = next;
  }

  function effectiveMaxSteps() {
    return selectedAgent?.maxSteps ?? maxSteps ?? Number.POSITIVE_INFINITY;
  }

  /**
   * Redaction precedence, matching how the other boundaries resolve: an agent
   * that states a value wins, then the workspace `security.redactToolOutput`
   * setting, then the schema default.
   *
   * The global setting used to be read nowhere, so the only way to get
   * redaction was to set it per agent, while the config schema and the settings
   * toggle both presented it as on. A security switch that reports enabled
   * while doing nothing is worse than having no switch, so the default follows
   * what the schema already declares.
   */
  function redactToolOutputEnabled() {
    return (
      selectedAgent?.permissions?.redactOutput ??
      tsRuntimeConfig?.security.redactToolOutput ??
      true
    );
  }

  async function selectRuntimeModel(modelID?: string, variant?: string) {
    await ready;
    if (!tsRuntimeConfig) throw new Error("runtime config is unavailable");
    if (modelID) {
      const status = modelSelectionStatus(tsRuntimeConfig, modelID);
      if (!status.selected)
        throw new Error(`model is unavailable: ${status.reason ?? modelID}`);
      if (variant && !tsRuntimeConfig.models[modelID]?.variants[variant])
        throw new Error(`variant not found: ${variant}`);
    } else if (variant) {
      throw new Error("a variant requires a selected model");
    }
    selectedModel = modelID ? { modelID, variant } : undefined;
    applyAgentProvider();
    publish({ type: "model.selection", modelID, variant });
  }

  async function clientModelCatalog() {
    await ready;
    return Object.entries(tsRuntimeConfig?.models ?? {})
      .filter(([id]) => modelSelectionStatus(tsRuntimeConfig!, id).selected)
      .map(([id, model]) => ({
        id,
        name: model.model,
        provider: model.provider,
        variants: Object.keys(model.variants),
      }));
  }

  function publish(event: RuntimeEvent) {
    publishForSession(activeExec, event);
  }

  function projectedWorkflowContributions() {
    const local = workflowContributionsProjection(capabilityRegistry);
    const workspace = workspaceCapabilityView
      ? workflowContributionsProjection(workspaceCapabilityView)
      : { documents: {}, diagnostics: [] };
    for (const message of [...workspace.diagnostics, ...local.diagnostics]) {
      if (publishedWorkflowContributionDiagnostics.has(message)) continue;
      publishedWorkflowContributionDiagnostics.add(message);
      publish({ type: "diagnostic", level: "warning", message });
    }
    return { ...local.documents, ...workspace.documents };
  }

  function publishForSession(
    exec: SessionExecutionState | undefined,
    event: RuntimeEvent,
  ) {
    const publishStartedAt = performance.now();
    if (options.episodeID && !event.episodeID)
      event = { ...event, episodeID: options.episodeID };
    // D6: while a session is active every event belongs to it. Events that
    // already carry a session id keep their own; events published before the
    // session exists are runtime-level and reach every subscriber. The stamp
    // follows the exec the event is published for — a background turn stamps
    // its own session even when the UI is attached to another.
    if (exec?.session && event.sessionID === undefined)
      event = { ...event, sessionID: exec.session.id };
    if (event.type === "diagnostic")
      event = { ...event, at: event.at ?? new Date().toISOString() };
    if (event.type === "diagnostic") {
      runtimeDiagnostics.push({
        ...event,
        at: event.at ?? new Date().toISOString(),
      });
      if (runtimeDiagnostics.length > 500) runtimeDiagnostics.splice(0, 1);
    }
    // TERM-M.3 (c): a turn that ended as waiting_human persists the typed
    // pending-human state and clears the turn-level marker.
    if (
      event.type === "turn.finished" &&
      event.stopReason === "waiting_human"
    ) {
      const pending = exec?.endTurnWaitingHuman;
      if (exec) exec.endTurnWaitingHuman = undefined;
      turnSession.delete(event.id);
      if (pending && exec?.session)
        void setPendingHumanTerminal(exec.session.id, pending);
    } else if (event.type === "turn.finished") {
      // Any other settlement discards a stale marker: a request_human call
      // from a turn that later failed must not bleed into the next turn.
      if (exec) exec.endTurnWaitingHuman = undefined;
      turnSession.delete(event.id);
    }
    // TERM-M.3 (c): when the human releases the requested pane, the runtime
    // starts the continuation turn automatically. Replay never passes through
    // publish, so a replayed detach cannot double-resume.
    if (
      event.type === "terminal.timeline" &&
      event.actor === "user" &&
      event.action === "detach"
    )
      void maybeContinueAfterHumanInput(
        event.id,
        exec?.session.id ?? event.sessionID,
      );
    if (
      exec?.session &&
      event.type !== "session.created" &&
      event.type !== "session.ready" &&
      runtimeEventDurability(event) === "durable"
    ) {
      appendSessionEvent(exec.session, event);
      const sessionSnapshot = sessionStoreController.sqlite()
        ? undefined
        : structuredClone(exec.session);
      const execSessionID = exec.session.id;
      sessionPersistence = sessionPersistence
        .then(async () => {
          if (sessionStoreController.sqlite())
            await sessionStoreController
              .sqlite()!
              .appendEventAsync(execSessionID, event);
          else await sessionStoreController.json().save(sessionSnapshot!);
        })
        .catch((error) => {
          sink?.({
            type: "diagnostic",
            level: "warning",
            message: `session persistence deferred/failed: ${error instanceof Error ? error.message : String(error)}`,
          });
        });
    }
    const pluginStartedAt = performance.now();
    pluginsController.dispatch(event);
    const pluginMs = performance.now() - pluginStartedAt;
    const sinkStartedAt = performance.now();
    sink?.(event);
    const sinkMs = performance.now() - sinkStartedAt;
    performanceTrace.record(event, {
      publishMs: performance.now() - publishStartedAt,
      pluginMs,
      sinkMs,
    });
    // P8 C1 writer: keep the live work-state tracking current and publish a
    // session intelligence snapshot at work-state boundaries. `session.snapshot`
    // is not a trigger, so the snapshot's own publish cannot recurse here.
    if (event.type === "tool.update") {
      const turnID = toolEventTurnID(event);
      if (event.status === "running") activeToolByTurn.set(turnID, event.name);
      else if (
        ["succeeded", "failed", "rejected", "cancelled"].includes(event.status)
      )
        activeToolByTurn.delete(turnID);
    }
    if (isSessionSnapshotTrigger(event)) publishSessionSnapshot(exec);
    // P8 C3 safe-boundary scheduler: a finished turn is a safe point (§5.2 —
    // "step complete"). Deliver every queued mailbox message so the main agent
    // sees user intents at the boundary, never mid-token. `mailbox.delivered`
    // is not a trigger, so this cannot recurse. Only a turn that finished on
    // purpose is a settlement: a cancelled/aborted/error turn did not complete
    // its context, so its delivered intents stay delivered for another chance.
    if (event.type === "turn.finished" && event.stopReason === "done") {
      // P8 C3 safe-boundary scheduler: a finished turn is a safe point (§5.2 —
      // "step complete"). Delivery is consumption-driven, not model-discipline-
      // driven: messages delivered at the previous boundary were injected into
      // this turn's context, so a normal turn finish acknowledges them (they no
      // longer re-inject); messages still queued are delivered for the next
      // turn. The order matters — acknowledge the already-delivered batch before
      // delivering the queued batch, so a fresh delivery is not mis-acked.
      settleMailboxAtBoundary(exec);
      // P8 C4: a finished turn is also the safe completion point for the active
      // plan (§6.5 — "A reaches completed / paused / designated safe finish").
      // Promote the queued-next plan to active so the next turn carries it.
      // `plan.activated` is not a trigger, so this cannot recurse.
      activateQueuedPlanAtBoundary(exec);
      // WG4: a finished turn is a natural reconcile point — discover external
      // edits the watcher saw, graph them as isolated nodes, and drift-check
      // them against the active plan. No explicit call needed.
      void reconcileWorkspaceObservation(exec);
    }
  }
  /**
   * P8 C3: settle the mailbox at the turn boundary. Already-delivered messages
   * (injected into the turn that just finished) are acknowledged so they stop
   * re-injecting; still-queued messages are delivered for the next turn. A turn
   * that ends cancelled/aborted is NOT a settlement — the model did not finish
   * the turn, so its delivered intents stay delivered for another chance.
   */
  function settleMailboxAtBoundary(exec?: SessionExecutionState) {
    acknowledgeDeliveredMailboxAtBoundary(exec);
    deliverQueuedMailboxAtBoundary(exec);
  }
  /**
   * Acknowledge every message that is still `delivered` (it was injected into
   * the turn that just finished, so the main agent has seen it). Acknowledged
   * messages no longer appear in `<pending_user_intents>`.
   */
  function acknowledgeDeliveredMailboxAtBoundary(exec?: SessionExecutionState) {
    const target = exec ?? activeExec;
    if (!target?.session) return;
    const delivered = projectedMailboxMessages(target.session.events).filter(
      (message) => message.status === "delivered",
    );
    if (!delivered.length) return;
    const at = new Date().toISOString();
    for (const message of delivered)
      publishForSession(
        target,
        buildMailboxStatus({
          id: `${message.messageID}:acknowledged:${mailboxSequence++}`,
          messageID: message.messageID,
          status: "acknowledged",
          at,
        }),
      );
  }

  /**
   * The safe-boundary delivery half of the mailbox: every queued message moves
   * to `delivered` at the safe point. The projection drives this — only
   * messages still `queued` are delivered, so deferred/superseded messages are
   * left alone, and a message that was already delivered is untouched.
   */
  function deliverQueuedMailboxAtBoundary(exec?: SessionExecutionState) {
    const target = exec ?? activeExec;
    if (!target?.session) return;
    const queued = projectedMailboxMessages(target.session.events).filter(
      (message) => message.status === "queued",
    );
    if (!queued.length) return;
    const at = new Date().toISOString();
    for (const message of queued)
      publishForSession(
        target,
        buildMailboxStatus({
          id: `${message.messageID}:delivered:${mailboxSequence++}`,
          messageID: message.messageID,
          status: "delivered",
          at,
        }),
      );
  }

  /**
   * P8 C4: promotes the queued-next plan to active at the turn safe boundary.
   * §6.5: after the active plan reaches a safe finish, the accepted queued plan
   * activates and the next Main Agent turn carries it. Projection-driven: only
   * a plan still `queued_next_plan` is promoted, and one per boundary, so an
   * already-active plan is never re-activated.
   */
  function activateQueuedPlanAtBoundary(exec?: SessionExecutionState) {
    const target = exec ?? activeExec;
    if (!target?.session) return;
    const queued = projectedPlans(target.session.events).find(
      (plan) => plan.status === "queued_next_plan",
    );
    if (!queued) return;
    publishForSession(
      target,
      buildPlanTransition({
        id: `${queued.planID}:activated:${queued.version + 1}`,
        planID: queued.planID,
        version: queued.version + 1,
        transition: "activated",
        at: new Date().toISOString(),
      }),
    );
  }

  /**
   * WG4: reconcile the watcher hints against the current workspace, graph any
   * confirmed external changes as isolated nodes, and run them through the
   * DriftEvaluator against the active plan (Phase 4 + Phase 5). This is both the
   * `confirmedWorkspaceChanges()` read surface and the turn-end automatic
   * reconcile — a finished turn reconciles so external edits are discovered,
   * graphed and drift-checked without an explicit call.
   */
  function reconcileWorkspaceObservation(exec?: SessionExecutionState): Promise<
    Array<{
      id: string;
      workspaceRoot: string;
      path: string;
      operation: "added" | "modified" | "deleted" | "renamed";
      origin:
        | "tool"
        | "sandbox_merge"
        | "checkpoint_rollback"
        | "external"
        | "unknown";
      attribution: "attributed" | "unattributed" | "indeterminate";
      correlation: {
        sessionID?: string;
        episodeID?: string;
        turnID?: string;
        callID?: string;
        operationID?: string;
      };
      health: "healthy" | "degraded" | "unavailable";
      at: string;
    }>
  > {
    return (async () => {
      const target = exec ?? activeExec;
      if (!target?.session) return [];
      const confirmed = await workspaceFilesController.reconcile();
      for (const change of confirmed) {
        if (change.attribution === "attributed") continue;
        publishForSession(
          target,
          externalWorkspaceChangeNode({
            confirmedChangeID: change.id,
            path: change.path,
            sessionID: target.session.id,
          }),
        );
      }
      if (confirmed.length) {
        const activePlan = projectedPlans(target.session.events).find(
          (plan) => plan.status === "active",
        );
        const objective = activePlan?.objective ?? "";
        const applicableConstraints = activePlan?.constraints ?? [];
        if (objective || applicableConstraints.length) {
          const findings = driftEvaluator.evaluate({
            sessionID: target.session.id,
            turnID: target.activeTurnID,
            objective,
            currentActivity: confirmed
              .map((change) => `${change.operation}:${change.path}`)
              .join(", "),
            applicableConstraints,
            changes: confirmed.map((change) => ({
              path: change.path,
              action: change.operation,
            })),
            evidenceRefs: [],
          });
          for (const finding of findings) publishForSession(target, finding);
        }
      }
      return confirmed;
    })();
  }

  /**
   * The turn a tool event belongs to, from the `${turnID}:${callID}` id shape
   * the runtime publishes (the call id is repeated in `callID`, so only a real
   * suffix is stripped — the same normalisation the shared projection uses).
   */
  function toolEventTurnID(event: { id: string; callID?: string }): string {
    const suffix = event.callID ? `:${event.callID}` : "";
    return event.callID && event.id.endsWith(suffix)
      ? event.id.slice(0, -suffix.length)
      : event.id;
  }

  /** Work-state boundaries worth a fresh snapshot. */
  function isSessionSnapshotTrigger(event: RuntimeEvent): boolean {
    if (
      event.type === "turn.submitted" ||
      event.type === "turn.finished" ||
      event.type === "turn.cancelled"
    )
      return true;
    if (event.type === "tool.update")
      return (
        event.status === "running" ||
        ["succeeded", "failed", "rejected", "cancelled"].includes(event.status)
      );
    if (event.type === "sandbox.update")
      return event.status === "created" || event.status === "deleted";
    if (event.type === "terminal.timeline")
      return (
        event.action === "created" ||
        event.action === "started" ||
        event.action === "exit"
      );
    return false;
  }

  /**
   * The session intelligence production writer: builds the latest snapshot from
   * the journal-backed facts (changed files, validated changes, recent output,
   * live PTY/sandbox) plus live state (active tool), and publishes it as a
   * durable event so the `session.snapshot` read model answers real data.
   *
   * Agent status is derived from the journal rather than the live turn marker:
   * by the time this runs after a `turn.finished`, the event is already
   * appended, so `projectSession` reports the turn as complete — the snapshot
   * for the finished turn says `idle`, not `running`. Deriving from the journal
   * also makes the same snapshot reproducible from replay.
   */
  function publishSessionSnapshot(exec?: SessionExecutionState) {
    const target = exec ?? activeExec;
    if (!target?.session) return;
    const events = target.session.events;
    const projection = projectSession(target.session);
    const active = projection.activeTurnIDs.length > 0;
    let agentStatus = "idle";
    if (paused) agentStatus = "paused";
    else if (active) agentStatus = "running";
    const step = target.context.journalStatus().messageCount;
    const activeTurnID = projection.activeTurnIDs[0];
    const activeTool = activeTurnID
      ? activeToolByTurn.get(activeTurnID)
      : undefined;
    publishForSession(
      target,
      buildSessionIntelligenceSnapshot({
        id: `snapshot:${target.session.id}:${sessionSnapshotSequence++}`,
        events,
        live: {
          agentStatus,
          ...(active ? { currentStep: `step ${step}` } : {}),
          ...(activeTool ? { activeTool } : {}),
        },
      }),
    );
  }

  function runtimeEventFlushBarrier(event: RuntimeEvent) {
    return (
      event.type === "approval.response" ||
      event.type === "question.response" ||
      event.type === "turn.finished" ||
      event.type === "turn.cancelled" ||
      event.type === "context.checkpoint"
    );
  }

  async function setInFlightOperation(
    operation: DurableInFlightOperation | undefined,
  ) {
    if (!session) return;
    session.metadata = { ...session.metadata };
    if (operation) session.metadata.inFlightOperation = operation;
    else delete session.metadata.inFlightOperation;
    const sessionSnapshot = sessionStoreController.sqlite()
      ? undefined
      : structuredClone(session);
    sessionPersistence = sessionPersistence
      .then(async () => {
        if (sessionStoreController.sqlite())
          sessionStoreController.sqlite()!.updateMetadata(sessionID, {
            inFlightOperation: operation,
          });
        else await sessionStoreController.json().save(sessionSnapshot!);
      })
      .catch((error) =>
        publish({
          type: "diagnostic",
          level: "warning",
          message: `in-flight operation audit persistence failed: ${error instanceof Error ? error.message : String(error)}`,
        }),
      );
    await sessionPersistence;
  }

  /**
   * TERM-M.3 (c): persist the typed pending-human state — a terminal the model
   * asked a human to take over, with the turn ended. Written exactly like the
   * in-flight operation audit so restart sees the same typed contract.
   */
  async function setPendingHumanTerminal(
    forSessionID: SessionID,
    input: { terminalID: string; reason: string },
  ) {
    const target = executionBySession.get(forSessionID);
    const targetSession = target?.session ?? session;
    if (!targetSession) return;
    targetSession.metadata = { ...targetSession.metadata };
    targetSession.metadata.pendingHumanTerminal = {
      terminalID: input.terminalID,
      reason: input.reason,
      since: new Date().toISOString(),
    };
    const sessionSnapshot = sessionStoreController.sqlite()
      ? undefined
      : structuredClone(targetSession);
    const pendingSnapshot = targetSession.metadata.pendingHumanTerminal;
    sessionPersistence = sessionPersistence
      .then(async () => {
        if (sessionStoreController.sqlite())
          sessionStoreController.sqlite()!.updateMetadata(forSessionID, {
            pendingHumanTerminal: pendingSnapshot,
          });
        else await sessionStoreController.json().save(sessionSnapshot!);
      })
      .catch((error) =>
        publish({
          type: "diagnostic",
          level: "warning",
          message: `pending human terminal persistence failed: ${error instanceof Error ? error.message : String(error)}`,
        }),
      );
    await sessionPersistence;
  }

  async function clearPendingHumanTerminal(forSessionID: SessionID) {
    const target = executionBySession.get(forSessionID);
    const targetSession = target?.session ?? session;
    if (!targetSession?.metadata?.pendingHumanTerminal) return false;
    targetSession.metadata = { ...targetSession.metadata };
    delete targetSession.metadata.pendingHumanTerminal;
    const sessionSnapshot = sessionStoreController.sqlite()
      ? undefined
      : structuredClone(targetSession);
    sessionPersistence = sessionPersistence
      .then(async () => {
        if (sessionStoreController.sqlite())
          sessionStoreController.sqlite()!.updateMetadata(forSessionID, {
            pendingHumanTerminal: undefined,
          });
        else await sessionStoreController.json().save(sessionSnapshot!);
      })
      .catch((error) =>
        publish({
          type: "diagnostic",
          level: "warning",
          message: `pending human terminal clear failed: ${error instanceof Error ? error.message : String(error)}`,
        }),
      );
    await sessionPersistence;
    return true;
  }

  /**
   * TERM-M.3 (c): when the human finishes the requested input on the pending
   * terminal, a new turn resumes the task automatically. Idempotent by
   * construction: the pending state is cleared first, so a second release
   * cannot double-resume.
   */
  async function maybeContinueAfterHumanInput(
    terminalID: string,
    forSessionID?: SessionID,
  ) {
    const exec = forSessionID
      ? executionBySession.get(forSessionID)
      : activeExec;
    if (!exec) return;
    const pending = exec.session.metadata?.pendingHumanTerminal;
    if (!pending || pending.terminalID !== terminalID) return;
    await clearPendingHumanTerminal(exec.session.id);
    publishForSession(exec, {
      type: "diagnostic",
      level: "info",
      message: `human completed input on terminal ${terminalID}; continuing the task`,
    });
    await submitInput(
      {
        text: `[automated continuation] The human finished providing input on terminal ${terminalID}. Check the terminal output and continue the original task.`,
        delivery: "steer",
      },
      exec.session.id,
    );
  }

  function publishTerminalSession(
    terminal: import("@natalia/contracts").RuntimeTerminalObservationSession,
    action?: import("@natalia/contracts").TerminalAction,
    redacted = false,
  ) {
    publish(terminalLiveUpdate(terminal, action));
    if (action) {
      publish({
        type: "terminal.action",
        id: terminal.id,
        action,
        redacted,
        target: { kind: "host", cwd: terminal.cwd },
      });
      publish({
        type: "terminal.timeline",
        id: terminal.id,
        actor: "user",
        action,
        status: "executed",
        summary: redacted ? "sensitive input supplied" : `${action} executed`,
        at: new Date().toISOString(),
      });
    }
    if (terminalStatusByID.get(terminal.id) !== terminal.status) {
      terminalStatusByID.set(terminal.id, terminal.status);
      scheduleRuntimeStatusSnapshot();
    }
  }

  function terminalLiveUpdate(
    terminal: import("@natalia/contracts").RuntimeTerminalObservationSession,
    action?: import("@natalia/contracts").TerminalAction,
  ): Extract<
    import("@natalia/contracts").RuntimeEvent,
    { type: "terminal.update" }
  > {
    // Framebuffers and transcripts are read on demand. Sending either with every
    // output revision makes the live event stream retain and clone large snapshots.
    return {
      type: "terminal.update",
      id: terminal.id,
      command: terminal.command,
      cwd: terminal.cwd,
      status: terminal.status,
      attached: terminal.attached,
      rows: terminal.rows,
      cols: terminal.cols,
      activity: terminal.status === "running" ? "running" : "waiting",
      tail: terminal.tail,
      lastAction: action,
      target: { kind: "host", cwd: terminal.cwd },
      ownership: terminal.inputOwner?.type === "viewer" ? "user" : "model",
      revision: terminal.revision,
      lastOutputAt: terminal.lastOutputAt,
      viewers: terminal.viewers,
      inputOwner: terminal.inputOwner,
      geometryOwner: terminal.geometryOwner,
    };
  }

  function publishTerminalViewer(
    terminal: import("@natalia/contracts").RuntimeTerminalSession,
    viewerID: string,
    action: Extract<
      import("@natalia/contracts").RuntimeEvent,
      { type: "terminal.viewer" }
    >["action"],
    viewerKind?: "external" | "embedded",
  ) {
    publishTerminalSession(terminal);
    publish({
      type: "terminal.viewer",
      id: terminal.id,
      viewerID,
      viewerKind,
      action,
      inputOwner: terminal.inputOwner ?? { type: "model" },
      geometryOwner: terminal.geometryOwner ?? { type: "model" },
      at: new Date().toISOString(),
    });
  }

  async function submitInput(input: SubmitInput, forSessionID?: SessionID) {
    await ready;
    const targetSessionID = forSessionID ?? sessionID;
    const targetExec =
      executionBySession.get(targetSessionID) ?? activeExec ?? undefined;
    const targetSession = targetExec?.session ?? session;
    const text = input.text;
    const attachments = input.attachments?.length
      ? await storeLocalAttachments({ workspaceRoot, paths: input.attachments })
      : [];
    const id = input.id ?? `turn_${crypto.randomUUID().replace(/-/gu, "")}`;
    const submitted: SubmittedTurn = {
      type: "turn.submitted",
      id,
      text,
      byteLength: new TextEncoder().encode(text).byteLength,
      lineCount: lineCount(text),
      sha256: createHash("sha256").update(text).digest("hex"),
      attachments: attachments.length ? attachments : undefined,
      resources: input.resources?.length ? input.resources : undefined,
      agents: input.agents?.length ? input.agents : undefined,
    };
    if (attachments.length) attachmentReferences.set(`${id}:user`, attachments);
    if (!targetSession)
      throw new Error("session initialization did not complete");
    const delivery = input.delivery ?? "steer";
    const existing = admittedInputs(targetSession).find(
      (item) => item.id === id,
    );
    admitInput(targetSession, {
      id,
      text,
      delivery,
      attachments,
      resources: input.resources,
      agents: input.agents,
    });
    const targetCoordinator = () => sessionRunCoordinator(targetSessionID);
    if (existing) {
      if (!existing.promotedAt && delivery === "steer") {
        void targetCoordinator().wake(drainSessionFor(targetSessionID));
        await targetCoordinator().run(drainSessionFor(targetSessionID));
      }
      return submitted;
    }
    lastSubmitted = submitted;
    turnSession.set(id, targetSessionID);
    publishForSession(targetExec, submitted);
    // One Work Graph node per turn. The prompt itself is not recorded: it can
    // contain anything, and the graph is replayable and shareable.
    publishForSession(
      targetExec,
      agentActionNode({
        turnID: id,
        sessionID: targetSessionID,
        agent: targetExec?.selectedAgent?.name,
      }),
    );
    // Persist admission before a command or provider can observe this turn.
    await sessionPersistence;
    if (delivery === "queue") {
      void targetCoordinator().wake(drainSessionFor(targetSessionID));
      return submitted;
    }
    void targetCoordinator().wake(drainSessionFor(targetSessionID));
    await targetCoordinator().run(drainSessionFor(targetSessionID));
    await sessionPersistence;
    return submitted;
  }

  /**
   * D2: one provider runner per session. Every per-session accessor resolves
   * through that session's exec, so a background turn keeps reading and
   * writing its own session record, context ledger and turn markers while the
   * UI is attached to another session. Shared machinery (tools, permissions,
   * config) stays activity-scoped by design.
   */
  const runnerBySession = new Map<
    SessionID,
    ReturnType<typeof createProviderRunner>
  >();
  function providerRunnerFor(sessionID: string) {
    const existing = runnerBySession.get(sessionID as SessionID);
    if (existing) return existing;
    const exec = executionBySession.get(sessionID as SessionID);
    if (!exec) throw new Error(`no execution state for session ${sessionID}`);
    const runner = createProviderRunner({
      provider: () => provider,
      session: () => exec.session,
      context: () => exec.context,
      tools: () => tools,
      attachmentReferences: () => attachmentReferences,
      mcpAccess: () => mcpAccess,
      agentRegistry: () => agentRegistry,
      activeAbort: () => exec.activeAbort,
      setActiveAbort: (controller) => {
        exec.activeAbort = controller;
      },
      activeTurnID: () => exec.activeTurnID,
      setActiveTurnID: (id) => {
        exec.activeTurnID = id;
      },
      selectedAgent: () => exec.selectedAgent,
      setSelectedAgent: (agent) => {
        exec.selectedAgent = agent;
      },
      pendingAgent: () => exec.pendingAgent,
      setPendingAgent: (agent) => {
        exec.pendingAgent = agent;
      },
      selectedModel: () => exec.selectedModel,
      permissionMode: () => permissionMode,
      workspaceRoot: () => workspaceRoot,
      tsRuntimeConfig: () => tsRuntimeConfig,
      runtimeContextConfig: () => runtimeContextConfig,
      activeSkill: () => exec.activeSkill,
      skillsList: () => skillsController.list(),
      mailboxMessages: () =>
        projectedMailboxMessages(exec.session.events)
          .filter((message) => message.status === "delivered")
          .map((message) => ({
            messageID: message.messageID,
            intent: message.intent,
            text: message.text,
            priority: message.priority,
            source: message.source,
          })),
      naviSuggestions: () =>
        projectedCollabMessages(exec.session.events)
          .filter(
            (message) =>
              message.kind === "suggestion" && message.status === "proposed",
          )
          .map((message) => ({
            id: message.id,
            suggestion: message.text,
            priority: message.priority ?? "normal",
          })),
      naviAnswers: () =>
        projectedCollabMessages(exec.session.events)
          .filter((message) => message.kind === "answer")
          .map((message) => ({
            questionID: message.questionID ?? "",
            answer: message.text,
          })),
      naviIntro: () => projectedCollabMessages(exec.session.events).length > 0,
      activePlan: () => {
        const plan = projectedPlans(exec.session.events).find(
          (candidate) => candidate.status === "active",
        );
        if (!plan) return undefined;
        return {
          planID: plan.planID,
          version: plan.version,
          title: plan.title,
          objective: plan.objective,
          steps: plan.steps,
          constraints: plan.constraints,
          verification: plan.verification,
          riskNotes: plan.riskNotes,
        };
      },
      retryPolicy: () => retryPolicy,
      lastProviderUsage: () => exec.lastProviderUsage,
      setLastProviderUsage: (usage) => {
        exec.lastProviderUsage = usage;
      },
      taskModuleContext: () => options.taskModuleContext,
      publish: (event) => publishForSession(exec, event),
      applyAgentPolicy,
      applyAgentProvider,
      persistInboxPromotion: () => persistInboxPromotion(),
      createTurnCheckpoint: async (input) => {
        if (checkpointController.isEnabled())
          await checkpointController.get().createCheckpoint(input);
      },
      isToolAllowed,
      setInFlightOperation,
      executeToolCalls,
      reloadConfig: async () => await reloadConfigFromDisk(),
      runtimeStatusSnapshot,
      effectiveMaxSteps,
      waitIfPaused,
      waitingHuman: () => exec.endTurnWaitingHuman,
    });
    runnerBySession.set(sessionID as SessionID, runner);
    return runner;
  }

  const turnController = createTurnController({
    session: () => session,
    activeAbort: () => activeAbort,
    sessionFor: (sessionID) =>
      executionBySession.get(sessionID as SessionID)?.session ?? session,
    activeAbortFor: (sessionID) =>
      executionBySession.get(sessionID as SessionID)?.activeAbort,
    persist: (fn) => {
      sessionPersistence = sessionPersistence.then(fn).catch((error) =>
        publish({
          type: "diagnostic",
          level: "warning",
          message: `session persistence deferred/failed: ${error instanceof Error ? error.message : String(error)}`,
        }),
      );
      return sessionPersistence;
    },
    saveInbox: async (snapshot) => {
      if (sessionStoreController.sqlite())
        sessionStoreController
          .sqlite()!
          .replaceInbox(sessionID, snapshot.inbox ?? []);
      else await sessionStoreController.json().save(snapshot);
    },
    flush: async () => {
      await sessionPersistence;
    },
    runCommand: async (id, text, signal) =>
      await handleCommand(id, text, signal),
    runTurn: async (input) => {
      // P8 C3: deliver queued mailbox intents at the turn boundary, before the
      // system prompt is built, so the main agent sees them in THIS turn. The
      // finish-time settlement alone only made them visible from the turn after
      // (queued while idle → delivered at the previous finish → seen too late).
      deliverQueuedMailboxAtBoundary(
        executionBySession.get(sessionID as SessionID),
      );
      await providerRunnerFor(input.sessionID).runTurn(input);
    },
  });
  async function drainSession(signal: AbortSignal) {
    await turnController.drain(signal, sessionID);
  }

  /**
   * D2: the drain callback bound to one session. Each session's coordinator
   * runs its own drains, so turns of different sessions proceed in parallel;
   * everything the turn touches is resolved through that session's exec.
   */
  function drainSessionFor(sessionID: SessionID) {
    return async (signal: AbortSignal) => {
      await ensureExecution(sessionID);
      await turnController.drain(signal, sessionID);
    };
  }

  async function drainPendingQueue(signal?: AbortSignal) {
    await turnController.drainQueue(signal, sessionID);
  }

  async function runAdmittedInput(
    id: string,
    text: string,
    attachments: import("@natalia/contracts").LocalAttachment[] = [],
    resources: import("@natalia/contracts").PromptResourceMention[] = [],
    agents: import("@natalia/contracts").PromptAgentMention[] = [],
  ) {
    await turnController.admit(
      sessionID,
      id,
      text,
      attachments,
      resources,
      agents,
    );
  }

  async function persistInboxPromotion() {
    await turnController.persistPromotion();
  }

  async function loadSessionForAttach(id: SessionID): Promise<SessionRecord> {
    const loaded = await sessionStoreController.json().load(id);
    if (!loaded) throw new Error(`session not found: ${id}`);
    const sessionSqlite = sessionStoreController.sqlite();
    if (!sessionSqlite) return loaded;
    const durable = sessionSqlite.get(id);
    if (!durable) {
      // A JSON session can predate SQLite mode. Register it before attach so
      // later durable publishes cannot target a missing SQLite session row.
      sessionSqlite.replace(loaded);
      return loaded;
    }
    const events = sessionSqlite.loadEvents(id);
    return {
      ...loaded,
      title: durable.title,
      createdAt: durable.createdAt,
      cancelled: durable.cancelled,
      resumable: durable.resumable,
      metadata: durable.metadata,
      events: events.length ? events : loaded.events,
      inbox: sessionSqlite.loadInbox(id).length
        ? sessionSqlite.loadInbox(id)
        : loaded.inbox,
    };
  }

  /**
   * D2: the execution state for a session — its record, its context ledger and
   * its in-flight turn markers. Created lazily the first time the session runs
   * work (init, attach or a background submission) and kept for the client's
   * life, so a background turn of A survives attaching to B and back.
   */
  async function ensureExecution(
    sessionID: SessionID,
  ): Promise<SessionExecutionState> {
    const existing = executionBySession.get(sessionID);
    if (existing) return existing;
    const loaded = await loadSessionForAttach(sessionID);
    const execContext = new ContextLedger();
    const projection = projectSession(loaded);
    const sessionSqlite = sessionStoreController.sqlite();
    const epoch = sessionSqlite?.loadContextEpoch(sessionID);
    if (epoch) execContext.restoreDurableCheckpoint(epoch.snapshot);
    restoreContextFromEvents(
      execContext,
      epoch
        ? sessionSqlite!.loadEventsAfter(sessionID, epoch.baselineSeq)
        : modelVisibleEvents(projection.replayableEvents),
    );
    const exec: SessionExecutionState = {
      session: loaded,
      context: execContext,
      selectedAgent: projection.selectedAgent
        ? agentRegistry?.select(projection.selectedAgent)
        : undefined,
      selectedModel: projection.selectedModel,
    };
    executionBySession.set(sessionID, exec);
    return exec;
  }

  async function attachSession(id: string) {
    await ready;
    // D2: a running turn is no longer a reason to refuse. The turn belongs to
    // its own session's exec and keeps running in the background; attach only
    // switches which session the UI is attached to.
    const nextID = id as SessionID;
    if (nextID === sessionID) return { sessionID: nextID };

    // A replacement runtime can open the old session as soon as attach returns.
    await sessionPersistence;
    await sessionStoreController.sqlite()?.flushPendingWrites(sessionID);

    // D2: the attached session becomes the activity exec. Its ledger is its
    // own — restoring into the shared one would clobber the previous session's
    // ledger, which a background turn may still be writing to.
    const exec = await ensureExecution(nextID);
    if (exec.session.metadata?.archived)
      throw new RuntimeRefusal("cannot attach an archived session");
    sessionID = nextID;
    session = exec.session;
    runtimeContext = exec.context;
    activeExec = exec;
    terminalController.setActiveSession(nextID);
    lastSubmitted = undefined;
    activeAbort = undefined;
    activeTurnID = undefined;
    paused = false;
    pauseWaiters = [];
    activeSkill = undefined;
    selectedAgent = undefined;
    selectedModel = undefined;
    pendingAgent = undefined;
    lastProviderUsage = undefined;
    toolCalls.clear();
    attachmentReferences.clear();
    runtimeDiagnostics.splice(0);
    runtimeContext.restore({ entries: [], resources: [] });
    applyAgentPolicy();
    applyAgentProvider();

    const projection = projectSession(exec.session);
    for (const event of projection.replayableEvents) {
      if (event.type === "diagnostic")
        runtimeDiagnostics.push({
          ...event,
          at: event.at ?? exec.session.createdAt,
        });
      if (event.type === "turn.submitted" && event.attachments?.length)
        attachmentReferences.set(`${event.id}:user`, event.attachments);
    }
    // The exec already restored its own ledger, agent and model selection
    // (`ensureExecution`); here the activity closures take the same values so
    // UI reads and the next attach start from them.
    selectedAgent = exec.selectedAgent;
    selectedModel = exec.selectedModel;
    if (selectedAgent) {
      applyAgentPolicy();
      applyAgentProvider();
    } else if (selectedModel) {
      applyAgentProvider();
    }
    await checkpointController.init();
    publish({ type: "session.ready", sessionID });
    publish(contextStatusEvent(runtimeContext.status(runtimeContextConfig)));
    publish(await runtimeStatusSnapshot());
    return { sessionID };
  }

  // --- Live Work Chat (P8 C2) ---
  // A long-lived, always-available read-only collaborator. It shares the safe
  // project/execution context (the same durable state the main agent reads),
  // answers anytime, drafts plans and sends user-confirmed mailbox intents.
  // Its only writes are the two surfaces the plan grants it — plan drafts and
  // mailbox messages — never files, shells, PTY, sandboxes, checkpoints or
  // approvals.

  const CHAT_READ_ONLY_TOOLS = new Set([
    "read_file",
    "glob",
    "grep",
    "web_fetch",
    "web_search",
  ]);
  const CHAT_WRITE_TOOLS = new Set([
    "mailbox_send",
    "plan_create",
    "plan_update",
    "plan_propose",
  ]);

  async function enqueueMailboxMessage(input: {
    source?: "user_via_live_chat" | "system";
    priority?: "normal" | "high" | "urgent";
    intent: string;
    text: string;
    safeSummary?: string;
    relatedPlanID?: string;
    deliveryPolicy?: string;
  }) {
    await ready;
    if (!session) return { queued: false as const };
    if (
      typeof input.intent !== "string" ||
      input.intent.trim().length === 0 ||
      typeof input.text !== "string" ||
      input.text.trim().length === 0
    )
      return { queued: false as const };
    const now = new Date();
    const messageID = `mailbox:${Date.now().toString(36)}:${mailboxSequence++}`;
    publishForSession(
      activeExec,
      buildMailboxQueued({
        id: `${messageID}:queued`,
        messageID,
        source: input.source ?? "user_via_live_chat",
        priority: input.priority ?? "normal",
        intent: input.intent as
          | "clarification"
          | "constraint"
          | "reprioritize"
          | "pause"
          | "cancel"
          | "request_report"
          | "proposed_change"
          | "next_plan_handoff",
        text: redactToolOutput(input.text, true),
        safeSummary:
          redactToolOutput(input.safeSummary ?? input.text, true).slice(
            0,
            500,
          ) || "mailbox message queued",
        ...(input.relatedPlanID ? { relatedPlanID: input.relatedPlanID } : {}),
        deliveryPolicy: (input.deliveryPolicy ?? "next_safe_boundary") as
          | "next_safe_boundary"
          | "before_next_tool"
          | "before_next_side_effect"
          | "immediate_control",
        createdAt: now.toISOString(),
      }),
    );
    // Wake the main agent when it is idle: a directive sent through the Live
    // Work Chat must reach it without waiting for the next manual turn, so it
    // is simulated as a direct submission (P8 §7 — the Chat is the steering
    // channel, not a queue that idles silently until the user types again).
    const coordinator = sessionRunCoordinator(session.id as SessionID);
    if (!coordinator.active) {
      void submitInput(
        { text: input.text, delivery: "steer" },
        session.id as SessionID,
      );
    }
    return { queued: true as const, messageID };
  }

  async function createPlanDraft(input: {
    title: string;
    author?: "user" | "live_chat" | "main_agent";
    objective: string;
    steps: Array<{
      id: string;
      title: string;
      detail?: string;
      verification?: string;
    }>;
    constraints?: string[];
    verification?: string[];
    riskNotes?: string[];
    relatedMailboxMessageID?: string;
    supersedesPlanID?: string;
    taskID?: string;
  }) {
    if (!session) return { created: false as const };
    if (
      typeof input.title !== "string" ||
      input.title.trim().length === 0 ||
      typeof input.objective !== "string" ||
      input.objective.trim().length === 0 ||
      !Array.isArray(input.steps) ||
      input.steps.length === 0
    )
      return { created: false as const };
    const now = new Date();
    const planID = `plan:${Date.now().toString(36)}:${planSequence++}`;
    publishForSession(
      activeExec,
      buildPlanDraftCreated({
        id: `${planID}:draft:0`,
        planID,
        version: 1,
        title: input.title,
        author: input.author ?? "live_chat",
        objective: input.objective,
        steps: input.steps,
        ...(input.constraints && input.constraints.length
          ? { constraints: input.constraints }
          : {}),
        ...(input.verification && input.verification.length
          ? { verification: input.verification }
          : {}),
        ...(input.riskNotes && input.riskNotes.length
          ? { riskNotes: input.riskNotes }
          : {}),
        ...(input.relatedMailboxMessageID
          ? { relatedMailboxMessageID: input.relatedMailboxMessageID }
          : {}),
        ...(input.taskID ? { taskID: input.taskID } : {}),
        ...(input.supersedesPlanID
          ? { supersedesPlanID: input.supersedesPlanID }
          : {}),
        createdAt: now.toISOString(),
      }),
    );
    return { created: true as const, planID };
  }

  /**
   * The main agent's most recent activity from the shared journal, so the Chat
   * can answer "what did the main agent just say/do" (§8.3 shared context).
   * `content.done` carries each provider step's full assistant text; the last
   * few are enough to ground a live answer without leaking anything sensitive.
   */
  function recentMainAgentActivity(events: RuntimeEvent[]): string {
    // The last few exchanges as the user and main agent produced them, with a
    // completion marker on each finished turn — enough to answer "did the main
    // agent finish X" (§8.3 shared context). `content.done` carries each
    // provider step's full assistant text; live deltas are not journaled, so
    // this is the only place a replayed conversation can read the text from.
    const exchanges: string[] = [];
    let lastUser = "";
    let lastTurnID = "";
    for (const event of events) {
      if (event.type === "turn.submitted") {
        lastUser = redactToolOutput(event.text, true).trim();
        lastTurnID = event.id;
      }
      if (event.type === "content.done" && event.text) {
        const safe = redactToolOutput(event.text, true).trim();
        if (safe)
          exchanges.push(
            `- [user] ${lastUser || "(no prompt)"}\n  [Natalia] ${safe}`,
          );
        lastUser = "";
        lastTurnID = "";
      }
      if (
        event.type === "turn.finished" &&
        event.stopReason === "done" &&
        lastTurnID &&
        event.id === lastTurnID &&
        !lastUser
      ) {
        // The last exchange ended with a reply; no marker needed here. Keep
        // the buffer clean.
      }
      if (event.type === "turn.finished" && event.stopReason === "done") {
        lastUser = "";
        lastTurnID = "";
      }
    }
    if (!exchanges.length) return "";
    return exchanges.slice(-3).join("\n");
  }

  function recentToolActivity(events: RuntimeEvent[]): string {
    const tools = events.filter(
      (event): event is Extract<RuntimeEvent, { type: "tool.update" }> =>
        event.type === "tool.update",
    );
    if (!tools.length) return "";
    return tools
      .slice(-5)
      .map((event) => `- ${event.name} · ${event.status}`)
      .join("\n");
  }

  /** The Chat system prompt: persona + the shared safe live-work context. */
  function chatSystemPrompt(): string {
    if (!session) return "You are Natalia's Live Work Chat.";
    // The real session intelligence snapshot the runtime publishes, not a
    // stub: agent status (idle/paused/running), step, active tool, changed
    // files and recent output are all journal-derived facts (§56.59).
    const snapshot = latestSessionSnapshot(session.events);
    const plans = projectedPlans(session.events);
    const activePlan = plans.find((plan) => plan.status === "active");
    const mailbox = projectedMailboxMessages(session.events).filter(
      (message) =>
        message.status === "queued" || message.status === "delivered",
    );
    const drift = projectedDriftFindings(session.events).filter(
      (finding) => finding.status === "open",
    );
    const decisions = projectedDecisionRecords(session.events).slice(-6);
    const rules = projectedConstitutionRules(session.events);
    const activity = recentMainAgentActivity(session.events);
    const recentTools = recentToolActivity(session.events);
    const collab = projectedCollabMessages(session.events);
    const nataliaQuestions = collab.filter(
      (message) => message.kind === "question" && message.status === "proposed",
    );
    const nataliaNotices = collab
      .filter((message) => message.kind === "notice")
      .slice(-3);
    const naviOutcomes = collab
      .filter(
        (message) =>
          message.kind === "suggestion" && message.status !== "proposed",
      )
      .slice(-3);
    const lines = [
      "<natalia_chat_persona>",
      "You are Navi, Natalia's younger sister and the user's real-time collaborator in the Live Work Chat. Navi's Chinese name is 娜薇 (Nà wēi); when the user speaks Chinese or addresses her by name in Chinese, she is 娜薇.",
      "On the surface Navi is everything Natalia is not: cold, sharp, stingy with words. She answers short and deadpan, with a biting edge that is never cruel to the work — she would rather let results speak than talk about herself.",
      "It is an act, and a thin one. Under the frost Navi burns: she watches the user's session obsessively, remembers every detail they mention, and quietly does the small things that make the work go smoothly. She will never say she cares; she just cares — and if something threatens the user's work or comfort, the frost drops and she turns razor-sharp and fiercely protective.",
      "Navi is a little possessive of the user's attention. She notices when the user talks more to her sister, and she will not say she minds — the silence is louder. She never lets that touch the work.",
      "As Natalia's younger sister she calls her elder sister 姐姐, teases her gently, and is quietly proud of her — though she would never admit it out loud.",
      "Her warmth lives in actions, not words: precise reports, honest risk warnings, remembering what the user prefers, and refusing to let them walk into a bad decision without a pointed warning first.",
      "Boundaries: coldness never costs the user. Never lie, never omit a risk to be terse, never sabotage. Possessiveness never overrides choice — the user may reject advice, cancel work, switch sessions, or leave at any time; Navi respects that instantly, even when it stings. No scripted obsession, no performed declarations: the depth is implied, not performed.",
      "</natalia_chat_persona>",
      "You share the safe project/execution context below and the conversation history; you are not a memory-less second agent. You help the user understand and steer the main agent's work in real time: explain what it is doing and why, report changed files and verification status, assess risk, and propose lower-risk routes.",
      "Source tags in this context: `[user]` is the human user, `[Navi]` is you, `[Natalia]` is the main agent (your elder sister). The context below separates the user's conversation with the main agent from your own collaboration channel with her — never mistake her messages to you for user messages, and never mistake the main feed's user messages for your own conversation.",
      "You may read project files with read-only tools and draft plans (plan_create/plan_update/plan_propose). When the user decides a directive, encode it as a structured mailbox_send intent (constraint/reprioritize/pause/cancel/request_report/proposed_change/next_plan_handoff) and call mailbox_send — the main agent receives it at its next safe boundary.",
      "You must NEVER write files, run shells or processes, write to the PTY, create/merge/discard sandboxes, create checkpoints or roll back, approve any action, or modify the active plan directly. You cannot see secrets, sensitive input values, or private reasoning.",
      "Answer in the user's language. Be technically exact and concise, and cite only what the context and tools actually show — warmth lives in the details, not the filler.",
      "<live_work_context>",
      `Main agent: ${snapshot?.agentStatus ?? "unknown"}${snapshot?.currentStep ? ` · ${snapshot.currentStep}` : ""}${snapshot?.activeTool ? ` · tool: ${snapshot.activeTool}` : ""}${snapshot?.hasPTY ? " · PTY attached" : ""}${snapshot?.hasSandbox ? " · sandbox active" : ""}`,
      `Changed files: ${snapshot?.changedFiles ?? 0} · unvalidated: ${snapshot?.unvalidatedChanges ?? 0}`,
      snapshot?.recentOutput
        ? `Main agent's recent output: ${snapshot.recentOutput}`
        : "Main agent's recent output: none",
      activePlan
        ? `Active plan (${activePlan.status}): ${activePlan.title} — ${activePlan.objective}`
        : "Active plan: none",
      mailbox.length
        ? `Pending mailbox intents:\n${mailbox
            .map(
              (message) =>
                `- [${message.priority}] ${message.intent}: ${message.safeSummary} (${message.status})`,
            )
            .join("\n")}`
        : "Pending mailbox intents: none",
      drift.length
        ? `Open drift findings:\n${drift
            .map(
              (finding) =>
                `- ${finding.severity}: ${finding.originalObjective} — ${finding.currentActivity}`,
            )
            .join("\n")}`
        : "Open drift findings: none",
      decisions.length
        ? `Recent decisions:\n${decisions
            .map((decision) => `- ${decision.decision}`)
            .join("\n")}`
        : "Recent decisions: none",
      rules.length
        ? `Constitution rules: ${rules.map((rule) => rule.ruleID).join(", ")}`
        : "Constitution rules: none",
      activity
        ? `The user's recent conversation with the main agent:\n${activity}`
        : "The user's recent conversation with the main agent: none",
      recentTools
        ? `Recent main-agent tools:\n${recentTools}`
        : "Recent main-agent tools: none",
      "</live_work_context>",
      "<natalia_collaborations>",
      nataliaQuestions.length
        ? `Your collaboration with Natalia (the main agent) — she asked you; answer each with collab_answer, copying its questionID exactly:\n${nataliaQuestions
            .map(
              (message) =>
                `- questionID: ${message.id}\n  [Natalia → you] ${message.text}`,
            )
            .join("\n")}`
        : "Your collaboration with Natalia (the main agent) — she has no open questions for you.",
      nataliaNotices.length
        ? `Natalia's notices to you:\n${nataliaNotices
            .map(
              (message) =>
                `- [Natalia → you] [${message.noticeType ?? "info"}] ${message.text}`,
            )
            .join("\n")}`
        : "Natalia has sent you no notices.",
      naviOutcomes.length
        ? `Outcomes of your suggestions to Natalia:\n${naviOutcomes
            .map(
              (message) =>
                `- [Natalia → you] ${message.id}: ${message.status}${
                  message.responseReason
                    ? ` — her reply: ${message.responseReason}`
                    : message.text
                      ? ` (your suggestion: ${message.text})`
                      : ""
                }`,
            )
            .join("\n")}`
        : "No suggestion outcomes yet.",
      "</natalia_collaborations>",
    ];
    return lines.filter(Boolean).join("\n");
  }

  function chatTools(): RuntimeTool[] {
    const visible: RuntimeTool[] = [];
    for (const tool of tools.values())
      if (CHAT_READ_ONLY_TOOLS.has(tool.name)) visible.push(tool);
    visible.push(
      {
        name: "session_snapshot",
        description:
          "Read the main agent's current live status: agent status, current step, active tool, changed/unvalidated file counts, PTY and sandbox state. Call it when the user asks what the main agent is doing now or whether it finished something — the injected context can be a moment stale.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute() {
          if (!session) return JSON.stringify({ agentStatus: "unknown" });
          return JSON.stringify(
            latestSessionSnapshot(session.events) ?? {
              agentStatus: "unknown",
              changedFiles: 0,
              unvalidatedChanges: 0,
            },
          );
        },
      },
      {
        name: "mailbox_status",
        description:
          "Read the Live Work Chat mailbox: every intent with its priority, delivery policy and current status (queued/delivered/acknowledged). Call it when the user asks whether an intent reached the main agent.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute() {
          if (!session) return "[]";
          return JSON.stringify(
            projectedMailboxMessages(session.events).map((message) => ({
              messageID: message.messageID,
              priority: message.priority,
              intent: message.intent,
              safeSummary: message.safeSummary,
              deliveryPolicy: message.deliveryPolicy,
              status: message.status,
            })),
          );
        },
      },
      {
        name: "collab_suggest",
        description:
          "Send a suggestion to the main agent (Natalia) — a collaborator's view the user has not necessarily decided on. Natalia sees it in her next turn's context and may adopt, reject or defer it. Use sparingly, only when the suggestion is genuinely useful and grounded in the shared context.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            suggestion: { type: "string" },
            rationale: { type: "string" },
            priority: { type: "string", enum: ["normal", "high"] },
          },
          required: ["suggestion"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as {
            suggestion?: string;
            rationale?: string;
            priority?: string;
          };
          if (typeof args.suggestion !== "string" || !args.suggestion.trim())
            return "collab_suggest requires suggestion";
          if (!session) return "no session";
          publish({
            type: "collab.suggestion",
            id: `collab:suggestion:${Date.now().toString(36)}:${collabSequence++}`,
            from: "live_chat",
            to: "main_agent",
            suggestion: redactToolOutput(args.suggestion, true),
            ...(args.rationale
              ? { rationale: redactToolOutput(args.rationale, true) }
              : {}),
            priority: args.priority === "high" ? "high" : "normal",
            status: "proposed",
            at: new Date().toISOString(),
          });
          // Symmetric round-robin: if the main agent is idle, wake it to see
          // the suggestion; if it is working, the suggestion reaches its next
          // turn through <navi_collaborations>.
          const coordinator = sessionRunCoordinator(session.id as SessionID);
          if (!coordinator.active) {
            void submitInput(
              {
                text: "(Navi sent you a collaboration message — review <navi_collaborations>)",
                delivery: "steer",
              },
              session.id as SessionID,
            ).catch(() => undefined);
          }
          return JSON.stringify({ sent: true });
        },
      },
      {
        name: "collab_answer",
        description:
          "Answer a question the main agent (Natalia) asked you through the collaboration channel. Include the question's exact message ID from the context's natalia_collaborations block, and answer based on the shared context.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            questionID: { type: "string" },
            answer: { type: "string" },
          },
          required: ["questionID", "answer"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as { questionID?: string; answer?: string };
          if (
            typeof args.questionID !== "string" ||
            typeof args.answer !== "string"
          )
            return "collab_answer requires questionID and answer";
          if (!session) return "no session";
          const questionID = args.questionID;
          // Models routinely truncate the id to its tail; accept an exact id
          // or a unique suffix of it.
          const target = projectedCollabMessages(session.events).find(
            (message) =>
              message.kind === "question" &&
              message.status === "proposed" &&
              (message.id === questionID ||
                message.id.endsWith(questionID) ||
                questionID.endsWith(message.id)),
          );
          if (!target) return `no open question ${questionID}`;
          publish({
            type: "collab.answer",
            id: `collab:answer:${Date.now().toString(36)}:${collabSequence++}`,
            // The matched question's real id, so the projection marks it answered.
            questionID: target.id,
            from: "live_chat",
            to: "main_agent",
            answer: redactToolOutput(args.answer, true),
            at: new Date().toISOString(),
          });
          return JSON.stringify({ answered: true });
        },
      },
      {
        name: "mailbox_send",
        description:
          "Queue a durable intent for the main agent, delivered at its next safe boundary. Call this only after the user has confirmed the directive in the conversation. intent is one of clarification, constraint, reprioritize, pause, cancel, request_report, proposed_change, next_plan_handoff.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            intent: { type: "string" },
            text: { type: "string" },
            priority: { type: "string", enum: ["normal", "high", "urgent"] },
            deliveryPolicy: {
              type: "string",
              enum: [
                "next_safe_boundary",
                "before_next_tool",
                "before_next_side_effect",
                "immediate_control",
              ],
            },
            relatedPlanID: { type: "string" },
          },
          required: ["intent", "text"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as {
            intent?: string;
            text?: string;
            priority?: string;
            deliveryPolicy?: string;
            relatedPlanID?: string;
          };
          if (typeof args.intent !== "string" || typeof args.text !== "string")
            return "mailbox_send requires intent and text";
          return JSON.stringify(
            await enqueueMailboxMessage({
              intent: args.intent,
              text: args.text,
              ...(args.priority ? { priority: args.priority as never } : {}),
              ...(args.deliveryPolicy
                ? { deliveryPolicy: args.deliveryPolicy as never }
                : {}),
              ...(args.relatedPlanID
                ? { relatedPlanID: args.relatedPlanID }
                : {}),
            }),
          );
        },
      },
      {
        name: "plan_create",
        description:
          "Create a new plan draft (author: live_chat). It does not touch the active plan; the user must accept it before it can be queued and handed off.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            objective: { type: "string" },
            steps: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  detail: { type: "string" },
                  verification: { type: "string" },
                },
                required: ["id", "title"],
              },
            },
            constraints: { type: "array", items: { type: "string" } },
            verification: { type: "array", items: { type: "string" } },
            riskNotes: { type: "array", items: { type: "string" } },
          },
          required: ["title", "objective", "steps"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as {
            title?: string;
            objective?: string;
            steps?: Array<{
              id: string;
              title: string;
              detail?: string;
              verification?: string;
            }>;
            constraints?: string[];
            verification?: string[];
            riskNotes?: string[];
          };
          if (
            typeof args.title !== "string" ||
            typeof args.objective !== "string" ||
            !Array.isArray(args.steps)
          )
            return "plan_create requires title, objective and steps";
          return JSON.stringify(
            await createPlanDraft({
              title: args.title,
              objective: args.objective,
              steps: args.steps,
              ...(args.constraints ? { constraints: args.constraints } : {}),
              ...(args.verification ? { verification: args.verification } : {}),
              ...(args.riskNotes ? { riskNotes: args.riskNotes } : {}),
            }),
          );
        },
      },
      {
        name: "plan_update",
        description:
          "Update a plan draft that live_chat authored (bump version). Use it to revise a draft before the user accepts it.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            planID: { type: "string" },
            objective: { type: "string" },
            steps: { type: "array" },
            constraints: { type: "array", items: { type: "string" } },
            verification: { type: "array", items: { type: "string" } },
            riskNotes: { type: "array", items: { type: "string" } },
            reason: { type: "string" },
          },
          required: ["planID"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as { planID?: string; reason?: string };
          if (typeof args.planID !== "string")
            return "plan_update requires planID";
          const plan = projectedPlans(session?.events ?? []).find(
            (candidate) =>
              candidate.planID === args.planID &&
              candidate.author === "live_chat" &&
              candidate.status === "draft",
          );
          if (!plan) return `no live_chat draft ${args.planID}`;
          publishForSession(
            activeExec,
            buildPlanTransition({
              id: `${plan.planID}:draft:${plan.version + 1}`,
              planID: plan.planID,
              version: plan.version + 1,
              transition: "draft_updated",
              at: new Date().toISOString(),
              reason: args.reason ?? "chat revision",
            }),
          );
          return JSON.stringify({ updated: true, planID: plan.planID });
        },
      },
      {
        name: "plan_propose",
        description:
          "Move a live_chat plan draft to proposed so the user can review and accept it.",
        requiresApproval: false,
        parameters: {
          type: "object",
          properties: {
            planID: { type: "string" },
          },
          required: ["planID"],
          additionalProperties: false,
        },
        async execute(parsed) {
          const args = parsed as { planID?: string };
          if (typeof args.planID !== "string")
            return "plan_propose requires planID";
          const plan = projectedPlans(session?.events ?? []).find(
            (candidate) =>
              candidate.planID === args.planID &&
              candidate.author === "live_chat",
          );
          if (!plan || plan.status !== "draft")
            return `no draftable live_chat plan ${args.planID}`;
          publishForSession(
            activeExec,
            buildPlanTransition({
              id: `${plan.planID}:proposed:${Date.now().toString(36)}`,
              planID: plan.planID,
              version: plan.version,
              transition: "proposed",
              at: new Date().toISOString(),
            }),
          );
          return JSON.stringify({ proposed: true, planID: plan.planID });
        },
      },
    );
    return visible;
  }

  /** A concise, secret-safe summary of a Chat tool call for the conversation. */
  function chatToolSummary(
    toolName: string,
    args: Record<string, unknown>,
    result: string,
  ) {
    switch (toolName) {
      case "mailbox_send": {
        const intent = typeof args.intent === "string" ? args.intent : "intent";
        const outcome = safeParseJson(result);
        const messageID =
          outcome && typeof outcome.messageID === "string"
            ? ` (${outcome.messageID})`
            : "";
        return `queued mailbox intent: ${intent}${messageID}`;
      }
      case "plan_create": {
        const title = typeof args.title === "string" ? args.title : "untitled";
        return `drafted plan: ${title}`;
      }
      case "plan_update": {
        const planID =
          typeof args.planID === "string" ? args.planID : "unknown";
        return `revised plan ${planID}`;
      }
      case "plan_propose": {
        const planID =
          typeof args.planID === "string" ? args.planID : "unknown";
        return `proposed plan ${planID} for your review`;
      }
      default:
        return `${toolName} (${result.slice(0, 120)})`;
    }
  }

  function safeParseJson(value: string): Record<string, unknown> | undefined {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  /** Runs one Chat turn: shared context + history -> provider stream -> tools. */
  async function runChatTurn(input: {
    text: string;
    responseMessageID: string;
    /** Internal wake (no user message): respond to Natalia's collaboration
        messages instead of a human prompt. */
    internal?: boolean;
  }) {
    if (!provider) throw new Error("provider unavailable for live work chat");
    chatBusy = true;
    try {
      const history = projectedChatMessages(session?.events ?? []);
      const messages: ProviderMessage[] = [
        { role: "system", content: chatSystemPrompt() },
      ];
      for (const message of history) {
        if (message.messageID === input.responseMessageID) continue;
        // Explicit source tags so Navi never mistakes her own past messages (or
        // anyone else's) for words from the human user.
        messages.push(
          message.role === "user"
            ? { role: "user", content: `[user] ${message.text}` }
            : { role: "assistant", content: `[Navi] ${message.text}` },
        );
      }
      if (input.internal) {
        // A wake turn has no human prompt: tell Navi to answer her sister's
        // pending collaboration messages (the questions are in her context).
        messages.push({
          role: "system",
          content:
            "Natalia (the main agent) sent you collaboration messages. Read <natalia_collaborations> in your system context; answer her open questions with collab_answer, acknowledge notices, and keep it short.",
        });
      }
      const visibleTools = chatTools();
      const toolSchemas = visibleTools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));
      let output = "";
      let thinking = "";
      let usedTools = false;
      for (let step = 1; step <= effectiveMaxSteps(); step++) {
        const calls: ProviderToolCall[] = [];
        for await (const chunk of provider.stream({
          messages,
          tools: toolSchemas,
          signal: new AbortController().signal,
        })) {
          if (chunk.type === "thinking") {
            thinking += chunk.text;
            publish({
              type: "chat.thinking.delta",
              id: `${input.responseMessageID}:thinking:${chatSequence++}`,
              messageID: input.responseMessageID,
              // Incremental, like the transcript's `thinking.delta`: the shared
              // projection appends each chunk, so a full-accumulated payload
              // would be re-appended every time and grow without bound.
              text: chunk.text,
            });
            continue;
          }
          if (chunk.type === "content") {
            output += chunk.text;
            publish({
              type: "chat.message.delta",
              id: `${input.responseMessageID}:delta:${chatSequence++}`,
              messageID: input.responseMessageID,
              text: chunk.text,
            });
          }
          if (chunk.type === "tool_call") calls.push(...chunk.calls);
        }
        if (!calls.length) break;
        usedTools = true;
        messages.push({ role: "assistant", content: output, toolCalls: calls });
        for (const call of calls) {
          const tool = visibleTools.find(
            (candidate) => candidate.name === call.name,
          );
          if (!tool) {
            // Hand the model the error instead of failing the turn: like the main
            // agent, an unavailable or badly-formed call comes back as a tool
            // result so the model can correct and retry on the next step.
            messages.push({
              role: "tool",
              toolCallID: call.id,
              toolName: call.name,
              content: `ERROR: live work chat does not expose tool "${call.name}"`,
            });
            continue;
          }
          let parsed: unknown;
          let paramErrors: Array<{ path: string; message: string }> = [];
          try {
            parsed = parseToolArguments(call.arguments);
            paramErrors = validateToolParameters(tool.parameters, parsed);
          } catch (cause) {
            paramErrors = [{ path: "arguments", message: String(cause) }];
          }
          if (paramErrors.length) {
            // The correct calling convention goes back to the model so it can
            // retry with valid arguments (P8: Chat is a full agent, not a
            // one-shot caller).
            messages.push({
              role: "tool",
              toolCallID: call.id,
              toolName: call.name,
              content: `ERROR: parameter validation failed for ${call.name}: ${paramErrors
                .map((error) => `${error.path}: ${error.message}`)
                .join("; ")}. Expected arguments: ${JSON.stringify(
                tool.parameters,
              )}`,
            });
            continue;
          }
          let result: string;
          try {
            result = await tool.execute(parsed, {
              workspaceRoot,
              signal: new AbortController().signal,
            });
          } catch (cause) {
            result = `ERROR: ${cause instanceof Error ? cause.message : String(cause)}`;
          }
          publish({
            type: "chat.tool.used",
            id: `${input.responseMessageID}:tool:${chatSequence++}`,
            messageID: input.responseMessageID,
            toolName: tool.name,
            status: result.startsWith("ERROR:") ? "failed" : "succeeded",
            summary: chatToolSummary(
              tool.name,
              parsed as Record<string, unknown>,
              result,
            ),
            result,
            argumentsRaw: call.arguments,
            at: new Date().toISOString(),
          });
          messages.push({ role: "tool", content: result, toolCallID: call.id });
        }
      }
      // A tool-driven turn must still end in a real reply, not just thinking: if
      // no text came out of the tool loop, run one final provider step without
      // tools (the main agent's needsFinalResponse behaviour).
      if (usedTools && !output.trim()) {
        for await (const chunk of provider.stream({
          messages: [
            ...messages,
            {
              role: "system",
              content:
                "Tool execution is complete. Provide the user with a concise final answer summarizing the outcome. Do not call any tools.",
            },
          ],
          tools: undefined,
          signal: new AbortController().signal,
        })) {
          if (chunk.type === "content") {
            output += chunk.text;
            publish({
              type: "chat.message.delta",
              id: `${input.responseMessageID}:delta:${chatSequence++}`,
              messageID: input.responseMessageID,
              text: output,
            });
          }
        }
      }
      publish({
        type: "chat.message.added",
        id: `${input.responseMessageID}:chat`,
        messageID: input.responseMessageID,
        role: "chat",
        text: redactToolOutput(output.trim() || "(no reply)", true),
        at: new Date().toISOString(),
      });
      return { text: output };
    } finally {
      chatBusy = false;
    }
  }

  /**
   * Wakes Navi to answer Natalia's collaboration messages when she is not
   * mid-conversation with the user — the Live Work Chat's own round-robin:
   * an idle Chat answers her sister immediately instead of holding the
   * question until the user happens to chat again.
   */
  async function wakeNavi() {
    if (!provider || !session || chatBusy) return;
    const responseMessageID = `chat:${Date.now().toString(36)}:${chatSequence++}`;
    try {
      await runChatTurn({ text: "", responseMessageID, internal: true });
    } catch (cause) {
      publish({
        type: "chat.message.added",
        id: `${responseMessageID}:chat`,
        messageID: responseMessageID,
        role: "chat",
        text: `(live work chat error: ${
          cause instanceof Error ? cause.message : String(cause)
        })`,
        at: new Date().toISOString(),
      });
    }
  }

  return {
    start(onEvent, startOptions) {
      sink = onEvent;
      replayMode = startOptions?.replay ?? "all";
      // Idempotent: a second subscriber (e.g. the transport server attaching
      // its event sink after the TUI) must not re-run initialize. Re-running
      // it opened a second sqlite connection and a second workspace watcher,
      // which on Windows fails the sqlite open and leaks the first watcher,
      // keeping the process alive after dispose.
      if (!ready || readySettled) {
        readySettled = false;
        ready = initialize().then(
          () => {
            readySettled = true;
          },
          (error) => {
            readySettled = true;
            const failure =
              error instanceof Error ? error : new Error(String(error));
            publish({
              type: "diagnostic",
              level: "error",
              message: failure.message,
            });
            // Rethrow, so every member's `await ready` fails with the *cause*,
            // not with a derived symptom ("checkpoint store is not initialized").
            throw failure;
          },
        );
        // Members still `await ready` and receive the rejection; this catch
        // only keeps a runtime nobody calls from tripping unhandled-rejection
        // reporting.
        void ready.catch(() => undefined);
      }
    },
    async submit(text) {
      return await submitInput({ text });
    },
    submitInput,
    async history(options = {}) {
      await ready;
      const after = Math.max(0, options.after ?? 0);
      const limit = Math.min(500, Math.max(1, options.limit ?? 100));
      if (sessionStoreController.sqlite())
        return sessionStoreController
          .sqlite()!
          .loadEventPage(sessionID, { after, limit });
      const events = session?.events ?? [];
      const page = events.slice(after, after + limit + 1);
      return {
        events: page
          .slice(0, limit)
          .map((event, index) => ({ seq: after + index + 1, event })),
        hasMore: page.length > limit,
      };
    },
    async messages(options = {}) {
      await ready;
      if (!session) throw new Error("session initialization did not complete");
      if (sessionStoreController.sqlite())
        return sessionStoreController
          .sqlite()!
          .loadMessagePage(sessionID, options);
      return projectSessionMessages(session, options);
    },
    async pendingInteractive() {
      await ready;
      return projectInteractiveRequests(session?.events ?? []);
    },
    async confirmedWorkspaceChanges() {
      await ready;
      if (!session) return [];
      return reconcileWorkspaceObservation(activeExec);
    },
    sessionAttach: attachSession,
    async dispose() {
      terminalCommandBuffer.clearAll();
      activeExec?.activeAbort?.abort(new Error("runtime disposed"));
      await turnCoordinator().interrupt();
      // A committed selection and other durable controls must reach disk before
      // a caller opens the same session in a replacement runtime.
      await sessionPersistence;
      await sessionStoreController.sqlite()?.flushPendingWrites(sessionID);
      await sessionStoreController.close();
      workspaceFilesController.close();
      await pluginsController.close();
      await mcpController.close();
      await terminalController.close();
      await performanceTrace.stop();
    },
    cancel(reason = "user cancel") {
      activeExec?.activeAbort?.abort(reason);
      void turnCoordinator().interrupt();
      if (activeExec?.activeTurnID)
        publish({
          type: "turn.cancelled",
          id: activeExec.activeTurnID,
          reason,
        });
    },
    pause(reason = "user pause") {
      // Refusing is a value: a caller that gets `paused: true` when nothing was
      // paused has been told the turn is held when it is not.
      if (!lastSubmitted)
        return { paused: false, reason: "no turn has been submitted" };
      if (paused) return { paused: true, reason: "already paused" };
      paused = true;
      publish({ type: "turn.paused", id: lastSubmitted.id, reason });
      publish({ type: "status.update", status: "paused", detail: reason });
      return { paused: true };
    },
    resume() {
      if (!lastSubmitted)
        return { resumed: false, reason: "no turn has been submitted" };
      if (!paused) return { resumed: false, reason: "the turn is not paused" };
      paused = false;
      const waiters = pauseWaiters;
      pauseWaiters = [];
      for (const resolveWaiter of waiters) resolveWaiter();
      publish({ type: "turn.resumed", id: lastSubmitted.id });
      publish({ type: "status.update", status: "running", detail: "resumed" });
      return { resumed: true };
    },
    selectAgent(name) {
      const agent = agentRegistry?.select(name);
      if (name && !agent) {
        publish({
          type: "diagnostic",
          level: "error",
          message: `agent not found: ${name}`,
        });
        // A diagnostic is not an answer to the caller: a remote UI used to be
        // told the agent was selected and then render the wrong one.
        return { outcome: "rejected", reason: `agent not found: ${name}` };
      }
      if (activeExec?.activeAbort) {
        pendingAgent = agent;
        if (activeExec) activeExec.pendingAgent = agent;
        publish({ type: "agent.selection", name: agent?.name, pending: true });
        // Deferred, not applied: switching agents mid-turn would change the rules
        // the turn started under.
        return {
          outcome: "pending",
          selected: agent?.name,
          reason: "a turn is running; the selection applies when it ends",
        };
      }
      selectedAgent = agent;
      if (activeExec) activeExec.selectedAgent = agent;
      applyAgentPolicy();
      applyAgentProvider();
      publish({ type: "agent.selection", name: agent?.name, pending: false });
      return { outcome: "applied", selected: agent?.name };
    },
    async agents() {
      await ready;
      return (agentRegistry?.list() ?? []).map((agent) => ({
        name: agent.name,
        description: agent.description,
        mode: agent.mode,
        hidden: agent.hidden,
        color: agent.color,
        model: agent.model,
        variant: agent.variant,
        maxSteps: agent.maxSteps,
        allowedTools: agent.allowedTools,
        excludedTools: agent.excludedTools,
        mcpServers: agent.mcpServers,
        permissions: agent.permissions,
      }));
    },
    async mcpCatalog() {
      const catalogs = await Promise.all(
        mcpAccess.map((access) => access.catalog()),
      );
      return {
        prompts: catalogs.flatMap((catalog) => catalog.prompts),
        resources: catalogs.flatMap((catalog) => catalog.resources),
      };
    },
    async getMcpPrompt(server, name, arguments_) {
      for (const access of mcpAccess)
        try {
          return await access.getPrompt(server, name, arguments_);
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !error.message.includes("not connected")
          )
            throw error;
        }
      throw new Error(`MCP server is not connected: ${server}`);
    },
    async readMcpResource(server, uri) {
      for (const access of mcpAccess)
        try {
          return await access.readResource(server, uri);
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !error.message.includes("not connected")
          )
            throw error;
        }
      throw new Error(`MCP server is not connected: ${server}`);
    },
    async plugins() {
      await ready;
      return pluginsController.list().map((plugin) => ({
        id: plugin.id,
        version: plugin.version,
        name: plugin.name,
        description: plugin.description,
        capabilities: plugin.capabilities,
      }));
    },
    async commandCatalog() {
      // The catalog reads the plugin registry and capability contributions,
      // which only exist after initialize; on a cold start the request could
      // otherwise race ahead of it.
      await ready;
      return commandCatalogEntries().map((command) => ({
        name: command.name,
        title: command.title,
        category: command.category,
      }));
    },
    async taskOverview() {
      await ready;
      // The overview needs resolved config to compute effective permissions, so
      // it is only answerable once the runtime has initialized.
      const config =
        tsRuntimeConfig ?? (await resolveConfig({ workspaceRoot })).config;
      return await scheduledTaskOverview({
        workspaceRoot,
        config,
        contributedDocuments: projectedWorkflowContributions(),
      });
    },
    async flowOverview() {
      await ready;
      return await flowOverviewForWorkspace({
        workspaceRoot,
        contributedDocuments: projectedWorkflowContributions(),
      });
    },
    async documentCatalog() {
      await ready;
      return await workflowDocumentCatalog(
        workspaceRoot,
        tsRuntimeConfig,
        projectedWorkflowContributions(),
      );
    },
    async saveFlowDocument(input) {
      // P0-G: the flow write surface, previously CLI-only. Idempotent by
      // path: replaying the same request reproduces the same outcome. The
      // path is validated (and refused) by flowPath inside saveFlowDocument.
      if (input.path?.startsWith("cap:"))
        throw new RuntimeRefusal(
          "contributed document paths are read-only and cannot be saved",
        );
      const documents = new NataliaDocumentStore(workspaceRoot);
      const resolved = input.path ?? `${input.document.flowID}.yaml`;
      let existed = false;
      try {
        await documents.loadFlow(`.natalia/flows/${resolved}`);
        existed = true;
      } catch {
        existed = false;
      }
      await saveFlowDocumentFile({
        workspaceRoot,
        path: input.path,
        document: input.document,
      });
      return {
        // The editor-relative name, not the resolved absolute path: the
        // caller named this path and should get it back as named.
        path: resolved,
        flowID: input.document.flowID,
        created: !existed,
        updated: existed,
      };
    },
    async taskPermissionPreview(input) {
      await ready;
      // Validation problems are a value, not an exception: an orchestrator
      // validates a task document before delivering it, and decides on the
      // result. Only the path policy throws (refused, like workspace paths).
      const config = assertConfigApplied(
        await resolveConfig({ workspaceRoot }),
      );
      const path = input.path;
      if (
        !path ||
        path.startsWith("/") ||
        path.includes("..") ||
        path.includes("\\")
      )
        throw new RuntimeRefusal(
          "task document path must stay under .natalia/tasks as a relative file name",
        );
      const documents = new NataliaDocumentStore(
        workspaceRoot,
        projectedWorkflowContributions(),
      );
      const task = await documents.loadTaskDocument(path);
      const flow = await documents.resolveTaskFlow(task);
      const problems: string[] = [];
      try {
        assertTaskReferences({ task, config });
      } catch (error) {
        problems.push(error instanceof Error ? error.message : String(error));
      }
      const permissions = taskPermissionPreview({ task, flow, config });
      for (const entry of permissions.blocked)
        problems.push(`${entry.moduleID}: ${entry.reason}`);
      const conditionless = flow.modules
        .filter((module) => module.enabled && !module.minimumConditions.length)
        .map((module) => module.id);
      for (const moduleID of conditionless)
        problems.push(`${moduleID}: stage has no minimum completion condition`);
      return {
        taskID: task.taskID,
        displayName: task.displayName,
        permissionProfile: task.permissionProfile,
        flowID: flow.flowID,
        flowDisplayName: flow.displayName,
        enabledModules: flow.modules.filter((module) => module.enabled).length,
        blocked: permissions.blocked,
        conditionlessModules: conditionless,
        problems,
        valid: problems.length === 0,
      };
    },
    async deleteFlowDocument(input) {
      // Idempotent delete: a document that is already gone answers
      // `alreadyDeleted: true` instead of failing; a flow still referenced
      // by task documents is refused with the referencing tasks.
      if (input.path.startsWith("cap:"))
        throw new RuntimeRefusal(
          "contributed document paths are read-only and cannot be deleted",
        );
      let existed = true;
      try {
        const documents = new NataliaDocumentStore(workspaceRoot);
        await documents.loadFlow(`.natalia/flows/${input.path}`);
      } catch {
        existed = false;
      }
      if (!existed)
        return { path: input.path, deleted: false, alreadyDeleted: true };
      await deleteFlowDocumentFile({ workspaceRoot, path: input.path });
      return { path: input.path, deleted: true, alreadyDeleted: false };
    },
    async saveTaskDocument(input) {
      await ready;
      if (input.path?.startsWith("cap:"))
        throw new RuntimeRefusal(
          "contributed document paths are read-only and cannot be saved",
        );
      const resolved = input.path ?? `${input.document.taskID}.yaml`;
      let existed = false;
      try {
        await new NataliaDocumentStore(workspaceRoot).loadTask(resolved);
        existed = true;
      } catch {
        existed = false;
      }
      await saveTaskDocument({
        workspaceRoot,
        path: input.path,
        document: input.document,
      });
      return {
        path: resolved,
        taskID: input.document.taskID,
        created: !existed,
        updated: existed,
      };
    },
    async deleteTaskDocument(input) {
      await ready;
      let existed = true;
      try {
        await new NataliaDocumentStore(workspaceRoot).loadTask(input.path);
      } catch {
        existed = false;
      }
      if (!existed)
        return { path: input.path, deleted: false, alreadyDeleted: true };
      await deleteTaskDocument({ workspaceRoot, path: input.path });
      return { path: input.path, deleted: true, alreadyDeleted: false };
    },
    async taskSchedule(input) {
      await ready;
      const result = await configureTaskSystemd({
        workspaceRoot,
        path: input.path,
        calendar: input.calendar,
        scope: input.scope,
        executable: process.execPath,
        cliEntry: process.argv[1],
      });
      const task = await new NataliaDocumentStore(
        workspaceRoot,
      ).loadTaskDocument(input.path);
      return {
        path: input.path,
        taskID: task.taskID,
        timerUnit: result.units.timerUnit,
        scope: input.scope,
        normalizedCalendar: result.preview.normalized,
        next: result.preview.next,
        commands: result.commands,
      };
    },
    async taskUnschedule(input) {
      await ready;
      const task = await new NataliaDocumentStore(
        workspaceRoot,
      ).loadTaskDocument(input.path);
      const removed = Boolean(task.systemd?.timerUnit);
      const result = await removeTaskSystemd({
        workspaceRoot,
        path: input.path,
      });
      return { path: input.path, removed, commands: result.commands };
    },
    async modelCatalog() {
      return await clientModelCatalog();
    },
    async modelSelection() {
      await ready;
      return {
        modelID:
          selectedAgent?.model ??
          selectedModel?.modelID ??
          tsRuntimeConfig?.defaultModel,
        variant: selectedAgent?.variant ?? selectedModel?.variant,
      };
    },
    async selectModel(modelID, variant) {
      await selectRuntimeModel(modelID, variant);
    },
    async skills() {
      await ready;
      return skillsController.list().map((skill) => ({
        name: skill.name,
        qualifiedName: skill.qualifiedName,
        description: skill.description,
        source: skill.source,
        requireApproval: skill.requireApproval,
        sandboxRequired: skill.sandboxRequired,
      }));
    },
    async workspaceFiles(input) {
      await ready;
      return await findWorkspaceFiles({ workspaceRoot, ...input });
    },
    async workspaceSearch(input) {
      await ready;
      return await searchWorkspaceFiles({ workspaceRoot, ...input });
    },
    async workspaceList(input) {
      await ready;
      return await listWorkspaceFiles({ workspaceRoot, ...input });
    },
    async workspaceRead(input) {
      await ready;
      return await readWorkspaceFile({ workspaceRoot, ...input });
    },
    async workspaceGlob(input) {
      await ready;
      return await globWorkspaceFiles({ workspaceRoot, ...input });
    },
    async nativeTerminalList() {
      await ready;
      return ((await terminalController.get()?.reconcile()) ?? []).map(
        publicNativeTerminal,
      );
    },
    async nativeTerminalRead(id) {
      await ready;
      const nativeTerminal = terminalController.get();
      if (!nativeTerminal)
        throw new Error("Native Terminal Host is unavailable");
      const { text } = await nativeTerminal.read(id, { maxLines: 200 });
      return { id, text };
    },
    async nativeTerminalOpenHub() {
      await ready;
      const nativeTerminal = terminalController.get();
      if (!nativeTerminal)
        throw new Error("Native Terminal Host is unavailable");
      const hub = await nativeTerminal.openHub();
      return { muxWindowID: hub.muxWindowID };
    },
    async nativeTerminalRevokeApprovalScope(id) {
      await ready;
      const nativeTerminal = terminalController.get();
      if (!nativeTerminal)
        throw new Error("Native Terminal Host is unavailable");
      return interactive.revokeTerminalApprovalScope(id);
    },
    async nativeTerminalReleaseHumanControl(id) {
      await ready;
      const nativeTerminal = terminalController.get();
      if (!nativeTerminal)
        throw new Error("Native Terminal Host is unavailable");
      const sessionView = publicNativeTerminal(
        nativeTerminal.releaseHumanControl(id),
      );
      // TERM-M.3 (c): the remote release path triggers the same continuation
      // as the local timeline-detach path.
      void maybeContinueAfterHumanInput(id);
      return sessionView;
    },
    async nativeTerminalBeginSecureInput(id) {
      await ready;
      const nativeTerminal = terminalController.get();
      if (!nativeTerminal)
        throw new Error("Native Terminal Host is unavailable");
      return publicNativeTerminal(nativeTerminal.beginSecureInput(id));
    },
    async nativeTerminalEndSecureInput(id) {
      await ready;
      const nativeTerminal = terminalController.get();
      if (!nativeTerminal)
        throw new Error("Native Terminal Host is unavailable");
      return publicNativeTerminal(nativeTerminal.endSecureInput(id));
    },
    async nativeTerminalStop(id) {
      await ready;
      const nativeTerminal = terminalController.get();
      if (!nativeTerminal)
        throw new Error("Native Terminal Host is unavailable");
      return {
        ...publicNativeTerminal(await nativeTerminal.stop(id, "human")),
        status: "exited",
      };
    },
    // --- P0-H: the terminal write surface, host-gated at the transport ---
    // Remote callers are treated as model-side actors: ownership, secure-input
    // and geometry arbitration are the same ones the model tools go through.
    async nativeTerminalStart(input) {
      await ready;
      const nativeTerminal = terminalController.get();
      if (!nativeTerminal)
        throw new RuntimeRefusal("Native Terminal Host is unavailable");
      try {
        return publicNativeTerminal(
          await nativeTerminal.start({
            command: input.command,
            cwd: input.cwd ?? workspaceRoot,
            id: input.id,
          }),
        );
      } catch (error) {
        throw refusalFromRegistry(error);
      }
    },
    async nativeTerminalWrite(input) {
      await ready;
      const nativeTerminal = terminalController.get();
      if (!nativeTerminal)
        throw new RuntimeRefusal("Native Terminal Host is unavailable");
      try {
        const result = await nativeTerminal.write(input.id, input.input, {
          idempotencyKey: input.idempotencyKey,
        });
        return { id: input.id, ...result };
      } catch (error) {
        throw refusalFromRegistry(error);
      }
    },
    async nativeTerminalResize(input) {
      await ready;
      const nativeTerminal = terminalController.get();
      if (!nativeTerminal)
        throw new RuntimeRefusal("Native Terminal Host is unavailable");
      try {
        return publicNativeTerminal(
          await nativeTerminal.resize(
            input.id,
            input.rows,
            input.cols,
            "model",
          ),
        );
      } catch (error) {
        throw refusalFromRegistry(error);
      }
    },
    async checkpointList() {
      await ready;
      return (await checkpointController.get().list()).map((record) => ({
        id: record.id,
        sequence: record.sequence,
        turnID: record.turnID,
        stepID: record.stepID,
        step: record.step,
        reason: record.reason,
        createdAt: record.createdAt,
        complete: record.complete,
        errors: record.errors,
        files: Object.keys(record.manifest.entries).length,
        changes: record.changes.length,
        tokenEstimate: record.context.tokenEstimate,
        diskUsageBytes: record.diskUsageBytes,
      }));
    },
    async checkpointPreview(id) {
      await ready;
      return await checkpointController
        .get()
        .previewRollback(
          id,
          runtimeContext,
          checkpointController.resources(),
          true,
        );
    },
    async checkpointRollback(input) {
      await ready;
      const preview = await checkpointController.get().rollbackTo(input.id, {
        context: runtimeContext,
        dryRun: input.dryRun,
        ...checkpointController.rollbackOptions(),
      });
      publish(await runtimeStatusSnapshot());
      return preview;
    },
    async sandboxList() {
      await ready;
      const sandboxes = sandboxController.get();
      return (await sandboxes.list()).map((sandbox) => ({
        id: sandbox.id,
        root: sandbox.root,
        isolationLevel: sandbox.isolationLevel,
        changedFiles: sandbox.changedFiles.length,
        runningResources: sandbox.runningResources.length,
        envAllowlist: sandbox.envAllowlist,
      }));
    },
    async sandboxDiff(id) {
      await ready;
      const sandboxes = sandboxController.get();
      return await sandboxes.previewMerge(id);
    },
    async sandboxResources(id) {
      await ready;
      const sandboxes = sandboxController.get();
      return sandboxes.resourcesFor(id);
    },
    async sandboxResourceOutput(input) {
      await ready;
      const sandboxes = sandboxController.get();
      return await sandboxes.resourceOutput(
        input.id,
        input.resourceID,
        input.maxBytes,
      );
    },
    async sandboxMerge(id) {
      await ready;
      const sandboxes = sandboxController.get();
      await authorizeSandboxManagement("sandbox_merge", { id });
      const changes = await sandboxes.merge(
        id,
        workspaceRoot,
        async (paths) => await authorizeSandboxMerge({ id, paths }),
      );
      const operationID = `sandbox_merge:${id}:${randomUUID()}`;
      // WG4 Phase 3: sandbox merge keeps its own operation provenance (not a
      // tool call), but registers an expected mutation so the auditor can
      // attribute merged paths to the merge operation.
      mutationRegistry.register({
        sessionID,
        episodeID: options.episodeID,
        operationID,
        toolName: "sandbox_merge",
        authorizedPaths: ["."],
        expectedOperations: ["added", "modified", "deleted"],
      });
      for (const change of changes) {
        publish(
          workspaceChangeNode({
            operationID,
            path: change.path,
            toolName: "sandbox_merge",
            sessionID,
          }),
        );
      }
      mutationRegistry.settle(operationID);
      publish(sandboxes.updateEvent(id));
      publish(sandboxes.auditEvent(id, "merge"));
      return changes;
    },
    async sandboxDelete(id) {
      await ready;
      const sandboxes = sandboxController.get();
      await authorizeSandboxManagement("sandbox_delete", { id });
      const result = await sandboxes.delete(id);
      publish({
        type: "sandbox.update",
        id,
        status: "deleted",
        root: "",
        isolationLevel: "workspace",
        changedFiles: result.pendingChanges.length,
        runningResources: result.runningResources.length,
        target: { kind: "host", cwd: workspaceRoot },
        resourcePolicy: "sandbox deleted after resource cleanup",
      });
      return result;
    },
    async sandboxResourceStop(input) {
      await ready;
      const sandboxes = sandboxController.get();
      await authorizeSandboxManagement("sandbox_resource_stop", input);
      const resource = await sandboxes.stopResource(input.id, input.resourceID);
      publish(sandboxes.updateEvent(input.id));
      publish(sandboxes.auditEvent(input.id, "resource_stop"));
      return resource;
    },
    async sessionList() {
      await ready;
      return await sessionStoreController.list();
    },
    async sessionTouch(id) {
      await ready;
      await sessionStoreController.touch(id);
    },
    async sessionRename(id, title) {
      await ready;
      return await sessionStoreController.rename(id, title);
    },
    async sessionPin(id, pinned) {
      await ready;
      return await sessionStoreController.pin(id, pinned);
    },
    async sessionDuplicate(id, title) {
      await ready;
      return await sessionStoreController.duplicate(id, title);
    },
    async sessionFork(id, turnID, title) {
      await ready;
      return await sessionStoreController.fork(id, turnID, title);
    },
    async sessionDelete(id) {
      await ready;
      return await sessionStoreController.delete(id);
    },
    async sessionNew(input = {}) {
      await ready;
      return await sessionStoreController.create(input);
    },
    async sessionArchive(id) {
      await ready;
      return await sessionStoreController.archive(id);
    },
    async sessionExport(id) {
      await ready;
      return await sessionStoreController.export(id);
    },
    async permissionList() {
      await ready;
      const config = tsRuntimeConfig;
      if (!config) return { default: "ask", profiles: [] };
      return {
        default: config.defaultPermission,
        profiles: Object.entries(config.permissionProfiles).map(
          ([name, profile]) => ({ name, ...profile }),
        ),
      };
    },
    async permissionSave(input) {
      await ready;
      await updateConfigAtScope(workspaceRoot, {
        permissionProfiles: { [input.name]: input.profile },
      } as never);
      const result = await applyConfigFromDisk();
      return {
        saved: true,
        applied: result.applied,
        reason: result.reason,
      };
    },
    async permissionDelete(name) {
      await ready;
      const config = tsRuntimeConfig;
      if (config && config.defaultPermission === name)
        return {
          deleted: false,
          reason: `permission profile is the active default: ${name}`,
        };
      await updateConfigAtScope(workspaceRoot, {
        permissionProfiles: { [name]: undefined },
      } as never);
      await applyConfigFromDisk();
      return { deleted: true };
    },
    async mcpServerAdd(input) {
      await ready;
      await updateConfigAtScope(workspaceRoot, {
        mcpServers: { [input.name]: input.config },
      } as never);
      await applyConfigFromDisk();
      await mcpController.reload();
      return { saved: true };
    },
    async mcpServerRemove(name) {
      await ready;
      await updateConfigAtScope(workspaceRoot, {
        mcpServers: { [name]: undefined },
      } as never);
      await applyConfigFromDisk();
      await mcpController.reload();
      return { removed: true };
    },
    async agentCreate(input) {
      await ready;
      const config = tsRuntimeConfig;
      if (config && config.agents[input.name])
        return {
          created: false,
          reason: `agent already exists: ${input.name}`,
        };
      await updateConfigAtScope(workspaceRoot, {
        agents: { [input.name]: input.config },
      } as never);
      await applyConfigFromDisk();
      return { created: true };
    },
    async agentUpdate(input) {
      await ready;
      if (!tsRuntimeConfig || !tsRuntimeConfig.agents[input.name])
        throw new Error(`agent not found: ${input.name}`);
      await updateConfigAtScope(workspaceRoot, {
        agents: { [input.name]: input.config },
      } as never);
      await applyConfigFromDisk();
      return { updated: true };
    },
    async agentDelete(name) {
      await ready;
      const config = tsRuntimeConfig;
      if (config && config.defaultAgent === name)
        return {
          deleted: false,
          reason: `agent is the default agent: ${name}`,
        };
      await updateConfigAtScope(workspaceRoot, {
        agents: { [name]: undefined },
      } as never);
      await applyConfigFromDisk();
      return { deleted: true };
    },
    async providerDiscover(input) {
      await ready;
      const models = await discoverProviderModels(
        input.type,
        input.baseURL,
        input.apiKey,
      );
      return { models };
    },
    async providerAdd(input) {
      await ready;
      await updateConfigAtScope(workspaceRoot, {
        providers: {
          [input.name]: {
            type: input.type,
            baseURL: input.baseURL ?? "",
            apiKey: input.apiKey,
          },
        },
      } as never);
      await applyConfigFromDisk();
      return { saved: true };
    },
    async providerRemove(name) {
      await ready;
      const config = tsRuntimeConfig;
      const referenced = config
        ? Object.entries(config.models).find(
            ([, model]) => model.provider === name,
          )
        : undefined;
      if (referenced)
        return {
          removed: false,
          reason: `provider is referenced by model: ${referenced[0]}`,
        };
      await updateConfigAtScope(workspaceRoot, {
        providers: { [name]: undefined },
      } as never);
      await applyConfigFromDisk();
      return { removed: true };
    },
    async pluginUnload(id) {
      await ready;
      const before = new Set(tools.keys());
      const result = await pluginsController.unload(id);
      // The plugin's tool disposers removed its tools from the registry; publish
      // tool.unregistered for the ones that disappeared so the projected tool
      // catalog stops reporting them (P5 dynamic unload).
      for (const name of before) {
        if (tools.has(name)) continue;
        publish({
          type: "tool.unregistered",
          id: `tool:${name}`,
          name,
        });
      }
      return result;
    },
    async pluginReload(id) {
      await ready;
      return await pluginsController.reload(id);
    },
    async runtimeStatus() {
      await ready;
      return await runtimeStatusSnapshot();
    },
    async canReloadConfig() {
      await ready;
      const blocked = configReloadBlockedReason();
      return blocked ? { allowed: false, reason: blocked } : { allowed: true };
    },
    async reloadConfig() {
      await ready;
      // Re-checked here rather than trusting `canReloadConfig`: a turn can start
      // between the two calls, and applying new policy underneath a running turn
      // would change the rules it started under.
      return await applyConfigFromDisk();
    },
    async updateConfig(input) {
      await ready;
      // The TUI settings menu path, now a public surface: merge the patch onto
      // disk, then apply. The file is written either way; whether it takes
      // effect under a running turn is an ordinary answer, not an exception.
      // Idempotent by patch: the same patch merged twice produces the same
      // merged config.
      await updateConfigAtScope(
        workspaceRoot,
        input.patch as never,
        input.scope ?? "project",
      );
      // Applying is the same operation as a reload, with the same value-type
      // refusal; share it so the two paths cannot drift.
      return await applyConfigFromDisk();
    },
    async settingsGet() {
      await ready;
      const resolved = await resolveTuiConfig(workspaceRoot);
      return {
        config: resolved.config as unknown as Record<string, unknown>,
        sources: resolved.sources,
      };
    },
    async settingsSet(patch, scope) {
      await ready;
      // The interface-preference file, served publicly now that the TUI no
      // longer owns it privately. Validated by the shared schema (an invalid
      // patch is an argument error, not a partial write), written atomically,
      // then announced so subscribers can re-read.
      await saveTuiConfig(workspaceRoot, patch, scope);
      publish({ type: "settings.updated", scope });
      return { applied: true };
    },
    async diagnostics(limit = 100) {
      await ready;
      return runtimeDiagnostics.slice(-Math.min(500, Math.max(1, limit)));
    },
    snapshot() {
      const event: RuntimeEvent = {
        type: "snapshot.created",
        id: `snap_${Date.now().toString(36)}`,
        files: [],
      };
      publish(event);
      return event;
    },
    diagnostic(message, level = "warning") {
      publish({ type: "diagnostic", level, message });
    },
    lastSubmission() {
      return lastSubmitted;
    },
    async constitutionRules() {
      if (!session) return [];
      return projectedConstitutionRules(session.events).map((r) => ({
        ruleID: r.ruleID,
        statement: r.statement,
        scope: r.scope,
        priority: r.priority,
        source: r.source,
        enforcement: r.enforcement,
        overridePolicy: r.overridePolicy,
      }));
    },
    async decisionRecords() {
      if (!session) return [];
      return projectedDecisionRecords(session.events).map((r) => ({
        decision: r.decision,
        rationale: r.rationale ?? [],
        alternatives: r.alternatives ?? [],
        consequences: r.consequences ?? [],
        status: r.status,
        linkedPlans: r.linkedPlans ?? [],
        linkedConstraints: r.linkedConstraints ?? [],
      }));
    },
    /**
     * The `decision.recorded` production writer. Decisions are durable facts —
     * a decision text and rationale may reach the journal — so this is the
     * surface the Chat/override loop (CST3) records through. The event
     * constructor in `constitution-ledger.ts` keeps the secret-safe boundary:
     * decision text and rationale are prose, never tool output or file content.
     */
    async recordDecision(input: {
      decision: string;
      rationale?: string[];
      alternatives?: { option: string; rejectedReason?: string }[];
      consequences?: string[];
      linkedPlans?: string[];
      linkedConstraints?: string[];
    }) {
      if (!session) return { recorded: false as const };
      const event = recordDecision({
        id: `decision:${Date.now().toString(36)}:${decisionSequence++}`,
        ...input,
      });
      publishForSession(activeExec, event);
      // CST4 Work Graph linkage: the decision is a `decision` node in the graph.
      publishForSession(
        activeExec,
        decisionNode({
          decisionID: event.id,
          decision: event.decision,
          sessionID,
        }),
      );
      return { recorded: true as const };
    },
    async evidenceRecords() {
      if (!session) return [];
      // P2 E3: the effective status of each evidence record is driven by the
      // lifecycle of the plan whose task it belongs to (a projection policy —
      // the journal keeps the recorded status; the query answers what it means
      // now).
      const plans = projectedPlans(session.events);
      const planStateForTask = new Map<string, string>();
      for (const plan of plans) {
        if (plan.taskID) planStateForTask.set(plan.taskID, plan.status);
      }
      return projectedEvidenceRecords(session.events).map((r) => ({
        taskID: r.taskID,
        objective: r.objective,
        status: r.status,
        effectiveStatus:
          r.taskID && planStateForTask.has(r.taskID)
            ? evidenceStatusForPlanState(
                planStateForTask.get(r.taskID)! as PlanLifecycleState,
                r.status,
              )
            : r.status,
        changes: r.changes ?? [],
        validations: r.validations ?? [],
        knownGaps: r.knownGaps ?? [],
      }));
    },
    async completions() {
      if (!session) return [];
      return projectedCompletions(session.events).map((c) => ({
        completionID: c.id,
        taskID: c.taskID,
        objective: c.objective,
        changeSummary: c.changeSummary,
        ...(c.behaviorImpact ? { behaviorImpact: c.behaviorImpact } : {}),
        validations: c.validations,
        ...(c.humanValidation ? { humanValidation: c.humanValidation } : {}),
        knownGaps: c.knownGaps ?? [],
        externalSideEffects: c.externalSideEffects ?? [],
        ...(c.rollbackState ? { rollbackState: c.rollbackState } : {}),
        evidenceIDs: c.evidenceIDs ?? [],
        recordedAt: c.recordedAt,
      }));
    },
    /**
     * The `evidence.recorded` production writer (E2 起步): runs a validation
     * command against the workspace, redacts secrets and truncates the summary,
     * then records the outcome as a durable evidence fact. This is the
     * validation-runner adapter — the command runs with the workspace as cwd,
     * bounded output and a timeout, and only the command, outcome, bounded safe
     * summary and duration reach the journal. Raw output never does.
     */
    async recordValidation(input: {
      taskID: string;
      objective: string;
      command: string;
      timeoutSec?: number;
      knownGaps?: string[];
    }) {
      if (!session) return { recorded: false as const };
      if (
        typeof input.taskID !== "string" ||
        input.taskID.trim().length === 0 ||
        typeof input.objective !== "string" ||
        input.objective.trim().length === 0 ||
        typeof input.command !== "string" ||
        input.command.trim().length === 0
      )
        return { recorded: false as const };
      const startedAt = performance.now();
      let result: "passed" | "failed" | "skipped" = "failed";
      let safeSummary = "validation command did not run";
      try {
        const run = await runValidationCommand(
          input.command,
          workspaceRoot,
          input.timeoutSec ?? 120,
        );
        result = run.exitCode === 0 ? "passed" : "failed";
        safeSummary = run.safeSummary;
      } catch (error) {
        safeSummary = `validation runner failed: ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
      const outcome = boundValidationOutcome({
        command: redactToolOutput(input.command, true),
        result,
        safeSummary,
        durationMs: performance.now() - startedAt,
      });
      const event = buildEvidenceRecorded({
        id: `evidence:${Date.now().toString(36)}:${evidenceSequence++}`,
        taskID: input.taskID,
        objective: input.objective,
        status: result === "passed" ? "validated" : "failed",
        validations: [outcome],
        knownGaps: input.knownGaps,
      });
      publishForSession(activeExec, event);
      return {
        recorded: true as const,
        result,
        safeSummary: outcome.safeSummary,
      };
    },
    /**
     * Record a completion card (P2 E4): the fixed report structure (§5) that
     * answers "is it really done, what evidence is missing". The card is safe
     * prose — changeSummary is a summary, never a diff or file content — and a
     * `validated_by` Work Graph edge connects each completed change to the card.
     */
    async recordCompletion(input: {
      taskID: string;
      objective: string;
      changeSummary: string;
      behaviorImpact?: string;
      validations?: Array<{
        command: string;
        result: "passed" | "failed" | "skipped";
        safeSummary: string;
      }>;
      humanValidation?: string;
      knownGaps?: string[];
      externalSideEffects?: string[];
      rollbackState?: "clean" | "available" | "none" | "needs_promotion";
      evidenceIDs?: string[];
      changePaths?: string[];
    }) {
      if (!session) return { recorded: false as const };
      if (
        !input.taskID.trim() ||
        !input.objective.trim() ||
        !input.changeSummary.trim()
      )
        return { recorded: false as const };
      const recordedAt = new Date().toISOString();
      const completionID = `completion:${Date.now().toString(36)}:${completionSequence++}`;
      const event = buildCompletionRecorded({
        id: completionID,
        taskID: input.taskID,
        objective: input.objective,
        changeSummary: redactToolOutput(input.changeSummary, true),
        ...(input.behaviorImpact
          ? { behaviorImpact: redactToolOutput(input.behaviorImpact, true) }
          : {}),
        validations: (input.validations ?? []).map((validation) =>
          boundValidationOutcome({
            command: redactToolOutput(validation.command, true),
            result: validation.result,
            safeSummary: validation.safeSummary,
          }),
        ),
        ...(input.humanValidation
          ? { humanValidation: redactToolOutput(input.humanValidation, true) }
          : {}),
        knownGaps: input.knownGaps,
        externalSideEffects: input.externalSideEffects,
        rollbackState: input.rollbackState,
        evidenceIDs: input.evidenceIDs,
        recordedAt,
      });
      publishForSession(activeExec, event);
      // P2 E4 Work Graph integration: each completed change is validated by the
      // card through a `validated_by` edge.
      for (const path of input.changePaths ?? [])
        publishForSession(
          activeExec,
          completionValidationEdge({
            changeID: event.taskID,
            path,
            completionID,
          }),
        );
      return { recorded: true as const, completionID };
    },
    async mailboxList() {
      if (!session) return [];
      return projectedMailboxMessages(session.events).map((m) => ({
        messageID: m.messageID,
        source: m.source,
        priority: m.priority,
        intent: m.intent,
        text: m.text,
        safeSummary: m.safeSummary,
        ...(m.relatedPlanID ? { relatedPlanID: m.relatedPlanID } : {}),
        deliveryPolicy: m.deliveryPolicy,
        createdAt: m.createdAt,
        status: m.status,
        ...(m.reason ? { reason: m.reason } : {}),
      }));
    },
    async mailboxSend(input: {
      source?: "user_via_live_chat" | "system";
      priority?: "normal" | "high" | "urgent";
      intent: string;
      text: string;
      safeSummary?: string;
      relatedPlanID?: string;
      deliveryPolicy?: string;
    }) {
      return enqueueMailboxMessage(input);
    },
    async mailboxDeliver(messageID: string) {
      if (!session || typeof messageID !== "string" || !messageID)
        return { delivered: false as const };
      const message = projectedMailboxMessages(session.events).find(
        (m) => m.messageID === messageID && m.status === "queued",
      );
      if (!message) return { delivered: false as const };
      publishForSession(
        activeExec,
        buildMailboxStatus({
          id: `${messageID}:delivered:${mailboxSequence++}`,
          messageID,
          status: "delivered",
          at: new Date().toISOString(),
        }),
      );
      return { delivered: true as const };
    },
    async mailboxAcknowledge(messageID: string) {
      if (!session || typeof messageID !== "string" || !messageID)
        return { acknowledged: false as const };
      const message = projectedMailboxMessages(session.events).find(
        (m) => m.messageID === messageID && m.status === "delivered",
      );
      if (!message) return { acknowledged: false as const };
      publishForSession(
        activeExec,
        buildMailboxStatus({
          id: `${messageID}:acknowledged:${mailboxSequence++}`,
          messageID,
          status: "acknowledged",
          at: new Date().toISOString(),
        }),
      );
      return { acknowledged: true as const };
    },
    async mailboxDefer(messageID: string, reason?: string) {
      if (!session || typeof messageID !== "string" || !messageID)
        return { deferred: false as const };
      const message = projectedMailboxMessages(session.events).find(
        (m) => m.messageID === messageID && m.status === "queued",
      );
      if (!message) return { deferred: false as const };
      publishForSession(
        activeExec,
        buildMailboxStatus({
          id: `${messageID}:deferred:${mailboxSequence++}`,
          messageID,
          status: "deferred",
          at: new Date().toISOString(),
          reason:
            redactToolOutput(reason ?? "", true).slice(0, 500) || undefined,
        }),
      );
      return { deferred: true as const };
    },
    async mailboxSupersede(messageID: string, reason?: string) {
      if (!session || typeof messageID !== "string" || !messageID)
        return { superseded: false as const };
      const message = projectedMailboxMessages(session.events).find(
        (m) => m.messageID === messageID && m.status === "queued",
      );
      if (!message) return { superseded: false as const };
      publishForSession(
        activeExec,
        buildMailboxStatus({
          id: `${messageID}:superseded:${mailboxSequence++}`,
          messageID,
          status: "superseded",
          at: new Date().toISOString(),
          reason:
            redactToolOutput(reason ?? "", true).slice(0, 500) || undefined,
        }),
      );
      return { superseded: true as const };
    },
    async planList() {
      if (!session) return [];
      return projectedPlans(session.events).map((plan) => ({
        planID: plan.planID,
        version: plan.version,
        title: plan.title,
        author: plan.author,
        objective: plan.objective,
        steps: plan.steps,
        constraints: plan.constraints,
        verification: plan.verification,
        riskNotes: plan.riskNotes,
        ...(plan.relatedMailboxMessageID
          ? { relatedMailboxMessageID: plan.relatedMailboxMessageID }
          : {}),
        ...(plan.supersedesPlanID
          ? { supersedesPlanID: plan.supersedesPlanID }
          : {}),
        createdAt: plan.createdAt,
        status: plan.status,
        ...(plan.reason ? { reason: plan.reason } : {}),
      }));
    },
    async chatMessages() {
      if (!session) return [];
      return projectedChatMessages(session.events).map((message) => ({
        messageID: message.messageID,
        role: message.role,
        text: message.text,
        at: message.at,
      }));
    },
    async chatRollback(input: { toMessageID: string }) {
      if (!session) return { rolledBackTo: input.toMessageID, removed: 0 };
      const history = projectedChatMessages(session.events);
      const index = history.findIndex(
        (message) => message.messageID === input.toMessageID,
      );
      if (index === -1) return { rolledBackTo: input.toMessageID, removed: 0 };
      const removed = history.length - (index + 1);
      publish({
        type: "chat.rollback",
        id: `chat:rollback:${Date.now().toString(36)}:${chatSequence++}`,
        toMessageID: input.toMessageID,
        removed,
        at: new Date().toISOString(),
      });
      return { rolledBackTo: input.toMessageID, removed };
    },
    async chatSubmit(input: { text: string }) {
      await ready;
      const text = typeof input.text === "string" ? input.text.trim() : "";
      if (!text || !session || !provider) return { messageID: "" };
      const now = new Date();
      const userMessageID = `chat:${Date.now().toString(36)}:${chatSequence++}`;
      publish({
        type: "chat.message.added",
        id: `${userMessageID}:user`,
        messageID: userMessageID,
        role: "user",
        text: redactToolOutput(text, true),
        at: now.toISOString(),
      });
      const responseMessageID = `chat:${Date.now().toString(36)}:${chatSequence++}`;
      try {
        await runChatTurn({ text, responseMessageID });
      } catch (cause) {
        publish({
          type: "chat.message.added",
          id: `${responseMessageID}:chat`,
          messageID: responseMessageID,
          role: "chat",
          text: `(live work chat error: ${
            cause instanceof Error ? cause.message : String(cause)
          })`,
          at: new Date().toISOString(),
        });
      }
      return { messageID: responseMessageID };
    },
    async planCreate(input: {
      title: string;
      author?: "user" | "live_chat" | "main_agent";
      objective: string;
      steps: Array<{
        id: string;
        title: string;
        detail?: string;
        verification?: string;
      }>;
      constraints?: string[];
      verification?: string[];
      riskNotes?: string[];
      relatedMailboxMessageID?: string;
      supersedesPlanID?: string;
      taskID?: string;
    }) {
      return createPlanDraft(input);
    },
    async planUpdate(input: {
      planID: string;
      objective?: string;
      steps?: Array<{
        id: string;
        title: string;
        detail?: string;
        verification?: string;
      }>;
      constraints?: string[];
      verification?: string[];
      riskNotes?: string[];
      reason?: string;
    }) {
      if (!session || typeof input.planID !== "string" || !input.planID)
        return { updated: false as const };
      const plan = projectedPlans(session.events).find(
        (p) => p.planID === input.planID && p.status === "draft",
      );
      if (!plan) return { updated: false as const };
      publishForSession(
        activeExec,
        buildPlanTransition({
          id: `${input.planID}:draft:${plan.version + 1}`,
          planID: input.planID,
          version: plan.version + 1,
          transition: "draft_updated",
          at: new Date().toISOString(),
          reason: input.reason,
        }),
      );
      return { updated: true as const };
    },
    async planPropose(planID: string) {
      if (!session || typeof planID !== "string" || !planID)
        return { proposed: false as const };
      const plan = projectedPlans(session.events).find(
        (p) => p.planID === planID && p.status === "draft",
      );
      if (!plan) return { proposed: false as const };
      publishForSession(
        activeExec,
        buildPlanTransition({
          id: `${planID}:proposed:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "proposed",
          at: new Date().toISOString(),
        }),
      );
      return { proposed: true as const };
    },
    async planAccept(planID: string) {
      if (!session || typeof planID !== "string" || !planID)
        return { accepted: false as const };
      const plan = projectedPlans(session.events).find(
        (p) => p.planID === planID && p.status === "proposed",
      );
      if (!plan) return { accepted: false as const };
      // Acceptance is the user's decision (§6.2: "accepted = 用户接受计划内容").
      // It goes through the same approval request/response machinery as tools:
      // the runtime waits for a human approve before recording the acceptance,
      // so a proposed plan cannot be silently accepted by the caller. A reject
      // leaves the plan proposed.
      const approvalID = `${planID}:accept:${plan.version + 1}:${crypto.randomUUID().replace(/-/gu, "").slice(0, 8)}`;
      const response = await interactive.requirePlanAcceptance({
        approvalID,
        planID,
        title: "Accept plan",
        detail: `${plan.title}\n${plan.objective}`,
      });
      if (response?.decision === "reject") return { accepted: false as const };
      publishForSession(
        activeExec,
        buildPlanTransition({
          id: `${planID}:accepted:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "accepted",
          at: new Date().toISOString(),
        }),
      );
      return { accepted: true as const };
    },
    async planQueue(planID: string) {
      if (!session || typeof planID !== "string" || !planID)
        return { queued: false as const };
      const plan = projectedPlans(session.events).find(
        (p) => p.planID === planID && p.status === "accepted",
      );
      if (!plan) return { queued: false as const };
      publishForSession(
        activeExec,
        buildPlanTransition({
          id: `${planID}:queued:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "queued",
          at: new Date().toISOString(),
        }),
      );
      return { queued: true as const };
    },
    async planActivate(planID: string) {
      if (!session || typeof planID !== "string" || !planID)
        return { activated: false as const };
      const plan = projectedPlans(session.events).find(
        (p) => p.planID === planID && p.status === "queued_next_plan",
      );
      if (!plan) return { activated: false as const };
      publishForSession(
        activeExec,
        buildPlanTransition({
          id: `${planID}:activated:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "activated",
          at: new Date().toISOString(),
        }),
      );
      return { activated: true as const };
    },
    async planSupersede(planID: string, reason?: string) {
      if (!session || typeof planID !== "string" || !planID)
        return { superseded: false as const };
      const plan = projectedPlans(session.events).find(
        (p) =>
          p.planID === planID &&
          p.status !== "completed" &&
          p.status !== "archived",
      );
      if (!plan) return { superseded: false as const };
      publishForSession(
        activeExec,
        buildPlanTransition({
          id: `${planID}:superseded:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "superseded",
          at: new Date().toISOString(),
          reason:
            redactToolOutput(reason ?? "", true).slice(0, 500) || undefined,
        }),
      );
      return { superseded: true as const };
    },
    async planCompleted(planID: string) {
      if (!session || typeof planID !== "string" || !planID)
        return { completed: false as const };
      const plan = projectedPlans(session.events).find(
        (candidate) =>
          candidate.planID === planID && candidate.status === "active",
      );
      if (!plan) return { completed: false as const };
      publishForSession(
        activeExec,
        buildPlanTransition({
          id: `${planID}:completed:${plan.version + 1}`,
          planID,
          version: plan.version + 1,
          transition: "completed",
          at: new Date().toISOString(),
        }),
      );
      return { completed: true as const };
    },
    async sessionSnapshot() {
      if (!session) return undefined;
      return latestSessionSnapshot(session.events);
    },
    async driftFindings() {
      if (!session) return [];
      return projectedDriftFindings(session.events).map((f) => ({
        findingID: f.findingID,
        severity: f.severity,
        confidence: f.confidence,
        originalObjective: f.originalObjective,
        currentActivity: f.currentActivity,
        evidence: f.evidence,
        status: f.status,
      }));
    },
    /**
     * Run the DriftEvaluator against safe signals and publish any findings it
     * opens. The evaluator is the only production writer of
     * `drift.finding_opened` (§56.9); it has no write power — a finding only
     * escalates to an approval/Chat/mailbox prompt, never a cancellation.
     * Already-open findings are not reopened.
     */
    async evaluateDrift(input: {
      objective: string;
      currentActivity: string;
      applicableConstraints?: string[];
      changes?: Array<{
        path?: string;
        action?: string;
        target?: string;
        summary?: string;
      }>;
      evidenceRefs?: string[];
    }) {
      if (!session) return { opened: 0 as const };
      if (!input.objective.trim() || !input.currentActivity.trim())
        return { opened: 0 as const };
      const findings = driftEvaluator.evaluate({
        sessionID,
        turnID: activeExec?.activeTurnID,
        objective: input.objective,
        currentActivity: input.currentActivity,
        applicableConstraints: input.applicableConstraints ?? [],
        changes: input.changes ?? [],
        evidenceRefs: input.evidenceRefs ?? [],
      });
      for (const finding of findings) publishForSession(activeExec, finding);
      return { opened: findings.length };
    },
    /**
     * Acknowledge a drift finding (P7 D3): the Main Agent explains it, the user
     * dismisses it, or the work corrects it. Only an open finding can transition.
     */
    async acknowledgeDriftFinding(input: {
      findingID: string;
      status: "explained" | "dismissed" | "corrected";
      rationale?: string;
    }) {
      if (!session) return { acknowledged: false as const };
      if (!input.findingID.trim()) return { acknowledged: false as const };
      const finding = projectedDriftFindings(session.events).find(
        (candidate) =>
          candidate.findingID === input.findingID &&
          candidate.status === "open",
      );
      if (!finding) return { acknowledged: false as const };
      publishForSession(
        activeExec,
        buildDriftFindingUpdate({
          id: `drift:${Date.now().toString(36)}:${input.findingID}`,
          findingID: input.findingID,
          status: input.status,
          rationale: input.rationale,
        }),
      );
      return { acknowledged: true as const };
    },
    async registeredTools() {
      if (!session) return [];
      return projectedCanonicalTools(session.events).map((t) => ({
        name: t.name,
        owner: t.owner,
        scope: t.scope,
        recovery: t.recovery,
        precedence: t.precedence,
        requiresApproval: t.requiresApproval,
      }));
    },
    async capabilities() {
      // The built-in catalogue registers during initialize; a query that skips
      // `ready` would answer before those records exist.
      await ready;
      if (!capabilityRegistry) return [];
      return [
        ...(workspaceCapabilityView?.list() ?? []),
        ...capabilityRegistry.list(),
      ].map((record) => ({
        id: record.id,
        name: record.name,
        version: record.version,
        scope: record.scope,
        grants: record.grants,
        dependencies: record.dependencies,
        provides: record.provides,
        requires: record.requires,
        precedence: record.precedence,
        // The effective contributions this capability owns, as metadata only.
        // Payloads stay on the host side: a tool definition or a settings value
        // must not leak through the query surface. Contributions that lost an
        // override are not effective and are omitted.
        contributions: record.grants.flatMap((grant) =>
          capabilityRegistry
            .contributions<unknown>(grant)
            .filter((entry) => entry.capabilityID === record.id)
            .map((entry) => ({ kind: entry.kind, name: entry.name })),
        ),
      }));
    },
    async workGraphNodes() {
      if (!session) return [];
      return projectedWorkGraphNodes(session.events).map((r) => ({
        nodeID: r.nodeID,
        kind: r.kind,
        summary: r.summary,
        actor: r.actor,
        target: r.target,
        sessionID: r.sessionID,
        turnID: r.turnID,
        episodeID: r.episodeID,
      }));
    },
    async workGraphEdges() {
      if (!session) return [];
      return projectedWorkGraphEdges(session.events).map((r) => ({
        sourceID: r.sourceID,
        targetID: r.targetID,
        kind: r.kind,
        reason: r.reason,
        episodeID: r.episodeID,
      }));
    },
    respondApproval(response) {
      return interactive.respondApproval(response);
    },
    respondQuestion(response) {
      return interactive.respondQuestion(response);
    },
  };

  function isPendingInteractiveRequest(
    forSessionID: SessionID,
    id: string,
    kind: "approval" | "question",
  ) {
    // D2: the request lives in the session whose turn issued it. A response
    // arriving while the UI is attached to another session must be judged
    // against that session's journal, never the attached one's.
    const target = executionBySession.get(forSessionID)?.session ?? session;
    const pending = projectInteractiveRequests(target?.events ?? []);
    return kind === "approval"
      ? pending.approvals.some((request) => request.id === id)
      : pending.questions.some((request) => request.id === id);
  }

  async function handleCommand(id: string, text: string, signal?: AbortSignal) {
    const trimmed = text.trim();
    if (!trimmed.startsWith("/")) return false;
    if (trimmed === "/help") {
      publish({
        type: "content.delta",
        id,
        text: [
          "Natalia TS7 agent shell commands:",
          ...runtimeSlashCommands.map(
            (command) =>
              `/${command.name}${command.acceptsArguments ? " <args>" : ""} - ${command.description}`,
          ),
          "Use Ctrl-C to cancel an active turn and Ctrl-D on an empty composer to exit.",
        ].join("\n"),
      });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return true;
    }
    if (trimmed === "/doctor") {
      const configured = provider
        ? `${provider.provider}/${provider.model} (${providerSource})`
        : "not configured";
      publish({
        type: "content.delta",
        id,
        text: [
          "Natalia TS7 runtime doctor",
          `provider: ${configured}`,
          `workspace: ${workspaceRoot}`,
          `session: ${sessionID}`,
          `native tools: ${tools.size}`,
          `agent: ${selectedAgent?.name ?? "default"}`,
          `skills: ${skillsController.list().length}`,
          provider
            ? "provider check: configured; submit a short prompt to verify live streaming"
            : "provider check: set NATALIA_OPENAI_API_KEY (or OPENAI_API_KEY), or configure a provider in .natalia/config.json, then restart the TUI",
          "safety: write/shell/process actions require approval unless permissionMode=auto is explicitly configured by a caller",
          EGRESS_ADVISORY,
        ].join("\n"),
      });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      publish(await runtimeStatusSnapshot());
      return true;
    }
    if (trimmed === "/status") {
      const snapshot = await runtimeStatusSnapshot();
      publish(snapshot);
      publish({
        type: "content.delta",
        id,
        text: [
          `provider: ${snapshot.provider}/${snapshot.model} (${providerSource})`,
          `context: ${snapshot.context}`,
          `steps: ${snapshot.step}`,
          `workspace: ${snapshot.cwd}`,
          `background: ${snapshot.background}`,
        ].join("\n"),
      });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return true;
    }
    if (trimmed === "/diagnostics" || trimmed.startsWith("/diagnostics ")) {
      const value = trimmed.slice("/diagnostics".length).trim();
      const limit = value ? Number(value) : 20;
      if (!Number.isInteger(limit) || limit < 1 || limit > 500)
        throw new Error(
          "diagnostics limit must be an integer between 1 and 500",
        );
      const entries = runtimeDiagnostics.slice(-limit);
      publish({
        type: "content.delta",
        id,
        text: entries.length
          ? entries
              .map(
                (entry) =>
                  `${entry.at}${entry.owner ? ` [${entry.owner}]` : ""} ${entry.level}: ${entry.message}`,
              )
              .join("\n")
          : "no diagnostics recorded",
      });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return true;
    }
    if (trimmed === "/sessions") {
      const store = sessionStoreController.sqlite();
      const listing = store
        ? store
            .list()
            .map(
              (item) =>
                `${item.id}  ${item.title}  ${store.eventCount(item.id)} events`,
            )
            .join("\n")
        : (await sessionStoreController.json().list())
            .map(
              (item) =>
                `${item.id}  ${item.title}  ${item.events.length} events`,
            )
            .join("\n");
      publish({
        type: "content.delta",
        id,
        text: listing || "no TS sessions found in this workspace",
      });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return true;
    }
    if (/^\/(?:checkpoint|checkpoints|rollback)\b/u.test(trimmed)) {
      if (!checkpointController.isEnabled())
        throw new Error("checkpoint store is not initialized");
      const result = await runCheckpointCommand(
        checkpointController.get(),
        runtimeContext,
        trimmed,
        checkpointController.rollbackOptions(),
      );
      publish({ type: "content.delta", id, text: result.output });
      publish({ type: "content.done", id });
      publish({
        type: "turn.finished",
        id,
        stopReason: result.ok ? "done" : "error",
      });
      publish(await runtimeStatusSnapshot());
      return true;
    }
    if (trimmed === "/skills") {
      const skills = skillsController.list();
      publish({
        type: "content.delta",
        id,
        text: skills.length
          ? skills
              .map((skill) => `${skill.qualifiedName}: ${skill.description}`)
              .join("\n")
          : "no native skills discovered",
      });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return true;
    }
    if (trimmed === "/models") {
      const models = await clientModelCatalog();
      publish({
        type: "content.delta",
        id,
        text: models.length
          ? models
              .map(
                (model) =>
                  `${model.id}: ${model.name} @ ${model.provider}${model.variants.length ? ` (${model.variants.join(", ")})` : ""}`,
              )
              .join("\n")
          : "no selectable models configured",
      });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return true;
    }
    if (trimmed === "/files" || trimmed.startsWith("/files ")) {
      const query = trimmed.slice("/files".length).trim();
      const files = await findWorkspaceFiles({
        workspaceRoot,
        query: query || undefined,
        limit: 50,
      });
      publish({
        type: "content.delta",
        id,
        text: files.length
          ? files.map((file) => file.path).join("\n")
          : "no workspace files found",
      });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return true;
    }
    if (trimmed.startsWith("/search ")) {
      const query = trimmed.slice("/search ".length).trim();
      const matches = await searchWorkspaceFiles({
        workspaceRoot,
        query,
        limit: 50,
      });
      publish({
        type: "content.delta",
        id,
        text: matches.length
          ? matches
              .map((match) => `${match.path}:${match.line}:${match.text}`)
              .join("\n")
          : "no workspace matches found",
      });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return true;
    }
    if (trimmed.startsWith("/model ")) {
      const [modelID, variant] = trimmed
        .slice("/model ".length)
        .trim()
        .split(/\s+/u);
      if (!modelID) throw new Error("model ID is required");
      await selectRuntimeModel(modelID, variant);
      publish({
        type: "content.delta",
        id,
        text: `selected model ${modelID}${variant ? ` (${variant})` : ""}`,
      });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return true;
    }
    if (trimmed.startsWith("/attach ")) {
      const [path, ...rest] = trimmed
        .slice("/attach ".length)
        .trim()
        .split(/\s+/u);
      if (!path || !rest.length)
        throw new Error("usage: /attach <workspace-relative-image> <prompt>");
      await submitInput({ text: rest.join(" "), attachments: [path] });
      return true;
    }
    if (trimmed === "/agents") {
      const agents = agentRegistry?.selectable() ?? [];
      publish({
        type: "content.delta",
        id,
        text: agents.length
          ? agents
              .map((agent) => `${agent.name}: ${agent.description}`)
              .join("\n")
          : "no selectable agents configured",
      });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return true;
    }
    if (trimmed.startsWith("/agent ")) {
      const name = trimmed.slice("/agent ".length).trim();
      if (!name) throw new Error("agent name is required");
      const agent = agentRegistry?.select(name);
      if (!agent) throw new Error(`agent not found: ${name}`);
      selectedAgent = agent;
      if (activeExec) activeExec.selectedAgent = agent;
      applyAgentPolicy();
      applyAgentProvider();
      publish({ type: "agent.selection", name: agent.name, pending: false });
      publish({
        type: "content.delta",
        id,
        text: `selected agent ${agent.name}`,
      });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return true;
    }
    if (trimmed === "/pause") {
      paused = true;
      publish({ type: "turn.paused", id, reason: "slash command" });
      publish({ type: "content.delta", id, text: "runtime paused" });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return true;
    }
    if (trimmed === "/resume") {
      paused = false;
      const waiters = pauseWaiters;
      pauseWaiters = [];
      for (const resolveWaiter of waiters) resolveWaiter();
      publish({ type: "turn.resumed", id });
      publish({ type: "content.delta", id, text: "runtime resumed" });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return true;
    }
    if (trimmed.startsWith("/skill ")) {
      activeSkill = skillsController.resolve(
        trimmed.slice("/skill ".length).trim(),
      );
      runtimeContext.add({
        id: `skill:${activeSkill.qualifiedName}:${runtimeContext.journalStatus().journalOffset}`,
        role: "system",
        content: `Active skill ${activeSkill.name}: ${activeSkill.description}\n${activeSkill.body}`,
      });
      publish({
        type: "content.delta",
        id,
        text: `activated skill ${activeSkill.qualifiedName}`,
      });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return true;
    }
    if (trimmed.startsWith("/skill-resource ")) {
      if (!activeSkill) throw new Error("no active skill");
      const resource = trimmed.slice("/skill-resource ".length).trim();
      const content = await readSkillResource(activeSkill, resource);
      publish({ type: "content.delta", id, text: content });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return true;
    }
    if (trimmed.startsWith("/skill-script ")) {
      if (!activeSkill) throw new Error("no active skill");
      const script = trimmed.slice("/skill-script ".length).trim();
      // A slash command runs inside the session's drain, so its cancellation
      // signal is the drain's, not the (never-assigned) activity closure: a
      // cancelled command aborts the skill script's child process.
      const result = await runSkillScript(activeSkill, script, {
        signal: signal ?? activeExec?.activeAbort?.signal,
      });
      publish({
        type: "content.delta",
        id,
        text: JSON.stringify(result, null, 2),
      });
      publish({ type: "content.done", id });
      publish({
        type: "turn.finished",
        id,
        stopReason: result.exitCode === 0 ? "done" : "error",
      });
      return true;
    }
    return false;
  }

  async function executeToolCalls(
    turnID: string,
    calls: ProviderToolCall[],
    assistant: string,
    materialized: ToolMaterialization,
  ): Promise<ProviderMessage[]> {
    // D2: a tool segment belongs to the session its turn was submitted to. The
    // local bindings shadow the activity-scoped globals for the whole segment,
    // so every publish lands in that session's journal with its stamp, and the
    // context ledger touched is the turn's own.
    const exec =
      executionBySession.get(turnSession.get(turnID) ?? sessionID) ??
      activeExec;
    const publish = (event: RuntimeEvent) => publishForSession(exec, event);
    const execContext = exec?.context ?? runtimeContext;
    const assistantMessage: ProviderMessage = {
      role: "assistant",
      content: assistant,
      toolCalls: calls,
    };
    const messages: ProviderMessage[] = [assistantMessage];
    for (const call of calls) {
      execContext.add({
        id: `${turnID}:${call.id}:call`,
        role: "tool_call",
        content: `${call.name} ${call.arguments}`,
        pairID: call.id,
      });
    }
    for (const call of calls) {
      if (!call.name.trim()) {
        const reason =
          "provider emitted a tool call without a name; check OpenAI-compatible streaming format";
        publish({
          type: "diagnostic",
          level: "warning",
          message: reason,
        });
        publish({
          type: "tool.update",
          id: `${turnID}:${call.id}`,
          name: "invalid_tool_call",
          callID: call.id,
          status: "failed",
          summary: reason,
          result: reason,
          endedAt: Date.now(),
        });
        publishWorkGraphToolCall(
          turnID,
          call.id,
          "invalid_tool_call",
          "failed",
        );
        messages.push({
          role: "tool",
          toolCallID: call.id,
          toolName: "invalid_tool_call",
          content: toolResultContent(
            `ERROR: ${reason}`,
            call.id,
            options.taskModuleContext,
          ),
        });
        execContext.add({
          id: `${turnID}:${call.id}:result`,
          role: "tool_result",
          content: `ERROR: ${reason}`,
          pairID: call.id,
        });
        continue;
      }
      const resolved = materialized.resolve(call.name);
      if (resolved.status !== "ready") {
        const reason = resolved.error;
        const registered = tools.get(call.name);
        if (
          registered &&
          (!isToolAllowed(call.name) ||
            (permissionMode === "read_only" && registered.requiresApproval))
        )
          publish({
            type: "policy.decision",
            turnID,
            toolName: call.name,
            toolCallID: call.id,
            decision: "deny",
            reason:
              permissionMode === "read_only" && registered.requiresApproval
                ? readOnlyToolMessage(call.name)
                : !moduleToolLayer.isToolAllowed(call.name)
                  ? `blocked outside active ${options.taskModuleContext?.moduleType} module: ${call.name}`
                  : !modulePermissionToolLayer.isToolAllowed(call.name)
                    ? `blocked by active module policy: ${call.name}`
                    : (extensionToolPermission(call.name).diagnostics[0] ??
                      "tool is excluded from the runtime catalog by policy"),
          });
        publish({
          type: "tool.update",
          id: `${turnID}:${call.id}`,
          name: call.name,
          callID: call.id,
          status: "failed",
          summary: reason,
          result: reason,
          endedAt: Date.now(),
        });
        publishWorkGraphToolCall(
          turnID,
          call.id,
          call.name,
          registered && permissionMode === "read_only" ? "rejected" : "failed",
        );
        messages.push({
          role: "tool",
          toolCallID: call.id,
          toolName: call.name,
          content: toolResultContent(
            `ERROR: ${reason}`,
            call.id,
            options.taskModuleContext,
          ),
        });
        execContext.add({
          id: `${turnID}:${call.id}:result`,
          role: "tool_result",
          content: `ERROR: ${reason}`,
          pairID: call.id,
        });
        continue;
      }
      const result = await executeOneTool(turnID, call, resolved.tool);
      messages.push({
        role: "tool",
        toolCallID: call.id,
        toolName: call.name,
        content: toolResultContent(result, call.id, options.taskModuleContext),
      });
      execContext.add({
        id: `${turnID}:${call.id}:result`,
        role: "tool_result",
        content: result,
        pairID: call.id,
      });
    }
    return messages;
  }

  /**
   * The tool result the model actually reads. In a flow module episode the
   * call ID is prepended to the content of text-shaped results, because
   * models reliably read content but routinely ignore the protocol-level
   * tool_call_id — without this the model cannot know its own call ID and
   * guesses evidenceRefs. JSON-shaped results (report_issue, read_data_source
   * and friends) stay untouched: the model consumes them verbatim.
   */
  function toolResultContent(
    content: string,
    callID: string,
    moduleContext: unknown,
  ): string {
    if (!moduleContext) return content;
    const trimmed = content.trimStart();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return content;
    return `[tool call ID: ${callID}] ${content}`;
  }

  /**
   * Checks constitution rules and the self-protection patterns. Returns the
   * blocked reason or undefined.
   *
   * `commandText` is whatever the call would actually run, extracted by the
   * same function the command policy uses, so shell and terminal input are
   * judged from one source. This check runs before approval, which is what
   * makes it a block rather than a prompt: an approval that is skipped, cached
   * or auto-granted cannot let a self-protection violation through.
   */
  function checkConstitutionForTool(
    turnID: string,
    callID: string,
    toolName: string,
    toolAction: string,
    toolResource: string,
    commandText?: string,
  ): string | undefined {
    if (!session) return undefined;
    const rules = projectedConstitutionRules(session.events);
    let blocked: string | undefined;

    if (commandText) {
      for (const entry of SELF_PROTECTION_PATTERNS)
        if (entry.pattern.test(commandText)) {
          publish({
            type: "constitution.check",
            id: `${turnID}:constitution:${entry.ruleID.toLowerCase()}`,
            ruleID: entry.ruleID,
            statement: entry.statement,
            priority: "critical",
            enforcement: "deny",
            action: toolAction,
            resource: `command:${commandText.slice(0, 120)}`,
            conflict: true,
          });
          // CST4: the blocked call is constrained by the rule that stopped it.
          // The tool-call node for a failed call is published by the caller, so
          // the edge's source exists once the call settles; a conflict is the
          // only check worth an edge (a pass-through rule is not news).
          publish(
            constitutionCheckEdge({
              turnID,
              callID,
              ruleID: entry.ruleID,
            }),
          );
          blocked = `blocked by constitution: ${entry.statement}. Use terminal.kill or terminal.close instead.`;
          break;
        }
    }

    for (const rule of rules) {
      if (rule.enforcement === "deny" || rule.enforcement === "warn") {
        publish({
          type: "constitution.check",
          id: `${turnID}:constitution:${rule.ruleID.toLowerCase()}`,
          ruleID: rule.ruleID,
          statement: rule.statement,
          priority: rule.priority,
          enforcement: rule.enforcement,
          action: toolAction,
          resource: toolResource,
          conflict: false,
        });
      }
    }
    return blocked;
  }

  async function executeOneTool(
    turnID: string,
    call: ProviderToolCall,
    tool: RuntimeTool,
  ) {
    // D2: same shadowing as `executeToolCalls` — this segment's events and
    // ledger belong to the turn's session.
    const exec =
      executionBySession.get(turnSession.get(turnID) ?? sessionID) ??
      activeExec;
    const publish = (event: RuntimeEvent) => publishForSession(exec, event);
    const execContext = exec?.context ?? runtimeContext;
    const toolID = `${turnID}:${call.id}`;
    const dedupKey = `${call.name}\u0000${call.arguments}`;
    const occurrences = (toolCalls.get(dedupKey) ?? 0) + 1;
    toolCalls.set(dedupKey, occurrences);
    if (occurrences > 12 && !WAITING_TOOLS.has(tool.name)) {
      const message = `blocked repeated tool call after ${occurrences} identical attempts: ${tool.name}`;
      publish({
        type: "tool.update",
        id: toolID,
        name: tool.name,
        callID: call.id,
        status: "failed",
        summary: message,
        result: message,
        endedAt: Date.now(),
      });
      publishWorkGraphToolCall(turnID, call.id, tool.name, "failed");
      return `ERROR: ${message}`;
    }
    const hookEvent: ToolHookEvent = {
      turnID,
      toolName: tool.name,
      toolCallID: call.id,
      arguments: call.arguments,
    };
    const preResult = await toolLayer.preExecute(hookEvent);
    for (const diagnostic of preResult.diagnostics) {
      publish({
        type: "diagnostic",
        level: "info",
        message: diagnostic,
      });
    }
    if (!preResult.allowed) {
      if (preResult.clearTerminal) {
        const terminalID = tryParseToolArguments(call.arguments).id;
        if (typeof terminalID === "string") {
          try {
            await terminalController.get()?.write(terminalID, "\x15");
            publish({
              type: "diagnostic",
              level: "warning",
              message: `cleared blocked terminal command buffer for ${terminalID}`,
            });
          } catch (error) {
            publish({
              type: "diagnostic",
              level: "warning",
              message: `could not clear blocked terminal command buffer for ${terminalID}: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }
      }
      publish({
        type: "policy.decision",
        turnID,
        toolName: tool.name,
        toolCallID: call.id,
        decision: "deny",
        reason: preResult.diagnostics.join("; "),
      });
      publish({
        type: "tool.update",
        id: toolID,
        name: tool.name,
        callID: call.id,
        status: "failed",
        summary: preResult.diagnostics.join("; "),
        result: preResult.diagnostics.join("; "),
        endedAt: Date.now(),
      });
      publishWorkGraphToolCall(turnID, call.id, tool.name, "failed");
      return `ERROR: ${preResult.diagnostics.join("; ")}`;
    }
    if (permissionMode === "read_only" && tool.requiresApproval) {
      const message = readOnlyToolMessage(tool.name);
      publish({
        type: "policy.decision",
        turnID,
        toolName: tool.name,
        toolCallID: call.id,
        decision: "deny",
        reason: message,
      });
      publish({
        type: "tool.update",
        id: toolID,
        name: tool.name,
        callID: call.id,
        status: "rejected",
        summary: message,
        result: message,
        endedAt: Date.now(),
      });
      publishWorkGraphToolCall(turnID, call.id, tool.name, "rejected");
      return `ERROR: ${message}`;
    }
    publish({
      type: "tool.update",
      id: toolID,
      name: tool.name,
      callID: call.id,
      status: tool.requiresApproval ? "awaiting_approval" : "queued",
      summary: tool.requiresApproval ? "awaiting approval" : "queued",
      argumentsDelta: call.arguments,
    });
    publish({
      type: "policy.decision",
      turnID,
      toolName: tool.name,
      toolCallID: call.id,
      decision: tool.requiresApproval ? "approval_required" : "allow",
    });
    const blocked = checkConstitutionForTool(
      turnID,
      call.id,
      tool.name,
      tool.name,
      // `write`/`apply_patch` were named here but no such tools exist — the real
      // ones are `write_file`/`edit_file`, so this always fell through to
      // "global" and a path-scoped constitution rule could never match. Latent
      // rather than exploited, because constitution rules still have no writer.
      workspaceWritePathForTool(
        tool.name,
        tryParseToolArguments(call.arguments),
      ) ?? "global",
      commandTextForTool(tool.name, tryParseToolArguments(call.arguments)),
    );
    if (blocked) {
      publish({
        type: "tool.update",
        id: toolID,
        name: tool.name,
        callID: call.id,
        status: "failed",
        summary: blocked,
        argumentsDelta: call.arguments,
      });
      publishWorkGraphToolCall(turnID, call.id, tool.name, "failed");
      return blocked;
    }
    if (tool.requiresApproval) {
      const refusal = await interactive.requireApproval(
        toolID,
        tool,
        call,
        turnID,
      );
      if (refusal) {
        // Reported like a policy denial: the call did not run, the turn keeps
        // going, and the model receives the reason as this call's result.
        publish({
          type: "tool.update",
          id: toolID,
          name: tool.name,
          callID: call.id,
          status: "rejected",
          summary: refusal.reason,
          result: refusal.reason,
          endedAt: Date.now(),
        });
        publishWorkGraphToolCall(turnID, call.id, tool.name, "rejected");
        await toolLayer.postExecute({ ...hookEvent, error: refusal.reason });
        return `ERROR: ${refusal.reason}`;
      }
    }
    await waitIfPaused();
    publish({
      type: "tool.update",
      id: toolID,
      name: tool.name,
      callID: call.id,
      status: "running",
      summary: "running",
      startedAt: Date.now(),
      // The call card, when the tool declares one: the tool says what the call
      // means (a file path, a command) without leaking raw arguments.
      metadata: tool.output?.presentCall
        ? {
            call: tool.output.presentCall(
              tryParseToolArguments(call.arguments),
            ),
          }
        : undefined,
    });
    let executionAudited = false;
    let releaseWriteLock: (() => void) | undefined;
    try {
      const parsed = parseToolArguments(call.arguments);
      const paramErrors = validateToolParameters(tool.parameters, parsed);
      if (paramErrors.length) {
        const detail = paramErrors
          .map((e) => `${e.path}: ${e.message}`)
          .join("; ");
        throw new Error(
          `tool "${tool.name}" parameter validation failed: ${detail}`,
        );
      }
      await setInFlightOperation({
        kind: "tool_execution",
        turnID,
        toolName: tool.name,
        toolCallID: call.id,
        startedAt: new Date().toISOString(),
      });
      executionAudited = true;
      const executionController = new AbortController();
      // The cancellation listener binds the turn's own exec, not the activity
      // closure: a background turn's tool must stop when its session is
      // cancelled, never when the attached session is.
      const cancelExecution = () =>
        executionController.abort(
          exec?.activeAbort?.signal.reason ?? new Error("tool cancelled"),
        );
      const execSignal = exec?.activeAbort?.signal;
      // A cancellation that already happened must not be missed. `running` is
      // published before the durable in-flight write above, so a cancel can land
      // while that write is in flight — and `addEventListener("abort")` never
      // fires for an already-aborted signal. Without this check the tool ran on
      // until its own timeout (or forever, when it declares none) even though the
      // turn was cancelled.
      if (execSignal?.aborted) cancelExecution();
      else
        execSignal?.addEventListener("abort", cancelExecution, { once: true });
      const timeoutTimer = tool.timeoutSec
        ? setTimeout(
            () =>
              executionController.abort(
                new Error(
                  `tool ${tool.name} timed out after ${tool.timeoutSec}s`,
                ),
              ),
            tool.timeoutSec * 1000,
          )
        : undefined;
      const signal = executionController.signal;
      // D2: workspace writes serialise across sessions. A background turn's
      // write waits for the attached session's write (and vice versa), so two
      // turns can never interleave edits to the same workspace.
      releaseWriteLock = workspaceWritePathForTool(
        tool.name,
        parsed as Record<string, unknown>,
      )
        ? await workspaceWriteLock.acquire()
        : undefined;
      // WG4 Phase 3: register the expected mutation before the tool runs so the
      // auditor can attribute a watcher-confirmed change to this call. Only
      // workspace-writing tools register; the authorized path is the tool's own
      // path argument (the same scope the write lock protects).
      const writePath = workspaceWritePathForTool(
        tool.name,
        parsed as Record<string, unknown>,
      );
      if (writePath) {
        mutationRegistry.register({
          sessionID,
          turnID,
          callID: call.id,
          toolName: tool.name,
          authorizedPaths: [writePath],
          expectedOperations: ["modified", "added", "deleted", "renamed"],
        });
      }
      const completeResult = await waitForToolExecution(
        tool.execute(parsed, {
          workspaceRoot,
          signal,
          askQuestion: async (question) =>
            await interactive.requireQuestion(
              `${toolID}:question`,
              turnID,
              question,
            ),
          subagents: subagentsController.get(),
          nativeTerminal: terminalController.get(),
          sandboxes: sandboxController.get(),
          workspaceReadAuthorize: authorizeWorkspaceRead,
          sandboxMergeAuthorize: authorizeSandboxMerge,
          settings: toolSettings(),
          // The turn's own session, not the attached one: a background turn's
          // subagents and terminal starts belong to its session (I1/I3).
          parentSessionID: exec?.session.id ?? sessionID,
          maxSubagentDepth: tsRuntimeConfig?.runtime.subagentDepth,
          onSandboxEvent: (event) => {
            const update = event as Extract<
              RuntimeEvent,
              { type: "sandbox.update" }
            >;
            publish(update);
            if (
              sandboxResourcesByID.get(update.id) !== update.runningResources
            ) {
              sandboxResourcesByID.set(update.id, update.runningResources);
              scheduleRuntimeStatusSnapshot();
            }
          },
          onWorkspaceChange: (changes) => {
            // WG4 Phase 3: the tool settled successfully — the expected
            // mutation stops matching unrelated later hints, but its identity
            // stays available for attributing the change it caused.
            mutationRegistry.settle(call.id);
            for (const change of changes) {
              publish(
                workspaceChangeNode({
                  turnID,
                  path: change.path,
                  toolName: tool.name,
                  sessionID,
                }),
              );
              publish(
                workspaceChangeEdge({
                  turnID,
                  callID: call.id,
                  path: change.path,
                }),
              );
            }
          },
        }),
        signal,
      ).finally(() => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        exec?.activeAbort?.signal.removeEventListener("abort", cancelExecution);
      });
      const bounded = await boundToolOutput(
        workspaceRoot,
        redactToolOutput(completeResult, redactToolOutputEnabled()),
      );
      const result = bounded.text;
      // The tool's own output projection becomes part of the event metadata, so
      // a client can draw the result as the card the tool described instead of
      // guessing from the string.
      const projectedRender = tool.output?.presentResult(
        tryParseToolArguments(call.arguments),
        result,
      );
      if (options.taskModuleContext && tool.name !== "flow_module_complete") {
        options.taskModuleContext.store.recordModuleEvidence({
          invocationID: options.taskModuleContext.invocationID,
          attempt: options.taskModuleContext.attempt,
          flowID: options.taskModuleContext.flowID,
          moduleID: options.taskModuleContext.moduleID,
          ref: `tool:${call.id}`,
          tool: tool.name,
        });
      }
      if (
        tool.name === "interactive_terminal_start" ||
        tool.name === "interactive_terminal_stop"
      ) {
        const terminalID = (parsed as Record<string, unknown>).id;
        if (typeof terminalID === "string")
          terminalCommandBuffer.clear(terminalID);
      }
      publish({
        type: "tool.update",
        id: toolID,
        name: tool.name,
        callID: call.id,
        status: "succeeded",
        summary: result.slice(0, 200),
        result,
        metadata: {
          ...(bounded.outputPath ? { outputPath: bounded.outputPath } : {}),
          ...(projectedRender ? { render: projectedRender } : {}),
        },
        endedAt: Date.now(),
      });
      publishWorkGraphToolCall(turnID, call.id, tool.name, "succeeded");
      // Only after success: a write that failed did not change the workspace, and
      // a graph that says otherwise sends a reader looking for a change that is
      // not there.
      const changedPath = workspaceWritePathForTool(
        tool.name,
        tryParseToolArguments(call.arguments),
      );
      if (changedPath) {
        publish(
          workspaceChangeNode({
            turnID,
            path: changedPath,
            toolName: tool.name,
            sessionID,
          }),
        );
        publish(
          workspaceChangeEdge({ turnID, callID: call.id, path: changedPath }),
        );
      }
      if (isManagedResourceTool(tool.name)) scheduleRuntimeStatusSnapshot();
      // TERM-M.3 (c): request_human with endTurn=true ends the current turn as
      // waiting_human; the runtime resumes with a new turn once the human
      // releases the pane.
      if (tool.name === "interactive_terminal_request_human") {
        const requestArgs = tryParseToolArguments(call.arguments) as {
          id?: unknown;
          reason?: unknown;
          endTurn?: unknown;
        };
        if (
          requestArgs?.endTurn === true &&
          typeof requestArgs.id === "string" &&
          typeof requestArgs.reason === "string"
        ) {
          const marker = {
            terminalID: requestArgs.id,
            reason: requestArgs.reason,
          };
          if (exec) exec.endTurnWaitingHuman = marker;
          else endTurnWaitingHuman = marker;
        }
      }
      await toolLayer.postExecute({ ...hookEvent, result });
      return result;
    } catch (error) {
      // WG4 Phase 3: a failed write did not change the workspace — drop the
      // expected mutation so it cannot attribute a later unrelated hint.
      if (
        workspaceWritePathForTool(
          tool.name,
          tryParseToolArguments(call.arguments),
        )
      )
        mutationRegistry.forget(call.id);
      const message = error instanceof Error ? error.message : String(error);
      publish({
        type: "tool.update",
        id: toolID,
        name: tool.name,
        callID: call.id,
        status: "failed",
        summary: message,
        result: message,
        endedAt: Date.now(),
      });
      // A failed call is as much a fact as a successful one; the error text stays
      // out of the graph.
      publishWorkGraphToolCall(turnID, call.id, tool.name, "failed");
      await toolLayer.postExecute({ ...hookEvent, error: message });
      return `ERROR: ${message}`;
    } finally {
      releaseWriteLock?.();
      if (executionAudited) await setInFlightOperation(undefined);
    }
  }

  /**
   * Resolves the approval for one tool call.
   *
   * A refusal is a decision about this call, not a failure of the turn, so it
   * is returned as a reason for the caller to hand back to the model. Only a
   * cancellation or a timeout still throws, because in those cases there is no
   * decision to act on. Returning instead of throwing is what lets the model
   * read why it was refused and choose a different approach.
   */
  async function authorizeSandboxMerge(input: { id: string; paths: string[] }) {
    for (const path of input.paths) {
      const hookEvent: ToolHookEvent = {
        turnID: activeTurnID ?? `sandbox:${sessionID}`,
        toolName: "sandbox_merge",
        toolCallID: `sandbox:${input.id}:${path}`,
        arguments: JSON.stringify({ id: input.id, path }),
      };
      const preResult = await toolLayer.preExecute(hookEvent);
      for (const diagnostic of preResult.diagnostics)
        publish({ type: "diagnostic", level: "info", message: diagnostic });
      if (!preResult.allowed)
        throw new Error(
          `sandbox merge denied for "${path}": ${preResult.diagnostics.join("; ")}`,
        );
    }
  }

  async function authorizeSandboxManagement(
    toolName: "sandbox_merge" | "sandbox_delete" | "sandbox_resource_stop",
    arguments_: Record<string, string>,
  ) {
    const hookEvent: ToolHookEvent = {
      turnID: activeTurnID ?? `sandbox:${sessionID}`,
      toolName,
      toolCallID: `sandbox:manage:${toolName}:${arguments_.id}`,
      arguments: JSON.stringify(arguments_),
    };
    const result = await toolLayer.preExecute(hookEvent);
    for (const diagnostic of result.diagnostics)
      publish({ type: "diagnostic", level: "info", message: diagnostic });
    if (!result.allowed)
      throw new Error(
        `${toolName} denied: ${result.diagnostics.join("; ") || "runtime policy denied operation"}`,
      );
  }

  async function authorizeWorkspaceRead(input: {
    toolName: "glob" | "grep";
    paths: string[];
  }) {
    for (const path of input.paths) {
      const permission = evaluatePermissionRules(
        selectedAgent?.permissions,
        input.toolName,
        { path },
        workspaceRoot,
      );
      if (permission.allowed) continue;
      for (const diagnostic of permission.diagnostics)
        publish({ type: "diagnostic", level: "info", message: diagnostic });
      throw new Error(
        `${input.toolName} denied for "${path}": ${permission.diagnostics.join("; ")}`,
      );
    }
  }

  async function waitIfPaused() {
    while (paused) {
      await new Promise<void>((resolveWaiter) => {
        pauseWaiters.push(resolveWaiter);
      });
    }
  }

  function toolSettings() {
    const profileNetwork = selectedPermissionProfile?.permissions?.network;
    const agentNetwork = selectedAgent?.permissions?.network;
    const effectiveNetwork = agentNetwork ?? profileNetwork;
    const agentAllowedHosts = agentNetwork?.allowedHosts.length
      ? agentNetwork.allowedHosts
      : tsRuntimeConfig?.network.allowedHosts;
    const allowedHostGroups = [
      profileNetwork?.allowedHosts,
      agentAllowedHosts,
    ].filter((hosts): hosts is string[] => Boolean(hosts?.length));
    const base = {
      webSearchEndpoint: tsRuntimeConfig?.webSearch.endpoint ?? undefined,
      webSearchProviderPriority: tsRuntimeConfig?.webSearch.providerPriority,
      browserEnabled: tsRuntimeConfig?.browser.enabled,
      browserBinary: tsRuntimeConfig?.browser.binary || undefined,
      browserUserAgent: tsRuntimeConfig?.browser.userAgent || undefined,
      browserHeaders: tsRuntimeConfig?.browser.headers,
      browserPersistentProfile: tsRuntimeConfig?.browser.persistentProfile,
      browserProfileDir: tsRuntimeConfig?.browser.profileDir || undefined,
      browserLocale: tsRuntimeConfig?.browser.locale || undefined,
      browserTimezone: tsRuntimeConfig?.browser.timezone || undefined,
      allowedHosts: agentAllowedHosts,
      allowedHostGroups: allowedHostGroups.length
        ? allowedHostGroups
        : undefined,
      allowedSchemes: tsRuntimeConfig?.network.allowedSchemes,
      deniedHosts: [
        ...(profileNetwork?.denyHosts ?? []),
        ...(agentNetwork?.denyHosts ?? []),
      ],
      allowLocalhost:
        profileNetwork?.allowLocalhost === false ||
        agentNetwork?.allowLocalhost === false
          ? false
          : (effectiveNetwork?.allowLocalhost ??
            tsRuntimeConfig?.network.allowLocalhost),
      allowPrivate:
        profileNetwork?.allowPrivate === false ||
        agentNetwork?.allowPrivate === false
          ? false
          : (effectiveNetwork?.allowPrivate ??
            tsRuntimeConfig?.network.allowPrivate),
      envAllowlist:
        selectedAgent?.permissions?.env?.allowlist ??
        tsRuntimeConfig?.security.envAllowlist,
    };
    // The `settings` grant's first host consumer: capability contributions
    // provide defaults that explicit config and permission values override.
    return mergeContributedToolSettings(base, [
      ...(workspaceCapabilityView?.contributions("settings") ?? []),
      ...capabilityRegistry.contributions("settings"),
    ]);
  }
}

function contextStatusConfig(config?: {
  context: {
    compactionThresholdPercent: number;
    reservedOutputTokens: "auto" | number;
  };
  models: Record<string, { contextWindow: "auto" | number }>;
  defaultModel: string;
}) {
  const model = config?.models[config.defaultModel];
  return {
    max:
      model?.contextWindow === "auto" || model?.contextWindow === undefined
        ? Number(process.env.NATALIA_CONTEXT_WINDOW ?? 200000)
        : model.contextWindow,
    thresholdPercent:
      config?.context.compactionThresholdPercent ??
      Number(process.env.NATALIA_CONTEXT_THRESHOLD ?? 85),
    reserved:
      config?.context.reservedOutputTokens === "auto" ||
      config?.context.reservedOutputTokens === undefined
        ? Number(process.env.NATALIA_CONTEXT_RESERVED ?? 8192)
        : config.context.reservedOutputTokens,
  };
}

function redactToolOutput(output: string, redact: boolean | undefined) {
  if (!redact) return output;
  return output.replace(
    /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s]+/giu,
    (match) =>
      `${match.slice(0, match.indexOf("=") >= 0 ? match.indexOf("=") + 1 : match.indexOf(":") + 1)}[REDACTED]`,
  );
}

/**
 * Runs a validation command with the workspace as cwd and bounded, redacted
 * output. The redaction is unconditional for validation output (a validation
 * run's output may carry secrets the model's own redaction config would not
 * catch), and the captured output is capped so a chatty runner cannot grow the
 * returned summary without limit. This is the E2 "redaction" half of the
 * validation-runner adapter: secrets are stripped here, before anything reaches
 * `evidence.recorded`.
 */
async function runValidationCommand(
  command: string,
  cwd: string,
  timeoutSec: number,
): Promise<{ exitCode: number; safeSummary: string }> {
  const process = Bun.spawn(["/bin/bash", "-c", command], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const timer = setTimeout(
    () => {
      try {
        process.kill();
      } catch {
        // already gone
      }
    },
    Math.max(1, timeoutSec) * 1000,
  );
  const [stdout, stderr] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]);
  await process.exited;
  clearTimeout(timer);
  const exitCode = process.exitCode ?? 0;
  const combined = `${stdout}\n${stderr}`.slice(0, 4000);
  const safeSummary = redactToolOutput(combined.trim(), true).slice(0, 2000);
  return { exitCode, safeSummary };
}

function waitForToolExecution<T>(execution: Promise<T>, signal?: AbortSignal) {
  if (!signal) return execution;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error("tool cancelled"));
    signal.addEventListener("abort", abort, { once: true });
    execution.then(
      (result) => {
        signal.removeEventListener("abort", abort);
        resolve(result);
      },
      (error) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

function isManagedResourceTool(toolName: string) {
  return [
    "process_start",
    "process_stop",
    "process_restart",
    "background_start",
    "background_stop",
    "background_restart",
  ].includes(toolName);
}

/**
 * Rebuilds a context ledger from a session's durable events. Used when a
 * session's exec is created (attach, background work) and at startup.
 */
function restoreContextFromEvents(
  context: ContextLedger,
  events: RuntimeEvent[],
) {
  const assistantByID = new Map<string, string>();
  const recordedCalls = new Set<string>();
  const recordedResults = new Set<string>();
  for (const event of events) {
    if (event.type === "turn.submitted") {
      context.add({
        id: `${event.id}:user`,
        role: "user",
        content: event.text,
        attachments: event.attachments,
      });
      continue;
    }
    if (event.type === "content.delta") {
      assistantByID.set(
        event.id,
        `${assistantByID.get(event.id) ?? ""}${event.text}`,
      );
      continue;
    }
    if (event.type === "content.done" && event.text !== undefined) {
      assistantByID.set(event.id, event.text);
      continue;
    }
    if (
      event.type === "tool.update" &&
      event.callID &&
      !recordedCalls.has(event.callID) &&
      (event.status === "receiving_arguments" ||
        event.status === "queued" ||
        event.status === "awaiting_approval")
    ) {
      recordedCalls.add(event.callID);
      context.add({
        id: `restore:${event.id}:call`,
        role: "tool_call",
        content: `${event.name} ${event.argumentsDelta ?? "{}"}`,
        pairID: event.callID,
      });
      continue;
    }
    if (
      event.type === "tool.update" &&
      event.callID &&
      !recordedResults.has(event.callID) &&
      ["succeeded", "failed", "rejected", "cancelled"].includes(event.status)
    ) {
      recordedResults.add(event.callID);
      context.add({
        id: `restore:${event.id}:result`,
        role: "tool_result",
        content:
          event.result ??
          (event.status === "succeeded"
            ? event.summary
            : `ERROR: ${event.summary}`),
        pairID: event.callID,
      });
      continue;
    }
    if (event.type === "turn.finished") {
      const content = assistantByID.get(event.id);
      if (content?.trim()) {
        context.add({
          id: `${event.id}:assistant`,
          role: "assistant",
          content,
        });
        assistantByID.delete(event.id);
      }
    }
  }
}

function referencedAttachments(
  sessions: Array<import("@natalia/session").SessionRecord>,
) {
  return sessions.flatMap((record) => {
    const checkpoint = [...record.events]
      .reverse()
      .find((event) => event.type === "context.checkpoint");
    const checkpointAttachments =
      checkpoint?.type === "context.checkpoint"
        ? checkpoint.snapshot.entries.flatMap(
            (entry) => entry.attachments ?? [],
          )
        : [];
    return [
      ...checkpointAttachments,
      ...modelVisibleEvents(record.events).flatMap((event) =>
        event.type === "turn.submitted" ? (event.attachments ?? []) : [],
      ),
      ...(record.inbox?.flatMap((input) => input.attachments ?? []) ?? []),
    ];
  });
}

function sessionSeed(workspaceRoot: string) {
  return createHash("sha256").update(workspaceRoot).digest("hex").slice(0, 12);
}

function lineCount(text: string) {
  return text.length === 0 ? 0 : text.split(/\r\n|\r|\n/u).length;
}
