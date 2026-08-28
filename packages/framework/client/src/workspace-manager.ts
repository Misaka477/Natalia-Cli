import { resolve, join } from "node:path";
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

export type WorkspaceManager = {
  list(): Promise<WorkspaceSummary[]>;
  add(input: { path: string; title?: string }): Promise<WorkspaceSummary>;
  remove(workspaceID: string): Promise<{ removed: boolean }>;
  activate(workspaceID: string): Promise<WorkspaceSummary>;
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
    activeWorkspaceID = workspaceID;
    ws.status = "active";
    for (const other of runtimes.values()) {
      if (other.workspaceID !== workspaceID && other.status === "active")
        other.status = "idle";
    }
    return summary(ws);
  }

  return {
    async list() {
      return [...runtimes.values()].map(summary);
    },
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
    async add(input) {
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
      return summary(ws);
    },
    async remove(workspaceID) {
      const ws = runtimes.get(workspaceID);
      if (!ws) return { removed: true };
      await ws.client.dispose?.();
      runtimes.delete(workspaceID);
      if (activeWorkspaceID === workspaceID) {
        const next = runtimes.values().next().value;
        activeWorkspaceID = next?.workspaceID;
        if (next) next.status = "active";
      }
      return { removed: true };
    },
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
  const handler: ProxyHandler<object> = {
    get(_target, prop, _receiver) {
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
