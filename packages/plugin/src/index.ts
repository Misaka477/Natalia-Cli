import { readdir, readFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { RuntimeTool, ToolRegistry } from "@natalia/tools";
import {
  manifestIntegrationPoints,
  pluginManifestSchema,
  type PluginIntegrationPoint,
  type PluginManifest,
} from "./manifest";
import { resolvePluginDependencies } from "./dependencies";

export * from "./dependencies";
export * from "./manifest";
/**
 * One problem found while validating a plugin's own config.
 *
 * Mirrors the Standard Schema issue shape: `path` may carry either plain keys
 * or `{ key }` wrappers, so both spellings are accepted when formatting.
 */
export type PluginConfigIssue = {
  message: string;
  path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>;
};
type PluginConfigValidation = {
  value?: unknown;
  issues?: ReadonlyArray<PluginConfigIssue>;
};
/**
 * Minimal Standard Schema surface a plugin uses to validate its own config.
 *
 * Duck-typed on purpose: an independently distributed plugin package must be
 * able to validate with any Standard Schema library (zod, valibot, arktype)
 * without depending on this repository's zod build.
 */
export type PluginConfigSchema = {
  "~standard": {
    validate(
      value: unknown,
    ): PluginConfigValidation | Promise<PluginConfigValidation>;
  };
};
export type PluginAudit = {
  pluginID: string;
  action: "loaded" | "unloaded" | "denied" | "failed";
  detail?: string;
  timestamp: number;
};
export type Plugin = {
  manifest: PluginManifest;
  /**
   * Validates the config this plugin is loaded with. Optional: a plugin that
   * takes no config omits it and receives the raw value unchanged.
   */
  configSchema?: PluginConfigSchema;
  setup(api: PluginAPI): void | Promise<void>;
  dispose?(): void | Promise<void>;
};
export type PluginAPI = {
  /**
   * The config this plugin was loaded with, already validated by its own
   * `configSchema` (the schema's parsed value, so defaults are applied).
   */
  config: unknown;
  /**
   * The runtime's resolved config, when the host provides it (the D2
   * `runtime.config` service). A plugin can read the effective config by name
   * instead of duplicating a parser.
   */
  runtimeConfig?: () => unknown;
  tools: {
    register(tool: RuntimeTool): () => void;
    /** Adds a model-facing alias for a tool this plugin registered. */
    registerAlias(alias: string, target: string): () => void;
  };
  /**
   * Services this plugin provides (declared in the manifest's `provides`):
   * contributed to the capability kernel as `services`, so other capabilities
   * resolve them by name and subscribe to their updates.
   */
  services: {
    provide(name: string, value: unknown): () => void;
    get<T>(name: string): T | undefined;
    on<T>(name: string, listener: (value: T | undefined) => void): () => void;
  };
  events: {
    on(listener: (event: unknown) => void): () => void;
    on(type: string, listener: (event: unknown) => void): () => void;
  };
  /**
   * Commands a plugin adds to the palette. Gated on the "commands" capability
   * like everything else, and owned by the registry so unloading a plugin also
   * removes its commands.
   */
  commands: { register(command: PluginCommand): () => void };
  resources: PluginNamedContributionRegistry;
  projections: PluginNamedContributionRegistry;
  workflows: PluginNamedContributionRegistry;
  settingsSchema: PluginNamedContributionRegistry;
  adapters: PluginAdapterContributionRegistry;
  scheduler: { add(job: PluginNamedContribution): () => void };
  effects: {
    signal: AbortSignal;
    run<T>(effect: (signal: AbortSignal) => Promise<T>): Promise<T>;
  };
};
export type PluginNamedContribution = { name: string; [key: string]: unknown };
export type PluginNamedContributionRegistry = {
  register(contribution: PluginNamedContribution): () => void;
};
export type PluginAdapterInstance = {
  dispose(): void | Promise<void>;
};
export type PluginAdapterContribution<
  Context = unknown,
  Instance extends PluginAdapterInstance = PluginAdapterInstance,
> = PluginNamedContribution & {
  adapterType: string;
  create(context: Context): Instance | Promise<Instance>;
};
export type PluginAdapterContributionRegistry = {
  register<Context, Instance extends PluginAdapterInstance>(
    contribution: PluginAdapterContribution<Context, Instance>,
  ): () => void;
};
export type PluginAdapterRegistryView = {
  contribution<T>(kind: "adapters", name: string): T | undefined;
  ownerOf(kind: "adapters", name: string): string | undefined;
};

/** Materializes inert adapter contributions and owns their runtime resources. */
export function createPluginAdapterMaterializer(
  registry: PluginAdapterRegistryView,
) {
  const instances: Array<{
    name: string;
    ownerID: string;
    instance: PluginAdapterInstance;
  }> = [];
  let closed = false;

  return {
    async materialize<
      Context,
      Instance extends PluginAdapterInstance = PluginAdapterInstance,
    >(name: string, context: Context): Promise<Instance> {
      if (closed) throw new Error("adapter materializer is closed");
      if (instances.some((entry) => entry.name === name))
        throw new Error(`adapter is already materialized: ${name}`);
      const contribution = registry.contribution<
        PluginAdapterContribution<Context, Instance>
      >("adapters", name);
      const ownerID = registry.ownerOf("adapters", name);
      if (!contribution || !ownerID)
        throw new Error(`adapter is not available: ${name}`);
      const instance = await contribution.create(context);
      if (!instance || typeof instance.dispose !== "function")
        throw new Error(`adapter returned an invalid instance: ${name}`);
      instances.push({ name, ownerID, instance });
      return instance;
    },
    active() {
      return instances.map(({ name, ownerID }) => ({ name, ownerID }));
    },
    async close() {
      if (closed) return;
      closed = true;
      const errors: unknown[] = [];
      for (const { instance } of [...instances].reverse())
        try {
          await instance.dispose();
        } catch (error) {
          errors.push(error);
        }
      instances.length = 0;
      if (errors.length)
        throw new AggregateError(errors, "adapter cleanup failed");
    },
  };
}
export type PluginCommand = {
  name: string;
  title: string;
  category?: string;
  run(): void | Promise<void>;
};
/**
 * Process-wide bridge for UIs that render a command palette synchronously.
 *
 * This is a bridge, not the source of truth: the registry owns commands, and the
 * authoritative surface is `registry.commands()` plus the runtime's
 * `commandCatalog()` and its `command.catalog` RPC route, which a remote UI can
 * read. The global exists because a palette renders synchronously and cannot
 * await; it therefore assumes one runtime per process, which is true for the CLI
 * and the TUI worker.
 */
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

function formatConfigIssue(issue: PluginConfigIssue) {
  const path = (issue.path ?? [])
    .map((segment) =>
      typeof segment === "object" && segment !== null && "key" in segment
        ? String(segment.key)
        : String(segment),
    )
    .join(".");
  return path ? `  - ${issue.message} (at ${path})` : `  - ${issue.message}`;
}

/**
 * Validate the config a plugin is loaded with against its own schema.
 *
 * A plugin without `configSchema` accepts any value, so its config passes
 * through unchanged. Validation is synchronous: an async schema is a load
 * error rather than a silently unvalidated config, because the registry must
 * decide whether to run `setup` before any registration happens.
 *
 * @returns the validated config (the schema's parsed value, defaults applied).
 * @throws when the schema reports issues or validates asynchronously.
 */
export function resolvePluginConfig(plugin: Plugin, config: unknown): unknown {
  const schema = plugin.configSchema;
  if (!schema) return config;
  const result = schema["~standard"].validate(config);
  if (result !== null && typeof result === "object" && "then" in result)
    throw new Error(
      `plugin config validation must be synchronous: ${plugin.manifest.id}`,
    );
  const settled = result as PluginConfigValidation;
  if (settled.issues?.length)
    throw new Error(
      `plugin config invalid: ${plugin.manifest.id}\n${settled.issues
        .map(formatConfigIssue)
        .join("\n")}`,
    );
  return settled.value;
}

/** The kernel contribution kinds a plugin can make through its capability. */
export type PluginContributionKind =
  | "tools"
  | "commands"
  | "listeners"
  | "services"
  | "resources"
  | "projections"
  | "workflows"
  | "settingsSchema"
  | "adapters"
  | "schedulerJobs";

export type PluginLoadContext = {
  /** Built-ins keep stable public names; external plugins remain namespaced. */
  builtin: boolean;
};

export function createPluginRegistry(input: {
  tools: ToolRegistry;
  allowed?: string[];
  readOnly?: Record<string, boolean>;
  onAudit?: (entry: PluginAudit) => void;
  /**
   * Optional kernel channel. Called once per plugin load, before setup, with the
   * validated manifest. It returns a contribution sink for that plugin's
   * registrations, or `undefined` to keep plugin registrations registry-only
   * (the standalone default).
   *
   * When a sink is present, every tool, command and event listener is handed to
   * it in addition to the registry, so the host can attribute them to the
   * plugin: the kernel owns the registration, and unload releases it. This is
   * the single channel — a plugin's capability owns everything it registers,
   * exactly like a built-in tool family.
   */
  contribute?: (
    manifest: PluginManifest,
    context: PluginLoadContext,
  ) =>
    | ((
        kind: PluginContributionKind,
        name: string,
        payload: unknown,
      ) => () => void)
    | Promise<
        | ((
            kind: PluginContributionKind,
            name: string,
            payload: unknown,
          ) => () => void)
        | undefined
      >
    | undefined;
  /** Called when a plugin unloads, so the host can release kernel ownership. */
  onUnload?: (pluginID: string, context: PluginLoadContext) => void;
  /** The runtime's resolved config accessor, exposed to plugins as `api.runtimeConfig`. */
  runtimeConfig?: () => unknown;
  service?: <T>(name: string) => T | undefined;
  onServiceUpdate?: (
    listener: (update: { name: string }) => void,
  ) => () => void;
}) {
  const plugins = new Map<
    string,
    {
      plugin: Plugin;
      listeners: Set<(event: unknown) => void>;
      commands: Map<string, PluginCommand>;
      dispose: Array<() => void>;
      abort: AbortController;
      effects: Set<Promise<unknown>>;
      loadContext: PluginLoadContext;
    }
  >();
  const audit: PluginAudit[] = [];
  /** Command name -> owning plugin, so a collision names the current owner. */
  const commandOwners = new Map<string, string>();
  const allowed = new Set(input.allowed ?? []);
  const writeAudit = (
    pluginID: string,
    action: PluginAudit["action"],
    detail?: string,
  ) => {
    const entry = { pluginID, action, detail, timestamp: Date.now() };
    audit.push(entry);
    try {
      input.onAudit?.(entry);
    } catch {
      // Audit consumers cannot corrupt plugin lifecycle state.
    }
  };
  const once = (dispose: () => void) => {
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      dispose();
    };
  };
  const ownedDisposer = (...releases: Array<() => void>) =>
    once(() => {
      const errors = cleanup(releases);
      if (errors[0] !== undefined) throw errors[0];
    });
  const cleanup = (disposers: Array<() => void>): unknown[] => {
    const errors: unknown[] = [];
    for (const dispose of [...disposers].reverse())
      try {
        dispose();
      } catch (error) {
        errors.push(error);
      }
    return errors;
  };
  const assertCapability = (
    manifest: PluginManifest,
    capability: PluginIntegrationPoint,
    allowedOverride?: string[],
  ) => {
    const granted = allowedOverride ? new Set(allowedOverride) : allowed;
    const constrained =
      allowedOverride !== undefined || input.allowed !== undefined;
    if (
      !manifestIntegrationPoints(manifest).includes(capability) ||
      (constrained && !granted.has(capability))
    ) {
      writeAudit(manifest.id, "denied", capability);
      throw new Error(`plugin capability denied: ${manifest.id}/${capability}`);
    }
  };
  async function loadPlugin(
    plugin: Plugin,
    allowedOverride: string[] | undefined,
    config: unknown,
    loadContext: PluginLoadContext,
  ) {
    const manifest = pluginManifestSchema.parse(plugin.manifest);
    if (plugins.has(manifest.id))
      throw new Error(`plugin already loaded: ${manifest.id}`);
    if (manifest.apiVersion === 2) {
      const resolution = resolvePluginDependencies(
        [manifest],
        [...plugins.values()].map((entry) => entry.plugin.manifest),
      );
      const unresolved = [...resolution.denied, ...resolution.pending][0];
      if (unresolved) {
        writeAudit(
          manifest.id,
          resolution.denied.length ? "denied" : "failed",
          unresolved.reason,
        );
        throw new Error(
          `plugin dependency unresolved: ${manifest.id}: ${unresolved.reason}`,
        );
      }
    }
    // Validate before anything is registered: misconfiguration must fail
    // loud at load, never reach `setup` as a half-applied config.
    let resolvedConfig: unknown;
    try {
      resolvedConfig = resolvePluginConfig({ ...plugin, manifest }, config);
    } catch (error) {
      writeAudit(
        manifest.id,
        "failed",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
    const listeners = new Set<(event: unknown) => void>();
    const commands = new Map<string, PluginCommand>();
    const providedServices = new Map<string, number>();
    const disposers: Array<() => void> = [];
    const abort = new AbortController();
    const effects = new Set<Promise<unknown>>();
    let listenerSequence = 0;
    // The kernel channel is resolved before setup: the plugin's capability
    // loads (and, for a plugin that declares `requires`, waits for the
    // required services to appear) so setup runs only once the capability is
    // active — the same dependency-ordered activation a built-in family gets.
    let pluginContribute:
      | ((
          kind: PluginContributionKind,
          name: string,
          payload: unknown,
        ) => () => void)
      | undefined;
    try {
      pluginContribute = await input.contribute?.(manifest, loadContext);
    } catch (error) {
      writeAudit(
        manifest.id,
        "failed",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
    const api: PluginAPI = {
      config: resolvedConfig,
      tools: {
        register(tool) {
          assertCapability(manifest, "tools", allowedOverride);
          const name = loadContext.builtin
            ? tool.name
            : `plugin_${manifest.id.replace(/[^a-z0-9_]/giu, "_")}_${tool.name}`;
          // Dynamic plugin tools require approval unless the workspace explicitly
          // trusts a plugin's own read-only side-effect declaration.
          const ownedTool = {
            ...tool,
            name,
            requiresApproval:
              loadContext.builtin || input.readOnly?.[manifest.id]
                ? tool.requiresApproval
                : true,
          };
          if (input.tools.get(name) !== undefined)
            throw new Error(`plugin tool already registered: ${name}`);
          const releaseKernel = pluginContribute?.("tools", name, ownedTool);
          input.tools.set(name, ownedTool);
          const dispose = ownedDisposer(
            ...(releaseKernel ? [releaseKernel] : []),
            () => {
              if (input.tools.get(name) === ownedTool) input.tools.delete(name);
            },
          );
          disposers.push(dispose);
          return dispose;
        },
        registerAlias(alias, target) {
          assertCapability(manifest, "tools", allowedOverride);
          const prefix = (name: string) =>
            loadContext.builtin
              ? name
              : `plugin_${manifest.id.replace(/[^a-z0-9_]/giu, "_")}_${name}`;
          input.tools.addAlias(prefix(alias), prefix(target));
          return () => undefined;
        },
      },
      services: {
        provide(name, value) {
          if (!manifest.provides.includes(name))
            throw new Error(
              `plugin ${manifest.id} provided undeclared service: ${name}`,
            );
          assertCapability(manifest, "services", allowedOverride);
          const releaseKernel = pluginContribute?.("services", name, value);
          providedServices.set(name, (providedServices.get(name) ?? 0) + 1);
          const dispose = ownedDisposer(
            ...(releaseKernel ? [releaseKernel] : []),
            () => {
              const remaining = (providedServices.get(name) ?? 1) - 1;
              if (remaining > 0) providedServices.set(name, remaining);
              else providedServices.delete(name);
            },
          );
          disposers.push(dispose);
          return dispose;
        },
        get: <T>(name: string) => input.service?.<T>(name),
        on: <T>(name: string, listener: (value: T | undefined) => void) => {
          const unsubscribe = input.onServiceUpdate?.((update) => {
            if (update.name === name) listener(input.service?.<T>(name));
          });
          const dispose = once(unsubscribe ?? (() => undefined));
          disposers.push(dispose);
          return dispose;
        },
      },
      events: {
        on(
          typeOrListener: string | ((event: unknown) => void),
          typedListener?: (event: unknown) => void,
        ) {
          assertCapability(manifest, "events", allowedOverride);
          const listener =
            typeof typeOrListener === "function"
              ? typeOrListener
              : (event: unknown) => {
                  if (
                    event &&
                    typeof event === "object" &&
                    "type" in event &&
                    event.type === typeOrListener
                  )
                    typedListener?.(event);
                };
          const contributionName = `plugin_${manifest.id.replace(/[^a-z0-9_]/giu, "_")}_listener_${++listenerSequence}`;
          const releaseKernel = pluginContribute?.(
            "listeners",
            contributionName,
            listener,
          );
          listeners.add(listener);
          const dispose = ownedDisposer(
            ...(releaseKernel ? [releaseKernel] : []),
            () => listeners.delete(listener),
          );
          disposers.push(dispose);
          return dispose;
        },
      },
      commands: {
        register(command) {
          assertCapability(manifest, "commands", allowedOverride);
          // Namespaced like plugin tools, so a plugin cannot shadow a built-in
          // command by choosing its name.
          const name = loadContext.builtin
            ? command.name
            : `plugin_${manifest.id.replace(/[^a-z0-9_]/giu, "_")}_${command.name}`;
          if (commandOwners.has(name))
            throw new Error(`plugin command already registered: ${name}`);
          const ownedCommand: PluginCommand = {
            ...command,
            name,
            category: command.category ?? manifest.name,
          };
          const releaseKernel = pluginContribute?.(
            "commands",
            name,
            ownedCommand,
          );
          commands.set(name, ownedCommand);
          commandOwners.set(name, manifest.id);
          const dispose = ownedDisposer(
            ...(releaseKernel ? [releaseKernel] : []),
            () => {
              commands.delete(name);
              commandOwners.delete(name);
            },
          );
          disposers.push(dispose);
          return dispose;
        },
      },
      resources: namedRegistry("resources", "resources"),
      projections: namedRegistry("projections", "projections"),
      workflows: namedRegistry("workflows", "workflows"),
      settingsSchema: namedRegistry("settingsSchema", "settingsSchema"),
      adapters: namedRegistry(
        "adapters",
        "adapters",
      ) as PluginAdapterContributionRegistry,
      scheduler: {
        add: namedRegistry("schedulerJobs", "schedulerJobs").register,
      },
      effects: {
        signal: abort.signal,
        run<T>(effect: (signal: AbortSignal) => Promise<T>) {
          if (abort.signal.aborted)
            return Promise.reject(
              new Error(`plugin is unloading: ${manifest.id}`),
            );
          const task = Promise.resolve().then(() => effect(abort.signal));
          effects.add(task);
          void task.finally(() => effects.delete(task)).catch(() => undefined);
          return task;
        },
      },
      // The runtime's resolved config, when the host provides it: a plugin
      // reads the effective config by name instead of duplicating a parser.
      ...(input.runtimeConfig ? { runtimeConfig: input.runtimeConfig } : {}),
    };

    function namedRegistry(
      point: PluginIntegrationPoint,
      kind: PluginContributionKind,
    ): PluginNamedContributionRegistry {
      return {
        register(contribution) {
          assertCapability(manifest, point, allowedOverride);
          if (!contribution.name)
            throw new Error(
              `plugin ${manifest.id} contributed unnamed ${kind}`,
            );
          const dispose = once(
            pluginContribute?.(kind, contribution.name, contribution) ??
              (() => undefined),
          );
          disposers.push(dispose);
          return dispose;
        },
      };
    }
    try {
      await plugin.setup(api);
      const missingServices = manifest.provides.filter(
        (name) => !providedServices.has(name),
      );
      if (missingServices.length)
        throw new Error(
          `plugin ${manifest.id} did not provide declared services: ${missingServices.join(", ")}`,
        );
    } catch (error) {
      abort.abort();
      await Promise.allSettled(effects);
      cleanup(disposers);
      try {
        input.onUnload?.(manifest.id, loadContext);
      } catch {
        // The setup error remains primary; host cleanup is best-effort here.
      }
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
      commands,
      dispose: disposers,
      abort,
      effects,
      loadContext,
    });
    writeAudit(manifest.id, "loaded");
  }

  async function unloadOne(id: string) {
    const entry = plugins.get(id);
    if (!entry) throw new Error(`plugin not found: ${id}`);
    const errors: unknown[] = [];
    entry.abort.abort();
    try {
      await entry.plugin.dispose?.();
    } catch (error) {
      errors.push(error);
    }
    await Promise.allSettled(entry.effects);
    errors.push(...cleanup(entry.dispose));
    plugins.delete(id);
    try {
      input.onUnload?.(id, entry.loadContext);
    } catch (error) {
      errors.push(error);
    }
    const error = errors[0];
    writeAudit(
      id,
      error === undefined ? "unloaded" : "failed",
      error instanceof Error
        ? error.message
        : error === undefined
          ? undefined
          : String(error),
    );
    if (error !== undefined) throw error;
  }

  function dependentOrder(id: string): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const visit = (dependencyID: string) => {
      for (const [candidateID, entry] of [...plugins].reverse()) {
        if (visited.has(candidateID)) continue;
        const manifest = entry.plugin.manifest;
        if (
          manifest.apiVersion !== 2 ||
          !manifest.dependencies.some(
            (dependency) =>
              !dependency.optional && dependency.id === dependencyID,
          )
        )
          continue;
        visited.add(candidateID);
        visit(candidateID);
        order.push(candidateID);
      }
    };
    visit(id);
    return order;
  }

  async function unloadMany(ids: string[]) {
    const errors: unknown[] = [];
    for (const id of ids)
      if (plugins.has(id))
        try {
          await unloadOne(id);
        } catch (error) {
          errors.push(error);
        }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1)
      throw new AggregateError(errors, "multiple plugins failed to unload");
  }

  return {
    async load(plugin: Plugin, allowedOverride?: string[], config?: unknown) {
      await loadPlugin(plugin, allowedOverride, config, { builtin: false });
    },
    async loadBuiltin(plugin: Plugin, config?: unknown) {
      await loadPlugin(
        plugin,
        manifestIntegrationPoints(pluginManifestSchema.parse(plugin.manifest)),
        config,
        {
          builtin: true,
        },
      );
    },
    async unload(id: string) {
      if (!plugins.has(id)) throw new Error(`plugin not found: ${id}`);
      await unloadMany([...dependentOrder(id), id]);
    },
    async unloadAll() {
      await unloadMany([...plugins.keys()].reverse());
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
    /** Every command currently contributed, in stable plugin order. */
    commands(): PluginCommand[] {
      return [...plugins.values()].flatMap((entry) => [
        ...entry.commands.values(),
      ]);
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
  const directories = [
    dir,
    ...entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(dir, entry.name)),
  ];
  const modulesDir = join(dir, "node_modules");
  const modules = await readdir(modulesDir, { withFileTypes: true }).catch(
    () => [],
  );
  for (const entry of modules) {
    if (!entry.isDirectory()) continue;
    const packagePath = join(modulesDir, entry.name);
    if (!entry.name.startsWith("@")) {
      directories.push(packagePath);
      continue;
    }
    for (const scoped of await readdir(packagePath, {
      withFileTypes: true,
    }).catch(() => []))
      if (scoped.isDirectory())
        directories.push(join(packagePath, scoped.name));
  }
  for (const directory of directories) {
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
  /** Per-plugin config, keyed by plugin id, validated by the plugin's schema. */
  settings?: Record<string, unknown>;
  onError?: (id: string, error: unknown) => void;
}) {
  const loaded: PluginManifest[] = [];
  const discovered: Array<{ manifest: PluginManifest; path: string }> = [];
  for (const root of input.roots) {
    for (const item of await discoverPluginManifests(root))
      if (input.enabled?.[item.manifest.id] !== false) discovered.push(item);
  }
  const resolution = resolvePluginDependencies(
    discovered.map((item) => item.manifest),
    input.registry.list(),
  );
  for (const unresolved of [...resolution.denied, ...resolution.pending])
    input.onError?.(
      unresolved.id,
      new Error(`plugin dependency unresolved: ${unresolved.reason}`),
    );
  const byID = new Map(discovered.map((item) => [item.manifest.id, item]));
  for (const id of resolution.order) {
    const item = byID.get(id);
    if (!item) continue;
    const { manifest, path } = item;
    try {
      const entry = validatePluginPath(resolve(path, ".."), manifest.entry);
      const module = (await import(pathToFileURL(entry).href)) as {
        default?: unknown;
      };
      const plugin = module.default;
      if (!plugin || typeof plugin !== "object")
        throw new Error(`plugin module has no default export: ${manifest.id}`);
      const candidate = plugin as Partial<Plugin>;
      if (!candidate.setup || typeof candidate.setup !== "function")
        throw new Error(`plugin module has no setup function: ${manifest.id}`);
      await input.registry.load(
        { ...candidate, manifest } as Plugin,
        input.capabilities?.[manifest.id],
        input.settings?.[manifest.id],
      );
      loaded.push(manifest);
    } catch (error) {
      input.onError?.(manifest.id, error);
    }
  }
  return loaded;
}

export function validatePluginPath(root: string, path: string) {
  const resolved = resolve(root, path);
  // Containment must be separator-agnostic. Comparing against a hardcoded
  // `${root}/` prefix never matches a Windows path, which rejected every
  // plugin as escaping its root. `relative` is equivalent on POSIX and also
  // honours Windows drive and case semantics.
  const inside = relative(resolve(root), resolved);
  if (inside !== "" && (inside.startsWith("..") || isAbsolute(inside)))
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
  /** Config to load with, validated by the plugin's own `configSchema`. */
  config?: unknown;
  /** Workspace trust mark, same shape the registry accepts. */
  readOnly?: Record<string, boolean>;
}) {
  const tools = new Map<string, RuntimeTool>();
  // The kernel channel is captured, not wired to a real registry: conformance
  // verifies that plugin tools are attributable to the plugin (namespaced names,
  // released on unload) without needing the capability kernel at all.
  const contributed: string[] = [];
  const releases: string[] = [];
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
    readOnly: input.readOnly,
    contribute: (manifest) => (_kind, name) => {
      contributed.push(name);
      return () => {
        releases.push(name);
      };
    },
  });
  const result: Array<{ name: string; passed: boolean; detail?: string }> = [];
  const manifest = input.plugin.manifest;
  let setupFailed: unknown;
  try {
    await registry.load(input.plugin, undefined, input.config);
  } catch (error) {
    setupFailed = error;
  }
  result.push({
    name: "manifest-and-setup",
    passed: !setupFailed,
    ...(setupFailed
      ? {
          detail:
            setupFailed instanceof Error
              ? setupFailed.message
              : String(setupFailed),
        }
      : {}),
  });
  if (!setupFailed) {
    // Every tool the plugin registered is namespaced to it, so a plugin cannot
    // shadow a built-in by choosing a name, and it was offered to the kernel
    // channel under that owned name.
    const prefix = `plugin_${manifest.id.replace(/[^a-z0-9_]/giu, "_")}_`;
    result.push({
      name: "tool-ownership",
      passed:
        contributed.length > 0 &&
        contributed.every((name) => name.startsWith(prefix)) &&
        [...tools.keys()].every((name) => name.startsWith(prefix)),
      detail:
        contributed.length === 0 ? "plugin contributed no tools" : undefined,
    });
    // Without the readOnly trust mark, dynamic plugin tools demand approval;
    // with it, the plugin's own declaration is honoured.
    const sample = [...tools.entries()][0];
    result.push({
      name: "approval-boundary",
      passed: sample
        ? input.readOnly?.[manifest.id]
          ? sample[1].requiresApproval === false
          : sample[1].requiresApproval === true
        : false,
      detail: sample ? undefined : "plugin contributed no tools to check",
    });
    await registry.unload(manifest.id);
    result.push({
      name: "owned-registration-cleanup",
      passed:
        tools.size === 0 &&
        contributed.every((name) => releases.includes(name)),
      detail:
        tools.size || contributed.length !== releases.length
          ? "plugin registrations remained after unload"
          : undefined,
    });
  }
  return result;
}
