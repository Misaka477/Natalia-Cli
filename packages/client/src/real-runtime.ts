import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import type {
  ApprovalResponse,
  RuntimeClient,
  RuntimeEvent,
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
import { resolveConfig } from "@natalia/config";
import {
  appendSessionEvent,
  JsonSessionStore,
  SessionRunCoordinator,
  SqliteSessionStore,
  admitInput,
  admittedInputs,
  promoteNextQueued,
  promoteSteers,
  type SessionRecord,
} from "@natalia/session";
import {
  createToolRegistry,
  boundToolOutput,
  cleanupToolOutput,
  materializeTools,
  validateToolParameters,
  type RuntimeTool,
  type ToolMaterialization,
  type ToolRegistry,
} from "@natalia/tools";
import {
  authorizeSkillTool,
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
import {
  createToolPolicyHookLayer,
  type ToolHookEvent,
  type ToolHooks,
  type ToolPolicy,
  type ToolPolicyHookLayer,
} from "./tool-policy";

export type RealRuntimeClientOptions = {
  sessionID?: SessionID;
  title?: string;
  workspaceRoot?: string;
  sessionDir?: string;
  useSqliteStore?: boolean;
  provider?: StreamingProvider;
  tools?: ToolRegistry;
  permissionMode?: "ask" | "auto";
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
  const tools = options.tools ?? createToolRegistry();
  let toolLayer = createToolPolicyHookLayer(options.toolPolicy, options.hooks);
  let permissionMode = options.permissionMode ?? "ask";
  let maxSteps = 10;
  let subagents: SubagentRegistry | undefined;
  let interactivePTY: InteractivePTYRegistry | undefined;
  let sandboxes: WorkspaceSandboxManager | undefined;
  const toolCalls = new Map<string, number>();
  const context = new ContextLedger();
  const pendingApprovals = new Map<string, ApprovalResponse>();
  const pendingApprovalRequests = new Set<string>();
  const approvalWaiters = new Map<string, (response: ApprovalResponse) => void>();
  const pendingQuestions = new Map<string, QuestionResponse>();
  const questionWaiters = new Map<string, (response: QuestionResponse) => void>();
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
  let lastProviderUsage:
    | { inputTokens: number; outputTokens: number }
    | undefined;
  let sessionPersistence = Promise.resolve();
  let tsRuntimeConfig:
    | Awaited<ReturnType<typeof resolveConfig>>["config"]
    | undefined;
  let runtimeContextConfig = contextStatusConfig();
  let retryPolicy: NonNullable<Parameters<typeof runWithRetry>[2]>["policy"];
  const turnCoordinator = new SessionRunCoordinator();

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
        if (permission?.approval === "auto") permissionMode = "auto";
      }
      if (!options.toolPolicy) {
        const mode = tsConfig.config.modes[tsConfig.config.defaultMode];
        if (mode)
          toolLayer = createToolPolicyHookLayer(
            { allow: mode.allowedTools, exclude: mode.excludedTools },
            options.hooks,
          );
      }
      if (!options.provider) {
        const model = tsConfig.config.models[tsConfig.config.defaultModel];
        const providerConfig = model
          ? tsConfig.config.providers[model.provider]
          : undefined;
        if (model && providerConfig?.apiKey) {
          provider = providerFromKind({
            providerName: providerConfig.type,
            provider: providerConfig.type,
            apiKey: providerConfig.apiKey,
            model: model.model,
            baseURL: providerConfig.baseURL,
            maxTokens: model.maxOutputTokens ?? undefined,
          });
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
    sessionID =
      options.sessionID ?? (`ses_${sessionSeed(workspaceRoot)}` as SessionID);
    sessionStore = new JsonSessionStore(
      options.sessionDir ?? join(workspaceRoot, ".natalia", "sessions"),
    );
    if (options.useSqliteStore) {
      sqliteStore = new SqliteSessionStore(
        join(workspaceRoot, ".natalia", "sessions.db"),
      );
      sqliteStore.create(sessionID, options.title ?? `Natalia TS session ${sessionID}`);
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
              excluded.has(tool.name) ||
              (allowed.length && !allowed.includes(tool.name))
            )
              throw new Error(`subagent tool denied by policy: ${tool.name}`);
            const toolID = `subagent:${runner.agentId}:${step}:${call.id}`;
            if (tool.requiresApproval)
              await requireApproval(toolID, tool, call);
            const result = await tool.execute(
              parseToolArguments(call.arguments),
              {
                workspaceRoot,
                signal: runner.signal,
                askQuestion: async (question) =>
                  await requireQuestion(`${toolID}:question`, question),
                subagents,
                interactivePTY,
                sandboxes,
                settings: toolSettings(),
              },
            );
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
      });
    });
    if (tsRuntimeConfig) {
      const nativeMCP = await loadNativeMCPTools({
        registry: tools,
        servers: tsRuntimeConfig.mcpServers,
        workspaceRoot,
        onDiagnostic: (message) =>
          publish({ type: "diagnostic", level: "info", message }),
      });
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
    if (mcp.loaded > 0)
      publish({
        type: "diagnostic",
        level: "info",
        message: `Loaded ${mcp.loaded} native MCP tool(s) from legacy Go config without launching Go runtime.`,
      });
    interactivePTY = new InteractivePTYRegistry(
      join(workspaceRoot, ".natalia", "pty", "interactive"),
    );
    sandboxes = new WorkspaceSandboxManager(
      join(workspaceRoot, ".natalia", "sandboxes"),
    );
    session = await sessionStore.loadOrCreate(
      sessionID,
      options.title ?? `Natalia TS session ${sessionID}`,
    );
    await cleanupToolOutput(workspaceRoot).catch((error) =>
      publish({
        type: "diagnostic",
        level: "warning",
        message: `tool output cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      }),
    );
    restoreContextFromEvents(context, session.events);
    restoreResponsesFromEvents(session.events);
    skillRegistry = await discoverSkills({
      workspaceRoot,
      userRoot: process.env.HOME
        ? join(process.env.HOME, ".config", "natalia-cli", "skills")
        : undefined,
    });
    publish({
      type: "session.created",
      sessionID,
      title: session.title,
    });
    for (const event of session.events) sink?.(event);
    restoreApprovalStateFromEvents(session.events);
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
    publish(statusSnapshot(provider, context, workspaceRoot));
  }

  function publish(event: RuntimeEvent) {
    if (
      session &&
      event.type !== "session.created" &&
      event.type !== "session.ready"
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
    sink?.(event);
  }

  async function submitInput(input: SubmitInput) {
    await ready;
    const text = input.text;
    const id = input.id ?? `turn_${crypto.randomUUID().replace(/-/gu, "")}`;
    const submitted: SubmittedTurn = {
      type: "turn.submitted",
      id,
      text,
      byteLength: new TextEncoder().encode(text).byteLength,
      lineCount: lineCount(text),
      sha256: createHash("sha256").update(text).digest("hex"),
    };
    if (!session) throw new Error("session initialization did not complete");
    const delivery = input.delivery ?? "steer";
    const existing = admittedInputs(session).find((item) => item.id === id);
    admitInput(session, { id, text, delivery });
    if (existing) {
      if (!existing.promotedAt && delivery === "steer")
        await turnCoordinator.run(() => drainAdmittedInput(id, text));
      return submitted;
    }
    lastSubmitted = submitted;
    publish(submitted);
    // Persist admission before a command or provider can observe this turn.
    await sessionPersistence;
    if (delivery === "queue") {
      if (!turnCoordinator.active)
        void turnCoordinator.run(async () => {
          if (!session) return;
          const [next] = promoteNextQueued(session);
          if (!next) return;
          await persistInboxPromotion();
          await drainAdmittedInput(next.id, next.text);
        });
      return submitted;
    }
    await turnCoordinator.run(() => drainAdmittedInput(id, text));
    await sessionPersistence;
    return submitted;
  }

  async function drainAdmittedInput(id: string, text: string) {
    await runAdmittedInput(id, text);
    while (session && !admittedInputs(session).some((item) => !item.promotedAt && item.delivery === "steer")) {
      const [next] = promoteNextQueued(session);
      if (!next) return;
      await persistInboxPromotion();
      await runAdmittedInput(next.id, next.text);
    }
  }

  async function runAdmittedInput(id: string, text: string) {
    if (await handleCommand(id, text)) {
      await sessionPersistence;
      return;
    }
    await runProviderTurn(id, text);
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
    cancel(reason = "user cancel") {
      activeAbort?.abort(reason);
      if (activeTurnID) publish({ type: "turn.cancelled", id: activeTurnID, reason });
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
          "/doctor - inspect provider, workspace, session, and native tools",
          "/status - show the current runtime status snapshot",
          "/sessions - list durable TS sessions in the current workspace",
          "/skills and /skill <name> - inspect or activate native skills",
          "/checkpoint, /checkpoints, /rollback <id> [--dry-run] - durable workspace/context controls",
          "/pause and /resume - pause at a safe runtime boundary",
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
          `skills: ${skillRegistry?.list().length ?? 0}`,
          provider
            ? "provider check: configured; submit a short prompt to verify live streaming"
            : "provider check: set NATALIA_OPENAI_API_KEY (or OPENAI_API_KEY), or configure the active Go profile at ~/.config/natalia-cli/config.yaml, then restart the TUI",
          "safety: write/shell/process actions require approval unless permissionMode=auto is explicitly configured by a caller",
        ].join("\n"),
      });
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      publish(statusSnapshot(provider, context, workspaceRoot));
      return true;
    }
    if (trimmed === "/status") {
      const snapshot = statusSnapshot(provider, context, workspaceRoot);
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
    if (trimmed === "/sessions") {
      const rows = sqliteStore
        ? sqliteStore.list()
        : await sessionStore.list();
      const sessions = Array.isArray(rows) ? rows : rows;
      publish({
        type: "content.delta",
        id,
        text: (sessions as Array<{ id: string; title: string; eventCount?: number }>).length
          ? (sessions as Array<{ id: string; title: string; eventCount?: number }>)
              .map(
                (item) =>
                  `${item.id}  ${item.title}  ${"eventCount" in item ? item.eventCount : 0} events`,
              )
              .join("\n")
          : "no TS sessions found in this workspace",
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
      );
      publish({ type: "content.delta", id, text: result.output });
      publish({ type: "content.done", id });
      publish({
        type: "turn.finished",
        id,
        stopReason: result.ok ? "done" : "error",
      });
      publish(statusSnapshot(provider, context, workspaceRoot));
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

  async function runProviderTurn(id: string, text: string) {
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
    if (tsRuntimeConfig?.instructions.enabled) {
      const mode = tsRuntimeConfig.modes[tsRuntimeConfig.defaultMode];
      if (mode?.systemPrompt)
        messages.unshift({ role: "system", content: mode.systemPrompt });
    }
    let assistant = "";
    try {
      for (let step = 0; step < maxSteps; step++) {
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
      publish({ type: "content.done", id });
      publish({ type: "turn.finished", id, stopReason: "done" });
      publish(statusSnapshot(provider, context, workspaceRoot));
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
          toolLayer.isToolAllowed(name) &&
          (!activeSkill || authorizeSkillTool(activeSkill, tool.name, { mode: "default" })),
      ),
    );
    const materialized = materializeTools(tools, advertised);
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
          tools: materialized.definitions,
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
    if (output.calls.length) {
      if (output.thinking) publish({ type: "thinking.done", id });
      if (output.assistant) publish({ type: "content.done", id });
        const produced = await executeToolCalls(
          id,
          output.calls,
          output.assistant,
          materialized,
      );
      toolMessages.push(...produced);
      messages.push(...produced);
    }
    if (output.assistant && !toolMessages.length)
      messages.push({ role: "assistant", content: output.assistant });
    return { assistant: output.assistant, toolMessages };
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
      await compactContext(
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
          content: `ERROR: ${reason}`,
        });
        continue;
      }
      const result = await executeOneTool(turnID, call, resolved.tool);
      messages.push({ role: "tool", toolCallID: call.id, content: result });
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
        const detail = paramErrors.map((e) => `${e.path}: ${e.message}`).join("; ");
        throw new Error(`tool "${tool.name}" parameter validation failed: ${detail}`);
      }
      const completeResult = await tool.execute(parsed, {
        workspaceRoot,
        signal: activeAbort?.signal,
        askQuestion: async (question) =>
          await requireQuestion(`${toolID}:question`, question),
        subagents,
        interactivePTY,
        onPTYUpdate: (pty) =>
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
          }),
        sandboxes,
        settings: toolSettings(),
        onSandboxEvent: (event) => publish(event as RuntimeEvent),
      });
      const bounded = await boundToolOutput(workspaceRoot, completeResult);
      const result = bounded.text;
      publish({
        type: "tool.update",
        id: toolID,
        name: tool.name,
        callID: call.id,
        status: "succeeded",
        summary: result.slice(0, 200),
        result,
        metadata: bounded.outputPath ? { outputPath: bounded.outputPath } : undefined,
        endedAt: Date.now(),
      });
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

  function restoreApprovalStateFromEvents(events: RuntimeEvent[]) {
    const requested = new Set<string>();
    const responded = new Set<string>();
    for (const event of events) {
      if (event.type === "approval.request") requested.add(event.id);
      if (event.type === "approval.response") responded.add(event.id);
    }
    for (const id of requested) {
      if (!responded.has(id)) {
        pendingApprovalRequests.add(id);
        publish({
          type: "diagnostic",
          level: "warning",
          message: `Recovered unresolved approval record ${id}; approval can be answered through RuntimeClient/transport, but active tool execution must be resubmitted if the original turn was interrupted.`,
        });
      }
    }
  }

  function restoreResponsesFromEvents(events: RuntimeEvent[]) {
    for (const event of events) {
      if (event.type === "approval.response")
        pendingApprovals.set(event.id, {
          requestID: event.id,
          decision: event.decision,
          feedback: event.feedback,
        });
      if (event.type === "question.response")
        pendingQuestions.set(event.id, {
          requestID: event.id,
          answers: event.answers,
          rejected: event.rejected,
        });
    }
  }

  function lastProviderUsageSnapshot() {
    return lastProviderUsage;
  }

  function toolSettings() {
    return {
      webSearchEndpoint: tsRuntimeConfig?.webSearch.endpoint ?? undefined,
      browserBinary: tsRuntimeConfig?.browser.binary || undefined,
      allowedHosts: tsRuntimeConfig?.network.allowedHosts,
      allowLocalhost: tsRuntimeConfig?.network.allowLocalhost,
      allowPrivate: tsRuntimeConfig?.network.allowPrivate,
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
  if (existing) return Promise.resolve(existing);
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => finish(() => reject(new Error(timeoutMessage))), 5 * 60_000);
    const abort = () => finish(() => reject(signal?.reason ?? new Error("request cancelled")));
    const finish = (settle: () => void) => {
      clearTimeout(timeout);
      waiters.delete(id);
      signal?.removeEventListener("abort", abort);
      settle();
    };
    waiters.set(id, (response) => finish(() => resolve(response)));
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
): Extract<RuntimeEvent, { type: "status.snapshot" }> {
  const status = context.journalStatus();
  return {
    type: "status.snapshot",
    model: provider?.model ?? "not-configured",
    provider: provider?.provider ?? "not-configured",
    context: `${status.tokenEstimate} tokens`,
    step: `${status.messageCount}`,
    permissions: "ask",
    cwd,
    background: "0 running",
  };
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

function sessionSeed(workspaceRoot: string) {
  return createHash("sha256").update(workspaceRoot).digest("hex").slice(0, 12);
}

function lineCount(text: string) {
  return text.length === 0 ? 0 : text.split(/\r\n|\r|\n/u).length;
}
