import { readdir, readFile } from "node:fs/promises";
import { extname, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import type { RuntimeTool, ToolRegistry } from "@natalia/tools";

export const PLUGIN_API_VERSION = 1;

export const pluginManifestSchema = z.object({
  apiVersion: z.literal(PLUGIN_API_VERSION),
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]*$/u),
  version: z.string().regex(/^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/iu),
  name: z.string().min(1),
  description: z.string().default(""),
  entry: z.string().default("index.ts"),
  capabilities: z.array(z.enum(["tools", "events"])).default([]),
});
export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type PluginAudit = {
  pluginID: string;
  action: "loaded" | "unloaded" | "denied" | "failed";
  detail?: string;
  timestamp: number;
};
export type Plugin = {
  manifest: PluginManifest;
  setup(api: PluginAPI): void | Promise<void>;
  dispose?(): void | Promise<void>;
};
export type PluginAPI = {
  tools: { register(tool: RuntimeTool): () => void };
  events: { on(listener: (event: unknown) => void): () => void };
};
export type PluginCommand = {
  name: string;
  title: string;
  category?: string;
  run(): void | Promise<void>;
};
let globalCommands: PluginCommand[] = [];
export function setGlobalPluginCommands(commands: PluginCommand[]) {
  globalCommands = [...commands];
}
export function getPluginCommands() {
  return [...globalCommands];
}

export function definePlugin(plugin: Plugin) {
  return plugin;
}

export function createPluginRegistry(input: {
  tools: ToolRegistry;
  allowed?: string[];
  readOnly?: Record<string, boolean>;
  onAudit?: (entry: PluginAudit) => void;
}) {
  const plugins = new Map<
    string,
    {
      plugin: Plugin;
      listeners: Set<(event: unknown) => void>;
      dispose: Array<() => void>;
    }
  >();
  const audit: PluginAudit[] = [];
  const allowed = new Set(input.allowed ?? []);
  const writeAudit = (
    pluginID: string,
    action: PluginAudit["action"],
    detail?: string,
  ) => {
    const entry = { pluginID, action, detail, timestamp: Date.now() };
    audit.push(entry);
    input.onAudit?.(entry);
  };
  const assertCapability = (
    manifest: PluginManifest,
    capability: "tools" | "events",
    allowedOverride?: string[],
  ) => {
    const granted = allowedOverride ? new Set(allowedOverride) : allowed;
    const constrained =
      allowedOverride !== undefined || input.allowed !== undefined;
    if (
      !manifest.capabilities.includes(capability) ||
      (constrained && !granted.has(capability))
    ) {
      writeAudit(manifest.id, "denied", capability);
      throw new Error(`plugin capability denied: ${manifest.id}/${capability}`);
    }
  };
  return {
    async load(plugin: Plugin, allowedOverride?: string[]) {
      const manifest = pluginManifestSchema.parse(plugin.manifest);
      if (plugins.has(manifest.id))
        throw new Error(`plugin already loaded: ${manifest.id}`);
      const listeners = new Set<(event: unknown) => void>();
      const disposers: Array<() => void> = [];
      const api: PluginAPI = {
        tools: {
          register(tool) {
            assertCapability(manifest, "tools", allowedOverride);
            const name = `plugin_${manifest.id.replace(/[^a-z0-9_]/giu, "_")}_${tool.name}`;
            // Dynamic plugin tools require approval unless the workspace explicitly
            // trusts a plugin's own read-only side-effect declaration.
            const owned = {
              ...tool,
              name,
              requiresApproval:
                tool.requiresApproval || !input.readOnly?.[manifest.id],
            };
            input.tools.set(name, owned);
            const dispose = () => {
              if (input.tools.get(name) === owned) input.tools.delete(name);
            };
            disposers.push(dispose);
            return dispose;
          },
        },
        events: {
          on(listener) {
            assertCapability(manifest, "events", allowedOverride);
            listeners.add(listener);
            const dispose = () => listeners.delete(listener);
            disposers.push(dispose);
            return dispose;
          },
        },
      };
      try {
        await plugin.setup(api);
      } catch (error) {
        for (const dispose of disposers) dispose();
        writeAudit(
          manifest.id,
          "failed",
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }
      plugins.set(manifest.id, {
        plugin: { ...plugin, manifest },
        listeners,
        dispose: disposers,
      });
      writeAudit(manifest.id, "loaded");
    },
    async unload(id: string) {
      const entry = plugins.get(id);
      if (!entry) throw new Error(`plugin not found: ${id}`);
      await entry.plugin.dispose?.();
      for (const dispose of entry.dispose) dispose();
      plugins.delete(id);
      writeAudit(id, "unloaded");
    },
    dispatch(event: unknown) {
      for (const entry of plugins.values())
        for (const listener of entry.listeners)
          try {
            listener(event);
          } catch {}
    },
    list() {
      return [...plugins.values()].map((entry) => entry.plugin.manifest);
    },
    audit() {
      return [...audit];
    },
  };
}

export async function discoverPluginManifests(root: string) {
  const dir = resolve(root);
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const manifests: Array<{ manifest: PluginManifest; path: string }> = [];
  for (const directory of [
    dir,
    ...entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(dir, entry.name)),
  ]) {
    const path = join(directory, "natalia.plugin.json");
    try {
      manifests.push({
        manifest: pluginManifestSchema.parse(
          JSON.parse(await readFile(path, "utf8")),
        ),
        path,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return manifests;
}

export async function loadLocalPlugins(input: {
  roots: string[];
  registry: ReturnType<typeof createPluginRegistry>;
  enabled?: Record<string, boolean>;
  capabilities?: Record<string, string[]>;
  onError?: (id: string, error: unknown) => void;
}) {
  const loaded: PluginManifest[] = [];
  for (const root of input.roots) {
    const manifests = await discoverPluginManifests(root);
    for (const { manifest, path } of manifests) {
      if (input.enabled?.[manifest.id] === false) continue;
      try {
        const entry = validatePluginPath(resolve(path, ".."), manifest.entry);
        const module = (await import(pathToFileURL(entry).href)) as {
          default?: unknown;
        };
        const plugin = module.default;
        if (!plugin || typeof plugin !== "object")
          throw new Error(
            `plugin module has no default export: ${manifest.id}`,
          );
        const candidate = plugin as Partial<Plugin>;
        if (!candidate.setup || typeof candidate.setup !== "function")
          throw new Error(
            `plugin module has no setup function: ${manifest.id}`,
          );
        await input.registry.load(
          { ...candidate, manifest } as Plugin,
          input.capabilities?.[manifest.id],
        );
        loaded.push(manifest);
      } catch (error) {
        input.onError?.(manifest.id, error);
      }
    }
  }
  return loaded;
}

export function validatePluginPath(root: string, path: string) {
  const resolved = resolve(root, path);
  if (!resolved.startsWith(`${resolve(root)}/`) && resolved !== resolve(root))
    throw new Error("plugin path escapes root");
  if (
    !isAbsolute(resolved) ||
    ![".js", ".mjs", ".ts"].includes(extname(resolved))
  )
    throw new Error("plugin entry must be a local JS or TS module");
  return resolved;
}

export async function runPluginConformance(input: {
  plugin: Plugin;
  allowed?: string[];
}) {
  const tools = new Map<string, RuntimeTool>();
  const registry = createPluginRegistry({
    tools: {
      set(name, tool) {
        tools.set(name, tool);
      },
      get(name) {
        return tools.get(name);
      },
      delete(name) {
        tools.delete(name);
      },
    } as ToolRegistry,
    allowed: input.allowed,
  });
  const result: Array<{ name: string; passed: boolean; detail?: string }> = [];
  try {
    await registry.load(input.plugin);
    result.push({ name: "manifest-and-setup", passed: true });
    await registry.unload(input.plugin.manifest.id);
    result.push({
      name: "owned-registration-cleanup",
      passed: tools.size === 0,
      detail: tools.size ? "plugin tools remained registered" : undefined,
    });
  } catch (error) {
    result.push({
      name: "manifest-and-setup",
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  return result;
}
