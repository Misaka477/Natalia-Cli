import type {
  InitializeCatalogResult,
  InitializeOptions,
  RuntimeContext,
  RuntimeEvent,
  SandboxService,
  SessionID,
  StatusSnapshotController,
  SubagentsService,
} from "../context";
import { EGRESS_ADVISORY } from "../../egress-advisory";

export async function configureCatalog(
  ctx: RuntimeContext,
  options: InitializeOptions,
): Promise<InitializeCatalogResult> {
  const deps = ctx.state.initialize;
  const tsConfig = await deps.resolveConfig({
    workspaceRoot: ctx.ports.getWorkspaceRoot(),
    globalPath: options.globalConfigPath,
  });
  ctx.ports.setTsRuntimeConfig(tsConfig.config);
  const runtimeConfig = tsConfig.config;
  // The permission profile's extension gates (skills/mcp/plugins) must be
  // applied before the plugin catalog is assembled, or a disabled extension
  // would still load its plugin.
  deps.reloadPermissionSettings(tsConfig.config);
  ctx.ports.setBuildBuiltinPluginCatalog((runtimeConfig) => {
    const gates = deps.computeBuiltinPluginGates(runtimeConfig);
    const localTools = deps.localToolsPluginInput(runtimeConfig);
    return deps.builtinPluginCatalog({
      ...deps.computeBuiltinFeatureGates(ctx.ports.getTsRuntimeConfig()),
      ...(deps.skillsPluginInput(runtimeConfig)
        ? {
            skills: deps.skillsPluginInput(runtimeConfig),
          }
        : {}),
      ...(options.taskModuleContext
        ? { taskModule: options.taskModuleContext }
        : {}),
      ...(ctx.ports.getTsRuntimeConfig()
        ? { runtimeConfig: ctx.ports.getTsRuntimeConfig() }
        : {}),
      ...(localTools ? { localTools } : {}),
      workspace: deps.workspacePluginInput(runtimeConfig),
      terminal: deps.terminalPluginInput(runtimeConfig),
      sandbox: deps.sandboxPluginInput(runtimeConfig),
      ...(deps.mcpPluginInput(runtimeConfig)
        ? { mcp: deps.mcpPluginInput(runtimeConfig) }
        : {}),
      ...(gates.checkpoint
        ? {
            checkpoint: {
              workspaceRoot: ctx.ports.getWorkspaceRoot(),
              commands: {
                controller: async (sessionID: SessionID) => {
                  const exec = await ctx.ports.ensureExecution(sessionID);
                  return await ctx.ports.initializeCheckpointController(exec);
                },
                context: (sessionID: SessionID) => {
                  const exec = ctx.ports.getExecutionBySession().get(sessionID);
                  if (!exec) throw new Error(`session not found: ${sessionID}`);
                  return exec.context;
                },
                referencedObjectIDs: async () => {
                  const sandbox = ctx.ports.resolveService<SandboxService>(
                    deps.serviceNames.sandbox,
                  );
                  if (!sandbox)
                    throw new Error("sandbox controller unavailable");
                  return (await sandbox.referencedObjectIDs()) ?? new Set();
                },
              },
            },
          }
        : {}),
      ...(gates.subagents
        ? {
            subagents: {
              workDir: ctx.ports.getWorkspaceRoot(),
              sessionID: ctx.ports.getSessionID,
            },
          }
        : {}),
      ...(gates.attachment
        ? {
            attachment: {
              enabled: true,
              workspaceRoot: ctx.ports.getWorkspaceRoot(),
              commands: {
                submit: async (sessionID: SessionID, input) => {
                  await ctx.ports.submitInput(input, sessionID);
                },
              },
            },
          }
        : {}),
      ...(gates.sessionStore
        ? {
            sessionStore: {
              workspaceRoot: ctx.ports.getWorkspaceRoot(),
              sessionID: ctx.ports.getSessionID,
              sessionDir: options.sessionDir,
              useSqliteStore: options.useSqliteStore,
              title: options.title,
            },
          }
        : {}),
      ...(gates.team
        ? {
            team: {
              enabled: ctx.ports.extensionEnabled("skills"),
            },
          }
        : {}),
      ...(gates.toolPipeline ? { toolPipeline: { enabled: true } } : {}),
      ...(gates.collaboration
        ? {
            collaboration: {
              waiter: deps.waiterDeps,
              tools: {
                events: (sessionID: SessionID) =>
                  ctx.ports.getExecutionBySession().get(sessionID)?.session
                    .events,
                publish: (sessionID: SessionID, event: RuntimeEvent) => {
                  const exec = ctx.ports.getExecutionBySession().get(sessionID);
                  if (exec) ctx.ports.publishForSession(exec, event);
                },
                redact: (text: string) =>
                  ctx.ports.redactToolOutput(text, true),
                nextMailboxSequence: ctx.ports.nextMailboxSequence,
                nextCollabSequence: ctx.ports.nextCollabSequence,
                requestWake: (sessionID: SessionID) => {
                  const exec = ctx.ports.getExecutionBySession().get(sessionID);
                  if (exec) ctx.ports.requestNaviWake(exec);
                },
                maxAutoRounds: () =>
                  ctx.ports.getTsRuntimeConfig()?.runtime.collaboration
                    .maxAutoRounds ?? 3,
              },
            },
          }
        : {}),
      ...(gates.retry
        ? { retry: { enabled: true, policy: ctx.ports.getRetryPolicy } }
        : {}),
      compaction: deps.compactionPluginInput(runtimeConfig),
      providerModel: deps.providerModelPluginInput(runtimeConfig),
      taskWorkflow: {
        enabled: gates.taskWorkflow,
        controller: {
          workspaceRoot: ctx.ports.getWorkspaceRoot(),
          globalConfigPath: options.globalConfigPath,
          runtimeConfig: ctx.ports.getTsRuntimeConfig,
          capabilityViews: () => [
            deps.capabilityRegistry,
            ...(deps.workspaceCapabilityView
              ? [deps.workspaceCapabilityView]
              : []),
          ],
          publishDiagnostic: (message) =>
            ctx.ports.publish({
              type: "diagnostic",
              level: "warning",
              message,
            }),
          resolveFlowPermissions: deps.effectiveFlowPermissions,
          createRuntimeClient: deps.createRealRuntimeClient,
        },
      },
      ...(gates.contextLedger ? { contextLedger: { enabled: true } } : {}),
      workLedger: {
        enabled: gates.workLedger,
        controller: {
          openFindingIDs: () =>
            new Set(
              (ctx.ports.getSession()?.events ?? [])
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
        },
      },
      ...(gates.governanceLedger
        ? { governanceLedger: { enabled: true } }
        : {}),
      turnOrchestration: {
        enabled: gates.turnOrchestration,
        controller: {
          session: ctx.ports.getSession,
          activeAbort: () => ctx.ports.getActiveExec()?.activeAbort,
          sessionFor: (id) =>
            ctx.state.executionBySession.get(id as SessionID)?.session ??
            ctx.ports.getSession(),
          activeAbortFor: (id) =>
            ctx.state.executionBySession.get(id as SessionID)?.activeAbort,
          persist: (fn) => {
            const persistence = ctx.ports
              .getSessionPersistence()
              .then(fn)
              .catch((error) =>
                ctx.ports.publish({
                  type: "diagnostic",
                  level: "warning",
                  message: `session persistence deferred/failed: ${error instanceof Error ? error.message : String(error)}`,
                }),
              );
            ctx.ports.setSessionPersistence(persistence);
            return persistence;
          },
          saveInbox: async (snapshot) => {
            const sessionStore = ctx.ports.resolveService<
              import("@natalia/runtime-services").SessionStoreController
            >(deps.serviceNames.sessionStoreController);
            if (!sessionStore)
              throw new Error(
                "session store unavailable (natalia-session-store)",
              );
            await sessionStore.saveInbox(snapshot);
          },
          flush: async () => {
            await ctx.ports.getSessionPersistence();
          },
          runCommand: async (id, text, signal, ownerID) => {
            const owner = await ctx.ports.ensureExecution(ownerID as SessionID);
            ctx.ports.publishForSession(owner, { type: "turn.started", id });
            try {
              return await deps.handleCommand(id, text, signal, owner);
            } catch (error) {
              ctx.ports.publishForSession(owner, {
                type: "turn.cancelled",
                id,
                reason: error instanceof Error ? error.message : String(error),
              });
              throw error;
            } finally {
              deps.scheduleTitleGeneration(ownerID as SessionID);
            }
          },
          runTurn: async (input) => {
            deps.deliverQueuedMailboxAtBoundary(
              ctx.state.executionBySession.get(input.sessionID as SessionID),
            );
            try {
              const controller = ctx.ports.resolveService<
                import("@natalia/runtime-services").ProviderModelController
              >(deps.serviceNames.providerModelController);
              if (controller)
                await controller.runTurn(input.sessionID as SessionID, input);
              else {
                const exec = ctx.state.executionBySession.get(
                  input.sessionID as SessionID,
                );
                ctx.ports.publishForSession(exec, {
                  type: "diagnostic",
                  level: "error",
                  message: "Provider/model plugin is disabled.",
                });
                ctx.ports.publishForSession(exec, {
                  type: "turn.finished",
                  id: input.id,
                  stopReason: "error",
                });
              }
            } finally {
              deps.scheduleTitleGeneration(input.sessionID as SessionID);
            }
          },
        },
      },
      runtimeUi: {
        enabled: gates.runtimeUi,
        controller: {
          provider: ctx.ports.getProvider,
          context: ctx.ports.getRuntimeContext,
          workspaceRoot: ctx.ports.getWorkspaceRoot(),
          permissionMode: ctx.ports.getPermissionMode,
          runningCount: async () =>
            (ctx.ports
              .resolveService<SubagentsService>(deps.serviceNames.subagents)
              ?.runningCount() ?? 0) +
            (ctx.ports
              .resolveService<SandboxService>(deps.serviceNames.sandbox)
              ?.runningResourceCount() ?? 0) +
            ((await deps.capabilityRegistry
              .service<{
                runningCount(input: { workspaceRoot: string }): Promise<number>;
              }>("managedProcessRegistry")
              ?.runningCount({
                workspaceRoot: ctx.ports.getWorkspaceRoot(),
              })) ?? 0),
          publish: ctx.ports.publish,
          commands: {
            list: () =>
              ctx.ports.commandCatalogEntries().map((command) => ({
                name: command.name,
                title: command.title,
                description: command.description,
                acceptsArguments: command.acceptsArguments,
                category: command.category,
              })),
            session: async (sessionID: SessionID) => {
              const exec = ctx.state.executionBySession.get(sessionID);
              if (!exec) throw new Error(`session not found: ${sessionID}`);
              const statusController =
                ctx.ports.resolveService<StatusSnapshotController>(
                  deps.serviceNames.statusSnapshotController,
                );
              if (!statusController)
                throw new Error("runtime UI unavailable (natalia-runtime-ui)");
              return {
                provider: exec.provider,
                providerSource: ctx.ports.getProviderSource(),
                workspaceRoot: ctx.ports.getWorkspaceRoot(),
                sessionID,
                toolsSize: ctx.state.tools.size,
                selectedAgentName: exec.selectedAgent?.name,
                skillsCount: ctx.ports.skillsList().length,
                diagnostics: [
                  ...ctx.state.runtimeDiagnostics,
                  ...(ctx.state.runtimeDiagnosticsBySession.get(sessionID) ??
                    []),
                ],
                snapshot: await statusController.snapshotFor({
                  provider: exec.provider,
                  context: exec.context,
                  permissionMode: exec.permissionMode,
                }),
              };
            },
            publish: (sessionID: SessionID, event: RuntimeEvent) => {
              const exec = ctx.state.executionBySession.get(sessionID);
              if (!exec) throw new Error(`session not found: ${sessionID}`);
              ctx.ports.publishForSession(exec, event);
            },
            egressAdvisory: EGRESS_ADVISORY,
          },
        },
      },
    });
  });
  return { runtimeConfig, tsConfig };
}
