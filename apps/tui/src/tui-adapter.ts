import { createWorkerRuntimeClient } from "@natalia/client";
import { CapabilityRegistry } from "@natalia/capability";
import type { RuntimeClient } from "@natalia/contracts";
import {
  createPluginAdapterMaterializer,
  createPluginRegistry,
  type Plugin,
  type PluginAdapterInstance,
} from "@natalia/plugin";
import { paste100KiB } from "@natalia/testing";
import { createToolRegistry } from "@natalia/tools";
import { MessageChannel, Worker } from "node:worker_threads";
import { runTuiShell } from "./app/runtime";

export const TUI_PLUGIN_ID = "natalia-tui";
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
  options: TuiAdapterOptions,
) => Promise<TuiAdapterInstance>;

export function createTuiAdapterPlugin(
  start: StartTuiAdapter = startTuiAdapter,
): Plugin {
  return {
    manifest: {
      apiVersion: 2,
      id: TUI_PLUGIN_ID,
      version: "1.0.0",
      name: "TUI",
      description: "Process-level terminal user interface adapter.",
      entry: "natalia:tui",
      scope: "process",
      provides: [],
      requires: [],
      optionalRequires: [],
      conflicts: [],
      dependencies: [],
      hooks: {},
      integrationPoints: ["adapters"],
    },
    setup(api) {
      api.adapters.register({
        name: TUI_ADAPTER,
        adapterType: "ui",
        create: start,
      });
    },
  };
}

export async function createTuiAdapterHost(
  options: TuiAdapterOptions & { enabled?: boolean },
  start: StartTuiAdapter = startTuiAdapter,
) {
  if (options.enabled === false)
    throw new Error(`TUI plugin is disabled (${TUI_PLUGIN_ID})`);
  const { enabled: _, ...adapterOptions } = options;
  const kernel = new CapabilityRegistry();
  const registry = createPluginRegistry({
    tools: createToolRegistry([]),
    contribute: (manifest) => {
      const result = kernel.tryLoad({
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        scope: manifest.scope,
        grants: ["adapters"],
        provides: [],
      });
      if (!result.ok)
        throw new Error(`TUI capability failed to load: ${result.reason}`);
      return (kind, name, payload) => {
        kernel.contribute(manifest.id, kind, name, payload);
        return () => undefined;
      };
    },
    onUnload: (pluginID) => kernel.unload(pluginID),
  });
  await registry.loadBuiltin(createTuiAdapterPlugin(start));
  const materializer = createPluginAdapterMaterializer(kernel);
  let adapter: TuiAdapterInstance;
  try {
    adapter = await materializer.materialize<
      TuiAdapterOptions,
      TuiAdapterInstance
    >(TUI_ADAPTER, adapterOptions);
  } catch (error) {
    await registry.unloadAll();
    throw error;
  }
  let closed = false;
  return {
    done: adapter.done,
    async close() {
      if (closed) return;
      closed = true;
      try {
        await materializer.close();
      } finally {
        await registry.unloadAll();
      }
    },
  };
}

async function startTuiAdapter(
  options: TuiAdapterOptions,
): Promise<TuiAdapterInstance> {
  let currentWorkspaceRoot = options.workspaceRoot;
  const launchSessionID = options.sessionID ?? newSessionID();
  const createBackend = (nextSessionID?: string) => {
    const channel = new MessageChannel();
    const worker = new Worker(new URL("./runtime-worker.ts", import.meta.url), {
      workerData: {
        port: channel.port1,
        workspaceRoot: currentWorkspaceRoot,
        sessionID: nextSessionID ?? launchSessionID,
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
  };
  const initialBackend = options.smoke ? undefined : createBackend();
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
    createBackend: options.smoke ? undefined : createBackend,
    onWorkspaceRootChange: (nextRoot: string) => {
      currentWorkspaceRoot = nextRoot;
    },
    workspaceRoot: currentWorkspaceRoot,
    closeAfterInitialTurn:
      options.doctor || options.diagnostics ? false : undefined,
  }).catch(async (error) => {
    await initialBackend?.dispose?.();
    throw error;
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

function newSessionID() {
  return `ses_${crypto.randomUUID().replace(/-/gu, "").slice(0, 16)}`;
}
