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
import { createRetryService } from "@natalia/retry";
import { createSandboxController, sandboxTools } from "@natalia/sandbox";
import { agentTools, createSubagentsController } from "@natalia/subagents";
import { createToolPolicyService } from "@natalia/tool-policy";
import {
  COLLABORATION_SERVICE,
  collaborationTools,
  createCollaborationService,
  createInteractiveWaiter,
} from "@natalia/collaboration";
import { findWorkspaceFiles, searchWorkspaceFiles } from "@natalia/platform";
import {
  createMutationRegistry,
  createWorkspaceFilesController,
  createWorkspaceWriteLock,
  type WorkspaceMutationIdentity,
} from "@natalia/workspace";
import type { SessionID } from "@natalia/contracts";
import type { PluginCommandInvocation } from "@natalia/plugin";
import {
  ATTACHMENT_SERVICE,
  CHECKPOINT_FACTORY_SERVICE,
  COMPACTION_SERVICE,
  COLLABORATION_WAITER_SERVICE,
  CONTEXT_LEDGER_FACTORY_SERVICE,
  LOCAL_TOOLS_INPUT_SERVICE,
  MCP_INPUT_SERVICE,
  RETRY_SERVICE,
  SANDBOX_SERVICE,
  SKILLS_INPUT_SERVICE,
  SUBAGENTS_SERVICE,
  TERMINAL_INPUT_SERVICE,
  TOOL_POLICY_SERVICE,
  WORKSPACE_FILES_SERVICE,
  WORKSPACE_MUTATIONS_SERVICE,
  WORKSPACE_WRITE_LOCK_SERVICE,
  type AttachmentService,
  type CompactionService,
  type ContextLedgerFactory,
  type RetryService,
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

export type { FrameworkServices } from "../context";

export async function wireFrameworkServices(
  ctx: RuntimeContext,
  options: InitializeOptions,
): Promise<FrameworkServices> {
  const registry = ctx.state.capabilityRegistry;
  const workspaceRoot = ctx.ports.getWorkspaceRoot();
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
  sandboxOwner.contribute("services", SANDBOX_SERVICE, sandbox);
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
  });
  subagentsOwner.contribute("services", SUBAGENTS_SERVICE, subagents);
  for (const tool of agentTools()) {
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
  collaborationOwner.contribute(
    "services",
    COLLABORATION_WAITER_SERVICE,
    createInteractiveWaiter(ctx.state.waiterDeps),
  );
  const collaborationService = createCollaborationService({
    events: (sessionID) =>
      ctx.ports.getExecutionBySession().get(sessionID)?.session.events,
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
    events: (sessionID) =>
      ctx.ports.getExecutionBySession().get(sessionID)?.session.events,
    publish: (sessionID, event) => {
      const exec = ctx.ports.getExecutionBySession().get(sessionID);
      if (exec) ctx.ports.publishForSession(exec, event);
    },
    redact: (text) => ctx.ports.redactToolOutput(text, true),
    nextMailboxSequence: ctx.ports.nextMailboxSequence,
    requestWake: (sessionID) => {
      const exec = ctx.ports.getExecutionBySession().get(sessionID);
      if (exec) ctx.ports.requestNaviWake(exec);
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
  checkpointOwner.contribute("services", CHECKPOINT_FACTORY_SERVICE, factory);
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
        const sandboxService =
          ctx.ports.resolveService<SandboxService>(SANDBOX_SERVICE);
        const result = await runCheckpointCommand(
          controller.get(),
          exec.context,
          invocation.raw,
          controller.rollbackOptions(),
          async () => {
            if (!sandboxService)
              throw new Error("sandbox controller unavailable");
            return (await sandboxService.referencedObjectIDs()) ?? new Set();
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

  const pluginInputOwner = registry.registerOwner({
    id: "natalia-plugin-inputs",
    name: "Plugin Inputs",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services"],
  });
  let pluginInputDisposers: Array<() => void> = [];
  function refreshPluginInputs() {
    for (const disposeInput of pluginInputDisposers.splice(0).reverse())
      disposeInput();
    const config = ctx.ports.getTsRuntimeConfig();
    if (!config) return;
    const contribute = (name: string, value: unknown) => {
      if (value !== undefined)
        pluginInputDisposers.push(
          pluginInputOwner.contribute("services", name, value),
        );
    };
    contribute(
      LOCAL_TOOLS_INPUT_SERVICE,
      ctx.state.initialize.localToolsPluginInput(config),
    );
    contribute(MCP_INPUT_SERVICE, ctx.state.initialize.mcpPluginInput(config));
    contribute(
      SKILLS_INPUT_SERVICE,
      ctx.state.initialize.skillsPluginInput(config),
    );
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
    contribute(TERMINAL_INPUT_SERVICE, terminal);
  }
  refreshPluginInputs();

  const retryOwner = registry.registerOwner({
    id: "natalia-retry",
    name: "Retry",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services"],
  });
  const retry: RetryService = createRetryService({
    policy: () => ctx.ports.getRetryPolicy(),
  });
  retryOwner.contribute("services", RETRY_SERVICE, retry);

  const contextLedgerOwner = registry.registerOwner({
    id: "natalia-context-ledger",
    name: "Context Ledger",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services"],
  });
  const contextLedgerFactory: ContextLedgerFactory =
    createContextLedgerFactory();
  contextLedgerOwner.contribute(
    "services",
    CONTEXT_LEDGER_FACTORY_SERVICE,
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
  attachmentOwner.contribute("services", ATTACHMENT_SERVICE, attachments);
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
  workspaceOwner.contribute(
    "services",
    WORKSPACE_WRITE_LOCK_SERVICE,
    createWorkspaceWriteLock(),
  );
  workspaceOwner.contribute("services", WORKSPACE_MUTATIONS_SERVICE, mutations);
  workspaceOwner.contribute("services", WORKSPACE_FILES_SERVICE, files);
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
  toolPolicyOwner.contribute(
    "services",
    TOOL_POLICY_SERVICE,
    createToolPolicyService(),
  );

  // Compaction: depends on the retry and context-ledger subsystems wired above.
  const compactionOwner = registry.registerOwner({
    id: "natalia-compaction",
    name: "Compaction",
    version: "1.0.0",
    scope: "workspace",
    grants: ["services"],
  });
  const compaction: CompactionService = createCompactionService({ retry });
  compactionOwner.contribute("services", COMPACTION_SERVICE, compaction);

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
