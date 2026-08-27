import type { RuntimeClient, RuntimeEvent } from "@natalia/contracts";
import type * as ViewStore from "@natalia/view-store";
import type { AppState } from "@natalia/view-store";

export type UiPluginLifecycle = {
  dispose(): void | Promise<void>;
};

export type UiPanelDefinition = {
  id: string;
  title: string;
  region?: "main" | "side" | "bottom";
};

export type UiCommandDefinition = {
  id: string;
  title: string;
  description?: string;
  run(args?: unknown): unknown | Promise<unknown>;
};

export type UiEventPattern =
  | "*"
  | "runtime.*"
  | "runtime.turn.*"
  | "runtime.chat.*"
  | "runtime.checkpoint.*"
  | (string & {});

export type UiEventBus = {
  emit(event: RuntimeEvent): void;
  subscribe(
    listener: (event: RuntimeEvent) => void,
    filter?: readonly UiEventPattern[],
  ): () => void;
};

export type PreferenceStore = {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  subscribe(listener: (key: string, value: unknown) => void): () => void;
};

export type Logger = {
  debug(message: string, extra?: unknown): void;
  info(message: string, extra?: unknown): void;
  warn(message: string, extra?: unknown): void;
  error(message: string, extra?: unknown): void;
};

export type TerminalOptions = {
  cwd?: string;
  cols?: number;
  rows?: number;
};

export type TerminalHandle = {
  write(data: string | Uint8Array): Promise<void>;
  resize?(cols: number, rows: number): Promise<void>;
  onData(listener: (data: Uint8Array) => void): () => void;
  close(): Promise<void>;
};

export type UiTransport = {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  openPath?(path: string): Promise<void>;
  readClipboardImage?(): Promise<Uint8Array | undefined>;
  createTerminal?(options: TerminalOptions): Promise<TerminalHandle>;
};

export type UiProjection = {
  getState(): AppState;
  subscribe(listener: (state: AppState) => void): () => void;
};

export type UiPluginContext<TContext = unknown> = {
  root: HTMLElement;
  runtime: RuntimeClient;
  viewStore: typeof ViewStore;
  projection: UiProjection;
  events: UiEventBus;
  preferences: PreferenceStore;
  transport: UiTransport;
  logger: Logger;
  t: (text: string) => string;
  extra?: TContext;
};

export type UiPlugin<TContext = unknown> = {
  id: string;
  name: string;
  version: string;
  description?: string;
  mount(
    ctx: UiPluginContext<TContext>,
  ): Promise<UiPluginLifecycle | void> | UiPluginLifecycle | void;
  unmount?(): void | Promise<void>;
  panels?: UiPanelDefinition[];
  commands?: UiCommandDefinition[];
  events?: UiEventPattern[];
  preferences?: Record<string, unknown>;
};

export function defineUiPlugin<TContext = unknown>(
  plugin: UiPlugin<TContext>,
): UiPlugin<TContext> {
  return plugin;
}
