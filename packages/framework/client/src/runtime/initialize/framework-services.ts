/**
 * Framework subsystem composition — runtime/initialize/framework-services.ts.
 *
 * Sandbox, checkpoint, runtime config, retry, context ledger, attachments,
 * workspace, tool policy, compaction, session store, provider/model execution,
 * turn orchestration, runtime status, work ledger and governance ledger are
 * framework-internal subsystems, not plugins. This module is the one direct
 * composition seam: it constructs their controllers/services from the framework
 * packages and registers the same service contracts the plugin wrappers used to
 * provide, so every runtime consumer keeps resolving the kernel services
 * unchanged. The host owns close and reload (config refresh) through the
 * returned handle.
 */
import { createAttachmentService } from "@natalia/attachments";
import { createCheckpointFactory } from "@natalia/checkpoint";
import { createCompactionService } from "@natalia/compaction";
import { createContextLedgerFactory } from "@natalia/context-ledger";
import { RUNTIME_CONFIG_SERVICE } from "@natalia/runtime-config";
import { runCheckpointCommand } from "@natalia/runtime";
import { createRetryService, retryService } from "@natalia/retry";
import { compactionService } from "@natalia/compaction";
import { checkpointFactory } from "@natalia/checkpoint";
import { contextLedgerFactory as contextLedgerFactoryToken } from "@natalia/context-ledger";
import { createSandboxController, sandboxTools } from "@natalia/sandbox";
import { agentTools, createSubagentsController } from "@natalia/subagents";
import { createToolPolicyService, toolPolicy } from "@natalia/tool-policy";
import {
  COLLABORATION_SERVICE,
  collaborationTools,
  collaborationWaiter,
  createCollaborationService,
  createInteractiveWaiter,
} from "@natalia/collaboration";
import type { ServiceToken } from "@natalia/runtime-services";
import {
  findWorkspaceFiles,
  migrateLegacyWorkspaceStore,
  searchWorkspaceFiles,
} from "@natalia/platform";
import { createSessionHistoryTool } from "../session-history-tool";
import {
  createPlanDocListTool,
  createPlanDocReadTool,
  createPlanDocTickTool,
  createPlanPauseTool,
} from "../plan-doc-tools";
import {
  createConstitutionProposeTool,
  createPlanProposeTool,
  createWorkContractReadTool,
  createDetourDeclareTool,
} from "../plan-contract-tools";
import { createWorkGraphQueryTool } from "../work-graph-tools";
import { attachmentService as attachmentServiceToken } from "@natalia/attachments";
import {
  createDriftAcknowledgeTool,
  createRecordCompletionTool,
  createRecordDecisionTool,
  createRecordValidationTool,
} from "../record-tools";
import {
  createMutationRegistry,
  createWorkspaceFilesController,
  createWorkspaceWriteLock,
  workspaceFiles,
  workspaceMutations,
  workspaceWriteLock,
  type WorkspaceMutationIdentity,
} from "@natalia/workspace";
import type { RuntimeEvent, SessionID } from "@natalia/contracts";
import type { PluginCommandInvocation } from "@natalia/plugin";
import {
  localToolsInput,
  mcpInput,
  sandboxService,
  skillsInput,
  subagentsService,
  terminalInput,
  type SandboxService,
  type TerminalInput,
} from "@natalia/runtime-services";
import type {
  FrameworkServices,
  InitializeOptions,
  RuntimeContext,
} from "../context";
import { wireGovernanceLedger } from "./framework-governance-ledger";
import { wireProviderModel } from "./framework-provider-model";
import { wireRuntimeStatus } from "./framework-runtime-status";
import { wireSessionStore } from "./framework-session-store";
import { wireTurnOrchestration } from "./framework-turn-orchestration";
import { wireWorkLedger } from "./framework-work-ledger";
import type {
  AttachmentService,
  CompactionService,
  RetryService,
} from "@natalia/runtime";

export type { FrameworkServices } from "../context";
import type { ContextLedgerFactory } from "@natalia/context-ledger";

export async function wireFrameworkServices(
  ctx: RuntimeContext,
  options: InitializeOptions,
): Promise<FrameworkServices> {
  const registry = ctx.state.capabilityRegistry;
  const workspaceRoot = ctx.ports.getWorkspaceRoot();
  // §1.6: before anything opens a store, move a legacy workspace-local
  // store (checkpoints/objects/chunks) outside the workspace. Idempotent
  // and gated on the opt-in: an explicit checkpointDir means the user chose
  // the portable layout, and their data stays put.
  if (options.checkpointDir === undefined && options.sessionDir === undefined) {
    try {
      const moved = await migrateLegacyWorkspaceStore(workspaceRoot);
      if (moved > 0)
        ctx.ports.publish({
          type: "diagnostic",
          level: "info",
          message: `checkpoint store migrated to the external store (${moved} moved)`,
        });
    } catch (error) {
      // An unwritable home must not stop the boot and must not pretend:
      // the store resolves workspace-local (every path resolver degrades the
      // same way) and this line is the visible record that the rescue ring
      // is tied to this workspace for now.
      ctx.ports.publish({
        type: "diagnostic",
        level: "warning",
        message: `external store unavailable (${error instanceof Error ? error.message : String(error)}); checkpoint store runs workspace-local — the rescue ring is tied to this workspace`,
      });
    }
  }
  const closeHandles: Array<() => void> = [];
  const dispose = () => {
    for (const handle of closeHandles.reverse()) handle();
  };

  const sandboxOwner = registry.registerOwner({
    id: "natalia-sandbox",
    name: "Sandbox",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services", "tools"],
  });
  const sandbox = createSandboxController({
    workspaceRoot,
    backend: () => ctx.ports.getTsRuntimeConfig()?.sandbox.backend,
  });
  // The service binds through the directory; the owner stays for the tools
  // contribution below.
  ctx.state.serviceDirectory.provide(sandboxService, sandbox);
  for (const tool of sandboxTools()) {
    sandboxOwner.contribute("tools", tool.name, tool);
    if (ctx.state.tools.get(tool.name))
      throw new Error(`framework tool already registered: ${tool.name}`);
    ctx.state.tools.set(tool.name, tool);
  }

  const subagentsOwner = registry.registerOwner({
    id: "natalia-subagents",
    name: "Subagents",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services", "tools"],
  });
  const subagents = createSubagentsController({
    workDir: workspaceRoot,
    sessionID: ctx.ports.getSessionID,
    // Bounds a run that is stuck rather than merely slow: without it such a run
    // continues until the session ends, paying for every step it takes.
    wallClockBudgetMs:
      ctx.ports.getTsRuntimeConfig()?.runtime.subagentWallClockMs,
  });
  ctx.state.serviceDirectory.provide(subagentsService, subagents);
  // The configured subagent-mode agents are the spawnable types. Advertising
  // them without saying what tools each one has leaves the model guessing, which
  // is the one distinction the choice turns on.
  const agentTypeViews = (ctx.ports.getAgentRegistry()?.list() ?? []).map(
    (agent) => ({
      name: agent.name,
      description: agent.description,
      mode: agent.mode,
      allowedTools: agent.allowedTools,
      excludedTools: agent.excludedTools,
    }),
  );
  for (const tool of agentTools(agentTypeViews)) {
    subagentsOwner.contribute("tools", tool.name, tool);
    if (ctx.state.tools.get(tool.name))
      throw new Error(`framework tool already registered: ${tool.name}`);
    ctx.state.tools.set(tool.name, tool);
  }

  const collaborationOwner = registry.registerOwner({
    id: "natalia-collaboration",
    name: "Collaboration",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services", "tools"],
  });
  // The waiter binds through the service directory: the token's id is the
  // wire name this contribution always used, and the channel gives it the same
  // per-owner disposal and update semantics the registry provides directly.
  ctx.state.serviceDirectory.provide(
    collaborationWaiter,
    createInteractiveWaiter(ctx.state.waiterDeps),
  );
  // Collaboration tools/services must see the whole collab+mailbox slice even
  // when the execution keeps only its fast-attach tail; the hot state carries
  // that slice once completed (tool pre-stage + the snapshot scheduler do so).
  const collaborationEventsFor = (
    sessionID: SessionID,
  ): RuntimeEvent[] | undefined => {
    const exec = ctx.ports.getExecutionBySession().get(sessionID);
    if (!exec) return undefined;
    return exec.factStateComplete === true && exec.factState
      ? exec.factState.collaborationEvents
      : exec.session.events;
  };
  const collaborationService = createCollaborationService({
    events: collaborationEventsFor,
    publish: (sessionID, event) => {
      const exec = ctx.ports.getExecutionBySession().get(sessionID);
      if (exec) ctx.ports.publishForSession(exec, event);
    },
    nextSequence: ctx.ports.nextCollabSequence,
    maxAutoRounds: () =>
      ctx.ports.getTsRuntimeConfig()?.runtime.collaboration.maxAutoRounds ?? 3,
  });
  collaborationOwner.contribute(
    "services",
    COLLABORATION_SERVICE,
    collaborationService,
  );
  for (const tool of collaborationTools({
    events: collaborationEventsFor,
    publish: (sessionID, event) => {
      const exec = ctx.ports.getExecutionBySession().get(sessionID);
      if (exec) ctx.ports.publishForSession(exec, event);
    },
    redact: (text) => ctx.ports.redactToolOutput(text, true),
    nextMailboxSequence: ctx.ports.nextMailboxSequence,
    requestWake: (sessionID, request) => {
      const exec = ctx.ports.getExecutionBySession().get(sessionID);
      if (!exec) return;
      const recipient = request?.recipient ?? "live_chat";
      if (recipient === "live_chat") {
        ctx.ports.requestNaviWake(exec);
      } else if (recipient === "nia") {
        ctx.ports.requestNiaWake(exec);
      } else {
        ctx.ports.wakeMainForCollaboration(
          exec,
          request?.messageID ?? "collab-wake",
          request?.kind ?? "chat message",
          request?.source === "nia" ? "Nia" : "Navi",
        );
      }
    },
    maxAutoRounds: () =>
      ctx.ports.getTsRuntimeConfig()?.runtime.collaboration.maxAutoRounds ?? 3,
    service: collaborationService,
  })) {
    collaborationOwner.contribute("tools", tool.name, tool);
    if (ctx.state.tools.get(tool.name))
      throw new Error(`framework tool already registered: ${tool.name}`);
    ctx.state.tools.set(tool.name, tool);
  }

  // Model-facing transcript paging: the model can turn through older history
  // with the returned cursor instead of the runtime pre-loading the journal.
  const sessionHistoryTool = createSessionHistoryTool(ctx);
  if (ctx.state.tools.get(sessionHistoryTool.name))
    throw new Error(
      `framework tool already registered: ${sessionHistoryTool.name}`,
    );
  ctx.state.tools.set(sessionHistoryTool.name, sessionHistoryTool);

  // ADR D4/B3: the main agent reads the plan document itself — the plan正文
  // is never injected into any prompt. Register the plan read tools so the
  // main agent has the same plan-document access Navi and Nia have, plus the
  // WorkContract proposal/read tools (EI §8.4).
  for (const tool of [
    createPlanDocListTool(ctx),
    createPlanDocReadTool(ctx),
    createPlanDocTickTool(ctx),
    createPlanPauseTool(ctx),
    createPlanProposeTool(ctx),
    createWorkContractReadTool(ctx),
    createDetourDeclareTool(ctx),
    createWorkGraphQueryTool(ctx),
    // EI §8.4: model-facing journal record tools.
    createRecordValidationTool(ctx),
    createRecordCompletionTool(ctx),
    createRecordDecisionTool(ctx),
    createConstitutionProposeTool(ctx),
    createDriftAcknowledgeTool(ctx),
  ]) {
    if (ctx.state.tools.get(tool.name))
      throw new Error(`framework tool already registered: ${tool.name}`);
    ctx.state.tools.set(tool.name, tool);
  }

  const checkpointOwner = registry.registerOwner({
    id: "natalia-checkpoint",
    name: "Checkpoint",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services", "commands"],
  });
  const factory = createCheckpointFactory({
    workspaceRoot,
    checkpointDir: options.checkpointDir,
  });
  ctx.state.serviceDirectory.provide(checkpointFactory, factory);
  for (const name of ["checkpoint", "checkpoints", "rollback"])
    checkpointOwner.contribute("commands", name, {
      name,
      title: `${name[0]!.toUpperCase()}${name.slice(1)}`,
      async run(invocation: PluginCommandInvocation) {
        if (!invocation?.sessionID)
          throw new Error("checkpoint command requires a session");
        const sessionID = invocation.sessionID as SessionID;
        const exec = await ctx.ports.ensureExecution(sessionID);
        const controller = await ctx.ports.initializeCheckpointController(exec);
        if (!controller)
          throw new Error(
            "checkpoint controller unavailable (natalia-checkpoint)",
          );
        if (!controller.isEnabled())
          throw new Error("checkpoint store is not initialized");
        const sandboxes =
          ctx.state.serviceDirectory.getOptional(sandboxService);
        const result = await runCheckpointCommand(
          controller.get(),
          exec.context,
          invocation.raw,
          controller.rollbackOptions(),
          async () => {
            if (!sandboxes) throw new Error("sandbox controller unavailable");
            return (await sandboxes.referencedObjectIDs()) ?? new Set();
          },
        );
        return result.output;
      },
    });

  // Runtime config: contributed by name so tool families and plugins resolve
  // the resolved config and subscribe to its updates. Reload re-contributes it
  // (dispose-then-provide) so subscribers observe the replacement.
  let runtimeConfigDispose: (() => void) | undefined;
  const runtimeConfigOwner = registry.registerOwner({
    id: "natalia-runtime-config",
    name: "Runtime Config",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services"],
  });
  function refreshRuntimeConfig() {
    const config = ctx.ports.getTsRuntimeConfig();
    runtimeConfigDispose?.();
    runtimeConfigDispose = config
      ? runtimeConfigOwner.contribute(
          "services",
          RUNTIME_CONFIG_SERVICE,
          config,
        )
      : undefined;
  }
  refreshRuntimeConfig();

  let pluginInputDisposers: Array<() => void> = [];
  function refreshPluginInputs() {
    for (const disposeInput of pluginInputDisposers.splice(0).reverse())
      disposeInput();
    const config = ctx.ports.getTsRuntimeConfig();
    if (!config) return;
    // Host inputs bind through the service directory: one owner per binding
    // with the same dispose-then-provide reload semantics the owner channel
    // had, and the wire name is the token's id on both sides of the boundary.
    const provide = <T>(token: ServiceToken<T>, value: T | undefined) => {
      if (value !== undefined)
        pluginInputDisposers.push(
          ctx.state.serviceDirectory.provide(token, value),
        );
    };
    provide(
      localToolsInput,
      ctx.state.initialize.localToolsPluginInput(config),
    );
    provide(mcpInput, ctx.state.initialize.mcpPluginInput(config));
    provide(skillsInput, ctx.state.initialize.skillsPluginInput(config));
    const terminal: TerminalInput = {
      workspaceRoot,
      publish: (event) =>
        ctx.ports.publishForSession(
          event.sessionID
            ? ctx.ports
                .getExecutionBySession()
                .get(event.sessionID as SessionID)
            : undefined,
          event,
        ),
      onPerformance: (name, durationMs) =>
        ctx.ports.getPerformanceTrace().mark(name, durationMs),
      runtimeID: ctx.ports.getNativeRuntimeID,
      userRuntimeHome: ctx.ports.getUserRuntimeHome,
      windowMode: () =>
        ctx.ports.getTsRuntimeConfig()?.runtime.terminal.windowMode ?? "auto",
      backend: options.nativeTerminal
        ? "wezterm"
        : ctx.ports.getTsRuntimeConfig()?.runtime.terminal.backend === "wezterm"
          ? "wezterm"
          : "pty",
      ...(options.nativeTerminal ? { external: options.nativeTerminal } : {}),
    };
    provide(terminalInput, terminal);
  }
  refreshPluginInputs();

  const retry: RetryService = createRetryService({
    policy: () => ctx.ports.getRetryPolicy(),
  });
  ctx.state.serviceDirectory.provide(retryService, retry);

  const contextLedgerOwner = registry.registerOwner({
    id: "natalia-context-ledger",
    name: "Context Ledger",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services"],
  });
  const contextLedgerFactory: ContextLedgerFactory =
    createContextLedgerFactory();
  ctx.state.serviceDirectory.provide(
    contextLedgerFactoryToken,
    contextLedgerFactory,
  );

  const attachmentOwner = registry.registerOwner({
    id: "natalia-attachment",
    name: "Attachment",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services", "commands"],
  });
  const attachments: AttachmentService = createAttachmentService(workspaceRoot);
  // The service binds through the directory; the owner stays for the attach
  // command below.
  ctx.state.serviceDirectory.provide(attachmentServiceToken, attachments);
  attachmentOwner.contribute("commands", "attach", {
    name: "attach",
    title: "Attach",
    async run(invocation: PluginCommandInvocation) {
      if (!invocation?.sessionID)
        throw new Error("attachment command requires a session");
      const [path, ...prompt] = invocation.args;
      if (!path || !prompt.length)
        throw new Error("usage: /attach <workspace-relative-image> <prompt>");
      await ctx.ports.submitInput(
        { text: prompt.join(" "), attachments: [path] },
        invocation.sessionID as SessionID,
      );
    },
  });

  const workspaceOwner = registry.registerOwner({
    id: "natalia-workspace",
    name: "Workspace",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services", "commands"],
  });
  const mutations = createMutationRegistry();
  const files = createWorkspaceFilesController({
    workspaceRoot,
    listPaths: async () =>
      (await findWorkspaceFiles({ workspaceRoot, limit: 1000 }))
        .filter((entry) => entry.type === "file")
        .map((entry) => entry.path),
    resolveMutation: (path) => {
      const mutation = mutations.match({ path, operation: "modified" });
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
  try {
    await files.init();
  } catch (error) {
    files.close();
    throw error;
  }
  ctx.state.serviceDirectory.provide(
    workspaceWriteLock,
    createWorkspaceWriteLock(),
  );
  ctx.state.serviceDirectory.provide(workspaceMutations, mutations);
  ctx.state.serviceDirectory.provide(workspaceFiles, files);
  workspaceOwner.contribute("commands", "files", {
    name: "files",
    title: "Find workspace files",
    async run(invocation: PluginCommandInvocation) {
      const query = invocation?.args.join(" ").trim();
      const found = await findWorkspaceFiles({
        workspaceRoot,
        query: query || undefined,
        limit: 50,
      });
      return found.length
        ? found.map((file) => file.path).join("\n")
        : "no workspace files found";
    },
  });
  workspaceOwner.contribute("commands", "search", {
    name: "search",
    title: "Search workspace files",
    async run(invocation: PluginCommandInvocation) {
      const query = invocation?.args.join(" ").trim();
      if (!query) throw new Error("/search requires a query");
      const matches = await searchWorkspaceFiles({
        workspaceRoot,
        query,
        limit: 50,
      });
      return matches.length
        ? matches
            .map((match) => `${match.path}:${match.line}:${match.text}`)
            .join("\n")
        : "no workspace matches found";
    },
  });

  const toolPolicyOwner = registry.registerOwner({
    id: "natalia-tool-pipeline",
    name: "Tool Pipeline",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services"],
  });
  ctx.state.serviceDirectory.provide(toolPolicy, createToolPolicyService());

  // Compaction: depends on the retry and context-ledger subsystems wired above.
  const compactionOwner = registry.registerOwner({
    id: "natalia-compaction",
    name: "Compaction",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services"],
  });
  const compaction: CompactionService = createCompactionService({ retry });
  ctx.state.serviceDirectory.provide(compactionService, compaction);

  // Remaining framework subsystems are wired in dependency order:
  // session store (attachments) -> work ledger -> governance ledger (work
  // ledger) -> provider/model execution -> turn orchestration (session store)
  // -> runtime status.
  const sessionStore = wireSessionStore(ctx, options, attachments);
  closeHandles.push(sessionStore.close);
  wireWorkLedger(ctx);
  wireGovernanceLedger(ctx);
  const providerModel = wireProviderModel(ctx);
  closeHandles.push(providerModel.close);
  const turnOrchestration = wireTurnOrchestration(ctx);
  closeHandles.push(turnOrchestration.close);
  const runtimeStatus = wireRuntimeStatus(ctx);
  closeHandles.push(runtimeStatus.close);

  return {
    refreshRuntimeConfig() {
      refreshRuntimeConfig();
      refreshPluginInputs();
    },
    close() {
      dispose();
      files.close();
      for (const disposeInput of pluginInputDisposers.splice(0).reverse())
        disposeInput();
      runtimeConfigDispose?.();
      runtimeConfigDispose = undefined;
    },
  };
}
