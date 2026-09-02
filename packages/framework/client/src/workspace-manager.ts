import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { RuntimeServiceClient } from "@natalia/runtime-services";
import type { RuntimeSessionSummary, WorkspaceSummary, WorkspacePermissionSettings, WorkspaceToolSettings } from "@natalia/contracts";
import { createRealRuntimeClient } from "./runtime/main";
import type { RealRuntimeClientOptions } from "./runtime/options";

export type WorkspaceManagerOptions = Pick<
  RealRuntimeClientOptions,
  "pluginStoreRoot" | "globalConfigPath" | "useSqliteStore" | "sessionDir" | "checkpointDir"
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
  return (
    process.env.NATALIA_WORKSPACES_FILE ??
    join(homedir(), ".config", "natalia-cli", "workspaces.json")
  );
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

function workspaceSessionDir(root: string, base?: string) {
  if (!base) return undefined;
  const safe = root.replace(/[^a-zA-Z0-9_-]+/gu, "_").slice(-80);
  return join(base, safe);
}

function workspaceCheckpointDir(root: string, base?: string) {
  if (!base) return undefined;
  const safe = root.replace(/[^a-zA-Z0-9_-]+/gu, "_").slice(-80);
  return join(base, safe);
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
  summaryFor(workspace: WorkspaceRuntime): Promise<WorkspaceSummary>;
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
async function migrateLegacyWorkspaceSessions(
  root: string,
  legacyBase?: string,
): Promise<void> {
  if (!legacyBase) return;
  const legacyDir = workspaceSessionDir(root, legacyBase)!;
  const targetDir = join(root, ".natalia", "sessions");
  if (legacyDir === targetDir) return;
  try {
    const entries = (await readdir(legacyDir).catch(() => [])) as string[];
    const files = entries.filter((name) => name.endsWith(".json"));
    if (!files.length) return;
    await mkdir(targetDir, { recursive: true, mode: 0o700 });
    let migrated = 0;
    for (const name of files) {
      const source = join(legacyDir, name);
      const target = join(targetDir, name);
      try {
        await rename(source, target);
      } catch {
        continue;
      }
      migrated++;
    }
    await rm(legacyDir, { recursive: true, force: true }).catch(() => undefined);
    console.warn(
      "[workspace-session] migrated",
      migrated,
      "session files to",
      targetDir,
    );
  } catch (error) {
    console.warn("[workspace-session] legacy migration failed", error);
  }
}

export function createWorkspaceManager(
  options: WorkspaceManagerOptions = {},
): WorkspaceManager {
  const runtimes = new Map<string, WorkspaceRuntime>();
  let activeWorkspaceID: string | undefined;

  async function summary(ws: WorkspaceRuntime): Promise<WorkspaceSummary> {
    let sessions: RuntimeSessionSummary[] = [];
    try {
      sessions = (await ws.client.sessionList?.()) ?? [];
    } catch {
      // A workspace may still be initializing; list failure should not hide the
      // workspace row from the UI.
    }
    return {
      workspaceID: ws.workspaceID,
      root: ws.root,
      title: ws.title,
      status: ws.status,
      sessionCount: sessions.length,
      runningSessionCount: sessions.filter(
        (session) => session.pendingInputs > 0 || !session.cancelled,
      ).length,
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
    return await summary(ws);
  }

  async function addWorkspace(input: { path: string; title?: string }) {
    const root = resolve(input.path);
    const existing = [...runtimes.values()].find((ws) => ws.root === root);
    if (existing) return await summary(existing);

    await migrateLegacyWorkspaceSessions(root, options.sessionDir);
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
    return await summary(ws);
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
      return Promise.all([...runtimes.values()].map(summary));
    },
    async workspaceRoots() { return Promise.all([...runtimes.values()].map(summary)); },
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
    async summaryFor(workspace: WorkspaceRuntime) {
      return summary(workspace);
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

  function decorateSession<T extends RuntimeSessionSummary>(session: T): T {
    const active = manager.getActive();
    if (!active) return session;
    const summarySession = session as RuntimeSessionSummary;
    const status =
      summarySession.status ??
      (summarySession.cancelled
        ? "error"
        : summarySession.pendingInputs > 0
          ? "running"
          : summarySession.resumable
            ? "idle"
            : "stopped");
    return { ...session, workspaceID: active.workspaceID, status };
  }

  function startWorkspaceClient(workspace: WorkspaceRuntime) {
    if (startedClients.has(workspace.workspaceID)) return;
    startedClients.add(workspace.workspaceID);
    workspace.client.start((event) =>
      emit({ ...event, workspaceID: workspace.workspaceID }),
    );
  }

  function startActiveClient() {
    const active = manager.getActive();
    if (active) startWorkspaceClient(active);
  }

  function emitWorkspace(event: import("@natalia/contracts").RuntimeEvent) {
    emit(event);
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
          if (started) emitWorkspace({
            type: "workspace.added",
            workspace: result,
            workspaceID: result.workspaceID,
          });
          return result;
        };
      }
      if (prop === "workspaceActivate") {
        return async (workspaceID: string) => {
          const result = await manager.workspaceActivate(workspaceID);
          if (started) startActiveClient();
          if (started) emitWorkspace({
            type: "workspace.activated",
            workspace: result,
            workspaceID: result.workspaceID,
          });
          return result;
        };
      }
      if (prop === "workspaceRemove") {
        return async (workspaceID: string) => {
          const result = await manager.workspaceRemove(workspaceID);
          if (started) {
            emitWorkspace({
              type: "workspace.removed",
              workspaceID,
            });
            const next = manager.getActive();
            if (next) {
              emitWorkspace({
                type: "workspace.activated",
                workspace: await manager.summaryFor(next),
                workspaceID: next.workspaceID,
              });
            }
          }
          return result;
        };
      }
      if (
        prop === "sessionList" ||
        prop === "sessionRename" ||
        prop === "sessionPin" ||
        prop === "sessionDuplicate" ||
        prop === "sessionFork" ||
        prop === "sessionDelete" ||
        prop === "sessionAttach"
      ) {
        const activeForSession = manager.getActive();
        if (!activeForSession) return undefined;
        const fn = (activeForSession.client as unknown as Record<PropertyKey, unknown>)[prop];
        if (typeof fn !== "function") return undefined;
        return async (...args: unknown[]) => {
          const result = await (fn as (...call: unknown[]) => Promise<unknown>).apply(activeForSession.client, args);
          if (prop === "sessionList" && Array.isArray(result)) {
            return result.map((item) => decorateSession(item as RuntimeSessionSummary));
          }
          if (
            result &&
            typeof result === "object" &&
            "id" in result &&
            "title" in result &&
            !("workspaceID" in result)
          ) {
            return decorateSession(result as RuntimeSessionSummary);
          }
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
      if (!active) {
        if (
          typeof prop === "string" &&
          (prop.startsWith("nativeTerminal") ||
            prop === "subscribeTerminalOutput")
        ) {
          const unavailable = () => {
            throw new Error(
              "no active workspace: open or activate a workspace before using the terminal",
            );
          };
          return prop === "subscribeTerminalOutput"
            ? unavailable
            : async () => unavailable();
        }
        return undefined;
      }
      const value = (active.client as unknown as Record<PropertyKey, unknown>)[prop];
      return typeof value === "function" ? value.bind(active.client) : value;
    },
  };
  return new Proxy({}, handler) as RuntimeServiceClient & WorkspaceManager;
}
