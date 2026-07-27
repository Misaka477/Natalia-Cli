import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
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
  }): Promise<NativeTerminalPane>;
  list(): Promise<NativeTerminalPane[]>;
  read(
    paneID: number,
    options?: { maxLines?: number; startLine?: number; endLine?: number },
  ): Promise<string>;
  write(paneID: number, data: string): Promise<void>;
  open?(
    paneID: number,
    options?: { environment?: Record<string, string | undefined> },
  ): Promise<NativeTerminalPane>;
  focus(
    paneID: number,
    options?: { environment?: Record<string, string | undefined> },
  ): Promise<void>;
  resize(paneID: number, rows: number, cols: number): Promise<void>;
  stop(paneID: number): Promise<void>;
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
    bundledDataDir?: string;
    forkBuildDir?: string;
  } = {},
) {
  if (input.configured) return input.configured;
  const fork = resolveNataliaWezTermForkExecutable({
    os: input.os,
    buildDir: input.forkBuildDir,
  });
  if (fork) return fork;
  const bundled = resolveBundledWezTermExecutable({
    os: input.os,
    dataDir: input.bundledDataDir,
  });
  if (bundled) return bundled;
  const which = input.which ?? Bun.which;
  const os = input.os ?? platform();
  const candidates =
    os === "win32"
      ? ["wezterm.exe", "wezterm-gui.exe"]
      : ["wezterm", "wezterm-gui"];
  for (const candidate of candidates) {
    const resolved = which(candidate);
    if (resolved) return resolved;
  }
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

export function nativeTerminalArtifactKey(
  input: {
    os?: NodeJS.Platform;
    arch?: NodeJS.Architecture;
  } = {},
) {
  const os = input.os ?? platform();
  const arch = input.arch ?? process.arch;
  return `${os}-${arch === "arm64" ? "aarch64" : arch}`;
}

export function nativeTerminalDataDir() {
  return (
    process.env.NATALIA_NATIVE_TERMINAL_DIR ??
    join(
      process.env.XDG_DATA_HOME ??
        join(process.env.HOME ?? ".", ".local", "share"),
      "natalia",
      "native-terminal",
    )
  );
}

export function resolveBundledWezTermExecutable(
  input: {
    os?: NodeJS.Platform;
    dataDir?: string;
  } = {},
) {
  const os = input.os ?? platform();
  const file =
    os === "win32"
      ? "wezterm.exe"
      : os === "darwin"
        ? "WezTerm.app/Contents/MacOS/wezterm"
        : "wezterm.AppImage";
  const executable = join(input.dataDir ?? nativeTerminalDataDir(), file);
  return existsSync(executable) ? executable : undefined;
}

export async function verifyBundledWezTerm(input: {
  executable?: string;
  expectedSHA256: string;
}) {
  const executable = input.executable ?? resolveBundledWezTermExecutable();
  if (!executable) throw new Error("Bundled WezTerm executable is missing");
  const digest = createHash("sha256")
    .update(await readFile(executable))
    .digest("hex");
  if (digest !== input.expectedSHA256)
    throw new Error("Bundled WezTerm checksum mismatch");
  return executable;
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
      "WezTerm Native Terminal Host is unavailable. Install the bundled or system WezTerm distribution.",
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
            input.muxRuntimeDir
              ? { ...input.environment, XDG_RUNTIME_DIR: input.muxRuntimeDir }
              : input.environment,
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
          input.environment,
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
  return {
    kind: "wezterm",
    executable,
    async spawn(options) {
      return await measure("native.spawn", async () => {
        await ensureMux();
        const args = ["cli", "spawn", "--new-window", "--cwd", options.cwd];
        if (options.workspace) args.push("--workspace", options.workspace);
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
      await command([
        "cli",
        "move-pane-to-new-tab",
        "--pane-id",
        String(paneID),
        "--new-window",
        "--workspace",
        "natalia",
      ]);
      await launch(
        executable,
        input.nativeDomain
          ? [
              ...global,
              "start",
              "--always-new-process",
              ...(input.className ? ["--class", input.className] : []),
              "--domain",
              input.nativeDomain.name,
              "--attach",
              "--workspace",
              "natalia",
            ]
          : [
              ...global,
              "start",
              "--always-new-process",
              ...(input.className ? ["--class", input.className] : []),
              "--domain",
              input.muxDomain ?? "local",
              "--attach",
              "--workspace",
              "natalia",
            ],
        options.environment
          ? { ...input.environment, ...options.environment }
          : input.environment,
      );
      input.onPerformance?.("native.gui.launch", performance.now() - openedAt);
      const deadline = performance.now() + timeoutMs;
      while (performance.now() < deadline) {
        await command(["cli", "activate-pane", "--pane-id", String(paneID)]);
        const pane = (await this.list()).find(
          (item) => item.pane_id === paneID,
        );
        if (!pane)
          throw new Error(`WezTerm pane ${paneID} disappeared while opening`);
        // move-pane-to-new-tab changes the server-side window identity only
        // after a GUI client attaches. This is portable across WezTerm builds;
        // list-clients output is not.
        if (pane.window_id !== before.window_id) {
          input.onPerformance?.(
            "native.gui.attach",
            performance.now() - openedAt,
          );
          return pane;
        }
        if (pane.is_active) {
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
    async focus(paneID, options) {
      // Start a separate native GUI client attached to the existing local mux.
      // This does not create, move, or replace the pane/process.
      await launch(
        executable,
        [
          ...global,
          "connect",
          input.nativeDomain?.name ?? input.muxDomain ?? "local",
        ],
        options?.environment
          ? { ...input.environment, ...options.environment }
          : input.environment,
      );
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
    `return { unix_domains = { { name = ${JSON.stringify(name)}, socket_path = [[${input.socketPath}]], no_serve_automatically = true } } }\n`,
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
  tabID: number;
  command: string;
  cwd: string;
  startedAt: string;
  revision: number;
  lastText?: string;
  inputOwner: "model" | "human";
  geometryOwner: "human";
  secureInput: boolean;
  status: "running" | "exited";
  rows?: number;
  cols?: number;
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
  private humanInputBridge?: { endpoint: string; token: string };
  private lastReconcileAt = 0;
  private reconcileInFlight?: Promise<NativeTerminalSession[]>;

  constructor(
    private readonly host: NativeTerminalHost,
    private readonly options: {
      onAudit?: (event: NativeTerminalAuditEvent) => void;
    } = {},
  ) {}

  setHumanInputBridge(bridge: { endpoint: string; token: string }) {
    this.humanInputBridge = bridge;
  }

  async start(input: { command: string; cwd: string; id?: string }) {
    const pane = await this.host.spawn({
      cwd: input.cwd,
      command:
        platform() === "win32"
          ? ["cmd.exe", "/d", "/s", "/c", input.command]
          : ["/bin/sh", "-lc", input.command],
      workspace: "natalia",
    });
    const session: NativeTerminalSession = {
      id: input.id ?? `terminal_${randomUUID()}`,
      host: "wezterm",
      paneID: pane.pane_id,
      windowID: pane.window_id,
      tabID: pane.tab_id,
      command: input.command,
      cwd: input.cwd,
      startedAt: new Date().toISOString(),
      revision: 0,
      inputOwner: "model",
      geometryOwner: "human",
      secureInput: false,
      status: "running",
      rows: pane.rows,
      cols: pane.cols,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  list() {
    return [...this.sessions.values()];
  }

  async reconcile(options: { force?: boolean } = {}) {
    // `wezterm cli list` is an external process. Keep it out of every
    // read/write/observe hot path while retaining periodic exit detection.
    if (!options.force && performance.now() - this.lastReconcileAt < 2_000)
      return this.list();
    this.reconcileInFlight ??= this.reconcileNow().finally(() => {
      this.reconcileInFlight = undefined;
    });
    return await this.reconcileInFlight;
  }

  private async reconcileNow() {
    const panes = new Map(
      (await this.host.list()).map((pane) => [pane.pane_id, pane]),
    );
    this.lastReconcileAt = performance.now();
    for (const session of this.sessions.values()) {
      const pane = panes.get(session.paneID);
      if (!pane) {
        if (session.status !== "exited") {
          session.revision += 1;
          this.audit(session, "exit", "system");
        }
        session.status = "exited";
        continue;
      }
      session.rows = pane.rows;
      session.cols = pane.cols;
    }
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
    this.audit(session, "write", "model");
    return { writtenBytes, delivery: "accepted" };
  }

  async focus(id: string) {
    const session = this.get(id);
    await this.reconcile();
    this.assertRunning(session);
    const environment = this.humanInputBridge
      ? {
          NATALIA_NATIVE_INPUT_ENDPOINT: this.humanInputBridge.endpoint,
          NATALIA_NATIVE_INPUT_TOKEN: this.humanInputBridge.token,
          NATALIA_TERMINAL_ID: session.id,
          NATALIA_TERMINAL_PANE_ID: String(session.paneID),
        }
      : undefined;
    const pane = this.host.open
      ? await this.host.open(session.paneID, { environment })
      : await this.focusWithoutOpening(session);
    session.windowID = pane.window_id;
    session.tabID = pane.tab_id;
    session.rows = pane.rows;
    session.cols = pane.cols;
    // Showing a window is not proof that a person has typed. Stable WezTerm
    // CLI exposes no physical-key event, so Open must not steal model input.
    this.audit(session, "attach", "human");
    return session;
  }

  private async focusWithoutOpening(session: NativeTerminalSession) {
    const environment = this.humanInputBridge
      ? {
          NATALIA_NATIVE_INPUT_ENDPOINT: this.humanInputBridge.endpoint,
          NATALIA_NATIVE_INPUT_TOKEN: this.humanInputBridge.token,
          NATALIA_TERMINAL_ID: session.id,
          NATALIA_TERMINAL_PANE_ID: String(session.paneID),
        }
      : undefined;
    await this.host.focus(session.paneID, { environment });
    return {
      pane_id: session.paneID,
      window_id: session.windowID,
      tab_id: session.tabID,
      rows: session.rows,
      cols: session.cols,
    };
  }

  async claimHumanInput(id: string) {
    const session = this.get(id);
    this.assertRunning(session);
    if (session.secureInput && session.inputOwner !== "human")
      throw new Error("secure input requires human terminal control");
    // A native host retains and writes the bytes through its original pane path
    // after this synchronous ownership transition. Natalia never sees them.
    session.inputOwner = "human";
    session.revision += 1;
    await this.reconcile();
    this.assertRunning(session);
    this.audit(session, "write", "human", session.secureInput);
    return session;
  }

  async attach(id: string) {
    return await this.focus(id);
  }

  detach(id: string) {
    const session = this.get(id);
    if (session.secureInput)
      throw new Error("secure input must end before detaching");
    session.inputOwner = "model";
    session.revision += 1;
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
    this.audit(session, "secure_input", "human");
    return session;
  }

  endSecureInput(id: string) {
    const session = this.get(id);
    session.secureInput = false;
    session.revision += 1;
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
          afterRevision,
          changed: session.revision > afterRevision,
          reason: "exited" as const,
        };
      // reconcile above already established pane liveness. Calling read()
      // here would run a second `wezterm cli list` for every observe poll.
      const text = await this.readSession(session, {
        maxLines: options.maxLines,
      });
      if (session.revision > afterRevision)
        return {
          session,
          text,
          afterRevision,
          changed: true,
          reason: "changed" as const,
        };
      if (performance.now() >= deadline)
        return {
          session,
          text,
          afterRevision,
          changed: false,
          reason: "timeout" as const,
        };
      // WezTerm exposes no subscription API for pane output. Poll at a bounded
      // cadence; 100ms would spawn twenty CLI processes per second because a
      // read also reconciles pane metadata.
      await new Promise<void>((resolve) =>
        setTimeout(
          resolve,
          Math.max(10, Math.min(500, deadline - performance.now())),
        ),
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
    this.audit(session, "resize", "human");
    return session;
  }

  async stop(id: string) {
    const session = this.get(id);
    if (session.status === "running") await this.host.stop(session.paneID);
    session.status = "exited";
    session.revision += 1;
    this.idempotency.delete(id);
    this.modelWrites.delete(id);
    this.audit(session, "exit", "system");
    return session;
  }

  private get(id: string) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`native terminal session not found: ${id}`);
    return session;
  }

  private async readSession(
    session: NativeTerminalSession,
    options?: { maxLines?: number; startLine?: number; endLine?: number },
  ) {
    const text = await this.host.read(session.paneID, options);
    if (text !== session.lastText) {
      session.lastText = text;
      session.revision += 1;
    }
    return text;
  }

  private assertRunning(session: NativeTerminalSession) {
    if (session.status !== "running")
      throw new Error("terminal session has exited");
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
