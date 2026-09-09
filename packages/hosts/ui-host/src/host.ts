import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import * as viewStore from "@natalia/view-store";
import { createUiEventBus } from "./events";
import { createSilentLogger } from "./logger";
import { createMemoryPreferenceStore } from "./preferences";
import type {
  Logger,
  PreferenceStore,
  UiPlugin,
  UiPluginContext,
  UiPluginLifecycle,
  UiProjection,
  UiTransport,
} from "./protocol";
import { createMemoryTransport } from "./transport";

export type UiPluginHostOptions<TContext = unknown> = {
  root: HTMLElement;
  runtime: RuntimeClient;
  transport?: UiTransport;
  preferences?: PreferenceStore;
  logger?: Logger;
  t?: (text: string) => string;
  extra?: TContext;
  replay?: "all" | "none";
};

export type LoadedUiPlugin = {
  plugin: UiPlugin;
  panels: NonNullable<UiPlugin["panels"]>;
  commands: NonNullable<UiPlugin["commands"]>;
};

export type UiPluginHost = {
  load(plugin: UiPlugin): Promise<LoadedUiPlugin>;
  unload(id: string): Promise<void>;
  loaded(): LoadedUiPlugin[];
  listPanels(): Array<{
    pluginId: string;
    panel: import("./protocol").UiPanelDefinition;
  }>;
  mountPanel(
    pluginId: string,
    panelId: string,
    container: HTMLElement,
  ): Promise<void>;
  subscribePanels(listener: () => void): () => void;
  projection: UiProjection;
  executeCommand(name: string, args?: unknown): Promise<unknown>;
  close(): Promise<void>;
};

type MountedPlugin = {
  record: LoadedUiPlugin;
  lifecycle?: UiPluginLifecycle;
};

type MountedPanel = {
  lifecycle?: UiPluginLifecycle;
  dispose?: () => void;
};

export async function createUiPluginHost<TContext = unknown>(
  options: UiPluginHostOptions<TContext>,
): Promise<UiPluginHost> {
  const logger = options.logger ?? createSilentLogger();
  const preferences = options.preferences ?? createMemoryPreferenceStore();
  const transport = options.transport ?? createMemoryTransport();
  const t = options.t ?? ((text: string) => text);
  const events = createUiEventBus();
  const sessionStates = new Map<string, viewStore.AppState>();
  let activeKey: string | undefined;
  let state = viewStore.initialState();
  const projectionListeners = new Set<(next: viewStore.AppState) => void>();
  const mounted = new Map<string, MountedPlugin>();
  const mountedPanels = new Map<string, MountedPanel>();
  const panelListeners = new Set<() => void>();
  let started = false;
  let closed = false;

  const projection: UiProjection = {
    getState: () => state,
    subscribe(listener) {
      projectionListeners.add(listener);
      return () => {
        projectionListeners.delete(listener);
      };
    },
    hydrateMessages(messages, direction = "older", options) {
      const evicted = viewStore.hydrateProjectedMessages(
        state,
        messages,
        direction,
        options,
      );
      for (const listener of projectionListeners) listener(state);
      return evicted;
    },
    hydrateNaviMessages(messages) {
      const evicted = viewStore.hydrateNaviMessages(state, messages);
      for (const listener of projectionListeners) listener(state);
      return evicted;
    },
    hydrateNiaMessages(messages) {
      const evicted = viewStore.hydrateNiaMessages(state, messages);
      for (const listener of projectionListeners) listener(state);
      return evicted;
    },
    beginNaviHydration() {
      viewStore.beginNaviHydration(state);
    },
    beginNiaHydration() {
      viewStore.beginNiaHydration(state);
    },
    hydrateSubagents(subagents) {
      const changed = viewStore.hydrateSubagents(state, subagents);
      for (const listener of projectionListeners) listener(state);
      return changed;
    },
    hydrateSubagentHistory(history) {
      const changed = viewStore.hydrateSubagentHistory(state, history);
      for (const listener of projectionListeners) listener(state);
      return changed;
    },
    activateSession(sessionID, workspaceID) {
      activeKey = `${workspaceID ?? "default"}:${sessionID}`;
      state = sessionStates.get(activeKey) ?? viewStore.initialState();
      state.sessionID ??= sessionID as never;
      sessionStates.set(activeKey, state);
      for (const listener of projectionListeners) listener(state);
    },
  };

  const fanout = (event: RuntimeEvent) => {
    const sessionID = event.sessionID;
    const workspaceID = (event as { workspaceID?: string }).workspaceID;
    const activeSessionID = activeKey
      ? activeKey.slice(activeKey.indexOf(":") + 1)
      : undefined;
    const key =
      sessionID && activeSessionID && sessionID === activeSessionID
        ? activeKey
        : sessionID
          ? `${workspaceID ?? "default"}:${sessionID}`
          : activeKey;
    if (!key) {
      viewStore.applyEvent(state, event);
      for (const listener of projectionListeners) listener(state);
      events.emit(event);
      return;
    }
    const target = sessionStates.get(key) ?? viewStore.initialState();
    if (sessionID) target.sessionID ??= sessionID;
    sessionStates.set(key, target);
    viewStore.applyEvent(target, event);
    if (key === activeKey) {
      state = target;
      for (const listener of projectionListeners) listener(state);
    }
    events.emit(event);
  };

  function ctxFor(plugin: UiPlugin): UiPluginContext<TContext> {
    return {
      root: options.root,
      runtime: options.runtime,
      viewStore,
      projection,
      events: {
        emit: events.emit,
        subscribe(listener, filter) {
          return events.subscribe(listener, filter ?? plugin.events);
        },
      },
      preferences,
      transport,
      logger,
      t,
      extra: options.extra,
      host: {
        listPanels: () =>
          [...mounted.values()].flatMap((entry) =>
            entry.record.panels.map((panel) => ({
              pluginId: entry.record.plugin.id,
              panel,
            })),
          ),
        mountPanel: async (pluginId, panelId, container) => {
          const entry = mounted.get(pluginId);
          if (!entry) throw new Error(`ui plugin not loaded: ${pluginId}`);
          const panel = entry.record.panels.find((item) => item.id === panelId);
          if (!panel)
            throw new Error(`ui panel not found: ${pluginId}:${panelId}`);
          if (!panel.mount)
            throw new Error(`ui panel has no mount: ${pluginId}:${panelId}`);
          const key = `${pluginId}:${panelId}`;
          const existing = mountedPanels.get(key);
          existing?.dispose?.();
          existing?.lifecycle?.dispose?.();
          const dispose = (await panel.mount(
            ctxFor(entry.record.plugin),
            container,
          )) as (() => void) | undefined;
          mountedPanels.set(key, {
            ...(dispose ? { dispose } : {}),
          });
        },
        subscribePanels(listener) {
          panelListeners.add(listener);
          return () => {
            panelListeners.delete(listener);
          };
        },
        loaded() {
          return [...mounted.values()].map((entry) => ({
            pluginId: entry.record.plugin.id,
            name: entry.record.plugin.name,
            version: entry.record.plugin.version,
            ...(entry.record.plugin.shellLayout
              ? { shellLayout: entry.record.plugin.shellLayout }
              : {}),
          }));
        },
        unload: async (pluginId) => {
          await unloadPlugin(pluginId);
        },
        load: async (plugin) => {
          await loadPlugin(plugin);
        },
      },
    };
  }

  const startRuntime = () => {
    if (started) return;
    started = true;
    options.runtime.start(fanout, { replay: options.replay ?? "all" });
  };

  async function loadPlugin(plugin: UiPlugin) {
    if (closed) throw new Error("ui plugin host is closed");
    if (mounted.has(plugin.id))
      throw new Error(`ui plugin already loaded: ${plugin.id}`);
    const ctx = ctxFor(plugin);
    const lifecycle = await plugin.mount(ctx);
    const record: LoadedUiPlugin = {
      plugin,
      panels: plugin.panels ?? [],
      commands: plugin.commands ?? [],
    };
    mounted.set(plugin.id, {
      record,
      ...(lifecycle ? { lifecycle } : {}),
    });
    for (const listener of panelListeners) listener();
    startRuntime();
    logger.info(`loaded ${plugin.id}@${plugin.version}`);
    return record;
  }

  return {
    projection,
    async load(plugin) {
      return await loadPlugin(plugin);
    },
    async unload(id) {
      await unloadPlugin(id);
    },
    loaded() {
      return [...mounted.values()].map((entry) => entry.record);
    },
    listPanels() {
      return [...mounted.values()].flatMap((entry) =>
        entry.record.panels.map((panel) => ({
          pluginId: entry.record.plugin.id,
          panel,
        })),
      );
    },
    async mountPanel(
      pluginId: string,
      panelId: string,
      container: HTMLElement,
    ): Promise<void> {
      const entry = mounted.get(pluginId);
      if (!entry) throw new Error(`ui plugin not loaded: ${pluginId}`);
      const panel = entry.record.panels.find((item) => item.id === panelId);
      if (!panel) throw new Error(`ui panel not found: ${pluginId}:${panelId}`);
      if (!panel.mount)
        throw new Error(`ui panel has no mount: ${pluginId}:${panelId}`);
      const key = `${pluginId}:${panelId}`;
      const existing = mountedPanels.get(key);
      existing?.dispose?.();
      existing?.lifecycle?.dispose?.();
      const dispose = (await panel.mount(
        ctxFor(entry.record.plugin),
        container,
      )) as (() => void) | undefined;
      mountedPanels.set(key, {
        ...(dispose ? { dispose } : {}),
      });
      return;
    },
    subscribePanels(listener: () => void) {
      panelListeners.add(listener);
      return () => {
        panelListeners.delete(listener);
      };
    },
    async executeCommand(name, args) {
      for (const entry of mounted.values()) {
        const command = entry.record.commands.find((item) => item.id === name);
        if (command) return await command.run(args);
      }
      return executeRuntimeCommand(options.runtime, name, args);
    },
    async close() {
      if (closed) return;
      closed = true;
      const ids = [...mounted.keys()];
      const errors: unknown[] = [];
      for (const id of ids) {
        try {
          await unloadPlugin(id);
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length)
        throw new AggregateError(errors, "ui plugin host cleanup failed");
    },
  };

  async function unloadPlugin(id: string) {
    const entry = mounted.get(id);
    if (!entry) return;
    mounted.delete(id);
    for (const listener of panelListeners) listener();
    try {
      await entry.lifecycle?.dispose();
    } finally {
      await entry.record.plugin.unmount?.();
    }
    logger.info(`unloaded ${id}`);
  }
}

async function executeRuntimeCommand(
  runtime: RuntimeClient,
  name: string,
  args?: unknown,
): Promise<unknown> {
  if (name === "runtime.submit") return runtime.submit(String(args ?? ""));
  if (name === "runtime.chatSubmit") {
    if (!runtime.chatSubmit)
      throw new Error("runtime command execution unavailable");
    const text =
      typeof args === "object" && args && "text" in args
        ? String((args as { text: unknown }).text)
        : String(args ?? "");
    return runtime.chatSubmit({ text });
  }
  if (name === "runtime.cancel") {
    runtime.cancel(typeof args === "string" ? args : undefined);
    return;
  }
  throw new Error(`command unavailable: ${name}`);
}
