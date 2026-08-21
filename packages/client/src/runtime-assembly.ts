/**
 * Runtime plugin assembly.
 *
 * The composition root gathers a slim `RuntimeAssemblyHost` (the handful of
 * runtime accessors and services the catalog needs) and hands it to the
 * assembly builders below. Each builder returns the corresponding slice of the
 * built-in plugin catalog input, so the closure construction lives here rather
 * than in `real-runtime.ts`. This is the assembly seam introduced while
 * decomposing the composition root: the host is the explicit dependency set and
 * the builders are the closure groups.
 */
import type {
  ConfigV3,
  MCPServerConfig,
  RuntimeEvent,
  RuntimeWorkspaceFileEntry,
  SessionID,
} from "@natalia/contracts";
import type { RetryRunnerOptions } from "@natalia/runtime";
import type { ToolRegistry } from "@natalia/tools";
import type { NativeTerminalRegistry } from "@natalia/terminal-plugin";
import { builtinPluginCatalog } from "./builtin-plugins/catalog";
import type { RuntimePerformanceTrace } from "./performance-trace";
import type { SessionExecutionState } from "./real-runtime";

type CatalogInput = Parameters<typeof builtinPluginCatalog>[0];

export type RuntimeAssemblyHost = {
  workspaceRoot: string;
  tools: ToolRegistry;
  getRuntimeConfig(): ConfigV3 | undefined;
  extensionEnabled(name: "skills" | "mcp" | "plugins"): boolean;
  publish(event: RuntimeEvent): void;
  retryPolicy(): RetryRunnerOptions["policy"];
  publishForSession(
    exec: SessionExecutionState | undefined,
    event: RuntimeEvent,
  ): void;
  executionBySession(): Map<SessionID, SessionExecutionState>;
  activeExec(): SessionExecutionState | undefined;
  performanceTrace: RuntimePerformanceTrace;
  nativeRuntimeID(): string;
  userRuntimeHome(): string | undefined;
  nativeTerminal: NativeTerminalRegistry | undefined;
  findWorkspaceFiles(input: {
    workspaceRoot: string;
    query?: string;
    type?: "file" | "directory";
    limit?: number;
  }): Promise<RuntimeWorkspaceFileEntry[]>;
  sessionID(): SessionID;
  sessionDir: string | undefined;
  useSqliteStore: boolean | undefined;
  title: string | undefined;
};

export function buildWorkspace(
  host: RuntimeAssemblyHost,
): NonNullable<CatalogInput["workspace"]> {
  return {
    workspaceRoot: host.workspaceRoot,
    listPaths: async () => {
      const entries = await host.findWorkspaceFiles({
        workspaceRoot: host.workspaceRoot,
        limit: 1000,
      });
      return entries
        .filter((entry) => entry.type === "file")
        .map((entry) => entry.path);
    },
  };
}

export function buildAttachment(
  host: RuntimeAssemblyHost,
): NonNullable<CatalogInput["attachment"]> {
  return {
    enabled:
      host.getRuntimeConfig()?.plugins.enabled["natalia-attachment"] !== false,
    workspaceRoot: host.workspaceRoot,
  };
}

export function buildSessionStore(
  host: RuntimeAssemblyHost,
): NonNullable<CatalogInput["sessionStore"]> | undefined {
  if (host.getRuntimeConfig()?.plugins.enabled["natalia-attachment"] === false)
    return undefined;
  return {
    workspaceRoot: host.workspaceRoot,
    sessionID: () => host.sessionID(),
    sessionDir: host.sessionDir,
    useSqliteStore: host.useSqliteStore,
    title: host.title,
  };
}

export function buildTerminal(
  host: RuntimeAssemblyHost,
): NonNullable<CatalogInput["terminal"]> {
  return {
    workspaceRoot: host.workspaceRoot,
    publish: (event: RuntimeEvent) =>
      host.publishForSession(
        event.sessionID
          ? host.executionBySession().get(event.sessionID as SessionID)
          : host.activeExec(),
        event,
      ),
    onPerformance: (name: string, durationMs: number) =>
      host.performanceTrace.mark(name, durationMs),
    runtimeID: () => host.nativeRuntimeID(),
    userRuntimeHome: () => host.userRuntimeHome(),
    windowMode: () =>
      host.getRuntimeConfig()?.runtime.terminal.windowMode ?? "auto",
    external: host.nativeTerminal,
  };
}

export function buildSandbox(
  host: RuntimeAssemblyHost,
): NonNullable<CatalogInput["sandbox"]> {
  return {
    workspaceRoot: host.workspaceRoot,
    backend: () => host.getRuntimeConfig()?.sandbox.backend,
  };
}

export function buildMcp(
  host: RuntimeAssemblyHost,
): NonNullable<CatalogInput["mcp"]> {
  return {
    servers: () => host.getRuntimeConfig()?.mcpServers ?? {},
    workspaceRoot: host.workspaceRoot,
    tools: host.tools,
    enabled: () => host.extensionEnabled("mcp"),
    publish: host.publish,
  };
}

export function buildCheckpoint(
  host: RuntimeAssemblyHost,
): NonNullable<CatalogInput["checkpoint"]> {
  return { workspaceRoot: host.workspaceRoot };
}

export function buildTeam(
  host: RuntimeAssemblyHost,
): NonNullable<CatalogInput["team"]> {
  return {
    enabled:
      host.extensionEnabled("plugins") || host.extensionEnabled("skills"),
  };
}

export function buildToolPipeline(
  host: RuntimeAssemblyHost,
): NonNullable<CatalogInput["toolPipeline"]> {
  return { enabled: true };
}

export function buildRetry(
  host: RuntimeAssemblyHost,
): NonNullable<CatalogInput["retry"]> {
  return {
    enabled:
      host.getRuntimeConfig()?.plugins.enabled["natalia-retry"] !== false,
    policy: host.retryPolicy,
  };
}

export function buildCompaction(
  host: RuntimeAssemblyHost,
): NonNullable<CatalogInput["compaction"]> {
  const plugins = host.getRuntimeConfig()?.plugins.enabled ?? {};
  return {
    enabled:
      plugins["natalia-retry"] !== false &&
      plugins["natalia-context-ledger"] !== false &&
      plugins["natalia-compaction"] !== false,
  };
}

export function buildContextLedger(
  host: RuntimeAssemblyHost,
): NonNullable<CatalogInput["contextLedger"]> {
  return {
    enabled:
      host.getRuntimeConfig()?.plugins.enabled["natalia-context-ledger"] !==
      false,
  };
}

export function buildGovernanceLedger(
  host: RuntimeAssemblyHost,
): NonNullable<CatalogInput["governanceLedger"]> {
  return {
    enabled:
      host.getRuntimeConfig()?.plugins.enabled["natalia-governance-ledger"] !==
      false,
  };
}

// Re-exported so the composition root can name the host type without importing
// the catalog input shape.
export type { CatalogInput };
