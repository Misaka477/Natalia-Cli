import {
  createFakeBackend,
  createUiAdapterHost,
  createWorkerRuntimeClient,
} from "@natalia/client";
import { TUI_PLUGIN_MANIFEST } from "@natalia/builtin-plugins";
import type { RuntimeClient, UiAdapterMountInput } from "@natalia/contracts";
import type {
  DesiredPluginEntry,
  Plugin,
  PluginAdapterInstance,
} from "@natalia/plugin";
import { paste100KiB } from "@natalia/testing";
import { MessageChannel, Worker } from "node:worker_threads";
import { runTuiShell } from "./app/runtime";

export const TUI_PLUGIN_ID = TUI_PLUGIN_MANIFEST.id;
export const TUI_ADAPTER = "ui.tui";

export type TuiAdapterOptions = {
  workspaceRoot: string;
  sessionID?: string;
  smoke?: boolean;
  doctor?: boolean;
  diagnostics?: boolean;
};

type TuiAdapterInstance = PluginAdapterInstance & {
  done: Promise<void>;
};

type StartTuiAdapter = (
  input: UiAdapterMountInput,
  options: TuiAdapterOptions,
) => Promise<TuiAdapterInstance>;

export function createTuiAdapterPlugin(
  options: TuiAdapterOptions,
  start: StartTuiAdapter = startTuiAdapter,
): Plugin {
  let active: TuiAdapterInstance | undefined;
  return {
    manifest: TUI_PLUGIN_MANIFEST,
    setup(api) {
      api.adapters.registerUi({
        kind: TUI_ADAPTER,
        async mount(input) {
          active = await start(input, options);
        },
        async dispose() {
          await active?.dispose();
          active = undefined;
        },
      });
    },
  };
}

export async function createTuiAdapterHost(
  options: TuiAdapterOptions & { enabled?: boolean },
  start: StartTuiAdapter = startTuiAdapter,
  createRuntime: (options: TuiAdapterOptions) => RuntimeClient = (input) =>
    input.smoke
      ? createFakeBackend()
      : createWorkerBackend(input.workspaceRoot, input.sessionID),
) {
  if (options.enabled === false)
    throw new Error(`TUI plugin is disabled (${TUI_PLUGIN_ID})`);
  const { enabled: _, ...adapterOptions } = options;
  const runtime = createRuntime(adapterOptions);
  let adapter: TuiAdapterInstance | undefined;
  const entry: DesiredPluginEntry = {
    id: TUI_PLUGIN_ID,
    enabled: true,
    fingerprint: TUI_PLUGIN_MANIFEST.version,
    manifest: TUI_PLUGIN_MANIFEST,
    load: async () =>
      createTuiAdapterPlugin(adapterOptions, async (input, launchOptions) => {
        adapter = await start(input, launchOptions);
        return adapter;
      }),
  };
  const host = await createUiAdapterHost({
    workspaceRoot: adapterOptions.workspaceRoot,
    runtime,
    kinds: [TUI_ADAPTER],
    extraEntries: [entry],
    report: (message) => process.stderr.write(`natalia: ${message}\n`),
  });
  return {
    done: adapter!.done,
    async close() {
      await host.close();
    },
  };
}

async function startTuiAdapter(
  input: UiAdapterMountInput,
  options: TuiAdapterOptions,
): Promise<TuiAdapterInstance> {
  let currentWorkspaceRoot = options.workspaceRoot;
  const createBackend = (nextSessionID?: string) => {
    return createWorkerBackend(currentWorkspaceRoot, nextSessionID);
  };
  const initialBackend: RuntimeClient = {
    ...input.runtime,
    start(listener) {
      input.events.subscribe(listener);
    },
    dispose: async () => undefined,
  };
  const handle = await runTuiShell({
    initialPrompt: options.smoke
      ? process.env.NATALIA_TUI_SMOKE_PROMPT || paste100KiB()
      : options.doctor
        ? "/doctor"
        : options.diagnostics
          ? "/diagnostics"
          : undefined,
    fixture: options.smoke,
    backend: initialBackend,
    commands: input.commands,
    createBackend: options.smoke ? undefined : createBackend,
    onWorkspaceRootChange: (nextRoot: string) => {
      currentWorkspaceRoot = nextRoot;
    },
    workspaceRoot: currentWorkspaceRoot,
    closeAfterInitialTurn:
      options.doctor || options.diagnostics ? false : undefined,
  });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    void handle.stop().catch((error: unknown) => {
      process.stderr.write(
        `natalia: shutdown failed: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
  };
  const onUnhandledRejection = (reason: unknown) => {
    process.stderr.write(
      `natalia: unhandled rejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}\n`,
    );
    process.exitCode = 1;
    stop();
  };
  process.on("unhandledRejection", onUnhandledRejection);
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const done = new Promise<void>((resolve) =>
    handle.renderer.once("destroy", resolve),
  );
  return {
    done,
    async dispose() {
      process.off("unhandledRejection", onUnhandledRejection);
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      if (!stopping) {
        stopping = true;
        await handle.stop();
      }
    },
  };
}

function createWorkerBackend(
  workspaceRoot: string,
  sessionID = newSessionID(),
) {
  const channel = new MessageChannel();
  const worker = new Worker(new URL("./runtime-worker.ts", import.meta.url), {
    workerData: { port: channel.port1, workspaceRoot, sessionID },
    transferList: [channel.port1],
  });
  const client = createWorkerRuntimeClient(channel.port2);
  const dispose = client.dispose;
  client.dispose = async () => {
    await dispose?.();
    await worker.terminate();
  };
  return client;
}

function newSessionID() {
  return `ses_${crypto.randomUUID().replace(/-/gu, "").slice(0, 16)}`;
}
