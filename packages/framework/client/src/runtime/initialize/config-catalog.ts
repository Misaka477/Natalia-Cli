import type {
  InitializeCatalogResult,
  InitializeOptions,
  RuntimeContext,
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
  deps.reloadPermissionSettings(tsConfig.config);
  return { runtimeConfig, tsConfig };
}
