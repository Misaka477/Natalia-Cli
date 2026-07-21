import {
  defaultConfigPath,
  exportLegacyGoWorkspaceBundle,
  importLegacyGoWorkspaceBundle,
  rollbackLegacyGoWorkspaceBundle,
} from "@natalia/config";
import { createRealRuntimeClient } from "@natalia/client";
import type { RuntimeEvent } from "@natalia/contracts";
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
import { plainStatus, startupDiagnostics } from "./index";

const argv = process.argv.slice(2);
const configPath = process.env.NATALIA_CONFIG ?? defaultConfigPath();
const subcommand = argv[0];

switch (subcommand) {
  case "serve":
  case "--serve": {
    const port = Number(valueAfter(argv, subcommand === "--serve" ? "--serve" : "serve", 1) ?? "8787");
    if (!Number.isInteger(port) || port <= 0 || port > 65535)
      throw new Error("serve requires a valid port");
    const server = createRuntimeHttpServer({
      client: createRealRuntimeClient(),
      port,
      token: process.env.NATALIA_TRANSPORT_TOKEN,
    });
    console.log(JSON.stringify({ url: server.url, auth: process.env.NATALIA_TRANSPORT_TOKEN ? "bearer required" : "disabled" }));
    await waitSignal();
    server.stop(true);
    break;
  }

  case "daemon":
  case "--daemon-serve": {
    const store = createRuntimeDaemonStore({
      dir: valueAfter(argv, "--daemon-dir") ?? daemonDir(),
    });
    const port = Number(valueAfter(argv, subcommand === "--daemon-serve" ? "--daemon-serve" : "daemon", 1) ?? "8787");
    if (!Number.isInteger(port) || port <= 0 || port > 65535)
      throw new Error("daemon requires a valid port");
    const token = await daemonToken(store);
    const server = createRuntimeHttpServer({
      client: createRealRuntimeClient(),
      port,
      token,
    });
    await registerRuntimeDaemon(store, { url: server.url, pid: process.pid, transport: "http" });
    console.log(JSON.stringify({ url: server.url }));
    await waitSignal();
    server.stop(true);
    break;
  }

  case "daemon-status":
  case "--daemon-status": {
    console.log(JSON.stringify(await runtimeDaemonStatus(createRuntimeDaemonStore({ dir: daemonDir() })), null, 2));
    break;
  }

  case "daemon-stop":
  case "--daemon-stop": {
    console.log(JSON.stringify(await stopRuntimeDaemon(createRuntimeDaemonStore({ dir: daemonDir() })), null, 2));
    break;
  }

  case "run":
  case "--once": {
    const prompt = argv.slice(1).join(" ").trim();
    if (!prompt) throw new Error("run requires a prompt");
    await runOnce(prompt, argv.includes("--json"));
    break;
  }

  case "eval":
  case "--stdio": {
    const client = createRealRuntimeClient();
    client.start((event) => console.log(JSON.stringify(event)));
    const input = await Bun.stdin.text();
    for (const line of input.split(/\r?\n/u)) {
      if (!line.trim()) continue;
      const request = JSON.parse(line) as {
        prompt?: string;
        delivery?: "steer" | "queue";
        cancel?: string;
        pause?: string;
        resume?: boolean;
      };
      if (request.cancel) client.cancel(request.cancel);
      if (request.pause) client.pause?.(request.pause);
      if (request.resume) client.resume?.();
      if (request.prompt && request.delivery === "queue" && client.submitInput)
        await client.submitInput({ text: request.prompt, delivery: "queue" });
      else if (request.prompt) await client.submit(request.prompt);
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

  case "export-legacy":
  case "--export-legacy": {
    const legacyRoot = valueAfter(argv, "--export-legacy") ?? valueAfter(argv, "export-legacy");
    const output = valueAfter(argv, "--out");
    if (!legacyRoot || !output) throw new Error("export-legacy requires --out <bundle.json>");
    console.log(JSON.stringify(await exportLegacyGoWorkspaceBundle({ legacyRoot, outputPath: output }), null, 2));
    break;
  }

  case "import-legacy":
  case "--import-legacy-bundle": {
    const bundlePath = valueAfter(argv, "--import-legacy-bundle") ?? valueAfter(argv, "import-legacy", 1);
    if (!bundlePath) throw new Error("import-legacy requires a bundle path");
    console.log(JSON.stringify(await importLegacyGoWorkspaceBundle({ bundlePath, targetRoot: valueAfter(argv, "--target") }), null, 2));
    break;
  }

  case "rollback-legacy":
  case "--rollback-legacy-bundle": {
    const targetRoot = valueAfter(argv, "--rollback-legacy-bundle") ?? valueAfter(argv, "rollback-legacy", 1);
    if (!targetRoot) throw new Error("rollback-legacy requires a target root");
    console.log(JSON.stringify(await rollbackLegacyGoWorkspaceBundle({ targetRoot }), null, 2));
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
      console.log(`${entry.request.method} ${entry.request.url} -> ${response.status}`);
    }
    break;
  }

  default: {
    if (!subcommand || subcommand.startsWith("--")) {
      // Legacy flat mode for backward compat
      if (subcommand === "--once" || subcommand === "--stdio" || subcommand === "--diagnostics") {
        console.error("use 'natalia <subcommand>' instead of 'natalia <flag>'");
        process.exit(1);
      }
    }
    console.log(JSON.stringify(await plainStatus(configPath), null, 2));
    break;
  }
}

async function runOnce(prompt: string, json: boolean) {
  const client = createRealRuntimeClient();
  let text = "";
  client.start((event) => {
    if (json) { console.log(JSON.stringify(event)); return; }
    if (event.type === "content.delta") text += event.text;
    const line = plainRuntimeEvent(event);
    if (line) console.log(line);
  });
  await client.submit(prompt);
  if (!json && text) console.log(text);
}

function plainRuntimeEvent(event: RuntimeEvent) {
  if (event.type === "diagnostic") return `${event.level}: ${event.message}`;
  if (event.type === "turn.finished") return `turn finished: ${event.stopReason}`;
  if (event.type === "checkpoint.created") return `checkpoint ${event.id}`;
  if (event.type === "rollback.end") return `rollback ${event.checkpointID} done`;
  return undefined;
}

function valueAfter(argv: string[], flag: string, offset = 0) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1 + offset] : undefined;
}

function daemonDir() {
  const base = process.env.XDG_STATE_HOME ?? resolve(process.env.HOME ?? ".", ".local", "state");
  return resolve(base, "natalia-cli", "daemon");
}

function waitSignal() {
  return new Promise<void>((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
}
