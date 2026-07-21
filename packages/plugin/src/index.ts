// Plugin types are intentionally minimal and self-contained.
// Full type safety is validated at the integration boundary
// where plugins are consumed by @natalia/client or @natalia/tui.

export type PluginManifest = {
  name: string;
  version: string;
  description: string;
  author?: string;
};

export type PluginCommand = {
  name: string;
  title: string;
  category?: string;
  run(): void | Promise<void>;
};

export type PluginAPI = {
  events: {
    onEvent(listener: (event: unknown) => void): () => void;
  };
  tools: {
    register(tool: { name: string; description: string; execute(input: unknown, context: unknown): Promise<string>; requiresApproval?: boolean; parameters?: Record<string, unknown> }): void;
    unregister(name: string): void;
  };
  commands: {
    register(command: PluginCommand): () => void;
  };
};

export type Plugin = {
  manifest: PluginManifest;
  activate(api: PluginAPI): void | Promise<void>;
  deactivate?(): void | Promise<void>;
};

export type PluginRegistry = {
  load(plugin: Plugin): void;
  unload(name: string): void;
  dispatchEvent(event: unknown): void;
  list(): PluginManifest[];
  getCommands(): PluginCommand[];
};

export function createPluginRegistry(): PluginRegistry {
  const plugins = new Map<string, {
    plugin: Plugin;
    listeners: Set<(event: unknown) => void>;
  }>();
  const globalCommands = new Map<string, PluginCommand>();

  const makeAPI = (listeners: Set<(event: unknown) => void>): PluginAPI => ({
    events: {
      onEvent(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
    tools: {
      register(tool) {
        registryTools.set(tool.name, tool as never);
      },
      unregister(name) {
        registryTools.delete(name);
      },
    },
    commands: {
      register(command) {
        if (globalCommands.has(command.name))
          throw new Error(`command already registered: ${command.name}`);
        globalCommands.set(command.name, command);
        return () => { globalCommands.delete(command.name); };
      },
    },
  });

  return {
    load(plugin) {
      if (plugins.has(plugin.manifest.name))
        throw new Error(`plugin already loaded: ${plugin.manifest.name}`);
      const listeners = new Set<(event: unknown) => void>();
      const api = makeAPI(listeners);
      const result = plugin.activate(api);
      if (result?.then)
        result.catch((error) => {
          console.error(`[plugin] ${plugin.manifest.name} activation:`, error);
        });
      plugins.set(plugin.manifest.name, { plugin, listeners });
    },

    unload(name) {
      const entry = plugins.get(name);
      if (!entry) throw new Error(`plugin not found: ${name}`);
      entry.plugin.deactivate?.();
      plugins.delete(name);
    },

    dispatchEvent(event) {
      for (const [, entry] of plugins) {
        for (const listener of entry.listeners) {
          try { listener(event); } catch { /* skip plugin error */ }
        }
      }
    },

    list() {
      return [...plugins.values()].map((e) => e.plugin.manifest);
    },

    getCommands() {
      return [...globalCommands.values()];
    },
  };
}

const registryTools = new Map<string, never>();
export function getPluginTools() {
  return registryTools;
}

// Global singleton for simple plugin command access
// without requiring manual registry propagation.
let globalCommands: PluginCommand[] = [];

export function setGlobalPluginCommands(commands: PluginCommand[]) {
  globalCommands = commands;
}

export function getPluginCommands(): PluginCommand[] {
  return globalCommands;
}
