import type { UiAdapterMountInput } from "@natalia/contracts";
import type { RuntimeTool } from "@natalia/tools";
import type { PluginManifest } from "./manifest";

export type PluginConfigIssue = {
  message: string;
  path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>;
};

export type PluginConfigValidation = {
  value?: unknown;
  issues?: ReadonlyArray<PluginConfigIssue>;
};

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
  configSchema?: PluginConfigSchema;
  setup(api: PluginAPI): void | Promise<void>;
  dispose?(): void | Promise<void>;
};

export type PluginAPI = {
  config: unknown;
  runtimeConfig?: () => unknown;
  tools: {
    register(tool: RuntimeTool): () => void;
    registerAlias(alias: string, target: string): () => void;
  };
  services: {
    provide(name: string, value: unknown): () => void;
    get<T>(name: string): T | undefined;
    on<T>(name: string, listener: (value: T | undefined) => void): () => void;
  };
  events: {
    on(listener: (event: unknown) => void): () => void;
    on(type: string, listener: (event: unknown) => void): () => void;
  };
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
export type PluginAdapterInstance = { dispose(): void | Promise<void> };
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
  registerUi(contribution: PluginUiAdapterContribution): () => void;
};
export type PluginUiAdapterContribution = {
  kind: string;
  mount(input: UiAdapterMountInput): void | Promise<void>;
  dispose(): void | Promise<void>;
};
export type PluginAdapterRegistryView = {
  contribution<T>(kind: "adapters", name: string): T | undefined;
  ownerOf(kind: "adapters", name: string): string | undefined;
};
export type PluginCommand = {
  name: string;
  title: string;
  category?: string;
  run(): void | Promise<void>;
};
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
export type PluginContributionOwner = {
  contribute(
    kind: PluginContributionKind,
    name: string,
    payload: unknown,
  ): () => void;
  release(): void;
};
export type PluginActivationStatus =
  | "pending"
  | "activating"
  | "active"
  | "deactivating"
  | "failed";
export type PluginStatus = {
  id: string;
  status: PluginActivationStatus;
  missingServices: string[];
  error?: string;
};

export function definePlugin(plugin: Plugin) {
  return plugin;
}
