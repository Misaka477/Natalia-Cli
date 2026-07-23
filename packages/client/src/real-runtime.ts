import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  runtimeEventDurability,
  runtimeSlashCommands,
} from "@natalia/contracts";
import {
  findWorkspaceFiles,
  globWorkspaceFiles,
  listWorkspaceFiles,
  readWorkspaceFile,
  searchWorkspaceFiles,
  watchWorkspaceFiles,
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
  CheckpointStore,
  ContextLedger,
  compactContext,
  contextStatusEvent,
  contextEntriesToProviderMessages,
  providerError,
  providerFromKind,
  providerFromLegacyGoConfig,
  type ProviderMessage,
  type ProviderToolCall,
  providerFromEnvironment,
  runWithRetry,
  runCheckpointCommand,
  type StreamingProvider,
  providerCompactor,
} from "@natalia/runtime";
import { modelSelectionStatus, resolveConfig } from "@natalia/config";
import type { ConfigV2 } from "@natalia/contracts";
import {
  agentsFromConfig,
  type AgentDefinition,
  type AgentRegistry,
} from "@natalia/agent";
import {
  appendSessionEvent,
  JsonSessionStore,
  SqliteSessionStore,
  admitInput,
  admissionCutoff,
  admittedInputs,
  promoteNextQueued,
  promoteSteers,
  projectInteractiveRequests,
  projectSession,
  modelVisibleEvents,
  sessionRunCoordinator,
  type SessionRecord,
} from "@natalia/session";
import {
  createToolRegistry,
  boundToolOutput,
  cleanupToolOutput,
  materializeTools,
  validateToolParameters,
  ManagedProcessRegistry,
  type RuntimeTool,
  type ToolMaterialization,
  type ToolRegistry,
} from "@natalia/tools";
import {
  authorizeSkillTool,
  createSkillLoadTool,
  discoverSkills,
  readSkillResource,
  runSkillScript,
  type Skill,
  type SkillRegistry,
} from "@natalia/skills";
import { SubagentRegistry } from "@natalia/subagent";
import { InteractivePTYRegistry } from "@natalia/pty";
import { WorkspaceSandboxManager } from "@natalia/sandbox";
import { loadLegacyMCPTools, loadNativeMCPTools } from "@natalia/mcp";
import { createPluginRegistry, loadLocalPlugins } from "@natalia/plugin";
import {
  createToolPolicyHookLayer,
  evaluatePermissionRules,
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

const sqliteStores = new Map<string, SqliteSessionStore>();

export type RealRuntimeClientOptions = {
  sessionID?: SessionID;
  title?: string;
  workspaceRoot?: string;
  sessionDir?: string;
  useSqliteStore?: boolean;
  provider?: StreamingProvider;
  tools?: ToolRegistry;
  permissionMode?: "ask" | "auto" | "read_only";
  legacyConfigPath?: string;
  toolPolicy?: ToolPolicy;
  hooks?: ToolHooks;
};

export function createRealRuntimeClient(
  options: RealRuntimeClientOptions = {},
): RuntimeClient {
  let workspaceRoot = resolve(options.workspaceRoot ?? process.cwd());
  let sessionID: SessionID;
  let sessionStore: JsonSessionStore;
  let sqliteStore: SqliteSessionStore | undefined;
  let provider = options.provider ?? providerFromEnvironment();
  let providerSource:
    | "explicit"
    | "environment"
    | "ts_config"
    | "legacy_go_config"
    | "unconfigured" = options.provider
    ? "explicit"
    : provider
      ? "environment"
      : "unconfigured";
  const processRegistry = options.tools
    ? undefined
    : new ManagedProcessRegistry();
  const tools = options.tools ?? createToolRegistry(undefined, processRegistry);
  let agentToolLayer = createToolPolicyHookLayer();
  const toolLayer = createToolPolicyHookLayer(options.toolPolicy, {
    preExecute: async (event) => {
      const agentResult = await agentToolLayer.preExecute(event);
      if (!agentResult.allowed) return agentResult;
      const permission = evaluatePermissionRules(
        selectedAgent?.permissions,
        event.toolName,
        tryParseToolArguments(event.arguments),
      );
      if (!permission.allowed) return permission;
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
  let maxSteps = 10;
  let subagents: SubagentRegistry | undefined;
  let interactivePTY: InteractivePTYRegistry | undefined;
  let sandboxes: WorkspaceSandboxManager | undefined;
  let plugins: ReturnType<typeof createPluginRegistry> | undefined;
  const cleanupMCP: Array<() => Promise<void>> = [];
  const mcpAccess: Array<{
    catalog(): Promise<import("@natalia/contracts").MCPCatalogSnapshot>;
    getPrompt(
      server: string,
      name: string,
      arguments_?: Record<string, string>,
    ): Promise<unknown>;
    readResource(server: string, uri: string): Promise<unknown>;
  }> = [];
  const toolCalls = new Map<string, number>();
  const context = new ContextLedger();
  const pendingApprovals = new Map<string, ApprovalResponse>();
  const pendingApprovalRequests = new Set<string>();
  const approvalWaiters = new Map<
    string,
    (response: ApprovalResponse) => void
  >();
  const pendingQuestions = new Map<string, QuestionResponse>();
  const questionWaiters = new Map<
    string,
    (response: QuestionResponse) => void
  >();
  let sink: ((event: RuntimeEvent) => void) | undefined;
  let session: SessionRecord | undefined;
  let checkpointStore: CheckpointStore | undefined;
  let lastSubmitted: SubmittedTurn | undefined;
  let activeAbort: AbortController | undefined;
  let activeTurnID: string | undefined;
  let paused = false;
  let pauseWaiters: Array<() => void> = [];
  let ready: Promise<void> | undefined;
  let skillRegistry: SkillRegistry | undefined;
  let activeSkill: Skill | undefined;
  const attachmentReferences = new Map<
    string,
    import("@natalia/contracts").LocalAttachment[]
  >();
  const runtimeDiagnostics: Array<
    Extract<RuntimeEvent, { type: "diagnostic" }> & { at: string }
  > = [];
  let selectedAgent: AgentDefinition | undefined;
  let selectedModel: { modelID?: string; variant?: string } | undefined;
  let pendingAgent: AgentDefinition | undefined;
  let agentRegistry: AgentRegistry | undefined;
  let lastProviderUsage:
    | { inputTokens: number; outputTokens: number }
    | undefined;
  let sessionPersistence = Promise.resolve();
  let tsRuntimeConfig:
    | Awaited<ReturnType<typeof resolveConfig>>["config"]
    | undefined;
  let runtimeContextConfig = contextStatusConfig();
  let retryPolicy: NonNullable<Parameters<typeof runWithRetry>[2]>["policy"];
  let cleanupWorkspaceFiles: (() => void) | undefined;
  let statusRefreshQueued = false;
  const ptyStatusByID = new Map<string, string>();
  const sandboxResourcesByID = new Map<string, number>();
  const turnCoordinator = () => sessionRunCoordinator(sessionID);

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
      if (!options.permissionMode) {
        const permission =
          tsConfig.config.permissionProfiles[tsConfig.config.defaultPermission];
        if (permission) permissionMode = permission.approval;
        const mode = tsConfig.config.modes[tsConfig.config.defaultMode];
        const modePermission = mode?.permission
          ? tsConfig.config.permissionProfiles[mode.permission]
          : undefined;
        if (modePermission) permissionMode = modePermission.approval;
      }
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
          maxSteps = tsConfig.config.runtime.maxStepsPerTurn;
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
              "TS config has no complete provider/model/API-key selection; trying environment and legacy discovery.",
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
    }
    if (!provider && process.env.NATALIA_LEGACY_FALLBACK) {
      // Legacy Go config fallback: only when explicit env var is set
      const legacy = await providerFromLegacyGoConfig({
        configPath:
          options.legacyConfigPath ?? process.env.NATALIA_LEGACY_CONFIG_PATH,
      });
      if (legacy.status === "found") {
        provider = legacy.provider;
        providerSource = "legacy_go_config";
        if (!options.workspaceRoot && legacy.profile.workDir)
          workspaceRoot = resolve(legacy.profile.workDir);
        if (
          !options.permissionMode &&
          legacy.profile.autoApprove === "just_do_it"
        )
          permissionMode = "auto";
        if (legacy.profile.maxSteps && legacy.profile.maxSteps > 0)
          maxSteps = legacy.profile.maxSteps;
        publish({
          type: "diagnostic",
          level: "info",
          message: `Loaded active provider settings from legacy Go config at ${legacy.configPath}; API key remains in memory only.`,
        });
      } else if (legacy.status === "invalid") {
        publish({
          type: "diagnostic",
          level: "warning",
          message: `Legacy Go provider config was not used: ${legacy.message}`,
        });
      }
    }
    cleanupWorkspaceFiles = await watchWorkspaceFiles(
      workspaceRoot,
      () => undefined,
    ).catch(() => undefined);
    sessionID =
      options.sessionID ?? (`ses_${sessionSeed(workspaceRoot)}` as SessionID);
    sessionStore = new JsonSessionStore(
      options.sessionDir ?? join(workspaceRoot, ".natalia", "sessions"),
    );
    if (options.useSqliteStore) {
      const databasePath = join(workspaceRoot, ".natalia", "sessions.db");
      await mkdir(dirname(databasePath), { recursive: true });
      sqliteStore = sqliteStores.get(databasePath);
      if (!sqliteStore) {
        sqliteStore = new SqliteSessionStore(databasePath);
        sqliteStores.set(databasePath, sqliteStore);
      }
      sqliteStore.create(
        sessionID,
        options.title ?? `Natalia TS session ${sessionID}`,
      );
    }
    subagents = new SubagentRegistry({
      workDir: workspaceRoot,
      runner: async (task, runner) => {
        if (!provider) throw new Error("provider unavailable for subagent");
        const record = subagents?.get(runner.agentId);
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
        for (let step = 1; step <= Math.min(maxSteps, 20); step++) {
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
            if (tool.requiresApproval)
              await requireApproval(toolID, tool, call);
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
                await requireQuestion(`${toolID}:question`, question),
              subagents,
              interactivePTY,
              sandboxes,
              settings: toolSettings(),
              parentSessionID: sessionID,
              parentAgentID: runner.agentId,
              maxSubagentDepth: tsRuntimeConfig?.runtime.subagentDepth,
              onWorkflowEvent: (event) =>
                publish({ type: "workflow.update", ...event }),
              workflowAuthorize: authorizeWorkflowStep,
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
      },
    });
    await subagents.load();
    subagents.subscribe((event) => {
      const record = subagents?.get(event.agentId);
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
    if (tsRuntimeConfig) {
      const nativeMCP = await loadNativeMCPTools({
        registry: tools,
        servers: tsRuntimeConfig.mcpServers,
        workspaceRoot,
        onDiagnostic: (message) =>
          publish({ type: "diagnostic", level: "info", message }),
      });
      cleanupMCP.push(nativeMCP.close);
      mcpAccess.push(nativeMCP);
      for (const [server, status] of Object.entries(nativeMCP.statuses))
        publish({ type: "mcp.status", server, ...status });
      if (nativeMCP.loaded)
        publish({
          type: "diagnostic",
          level: "info",
          message: `Loaded ${nativeMCP.loaded} native MCP tool(s) from TS config.`,
        });
    }
    const mcp = await loadLegacyMCPTools({
      registry: tools,
      configPath:
        options.legacyConfigPath ?? process.env.NATALIA_LEGACY_CONFIG_PATH,
      workspaceRoot,
      onDiagnostic: (message: string) =>
        publish({ type: "diagnostic", level: "info", message }),
    });
    cleanupMCP.push(mcp.close);
    mcpAccess.push(mcp);
    for (const [server, status] of Object.entries(mcp.statuses))
      publish({ type: "mcp.status", server, ...status });
    if (mcp.loaded > 0)
      publish({
        type: "diagnostic",
        level: "info",
        message: `Loaded ${mcp.loaded} native MCP tool(s) from legacy Go config without launching Go runtime.`,
      });
    plugins = createPluginRegistry({
      tools,
      readOnly: tsRuntimeConfig?.plugins.readOnly,
      onAudit: (entry) =>
        publish({
          type: "plugin.update",
          id: entry.pluginID,
          status: entry.action,
          detail: entry.detail,
        }),
    });
    await loadLocalPlugins({
      roots: [
        join(workspaceRoot, ".natalia", "plugins"),
        ...(tsRuntimeConfig?.plugins.paths.map((path) =>
          resolve(workspaceRoot, path),
        ) ?? []),
      ],
      registry: plugins,
      enabled: tsRuntimeConfig?.plugins.enabled,
      capabilities: tsRuntimeConfig?.plugins.capabilities,
      onError: (id, error) =>
        publish({
          type: "diagnostic",
          level: "warning",
          message: `plugin ${id} failed to load: ${error instanceof Error ? error.message : String(error)}`,
        }),
    });
    interactivePTY = new InteractivePTYRegistry(
      join(workspaceRoot, ".natalia", "pty", "interactive"),
    );
    sandboxes = new WorkspaceSandboxManager(
      join(workspaceRoot, ".natalia", "sandboxes"),
    );
    await sandboxes.initialize();
    session = await sessionStore.loadOrCreate(
      sessionID,
      options.title ?? `Natalia TS session ${sessionID}`,
    );
    if (sqliteStore) {
      const durable = sqliteStore.get(sessionID);
      const events = sqliteStore.loadEvents(sessionID);
      if (durable && events.length > session.events.length) {
        session = {
          ...session,
          title: durable.title,
          createdAt: durable.createdAt,
          cancelled: durable.cancelled,
          resumable: durable.resumable,
          metadata: durable.metadata,
          events,
        };
        await sessionStore.save(session);
      }
    }
    const attachmentSessions = await sessionStore.list();
    await cleanupUnreferencedAttachments({
      workspaceRoot,
      attachments: referencedAttachmentsForSessions(attachmentSessions),
    }).catch((error) =>
      publish({
        type: "diagnostic",
        level: "warning",
        message: `attachment cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
    const projection = projectSession(session);
    for (const event of projection.replayableEvents)
      if (event.type === "diagnostic")
        runtimeDiagnostics.push({
          ...event,
          at: event.at ?? session.createdAt,
        });
    for (const event of projection.replayableEvents)
      if (event.type === "turn.submitted" && event.attachments?.length)
        attachmentReferences.set(`${event.id}:user`, event.attachments);
    if (projection.selectedAgent) {
      const restored = agentRegistry?.select(projection.selectedAgent);
      if (restored) {
        selectedAgent = restored;
        applyAgentPolicy();
        applyAgentProvider();
      } else {
        publish({
          type: "diagnostic",
          level: "warning",
          message: `persisted agent is no longer configured: ${projection.selectedAgent}`,
        });
      }
    }
    if (projection.selectedModel) {
      selectedModel = projection.selectedModel;
      applyAgentProvider();
    }
    if (projection.activeTurnIDs.length) {
      publish({
        type: "diagnostic",
        level: "warning",
        message: `previous process stopped during ${projection.activeTurnIDs.length} active turn(s); incomplete provider work was not replayed`,
      });
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
    const sqliteEpoch = sqliteStore?.loadContextEpoch(sessionID);
    if (sqliteEpoch) context.restoreDurableCheckpoint(sqliteEpoch.snapshot);
    else if (latestContextCheckpoint)
      context.restoreDurableCheckpoint(latestContextCheckpoint.snapshot);
    restoreContextFromEvents(
      context,
      sqliteEpoch
        ? sqliteStore!.loadEventsAfter(sessionID, sqliteEpoch.baselineSeq)
        : modelVisibleEvents(projection.replayableEvents),
    );
    const [queued] = projection.pendingInputs.filter(
      (input) => input.delivery === "queue",
    );
    if (queued) void turnCoordinator().wake(drainSession);
    skillRegistry = await discoverSkills({
      workspaceRoot,
      userRoot: process.env.HOME
        ? join(process.env.HOME, ".config", "natalia-cli", "skills")
        : undefined,
      remoteURLs: tsRuntimeConfig?.skills.urls,
    });
    const activeSkillEntry = [...context.snapshot().entries]
      .reverse()
      .find(
        (entry) => entry.role === "system" && entry.id.startsWith("skill:"),
      );
    const qualifiedName = activeSkillEntry?.id.match(
      /^skill:((?:project|remote|user):[^:]+):/u,
    )?.[1];
    if (qualifiedName) {
      try {
        activeSkill = skillRegistry.resolve(qualifiedName);
      } catch {
        // A removed skill must not prevent durable session recovery.
      }
    }
    tools.set(
      "skill_load",
      createSkillLoadTool({
        registry: () => skillRegistry,
        onLoad: (skill, output) => {
          activeSkill = skill;
          context.add({
            id: `skill:${skill.qualifiedName}:${context.journalStatus().journalOffset}`,
            role: "system",
            content: output,
          });
        },
      }),
    );
    publish({
      type: "session.created",
      sessionID,
      title: session.title,
    });
    for (const event of session.events) sink?.(event);
    restoreInteractiveState(session.events);
    checkpointStore = await CheckpointStore.open({
      sessionID,
      workspaceRoot,
      enabled: tsRuntimeConfig?.checkpoint.enabled,
      maxFiles: tsRuntimeConfig?.checkpoint.maxFiles,
      maxBytes: tsRuntimeConfig?.checkpoint.maxBytes,
      ignore: tsRuntimeConfig?.checkpoint.ignore,
      additionalDirs: [
        ...(tsRuntimeConfig?.checkpoint.additionalDirs ?? []),
        ...(tsRuntimeConfig?.workspace.additionalDirs ?? []),
      ],
      onEvent: publish,
    });
    if (checkpointStore.isEnabled())
      await checkpointStore.ensureBaseline(context, 0);
    publish({ type: "session.ready", sessionID });
    publish(contextStatusEvent(context.status(runtimeContextConfig)));
    publish(await runtimeStatusSnapshot());
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
  }

  function isToolAllowed(toolName: string) {
    return (
      toolLayer.isToolAllowed(toolName) &&
      agentToolLayer.isToolAllowed(toolName)
    );
  }

  function checkpointResources() {
    return [
      ...(subagents?.list().map((agent) => ({
        kind: "subagent" as const,
        id: agent.id,
        status:
          agent.status === "running"
            ? ("running" as const)
            : agent.status === "paused"
              ? ("waiting" as const)
              : ("stopped" as const),
        summary: agent.task,
      })) ?? []),
      ...(interactivePTY?.list().map((pty) => ({
        kind: "pty" as const,
        id: pty.id,
        status:
          pty.status === "running"
            ? ("running" as const)
            : ("stopped" as const),
        summary: pty.command,
      })) ?? []),
      ...(activeAbort
        ? [
            {
              kind: "tool" as const,
              id: "active_turn",
              status: "running" as const,
              summary: "active provider turn",
            },
          ]
        : []),
    ];
  }

  async function lowerContextAttachments(
    messages: import("@natalia/runtime").ProviderMessage[],
    entries: import("@natalia/runtime").ContextEntry[],
  ) {
    let cursor = 0;
    for (const entry of entries) {
      const attachments = attachmentReferences.get(entry.id);
      if (!attachments?.length || entry.role !== "user") continue;
      const index = messages.findIndex(
        (message, messageIndex) =>
          messageIndex >= cursor &&
          message.role === "user" &&
          message.content === entry.content,
      );
      if (index < 0) continue;
      cursor = index + 1;
      const user = messages[index]!;
      const textAttachments = attachments.filter(isTextAttachment);
      const imageAttachments = attachments.filter(
        (attachment) =>
          !isTextAttachment(attachment) &&
          attachment.mediaType !== "application/pdf",
      );
      const pdfAttachments = attachments.filter(
        (attachment) => attachment.mediaType === "application/pdf",
      );
      if (textAttachments.length)
        user.content = `${user.content}\n\n${(
          await Promise.all(
            textAttachments.map(
              async (attachment) =>
                `[Attachment: ${attachment.filename}]\n${await attachmentText(workspaceRoot, attachment)}`,
            ),
          )
        ).join("\n\n")}`;
      const capabilities = activeModelCapabilities();
      if (imageAttachments.length && !capabilities.imageInput)
        throw new Error("selected model does not support image attachments");
      if (pdfAttachments.length && !capabilities.pdfInput)
        throw new Error("selected model does not support PDF attachments");
      if (imageAttachments.length && !provider?.imageInput)
        throw new Error(
          "selected provider adapter does not support image attachment lowering",
        );
      if (pdfAttachments.length && !provider?.pdfInput)
        throw new Error(
          "selected provider adapter does not support PDF attachment lowering",
        );
      user.images = await Promise.all(
        imageAttachments.map(async (attachment) => ({
          mediaType: attachment.mediaType as "image/png" | "image/jpeg",
          dataURL: await attachmentDataURL(workspaceRoot, attachment),
        })),
      );
      user.pdfs = await Promise.all(
        pdfAttachments.map(async (attachment) => ({
          mediaType: "application/pdf" as const,
          dataURL: await attachmentDataURL(workspaceRoot, attachment),
        })),
      );
    }
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
    return selectedAgent?.maxSteps ?? maxSteps;
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
    if (event.type === "diagnostic")
      event = { ...event, at: event.at ?? new Date().toISOString() };
    if (event.type === "diagnostic") {
      runtimeDiagnostics.push({
        ...event,
        at: event.at ?? new Date().toISOString(),
      });
      if (runtimeDiagnostics.length > 500) runtimeDiagnostics.splice(0, 1);
    }
    if (
      session &&
      event.type !== "session.created" &&
      event.type !== "session.ready" &&
      runtimeEventDurability(event) === "durable"
    ) {
      appendSessionEvent(session, event);
      const sessionSnapshot = structuredClone(session);
      sessionPersistence = sessionPersistence
        .then(async () => {
          await sqliteStore?.appendEventAsync(sessionID, event);
          await sessionStore.save(sessionSnapshot);
        })
        .catch((error) => {
          sink?.({
            type: "diagnostic",
            level: "warning",
            message: `session persistence deferred/failed: ${error instanceof Error ? error.message : String(error)}`,
          });
        });
    }
    plugins?.dispatch(event);
    sink?.(event);
  }

  async function runtimeStatusSnapshot() {
    const running =
      (subagents?.runningCount() ?? 0) +
      (interactivePTY?.runningCount() ?? 0) +
      (sandboxes?.runningResourceCount() ?? 0) +
      (processRegistry
        ? await processRegistry.runningCount({ workspaceRoot })
        : 0);
    return statusSnapshot(
      provider,
      context,
      workspaceRoot,
      permissionMode,
      running,
    );
  }

  function scheduleRuntimeStatusSnapshot() {
    if (statusRefreshQueued) return;
    statusRefreshQueued = true;
    queueMicrotask(() => {
      statusRefreshQueued = false;
      void runtimeStatusSnapshot()
        .then(publish)
        .catch((error) =>
          publish({
            type: "diagnostic",
            level: "warning",
            message: `runtime status refresh failed: ${error instanceof Error ? error.message : String(error)}`,
          }),
        );
    });
  }

  async function submitInput(input: SubmitInput) {
    await ready;
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
    if (!session) throw new Error("session initialization did not complete");
    const delivery = input.delivery ?? "steer";
    const existing = admittedInputs(session).find((item) => item.id === id);
    admitInput(session, {
      id,
      text,
      delivery,
      attachments,
      resources: input.resources,
      agents: input.agents,
    });
    if (existing) {
      if (!existing.promotedAt && delivery === "steer") {
        void turnCoordinator().wake(drainSession);
        await turnCoordinator().run(drainSession);
      }
      return submitted;
    }
    lastSubmitted = submitted;
    publish(submitted);
    // Persist admission before a command or provider can observe this turn.
    await sessionPersistence;
    if (delivery === "queue") {
      void turnCoordinator().wake(drainSession);
      return submitted;
    }
    void turnCoordinator().wake(drainSession);
    await turnCoordinator().run(drainSession);
    await sessionPersistence;
    return submitted;
  }

  async function drainSession(signal: AbortSignal) {
    if (!session) return;
    const abort = () => activeAbort?.abort(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    try {
      if (signal.aborted) throw signal.reason;
      // Inputs admitted after this boundary wake a single successor drain.
      const inputs = promoteSteers(session, admissionCutoff(session));
      if (inputs.length) await persistInboxPromotion();
      for (const input of inputs) {
        if (signal.aborted) throw signal.reason;
        await runAdmittedInput(
          input.id,
          input.text,
          input.attachments,
          input.resources,
          input.agents,
        );
      }
      if (
        !admittedInputs(session).some(
          (input) => !input.promotedAt && input.delivery === "steer",
        )
      )
        await drainPendingQueue(signal);
    } finally {
      signal.removeEventListener("abort", abort);
    }
  }

  async function drainPendingQueue(signal?: AbortSignal) {
    if (!session) return;
    if (signal?.aborted) throw signal.reason;
    const [next] = promoteNextQueued(session);
    if (!next) return;
    await persistInboxPromotion();
    await runAdmittedInput(
      next.id,
      next.text,
      next.attachments,
      next.resources,
      next.agents,
    );
  }

  async function runAdmittedInput(
    id: string,
    text: string,
    attachments: import("@natalia/contracts").LocalAttachment[] = [],
    resources: import("@natalia/contracts").PromptResourceMention[] = [],
    agents: import("@natalia/contracts").PromptAgentMention[] = [],
  ) {
    if (await handleCommand(id, text)) {
      await sessionPersistence;
      return;
    }
    await runProviderTurn(id, text, attachments, resources, agents);
  }

  async function persistInboxPromotion() {
    if (!session) return;
    const snapshot = structuredClone(session);
    sessionPersistence = sessionPersistence
      .then(() => sessionStore.save(snapshot))
      .catch((error) =>
        publish({
          type: "diagnostic",
          level: "warning",
          message: `session inbox promotion persistence failed: ${error instanceof Error ? error.message : String(error)}`,
        }),
      );
    await sessionPersistence;
  }

  function sessionSummary(record: SessionRecord): RuntimeSessionSummary {
    return {
      id: record.id,
      title: record.title,
      createdAt: record.createdAt,
      lastAccessedAt: record.metadata?.lastAccessedAt,
      pinned: Boolean(record.metadata?.pinned),
      events: record.events.length,
      pendingInputs:
        record.inbox?.filter((input) => !input.promotedAt).length ?? 0,
      cancelled: record.cancelled,
      resumable: record.resumable,
    };
  }

  async function sessionByID(id: string) {
    const record = await sessionStore.load(id as SessionID);
    if (!record) throw new Error(`session not found: ${id}`);
    return record;
  }

  return {
    start(onEvent) {
      sink = onEvent;
      ready = initialize().catch((error) => {
        publish({
          type: "diagnostic",
          level: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      });
    },
    async submit(text) {
      return await submitInput({ text });
    },
    submitInput,
    async history(options = {}) {
      await ready;
      const after = Math.max(0, options.after ?? 0);
      const limit = Math.min(500, Math.max(1, options.limit ?? 100));
      if (sqliteStore)
        return sqliteStore.loadEventPage(sessionID, { after, limit });
      const events = session?.events ?? [];
      const page = events.slice(after, after + limit + 1);
      return {
        events: page
          .slice(0, limit)
          .map((event, index) => ({ seq: after + index + 1, event })),
        hasMore: page.length > limit,
      };
    },
    async pendingInteractive() {
      await ready;
      return projectInteractiveRequests(session?.events ?? []);
    },
    async dispose() {
      activeAbort?.abort(new Error("runtime disposed"));
      await turnCoordinator().interrupt();
      // A committed selection and other durable controls must reach disk before
      // a caller opens the same session in a replacement runtime.
      await sessionPersistence;
      cleanupWorkspaceFiles?.();
      cleanupWorkspaceFiles = undefined;
      for (const plugin of plugins?.list() ?? [])
        await plugins!.unload(plugin.id);
      await Promise.all(cleanupMCP.splice(0).map((close) => close()));
    },
    cancel(reason = "user cancel") {
      activeAbort?.abort(reason);
      void turnCoordinator().interrupt();
      if (activeTurnID)
        publish({ type: "turn.cancelled", id: activeTurnID, reason });
    },
    pause(reason = "user pause") {
      if (!lastSubmitted || paused) return;
      paused = true;
      publish({ type: "turn.paused", id: lastSubmitted.id, reason });
      publish({ type: "status.update", status: "paused", detail: reason });
    },
    resume() {
      if (!lastSubmitted || !paused) return;
      paused = false;
      const waiters = pauseWaiters;
      pauseWaiters = [];
      for (const resolveWaiter of waiters) resolveWaiter();
      publish({ type: "turn.resumed", id: lastSubmitted.id });
      publish({ type: "status.update", status: "running", detail: "resumed" });
    },
    selectAgent(name) {
      const agent = agentRegistry?.select(name);
      if (name && !agent) {
        publish({
          type: "diagnostic",
          level: "error",
          message: `agent not found: ${name}`,
        });
        return;
      }
      if (activeAbort) {
        pendingAgent = agent;
        publish({ type: "agent.selection", name: agent?.name, pending: true });
        return;
      }
      selectedAgent = agent;
      applyAgentPolicy();
      applyAgentProvider();
      publish({ type: "agent.selection", name: agent?.name, pending: false });
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
      return (plugins?.list() ?? []).map((plugin) => ({
        id: plugin.id,
        version: plugin.version,
        name: plugin.name,
        description: plugin.description,
        capabilities: plugin.capabilities,
      }));
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
      return (skillRegistry?.list() ?? []).map((skill) => ({
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
    async sessionList() {
      await ready;
      return (await sessionStore.list()).map(sessionSummary);
    },
    async sessionTouch(id) {
      await ready;
      const session = await sessionStore.updateMetadata(id as SessionID, {
        lastAccessedAt: new Date().toISOString(),
      });
      sqliteStore?.updateMetadata(id as SessionID, session.metadata ?? {});
    },
    async sessionRename(id, title) {
      await ready;
      const session = await sessionStore.rename(id as SessionID, title);
      sqliteStore?.rename(id as SessionID, session.title);
      return sessionSummary(session);
    },
    async sessionPin(id, pinned) {
      await ready;
      const session = await sessionStore.updateMetadata(id as SessionID, {
        pinned,
      });
      sqliteStore?.updateMetadata(id as SessionID, session.metadata ?? {});
      return sessionSummary(session);
    },
    async sessionDuplicate(id, title) {
      await ready;
      const session = await sessionStore.duplicate(
        id as SessionID,
        undefined,
        title,
      );
      sqliteStore?.replace(session);
      return sessionSummary(session);
    },
    async sessionDelete(id) {
      await ready;
      if (id === sessionID)
        throw new Error("cannot delete the active runtime session");
      await sessionByID(id);
      await sessionStore.delete(id as SessionID);
      sqliteStore?.delete(id as SessionID);
      const removedAttachments = await cleanupUnreferencedAttachments({
        workspaceRoot,
        attachments: referencedAttachmentsForSessions(
          await sessionStore.list(),
        ),
      });
      return { id, removedAttachments: removedAttachments.length };
    },
    async runtimeStatus() {
      await ready;
      return await runtimeStatusSnapshot();
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
    respondApproval(response) {
      publish({
        type: "approval.response",
        id: response.requestID,
        decision: response.decision,
        feedback: response.feedback,
      });
      pendingApprovals.set(response.requestID, response);
      pendingApprovalRequests.delete(response.requestID);
      approvalWaiters.get(response.requestID)?.(response);
    },
    respondQuestion(response) {
      publish({
        type: "question.response",
        id: response.requestID,
        answers: response.answers,
        rejected: response.rejected,
      });
      pendingQuestions.set(response.requestID, response);
      questionWaiters.get(response.requestID)?.(response);
    },
  };

  async function handleCommand(id: string, text: string) {
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
          `skills: ${skillRegistry?.list().length ?? 0}`,
          provider
            ? "provider check: configured; submit a short prompt to verify live streaming"
            : "provider check: set NATALIA_OPENAI_API_KEY (or OPENAI_API_KEY), or configure the active Go profile at ~/.config/natalia-cli/config.yaml, then restart the TUI",
          "safety: write/shell/process actions require approval unless permissionMode=auto is explicitly configured by a caller",
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
              .map((entry) => `${entry.at} ${entry.level}: ${entry.message}`)
              .join("\n")
          : "no runtime diagnostics",
      });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return true;
    }
    if (trimmed === "/sessions") {
      const listing = sqliteStore
        ? sqliteStore
            .list()
            .map(
              (item) =>
                `${item.id}  ${item.title}  ${sqliteStore!.eventCount(item.id)} events`,
            )
            .join("\n")
        : (await sessionStore.list())
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
      if (!checkpointStore)
        throw new Error("checkpoint store is not initialized");
      const result = await runCheckpointCommand(
        checkpointStore,
        context,
        trimmed,
        {
          resources: checkpointResources(),
          onResourcePolicy: async (policy) => {
            if (policy.action !== "stop" && policy.action !== "cancel") return;
            if (policy.kind === "subagent") await subagents?.stop(policy.id);
            if (policy.kind === "pty") await interactivePTY?.stop(policy.id);
            if (policy.kind === "tool")
              activeAbort?.abort(new Error("checkpoint rollback"));
          },
          onContextRestored: async (snapshot) =>
            publish({
              type: "context.checkpoint",
              id: `rollback:${snapshot.journalOffset}`,
              snapshot,
            }),
        },
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
      const skills = skillRegistry?.list() ?? [];
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
      if (!skillRegistry) throw new Error("skill registry is not initialized");
      activeSkill = skillRegistry.resolve(
        trimmed.slice("/skill ".length).trim(),
      );
      context.add({
        id: `skill:${activeSkill.qualifiedName}:${context.journalStatus().journalOffset}`,
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
      const result = await runSkillScript(activeSkill, script, {
        signal: activeAbort?.signal,
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

  async function runProviderTurn(
    id: string,
    text: string,
    attachments: import("@natalia/contracts").LocalAttachment[] = [],
    resources: import("@natalia/contracts").PromptResourceMention[] = [],
    agents: import("@natalia/contracts").PromptAgentMention[] = [],
  ) {
    if (!provider) {
      publish({
        type: "diagnostic",
        level: "error",
        message:
          "No real provider configured. Set NATALIA_OPENAI_API_KEY or OPENAI_API_KEY before using the TS7 real runtime.",
      });
      publish({ type: "turn.finished", id, stopReason: "error" });
      return;
    }
    const controller = new AbortController();
    if (pendingAgent) {
      selectedAgent = pendingAgent;
      pendingAgent = undefined;
      applyAgentPolicy();
      applyAgentProvider();
      publish({
        type: "agent.selection",
        name: selectedAgent?.name,
        pending: false,
      });
    }
    activeAbort = controller;
    activeTurnID = id;
    if (session && promoteSteers(session).length) await persistInboxPromotion();
    lastProviderUsage = undefined;
    toolCalls.clear();
    context.add({ id: `${id}:user`, role: "user", content: text });
    if (checkpointStore?.isEnabled())
      await checkpointStore.createCheckpoint({
        reason: "turn_begin",
        context,
        step: context.journalStatus().messageCount,
        status: "turn_begin",
        model: provider.model,
      });
    const messages = contextEntriesToProviderMessages(
      context.snapshot().entries,
    );
    await lowerContextAttachments(messages, context.snapshot().entries);
    const user = messages.findLast(
      (message) => message.role === "user" && message.content === text,
    );
    if (resources.length && user) {
      const contents = await Promise.all(
        resources.map(async (resource) => {
          let result: unknown;
          for (const access of mcpAccess) {
            try {
              result = await access.readResource(resource.server, resource.uri);
              break;
            } catch (error) {
              if (
                !(error instanceof Error) ||
                !error.message.includes("not connected")
              )
                throw error;
            }
          }
          if (result === undefined)
            throw new Error(`MCP server is not connected: ${resource.server}`);
          const contents =
            result && typeof result === "object" && "contents" in result
              ? (result as { contents?: unknown }).contents
              : result;
          const text = Array.isArray(contents)
            ? contents
                .flatMap((item) =>
                  item &&
                  typeof item === "object" &&
                  typeof (item as { text?: unknown }).text === "string"
                    ? [(item as { text: string }).text]
                    : [],
                )
                .join("\n")
            : typeof contents === "string"
              ? contents
              : JSON.stringify(contents);
          return `[MCP resource: ${resource.name} (${resource.uri})]\n${text}`;
        }),
      );
      user.content = `${user.content}\n\n${contents.join("\n\n")}`;
    }
    if (agents.length) {
      const invalid = agents.find(
        (mention) => !agentRegistry?.get(mention.name),
      );
      if (invalid) throw new Error(`agent mention not found: ${invalid.name}`);
      if (user)
        user.content = `${user.content}\n\n${agents.map((mention) => `@${mention.name}`).join(" ")}`;
    }
    if (tsRuntimeConfig?.instructions.enabled) {
      const systemPrompt =
        selectedAgent?.systemPrompt ||
        tsRuntimeConfig.modes[tsRuntimeConfig.defaultMode]?.systemPrompt;
      if (systemPrompt)
        messages.unshift({ role: "system", content: systemPrompt });
    }
    let assistant = "";
    try {
      for (let step = 0; step < effectiveMaxSteps(); step++) {
        await waitIfPaused();
        const result = await runProviderStepWithRecovery(
          id,
          messages,
          step + 1,
        );
        assistant += result.assistant;
        if (!result.toolMessages.length) break;
      }
      if (assistant)
        context.add({
          id: `${id}:assistant`,
          role: "assistant",
          content: assistant,
        });
      const providerUsage = lastProviderUsageSnapshot();
      if (providerUsage) {
        context.recordProviderUsage(
          providerUsage.inputTokens,
          providerUsage.outputTokens,
        );
        publish(contextStatusEvent(context.status(runtimeContextConfig)));
      }
      publish({
        type: "context.checkpoint",
        id: `${id}:context:${context.journalStatus().journalOffset}`,
        snapshot: context.durableCheckpoint(
          context.journalStatus().messageCount,
        ),
      });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      publish(await runtimeStatusSnapshot());
    } catch (error) {
      publish({
        type: "diagnostic",
        level: controller.signal.aborted ? "warning" : "error",
        message: error instanceof Error ? error.message : String(error),
      });
      publish({
        type: "turn.finished",
        id,
        stopReason: controller.signal.aborted ? "cancelled" : "error",
      });
    } finally {
      if (activeAbort === controller) activeAbort = undefined;
      if (activeTurnID === id) activeTurnID = undefined;
    }
  }

  async function runProviderStep(
    id: string,
    messages: ProviderMessage[],
    step: number,
  ) {
    const toolMessages: ProviderMessage[] = [];
    const advertised = new Map(
      [...tools].filter(
        ([name, tool]) =>
          isToolAllowed(name) &&
          (permissionMode !== "read_only" || !tool.requiresApproval) &&
          (!selectedAgent?.mcpServers.length ||
            !name.startsWith("mcp_") ||
            selectedAgent.mcpServers.some((server) =>
              name.startsWith(`mcp_${server}_`),
            )) &&
          (!activeSkill ||
            authorizeSkillTool(activeSkill, tool.name, { mode: "default" })),
      ),
    );
    const materialized = materializeTools(tools, advertised);
    const capabilities = activeModelCapabilities();
    const output = await runWithRetry(
      { id, operation: "llm_step", step },
      async () => {
        const result: {
          assistant: string;
          thinking: string;
          calls: ProviderToolCall[];
        } = {
          assistant: "",
          thinking: "",
          calls: [],
        };
        for await (const chunk of provider!.stream({
          messages,
          tools: capabilities.toolCall ? materialized.definitions : undefined,
          signal: activeAbort?.signal,
        })) {
          if (chunk.type === "thinking") {
            result.thinking += chunk.text;
            publish({ type: "thinking.delta", id, text: chunk.text });
          }
          if (chunk.type === "content") {
            result.assistant += chunk.text;
            publish({ type: "content.delta", id, text: chunk.text });
          }
          if (chunk.type === "tool_call") result.calls.push(...chunk.calls);
          if (chunk.type === "usage")
            lastProviderUsage = {
              inputTokens: chunk.inputTokens,
              outputTokens: chunk.outputTokens,
            };
        }
        return result;
      },
      { onEvent: publish, policy: retryPolicy },
    );
    if (output.thinking)
      publish({ type: "thinking.done", id, text: output.thinking });
    if (output.assistant)
      publish({ type: "content.done", id, text: output.assistant });
    if (output.calls.length) {
      const produced = await executeToolCalls(
        id,
        output.calls,
        output.assistant,
        materialized,
      );
      toolMessages.push(...produced);
      messages.push(...produced);
    }
    if (output.assistant && !toolMessages.length) {
      messages.push({ role: "assistant", content: output.assistant });
    }
    return { assistant: output.assistant, toolMessages };
  }

  function providerForModel(
    config: ConfigV2,
    modelID: string,
    variantName?: string,
  ): StreamingProvider | undefined {
    const status = modelSelectionStatus(config, modelID);
    if (!status.selected) return undefined;
    const model = config.models[modelID];
    const providerConfig = model && config.providers[model.provider];
    if (!model || !providerConfig?.apiKey) return undefined;
    const variant = variantName ? model.variants[variantName] : undefined;
    if (variantName && !variant) return undefined;
    return providerFromKind({
      providerName: providerConfig.type,
      provider: providerConfig.type,
      apiKey: providerConfig.apiKey,
      model: variant?.model ?? model.model,
      baseURL: providerConfig.baseURL,
      maxTokens: variant?.maxOutputTokens ?? model.maxOutputTokens ?? undefined,
      temperature: variant?.temperature ?? model.temperature ?? undefined,
      topP: variant?.topP ?? model.topP ?? undefined,
      reasoningEffort: model.capabilities.reasoning
        ? (variant?.reasoningEffort ?? model.reasoningEffort ?? undefined)
        : undefined,
      thinkingEnabled: model.capabilities.thinking
        ? (variant?.thinkingEnabled ?? model.thinkingEnabled)
        : undefined,
      timeoutMs:
        (variant?.requestTimeoutSec ?? model.requestTimeoutSec ?? undefined) ===
        undefined
          ? undefined
          : (variant?.requestTimeoutSec ?? model.requestTimeoutSec)! * 1000,
      streamIdleTimeoutMs: config.runtime.timeouts.streamIdleSec * 1000,
    });
  }

  function activeModelCapabilities() {
    const modelID =
      selectedAgent?.model ??
      selectedModel?.modelID ??
      tsRuntimeConfig?.defaultModel;
    return modelID && tsRuntimeConfig?.models[modelID]
      ? tsRuntimeConfig.models[modelID].capabilities
      : {
          toolCall: true,
          reasoning: true,
          thinking: true,
          imageInput: false,
          pdfInput: false,
        };
  }

  async function runProviderStepWithRecovery(
    id: string,
    messages: ProviderMessage[],
    step: number,
  ) {
    try {
      return await runProviderStep(id, messages, step);
    } catch (error) {
      if ((error as { kind?: string }).kind !== "context_limit") throw error;
      publish({
        type: "context.limit.recovery",
        id,
        step,
        attempted: true,
        compacted: false,
        reason: "context_limit",
      });
      const config = runtimeContextConfig;
      const compacted = await compactContext(
        context,
        provider ? providerCompactor(provider) : extractiveCompactor(),
        {
          id: `${id}:context-limit`,
          trigger: "context_limit",
          force: true,
          maxTokens: config.max,
          thresholdPercent: config.thresholdPercent,
          reservedTokens: config.reserved,
          preservedRecentMessages: 8,
          instruction: "Recover from provider context limit before retrying.",
          onEvent: publish,
        },
      );
      if (compacted.compacted)
        publish({
          type: "context.checkpoint",
          id: `${id}:context-limit:${context.journalStatus().journalOffset}`,
          snapshot: context.durableCheckpoint(step),
        });
      publish({
        type: "context.limit.recovery",
        id,
        step,
        attempted: true,
        compacted: true,
        reason: "context_limit",
      });
      try {
        return await runProviderStep(
          id,
          contextEntriesToProviderMessages(context.snapshot().entries),
          step,
        );
      } catch (retryError) {
        if ((retryError as { kind?: string }).kind === "context_limit")
          throw providerError({
            kind: "context_limit",
            message: "context-limit recovery already attempted",
            cause: retryError,
          });
        throw retryError;
      }
    }
  }

  async function executeToolCalls(
    turnID: string,
    calls: ProviderToolCall[],
    assistant: string,
    materialized: ToolMaterialization,
  ): Promise<ProviderMessage[]> {
    const assistantMessage: ProviderMessage = {
      role: "assistant",
      content: assistant,
      toolCalls: calls,
    };
    const messages: ProviderMessage[] = [assistantMessage];
    for (const call of calls) {
      context.add({
        id: `${turnID}:${call.id}:call`,
        role: "tool_call",
        content: `${call.name} ${call.arguments}`,
        pairID: call.id,
      });
    }
    for (const call of calls) {
      const resolved = materialized.resolve(call.name);
      if (resolved.status !== "ready") {
        const reason = resolved.error;
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
        messages.push({
          role: "tool",
          toolCallID: call.id,
          toolName: call.name,
          content: `ERROR: ${reason}`,
        });
        continue;
      }
      const result = await executeOneTool(turnID, call, resolved.tool);
      messages.push({
        role: "tool",
        toolCallID: call.id,
        toolName: call.name,
        content: result,
      });
      context.add({
        id: `${turnID}:${call.id}:result`,
        role: "tool_result",
        content: result,
        pairID: call.id,
      });
    }
    return messages;
  }

  async function executeOneTool(
    turnID: string,
    call: ProviderToolCall,
    tool: RuntimeTool,
  ) {
    const toolID = `${turnID}:${call.id}`;
    const dedupKey = `${call.name}\u0000${call.arguments}`;
    const occurrences = (toolCalls.get(dedupKey) ?? 0) + 1;
    toolCalls.set(dedupKey, occurrences);
    if (occurrences > 12) {
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
      return `ERROR: ${preResult.diagnostics.join("; ")}`;
    }
    if (permissionMode === "read_only" && tool.requiresApproval) {
      const message = readOnlyToolMessage(tool.name);
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
    if (tool.requiresApproval) await requireApproval(toolID, tool, call);
    await waitIfPaused();
    publish({
      type: "tool.update",
      id: toolID,
      name: tool.name,
      callID: call.id,
      status: "running",
      summary: "running",
      startedAt: Date.now(),
    });
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
      const completeResult = await tool.execute(parsed, {
        workspaceRoot,
        signal: activeAbort?.signal,
        askQuestion: async (question) =>
          await requireQuestion(`${toolID}:question`, question),
        subagents,
        interactivePTY,
        onPTYUpdate: (pty) => {
          publish({
            type: "pty.update",
            id: pty.id,
            command: pty.command,
            cwd: pty.cwd,
            status: pty.status,
            attached: pty.attached,
            rows: pty.rows,
            cols: pty.cols,
            activity: pty.status === "running" ? "running" : "waiting",
            tail: pty.tail,
            transcript: pty.transcript,
            lastAction: "write",
            target: { kind: "host", cwd: pty.cwd },
            ownership: "model",
          });
          if (ptyStatusByID.get(pty.id) !== pty.status) {
            ptyStatusByID.set(pty.id, pty.status);
            scheduleRuntimeStatusSnapshot();
          }
        },
        onPTYAction: (pty, action, redacted) => {
          publish({
            type: "pty.action",
            id: pty.id,
            action,
            redacted,
            target: { kind: "host", cwd: pty.cwd },
          });
          publish({
            type: "pty.timeline",
            id: pty.id,
            actor: "model",
            action,
            status: "executed",
            summary: redacted
              ? "sensitive input supplied"
              : `${action} executed`,
            at: new Date().toISOString(),
          });
        },
        sandboxes,
        settings: toolSettings(),
        parentSessionID: sessionID,
        maxSubagentDepth: tsRuntimeConfig?.runtime.subagentDepth,
        onWorkflowEvent: (event) =>
          publish({ type: "workflow.update", ...event }),
        workflowAuthorize: authorizeWorkflowStep,
        onSandboxEvent: (event) => {
          const update = event as Extract<
            RuntimeEvent,
            { type: "sandbox.update" }
          >;
          publish(update);
          if (sandboxResourcesByID.get(update.id) !== update.runningResources) {
            sandboxResourcesByID.set(update.id, update.runningResources);
            scheduleRuntimeStatusSnapshot();
          }
        },
      });
      const bounded = await boundToolOutput(
        workspaceRoot,
        redactToolOutput(
          completeResult,
          selectedAgent?.permissions?.redactOutput,
        ),
      );
      const result = bounded.text;
      publish({
        type: "tool.update",
        id: toolID,
        name: tool.name,
        callID: call.id,
        status: "succeeded",
        summary: result.slice(0, 200),
        result,
        metadata: bounded.outputPath
          ? { outputPath: bounded.outputPath }
          : undefined,
        endedAt: Date.now(),
      });
      if (isManagedResourceTool(tool.name)) scheduleRuntimeStatusSnapshot();
      await toolLayer.postExecute({ ...hookEvent, result });
      return result;
    } catch (error) {
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
      await toolLayer.postExecute({ ...hookEvent, error: message });
      return `ERROR: ${message}`;
    }
  }

  async function requireApproval(
    approvalID: string,
    tool: RuntimeTool,
    call: ProviderToolCall,
  ) {
    if (permissionMode === "auto") return;
    if (permissionMode === "read_only")
      throw new Error(readOnlyToolMessage(tool.name));
    const presentation = approvalPresentation(tool.name, call.arguments);
    publish({
      type: "approval.request",
      id: approvalID,
      title: `Approve ${tool.name}`,
      preview: presentation.preview,
      detail: presentation.detail,
      keyArguments: presentation.keyArguments,
      sensitive: presentation.sensitive,
    });
    pendingApprovalRequests.add(approvalID);
    try {
      const response = await waitForResponse(
        approvalID,
        pendingApprovals,
        approvalWaiters,
        activeAbort?.signal,
        `approval timed out: ${tool.name}`,
      );
      if (response.decision === "reject")
        throw new Error(`tool rejected: ${response.feedback ?? tool.name}`);
    } finally {
      pendingApprovalRequests.delete(approvalID);
    }
  }

  async function authorizeWorkflowStep(request: {
    kind: "tool" | "script";
    stepID: string;
    toolName?: string;
    arguments?: unknown;
    command?: string;
    timeoutMs?: number;
  }) {
    const toolName = request.kind === "script" ? "run_shell" : request.toolName;
    if (!toolName) throw new Error("workflow tool name is required");
    const tool = tools.get(toolName);
    if (!tool) throw new Error(`workflow tool not found: ${toolName}`);
    const arguments_ =
      request.kind === "script"
        ? request.timeoutMs
          ? { command: request.command, timeoutSec: request.timeoutMs / 1000 }
          : { command: request.command }
        : request.arguments;
    const rawArguments = JSON.stringify(arguments_ ?? {});
    const hookEvent: ToolHookEvent = {
      turnID: activeTurnID ?? `workflow:${sessionID}`,
      toolName,
      toolCallID: `workflow:${request.stepID}`,
      arguments: rawArguments,
    };
    const preResult = await toolLayer.preExecute(hookEvent);
    if (!preResult.allowed) throw new Error(preResult.diagnostics.join("; "));
    if (permissionMode === "read_only" && tool.requiresApproval)
      throw new Error(readOnlyToolMessage(toolName));
    const errors = validateToolParameters(tool.parameters, arguments_);
    if (errors.length)
      throw new Error(
        `workflow tool "${toolName}" parameter validation failed: ${errors.map((error) => `${error.path}: ${error.message}`).join("; ")}`,
      );
    if (tool.requiresApproval)
      await requireApproval(
        `workflow:${activeTurnID ?? sessionID}:${request.stepID}`,
        tool,
        {
          id: `workflow:${request.stepID}`,
          name: toolName,
          arguments: rawArguments,
        },
      );
  }

  async function requireQuestion(
    requestID: string,
    request: {
      title: string;
      questions: Array<{
        id: string;
        header: string;
        question: string;
        options: Array<{ label: string; description?: string }>;
        multiple?: boolean;
        custom?: boolean;
      }>;
    },
  ) {
    publish({ type: "question.request", id: requestID, ...request });
    const response = await waitForResponse(
      requestID,
      pendingQuestions,
      questionWaiters,
      activeAbort?.signal,
      "question timed out",
    );
    if (response.rejected) throw new Error("user rejected question");
    return response.answers;
  }

  async function waitIfPaused() {
    while (paused) {
      await new Promise<void>((resolveWaiter) => {
        pauseWaiters.push(resolveWaiter);
      });
    }
  }

  function restoreInteractiveState(events: RuntimeEvent[]) {
    const pending = projectInteractiveRequests(events);
    for (const request of pending.approvals) {
      pendingApprovalRequests.add(request.id);
      publish({
        type: "diagnostic",
        level: "warning",
        message: `Recovered unresolved approval record ${request.id}; active tool execution was not replayed and must be resubmitted after a response.`,
      });
    }
    for (const request of pending.questions)
      publish({
        type: "diagnostic",
        level: "warning",
        message: `Recovered unresolved question record ${request.id}; active tool execution was not replayed and must be resubmitted after an answer.`,
      });
  }

  function lastProviderUsageSnapshot() {
    return lastProviderUsage;
  }

  function toolSettings() {
    const network = selectedAgent?.permissions?.network;
    return {
      webSearchEndpoint: tsRuntimeConfig?.webSearch.endpoint ?? undefined,
      browserBinary: tsRuntimeConfig?.browser.binary || undefined,
      allowedHosts: network?.allowedHosts.length
        ? network.allowedHosts
        : tsRuntimeConfig?.network.allowedHosts,
      deniedHosts: network?.denyHosts,
      allowLocalhost:
        network?.allowLocalhost ?? tsRuntimeConfig?.network.allowLocalhost,
      allowPrivate:
        network?.allowPrivate ?? tsRuntimeConfig?.network.allowPrivate,
      envAllowlist: selectedAgent?.permissions?.env?.allowlist,
    };
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

function extractiveCompactor() {
  return {
    async compact(input: {
      entries: Array<{ role: string; content: string }>;
    }) {
      const summary = input.entries
        .slice(-20)
        .map((entry) => `${entry.role}: ${entry.content.slice(0, 400)}`)
        .join("\n");
      return {
        summary: summary || "No prior context available.",
        tokens: Math.max(1, Math.ceil(summary.length / 4)),
      };
    },
  };
}

function waitForResponse<T>(
  id: string,
  responses: Map<string, T>,
  waiters: Map<string, (response: T) => void>,
  signal: AbortSignal | undefined,
  timeoutMessage: string,
) {
  const existing = responses.get(id);
  if (existing) {
    responses.delete(id);
    return Promise.resolve(existing);
  }
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => finish(() => reject(new Error(timeoutMessage))),
      5 * 60_000,
    );
    const abort = () =>
      finish(() => reject(signal?.reason ?? new Error("request cancelled")));
    const finish = (settle: () => void) => {
      clearTimeout(timeout);
      waiters.delete(id);
      signal?.removeEventListener("abort", abort);
      settle();
    };
    waiters.set(id, (response) => {
      responses.delete(id);
      finish(() => resolve(response));
    });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    const raced = responses.get(id);
    if (raced) waiters.get(id)?.(raced);
  });
}

function parseToolArguments(input: string) {
  if (!input.trim()) return {};
  return JSON.parse(input) as unknown;
}

function tryParseToolArguments(input: string) {
  try {
    const parsed = parseToolArguments(input);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      return parsed as Record<string, unknown>;
  } catch {
    // Detailed malformed-input validation happens at the normal tool boundary.
  }
  return {};
}

function redactToolOutput(output: string, redact: boolean | undefined) {
  if (!redact) return output;
  return output.replace(
    /\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s]+/giu,
    (match) =>
      `${match.slice(0, match.indexOf("=") >= 0 ? match.indexOf("=") + 1 : match.indexOf(":") + 1)}[REDACTED]`,
  );
}

function approvalPresentation(toolName: string, rawArguments: string) {
  let args: Record<string, unknown> | undefined;
  try {
    const parsed = parseToolArguments(rawArguments);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      args = parsed as Record<string, unknown>;
  } catch {
    // Keep malformed raw arguments only in the explicit detail pane.
  }
  const keyArguments = [`tool=${toolName}`];
  const path = typeof args?.path === "string" ? args.path : undefined;
  if (path) keyArguments.push(`path=${path}`);
  const sensitive = Object.keys(args ?? {}).some((key) =>
    /api[_-]?key|token|secret|password|authorization|cookie/iu.test(key),
  );
  const content = typeof args?.content === "string" ? args.content : undefined;
  const command = typeof args?.command === "string" ? args.command : undefined;
  const preview =
    toolName === "write_file" && path
      ? [
          `Write ${path}`,
          content === undefined
            ? "Content: unavailable"
            : `Content: ${Array.from(content).length} chars${content.trim() ? ` · ${singleLine(content, 160)}` : ""}`,
        ].join("\n")
      : command
        ? `Run command: ${singleLine(command, 220)}`
        : path
          ? `${toolName}: ${path}`
          : `${toolName} requires approval`;
  return { preview, detail: rawArguments, keyArguments, sensitive };
}

function singleLine(value: string, max: number) {
  const compact = value.replace(/\s+/gu, " ").trim();
  const chars = Array.from(compact);
  return chars.length > max ? `${chars.slice(0, max).join("")}...` : compact;
}

function statusSnapshot(
  provider: StreamingProvider | undefined,
  context: ContextLedger,
  cwd: string,
  permissionMode: "ask" | "auto" | "read_only",
  running: number,
): Extract<RuntimeEvent, { type: "status.snapshot" }> {
  const status = context.journalStatus();
  return {
    type: "status.snapshot",
    model: provider?.model ?? "not-configured",
    provider: provider?.provider ?? "not-configured",
    context: `${status.tokenEstimate} tokens`,
    step: `${status.messageCount}`,
    permissions: permissionMode,
    cwd,
    background: `${running} running`,
  };
}

function readOnlyToolMessage(toolName: string) {
  return `tool denied by read-only permission mode: ${toolName}`;
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
