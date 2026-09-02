import {
  createRealRuntimeClient,
  EGRESS_ADVISORY,
} from "@natalia/client";
import type {
  EpisodeID,
  EvaluatorResult,
  RuntimeEvent,
  SessionID,
} from "@natalia/contracts";
import { resolveConfig } from "@natalia/config";
import { agentsFromConfig } from "@natalia/agent";
import { userStateHome } from "@natalia/platform";
import { pluginStoreRoot } from "./official-plugins";
import { providerForModel } from "@natalia/runtime";
import { createRecordedFetch, readCassette } from "@natalia/transport";
import {
  createRuntimeDaemonStore,
  daemonToken,
  registerRuntimeDaemon,
  runtimeDaemonStatus,
  stopRuntimeDaemon,
} from "@natalia/transport/host";
import { createHttpTransportHost } from "./transport-host";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import {
  deleteLocalSession,
  duplicateLocalSession,
  exportLocalSessionMetadata,
  importLocalSessionMetadata,
  doctorReport,
  listLocalSessions,
  plainStatus,
  renameLocalSession,
  setLocalSessionPinned,
  sessionTable,
  promptArguments,
  trustList,
  trustRemove,
  workspaceFilesystemCommand,
  showLocalSession,
  startupDiagnostics,
  localWorkGraph,
  workGraphLines,
} from "./index";
import { valueAfter, daemonDir, waitSignal } from "./command-helpers";

export async function handleDaemonCommands(argv: string[]) {
  const subcommand = argv[0];
  if (
    !new Set([
      "daemon",
      "--daemon-serve",
      "daemon-status",
      "--daemon-status",
      "daemon-stop",
      "--daemon-stop",
    ]).has(subcommand ?? "")
  )
    return false;
  const configPath =
    process.env.NATALIA_CONFIG ?? `${process.cwd()}/.natalia/config.json`;
  switch (subcommand) {
    case "daemon":
    case "--daemon-serve": {
      const store = createRuntimeDaemonStore({
        dir: valueAfter(argv, "--daemon-dir") ?? daemonDir(),
      });
      // The port is the first argument after the subcommand. It used to be read one
      // position further along, so neither form could actually choose a port.
      const requestedPort = valueAfter(argv, subcommand);
      const port = Number(requestedPort ?? "8787");
      if (!Number.isInteger(port) || port < 0 || port > 65535)
        throw new Error("daemon requires a valid port");
      const token = await daemonToken(store);
      const client = createRealRuntimeClient({
        pluginStoreRoot: pluginStoreRoot(),
      });
      const transport = createHttpTransportHost({
        client,
        port,
        token,
      });
      const { server } = transport;
      try {
        await registerRuntimeDaemon(store, {
          url: server.url,
          pid: process.pid,
          transport: "http",
        });
        console.log(JSON.stringify({ url: server.url }));
        await waitSignal();
      } finally {
        await transport.close();
        await client.dispose?.();
      }
      break;
    }

    case "daemon-status":
    case "--daemon-status": {
      console.log(
        JSON.stringify(
          await runtimeDaemonStatus(
            createRuntimeDaemonStore({ dir: daemonDir() }),
          ),
          null,
          2,
        ),
      );
      break;
    }

    case "daemon-stop":
    case "--daemon-stop": {
      console.log(
        JSON.stringify(
          await stopRuntimeDaemon(
            createRuntimeDaemonStore({ dir: daemonDir() }),
          ),
          null,
          2,
        ),
      );
      break;
    }
  }
  return true;
}
