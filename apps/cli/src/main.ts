import { createRealRuntimeClient } from "@natalia/client";
import type { RuntimeEvent } from "@natalia/contracts";
import { userStateHome } from "@natalia/platform";
import {
  createRuntimeDaemonStore,
  createRuntimeHttpServer,
  createRecordedFetch,
  readCassette,
  daemonToken,
  registerRuntimeDaemon,
  runtimeDaemonStatus,
  stopRuntimeDaemon,
} from "@natalia/transport";
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
  workspaceFilesystemCommand,
  attachTerminalReadOnly,
  attachTerminalWithControl,
  externalTerminalLaunchCommand,
  launchExternalTerminal,
  showLocalSession,
  startupDiagnostics,
} from "./index";

const argv = process.argv.slice(2);
const configPath =
  process.env.NATALIA_CONFIG ?? `${process.cwd()}/.natalia/config.json`;
const subcommand = argv[0];

switch (subcommand) {
  case "serve":
  case "--serve": {
    const port = Number(
      valueAfter(argv, subcommand === "--serve" ? "--serve" : "serve", 1) ??
        "8787",
    );
    if (!Number.isInteger(port) || port <= 0 || port > 65535)
      throw new Error("serve requires a valid port");
    const server = createRuntimeHttpServer({
      client: createRealRuntimeClient(),
      port,
      token: process.env.NATALIA_TRANSPORT_TOKEN,
    });
    console.log(
      JSON.stringify({
        url: server.url,
        auth: process.env.NATALIA_TRANSPORT_TOKEN
          ? "bearer required"
          : "disabled",
      }),
    );
    await waitSignal();
    server.stop(true);
    break;
  }

  case "daemon":
  case "--daemon-serve": {
    const store = createRuntimeDaemonStore({
      dir: valueAfter(argv, "--daemon-dir") ?? daemonDir(),
    });
    const port = Number(
      valueAfter(
        argv,
        subcommand === "--daemon-serve" ? "--daemon-serve" : "daemon",
        1,
      ) ?? "8787",
    );
    if (!Number.isInteger(port) || port <= 0 || port > 65535)
      throw new Error("daemon requires a valid port");
    const token = await daemonToken(store);
    const server = createRuntimeHttpServer({
      client: createRealRuntimeClient(),
      port,
      token,
    });
    await registerRuntimeDaemon(store, {
      url: server.url,
      pid: process.pid,
      transport: "http",
    });
    console.log(JSON.stringify({ url: server.url }));
    await waitSignal();
    server.stop(true);
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
        await stopRuntimeDaemon(createRuntimeDaemonStore({ dir: daemonDir() })),
        null,
        2,
      ),
    );
    break;
  }

  case "run":
  case "--once": {
    const permissionProfile = valueAfter(argv, "--permission");
    if (argv.includes("--permission") && !permissionProfile)
      throw new Error("--permission requires a profile name");
    const { text: prompt, attachments } = promptArguments(
      withoutRunOption(argv.slice(1), "--permission"),
    );
    if (!prompt) throw new Error("run requires a prompt");
    await runOnce(
      prompt,
      argv.includes("--json"),
      attachments,
      permissionProfile,
    );
    break;
  }

  case "eval":
  case "--stdio": {
    const client = createRealRuntimeClient();
    try {
      client.start((event) => console.log(JSON.stringify(event)));
      const input = await Bun.stdin.text();
      for (const line of input.split(/\r?\n/u)) {
        if (!line.trim()) continue;
        const request = JSON.parse(line) as {
          prompt?: string;
          delivery?: "steer" | "queue";
          attachments?: string[];
          cancel?: string;
          pause?: string;
          resume?: boolean;
        };
        if (request.cancel) client.cancel(request.cancel);
        if (request.pause) client.pause?.(request.pause);
        if (request.resume) client.resume?.();
        if (
          request.prompt &&
          request.delivery === "queue" &&
          client.submitInput
        )
          await client.submitInput({
            text: request.prompt,
            delivery: "queue",
            attachments: request.attachments,
          });
        else if (
          request.prompt &&
          request.attachments?.length &&
          client.submitInput
        )
          await client.submitInput({
            text: request.prompt,
            attachments: request.attachments,
          });
        else if (request.prompt) await client.submit(request.prompt);
      }
    } finally {
      // Without this the workspace watcher keeps the loop alive and the
      // process never exits after the work is done.
      await client.dispose?.();
    }
    break;
  }

  case "diagnose":
  case "--diagnostics": {
    console.log(JSON.stringify(await startupDiagnostics(configPath), null, 2));
    break;
  }

  case "status": {
    console.log(JSON.stringify(await plainStatus(configPath), null, 2));
    break;
  }

  case "doctor": {
    const report = await doctorReport({
      configPath,
      workspaceRoot: valueAfter(argv, "--workspace"),
    });
    console.log(
      argv.includes("--json")
        ? JSON.stringify(report, null, 2)
        : [
            `config: ${report.configPath}`,
            `migration: ${report.migration}`,
            `default model: ${report.defaultModel.modelID} (${report.defaultModel.selected ? "selected" : (report.defaultModel.reason ?? "unavailable")})`,
            `sessions: ${report.sessions.count} (${report.sessions.pendingInputs} pending inputs)`,
          ].join("\n"),
    );
    break;
  }

  case "session": {
    const action = argv[1] ?? "list";
    const workspaceRoot = valueAfter(argv, "--workspace");
    if (action === "list") {
      const sessions = await listLocalSessions(workspaceRoot);
      console.log(
        argv.includes("--json")
          ? JSON.stringify(sessions, null, 2)
          : sessionTable(sessions),
      );
      break;
    }
    if (action === "delete") {
      const id = argv[2];
      if (!id) throw new Error("session delete requires an ID");
      console.log(
        JSON.stringify(await deleteLocalSession(id, workspaceRoot), null, 2),
      );
      break;
    }
    if (action === "show") {
      const id = argv[2];
      if (!id) throw new Error("session show requires an ID");
      const result = await showLocalSession(id, workspaceRoot);
      console.log(
        argv.includes("--json")
          ? JSON.stringify(result, null, 2)
          : [
              `id: ${result.id}`,
              `title: ${result.title}`,
              `events: ${result.events}`,
              `pending inputs: ${result.pendingInputs}`,
              `pinned: ${result.pinned ? "yes" : "no"}`,
              `resumable: ${result.resumable ? "yes" : "no"}`,
            ].join("\n"),
      );
      break;
    }
    if (action === "rename") {
      const id = argv[2];
      const workspaceIndex = argv.indexOf("--workspace");
      const title = argv
        .slice(3, workspaceIndex >= 0 ? workspaceIndex : undefined)
        .join(" ");
      if (!id || !title)
        throw new Error("session rename requires an ID and title");
      console.log(
        JSON.stringify(
          await renameLocalSession(id, title, workspaceRoot),
          null,
          2,
        ),
      );
      break;
    }
    if (action === "pin" || action === "unpin") {
      const id = argv[2];
      if (!id) throw new Error(`session ${action} requires an ID`);
      console.log(
        JSON.stringify(
          await setLocalSessionPinned(id, action === "pin", workspaceRoot),
          null,
          2,
        ),
      );
      break;
    }
    if (action === "duplicate") {
      const id = argv[2];
      if (!id) throw new Error("session duplicate requires an ID");
      console.log(
        JSON.stringify(
          await duplicateLocalSession(id, {
            title: valueAfter(argv, "--title"),
            newID: valueAfter(argv, "--id"),
            workspaceRoot,
          }),
          null,
          2,
        ),
      );
      break;
    }
    if (action === "export") {
      const id = argv[2];
      if (!id) throw new Error("session export requires an ID");
      console.log(
        JSON.stringify(
          await exportLocalSessionMetadata(id, workspaceRoot),
          null,
          2,
        ),
      );
      break;
    }
    if (action === "import") {
      const raw = argv[2];
      if (!raw)
        throw new Error("session import requires a metadata JSON value");
      const bundle = JSON.parse(raw) as import("./index").SessionMetadataBundle;
      console.log(
        JSON.stringify(
          await importLocalSessionMetadata(bundle, {
            workspaceRoot,
            id: valueAfter(argv, "--id"),
            title: valueAfter(argv, "--title"),
          }),
          null,
          2,
        ),
      );
      break;
    }
    throw new Error(`unknown session action: ${action}`);
  }

  case "terminal": {
    const action = argv[1];
    const id = argv[2];
    if (!id || (action !== "attach" && action !== "open"))
      throw new Error("terminal requires attach <id> or open <id>");
    const store = createRuntimeDaemonStore({
      dir: valueAfter(argv, "--daemon-dir") ?? daemonDir(),
    });
    const directURL = process.env.NATALIA_TERMINAL_URL;
    const directToken = process.env.NATALIA_TERMINAL_TOKEN;
    const status = directURL ? undefined : await runtimeDaemonStatus(store);
    if (!directURL && status?.state !== "running")
      throw new Error(
        "terminal attach requires a running Natalia daemon or NATALIA_TERMINAL_URL bridge",
      );
    if (action === "open") {
      const command = externalTerminalLaunchCommand({
        id,
        executable: [process.execPath, process.argv[1]!],
        preferred: valueAfter(argv, "--terminal"),
        takeControl: argv.includes("--take-control"),
        secureInput: argv.includes("--secure-input"),
      });
      if (!command)
        throw new Error(
          "no supported external terminal found; configure --terminal or use terminal attach inside a terminal",
        );
      console.log(
        JSON.stringify({
          id,
          pid: launchExternalTerminal({ command }),
          command,
        }),
      );
      break;
    }
    let url: string;
    let token: string | undefined;
    if (directURL) {
      url = directURL;
      token = directToken;
    } else {
      if (status?.state !== "running")
        throw new Error("Natalia daemon registration is unavailable");
      url = status.registration.url;
      token = (await readFile(status.registration.tokenFile, "utf8")).trim();
    }
    const controller = new AbortController();
    const stop = () => controller.abort();
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    try {
      const attach = argv.includes("--take-control")
        ? attachTerminalWithControl
        : attachTerminalReadOnly;
      await attach({
        id,
        url,
        token,
        signal: controller.signal,
        sensitive: argv.includes("--secure-input"),
      });
    } finally {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
    }
    break;
  }

  case "fs": {
    const action = argv[1] as "list" | "read" | "glob" | "search" | undefined;
    if (!action || !["list", "read", "glob", "search"].includes(action))
      throw new Error("fs requires list, read, glob, or search");
    const positional = argv.filter(
      (value, index) =>
        index > 1 &&
        !value.startsWith("--") &&
        argv[index - 1] !== "--workspace" &&
        argv[index - 1] !== "--path" &&
        argv[index - 1] !== "--include" &&
        argv[index - 1] !== "--limit",
    );
    console.log(
      JSON.stringify(
        await workspaceFilesystemCommand({
          action,
          workspaceRoot: valueAfter(argv, "--workspace"),
          path:
            valueAfter(argv, "--path") ??
            (action === "read" ? positional[0] : undefined),
          pattern: action === "glob" ? positional[0] : undefined,
          query: action === "search" ? positional[0] : undefined,
          include: valueAfter(argv, "--include"),
          offset: valueAfter(argv, "--offset")
            ? Number(valueAfter(argv, "--offset"))
            : undefined,
          limit: valueAfter(argv, "--limit")
            ? Number(valueAfter(argv, "--limit"))
            : undefined,
        }),
        null,
        2,
      ),
    );
    break;
  }

  case "record": {
    const cassettePath = argv[1];
    if (!cassettePath) throw new Error("record requires a cassette path");
    const record = createRecordedFetch({ mode: "record", cassettePath });
    const server = createRuntimeHttpServer({
      client: createRealRuntimeClient(),
      port: Number(argv[2] ?? "8787"),
    });
    globalThis.fetch = record as typeof globalThis.fetch;
    console.log(JSON.stringify({ url: server.url, cassette: cassettePath }));
    await waitSignal();
    server.stop(true);
    break;
  }

  case "replay": {
    const cassettePath = argv[1];
    if (!cassettePath) throw new Error("replay requires a cassette path");
    const replay = createRecordedFetch({ mode: "replay", cassettePath });
    const cassette = await readCassette(cassettePath);
    console.log(`replaying ${cassette.interactions.length} recorded requests`);
    for (const entry of cassette.interactions) {
      const response = await replay(entry.request.url, entry.request);
      console.log(
        `${entry.request.method} ${entry.request.url} -> ${response.status}`,
      );
    }
    break;
  }

  default: {
    if (!subcommand || subcommand.startsWith("--")) {
      // Legacy flat mode for backward compat
      if (
        subcommand === "--once" ||
        subcommand === "--stdio" ||
        subcommand === "--diagnostics"
      ) {
        console.error("use 'natalia <subcommand>' instead of 'natalia <flag>'");
        process.exit(1);
      }
    }
    console.log(JSON.stringify(await plainStatus(configPath), null, 2));
    break;
  }
}

async function runOnce(
  prompt: string,
  json: boolean,
  attachments: string[] = [],
  permissionProfile?: string,
) {
  const client = createRealRuntimeClient({ permissionProfile });
  let text = "";
  try {
    client.start((event) => {
      if (json) {
        console.log(JSON.stringify(event));
        return;
      }
      if (event.type === "content.delta") text += event.text;
      const line = plainRuntimeEvent(event);
      if (line) console.log(line);
    });
    if (attachments.length && client.submitInput)
      await client.submitInput({ text: prompt, attachments });
    else await client.submit(prompt);
    if (!json && text) console.log(text);
  } finally {
    // The turn is finished here, but the runtime still holds the workspace
    // watcher, plugins, MCP connections and terminals. Releasing them is what
    // lets a one-shot run actually exit, which is what a scheduler needs.
    await client.dispose?.();
  }
}

function plainRuntimeEvent(event: RuntimeEvent) {
  if (event.type === "diagnostic") return `${event.level}: ${event.message}`;
  if (event.type === "turn.finished")
    return `turn finished: ${event.stopReason}`;
  if (event.type === "checkpoint.created") return `checkpoint ${event.id}`;
  if (event.type === "rollback.end")
    return `rollback ${event.checkpointID} done`;
  return undefined;
}

function valueAfter(argv: string[], flag: string, offset = 0) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1 + offset] : undefined;
}

function withoutRunOption(argv: string[], flag: string) {
  const index = argv.indexOf(flag);
  if (index < 0) return argv;
  return [...argv.slice(0, index), ...argv.slice(index + 2)];
}

function daemonDir() {
  return resolve(userStateHome(), "natalia-cli", "daemon");
}

function waitSignal() {
  return new Promise<void>((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
}
