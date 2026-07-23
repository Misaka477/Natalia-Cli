import type {
  ExecutionTarget,
  PTYAction,
  PTYOwnership,
  PTYStatus,
  RuntimeEvent,
} from "@natalia/contracts";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export type PTYSessionState = {
  id: string;
  command: string;
  cwd: string;
  status: PTYStatus;
  attached: boolean;
  rows: number;
  cols: number;
  prompt?: string;
  activity: "waiting" | "running";
  tail: string;
  transcript: string;
  lastAction?: PTYAction;
  target: ExecutionTarget;
  ownership: PTYOwnership;
  approvalID?: string;
};

export type PTYOutputChunk = {
  text: string;
  sensitive?: boolean;
  lifecycle?: boolean;
};

export function createPTYSession(input: {
  id: string;
  command: string;
  cwd: string;
  rows?: number;
  cols?: number;
  target: ExecutionTarget;
}): PTYSessionState {
  return {
    id: input.id,
    command: input.command,
    cwd: input.cwd,
    status: "starting",
    attached: true,
    rows: input.rows ?? 24,
    cols: input.cols ?? 80,
    activity: "running",
    tail: "",
    transcript: "",
    target: input.target,
    ownership: "model",
  };
}

export function applyPTYAction(
  state: PTYSessionState,
  action: PTYAction,
  options: {
    rows?: number;
    cols?: number;
    input?: string;
    sensitive?: boolean;
    exitStatus?: PTYStatus;
  } = {},
) {
  state.lastAction = action;
  if (action === "resize") {
    state.rows = options.rows ?? state.rows;
    state.cols = options.cols ?? state.cols;
  }
  if (action === "detach") state.attached = false;
  if (action === "attach") state.attached = true;
  if (action === "write" || action === "submit" || action === "special_key")
    state.activity = "running";
  if (action === "exit") {
    state.status = options.exitStatus ?? "exited";
    state.activity = "waiting";
  }
  if (options.input)
    appendPTYOutput(state, {
      text: options.sensitive
        ? redactSensitiveInput(options.input)
        : options.input,
    });
}

export function appendPTYOutput(
  state: PTYSessionState,
  chunk: PTYOutputChunk,
  maxTail = 4000,
) {
  const text = chunk.sensitive
    ? redactSensitiveInput(chunk.text)
    : sanitizeTerminalOutput(chunk.text);
  state.transcript += text;
  state.tail = (state.tail + text).slice(-maxTail);
  const prompt = detectPrompt(state.tail);
  if (prompt) {
    state.prompt = prompt;
    state.activity = "waiting";
    state.status = state.status === "starting" ? "running" : state.status;
  } else if (state.status !== "exited" && state.status !== "failed") {
    state.status = "running";
    state.activity = "running";
  }
}

export function ptyUpdateEvent(state: PTYSessionState): RuntimeEvent {
  return { type: "pty.update", ...state };
}

export function ptyActionEvent(
  state: PTYSessionState,
  action: PTYAction,
  redacted = false,
): RuntimeEvent {
  return {
    type: "pty.action",
    id: state.id,
    action,
    redacted,
    target: state.target,
  };
}

export class PTYOutputCoalescer {
  private pending = new Map<string, string>();

  push(state: PTYSessionState, chunk: PTYOutputChunk) {
    appendPTYOutput(state, chunk);
    if (chunk.lifecycle) return [ptyUpdateEvent(state)];
    this.pending.set(state.id, state.tail);
    return [] as RuntimeEvent[];
  }

  flush(state: PTYSessionState) {
    if (!this.pending.has(state.id)) return [] as RuntimeEvent[];
    this.pending.delete(state.id);
    return [ptyUpdateEvent(state)];
  }
}

export type RealPTYCommandInput = {
  id: string;
  command: string;
  cwd: string;
  rows?: number;
  cols?: number;
  signal?: AbortSignal;
};

export type RealPTYCommandResult = {
  state: PTYSessionState;
  exitCode: number;
  events: RuntimeEvent[];
};

export type PersistentPTYSessionInfo = {
  id: string;
  command: string;
  cwd: string;
  status: PTYStatus;
  pid?: number;
  rows: number;
  cols: number;
  attached: boolean;
  transcriptPath: string;
};

export type InteractivePTYInfo = {
  id: string;
  command: string;
  cwd: string;
  status: PTYStatus;
  attached: boolean;
  rows: number;
  cols: number;
  transcript: string;
  tail: string;
  startedAt: string;
  endedAt?: string;
  secretAudit: InteractivePTYSecretAudit[];
  screen: TerminalScreenSnapshot;
  revision: number;
  lastOutputAt?: string;
};

export type TerminalScreenSnapshot = {
  rows: number;
  cols: number;
  cursor: { row: number; col: number; visible: boolean };
  text: string;
};

/**
 * A deliberately small VT screen model shared by every interactive program.
 * It tracks display state, not any program-specific prompt or completion rule.
 */
export class TerminalScreen {
  private lines: string[];
  private row = 0;
  private col = 0;
  private visible = true;
  private control = "";

  constructor(
    private rows: number,
    private cols: number,
  ) {
    this.lines = Array.from({ length: rows }, () => " ".repeat(cols));
  }

  write(chunk: string) {
    let text = `${this.control}${chunk}`;
    this.control = "";
    for (let index = 0; index < text.length; index++) {
      const char = text[index]!;
      if (char === "\x1b") {
        const sequence = readTerminalControlSequence(text, index);
        if (!sequence) {
          this.control = text.slice(index);
          break;
        }
        this.applyControl(sequence.value);
        index = sequence.end;
        continue;
      }
      this.writeCharacter(char);
    }
  }

  resize(rows: number, cols: number) {
    const previous = this.lines;
    this.rows = rows;
    this.cols = cols;
    this.lines = Array.from({ length: rows }, (_, index) =>
      (previous[index] ?? "").slice(0, cols).padEnd(cols, " "),
    );
    this.row = Math.min(this.row, rows - 1);
    this.col = Math.min(this.col, cols - 1);
  }

  snapshot(): TerminalScreenSnapshot {
    return {
      rows: this.rows,
      cols: this.cols,
      cursor: { row: this.row, col: this.col, visible: this.visible },
      text: this.lines
        .map((line) => line.trimEnd())
        .join("\n")
        .replace(/\n+$/u, ""),
    };
  }

  private writeCharacter(char: string) {
    if (char === "\r") {
      this.col = 0;
      return;
    }
    if (char === "\n") {
      this.lineFeed();
      return;
    }
    if (char === "\b") {
      this.col = Math.max(0, this.col - 1);
      return;
    }
    if (char === "\t") {
      this.col = Math.min(this.cols - 1, this.col + (8 - (this.col % 8)));
      return;
    }
    if (char < " ") return;
    this.replace(this.row, this.col, char);
    this.col++;
    if (this.col >= this.cols) {
      this.col = 0;
      this.lineFeed();
    }
  }

  private applyControl(sequence: string) {
    if (!sequence.startsWith("\x1b[")) return;
    const final = sequence.at(-1)!;
    const values = sequence.slice(2, -1).replace(/^\?/u, "");
    const params = values
      ? values.split(";").map((value) => Number(value) || 0)
      : [];
    const amount = params[0] || 1;
    if (final === "A") this.row = Math.max(0, this.row - amount);
    if (final === "B") this.row = Math.min(this.rows - 1, this.row + amount);
    if (final === "C") this.col = Math.min(this.cols - 1, this.col + amount);
    if (final === "D") this.col = Math.max(0, this.col - amount);
    if (final === "G") this.col = Math.min(this.cols - 1, amount - 1);
    if (final === "H" || final === "f") {
      this.row = Math.min(this.rows - 1, Math.max(0, (params[0] || 1) - 1));
      this.col = Math.min(this.cols - 1, Math.max(0, (params[1] || 1) - 1));
    }
    if (final === "J" && (params[0] === 2 || params[0] === 3)) {
      this.lines.fill(" ".repeat(this.cols));
      this.row = 0;
      this.col = 0;
    }
    if (final === "K") this.eraseLine(params[0] ?? 0);
    if (final === "h" && values === "25") this.visible = true;
    if (final === "l" && values === "25") this.visible = false;
  }

  private eraseLine(mode: number) {
    if (mode === 2) {
      this.lines[this.row] = " ".repeat(this.cols);
      return;
    }
    const line = this.lines[this.row]!;
    const start = mode === 1 ? 0 : this.col;
    const end = mode === 1 ? this.col + 1 : this.cols;
    this.lines[this.row] =
      `${line.slice(0, start)}${" ".repeat(end - start)}${line.slice(end)}`;
  }

  private replace(row: number, col: number, char: string) {
    const line = this.lines[row]!;
    this.lines[row] = `${line.slice(0, col)}${char}${line.slice(col + 1)}`;
  }

  private lineFeed() {
    if (this.row < this.rows - 1) {
      this.row++;
      return;
    }
    this.lines.shift();
    this.lines.push(" ".repeat(this.cols));
  }
}

export type InteractivePTYSecretAudit = {
  at: string;
  action: "write" | "prompt_detected";
  summary: string;
  sha256?: string;
};

export class InteractivePTYRegistry {
  private sessions = new Map<string, InteractivePTYRuntime>();
  private sequence = 0;

  constructor(private readonly stateDir: string) {}

  async start(input: {
    command: string;
    cwd: string;
    id?: string;
    rows?: number;
    cols?: number;
  }) {
    const id = input.id ?? `tty_${(++this.sequence).toString(36)}`;
    if (this.sessions.has(id))
      throw new Error(`interactive PTY already exists: ${id}`);
    await mkdir(this.stateDir, { recursive: true, mode: 0o700 });
    const runtime: InteractivePTYRuntime = {
      id,
      command: input.command,
      cwd: input.cwd,
      status: "starting",
      attached: true,
      rows: input.rows ?? 24,
      cols: input.cols ?? 80,
      transcript: "",
      tail: "",
      startedAt: new Date().toISOString(),
      process: undefined as never,
      listeners: new Set(),
      outputPath: resolve(this.stateDir, `${id}.log`),
      secretAudit: [],
      terminalControlTail: "",
      screenModel: new TerminalScreen(input.rows ?? 24, input.cols ?? 80),
      revision: 0,
    };
    const process = Bun.spawn(
      [
        "python3",
        "-c",
        PYTHON_INTERACTIVE_PTY_BRIDGE,
        runtime.command,
        String(runtime.rows),
        String(runtime.cols),
      ],
      {
        cwd: runtime.cwd,
        env: safePTYEnv(),
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    runtime.process = process;
    runtime.status = "running";
    this.sessions.set(id, runtime);
    void this.consume(runtime);
    void process.exited.then(async (exitCode) => {
      if (runtime.status !== "exited")
        runtime.status = exitCode === 0 ? "exited" : "failed";
      runtime.endedAt = new Date().toISOString();
      await this.persist(runtime);
      this.emit(runtime);
    });
    await this.persist(runtime);
    return publicInteractivePTY(runtime);
  }

  list() {
    return [...this.sessions.values()].map(publicInteractivePTY);
  }

  runningCount(): number {
    return [...this.sessions.values()].filter(
      (session) =>
        session.status === "starting" || session.status === "running",
    ).length;
  }

  get(id: string) {
    const session = this.mustGet(id);
    return publicInteractivePTY(session);
  }

  read(id: string, input: { offset?: number; maxChars?: number } = {}) {
    const session = this.mustGet(id);
    const maxChars = Math.max(1, Math.min(input.maxChars ?? 4000, 20000));
    const offset = Math.max(
      0,
      Math.min(
        input.offset ?? Math.max(0, session.transcript.length - maxChars),
        session.transcript.length,
      ),
    );
    const transcript = session.transcript.slice(offset, offset + maxChars);
    return {
      ...publicInteractivePTY(session),
      transcript,
      offset,
      nextOffset: offset + transcript.length,
      totalChars: session.transcript.length,
      truncated: offset + transcript.length < session.transcript.length,
    };
  }

  subscribe(id: string, listener: (session: InteractivePTYInfo) => void) {
    const session = this.mustGet(id);
    session.listeners.add(listener);
    listener(publicInteractivePTY(session));
    return () => session.listeners.delete(listener);
  }

  async write(
    id: string,
    input: string,
    options: { submit?: boolean; sensitive?: boolean } = {},
  ) {
    const session = this.mustRunning(id);
    const text =
      options.submit === false
        ? input
        : `${input}${input.endsWith("\r") || input.endsWith("\n") ? "" : "\n"}`;
    // The bridge disables terminal ECHO. Only sensitive input needs a pending
    // filter so a child such as `cat` cannot add the secret back to transcript.
    session.pendingTerminalEcho = options.sensitive ? text : undefined;
    await this.command(session, { action: "write", input: text });
    if (options.sensitive) {
      session.secretAudit.push({
        at: new Date().toISOString(),
        action: "write",
        summary: `redacted ${new TextEncoder().encode(input).byteLength} byte(s) of sensitive input`,
        sha256: createHash("sha256").update(input).digest("hex"),
      });
      appendInteractiveOutput(session, "[sensitive input redacted]\n");
    }
    return publicInteractivePTY(session);
  }

  secretAudit(id: string) {
    return [...this.mustGet(id).secretAudit];
  }

  async specialKey(
    id: string,
    key: "enter" | "ctrl-c" | "ctrl-d" | "tab" | "esc",
  ) {
    const session = this.mustRunning(id);
    await this.command(session, { action: "key", key });
    return publicInteractivePTY(session);
  }

  async resize(id: string, rows: number, cols: number) {
    if (rows < 10 || rows > 200 || cols < 20 || cols > 400)
      throw new Error("PTY size must be rows 10-200 and cols 20-400");
    const session = this.mustRunning(id);
    session.rows = rows;
    session.cols = cols;
    session.screenModel.resize(rows, cols);
    session.revision++;
    await this.command(session, { action: "resize", rows, cols });
    await this.persist(session);
    this.emit(session);
    return publicInteractivePTY(session);
  }

  async attach(id: string) {
    const session = this.mustGet(id);
    session.attached = true;
    await this.persist(session);
    this.emit(session);
    return publicInteractivePTY(session);
  }

  async detach(id: string) {
    const session = this.mustGet(id);
    session.attached = false;
    await this.persist(session);
    this.emit(session);
    return publicInteractivePTY(session);
  }

  async stop(id: string) {
    const session = this.mustGet(id);
    if (session.status === "running" || session.status === "starting") {
      await this.command(session, { action: "stop" });
      session.process.kill("SIGTERM");
    }
    session.status = "exited";
    session.endedAt = new Date().toISOString();
    await this.persist(session);
    this.emit(session);
    return publicInteractivePTY(session);
  }

  private async consume(session: InteractivePTYRuntime) {
    if (!(session.process.stdout instanceof ReadableStream))
      throw new Error("interactive PTY stdout is not readable");
    const reader = session.process.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      buffer += decoder.decode(next.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) this.handleBridgeLine(session, line);
    }
    if (buffer) this.handleBridgeLine(session, buffer);
  }

  private handleBridgeLine(session: InteractivePTYRuntime, line: string) {
    try {
      const message = JSON.parse(line) as { type: string; data?: string };
      if (message.type === "output" && message.data) {
        const rawOutput = Buffer.from(message.data, "base64").toString("utf8");
        const outputWithoutSensitiveEcho = stripPendingTerminalEcho(
          session,
          rawOutput,
        );
        session.screenModel.write(outputWithoutSensitiveEcho);
        session.revision++;
        session.lastOutputAt = new Date().toISOString();
        const output = sanitizeInteractiveTerminalOutput(
          session,
          outputWithoutSensitiveEcho,
        );
        if (output) appendInteractiveOutput(session, output);
        if (/password[: ]*$/iu.test(session.tail))
          session.secretAudit.push({
            at: new Date().toISOString(),
            action: "prompt_detected",
            summary: "password prompt detected in PTY tail",
          });
        void this.persist(session);
        this.emit(session);
      }
      if (message.type === "exit") {
        session.status = "exited";
        session.endedAt = new Date().toISOString();
        void this.persist(session);
        this.emit(session);
      }
    } catch {
      // Bridge diagnostics are deliberately not interpreted as terminal output.
    }
  }

  private async command(
    session: InteractivePTYRuntime,
    value: Record<string, unknown>,
  ) {
    if (!session.process.stdin || typeof session.process.stdin === "number")
      throw new Error("interactive PTY stdin is not writable");
    session.process.stdin.write(`${JSON.stringify(value)}\n`);
    await session.process.stdin.flush();
  }

  private mustGet(id: string) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`interactive PTY not found: ${id}`);
    return session;
  }

  private mustRunning(id: string) {
    const session = this.mustGet(id);
    if (session.status !== "running" && session.status !== "starting")
      throw new Error(`interactive PTY is not running: ${id}`);
    return session;
  }

  private async persist(session: InteractivePTYRuntime) {
    await writeFile(session.outputPath, session.transcript, { mode: 0o600 });
  }

  private emit(session: InteractivePTYRuntime) {
    const value = publicInteractivePTY(session);
    for (const listener of session.listeners) listener(value);
  }
}

export class PersistentPTYRegistry {
  private sessions = new Map<string, PersistentPTYRuntime>();

  constructor(private readonly stateDir: string) {}

  async start(input: {
    id: string;
    command: string;
    cwd: string;
    rows?: number;
    cols?: number;
  }) {
    await this.load();
    if (this.sessions.has(input.id))
      throw new Error(`PTY already exists: ${input.id}`);
    await mkdir(this.stateDir, { recursive: true, mode: 0o700 });
    const transcriptPath = resolve(this.stateDir, `${input.id}.log`);
    const result = await runRealPTYCommand({
      id: input.id,
      command: input.command,
      cwd: input.cwd,
      rows: input.rows,
      cols: input.cols,
    });
    await writeFile(transcriptPath, result.state.transcript, { mode: 0o600 });
    const session: PersistentPTYRuntime = {
      id: input.id,
      command: input.command,
      cwd: input.cwd,
      status: result.exitCode === 0 ? "exited" : "failed",
      rows: input.rows ?? 24,
      cols: input.cols ?? 80,
      attached: true,
      transcriptPath,
    };
    this.sessions.set(input.id, session);
    await this.save();
    return publicPersistentPTY(session);
  }

  async list() {
    await this.load();
    return [...this.sessions.values()].map((session) =>
      publicPersistentPTY(refreshPersistentPTY(session)),
    );
  }

  async attach(id: string) {
    const session = await this.mustGet(id);
    session.attached = true;
    await this.save();
    return publicPersistentPTY(refreshPersistentPTY(session));
  }

  async detach(id: string) {
    const session = await this.mustGet(id);
    session.attached = false;
    await this.save();
    return publicPersistentPTY(refreshPersistentPTY(session));
  }

  async resize(id: string, rows: number, cols: number) {
    const session = await this.mustGet(id);
    session.rows = rows;
    session.cols = cols;
    await this.save();
    return publicPersistentPTY(refreshPersistentPTY(session));
  }

  async transcript(id: string, maxBytes = 20000) {
    const session = await this.mustGet(id);
    try {
      const text = await readFile(session.transcriptPath, "utf8");
      return text.slice(-maxBytes);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
      throw error;
    }
  }

  async stop(id: string) {
    const session = await this.mustGet(id);
    if (session.status === "running" && session.pid)
      process.kill(session.pid, "SIGTERM");
    session.status = "exited";
    await this.save();
    return publicPersistentPTY(session);
  }

  private async mustGet(id: string) {
    await this.load();
    const session = this.sessions.get(id);
    if (!session) throw new Error(`unknown PTY session: ${id}`);
    return session;
  }

  private async load() {
    try {
      const parsed = JSON.parse(
        await readFile(resolve(this.stateDir, "pty.json"), "utf8"),
      ) as {
        sessions?: PersistentPTYRuntime[];
      };
      for (const session of parsed.sessions ?? [])
        this.sessions.set(session.id, session);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  private async save() {
    await mkdir(this.stateDir, { recursive: true, mode: 0o700 });
    await writeFile(
      resolve(this.stateDir, "pty.json"),
      `${JSON.stringify({ sessions: [...this.sessions.values()] }, null, 2)}\n`,
      { mode: 0o600 },
    );
  }
}

export async function runRealPTYCommand(
  input: RealPTYCommandInput,
): Promise<RealPTYCommandResult> {
  const state = createPTYSession({
    id: input.id,
    command: input.command,
    cwd: input.cwd,
    rows: input.rows,
    cols: input.cols,
    target: { kind: "host", cwd: input.cwd },
  });
  const process = Bun.spawn(
    ["python3", "-c", PYTHON_PTY_RUNNER, input.command],
    {
      cwd: input.cwd,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const abort = () => process.kill("SIGTERM");
  input.signal?.addEventListener("abort", abort, { once: true });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  input.signal?.removeEventListener("abort", abort);
  appendPTYOutput(state, { text: `${stdout}${stderr}`, lifecycle: true });
  applyPTYAction(state, "exit", {
    exitStatus: exitCode === 0 ? "exited" : "failed",
  });
  return {
    state,
    exitCode,
    events: [ptyUpdateEvent(state), ptyActionEvent(state, "exit")],
  };
}

const PYTHON_PTY_RUNNER = String.raw`
import os
import pty
import select
import subprocess
import sys

master, slave = pty.openpty()
child = subprocess.Popen(
    ["bash", "-lc", sys.argv[1]],
    stdin=slave,
    stdout=slave,
    stderr=slave,
    close_fds=True,
)
os.close(slave)
os.set_blocking(master, False)
while True:
    if child.poll() is not None:
        while True:
            try:
                data = os.read(master, 4096)
            except BlockingIOError:
                break
            except OSError:
                break
            if not data:
                break
            sys.stdout.buffer.write(data)
            sys.stdout.buffer.flush()
        break
    readable, _, _ = select.select([master], [], [], 0.05)
    if not readable:
        continue
    try:
        data = os.read(master, 4096)
    except BlockingIOError:
        continue
    except OSError:
        break
    if not data:
        break
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()
os.close(master)
sys.exit(child.wait())
`;

type PersistentPTYRuntime = PersistentPTYSessionInfo;

type InteractivePTYRuntime = Omit<InteractivePTYInfo, "screen"> & {
  process: ReturnType<typeof Bun.spawn>;
  listeners: Set<(session: InteractivePTYInfo) => void>;
  outputPath: string;
  pendingTerminalEcho?: string;
  terminalControlTail: string;
  screenModel: TerminalScreen;
};

function readTerminalControlSequence(text: string, start: number) {
  const next = text[start + 1];
  if (next === "]" || next === "P") {
    for (let index = start + 2; index < text.length; index++) {
      if (text[index] === "\x07")
        return { value: text.slice(start, index + 1), end: index };
      if (text[index] === "\x1b" && text[index + 1] === "\\")
        return { value: text.slice(start, index + 2), end: index + 1 };
    }
    return undefined;
  }
  if (next !== "[") {
    if (next === undefined) return undefined;
    return { value: text.slice(start, start + 2), end: start + 1 };
  }
  for (let index = start + 2; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code >= 0x40 && code <= 0x7e)
      return { value: text.slice(start, index + 1), end: index };
  }
  return undefined;
}

function appendInteractiveOutput(session: InteractivePTYRuntime, text: string) {
  const safe = sanitizeTerminalOutput(text);
  session.transcript += safe;
  session.tail = (session.tail + safe).slice(-4000);
}

function sanitizeInteractiveTerminalOutput(
  session: InteractivePTYRuntime,
  chunk: string,
) {
  let text = `${session.terminalControlTail}${chunk}`;
  session.terminalControlTail = "";
  text = text
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/gu, "")
    .replace(/\x1BP[\s\S]*?\x1B\\/gu, "");
  const incomplete = Math.max(
    text.lastIndexOf("\x1B]"),
    text.lastIndexOf("\x1BP"),
  );
  if (incomplete >= 0) {
    session.terminalControlTail = text.slice(incomplete);
    text = text.slice(0, incomplete);
  }
  return sanitizeTerminalOutput(text);
}

function stripPendingTerminalEcho(
  session: InteractivePTYRuntime,
  output: string,
) {
  const pending = session.pendingTerminalEcho;
  if (!pending) return output;
  const normalizedPending = pending.replace(/\n/gu, "\r\n");
  if (output === normalizedPending || output === pending) {
    session.pendingTerminalEcho = undefined;
    return "";
  }
  if (output.startsWith(normalizedPending)) {
    session.pendingTerminalEcho = undefined;
    return output.slice(normalizedPending.length);
  }
  if (output.startsWith(pending)) {
    session.pendingTerminalEcho = undefined;
    return output.slice(pending.length);
  }
  return output;
}

function safePTYEnv() {
  const allowed = ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TERM"];
  return Object.fromEntries(
    allowed
      .map((key) => [key, process.env[key]] as const)
      .filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
  );
}

function publicInteractivePTY(
  session: InteractivePTYRuntime,
): InteractivePTYInfo {
  return {
    id: session.id,
    command: session.command,
    cwd: session.cwd,
    status: session.status,
    attached: session.attached,
    rows: session.rows,
    cols: session.cols,
    transcript: session.transcript,
    tail: session.tail,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    secretAudit: [...session.secretAudit],
    screen: session.screenModel.snapshot(),
    revision: session.revision,
    lastOutputAt: session.lastOutputAt,
  };
}

const PYTHON_INTERACTIVE_PTY_BRIDGE = String.raw`
import base64
import fcntl
import json
import os
import pty
import select
import signal
import struct
import subprocess
import sys
import termios

command = sys.argv[1]
rows = int(sys.argv[2])
cols = int(sys.argv[3])
master, slave = pty.openpty()
fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
attrs = termios.tcgetattr(slave)
attrs[3] &= ~termios.ECHO
termios.tcsetattr(slave, termios.TCSANOW, attrs)
def setup_session():
    os.setsid()
    fcntl.ioctl(0, termios.TIOCSCTTY, 0)
child = subprocess.Popen(
    ["bash", "-lc", command],
    stdin=slave,
    stdout=slave,
    stderr=slave,
    close_fds=True,
    preexec_fn=setup_session,
)
os.close(slave)
os.set_blocking(master, False)
os.set_blocking(sys.stdin.fileno(), False)
control_buffer = b""

def emit(kind, data=None):
    value = {"type": kind}
    if data is not None:
        value["data"] = base64.b64encode(data).decode("ascii")
    print(json.dumps(value), flush=True)

while True:
    reads = [master, sys.stdin.fileno()]
    readable, _, _ = select.select(reads, [], [], 0.05)
    if master in readable:
        try:
            data = os.read(master, 4096)
            if data:
                emit("output", data)
        except (BlockingIOError, OSError):
            pass
    if sys.stdin.fileno() in readable:
        try:
            control_buffer += os.read(sys.stdin.fileno(), 4096)
        except BlockingIOError:
            pass
        while b"\n" in control_buffer:
            raw_line, control_buffer = control_buffer.split(b"\n", 1)
            if not raw_line:
                continue
            try:
                request = json.loads(raw_line.decode("utf-8"))
                action = request.get("action")
                if action == "write":
                    os.write(master, request.get("input", "").encode())
                elif action == "key":
                    keys = {"enter": "\r", "ctrl-c": "\x03", "ctrl-d": "\x04", "tab": "\t", "esc": "\x1b"}
                    os.write(master, keys.get(request.get("key"), "").encode())
                elif action == "resize":
                    fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack("HHHH", int(request["rows"]), int(request["cols"]), 0, 0))
                elif action == "stop":
                    child.terminate()
            except Exception:
                pass
    if child.poll() is not None:
        try:
            while True:
                data = os.read(master, 4096)
                if not data:
                    break
                emit("output", data)
        except (BlockingIOError, OSError):
            pass
        emit("exit")
        break

os.close(master)
sys.exit(child.wait())
`;

function refreshPersistentPTY(session: PersistentPTYRuntime) {
  if (session.status !== "running" || !session.pid) return session;
  try {
    process.kill(session.pid, 0);
  } catch {
    session.status = "exited";
  }
  return session;
}

function publicPersistentPTY(
  session: PersistentPTYRuntime,
): PersistentPTYSessionInfo {
  return { ...session };
}

export function redactSensitiveInput(input: string) {
  return input.replace(/./gu, "*");
}

export function sanitizeTerminalOutput(text: string) {
  return text
    .replace(/\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)/gu, "")
    .replace(/\x1BP[\s\S]*?\x1B\\/gu, "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/gu, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/gu, "");
}

export function detectPrompt(text: string) {
  const lines = text.split(/\r?\n/u).filter(Boolean);
  const last = lines.at(-1) ?? "";
  if (/[$#>]\s*$/u.test(last)) return last.slice(-80);
  if (/password[: ]*$/iu.test(last)) return "password prompt";
  return undefined;
}

export type ModelPTYAction = {
  action: PTYAction;
  input?: string;
  rows?: number;
  cols?: number;
  sensitive?: boolean;
  requiresApproval?: boolean;
  reason?: string;
};

export type ModelPTYActionResult =
  | { state: "executed"; events: RuntimeEvent[] }
  | { state: "awaiting_approval"; approvalID: string; events: RuntimeEvent[] }
  | { state: "rejected"; events: RuntimeEvent[] };

export class ModelPTYRegistry {
  private sessions = new Map<string, PTYSessionState>();
  private pending = new Map<
    string,
    { sessionID: string; request: ModelPTYAction }
  >();
  private queues = new Map<string, Promise<void>>();

  create(input: Parameters<typeof createPTYSession>[0]) {
    const existing = this.sessions.get(input.id);
    if (
      existing &&
      existing.status !== "exited" &&
      existing.status !== "failed"
    ) {
      return { session: existing, events: [] as RuntimeEvent[] };
    }
    const session = createPTYSession(input);
    this.sessions.set(session.id, session);
    return {
      session,
      events: [
        ptyUpdateEvent(session),
        timeline(
          session,
          "system",
          "created",
          "executed",
          "model-owned session created",
        ),
      ],
    };
  }

  get(id: string) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`unknown PTY session: ${id}`);
    return session;
  }

  async request(
    id: string,
    request: ModelPTYAction,
  ): Promise<ModelPTYActionResult> {
    const session = this.get(id);
    if (session.ownership !== "model")
      throw new Error("PTY is not model-controlled");
    if (request.requiresApproval) {
      const approvalID = `apr_pty_${id}_${this.pending.size + 1}`;
      session.status = "awaiting_approval";
      session.approvalID = approvalID;
      this.pending.set(approvalID, { sessionID: id, request });
      return {
        state: "awaiting_approval",
        approvalID,
        events: [
          timeline(
            session,
            "model",
            request.action,
            "requested",
            request.reason ?? "model PTY action requested",
          ),
          { type: "pty.update", ...session },
          {
            type: "pty.approval",
            id,
            approvalID,
            state: "awaiting",
            action: request.action,
            reason: request.reason ?? "PTY action requires approval",
            target: session.target,
          },
        ],
      };
    }
    return this.execute(session, request);
  }

  async resolveApproval(
    approvalID: string,
    approved: boolean,
  ): Promise<ModelPTYActionResult> {
    const pending = this.pending.get(approvalID);
    if (!pending) throw new Error(`unknown PTY approval: ${approvalID}`);
    this.pending.delete(approvalID);
    const session = this.get(pending.sessionID);
    session.approvalID = undefined;
    if (!approved) {
      session.status = "waiting";
      return {
        state: "rejected",
        events: [
          {
            type: "pty.approval",
            id: session.id,
            approvalID,
            state: "rejected",
            action: pending.request.action,
            reason: "user rejected PTY action",
            target: session.target,
          },
          timeline(
            session,
            "system",
            "approval",
            "rejected",
            "user rejected PTY action",
          ),
          ptyUpdateEvent(session),
        ],
      };
    }
    const executed = await this.execute(session, pending.request);
    return {
      ...executed,
      events: [
        {
          type: "pty.approval",
          id: session.id,
          approvalID,
          state: "approved",
          action: pending.request.action,
          reason: "user approved PTY action",
          target: session.target,
        },
        ...executed.events,
      ],
    };
  }

  private async execute(
    session: PTYSessionState,
    request: ModelPTYAction,
  ): Promise<ModelPTYActionResult> {
    const prior = this.queues.get(session.id) ?? Promise.resolve();
    let events: RuntimeEvent[] = [];
    const next = prior.then(() => {
      applyPTYAction(session, request.action, {
        rows: request.rows,
        cols: request.cols,
        sensitive: request.sensitive,
      });
      if (request.input) {
        appendPTYOutput(session, {
          text: request.sensitive
            ? "[sensitive input supplied]\n"
            : `$ ${request.input}\n`,
        });
      }
      if (session.status !== "exited" && session.status !== "failed") {
        session.status = session.activity === "waiting" ? "waiting" : "running";
      }
      events = [
        timeline(
          session,
          "model",
          request.action,
          "executed",
          request.sensitive
            ? "sensitive input supplied"
            : `${request.action} executed`,
        ),
        ptyActionEvent(session, request.action, Boolean(request.sensitive)),
        ptyUpdateEvent(session),
      ];
    });
    this.queues.set(session.id, next);
    await next;
    return { state: "executed", events };
  }
}

function timeline(
  session: PTYSessionState,
  actor: "model" | "user" | "system",
  action: "created" | "approval" | PTYAction,
  status:
    | "requested"
    | "awaiting_approval"
    | "approved"
    | "executed"
    | "rejected",
  summary: string,
): RuntimeEvent {
  return {
    type: "pty.timeline",
    id: session.id,
    actor,
    action,
    status,
    summary,
    at: new Date().toISOString(),
  };
}
