import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import type {
  RuntimeEvent,
  RuntimeNativeTerminalSession,
} from "@natalia/contracts";
import type { TerminalController } from "@natalia/runtime-services";
import { nativeTerminalPaneCommand } from "./native-terminal";

const DEFAULT_ROWS = 24;
const DEFAULT_COLS = 80;
const MAX_OUTPUT_BYTES = 256 * 1024;
const DEFAULT_MAX_PER_SESSION = 8;
const DEFAULT_IDLE_MS = 15 * 60 * 1000;

export type PtyProcess = {
  pid: number;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData(listener: (data: string) => void): { dispose(): void };
  onExit(listener: (event: { exitCode: number; signal?: number }) => void): {
    dispose(): void;
  };
};

export type PtySpawnOptions = {
  file: string;
  args: string[];
  cwd: string;
  cols: number;
  rows: number;
  env?: Record<string, string>;
};

export type PtyFactory = (options: PtySpawnOptions) => PtyProcess;

type PtySession = {
  id: string;
  sessionID?: string;
  agentID?: string;
  command: string;
  cwd: string;
  startedAt: string;
  status: "running" | "exited";
  inputOwner: "model" | "human";
  geometryOwner: "human";
  secureInput: boolean;
  attached: boolean;
  rows: number;
  cols: number;
  revision: number;
  output: string;
  lastObservedText?: string;
  lastObservedRevision?: number;
  lastModelWriteAt?: number;
  lastOutputAt?: number;
  lastActivityAt: number;
  pty?: PtyProcess;
  disposers: Array<{ dispose(): void }>;
};

export type PtyTerminalControllerInput = {
  workspaceRoot: string;
  publish(event: RuntimeEvent): void;
  onPerformance(name: string, durationMs: number): void;
  runtimeID(): string;
  userRuntimeHome(): string | undefined;
  windowMode(): "auto" | "windowless" | "window";
  backend?: "wezterm" | "pty";
  spawn?: PtyFactory;
  maxPerSession?: number;
  idleMs?: number;
};

const PYTHON_PTY_BRIDGE = `
import fcntl, json, os, pty, select, signal, struct, sys, termios

stdin = sys.stdin.fileno()
stdout = sys.stdout.fileno()
pending = b""

def read_line():
    global pending
    while True:
        index = pending.find(b"\\n")
        if index >= 0:
            line = pending[:index]
            pending = pending[index + 1:]
            return line.decode("utf-8")
        chunk = os.read(stdin, 4096)
        if not chunk:
            return None
        pending += chunk

spec = json.loads(read_line())
pid, master = pty.fork()
if pid == 0:
    os.chdir(spec["cwd"])
    env = os.environ.copy()
    env.update(spec.get("env") or {})
    os.execvpe(spec["file"], [spec["file"], *spec["args"]], env)
fcntl.ioctl(
    master,
    termios.TIOCSWINSZ,
    struct.pack("HHHH", spec["rows"], spec["cols"], 0, 0),
)
os.write(stdout, (json.dumps({"pid": pid}) + "\\n").encode("ascii"))

def send(kind, payload=b""):
    data = payload if isinstance(payload, bytes) else payload.encode("utf-8")
    os.write(stdout, f"{kind} {len(data)}\\n".encode("ascii"))
    if data:
        os.write(stdout, data)

def handle_line(line):
    message = json.loads(line)
    kind = message.get("type")
    if kind == "input":
        os.write(master, message.get("data", "").encode("utf-8"))
        return True
    if kind == "resize":
        fcntl.ioctl(
            master,
            termios.TIOCSWINSZ,
            struct.pack("HHHH", int(message["rows"]), int(message["cols"]), 0, 0),
        )
        return True
    if kind == "kill":
        os.kill(pid, signal.SIGTERM)
        return False
    return True

# A message can arrive in the same socket read as the startup spec — the host
# writes its first input the instant start() returns, before this interpreter
# has finished booting. read_line leaves such a line in pending, and the
# select loop below only reacts to NEW bytes, so without this drain the first
# input of a freshly started terminal is silently dropped. Process whatever
# the spec read already consumed before blocking in select.
alive = True
while True:
    index = pending.find(b"\\n")
    if index < 0:
        break
    line = pending[:index].decode("utf-8")
    pending = pending[index + 1:]
    if not handle_line(line):
        alive = False
        break

while alive:
    readable, _, _ = select.select([stdin, master], [], [])
    if stdin in readable:
        chunk = os.read(stdin, 4096)
        if not chunk:
            alive = False
            break
        pending += chunk
        while True:
            index = pending.find(b"\\n")
            if index < 0:
                break
            line = pending[:index].decode("utf-8")
            pending = pending[index + 1:]
            if not handle_line(line):
                alive = False
                break
    if not alive:
        break
    if master in readable:
        try:
            chunk = os.read(master, 4096)
        except OSError:
            chunk = b""
        if not chunk:
            alive = False
            break
        send("o", chunk)
try:
    waited, status = os.waitpid(pid, 0)
    code = os.WEXITSTATUS(status) if os.WIFEXITED(status) else 1
except ChildProcessError:
    code = 0
send("x", str(code))
`;

function loadNodePty(): typeof import("node-pty") {
  const candidates = [
    import.meta.url,
    resolve(process.cwd(), "packages/plugins/native-terminal/package.json"),
    resolve(process.cwd(), "package.json"),
  ];
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const pty = createRequire(candidate)(
        "node-pty",
      ) as typeof import("node-pty");
      if (typeof pty.spawn !== "function")
        throw new Error("node-pty spawn is missing");
      return pty;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("node-pty is not installed");
}

function spawnWithNodePty(options: PtySpawnOptions): PtyProcess {
  const pty = loadNodePty();
  const child = pty.spawn(options.file, options.args, {
    name: "xterm-256color",
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: options.env,
  });
  return {
    pid: child.pid,
    write(data) {
      child.write(data);
    },
    resize(cols, rows) {
      child.resize(cols, rows);
    },
    kill(signal) {
      child.kill(signal);
    },
    onData(listener) {
      return child.onData(listener);
    },
    onExit(listener) {
      return child.onExit(listener);
    },
  };
}

function spawnWithPythonPty(options: PtySpawnOptions): PtyProcess {
  const child = spawn("python3", ["-u", "-c", PYTHON_PTY_BRIDGE], {
    stdio: ["pipe", "pipe", "inherit"],
  });
  if (!child.stdin || !child.stdout || child.pid == null)
    throw new Error("python pty bridge failed to start");
  child.stdin.write(
    `${JSON.stringify({
      file: options.file,
      args: options.args,
      cwd: options.cwd,
      cols: options.cols,
      rows: options.rows,
      env: options.env ?? {},
    })}\n`,
  );
  const dataListeners = new Set<(data: string) => void>();
  const exitListeners = new Set<
    (event: { exitCode: number; signal?: number }) => void
  >();
  let pid = child.pid;
  let leftover = Buffer.alloc(0);
  let header: { kind: string; size: number } | undefined;
  let exited = false;

  function emitExit(exitCode: number) {
    if (exited) return;
    exited = true;
    for (const listener of exitListeners) listener({ exitCode });
  }

  function consume(chunk: Buffer) {
    leftover = Buffer.concat([leftover, chunk]);
    while (leftover.length) {
      if (!header) {
        const newline = leftover.indexOf(10);
        if (newline < 0) return;
        const line = leftover.subarray(0, newline).toString("utf8");
        leftover = leftover.subarray(newline + 1);
        if (line.startsWith("{")) {
          try {
            const parsed = JSON.parse(line) as { pid?: number };
            if (typeof parsed.pid === "number") pid = parsed.pid;
          } catch {
            // ignore malformed handshake
          }
          continue;
        }
        const match = /^(o|x) (\d+)$/u.exec(line);
        if (!match) continue;
        header = { kind: match[1]!, size: Number(match[2]) };
        continue;
      }
      if (leftover.length < header.size) return;
      const payload = leftover.subarray(0, header.size);
      leftover = leftover.subarray(header.size);
      if (header.kind === "o") {
        const text = payload.toString("utf8");
        for (const listener of dataListeners) listener(text);
      } else {
        emitExit(Number(payload.toString("utf8") || "0"));
      }
      header = undefined;
    }
  }

  const childEvents = child as unknown as NodeJS.EventEmitter & {
    stdout?: {
      on(event: "data", listener: (chunk: Buffer | string) => void): unknown;
    };
  };
  childEvents.stdout?.on("data", (chunk) => {
    consume(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  });
  childEvents.on("exit", (code: number | null) => emitExit(code ?? 0));

  function send(message: Record<string, unknown>) {
    if (!child.stdin?.writable) return;
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  return {
    get pid() {
      return pid;
    },
    write(data) {
      send({ type: "input", data });
    },
    resize(cols, rows) {
      send({ type: "resize", cols, rows });
    },
    kill() {
      send({ type: "kill" });
      child.kill();
    },
    onData(listener) {
      dataListeners.add(listener);
      return {
        dispose() {
          dataListeners.delete(listener);
        },
      };
    },
    onExit(listener) {
      exitListeners.add(listener);
      return {
        dispose() {
          exitListeners.delete(listener);
        },
      };
    },
  };
}

function defaultSpawn(): PtyFactory {
  return (options) => {
    if (typeof Bun !== "undefined") return spawnWithPythonPty(options);
    try {
      return spawnWithNodePty(options);
    } catch {
      return spawnWithPythonPty(options);
    }
  };
}

function envRecord(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") env[key] = value;
  }
  env.TERM = env.TERM || "xterm-256color";
  env.COLORTERM = env.COLORTERM || "truecolor";
  return env;
}

function trimOutput(text: string): string {
  if (text.length <= MAX_OUTPUT_BYTES) return text;
  return text.slice(text.length - MAX_OUTPUT_BYTES);
}

function lineWindow(text: string, maxLines?: number): string {
  if (!maxLines || maxLines <= 0) return text;
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.slice(-maxLines).join("\n");
}

/**
 * In-process PTY TerminalController for the Web interactive terminal.
 * One Natalia session may own several PTYs (capped); start() is idempotent
 * per terminalID; close() kills every remaining process.
 */
export function createPtyTerminalController(
  input: PtyTerminalControllerInput,
): TerminalController {
  const sessions = new Map<string, PtySession>();
  const idempotency = new Map<string, Map<string, string>>();
  const writes = new Map<string, Promise<void>>();
  const revisionWaiters = new Map<string, Set<() => void>>();
  const outputListeners = new Map<string, Set<(chunk: string) => void>>();
  let activeSession: string | undefined;
  let closed = false;
  let initialized = false;
  const spawnPty = input.spawn ?? defaultSpawn();
  const maxPerSession = Math.max(
    1,
    input.maxPerSession ?? DEFAULT_MAX_PER_SESSION,
  );
  const idleMs = Math.max(1, input.idleMs ?? DEFAULT_IDLE_MS);

  function sessionVisible(session: PtySession): boolean {
    return activeSession === undefined || session.sessionID === activeSession;
  }

  function assertSessionOwner(session: PtySession, sessionID?: string) {
    const expected = sessionID ?? activeSession;
    if (expected && session.sessionID && session.sessionID !== expected)
      throw new Error(
        `terminal ${session.id} belongs to session ${session.sessionID}`,
      );
  }

  function get(id: string): PtySession {
    const session = sessions.get(id);
    if (!session) throw new Error(`native terminal session not found: ${id}`);
    return session;
  }

  function notifyRevision(id: string) {
    for (const wake of revisionWaiters.get(id) ?? []) wake();
  }

  function waitForRevision(id: string, timeoutMs: number) {
    return new Promise<void>((resolve) => {
      const waiters = revisionWaiters.get(id) ?? new Set<() => void>();
      const wake = () => {
        clearTimeout(timer);
        waiters.delete(wake);
        if (!waiters.size) revisionWaiters.delete(id);
        resolve();
      };
      const timer = setTimeout(wake, timeoutMs);
      waiters.add(wake);
      revisionWaiters.set(id, waiters);
    });
  }

  function publishAudit(
    session: PtySession,
    action:
      | "started"
      | "write"
      | "resize"
      | "exit"
      | "request_human"
      | "detach"
      | "secure_input",
    actor: "model" | "human" | "system",
    detail?: string,
  ) {
    const sessionID = session.sessionID as
      | RuntimeEvent["sessionID"]
      | undefined;
    input.publish({
      type: "terminal.action",
      id: session.id,
      ...(sessionID ? { sessionID } : {}),
      action,
      redacted: action === "write" ? false : undefined,
      target: { kind: "host", cwd: session.cwd },
    });
    input.publish({
      type: "terminal.timeline",
      id: session.id,
      ...(sessionID ? { sessionID } : {}),
      actor: actor === "human" ? "user" : actor,
      action,
      status: "executed",
      summary:
        action === "request_human"
          ? (detail ?? "pty terminal requests human attention")
          : action === "started"
            ? "pty terminal started"
            : action === "write"
              ? "pty terminal input accepted"
              : `pty terminal ${action} executed`,
      at: new Date().toISOString(),
    });
  }

  function publicSession(session: PtySession): RuntimeNativeTerminalSession {
    return {
      id: session.id,
      host: "pty",
      paneID: session.pty?.pid ?? 0,
      windowID: 0,
      muxWindowID: 0,
      tabID: 0,
      command: session.command,
      cwd: session.cwd,
      status: session.status,
      inputOwner: session.inputOwner,
      geometryOwner: session.geometryOwner,
      secureInput: session.secureInput,
      rows: session.rows,
      cols: session.cols,
      startedAt: session.startedAt,
      attached: session.attached,
      ...(session.sessionID ? { sessionID: session.sessionID } : {}),
      ...(session.agentID ? { agentID: session.agentID } : {}),
    };
  }

  function touch(session: PtySession) {
    session.lastActivityAt = Date.now();
  }

  function appendOutput(session: PtySession, chunk: string) {
    if (!chunk) return;
    session.output = trimOutput(session.output + chunk);
    session.revision += 1;
    session.lastOutputAt = Date.now();
    touch(session);
    notifyRevision(session.id);
    for (const listener of outputListeners.get(session.id) ?? [])
      listener(chunk);
  }

  function markExited(
    session: PtySession,
    actor: "model" | "human" | "system",
  ) {
    if (session.status === "exited") return;
    session.status = "exited";
    session.attached = false;
    session.revision += 1;
    notifyRevision(session.id);
    idempotency.delete(session.id);
    writes.delete(session.id);
    for (const disposer of session.disposers) disposer.dispose();
    session.disposers = [];
    session.pty = undefined;
    publishAudit(session, "exit", actor);
  }

  function runningForSession(sessionID: string | undefined): PtySession[] {
    const key = sessionID ?? "__default__";
    return [...sessions.values()].filter((session) => {
      const owner = session.sessionID ?? "__default__";
      return owner === key && session.status === "running";
    });
  }

  async function recycleOldestIdle(
    sessionID: string | undefined,
  ): Promise<boolean> {
    const now = Date.now();
    const idle = runningForSession(sessionID)
      .filter((session) => now - session.lastActivityAt >= idleMs)
      .sort((a, b) => a.lastActivityAt - b.lastActivityAt);
    const victim = idle[0];
    if (!victim) return false;
    await stop(victim.id, "system");
    return true;
  }

  function assertRunning(session: PtySession) {
    if (session.status !== "running")
      throw new Error("terminal session has exited");
  }

  function assertReadable(session: PtySession) {
    assertRunning(session);
    if (session.secureInput)
      throw new Error("terminal output is hidden during secure human input");
  }

  async function init() {
    if (closed) throw new Error("terminal controller is closed");
    initialized = true;
  }

  async function list(sessionID?: string) {
    return [...sessions.values()]
      .filter((session) =>
        sessionID ? session.sessionID === sessionID : sessionVisible(session),
      )
      .map(publicSession);
  }

  async function reconcile() {
    return await list();
  }

  async function read(
    id: string,
    options?: { maxLines?: number; sessionID?: string },
  ) {
    const session = get(id);
    assertSessionOwner(session, options?.sessionID);
    assertReadable(session);
    return {
      text: lineWindow(session.output, options?.maxLines),
      cursorX: 0,
      cursorY: 0,
      rows: session.rows,
      cols: session.cols,
    };
  }

  async function openHub() {
    const first = [...sessions.values()].find(
      (session) => session.status === "running" && sessionVisible(session),
    );
    if (!first) throw new Error("no running native terminal session");
    first.attached = true;
    return { muxWindowID: 0 };
  }

  function releaseHumanControl(id: string, sessionID?: string) {
    const session = get(id);
    assertSessionOwner(session, sessionID);
    if (session.secureInput)
      throw new Error(
        "secure input must end before returning control to model",
      );
    session.inputOwner = "model";
    session.revision += 1;
    notifyRevision(session.id);
    publishAudit(session, "detach", "human");
    return publicSession(session);
  }

  function beginSecureInput(id: string, sessionID?: string) {
    const session = get(id);
    assertSessionOwner(session, sessionID);
    assertRunning(session);
    if (session.inputOwner !== "human")
      throw new Error("secure input requires human terminal control");
    session.secureInput = true;
    session.revision += 1;
    notifyRevision(session.id);
    publishAudit(session, "secure_input", "human");
    return publicSession(session);
  }

  function endSecureInput(id: string, sessionID?: string) {
    const session = get(id);
    assertSessionOwner(session, sessionID);
    session.secureInput = false;
    session.revision += 1;
    notifyRevision(session.id);
    publishAudit(session, "secure_input", "human");
    return publicSession(session);
  }

  async function claimHumanInput(id: string, sessionID?: string) {
    const session = get(id);
    assertSessionOwner(session, sessionID);
    assertRunning(session);
    if (session.secureInput && session.inputOwner !== "human")
      throw new Error("secure input requires human terminal control");
    if (session.inputOwner === "human") return publicSession(session);
    session.inputOwner = "human";
    session.revision += 1;
    notifyRevision(session.id);
    publishAudit(session, "write", "human");
    return publicSession(session);
  }

  async function stop(
    id: string,
    actor: "model" | "human" | "system",
    sessionID?: string,
  ) {
    const session = get(id);
    assertSessionOwner(session, sessionID);
    if (session.status === "running") {
      try {
        session.pty?.kill();
      } catch {
        // process already gone
      }
    }
    markExited(session, actor);
    return publicSession(session);
  }

  async function start(startInput: {
    command: string;
    cwd: string;
    id?: string;
    sessionID?: string;
    agentID?: string;
  }) {
    if (closed) throw new Error("terminal controller is closed");
    if (!initialized) await init();
    const owningSession = startInput.sessionID ?? activeSession;
    if (startInput.id) {
      const existing = sessions.get(startInput.id);
      if (existing?.status === "running") {
        if (
          existing.sessionID &&
          owningSession &&
          existing.sessionID !== owningSession
        )
          throw new Error(
            `terminal ${existing.id} belongs to session ${existing.sessionID}`,
          );
        touch(existing);
        return publicSession(existing);
      }
    }

    const running = runningForSession(owningSession);
    if (running.length >= maxPerSession) {
      const recycled = await recycleOldestIdle(owningSession);
      if (!recycled || runningForSession(owningSession).length >= maxPerSession)
        throw new Error(
          `session already has ${maxPerSession} running terminals`,
        );
    }

    const argv = nativeTerminalPaneCommand(startInput.command);
    const file = argv[0] ?? "/bin/sh";
    const args = argv.slice(1);
    const id = startInput.id ?? `terminal_${randomUUID()}`;
    const now = Date.now();
    const session: PtySession = {
      id,
      sessionID: owningSession,
      ...(startInput.agentID ? { agentID: startInput.agentID } : {}),
      command: startInput.command,
      cwd: startInput.cwd,
      startedAt: new Date().toISOString(),
      status: "running",
      inputOwner: "model",
      geometryOwner: "human",
      secureInput: false,
      attached: true,
      rows: DEFAULT_ROWS,
      cols: DEFAULT_COLS,
      revision: 0,
      output: "",
      lastActivityAt: now,
      disposers: [],
    };
    const started = performance.now();
    const pty = spawnPty({
      file,
      args,
      cwd: startInput.cwd,
      cols: DEFAULT_COLS,
      rows: DEFAULT_ROWS,
      env: envRecord(),
    });
    session.pty = pty;
    session.disposers.push(
      pty.onData((chunk) => {
        appendOutput(session, chunk);
      }),
      pty.onExit(() => {
        markExited(session, "system");
      }),
    );
    sessions.set(id, session);
    input.onPerformance("pty.start", performance.now() - started);
    publishAudit(session, "started", "model");
    return publicSession(session);
  }

  async function write(
    id: string,
    value: string,
    options?: { idempotencyKey?: string; sessionID?: string },
  ) {
    const session = get(id);
    assertSessionOwner(session, options?.sessionID);
    assertRunning(session);
    if (session.inputOwner !== "model")
      throw new Error("terminal input is controlled by a human");
    if (session.secureInput)
      throw new Error("terminal is accepting secure human input");
    const writtenBytes = new TextEncoder().encode(value).byteLength;
    if (options?.idempotencyKey) {
      const keys = idempotency.get(id) ?? new Map<string, string>();
      const previous = keys.get(options.idempotencyKey);
      if (previous !== undefined) {
        if (previous !== value)
          throw new Error(
            "terminal idempotency key was reused with different input",
          );
        return { writtenBytes, delivery: "duplicate" as const };
      }
      keys.set(options.idempotencyKey, value);
      idempotency.set(id, keys);
      while (keys.size > 256) keys.delete(keys.keys().next().value!);
    }
    const previous = writes.get(id) ?? Promise.resolve();
    let cancelled = false;
    const delivery = previous.then(() => {
      if (session.inputOwner !== "model" || session.status !== "running") {
        cancelled = true;
        return;
      }
      session.pty?.write(value);
    });
    writes.set(
      id,
      delivery.catch(() => undefined),
    );
    try {
      await delivery;
    } catch (error) {
      if (options?.idempotencyKey)
        idempotency.get(id)?.delete(options.idempotencyKey);
      throw error;
    }
    if (cancelled) {
      if (options?.idempotencyKey)
        idempotency.get(id)?.delete(options.idempotencyKey);
      return { writtenBytes, delivery: "cancelled" as const };
    }
    session.revision += 1;
    session.lastModelWriteAt = Date.now();
    touch(session);
    notifyRevision(session.id);
    publishAudit(session, "write", "model");
    return { writtenBytes, delivery: "accepted" as const };
  }

  async function resize(
    id: string,
    rows: number,
    cols: number,
    actor: "model" | "human",
    sessionID?: string,
  ) {
    const session = get(id);
    assertSessionOwner(session, sessionID);
    assertRunning(session);
    if (!Number.isInteger(rows) || rows < 1 || rows > 500)
      throw new Error("terminal rows must be an integer between 1 and 500");
    if (!Number.isInteger(cols) || cols < 1 || cols > 500)
      throw new Error("terminal cols must be an integer between 1 and 500");
    session.pty?.resize(cols, rows);
    session.rows = rows;
    session.cols = cols;
    session.revision += 1;
    touch(session);
    notifyRevision(session.id);
    publishAudit(session, "resize", actor);
    return publicSession(session);
  }

  async function snapshot(id: string) {
    const session = get(id);
    assertReadable(session);
    return {
      text: session.output,
      cursorX: 0,
      cursorY: 0,
      rows: session.rows,
      cols: session.cols,
      revision: session.revision,
      status: session.status,
      inputOwner: session.inputOwner,
      highlightRanges: [],
    };
  }

  async function observe(
    id: string,
    afterRevision: number,
    options?: { maxLines?: number; timeoutMs?: number },
  ) {
    const session = get(id);
    const timeoutMs = Math.max(
      1,
      Math.min(options?.timeoutMs ?? 5_000, 30_000),
    );
    const deadline = performance.now() + timeoutMs;
    while (true) {
      if (session.status === "exited")
        return {
          session: { revision: session.revision },
          text: "",
          cursorX: 0,
          cursorY: 0,
          rows: session.rows,
          cols: session.cols,
          afterRevision,
          changed: session.revision > afterRevision,
          reason: "exited" as const,
        };
      const text = lineWindow(session.output, options?.maxLines);
      if (session.revision > afterRevision)
        return {
          session: { revision: session.revision },
          text,
          cursorX: 0,
          cursorY: 0,
          rows: session.rows,
          cols: session.cols,
          afterRevision,
          changed: true,
          reason: "session_activity" as const,
        };
      if (performance.now() >= deadline)
        return {
          session: { revision: session.revision },
          text,
          cursorX: 0,
          cursorY: 0,
          rows: session.rows,
          cols: session.cols,
          afterRevision,
          changed: false,
          reason: "timeout" as const,
        };
      await waitForRevision(
        session.id,
        Math.max(10, Math.min(500, deadline - performance.now())),
      );
    }
  }

  function session(id: string) {
    const current = get(id);
    return { lastObservedText: current.lastObservedText };
  }

  function markObserved(id: string, text: string, revision: number) {
    const current = get(id);
    current.lastObservedText = text;
    current.lastObservedRevision = revision;
  }

  async function requestHuman(id: string, reason: string, sessionID?: string) {
    const current = get(id);
    assertSessionOwner(current, sessionID);
    assertRunning(current);
    if (typeof reason !== "string" || reason.length === 0)
      throw new Error("request_human requires a reason");
    if (reason.length > 240)
      throw new Error(
        "request_human reason must be 240 characters or fewer; describe the kind of input needed, never screen content or secrets",
      );
    publishAudit(current, "request_human", "model", reason);
    return publicSession(current);
  }

  async function ttyName(id: string) {
    const current = get(id);
    const pid = current.pty?.pid;
    return pid ? `/proc/${pid}/fd/0` : undefined;
  }

  function subscribeOutput(id: string, listener: (chunk: string) => void) {
    const session = get(id);
    const listeners =
      outputListeners.get(session.id) ?? new Set<(chunk: string) => void>();
    listeners.add(listener);
    outputListeners.set(session.id, listeners);
    if (session.output) listener(session.output);
    return () => {
      listeners.delete(listener);
      if (!listeners.size) outputListeners.delete(session.id);
    };
  }

  function setActiveSession(sessionID: string | undefined) {
    if (sessionID !== undefined)
      for (const session of sessions.values())
        if (session.sessionID === undefined && session.status === "running")
          session.sessionID = sessionID;
    activeSession = sessionID;
  }

  async function stopForSession(sessionID: string) {
    const owned = [...sessions.values()].filter(
      (session) =>
        session.sessionID === sessionID && session.status === "running",
    );
    await Promise.allSettled(
      owned.map(async (session) => {
        await stop(session.id, "system");
      }),
    );
  }

  async function close() {
    if (closed) return;
    closed = true;
    const running = [...sessions.values()].filter(
      (session) => session.status === "running",
    );
    await Promise.allSettled(
      running.map(async (session) => {
        try {
          session.pty?.kill();
        } catch {
          // already gone
        }
        markExited(session, "system");
      }),
    );
    sessions.clear();
    idempotency.clear();
    writes.clear();
    revisionWaiters.clear();
    outputListeners.clear();
  }

  return {
    init,
    list,
    reconcile,
    read,
    openHub,
    claimHumanInput,
    releaseHumanControl,
    beginSecureInput,
    endSecureInput,
    stop,
    start,
    write,
    resize,
    snapshot,
    observe,
    session,
    markObserved,
    requestHuman,
    ttyName,
    setActiveSession,
    subscribeOutput,
    stopForSession,
    close,
  };
}
