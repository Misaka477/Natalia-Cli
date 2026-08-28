import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { RuntimeServiceClient } from "@natalia/runtime-services";
import type { WorkspaceSummary, WorkspacePermissionSettings, WorkspaceToolSettings } from "@natalia/contracts";
import { createRealRuntimeClient } from "./runtime/main";
import type { RealRuntimeClientOptions } from "./runtime/options";

export type WorkspaceManagerOptions = Pick<
  RealRuntimeClientOptions,
  "pluginStoreRoot" | "globalConfigPath" | "useSqliteStore"
>;

export type WorkspaceRuntime = {
  workspaceID: string;
  root: string;
  title: string;
  client: RuntimeServiceClient;
  status: WorkspaceSummary["status"];
  permissionSettings: WorkspacePermissionSettings;
  toolSettings: WorkspaceToolSettings;
};

function workspaceSettingsPath(root: string) {
  return join(root, ".natalia", "workspace-settings.json");
}

async function readSettings(root: string): Promise<{
  permissionSettings: WorkspacePermissionSettings;
  toolSettings: WorkspaceToolSettings;
}> {
  try {
    const raw = JSON.parse(
      await readFile(workspaceSettingsPath(root), "utf8"),
    ) as Partial<{
      permissionSettings?: WorkspacePermissionSettings;
      toolSettings?: WorkspaceToolSettings;
    }>;
    return {
      permissionSettings: raw.permissionSettings ?? {
        permissionProfile: "default",
        approval: "ask",
      },
      toolSettings: raw.toolSettings ?? {
        enabledTools: [],
        disabledTools: [],
      },
    };
  } catch {
    return {
      permissionSettings: {
        permissionProfile: "default",
        approval: "ask",
      },
      toolSettings: {
        enabledTools: [],
        disabledTools: [],
      },
    };
  }
}

async function writeSettings(
  root: string,
  update: {
    permissionSettings?: WorkspacePermissionSettings;
    toolSettings?: WorkspaceToolSettings;
  },
) {
  const path = workspaceSettingsPath(root);
  const current = await readSettings(root);
  const next = {
    permissionSettings: update.permissionSettings ?? current.permissionSettings,
    toolSettings: update.toolSettings ?? current.toolSettings,
  };
  await mkdir(join(root, ".natalia"), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  return next;
}

function workspaceRegistryPath() {
  return join(homedir(), ".config", "natalia-cli", "workspaces.json");
}

async function readWorkspaceRegistry(): Promise<Array<{ path: string; title?: string }>> {
  try {
    const raw = JSON.parse(
      await readFile(workspaceRegistryPath(), "utf8"),
    ) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((entry) => typeof entry === "object" && entry !== null);
  } catch {
    return [];
  }
}

async function writeWorkspaceRegistry(
  entries: Array<{ path: string; title?: string }>,
) {
  const path = workspaceRegistryPath();
  await mkdir(join(homedir(), ".config", "natalia-cli"), {
    recursive: true,
    mode: 0o700,
  });
  await writeFile(path, `${JSON.stringify(entries, null, 2)}\n`, { mode: 0o600 });
}

export type WorkspaceManager = {
  list(): Promise<WorkspaceSummary[]>;
  add(input: { path: string; title?: string }): Promise<WorkspaceSummary>;
  remove(workspaceID: string): Promise<{ removed: boolean }>;
  activate(workspaceID: string): Promise<WorkspaceSummary>;
  load(): Promise<void>;
  workspaceRoots(): Promise<WorkspaceSummary[]>;
  workspaceAdd(input: { path: string; title?: string }): Promise<WorkspaceSummary>;
  workspaceRemove(workspaceID: string): Promise<{ removed: boolean }>;
  workspaceActivate(workspaceID: string): Promise<WorkspaceSummary>;
  get(workspaceID: string): WorkspaceRuntime | undefined;
  getActive(): WorkspaceRuntime | undefined;
  workspacePermissionGet(workspaceID: string): Promise<WorkspacePermissionSettings>;
  workspacePermissionSet(workspaceID: string, settings: WorkspacePermissionSettings): Promise<WorkspacePermissionSettings>;
  workspaceToolGet(workspaceID: string): Promise<WorkspaceToolSettings>;
  workspaceToolSet(workspaceID: string, settings: WorkspaceToolSettings): Promise<WorkspaceToolSettings>;
  dispose(): Promise<void>;
};

/**
 * Host-level multi-workspace manager. Each workspace owns its own real runtime
 * client and runtime state; all workspaces share the same global config path
 * and plugin store (no per-workspace global config/plugins).
 */
export function createWorkspaceManager(
  options: WorkspaceManagerOptions = {},
): WorkspaceManager {
  const runtimes = new Map<string, WorkspaceRuntime>();
  let activeWorkspaceID: string | undefined;

  function summary(ws: WorkspaceRuntime): WorkspaceSummary {
    return {
      workspaceID: ws.workspaceID,
      root: ws.root,
      title: ws.title,
      status: ws.status,
      sessionCount: 0,
      runningSessionCount: 0,
    };
  }

  async function activate(workspaceID: string): Promise<WorkspaceSummary> {
    const ws = runtimes.get(workspaceID);
    if (!ws) throw new Error(`workspace not found: ${workspaceID}`);
    activeWorkspaceID = workspaceID;
    ws.status = "active";
    for (const other of runtimes.values()) {
      if (other.workspaceID !== workspaceID && other.status === "active")
        other.status = "idle";
    }
    return summary(ws);
  }

  async function addWorkspace(input: { path: string; title?: string }) {
    const root = resolve(input.path);
    const existing = [...runtimes.values()].find((ws) => ws.root === root);
    if (existing) return summary(existing);

    const client = createRealRuntimeClient({
      workspaceRoot: root,
      pluginStoreRoot: options.pluginStoreRoot,
      globalConfigPath: options.globalConfigPath,
      useSqliteStore: options.useSqliteStore,
    });
    const settings = await readSettings(root);
    const ws: WorkspaceRuntime = {
      workspaceID: `ws_${randomUUID().replace(/-/gu, "").slice(0, 12)}`,
      root,
      title: input.title ?? root.split("/").pop() ?? root,
      client,
      status: "idle",
      permissionSettings: settings.permissionSettings,
      toolSettings: settings.toolSettings,
    };
    runtimes.set(ws.workspaceID, ws);
    if (!activeWorkspaceID) await activate(ws.workspaceID);
    await writeWorkspaceRegistry(
      [...runtimes.values()].map((runtime) => ({
        path: runtime.root,
        title: runtime.title,
      })),
    );
    return summary(ws);
  }

  async function removeWorkspace(workspaceID: string) {
    const ws = runtimes.get(workspaceID);
    if (!ws) return { removed: true };
    await ws.client.dispose?.();
    runtimes.delete(workspaceID);
    if (activeWorkspaceID === workspaceID) {
      const next = runtimes.values().next().value;
      activeWorkspaceID = next?.workspaceID;
      if (next) next.status = "active";
    }
    await writeWorkspaceRegistry(
      [...runtimes.values()].map((runtime) => ({
        path: runtime.root,
        title: runtime.title,
      })),
    );
    return { removed: true };
  }

  return {
    async load() {
      const entries = await readWorkspaceRegistry();
      for (const entry of entries) {
        if (entry.path && ![...runtimes.values()].some((ws) => ws.root === resolve(entry.path))) {
          await addWorkspace({ path: entry.path, title: entry.title });
        }
      }
    },
    async list() {
      return [...runtimes.values()].map(summary);
    },
    async workspaceRoots() { return [...runtimes.values()].map(summary); },
    workspaceAdd: addWorkspace,
    workspaceRemove: removeWorkspace,
    workspaceActivate: activate,
    async workspacePermissionGet(workspaceID) {
      const ws = runtimes.get(workspaceID);
      if (!ws) throw new Error(`workspace not found: ${workspaceID}`);
      return ws.permissionSettings;
    },
    async workspacePermissionSet(workspaceID, settings) {
      const ws = runtimes.get(workspaceID);
      if (!ws) throw new Error(`workspace not found: ${workspaceID}`);
      const saved = await writeSettings(ws.root, { permissionSettings: settings });
      ws.permissionSettings = saved.permissionSettings;
      return ws.permissionSettings;
    },
    async workspaceToolGet(workspaceID) {
      const ws = runtimes.get(workspaceID);
      if (!ws) throw new Error(`workspace not found: ${workspaceID}`);
      return ws.toolSettings;
    },
    async workspaceToolSet(workspaceID, settings) {
      const ws = runtimes.get(workspaceID);
      if (!ws) throw new Error(`workspace not found: ${workspaceID}`);
      const saved = await writeSettings(ws.root, { toolSettings: settings });
      ws.toolSettings = saved.toolSettings;
      return ws.toolSettings;
    },
    add: addWorkspace,
    remove: removeWorkspace,
    activate,
    get(workspaceID) {
      return runtimes.get(workspaceID);
    },
    getActive() {
      return activeWorkspaceID ? runtimes.get(activeWorkspaceID) : undefined;
    },
    async dispose() {
      for (const ws of runtimes.values()) await ws.client.dispose?.();
      runtimes.clear();
      activeWorkspaceID = undefined;
    },
  };
}

/**
 * A RuntimeClient facade that delegates all active-workspace methods to the
 * currently active real runtime and exposes workspace management on the same
 * object. Host shells can pass this as `UiPluginContext.runtime`.
 */
export function createWorkspaceRuntimeClient(
  manager: WorkspaceManager,
): RuntimeServiceClient & WorkspaceManager {
  const listeners = new Set<(event: import("@natalia/contracts").RuntimeEvent) => void>();
  const startedClients = new Set<string>();
  let started = false;

  function emit(event: import("@natalia/contracts").RuntimeEvent) {
    for (const listener of listeners) listener(event);
  }

  function startActiveClient() {
    const active = manager.getActive();
    if (!active) return;
    if (startedClients.has(active.workspaceID)) return;
    startedClients.add(active.workspaceID);
    active.client.start(emit);
  }

  const handler: ProxyHandler<object> = {
    get(_target, prop, _receiver) {
      if (prop === "start") {
        return (onEvent?: (event: import("@natalia/contracts").RuntimeEvent) => void) => {
          if (onEvent) listeners.add(onEvent);
          started = true;
          startActiveClient();
        };
      }
      if (prop === "workspaceAdd") {
        return async (input: { path: string; title?: string }) => {
          const wasEmpty = !manager.getActive();
          const result = await manager.workspaceAdd(input);
          if (started && (wasEmpty || result.status === "active")) startActiveClient();
          return result;
        };
      }
      if (prop === "workspaceActivate") {
        return async (workspaceID: string) => {
          const result = await manager.workspaceActivate(workspaceID);
          if (started) startActiveClient();
          return result;
        };
      }
      if (prop in manager) {
        const value = (manager as unknown as Record<PropertyKey, unknown>)[prop];
        return typeof value === "function"
          ? value.bind(manager)
          : value;
      }
      const active = manager.getActive();
      if (!active) return undefined;
      const value = (active.client as unknown as Record<PropertyKey, unknown>)[prop];
      return typeof value === "function" ? value.bind(active.client) : value;
    },
  };
  return new Proxy({}, handler) as RuntimeServiceClient & WorkspaceManager;
}
