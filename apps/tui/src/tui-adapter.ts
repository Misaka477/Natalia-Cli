import { createFakeBackend, createWorkerRuntimeClient } from "@natalia/client";
import type { RuntimeClient, UiAdapterMountInput } from "@natalia/contracts";
import {
  createUiAdapterMountInput,
  type PluginAdapterInstance,
} from "@natalia/plugin";
import { paste100KiB } from "@natalia/testing";
import { MessageChannel, Worker } from "node:worker_threads";
import { runTuiShell } from "./app/runtime";
import {
  initializeTuiOfficialPlugins,
  resolveTuiPluginStore,
} from "./official-plugins";

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

export async function createTuiAdapterHost(
  options: TuiAdapterOptions,
  start: StartTuiAdapter = startTuiAdapter,
  createRuntime: (
    options: TuiAdapterOptions,
  ) => RuntimeClient | Promise<RuntimeClient> = async (input) => {
    if (input.smoke) return createFakeBackend();
    await initializeTuiOfficialPlugins();
    return createWorkerBackend(
      input.workspaceRoot,
      await resolveTuiPluginStore(),
      input.sessionID,
    );
  },
) {
  const runtime = await createRuntime(options);
  let adapter: TuiAdapterInstance;
  try {
    adapter = await start(createUiAdapterMountInput(runtime), options);
  } catch (error) {
    await runtime.dispose?.();
    throw error;
  }
  let closed = false;
  return {
    done: adapter.done,
    async close() {
      if (closed) return;
      closed = true;
      const errors: unknown[] = [];
      try {
        await adapter.dispose();
      } catch (error) {
        errors.push(error);
      }
      try {
        await runtime.dispose?.();
      } catch (error) {
        errors.push(error);
      }
      if (errors.length)
        throw new AggregateError(errors, "TUI host cleanup failed");
    },
  };
}

async function startTuiAdapter(
  input: UiAdapterMountInput,
  options: TuiAdapterOptions,
): Promise<TuiAdapterInstance> {
  let currentWorkspaceRoot = options.workspaceRoot;
  const pluginStoreRoot = options.smoke
    ? undefined
    : await resolveTuiPluginStore();
  const createBackend = async (nextSessionID?: string) => {
    return createWorkerBackend(
      currentWorkspaceRoot,
      pluginStoreRoot!,
      nextSessionID,
    );
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
  pluginStoreRoot: string,
  sessionID = newSessionID(),
) {
  const channel = new MessageChannel();
  const worker = new Worker(new URL("./runtime-worker.ts", import.meta.url), {
    workerData: {
      port: channel.port1,
      workspaceRoot,
      pluginStoreRoot,
      sessionID,
    },
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
