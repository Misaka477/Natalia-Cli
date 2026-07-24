import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import type { RuntimeClient } from "@natalia/contracts";
import {
  externalTerminalLaunchCommand,
  launchExternalTerminal,
} from "@natalia/terminal";
import { createRuntimeHttpServer } from "@natalia/transport";

const bridges = new WeakMap<
  RuntimeClient,
  { url: string; token: string; stop(): void }
>();

export function openExternalTerminal(input: {
  backend: RuntimeClient;
  id: string;
  takeControl?: boolean;
  secureInput?: boolean;
  preferred?: string;
}) {
  const bridge = terminalAttachBridge(input.backend);
  const command = externalTerminalLaunchCommand({
    id: input.id,
    executable: resolveTerminalCLIExecutable(),
    preferred: input.preferred,
    takeControl: input.takeControl,
    secureInput: input.secureInput,
  });
  if (!command)
    throw new Error(
      "No supported external terminal found. Install Kitty, WezTerm, foot, Alacritty, GNOME Terminal, Konsole, or xterm.",
    );
  const pid = launchExternalTerminal({
    command,
    env: {
      ...process.env,
      NATALIA_TERMINAL_URL: bridge.url,
      NATALIA_TERMINAL_TOKEN: bridge.token,
    },
  });
  return { pid, command };
}

export function terminalAttachBridge(backend: RuntimeClient) {
  const existing = bridges.get(backend);
  if (existing) return existing;
  const token = randomBytes(32).toString("base64url");
  const server = createRuntimeHttpServer({
    client: backend,
    token,
    events: false,
  });
  const bridge = {
    url: server.url,
    token,
    stop: () => {
      server.stop(true);
      bridges.delete(backend);
    },
  };
  bridges.set(backend, bridge);
  return bridge;
}

export function resolveTerminalCLIExecutable(
  options: {
    configured?: string;
    which?: (name: string) => string | null;
    argv?: string[];
    execPath?: string;
    sourceURL?: string;
  } = {},
) {
  const configured = options.configured ?? process.env.NATALIA_CLI_COMMAND;
  if (configured) {
    const parsed = JSON.parse(configured) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((item) => typeof item === "string")
    )
      return parsed;
    throw new Error(
      "NATALIA_CLI_COMMAND must be a non-empty JSON string array",
    );
  }
  const installed = (options.which ?? Bun.which)("natalia-ts");
  if (installed) return [installed];
  const argv = options.argv ?? process.argv;
  const execPath = options.execPath ?? process.execPath;
  if (/natalia-ts(?:\.js)?$/u.test(argv[1] ?? "")) return [execPath, argv[1]!];
  return [
    execPath,
    fileURLToPath(
      new URL("../../cli/src/main.ts", options.sourceURL ?? import.meta.url),
    ),
  ];
}
