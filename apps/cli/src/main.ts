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
  daemonToken,
  registerRuntimeDaemon,
  runtimeDaemonStatus,
  stopRuntimeDaemon,
} from "@natalia/transport";
import { resolve } from "node:path";
import { plainStatus, startupDiagnostics } from "./index";

const argv = process.argv.slice(2);
const args = new Set(argv);
const configPath = process.env.NATALIA_CONFIG ?? defaultConfigPath();

if (args.has("--diagnostics")) {
  console.log(JSON.stringify(await startupDiagnostics(configPath), null, 2));
} else if (args.has("--serve")) {
  const port = Number(valueAfter(argv, "--serve") ?? "8787");
  if (!Number.isInteger(port) || port <= 0 || port > 65535)
    throw new Error("--serve requires a valid port");
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
  await new Promise<void>((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
  server.stop(true);
} else if (args.has("--daemon-status")) {
  console.log(
    JSON.stringify(
      await runtimeDaemonStatus(
        createRuntimeDaemonStore({
          dir: valueAfter(argv, "--daemon-dir") ?? defaultDaemonDir(),
        }),
      ),
      null,
      2,
    ),
  );
} else if (args.has("--daemon-stop")) {
  console.log(
    JSON.stringify(
      await stopRuntimeDaemon(
        createRuntimeDaemonStore({
          dir: valueAfter(argv, "--daemon-dir") ?? defaultDaemonDir(),
        }),
      ),
      null,
      2,
    ),
  );
} else if (args.has("--daemon-serve")) {
  const store = createRuntimeDaemonStore({
    dir: valueAfter(argv, "--daemon-dir") ?? defaultDaemonDir(),
  });
  const port = Number(valueAfter(argv, "--daemon-serve") ?? "8787");
  if (!Number.isInteger(port) || port <= 0 || port > 65535)
    throw new Error("--daemon-serve requires a valid port");
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
  console.log(JSON.stringify({ url: server.url, daemonDir: store.dir }));
  await new Promise<void>((resolveSignal) => {
    process.once("SIGINT", resolveSignal);
    process.once("SIGTERM", resolveSignal);
  });
  server.stop(true);
} else if (args.has("--export-legacy")) {
  const legacyRoot = valueAfter(argv, "--export-legacy");
  const output = valueAfter(argv, "--out");
  if (!legacyRoot || !output)
    throw new Error("--export-legacy requires --out <bundle.json>");
  console.log(
    JSON.stringify(
      await exportLegacyGoWorkspaceBundle({ legacyRoot, outputPath: output }),
      null,
      2,
    ),
  );
} else if (args.has("--import-legacy-bundle")) {
  const bundlePath = valueAfter(argv, "--import-legacy-bundle");
  if (!bundlePath) throw new Error("--import-legacy-bundle requires a path");
  console.log(
    JSON.stringify(
      await importLegacyGoWorkspaceBundle({
        bundlePath,
        targetRoot: valueAfter(argv, "--target"),
      }),
      null,
      2,
    ),
  );
} else if (args.has("--rollback-legacy-bundle")) {
  const targetRoot = valueAfter(argv, "--rollback-legacy-bundle");
  if (!targetRoot)
    throw new Error("--rollback-legacy-bundle requires a target root");
  console.log(
    JSON.stringify(
      await rollbackLegacyGoWorkspaceBundle({ targetRoot }),
      null,
      2,
    ),
  );
} else if (args.has("--stdio")) {
  const client = createRealRuntimeClient();
  client.start((event) => console.log(JSON.stringify(event)));
  const input = await Bun.stdin.text();
  for (const line of input.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    const request = JSON.parse(line) as {
      prompt?: string;
      cancel?: string;
      pause?: string;
      resume?: boolean;
    };
    if (request.cancel) client.cancel(request.cancel);
    if (request.pause) client.pause?.(request.pause);
    if (request.resume) client.resume?.();
    if (request.prompt) await client.submit(request.prompt);
  }
} else if (args.has("--once")) {
  const prompt = argv
    .filter((arg) => arg !== "--once" && arg !== "--json")
    .join(" ")
    .trim();
  if (!prompt) throw new Error("--once requires a prompt");
  const client = createRealRuntimeClient();
  const json = args.has("--json");
  let text = "";
  client.start((event) => {
    if (json) {
      console.log(JSON.stringify(event));
      return;
    }
    if (event.type === "content.delta") text += event.text;
    const line = plainRuntimeEvent(event);
    if (line) console.log(line);
  });
  await client.submit(prompt);
  if (!json && text) console.log(text);
} else {
  console.log(JSON.stringify(await plainStatus(configPath), null, 2));
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

function valueAfter(argv: string[], flag: string) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function defaultDaemonDir() {
  const base =
    process.env.XDG_STATE_HOME ??
    resolve(process.env.HOME ?? ".", ".local", "state");
  return resolve(base, "natalia-cli", "daemon");
}
