import type {
  InitializeCatalogResult,
  InitializeOptions,
  RuntimeContext,
  RuntimeEvent,
  SessionID,
} from "../context";

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
  const terminalWindowMode = () =>
    ctx.ports.getTsRuntimeConfig()?.runtime.terminal.windowMode ?? "auto";
  const terminal = {
    workspaceRoot: ctx.ports.getWorkspaceRoot(),
    publish: (event: RuntimeEvent) =>
      ctx.ports.publishForSession(
        event.sessionID
          ? ctx.ports.getExecutionBySession().get(event.sessionID as SessionID)
          : undefined,
        event,
      ),
    onPerformance: (name: string, durationMs: number) =>
      ctx.ports.getPerformanceTrace().mark(name, durationMs),
    runtimeID: ctx.ports.getNativeRuntimeID,
    userRuntimeHome: ctx.ports.getUserRuntimeHome,
    windowMode: terminalWindowMode,
    external: options.nativeTerminal,
  } as const;
  ctx.ports.setBuildRuntimePluginCatalog((runtimeConfig) => {
    const enabled = (id: string) => runtimeConfig.plugins.enabled[id] !== false;
    const localTools = deps.localToolsPluginInput(runtimeConfig);
    return deps.runtimePluginCatalog({
      askEnabled: enabled("natalia-tool-ask"),
      fsReadEnabled: enabled("natalia-tool-fs-read"),
      fsWriteEnabled: enabled("natalia-tool-fs-write"),
      pdfEnabled: enabled("natalia-tool-pdf"),
      processEnabled: enabled("natalia-tool-process"),
      searchEnabled: enabled("natalia-tool-search"),
      shellEnabled: enabled("natalia-tool-shell"),
      terminalEnabled: enabled("natalia-tool-terminal"),
      todoEnabled: enabled("natalia-tool-todo"),
      webEnabled: enabled("natalia-tool-web"),
      terminal,
      ...(deps.skillsPluginInput(runtimeConfig)
        ? {
            skills: deps.skillsPluginInput(runtimeConfig),
          }
        : {}),
      ...(options.taskModuleContext
        ? { taskModule: options.taskModuleContext }
        : {}),
      ...(localTools ? { localTools } : {}),
      ...(deps.mcpPluginInput(runtimeConfig)
        ? { mcp: deps.mcpPluginInput(runtimeConfig) }
        : {}),
      ...(enabled("natalia-team")
        ? {
            team: {
              enabled: ctx.ports.extensionEnabled("skills"),
            },
          }
        : {}),
      taskWorkflow: {
        enabled: enabled("natalia-task-workflow"),
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
    });
  });
  return { runtimeConfig, tsConfig };
}
