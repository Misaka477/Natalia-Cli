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
  projection: UiProjection;
  executeCommand(name: string, args?: unknown): Promise<unknown>;
  close(): Promise<void>;
};

type MountedPlugin = {
  record: LoadedUiPlugin;
  lifecycle?: UiPluginLifecycle;
};

export async function createUiPluginHost<TContext = unknown>(
  options: UiPluginHostOptions<TContext>,
): Promise<UiPluginHost> {
  const logger = options.logger ?? createSilentLogger();
  const preferences = options.preferences ?? createMemoryPreferenceStore();
  const transport = options.transport ?? createMemoryTransport();
  const t = options.t ?? ((text: string) => text);
  const events = createUiEventBus();
  let state = viewStore.initialState();
  const projectionListeners = new Set<(next: viewStore.AppState) => void>();
  const mounted = new Map<string, MountedPlugin>();
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
    reset() {
      state = viewStore.initialState();
      for (const listener of projectionListeners) listener(state);
    },
  };

  const fanout = (event: RuntimeEvent) => {
    console.log("[ui-host] fanout event", event.type);
    viewStore.applyEvent(state, event);
    for (const listener of projectionListeners) listener(state);
    events.emit(event);
  };

  const startRuntime = () => {
    if (started) return;
    started = true;
    options.runtime.start(fanout);
  };

  return {
    projection,
    async load(plugin) {
      if (closed) throw new Error("ui plugin host is closed");
      if (mounted.has(plugin.id))
        throw new Error(`ui plugin already loaded: ${plugin.id}`);
      const ctx: UiPluginContext<TContext> = {
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
      };
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
      startRuntime();
      logger.info(`loaded ${plugin.id}@${plugin.version}`);
      return record;
    },
    async unload(id) {
      await unloadPlugin(id);
    },
    loaded() {
      return [...mounted.values()].map((entry) => entry.record);
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
