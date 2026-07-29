import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { platform } from "node:os";
import { dirname, join } from "node:path";
import { Worker } from "node:worker_threads";

export {
  NATIVE_INPUT_BROKER_VERSION,
  decodeNativeInputClaim,
  decodeNativeInputDecision,
  encodeNativeInputDecision,
  nativeInputBrokerEndpoint,
  nativeInputBrokerDecision,
  type NativeInputClaim,
  type NativeInputDecision,
  type NativeInputKind,
} from "./input-broker";
export {
  startNativeInputBroker,
  type NativeInputBroker,
} from "./input-broker-server";

export type NativeTerminalPane = {
  pane_id: number;
  window_id: number;
  tab_id: number;
  title?: string;
  cwd?: string;
  cursor_x?: number;
  cursor_y?: number;
  is_active?: boolean;
  tty_name?: string;
  rows?: number;
  cols?: number;
};

export type NativeTerminalHost = {
  readonly kind: "wezterm";
  readonly executable: string;
  spawn(input: {
    cwd: string;
    command: string[];
    workspace?: string;
    muxWindowID?: number;
  }): Promise<NativeTerminalPane>;
  list(): Promise<NativeTerminalPane[]>;
  listClients?(): Promise<Array<{ focused_pane_id: number }>>;
  isAlive?(): Promise<boolean>;
  resetMuxReady?(): void;
  read(
    paneID: number,
    options?: { maxLines?: number; startLine?: number; endLine?: number; format?: "text" | "selection" | "highlights" },
  ): Promise<string>;
  write(paneID: number, data: string): Promise<void>;
  open?(
    paneID: number,
    options?: {
      environment?: Record<string, string | undefined>;
      muxWindowID?: number;
      launch?: boolean;
      discardBootstrapPanes?: boolean;
    },
  ): Promise<NativeTerminalPane>;
  openHub?(options?: {
    environment?: Record<string, string | undefined>;
  }): Promise<void>;
  focus(
    paneID: number,
    options?: { environment?: Record<string, string | undefined> },
  ): Promise<void>;
  resize(paneID: number, rows: number, cols: number): Promise<void>;
  stop(paneID: number): Promise<void>;
  dispose?(): Promise<void>;
  isClientAttached?(paneID: number): Promise<boolean>;
};

type CommandRunner = (
  executable: string,
  args: string[],
  stdin?: string,
  environment?: Record<string, string | undefined>,
  timeoutMs?: number,
) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

type GuiLauncher = (
  executable: string,
  args: string[],
  environment?: Record<string, string | undefined>,
) => Promise<void>;

export function resolveWezTermExecutable(
  input: {
    configured?: string;
    which?: (name: string) => string | null;
    os?: NodeJS.Platform;
    forkBuildDir?: string;
  } = {},
) {
  if (input.configured) return input.configured;
  const fork = resolveNataliaWezTermForkExecutable({
    os: input.os,
    buildDir: input.forkBuildDir,
  });
  if (fork) return fork;
  return undefined;
}

/**
 * The patched current-main source is owned by this package. Its release build
 * is generated locally and intentionally excluded from version control.
 */
export function nativeTerminalForkBuildDir() {
  return join(import.meta.dir, "..", "wezterm", "target", "release");
}

export function resolveNataliaWezTermForkExecutable(
  input: { os?: NodeJS.Platform; buildDir?: string } = {},
) {
  const os = input.os ?? platform();
  const executable = join(
    input.buildDir ?? nativeTerminalForkBuildDir(),
    os === "win32" ? "wezterm.exe" : "wezterm",
  );
  return existsSync(executable) ? executable : undefined;
}

export function createWezTermHost(
  input: {
    executable?: string;
    run?: CommandRunner;
    configFile?: string;
    className?: string;
    environment?: Record<string, string | undefined>;
    muxRuntimeDir?: string;
    nativeDomain?: {
      name: string;
      socketPath: string;
      configFile: string;
    };
    onPerformance?: (name: string, durationMs: number) => void;
    timeoutMs?: number;
    launch?: GuiLauncher;
    muxDomain?: string;
  } = {},
): NativeTerminalHost {
  // An explicit override is reserved for controlled diagnostics. The managed
  // current-main fork build is the normal host when available.
  const executable =
    input.executable ??
    resolveWezTermExecutable({
      configured: process.env.NATALIA_WEZTERM_EXECUTABLE,
    });
  if (!executable)
    throw new Error(
      "WezTerm Native Terminal Host is unavailable. Build the managed Natalia fork for this platform or set NATALIA_WEZTERM_EXECUTABLE for controlled diagnostics.",
    );
  const run = input.run ?? runWezTermCommand;
  const measure = async <T>(name: string, work: () => Promise<T>) => {
    const startedAt = performance.now();
    try {
      return await work();
    } finally {
      input.onPerformance?.(name, performance.now() - startedAt);
    }
  };
  const timeoutMs = input.timeoutMs ?? 5_000;
  const launch = input.launch ?? launchWezTermGUI;
  const configFile = input.nativeDomain?.configFile ?? input.configFile;
  const global = configFile ? ["--config-file", configFile] : [];
  const muxServer = join(dirname(executable), "wezterm-mux-server");
  const privateEnvironment = {
    ...input.environment,
    ...(input.muxRuntimeDir ? { XDG_RUNTIME_DIR: input.muxRuntimeDir } : {}),
  };
  let muxReady: Promise<void> | undefined;
  let command: (args: string[], stdin?: string) => Promise<string>;
  const ensureMux = async () => {
    if (!input.environment?.WEZTERM_UNIX_SOCKET) return;
    muxReady ??= (async () => {
      if (await muxIsReady()) return;
      const result = await measure("native.mux.start", () =>
        withTimeout(
          run(
            muxServer,
            [...global, "--daemonize"],
            undefined,
            privateEnvironment,
            timeoutMs,
          ),
          timeoutMs,
          ["wezterm-mux-server", "--daemonize"],
        ),
      );
      // A concurrent session may have won the pid lock between the readiness
      // probe and spawn. Reuse that mux only when it serves our private socket.
      if (result.exitCode !== 0 && !(await muxIsReady()))
        throw new Error(`WezTerm mux server failed: ${result.stderr.trim()}`);
      const deadline = performance.now() + timeoutMs;
      while (performance.now() < deadline) {
        if (await muxIsReady()) return;
        await Bun.sleep(50);
      }
      throw new Error(
        `WezTerm mux server did not become ready within ${timeoutMs}ms`,
      );
    })().catch((error) => {
      muxReady = undefined;
      throw error;
    });
    await muxReady;
  };
  command = async (args: string[], stdin?: string) => {
    const cliArgs =
      args[0] === "cli" && input.className
        ? [
            "cli",
            "--no-auto-start",
            "--prefer-mux",
            "--class",
            input.className,
            ...args.slice(1),
          ]
        : args[0] === "cli"
          ? ["cli", "--no-auto-start", "--prefer-mux", ...args.slice(1)]
          : args;
    const operation =
      args[0] === "cli" ? (args[1] ?? "unknown") : (args[0] ?? "unknown");
    const result = await measure(`native.cli.${operation}`, () =>
      withTimeout(
        run(
          executable,
          [...global, ...cliArgs],
          stdin,
          privateEnvironment,
          timeoutMs,
        ),
        timeoutMs,
        args,
      ),
    );
    if (result.exitCode !== 0)
      throw new Error(
        `WezTerm command failed (${args.join(" ")}): ${result.stderr.trim()}`,
      );
    return result.stdout;
  };
  const muxIsReady = async () => {
    try {
      await command(["cli", "list", "--format", "json"]);
      return true;
    } catch {
      return false;
    }
  };
  const privateClientPaneIDs = async () => {
    try {
      const output = await command(["cli", "list-clients", "--format", "json"]);
      const clients = JSON.parse(output) as unknown;
      if (!Array.isArray(clients)) return [];
      return clients.flatMap((client) => {
        if (!client || typeof client !== "object") return [];
        const paneID = (client as Record<string, unknown>).focused_pane_id;
        return Number.isSafeInteger(paneID) ? [paneID as number] : [];
      });
    } catch {
      return [];
    }
  };
  const ensureCjkGlyphReadiness = async () => {
    await measure("native.gui.glyph-ready", async () => {
      const output = await command(["ls-fonts", "--text", "你好中文"]);
      if (!output.trim() || /(?:Last Resort|No fonts)/iu.test(output))
        throw new Error(
          "Native GUI CJK glyph fallback is unavailable; refusing to report Terminal Hub open success",
        );
    });
  };
  const isMuxAlive = async (): Promise<boolean> => {
    try {
      await withTimeout(
        run(
          executable,
          ["cli", "--no-auto-start", "--prefer-mux", "list", "--format", "json"],
          undefined,
          privateEnvironment,
          2000,
        ),
        2000,
        ["cli", "list"],
      );
      return true;
    } catch {
      return false;
    }
  };
  return {
    kind: "wezterm",
    executable,
    async spawn(options) {
      return await measure("native.spawn", async () => {
        await ensureMux();
        const args = ["cli", "spawn", "--cwd", options.cwd];
        if (options.muxWindowID === undefined) {
          args.push("--new-window");
          if (options.workspace) args.push("--workspace", options.workspace);
        } else args.push("--window-id", String(options.muxWindowID));
        args.push("--", ...options.command);
        const output = await command(args);
        const paneID = Number.parseInt(output.trim(), 10);
        if (!Number.isSafeInteger(paneID))
          throw new Error(
            `WezTerm returned an invalid pane id: ${output.trim()}`,
          );
        const pane = (await this.list()).find(
          (item) => item.pane_id === paneID,
        );
        if (!pane)
          throw new Error(
            `WezTerm created pane ${paneID} but it was not listed`,
          );
        return pane;
      });
    },
    async list() {
      const output = await command(["cli", "list", "--format", "json"]);
      const parsed = JSON.parse(output) as unknown;
      if (!Array.isArray(parsed))
        throw new Error("WezTerm returned invalid pane list");
      return parsed.map(parsePane);
    },
    async read(paneID, options = {}) {
      if (options.format === "selection") {
        return await command(["cli", "get-selection", "--pane-id", String(paneID)]);
      }
      if (options.format === "highlights") {
        return await command(["cli", "get-highlights", "--pane-id", String(paneID)]);
      }
      const maxLines = Math.max(1, Math.min(options.maxLines ?? 200, 2000));
      const args = ["cli", "get-text", "--pane-id", String(paneID)];
      if (options.startLine !== undefined) {
        args.push("--start-line", String(Math.trunc(options.startLine)));
        if (options.endLine !== undefined)
          args.push("--end-line", String(Math.trunc(options.endLine)));
      } else args.push("--start-line", String(-maxLines));
      return await command(args);
    },
    async write(paneID, data) {
      await command(
        ["cli", "send-text", "--pane-id", String(paneID), "--no-paste"],
        data,
      );
    },
    async open(paneID, options = {}) {
      const openedAt = performance.now();
      const before = (await this.list()).find(
        (item) => item.pane_id === paneID,
      );
      if (!before) throw new Error(`WezTerm pane ${paneID} is unavailable`);
      // A fresh wezterm-mux-server creates a default shell pane before Natalia
      // spawns the first TerminalSession. It is private to this UUID-scoped
      // mux, but must not become a stray empty tab in the first Hub window.
      if (options.discardBootstrapPanes)
        for (const pane of await this.list())
          if (pane.pane_id !== paneID)
            await command([
              "cli",
              "kill-pane",
              "--pane-id",
              String(pane.pane_id),
            ]);
      await command([
        "cli",
        "move-pane-to-new-tab",
        "--pane-id",
        String(paneID),
        ...(options.muxWindowID === undefined
          ? ["--new-window", "--workspace", "natalia"]
          : ["--window-id", String(options.muxWindowID)]),
      ]);
      if (options.launch !== false) {
        await this.openHub?.({ environment: options.environment });
        input.onPerformance?.(
          "native.gui.launch",
          performance.now() - openedAt,
        );
      }
      const deadline = performance.now() + timeoutMs;
      while (performance.now() < deadline) {
        await command(["cli", "activate-pane", "--pane-id", String(paneID)]);
        const pane = (await this.list()).find(
          (item) => item.pane_id === paneID,
        );
        if (!pane)
          throw new Error(`WezTerm pane ${paneID} disappeared while opening`);
        // A server-side move changes window identity before any GUI client
        // exists. Only the private mux client's focused pane proves the GUI
        // attached to this exact Natalia pane rather than a local shell.
        if ((await privateClientPaneIDs()).includes(paneID)) {
          input.onPerformance?.(
            "native.gui.attach",
            performance.now() - openedAt,
          );
          return pane;
        }
        await Bun.sleep(100);
      }
      throw new Error(
        `WezTerm GUI did not attach to the native terminal window within ${timeoutMs}ms`,
      );
    },
    async openHub(options = {}) {
      if ((await privateClientPaneIDs()).length) return;
      await ensureCjkGlyphReadiness();
      await launch(
        executable,
        [
          ...global,
          "connect",
          input.nativeDomain?.name ?? input.muxDomain ?? "local",
          "--workspace",
          "natalia",
        ],
        options.environment
          ? { ...privateEnvironment, ...options.environment }
          : privateEnvironment,
      );
    },
    async focus(paneID) {
      await command(["cli", "activate-pane", "--pane-id", String(paneID)]);
    },
    async resize(paneID, rows, cols) {
      const pane = (await this.list()).find((item) => item.pane_id === paneID);
      if (!pane || pane.rows === undefined || pane.cols === undefined)
        throw new Error("WezTerm pane geometry is unavailable");
      const rowDelta = rows - pane.rows;
      const colDelta = cols - pane.cols;
      if (rowDelta)
        await command([
          "cli",
          "adjust-pane-size",
          "--pane-id",
          String(paneID),
          "--amount",
          String(Math.abs(rowDelta)),
          rowDelta > 0 ? "Down" : "Up",
        ]);
      if (colDelta)
        await command([
          "cli",
          "adjust-pane-size",
          "--pane-id",
          String(paneID),
          "--amount",
          String(Math.abs(colDelta)),
          colDelta > 0 ? "Right" : "Left",
        ]);
    },
    async stop(paneID) {
      await command(["cli", "kill-pane", "--pane-id", String(paneID)]);
    },
    async dispose() {
      if (!input.muxRuntimeDir) return;
      const pidFile = join(input.muxRuntimeDir, "wezterm", "pid");
      try {
        const pid = Number.parseInt(
          (await readFile(pidFile, "utf8")).trim(),
          10,
        );
        if (Number.isSafeInteger(pid) && pid > 1) process.kill(pid, "SIGTERM");
      } catch (error) {
        if (
          !(
            error instanceof Error &&
            "code" in error &&
            error.code === "ENOENT"
          )
        )
          throw error;
      } finally {
        await rm(input.muxRuntimeDir, { recursive: true, force: true });
      }
    },
    async isClientAttached(paneID) {
      try {
        const output = await command(["cli", "list-clients", "--format", "json"]);
        const clients = JSON.parse(output) as unknown;
        if (!Array.isArray(clients)) return false;
        return clients.some(
          (client: Record<string, unknown>) =>
            client && typeof client.focused_pane_id === "number" && client.focused_pane_id === paneID,
        );
      } catch {
        return false;
      }
    },
    async isAlive() {
      return await isMuxAlive();
    },
    resetMuxReady() {
      muxReady = undefined;
    },
    async listClients() {
      try {
        const output = await command(["cli", "list-clients", "--format", "json"]);
        const clients = JSON.parse(output) as unknown;
        if (!Array.isArray(clients)) return [];
        return clients
          .filter(
            (client: unknown): client is Record<string, unknown> =>
              !!client && typeof client === "object",
          )
          .map((client) => ({
            focused_pane_id: client.focused_pane_id as number,
          }));
      } catch {
        return [];
      }
    },
  };
}

export async function writeWezTermNativeDomainConfig(input: {
  directory: string;
  socketPath: string;
  name?: string;
}) {
  const name = input.name ?? "natalia";
  const configFile = join(input.directory, "wezterm-native-domain.lua");
  await writeFile(
    configFile,
    `local wezterm = require 'wezterm'

return {
  unix_domains = {
    {
      name = ${JSON.stringify(name)},
      socket_path = [[${input.socketPath}]],
      no_serve_automatically = true,
    },
  },
  -- Avoid the asynchronous system fallback path for CJK text. The latter can
  -- briefly render Last Resort/tofu glyphs while fontconfig resolves fonts.
  font = wezterm.font_with_fallback {
    'JetBrains Mono',
    'Noto Sans Mono CJK SC',
    'Noto Sans CJK SC',
    'Noto Color Emoji',
  },
}
`,
    { mode: 0o600 },
  );
  return { name, socketPath: input.socketPath, configFile };
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  args: string[],
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `WezTerm command timed out after ${timeoutMs}ms: ${args.join(" ")}`,
              ),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type NativeTerminalSession = {
  id: string;
  host: "wezterm";
  paneID: number;
  windowID: number;
  muxWindowID: number;
  tabID: number;
  command: string;
  cwd: string;
  startedAt: string;
  revision: number;
  lastText?: string;
  lastObservedText?: string;
  lastObservedRevision?: number;
  inputOwner: "model" | "human";
  geometryOwner: "human";
  secureInput: boolean;
  status: "running" | "exited";
  attached: boolean;
  cursor_x?: number;
  cursor_y?: number;
  rows?: number;
  cols?: number;
};

export type NativeTerminalHub = {
  workspace: "natalia";
  muxWindowID: number;
};

export type NativeTerminalWriteResult = {
  writtenBytes: number;
  delivery: "accepted" | "duplicate" | "cancelled";
};

export type NativeTerminalAuditEvent = {
  id: string;
  cwd: string;
  action: "write" | "attach" | "detach" | "resize" | "secure_input" | "exit";
  actor: "model" | "human" | "system";
  at: string;
  redacted?: boolean;
};

/**
 * Control plane for panes rendered by WezTerm itself. It intentionally has no
 * framebuffer, polling loop, or ANSI renderer: the native pane is the only
 * human-facing terminal authority.
 */
export class NativeTerminalRegistry {
  private readonly sessions = new Map<string, NativeTerminalSession>();
  private readonly idempotency = new Map<string, Map<string, string>>();
  private readonly modelWrites = new Map<string, Promise<void>>();
  private readonly revisionWaiters = new Map<string, Set<() => void>>();
  private hub?: NativeTerminalHub;
  private humanInputBridge?: { endpoint: string; token: string };
  private lastReconcileAt = -Infinity;
  private reconcileInFlight?: Promise<NativeTerminalSession[]>;

  constructor(
    private readonly host: NativeTerminalHost,
    private readonly options: {
      onAudit?: (event: NativeTerminalAuditEvent) => void;
      autoOpenHub?: boolean;
      persistPath?: string;
    } = {},
  ) {
    this.loadPersistedSessions();
  }

  setHumanInputBridge(bridge: { endpoint: string; token: string }) {
    this.humanInputBridge = bridge;
  }

  async start(input: { command: string; cwd: string; id?: string }) {
    const isFirstHubSession = this.hub === undefined;
    const pane = await this.host.spawn({
      cwd: input.cwd,
      command:
        platform() === "win32"
          ? ["cmd.exe", "/d", "/s", "/c", input.command]
          : ["/bin/sh", "-lc", input.command],
      workspace: "natalia",
      muxWindowID: this.hub?.muxWindowID,
    });
    const session: NativeTerminalSession = {
      id: input.id ?? `terminal_${randomUUID()}`,
      host: "wezterm",
      paneID: pane.pane_id,
      windowID: pane.window_id,
      muxWindowID: pane.window_id,
      tabID: pane.tab_id,
      command: input.command,
      cwd: input.cwd,
      startedAt: new Date().toISOString(),
      revision: 0,
      inputOwner: "model",
      geometryOwner: "human",
      secureInput: false,
      status: "running",
      attached: true,
      rows: pane.rows,
      cols: pane.cols,
    };
    this.sessions.set(session.id, session);
    await this.persistSessions();
    if (this.options.autoOpenHub !== false) {
      if (isFirstHubSession) await this.attachToHub(session, true, true);
      else {
        session.windowID = this.hub!.muxWindowID;
        session.muxWindowID = this.hub!.muxWindowID;
        await this.host.focus(session.paneID);
      }
    }
    return session;
  }

  list() {
    return [...this.sessions.values()];
  }

  private loadPersistedSessions() {
    if (!this.options.persistPath) return;
    try {
      if (!existsSync(this.options.persistPath)) return;
      const data = JSON.parse(
        readFileSync(this.options.persistPath, "utf8"),
      ) as unknown;
      if (!data || typeof data !== "object") return;
      const manifest = data as Record<string, unknown>;
      const sessions = manifest.sessions;
      if (!Array.isArray(sessions)) return;
      for (const raw of sessions) {
        if (!raw || typeof raw !== "object") continue;
        const paneID = (raw as Record<string, unknown>).paneID;
        const session: NativeTerminalSession = {
          id: (raw as Record<string, unknown>).id as string,
          host: "wezterm",
          paneID: typeof paneID === "number" ? paneID : 0,
          windowID: (raw as Record<string, unknown>).windowID as number,
          muxWindowID: (raw as Record<string, unknown>).muxWindowID as number,
          tabID: (raw as Record<string, unknown>).tabID as number,
          command: ((raw as Record<string, unknown>).command as string) ?? "",
          cwd: ((raw as Record<string, unknown>).cwd as string) ?? "",
          startedAt: ((raw as Record<string, unknown>).startedAt as string) ??
            new Date().toISOString(),
          revision: 0,
          inputOwner: ((raw as Record<string, unknown>).inputOwner as NativeTerminalSession["inputOwner"]) ??
            "model",
          geometryOwner: "human",
          secureInput: Boolean((raw as Record<string, unknown>).secureInput),
          status: ((raw as Record<string, unknown>).status as NativeTerminalSession["status"]) ??
            "exited",
          attached: Boolean((raw as Record<string, unknown>).attached),
          cursor_x: (raw as Record<string, unknown>).cursor_x as
            | number
            | undefined,
          cursor_y: (raw as Record<string, unknown>).cursor_y as
            | number
            | undefined,
          rows: (raw as Record<string, unknown>).rows as number | undefined,
          cols: (raw as Record<string, unknown>).cols as number | undefined,
        };
        this.sessions.set(session.id, session);
      }
    } catch {
      // ignore corrupt manifest; empty sessions will be rebuilt on start
    }
  }

  private async persistSessions() {
    if (!this.options.persistPath) return;
    try {
      await mkdir(dirname(this.options.persistPath), { recursive: true });
      const data = JSON.stringify({
        sessions: Array.from(this.sessions.values()).map((s) => ({
          id: s.id,
          paneID: s.paneID,
          windowID: s.windowID,
          muxWindowID: s.muxWindowID,
          tabID: s.tabID,
          command: s.command,
          cwd: s.cwd,
          startedAt: s.startedAt,
          status: s.status,
          inputOwner: s.inputOwner,
          secureInput: s.secureInput,
          rows: s.rows,
          cols: s.cols,
          attached: s.attached,
          cursor_x: s.cursor_x,
          cursor_y: s.cursor_y,
        })),
        hub: this.hub,
      });
      await writeFile(this.options.persistPath, data, { mode: 0o600 });
    } catch {
      // persistence is best-effort; runtime continues without durable manifest
    }
  }

  isHumanInputOwner(id: string) {
    return this.get(id).inputOwner === "human";
  }

  async reconcile(options: { force?: boolean } = {}) {
    if (!options.force && performance.now() - this.lastReconcileAt < 2_000)
      return this.list();
    this.reconcileInFlight ??= this.reconcileNow().finally(() => {
      this.reconcileInFlight = undefined;
    });
    return await this.reconcileInFlight;
  }

  private async reconcileNow() {
    let panes: NativeTerminalPane[];
    try {
      panes = await this.host.list();
    } catch (error) {
      let muxAlive: boolean | undefined = true;
      try {
        muxAlive = await this.host.isAlive?.();
      } catch {
        // isAlive probe itself failed; keep muxAlive=true and re-throw original
      }
      if (muxAlive === false) {
        await this.host.resetMuxReady?.();
        for (const session of this.sessions.values()) {
          if (session.status !== "exited") {
            session.status = "exited";
            session.attached = false;
            session.revision += 1;
            this.notifyRevision(session.id);
            this.audit(session, "exit", "system");
          }
        }
        await this.persistSessions();
        return this.list();
      }
      throw error;
    }
    const paneMap = new Map(panes.map((pane) => [pane.pane_id, pane]));
    const attached = new Set(
      (await this.host.listClients?.())?.map((client) => client.focused_pane_id) ?? [],
    );
    this.lastReconcileAt = performance.now();
    for (const session of this.sessions.values()) {
      const pane = paneMap.get(session.paneID);
      if (!pane) {
        if (session.status !== "exited") {
          session.revision += 1;
          this.notifyRevision(session.id);
          this.audit(session, "exit", "system");
        }
        session.status = "exited";
        session.attached = false;
        continue;
      }
      session.rows = pane.rows;
      session.cols = pane.cols;
      session.cursor_x = pane.cursor_x;
      session.cursor_y = pane.cursor_y;
      session.attached = attached.has(session.paneID);
    }
    await this.persistSessions();
    return this.list();
  }

  async read(
    id: string,
    options?: { maxLines?: number; startLine?: number; endLine?: number },
  ) {
    const session = this.get(id);
    await this.reconcile();
    this.assertReadable(session);
    return await this.readSession(session, options);
  }

  async snapshot(id: string) {
    const session = this.get(id);
    await this.reconcile();
    this.assertReadable(session);
    const { text, highlightRanges } = await this.readSession(session);
    return {
      text,
      cursorX: session.cursor_x ?? 0,
      cursorY: session.cursor_y ?? 0,
      rows: session.rows ?? 0,
      cols: session.cols ?? 0,
      revision: session.revision,
      status: session.status,
      inputOwner: session.inputOwner,
      highlightRanges,
    };
  }

  async write(
    id: string,
    data: string,
    options: { idempotencyKey?: string } = {},
  ): Promise<NativeTerminalWriteResult> {
    const session = this.get(id);
    await this.reconcile();
    this.assertRunning(session);
    if (session.inputOwner !== "model")
      throw new Error("terminal input is controlled by a human");
    if (session.secureInput)
      throw new Error("terminal is accepting secure human input");
    const writtenBytes = new TextEncoder().encode(data).byteLength;
    if (options.idempotencyKey) {
      const keys = this.idempotency.get(id) ?? new Map<string, string>();
      const previous = keys.get(options.idempotencyKey);
      if (previous !== undefined) {
        if (previous !== data)
          throw new Error(
            "terminal idempotency key was reused with different input",
          );
        return { writtenBytes, delivery: "duplicate" };
      }
      keys.set(options.idempotencyKey, data);
      this.idempotency.set(id, keys);
      while (keys.size > 256) keys.delete(keys.keys().next().value!);
    }
    const previous = this.modelWrites.get(id) ?? Promise.resolve();
    let cancelled = false;
    const delivery = previous.then(async () => {
      for (const chunk of modelInputChunks(data)) {
        if (session.inputOwner !== "model") {
          cancelled = true;
          return;
        }
        await this.host.write(session.paneID, chunk);
      }
    });
    this.modelWrites.set(
      id,
      delivery.catch(() => undefined),
    );
    try {
      await delivery;
    } catch (error) {
      if (options.idempotencyKey)
        this.idempotency.get(id)?.delete(options.idempotencyKey);
      throw error;
    }
    if (cancelled) {
      if (options.idempotencyKey)
        this.idempotency.get(id)?.delete(options.idempotencyKey);
      return { writtenBytes, delivery: "cancelled" };
    }
    session.revision += 1;
    this.audit(session, "write", "model");
    this.notifyRevision(session.id);
    return { writtenBytes, delivery: "accepted" };
  }

  async openHub() {
    if (!this.hub) {
      const firstSession = this.list().find(
        (session) => session.status === "running",
      );
      if (!firstSession) throw new Error("no running native terminal session");
      await this.attachToHub(firstSession, true, false);
      return this.hub!;
    }
    await this.host.openHub?.();
    return this.hub;
  }

  private async cleanupStalePanes() {
    if (!this.host.list || !this.host.stop) return;
    const known = new Set(this.sessions.values().map((session) => session.paneID));
    for (const pane of await this.host.list()) {
      if (!known.has(pane.pane_id)) {
        await this.host.stop(pane.pane_id);
      }
    }
  }

  private async attachToHub(
    session: NativeTerminalSession,
    launch: boolean,
    selectTarget = false,
  ) {
    if (!this.host.open) return undefined;
    await this.cleanupStalePanes();
    const environment = this.humanInputBridge
      ? {
          NATALIA_NATIVE_INPUT_ENDPOINT: this.humanInputBridge.endpoint,
          NATALIA_NATIVE_INPUT_TOKEN: this.humanInputBridge.token,
        }
      : undefined;
    const pane = await this.host.open(session.paneID, {
      environment,
      muxWindowID: this.hub?.muxWindowID,
      launch,
      discardBootstrapPanes: this.hub === undefined,
    });
    if (!this.hub)
      this.hub = { workspace: "natalia", muxWindowID: pane.window_id };
    session.windowID = pane.window_id;
    session.muxWindowID = pane.window_id;
    session.tabID = pane.tab_id;
    session.rows = pane.rows;
    session.cols = pane.cols;
    if (selectTarget && this.hub) await this.host.focus(session.paneID);
    return pane;
  }

  async claimHumanInput(id: string) {
    const session = this.get(id);
    this.assertRunning(session);
    if (session.secureInput && session.inputOwner !== "human")
      throw new Error("secure input requires human terminal control");
    // The host claims before every native pane write. Only the first accepted
    // claim is an ownership transition; subsequent human keystrokes must not
    // churn revisions, audit events, or the TUI timeline.
    if (session.inputOwner === "human") return session;
    // A native host retains and writes the bytes through its original pane path
    // after this synchronous ownership transition. Natalia never sees them.
    session.inputOwner = "human";
    session.revision += 1;
    this.notifyRevision(session.id);
    await this.reconcile();
    this.assertRunning(session);
    this.audit(session, "write", "human", session.secureInput);
    return session;
  }

  async attach(id: string) {
    const session = this.get(id);
    this.assertRunning(session);
    await this.openHub();
    this.audit(session, "attach", "human");
    return session;
  }

  detach(id: string) {
    const session = this.get(id);
    if (session.secureInput)
      throw new Error("secure input must end before detaching");
    session.inputOwner = "model";
    session.revision += 1;
    this.notifyRevision(session.id);
    this.audit(session, "detach", "human");
    return session;
  }

  releaseHumanControl(id: string) {
    const session = this.get(id);
    if (session.secureInput)
      throw new Error(
        "secure input must end before returning control to model",
      );
    session.inputOwner = "model";
    session.revision += 1;
    this.notifyRevision(session.id);
    this.audit(session, "detach", "human");
    return session;
  }

  beginSecureInput(id: string) {
    const session = this.get(id);
    this.assertRunning(session);
    if (session.inputOwner !== "human")
      throw new Error("secure input requires human terminal control");
    session.secureInput = true;
    session.revision += 1;
    this.notifyRevision(session.id);
    this.audit(session, "secure_input", "human");
    return session;
  }

  endSecureInput(id: string) {
    const session = this.get(id);
    session.secureInput = false;
    session.revision += 1;
    this.notifyRevision(session.id);
    this.audit(session, "secure_input", "human");
    return session;
  }

  async observe(
    id: string,
    afterRevision: number,
    options: { maxLines?: number; timeoutMs?: number } = {},
  ) {
    const session = this.get(id);
    const timeoutMs = Math.max(1, Math.min(options.timeoutMs ?? 5_000, 30_000));
    const deadline = performance.now() + timeoutMs;
    while (true) {
      await this.reconcile();
      if (session.status === "exited")
        return {
          session,
          text: "",
          cursorX: session.cursor_x ?? 0,
          cursorY: session.cursor_y ?? 0,
          rows: session.rows ?? 0,
          cols: session.cols ?? 0,
          highlightRanges: [],
          afterRevision,
          changed: session.revision > afterRevision,
          reason: "exited" as const,
          exited: true,
        };
      const revisionBeforeRead = session.revision;
      const { text, cursorX, cursorY, rows, cols, highlightRanges } =
        await this.readSession(session, { maxLines: options.maxLines });
      if (session.revision > afterRevision)
        return {
          session,
          text,
          cursorX,
          cursorY,
          rows,
          cols,
          highlightRanges,
          afterRevision,
          changed: true,
          reason:
            session.revision > revisionBeforeRead
              ? ("screen_changed" as const)
              : ("session_activity" as const),
        };
      if (performance.now() >= deadline)
        return {
          session,
          text,
          cursorX,
          cursorY,
          rows,
          cols,
          highlightRanges,
          afterRevision,
          changed: false,
          reason: "timeout" as const,
        };
      await this.waitForRevision(
        session.id,
        Math.max(10, Math.min(500, deadline - performance.now())),
      );
    }
  }

  async resize(id: string, rows: number, cols: number) {
    const session = this.get(id);
    await this.reconcile();
    this.assertRunning(session);
    if (session.geometryOwner !== "human")
      throw new Error("terminal geometry is controlled by a human");
    if (!Number.isInteger(rows) || rows < 1 || rows > 500)
      throw new Error("terminal rows must be an integer between 1 and 500");
    if (!Number.isInteger(cols) || cols < 1 || cols > 500)
      throw new Error("terminal cols must be an integer between 1 and 500");
    await this.host.resize(session.paneID, rows, cols);
    session.rows = rows;
    session.cols = cols;
    session.revision += 1;
    this.notifyRevision(session.id);
    this.audit(session, "resize", "human");
    return session;
  }

  async stop(id: string) {
    const session = this.get(id);
    if (session.status === "running") await this.host.stop(session.paneID);
    session.status = "exited";
    session.revision += 1;
    session.attached = false;
    this.notifyRevision(session.id);
    this.idempotency.delete(id);
    this.modelWrites.delete(id);
    this.audit(session, "exit", "system");
    await this.persistSessions();
    return session;
  }

  async dispose() {
    const running = this.list().filter(
      (session) => session.status === "running",
    );
    await Promise.allSettled(running.map((session) => this.stop(session.id)));
    await this.persistSessions();
    await this.host.dispose?.();
    this.sessions.clear();
    this.modelWrites.clear();
    this.idempotency.clear();
    this.revisionWaiters.clear();
    this.hub = undefined;
  }

  session(id: string): NativeTerminalSession {
    return this.get(id);
  }

  markObserved(id: string, text: string, revision: number) {
    const session = this.get(id);
    session.lastObservedText = text;
    session.lastObservedRevision = revision;
  }

  private get(id: string): NativeTerminalSession {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`native terminal session not found: ${id}`);
    return session;
  }

  private async readSession(
    session: NativeTerminalSession,
    options?: { maxLines?: number; startLine?: number; endLine?: number },
  ) {
    const [text, selectionJson, highlightsJson] = await Promise.all([
      this.host.read(session.paneID, options),
      this.host.read(session.paneID, { format: "selection" }),
      this.host.read(session.paneID, { format: "highlights" }),
    ]);
    if (text !== session.lastText) {
      session.lastText = text;
      session.revision += 1;
      this.notifyRevision(session.id);
    }
    let highlightRanges: Array<{
      startRow: number;
      startCol: number;
      endRow: number;
      endCol: number;
    }> = [];
    try {
      const parsedSelection = JSON.parse(selectionJson) as Record<string, unknown>;
      const selection = parsedSelection.selection as Record<string, unknown> | null;
      if (selection && Array.isArray(selection.ranges)) {
        highlightRanges = highlightRanges.concat(
          (selection.ranges as Array<Record<string, unknown>>).map((r) => ({
            startRow: Number(r.startRow) ?? 0,
            startCol: Number(r.startCol) ?? 0,
            endRow: Number(r.endRow) ?? 0,
            endCol: Number(r.endCol) ?? 0,
          })),
        );
      }
    } catch {
      // ignore parse errors
    }
    try {
      const parsedHighlights = JSON.parse(highlightsJson) as Record<string, unknown>;
      const highlights = parsedHighlights.highlights as Record<string, unknown> | null;
      if (highlights && Array.isArray(highlights.ranges)) {
        highlightRanges = highlightRanges.concat(
          (highlights.ranges as Array<Record<string, unknown>>).map((r) => ({
            startRow: Number(r.startRow) ?? 0,
            startCol: Number(r.startCol) ?? 0,
            endRow: Number(r.endRow) ?? 0,
            endCol: Number(r.endCol) ?? 0,
          })),
        );
      }
    } catch {
      // ignore parse errors
    }
    return {
      text,
      cursorX: session.cursor_x ?? 0,
      cursorY: session.cursor_y ?? 0,
      rows: session.rows ?? 0,
      cols: session.cols ?? 0,
      highlightRanges,
    };
  }

  private assertRunning(session: NativeTerminalSession) {
    if (session.status !== "running")
      throw new Error("terminal session has exited");
  }

  private async waitForRevision(id: string, timeoutMs: number) {
    await new Promise<void>((resolve) => {
      const waiters = this.revisionWaiters.get(id) ?? new Set<() => void>();
      const wake = () => {
        clearTimeout(timer);
        waiters.delete(wake);
        if (!waiters.size) this.revisionWaiters.delete(id);
        resolve();
      };
      const timer = setTimeout(wake, timeoutMs);
      waiters.add(wake);
      this.revisionWaiters.set(id, waiters);
    });
  }

  private notifyRevision(id: string) {
    for (const wake of this.revisionWaiters.get(id) ?? []) wake();
  }

  private assertReadable(session: NativeTerminalSession) {
    this.assertRunning(session);
    if (session.secureInput)
      throw new Error("terminal output is hidden during secure human input");
  }

  private audit(
    session: NativeTerminalSession,
    action: NativeTerminalAuditEvent["action"],
    actor: NativeTerminalAuditEvent["actor"],
    redacted = false,
  ) {
    this.options.onAudit?.({
      id: session.id,
      cwd: session.cwd,
      action,
      actor,
      at: new Date().toISOString(),
      redacted: action === "write" ? redacted : undefined,
    });
  }
}

function modelInputChunks(data: string) {
  // Each chunk starts a `wezterm cli send-text` process. Avoid a process spawn
  // per handful of characters while still bounding a single command payload.
  const characters = [...data];
  const chunks: string[] = [];
  for (let index = 0; index < characters.length; index += 1024)
    chunks.push(characters.slice(index, index + 1024).join(""));
  return chunks;
}

function parsePane(value: unknown): NativeTerminalPane {
  if (!value || typeof value !== "object")
    throw new Error("WezTerm returned an invalid pane entry");
  const pane = value as Record<string, unknown>;
  for (const field of ["pane_id", "window_id", "tab_id"] as const)
    if (!Number.isSafeInteger(pane[field]))
      throw new Error(`WezTerm pane is missing numeric ${field}`);
  return {
    pane_id: pane.pane_id as number,
    window_id: pane.window_id as number,
    tab_id: pane.tab_id as number,
    title: typeof pane.title === "string" ? pane.title : undefined,
    cwd: typeof pane.cwd === "string" ? pane.cwd : undefined,
    cursor_x: typeof pane.cursor_x === "number" ? pane.cursor_x : undefined,
    cursor_y: typeof pane.cursor_y === "number" ? pane.cursor_y : undefined,
    is_active: typeof pane.is_active === "boolean" ? pane.is_active : undefined,
    tty_name: typeof pane.tty_name === "string" ? pane.tty_name : undefined,
    rows:
      typeof pane.size === "object" &&
      pane.size !== null &&
      typeof (pane.size as Record<string, unknown>).rows === "number"
        ? ((pane.size as Record<string, unknown>).rows as number)
        : undefined,
    cols:
      typeof pane.size === "object" &&
      pane.size !== null &&
      typeof (pane.size as Record<string, unknown>).cols === "number"
        ? ((pane.size as Record<string, unknown>).cols as number)
        : undefined,
  };
}

async function runWezTermCommand(
  executable: string,
  args: string[],
  stdin?: string,
  environment?: Record<string, string | undefined>,
  timeoutMs = 5_000,
) {
  // A hung `wezterm cli` must not be allowed to block or retain memory inside
  // the runtime Worker. This nested worker owns the subprocess streams and is
  // terminated from its parent on deadline, independent of Bun stream state.
  const worker = new Worker(
    new URL("./wezterm-command-worker.ts", import.meta.url),
    {
      workerData: { executable, args, stdin, environment },
    },
  );
  return await new Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }>((resolve, reject) => {
    let settled = false;
    const finish = (result: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      void worker.terminate();
      result();
    };
    const timeout = setTimeout(() => {
      finish(() =>
        reject(
          new Error(
            `WezTerm command timed out after ${timeoutMs}ms: ${args.join(" ")}`,
          ),
        ),
      );
    }, timeoutMs);
    worker.once("message", (message: unknown) => {
      const result = message as {
        stdout?: unknown;
        stderr?: unknown;
        exitCode?: unknown;
        error?: unknown;
      };
      if (typeof result.error === "string") {
        const errorMessage = result.error;
        return finish(() => reject(new Error(errorMessage)));
      }
      if (
        typeof result.stdout !== "string" ||
        typeof result.stderr !== "string" ||
        typeof result.exitCode !== "number"
      )
        return finish(() =>
          reject(new Error("invalid WezTerm command response")),
        );
      const stdout = result.stdout;
      const stderr = result.stderr;
      const exitCode = result.exitCode;
      finish(() =>
        resolve({
          stdout,
          stderr,
          exitCode,
        }),
      );
    });
    worker.once("error", (error) => finish(() => reject(error)));
    worker.once("exit", (code) => {
      if (code !== 0)
        finish(() =>
          reject(new Error(`WezTerm command worker exited: ${code}`)),
        );
    });
  });
}

async function launchWezTermGUI(
  executable: string,
  args: string[],
  environment?: Record<string, string | undefined>,
) {
  const env = { ...process.env } as Record<string, string>;
  for (const [key, value] of Object.entries(environment ?? {})) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  const child = Bun.spawn({
    cmd: [executable, ...args],
    env,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  child.unref();
}
