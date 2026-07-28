import type {
  ExecutionTarget,
  TerminalAction,
  TerminalOwnership,
  TerminalStatus,
  RuntimeEvent,
  TerminalScreenSnapshot,
  TerminalScreenDelivery,
  TerminalScreenUpdate,
  TerminalScrollbackPage,
} from "@natalia/contracts";
import {
  diffTerminalScreens,
  terminalScreenPatchBytes,
  terminalScreenSnapshotBytes,
  XtermTerminalEmulator,
} from "./index";
import { createHash } from "node:crypto";
import {
  appendFile,
  mkdir,
  readFile as readFileAsync,
  writeFile,
} from "node:fs/promises";
import { resolve } from "node:path";

export type TerminalSessionState = {
  id: string;
  command: string;
  cwd: string;
  status: TerminalStatus;
  attached: boolean;
  rows: number;
  cols: number;
  prompt?: string;
  activity: "waiting" | "running";
  tail: string;
  transcript: string;
  lastAction?: TerminalAction;
  target: ExecutionTarget;
  ownership: TerminalOwnership;
  approvalID?: string;
};

export type TerminalOutputChunk = {
  text: string;
  sensitive?: boolean;
  lifecycle?: boolean;
};

export function createTerminalSession(input: {
  id: string;
  command: string;
  cwd: string;
  rows?: number;
  cols?: number;
  target: ExecutionTarget;
}): TerminalSessionState {
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

export function applyTerminalAction(
  state: TerminalSessionState,
  action: TerminalAction,
  options: {
    rows?: number;
    cols?: number;
    input?: string;
    sensitive?: boolean;
    exitStatus?: TerminalStatus;
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
    appendTerminalOutput(state, {
      text: options.sensitive
        ? redactSensitiveInput(options.input)
        : options.input,
    });
}

export function appendTerminalOutput(
  state: TerminalSessionState,
  chunk: TerminalOutputChunk,
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

export function terminalUpdateEvent(state: TerminalSessionState): RuntimeEvent {
  return { type: "terminal.update", ...state };
}

export function terminalActionEvent(
  state: TerminalSessionState,
  action: TerminalAction,
  redacted = false,
): RuntimeEvent {
  return {
    type: "terminal.action",
    id: state.id,
    action,
    redacted,
    target: state.target,
  };
}

export class TerminalOutputCoalescer {
  private pending = new Map<string, string>();

  push(state: TerminalSessionState, chunk: TerminalOutputChunk) {
    appendTerminalOutput(state, chunk);
    if (chunk.lifecycle) return [terminalUpdateEvent(state)];
    this.pending.set(state.id, state.tail);
    return [] as RuntimeEvent[];
  }

  flush(state: TerminalSessionState) {
    if (!this.pending.has(state.id)) return [] as RuntimeEvent[];
    this.pending.delete(state.id);
    return [terminalUpdateEvent(state)];
  }
}

export type RealTerminalCommandInput = {
  id: string;
  command: string;
  cwd: string;
  rows?: number;
  cols?: number;
  signal?: AbortSignal;
};

export type RealTerminalCommandResult = {
  state: TerminalSessionState;
  exitCode: number;
  events: RuntimeEvent[];
};

export type PersistentTerminalSessionInfo = {
  id: string;
  command: string;
  cwd: string;
  status: TerminalStatus;
  pid?: number;
  rows: number;
  cols: number;
  attached: boolean;
  transcriptPath: string;
};

export type TerminalSessionInfo = {
  id: string;
  command: string;
  cwd: string;
  status: TerminalStatus;
  attached: boolean;
  rows: number;
  cols: number;
  transcript: string;
  tail: string;
  startedAt: string;
  endedAt?: string;
  secretAudit: TerminalSecretAudit[];
  screen: TerminalScreenSnapshot;
  revision: number;
  lastOutputAt?: string;
  prompt?: string;
  activity: "waiting" | "running";
  viewers: import("@natalia/contracts").TerminalViewer[];
  inputOwner: import("@natalia/contracts").TerminalOwner;
  geometryOwner: import("@natalia/contracts").TerminalOwner;
};

export type TerminalSessionUpdate = Omit<
  TerminalSessionInfo,
  "screen" | "transcript"
> & {
  screen?: TerminalScreenSnapshot;
  transcript?: string;
};

export type TerminalObservation = {
  session: Omit<TerminalSessionInfo, "screen" | "transcript"> & {
    screen?: TerminalScreenSnapshot;
    transcript?: string;
  };
  afterRevision: number;
  changed: boolean;
  reason: "changed" | "timeout" | "exited";
  screenUpdate?: TerminalScreenUpdate;
  screenDelivery?: TerminalScreenDelivery;
  cursorX?: number;
  cursorY?: number;
  rows?: number;
  cols?: number;
  exited?: boolean;
};

export type TerminalSecretAudit = {
  at: string;
  action: "write" | "prompt_detected";
  summary: string;
  sha256?: string;
};

export class TerminalRegistry {
  private sessions = new Map<string, TerminalSessionRuntime>();
  private sequence = 0;
  private readonly watchdog?: ReturnType<typeof setInterval>;

  constructor(
    private readonly stateDir: string,
    private readonly options: {
      viewerTimeoutMs?: number;
      watchdogIntervalMs?: number;
      exitedSessionRetentionMs?: number;
      onViewerExpired?: (
        session: TerminalSessionInfo,
        viewerID: string,
      ) => void;
    } = {},
  ) {
    this.watchdog = setInterval(
      () => void this.expireStaleViewers(),
      options.watchdogIntervalMs ?? 5000,
    );
    this.watchdog.unref();
  }

  dispose() {
    if (this.watchdog) clearInterval(this.watchdog);
  }

  async start(input: {
    command: string;
    cwd: string;
    id?: string;
    rows?: number;
    cols?: number;
  }) {
    const id = input.id ?? `tty_${(++this.sequence).toString(36)}`;
    if (this.sessions.has(id))
      throw new Error(`interactive terminal already exists: ${id}`);
    await mkdir(this.stateDir, { recursive: true, mode: 0o700 });
    const outputPath = resolve(this.stateDir, `${id}.log`);
    await writeFile(outputPath, "", { mode: 0o600 });
    let markReady!: () => void;
    const ready = new Promise<void>((resolve) => {
      markReady = resolve;
    });
    let runtime!: TerminalSessionRuntime;
    const screenModel = new XtermTerminalEmulator(
      input.rows ?? 36,
      input.cols ?? 120,
      {
        onData: (data) => {
          if (!runtime?.process) return;
          void this.command(runtime, { action: "write", input: data }).catch(
            () => undefined,
          );
        },
      },
    );
    runtime = {
      id,
      command: input.command,
      cwd: input.cwd,
      status: "starting",
      attached: true,
      rows: input.rows ?? 36,
      cols: input.cols ?? 120,
      transcript: "",
      tail: "",
      startedAt: new Date().toISOString(),
      process: undefined as never,
      listeners: new Set(),
      outputPath,
      secretAudit: [],
      terminalControlTail: "",
      outputDecoder: new TextDecoder(),
      screenModel,
      revision: 0,
      activity: "running",
      ready,
      markReady,
      viewers: new Map(),
      screenHistory: new Map(),
      inputOwner: { type: "model" },
      geometryOwner: { type: "model" },
      commandQueue: Promise.resolve(),
      idempotentWrites: new Map(),
      sensitiveInputBuffer: "",
      sensitiveRedactions: [],
      pendingTranscript: [],
      persistQueue: Promise.resolve(),
      lastObservedText: "",
      lastObservedRevision: 0,
    };
    runtime.screenHistory.set(0, runtime.screenModel.snapshot());
    this.sessions.set(id, runtime);
    const process = Bun.spawn(
      [
        "python3",
        "-c",
        PYTHON_INTERACTIVE_TERMINAL_BRIDGE,
        runtime.command,
        String(runtime.rows),
        String(runtime.cols),
      ],
      {
        cwd: runtime.cwd,
        env: safeTerminalEnv(),
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    runtime.process = process;
    runtime.status = "running";
    void this.consume(runtime);
    void process.exited.then(async (exitCode) => {
      if (runtime.status !== "exited")
        runtime.status = exitCode === 0 ? "exited" : "failed";
      runtime.endedAt = new Date().toISOString();
      await this.persist(runtime);
      this.emit(runtime);
      this.scheduleRelease(runtime);
    });
    await Promise.race([
      ready,
      Bun.sleep(5000).then(() => {
        throw new Error(
          `interactive terminal bridge did not become ready: ${id}`,
        );
      }),
      process.exited.then((exitCode) => {
        throw new Error(
          `interactive terminal bridge exited before ready: ${id} (${exitCode})`,
        );
      }),
    ]);
    await this.persist(runtime);
    return publicTerminalSession(runtime);
  }

  list() {
    return [...this.sessions.values()].map((session) =>
      publicTerminalSession(session),
    );
  }

  runningCount(): number {
    return [...this.sessions.values()].filter(
      (session) =>
        session.status === "starting" || session.status === "running",
    ).length;
  }

  get(id: string) {
    const session = this.mustGet(id);
    return publicTerminalSession(session);
  }

  session(id: string): TerminalSessionRuntime {
    return this.mustGet(id);
  }

  markObserved(id: string, text: string, revision: number) {
    const session = this.mustGet(id);
    session.lastObservedText = text;
    session.lastObservedRevision = revision;
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
      ...publicTerminalSession(session),
      transcript,
      offset,
      nextOffset: offset + transcript.length,
      totalChars: session.transcript.length,
      truncated: offset + transcript.length < session.transcript.length,
    };
  }

  scrollback(
    id: string,
    input: { offsetFromBottom?: number; maxRows?: number } = {},
  ): TerminalScrollbackPage {
    const session = this.mustGet(id);
    return session.screenModel.scrollback(
      Math.max(0, input.offsetFromBottom ?? 0),
      Math.max(1, Math.min(input.maxRows ?? session.rows, 200)),
    );
  }

  subscribe(id: string, listener: (session: TerminalSessionUpdate) => void) {
    const session = this.mustGet(id);
    const subscription = { listener, screen: false };
    session.listeners.add(subscription);
    listener(publicTerminalSessionMetadata(session));
    return () => session.listeners.delete(subscription);
  }

  async observe(
    id: string,
    input: {
      afterRevision?: number;
      timeoutMs?: number;
      signal?: AbortSignal;
      differential?: boolean;
    } = {},
  ): Promise<TerminalObservation> {
    const session = this.mustGet(id);
    const afterRevision = Math.max(0, input.afterRevision ?? session.revision);
    const current = publicTerminalSessionUpdate(session, true);
    if (current.revision > afterRevision) {
      const observation = {
        session: current,
        afterRevision,
        changed: true,
        reason: "changed",
      } as TerminalObservation;
      return this.withScreenUpdate(session, observation, input.differential);
    }
    if (current.status === "exited" || current.status === "failed")
      return {
        session: current,
        afterRevision,
        changed: false,
        reason: "exited",
        cursorX: current.screen?.cursor?.col ?? 0,
        cursorY: current.screen?.cursor?.row ?? 0,
        rows: current.screen?.rows ?? session.rows,
        cols: current.screen?.cols ?? session.cols,
        exited: true,
      };

    const timeoutMs = Math.max(0, Math.min(input.timeoutMs ?? 30_000, 30_000));
    return await new Promise<TerminalObservation>((resolve, reject) => {
      let settled = false;
      const finish = (observation: TerminalObservation) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        session.listeners.delete(subscription);
        input.signal?.removeEventListener("abort", onAbort);
        resolve(observation);
      };
      const onUpdate = (next: TerminalSessionUpdate) => {
        const current = next.screen ? next : publicTerminalSession(session);
        if (next.revision > afterRevision)
          finish(
            this.withScreenUpdate(
              session,
              {
                session: current,
                afterRevision,
                changed: true,
                reason: "changed",
              },
              input.differential,
            ),
          );
        else if (next.status === "exited" || next.status === "failed")
          finish({
            session: current,
            afterRevision,
            changed: false,
            reason: "exited",
          });
      };
      const onAbort = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        session.listeners.delete(subscription);
        reject(
          input.signal?.reason ?? new DOMException("Aborted", "AbortError"),
        );
      };
      const timer = setTimeout(
        () =>
          finish({
            session: publicTerminalSessionUpdate(session, true),
            afterRevision,
            changed: false,
            reason: "timeout",
          }),
        timeoutMs,
      );
      const subscription = { listener: onUpdate, screen: true };
      session.listeners.add(subscription);
      input.signal?.addEventListener("abort", onAbort, { once: true });
      if (input.signal?.aborted) onAbort();
    });
  }

  async write(
    id: string,
    input: string,
    options: {
      submit?: boolean;
      sensitive?: boolean;
      idempotencyKey?: string;
    } = {},
  ) {
    const session = this.mustRunning(id);
    this.pruneStaleViewers(session);
    if (session.inputOwner.type !== "model")
      throw new Error(
        `terminal input is controlled by viewer: ${session.inputOwner.viewerID}`,
      );
    const text =
      options.submit === false
        ? input
        : `${input}${input.endsWith("\r") || input.endsWith("\n") ? "" : "\r"}`;
    return await this.idempotentWrite(
      session,
      options.idempotencyKey,
      `model:${options.submit !== false}:${options.sensitive === true}:${text}`,
      async () => {
        // The bridge disables terminal ECHO. Only sensitive input needs a pending
        // filter so a child such as `cat` cannot add the secret back to transcript.
        session.pendingTerminalEcho = options.sensitive ? text : undefined;
        this.markInputSubmitted(session);
        await this.command(session, { action: "write", input: text });
        if (options.sensitive) {
          const secret = input.replace(/[\r\n]+$/u, "");
          if (secret) {
            session.sensitiveRedactions.push(secret);
            if (session.sensitiveRedactions.length > 8)
              session.sensitiveRedactions.shift();
          }
          session.secretAudit.push({
            at: new Date().toISOString(),
            action: "write",
            summary: `redacted ${new TextEncoder().encode(input).byteLength} byte(s) of sensitive input`,
            sha256: createHash("sha256").update(input).digest("hex"),
          });
          appendInteractiveOutput(session, "[sensitive input redacted]\n");
        }
        return publicTerminalSession(session);
      },
    );
  }

  registerViewer(
    id: string,
    input: { viewerID: string; kind: "external" | "embedded" },
  ) {
    const session = this.mustGet(id);
    this.pruneStaleViewers(session);
    const now = new Date().toISOString();
    const existing = session.viewers.get(input.viewerID);
    session.viewers.set(input.viewerID, {
      id: input.viewerID,
      kind: input.kind,
      connectedAt: existing?.connectedAt ?? now,
      lastSeenAt: now,
    });
    session.revision++;
    this.emit(session);
    return publicTerminalSession(session);
  }

  heartbeatViewer(id: string, viewerID: string) {
    const session = this.mustGet(id);
    const viewer = this.mustViewer(session, viewerID);
    viewer.lastSeenAt = new Date().toISOString();
    this.pruneStaleViewers(session);
    return publicTerminalSession(session);
  }

  takeoverViewer(id: string, viewerID: string) {
    const session = this.mustRunning(id);
    this.pruneStaleViewers(session);
    this.mustViewer(session, viewerID);
    if (
      session.inputOwner.type === "viewer" &&
      session.inputOwner.viewerID !== viewerID
    )
      throw new Error(
        `terminal input is already controlled by viewer: ${session.inputOwner.viewerID}`,
      );
    session.modelGeometry ??= { rows: session.rows, cols: session.cols };
    session.inputOwner = { type: "viewer", viewerID };
    session.geometryOwner = { type: "viewer", viewerID };
    session.revision++;
    this.emit(session);
    return publicTerminalSession(session);
  }

  takeGeometryViewer(id: string, viewerID: string) {
    const session = this.mustRunning(id);
    this.pruneStaleViewers(session);
    this.mustViewer(session, viewerID);
    if (
      session.geometryOwner.type === "viewer" &&
      session.geometryOwner.viewerID !== viewerID
    )
      throw new Error(
        `terminal geometry is already controlled by viewer: ${session.geometryOwner.viewerID}`,
      );
    session.modelGeometry ??= { rows: session.rows, cols: session.cols };
    session.geometryOwner = { type: "viewer", viewerID };
    session.revision++;
    this.emit(session);
    return publicTerminalSession(session);
  }

  releaseInputViewer(id: string, viewerID: string) {
    const session = this.mustGet(id);
    this.mustViewer(session, viewerID);
    if (
      session.inputOwner.type === "viewer" &&
      session.inputOwner.viewerID === viewerID
    )
      session.inputOwner = { type: "model" };
    session.revision++;
    this.emit(session);
    return publicTerminalSession(session);
  }

  async releaseViewer(id: string, viewerID: string) {
    const session = this.mustGet(id);
    this.mustViewer(session, viewerID);
    const restoreGeometry = this.restoreModelOwnership(session, viewerID);
    if (restoreGeometry) return await this.restoreModelGeometry(session);
    session.revision++;
    this.emit(session);
    return publicTerminalSession(session);
  }

  async unregisterViewer(id: string, viewerID: string) {
    const session = this.mustGet(id);
    if (!session.viewers.delete(viewerID))
      return publicTerminalSession(session);
    const restoreGeometry = this.restoreModelOwnership(session, viewerID);
    if (restoreGeometry) return await this.restoreModelGeometry(session);
    session.revision++;
    this.emit(session);
    return publicTerminalSession(session);
  }

  async viewerWrite(
    id: string,
    viewerID: string,
    input: string,
    options: { sensitive?: boolean; idempotencyKey?: string } = {},
  ) {
    const session = this.mustRunning(id);
    this.pruneStaleViewers(session);
    this.requireViewerOwner(session, viewerID, "input");
    return await this.idempotentWrite(
      session,
      options.idempotencyKey,
      `viewer:${viewerID}:${options.sensitive === true}:${input}`,
      async () => {
        if (options.sensitive) {
          session.pendingTerminalEcho = `${session.pendingTerminalEcho ?? ""}${input}`;
          session.sensitiveInputBuffer += input;
          if (/[\r\n]/u.test(input)) {
            const secret = session.sensitiveInputBuffer.replace(
              /[\r\n]+$/u,
              "",
            );
            session.sensitiveInputBuffer = "";
            if (secret) {
              session.sensitiveRedactions.push(secret);
              if (session.sensitiveRedactions.length > 8)
                session.sensitiveRedactions.shift();
              session.secretAudit.push({
                at: new Date().toISOString(),
                action: "write",
                summary: `redacted ${new TextEncoder().encode(secret).byteLength} byte(s) of sensitive viewer input`,
                sha256: createHash("sha256").update(secret).digest("hex"),
              });
              appendInteractiveOutput(
                session,
                "[sensitive user input redacted]\n",
              );
            }
          }
        }
        this.markInputSubmitted(session);
        await this.command(session, { action: "write", input });
        return publicTerminalSession(session);
      },
    );
  }

  async viewerResize(id: string, viewerID: string, rows: number, cols: number) {
    const session = this.mustRunning(id);
    this.pruneStaleViewers(session);
    this.requireViewerOwner(session, viewerID, "geometry");
    return await this.applyResize(session, rows, cols);
  }

  secretAudit(id: string) {
    return [...this.mustGet(id).secretAudit];
  }

  async specialKey(
    id: string,
    key: "enter" | "ctrl-c" | "ctrl-d" | "tab" | "esc",
  ) {
    const session = this.mustRunning(id);
    this.pruneStaleViewers(session);
    if (session.inputOwner.type !== "model")
      throw new Error(
        `terminal input is controlled by viewer: ${session.inputOwner.viewerID}`,
      );
    await this.command(session, { action: "key", key });
    return publicTerminalSession(session);
  }

  async resize(id: string, rows: number, cols: number) {
    const session = this.mustRunning(id);
    this.pruneStaleViewers(session);
    if (session.geometryOwner.type !== "model")
      throw new Error(
        `terminal geometry is controlled by viewer: ${session.geometryOwner.viewerID}`,
      );
    return await this.applyResize(session, rows, cols);
  }

  private async applyResize(
    session: TerminalSessionRuntime,
    rows: number,
    cols: number,
  ) {
    if (rows < 10 || rows > 200 || cols < 20 || cols > 400)
      throw new Error("terminal size must be rows 10-200 and cols 20-400");
    session.rows = rows;
    session.cols = cols;
    session.screenModel.resize(rows, cols);
    session.revision++;
    await this.command(session, { action: "resize", rows, cols });
    await this.persist(session);
    this.emit(session);
    return publicTerminalSession(session);
  }

  async attach(id: string) {
    const session = this.mustGet(id);
    session.attached = true;
    await this.persist(session);
    this.emit(session);
    return publicTerminalSession(session);
  }

  async detach(id: string) {
    const session = this.mustGet(id);
    session.attached = false;
    await this.persist(session);
    this.emit(session);
    return publicTerminalSession(session);
  }

  async stop(id: string) {
    const session = this.mustGet(id);
    if (session.status === "running" || session.status === "starting") {
      await this.command(session, { action: "stop" });
      session.process.kill("SIGTERM");
    }
    session.status = "exited";
    session.endedAt = new Date().toISOString();
    await this.flushPersist(session);
    this.emit(session);
    this.scheduleRelease(session);
    return publicTerminalSession(session);
  }

  private async consume(session: TerminalSessionRuntime) {
    if (!(session.process.stdout instanceof ReadableStream))
      throw new Error("interactive terminal stdout is not readable");
    const reader = session.process.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      buffer += decoder.decode(next.value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      if (lines.length) await this.processBridgeMessages(session, lines);
    }
    if (buffer) await this.processBridgeMessages(session, [buffer]);
  }

  private async processBridgeMessages(
    session: TerminalSessionRuntime,
    lines: string[],
  ) {
    const safeOutputs: string[] = [];
    let exit = false;
    for (const line of lines) {
      if (!line) continue;
      try {
        const message = JSON.parse(line) as { type: string; data?: string };
        if (message.type === "ready") session.markReady();
        else if (message.type === "exit") exit = true;
        else if (message.type === "output" && message.data) {
          const rawBytes = Buffer.from(message.data, "base64");
          const rawOutput = session.outputDecoder.decode(rawBytes, {
            stream: true,
          });
          safeOutputs.push(
            redactSensitiveOutput(
              session,
              stripPendingTerminalEcho(session, rawOutput),
            ),
          );
        }
      } catch {
        // Bridge diagnostics are deliberately not interpreted as terminal output.
      }
    }
    if (safeOutputs.length) {
      const combined = safeOutputs.join("");
      await session.screenModel.write(combined);
      session.revision += safeOutputs.length;
      session.lastOutputAt = new Date().toISOString();
      const sanitized = sanitizeInteractiveTerminalOutput(session, combined);
      if (sanitized) appendInteractiveOutput(session, sanitized);
      const prompt = detectPrompt(session.tail);
      session.prompt = prompt;
      session.activity = prompt ? "waiting" : "running";
      if (/password[: ]*$/iu.test(session.tail))
        session.secretAudit.push({
          at: new Date().toISOString(),
          action: "prompt_detected",
          summary: "password prompt detected in terminal tail",
        });
      this.schedulePersist(session);
      this.scheduleScreenEmit(session);
    }
    if (exit) {
      session.status = "exited";
      session.endedAt = new Date().toISOString();
      await this.flushPersist(session);
      this.flushScreenEmit(session);
      this.scheduleRelease(session);
    }
  }

  private async command(
    session: TerminalSessionRuntime,
    value: Record<string, unknown>,
  ) {
    const run = async () => {
      if (!session.process.stdin || typeof session.process.stdin === "number")
        throw new Error("interactive terminal stdin is not writable");
      session.process.stdin.write(`${JSON.stringify(value)}\n`);
      await session.process.stdin.flush();
    };
    session.commandQueue = session.commandQueue.then(run, run);
    await session.commandQueue;
  }

  private markInputSubmitted(session: TerminalSessionRuntime) {
    session.activity = "running";
    session.prompt = undefined;
  }

  private async idempotentWrite(
    session: TerminalSessionRuntime,
    idempotencyKey: string | undefined,
    fingerprint: string,
    write: () => Promise<TerminalSessionInfo>,
  ) {
    if (!idempotencyKey) return await write();
    const existing = session.idempotentWrites.get(idempotencyKey);
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new Error(
          "terminal idempotency key was reused for different input",
        );
      return await existing.result;
    }
    const result = write();
    session.idempotentWrites.set(idempotencyKey, { fingerprint, result });
    while (session.idempotentWrites.size > 64)
      session.idempotentWrites.delete(
        session.idempotentWrites.keys().next().value!,
      );
    try {
      return await result;
    } catch (cause) {
      session.idempotentWrites.delete(idempotencyKey);
      throw cause;
    }
  }

  private mustGet(id: string) {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`interactive terminal not found: ${id}`);
    return session;
  }

  private mustRunning(id: string) {
    const session = this.mustGet(id);
    if (session.status !== "running" && session.status !== "starting")
      throw new Error(`interactive terminal is not running: ${id}`);
    return session;
  }

  private mustViewer(session: TerminalSessionRuntime, viewerID: string) {
    const viewer = session.viewers.get(viewerID);
    if (!viewer) throw new Error(`terminal viewer not registered: ${viewerID}`);
    return viewer;
  }

  private requireViewerOwner(
    session: TerminalSessionRuntime,
    viewerID: string,
    owner: "input" | "geometry",
  ) {
    this.mustViewer(session, viewerID);
    const current =
      owner === "input" ? session.inputOwner : session.geometryOwner;
    if (current.type !== "viewer" || current.viewerID !== viewerID)
      throw new Error(`terminal ${owner} ownership required: ${viewerID}`);
  }

  private restoreModelOwnership(
    session: TerminalSessionRuntime,
    viewerID: string,
  ) {
    let restoreGeometry = false;
    if (
      session.inputOwner.type === "viewer" &&
      session.inputOwner.viewerID === viewerID
    )
      session.inputOwner = { type: "model" };
    if (
      session.geometryOwner.type === "viewer" &&
      session.geometryOwner.viewerID === viewerID
    ) {
      session.geometryOwner = { type: "model" };
      restoreGeometry = true;
    }
    return restoreGeometry;
  }

  private async restoreModelGeometry(session: TerminalSessionRuntime) {
    const geometry = session.modelGeometry;
    session.modelGeometry = undefined;
    if (
      !geometry ||
      (session.status !== "running" && session.status !== "starting")
    ) {
      session.revision++;
      this.emit(session);
      return publicTerminalSession(session);
    }
    return await this.applyResize(session, geometry.rows, geometry.cols);
  }

  private pruneStaleViewers(session: TerminalSessionRuntime) {
    const cutoff = Date.now() - (this.options.viewerTimeoutMs ?? 30_000);
    let emitNeeded = false;
    for (const [viewerID, viewer] of session.viewers) {
      if (Date.parse(viewer.lastSeenAt) >= cutoff) continue;
      session.viewers.delete(viewerID);
      const restoreGeometry = this.restoreModelOwnership(session, viewerID);
      if (restoreGeometry) void this.restoreModelGeometry(session);
      else emitNeeded = true;
    }
    if (!emitNeeded) return;
    session.revision++;
    this.emit(session);
  }

  private async expireStaleViewers() {
    const cutoff = Date.now() - (this.options.viewerTimeoutMs ?? 30_000);
    for (const session of this.sessions.values()) {
      for (const [viewerID, viewer] of [...session.viewers]) {
        if (Date.parse(viewer.lastSeenAt) >= cutoff) continue;
        session.viewers.delete(viewerID);
        const restore = this.restoreModelOwnership(session, viewerID);
        const current = restore
          ? await this.restoreModelGeometry(session)
          : publicTerminalSession(session);
        if (!restore) {
          session.revision++;
          this.emit(session);
        }
        this.options.onViewerExpired?.(current, viewerID);
      }
    }
  }

  private async persist(session: TerminalSessionRuntime) {
    session.persistQueue = session.persistQueue.then(async () => {
      const output = session.pendingTranscript.splice(0).join("");
      if (output) await appendFile(session.outputPath, output, { mode: 0o600 });
    });
    await session.persistQueue;
  }

  private schedulePersist(session: TerminalSessionRuntime) {
    if (session.persistTimer) return;
    session.persistTimer = setTimeout(() => {
      session.persistTimer = undefined;
      void this.persist(session);
    }, 200);
  }

  private async flushPersist(session: TerminalSessionRuntime) {
    if (session.persistTimer) clearTimeout(session.persistTimer);
    session.persistTimer = undefined;
    await this.persist(session);
  }

  private scheduleRelease(session: TerminalSessionRuntime) {
    if (session.releaseTimer) return;
    session.releaseTimer = setTimeout(
      () => {
        if (session.status === "running" || session.status === "starting")
          return;
        session.listeners.clear();
        session.screenHistory.clear();
        session.viewers.clear();
        if (session.persistTimer) clearTimeout(session.persistTimer);
        session.screenModel.dispose();
        this.sessions.delete(session.id);
      },
      this.options.exitedSessionRetentionMs ?? 5 * 60_000,
    );
    session.releaseTimer.unref();
  }

  private scheduleScreenEmit(session: TerminalSessionRuntime) {
    if (session.screenEmitTimer) return;
    session.screenEmitTimer = setTimeout(
      () => {
        session.screenEmitTimer = undefined;
        this.emit(session);
      },
      // Foreground viewers need low-latency input echo; hidden/model-only
      // sessions remain coalesced to avoid needless framebuffer projection.
      this.hasScreenSubscriber(session) ? 8 : 200,
    );
  }

  private flushScreenEmit(session: TerminalSessionRuntime) {
    if (session.screenEmitTimer) clearTimeout(session.screenEmitTimer);
    session.screenEmitTimer = undefined;
    this.emit(session);
  }

  private emit(session: TerminalSessionRuntime) {
    if (session.screenEmitTimer) clearTimeout(session.screenEmitTimer);
    session.screenEmitTimer = undefined;
    const includeScreen = this.hasScreenSubscriber(session);
    const snapshot = includeScreen ? screenSnapshot(session) : undefined;
    if (snapshot) this.recordScreen(session, snapshot);
    const metadata = publicTerminalSessionMetadata(session);
    const screen = includeScreen
      ? publicTerminalSessionUpdate(session, snapshot)
      : undefined;
    for (const subscription of session.listeners)
      subscription.listener(subscription.screen ? screen! : metadata);
  }

  private hasScreenSubscriber(session: TerminalSessionRuntime) {
    for (const subscription of session.listeners)
      if (subscription.screen) return true;
    return false;
  }

  private withScreenUpdate(
    session: TerminalSessionRuntime,
    observation: TerminalObservation,
    differential = false,
  ) {
    if (!differential || !observation.changed) return observation;
    const next = observation.session.screen;
    if (!next) throw new Error("terminal observation is missing framebuffer");
    const base = session.screenHistory.get(observation.afterRevision);
    const screenUpdate = base
      ? diffTerminalScreens({
          base,
          next,
          baseRevision: observation.afterRevision,
          revision: observation.session.revision,
        })
      : ({
          kind: "full",
          revision: observation.session.revision,
          screen: next,
        } as const);
    const fullBytes = terminalScreenSnapshotBytes(next);
    const screenDelivery: TerminalScreenDelivery = {
      mode: screenUpdate.kind,
      reason: !base
        ? "missing_base"
        : screenUpdate.kind === "patch"
          ? "differential"
          : base.rows !== next.rows ||
              base.cols !== next.cols ||
              base.buffer !== next.buffer
            ? "incompatible_frame"
            : "patch_not_smaller",
      payloadBytes:
        screenUpdate.kind === "patch"
          ? terminalScreenPatchBytes(screenUpdate.patch)
          : fullBytes,
      fullBytes,
    };
    return {
      ...observation,
      session:
        screenUpdate.kind === "patch"
          ? { ...observation.session, screen: undefined }
          : observation.session,
      screenUpdate,
      screenDelivery,
    };
  }

  private recordScreen(
    session: TerminalSessionRuntime,
    snapshot: TerminalScreenSnapshot,
  ) {
    session.screenHistory.set(session.revision, snapshot);
    // Two revisions cover normal observer handoff; older observers already
    // receive the protocol's full-frame fallback on revision mismatch.
    while (session.screenHistory.size > 2)
      session.screenHistory.delete(session.screenHistory.keys().next().value!);
  }
}

export class PersistentTerminalRegistry {
  private sessions = new Map<string, PersistentTerminalRuntime>();

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
      throw new Error(`terminal already exists: ${input.id}`);
    await mkdir(this.stateDir, { recursive: true, mode: 0o700 });
    const transcriptPath = resolve(this.stateDir, `${input.id}.log`);
    const result = await runRealTerminalCommand({
      id: input.id,
      command: input.command,
      cwd: input.cwd,
      rows: input.rows,
      cols: input.cols,
    });
    await writeFile(transcriptPath, result.state.transcript, { mode: 0o600 });
    const session: PersistentTerminalRuntime = {
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
    return publicPersistentTerminal(session);
  }

  async list() {
    await this.load();
    return [...this.sessions.values()].map((session) =>
      publicPersistentTerminal(refreshPersistentTerminal(session)),
    );
  }

  async attach(id: string) {
    const session = await this.mustGet(id);
    session.attached = true;
    await this.save();
    return publicPersistentTerminal(refreshPersistentTerminal(session));
  }

  async detach(id: string) {
    const session = await this.mustGet(id);
    session.attached = false;
    await this.save();
    return publicPersistentTerminal(refreshPersistentTerminal(session));
  }

  async resize(id: string, rows: number, cols: number) {
    const session = await this.mustGet(id);
    session.rows = rows;
    session.cols = cols;
    await this.save();
    return publicPersistentTerminal(refreshPersistentTerminal(session));
  }

  async transcript(id: string, maxBytes = 20000) {
    const session = await this.mustGet(id);
    try {
      const text = await readFileAsync(session.transcriptPath, "utf8");
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
    return publicPersistentTerminal(session);
  }

  private async mustGet(id: string) {
    await this.load();
    const session = this.sessions.get(id);
    if (!session) throw new Error(`unknown terminal session: ${id}`);
    return session;
  }

  private async load() {
    try {
      const parsed = JSON.parse(
        await readFileAsync(resolve(this.stateDir, "terminal.json"), "utf8"),
      ) as {
        sessions?: PersistentTerminalRuntime[];
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
      resolve(this.stateDir, "terminal.json"),
      `${JSON.stringify({ sessions: [...this.sessions.values()] }, null, 2)}\n`,
      { mode: 0o600 },
    );
  }
}

export async function runRealTerminalCommand(
  input: RealTerminalCommandInput,
): Promise<RealTerminalCommandResult> {
  const state = createTerminalSession({
    id: input.id,
    command: input.command,
    cwd: input.cwd,
    rows: input.rows,
    cols: input.cols,
    target: { kind: "host", cwd: input.cwd },
  });
  const process = Bun.spawn(
    ["python3", "-c", PYTHON_INTERACTIVE_TERMINAL_RUNNER, input.command],
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
  appendTerminalOutput(state, { text: `${stdout}${stderr}`, lifecycle: true });
  applyTerminalAction(state, "exit", {
    exitStatus: exitCode === 0 ? "exited" : "failed",
  });
  return {
    state,
    exitCode,
    events: [terminalUpdateEvent(state), terminalActionEvent(state, "exit")],
  };
}

const PYTHON_INTERACTIVE_TERMINAL_RUNNER = String.raw`
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

type PersistentTerminalRuntime = PersistentTerminalSessionInfo;

type TerminalSessionRuntime = Omit<
  TerminalSessionInfo,
  "screen" | "viewers"
> & {
  process: ReturnType<typeof Bun.spawn>;
  listeners: Set<{
    listener(session: TerminalSessionUpdate): void;
    screen: boolean;
  }>;
  outputPath: string;
  pendingTerminalEcho?: string;
  terminalControlTail: string;
  outputDecoder: TextDecoder;
  screenModel: XtermTerminalEmulator;
  viewers: Map<string, import("@natalia/contracts").TerminalViewer>;
  inputOwner: import("@natalia/contracts").TerminalOwner;
  geometryOwner: import("@natalia/contracts").TerminalOwner;
  modelGeometry?: { rows: number; cols: number };
  screenEmitTimer?: ReturnType<typeof setTimeout>;
  screenHistory: Map<number, TerminalScreenSnapshot>;
  screenCache?: { revision: number; snapshot: TerminalScreenSnapshot };
  commandQueue: Promise<void>;
  idempotentWrites: Map<
    string,
    { fingerprint: string; result: Promise<TerminalSessionInfo> }
  >;
  sensitiveInputBuffer: string;
  sensitiveRedactions: string[];
  pendingTranscript: string[];
  persistQueue: Promise<void>;
  persistTimer?: ReturnType<typeof setTimeout>;
  releaseTimer?: ReturnType<typeof setTimeout>;
  ready: Promise<void>;
  markReady(): void;
  lastObservedText: string;
  lastObservedRevision: number;
};

function appendInteractiveOutput(
  session: TerminalSessionRuntime,
  text: string,
) {
  const safe = sanitizeTerminalOutput(text);
  session.pendingTranscript.push(safe);
  session.transcript = `${session.transcript}${safe}`.slice(-262_144);
  session.tail = (session.tail + safe).slice(-4000);
}

function sanitizeInteractiveTerminalOutput(
  session: TerminalSessionRuntime,
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
  session: TerminalSessionRuntime,
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
  if (pending.startsWith(output)) {
    session.pendingTerminalEcho = pending.slice(output.length) || undefined;
    return "";
  }
  if (normalizedPending.startsWith(output)) {
    session.pendingTerminalEcho =
      normalizedPending.slice(output.length).replace(/\r\n/gu, "\n") ||
      undefined;
    return "";
  }
  return output;
}

function redactSensitiveOutput(
  session: TerminalSessionRuntime,
  output: string,
) {
  let redacted = output;
  for (const secret of session.sensitiveRedactions)
    if (secret) redacted = redacted.replaceAll(secret, "[redacted]");
  return redacted;
}

function safeTerminalEnv() {
  const allowed = [
    "PATH",
    "HOME",
    "TMPDIR",
    "LANG",
    "LC_ALL",
    "TERM",
    "SHELL",
    "USER",
    "LOGNAME",
    "XDG_RUNTIME_DIR",
    "DBUS_SESSION_BUS_ADDRESS",
    "SSH_AUTH_SOCK",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "REQUESTS_CA_BUNDLE",
    "CURL_CA_BUNDLE",
  ];
  return {
    ...Object.fromEntries(
      allowed
        .map((key) => [key, process.env[key]] as const)
        .filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
    ),
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
  };
}

function publicTerminalSessionMetadata(
  session: TerminalSessionRuntime,
): TerminalSessionUpdate {
  return {
    id: session.id,
    command: session.command,
    cwd: session.cwd,
    status: session.status,
    attached: session.attached,
    rows: session.rows,
    cols: session.cols,
    tail: session.tail,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    secretAudit: [...session.secretAudit],
    revision: session.revision,
    lastOutputAt: session.lastOutputAt,
    prompt: session.prompt,
    activity: session.activity,
    viewers: [...session.viewers.values()],
    inputOwner: session.inputOwner,
    geometryOwner: session.geometryOwner,
  };
}

function publicTerminalSessionUpdate(
  session: TerminalSessionRuntime,
  screen?: TerminalScreenSnapshot | true,
): TerminalSessionUpdate {
  return {
    ...publicTerminalSessionMetadata(session),
    screen: screen === true ? screenSnapshot(session) : screen,
  };
}

function publicTerminalSession(
  session: TerminalSessionRuntime,
): TerminalSessionInfo {
  return {
    ...publicTerminalSessionMetadata(session),
    transcript: session.transcript,
    screen: screenSnapshot(session),
  };
}

function screenSnapshot(session: TerminalSessionRuntime) {
  if (session.screenCache?.revision === session.revision)
    return session.screenCache.snapshot;
  const snapshot = session.screenModel.snapshot();
  session.screenCache = { revision: session.revision, snapshot };
  return snapshot;
}

const PYTHON_INTERACTIVE_TERMINAL_BRIDGE = String.raw`
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
    ["bash", "--noprofile", "--norc", "-c", command],
    stdin=slave,
    stdout=slave,
    stderr=slave,
    close_fds=True,
    preexec_fn=setup_session,
)
os.close(slave)
os.set_blocking(master, False)
control_fd = sys.stdin.fileno()
os.set_blocking(control_fd, False)
control_buffer = b""

def stop_child():
    if child.poll() is not None:
        return
    try:
        # The shell starts its own terminal session, so terminating only the
        # bridge leaves Kimi and its descendants orphaned.
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass

def on_shutdown(_signal, _frame):
    stop_child()
    sys.exit(0)

signal.signal(signal.SIGTERM, on_shutdown)
signal.signal(signal.SIGINT, on_shutdown)

def emit(kind, data=None):
    value = {"type": kind}
    if data is not None:
        value["data"] = base64.b64encode(data).decode("ascii")
    print(json.dumps(value), flush=True)

emit("ready")
while True:
    reads = [master]
    if control_fd is not None:
        reads.append(control_fd)
    readable, _, _ = select.select(reads, [], [], 0.05)
    if master in readable:
        try:
            data = os.read(master, 4096)
            if data:
                emit("output", data)
        except (BlockingIOError, OSError):
            pass
    if control_fd is not None and control_fd in readable:
        try:
            incoming = os.read(control_fd, 4096)
            if not incoming:
                # Parent shutdown closes stdin. Leaving an EOF fd in select()
                # makes it permanently readable and spins one CPU core.
                control_fd = None
                stop_child()
            else:
                control_buffer += incoming
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
                    stop_child()
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
try:
    sys.exit(child.wait(timeout=2))
except subprocess.TimeoutExpired:
    try:
        os.killpg(child.pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    sys.exit(child.wait())
`;

function refreshPersistentTerminal(session: PersistentTerminalRuntime) {
  if (session.status !== "running" || !session.pid) return session;
  try {
    process.kill(session.pid, 0);
  } catch {
    session.status = "exited";
  }
  return session;
}

function publicPersistentTerminal(
  session: PersistentTerminalRuntime,
): PersistentTerminalSessionInfo {
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
  if (/^PS\s+[A-Za-z]:\\.*>\s*$/u.test(last)) return last.slice(-80);
  if (/^>>>\s*$/u.test(last)) return last.slice(-80);
  if (/^In\s*\[\d+\]:\s*$/u.test(last)) return last.slice(-80);
  if (/^❯\s*$/u.test(last)) return last.slice(-80);
  if (/^➜\s*$/u.test(last)) return last.slice(-80);
  if (/--\s*(NORMAL|INSERT|VISUAL|VISUAL\s+BLOCK|REPLACE)\s*--$/u.test(last))
    return last.slice(-80);
  return undefined;
}

export type ModelTerminalAction = {
  action: TerminalAction;
  input?: string;
  rows?: number;
  cols?: number;
  sensitive?: boolean;
  requiresApproval?: boolean;
  reason?: string;
};

export type ModelTerminalActionResult =
  | { state: "executed"; events: RuntimeEvent[] }
  | { state: "awaiting_approval"; approvalID: string; events: RuntimeEvent[] }
  | { state: "rejected"; events: RuntimeEvent[] };

export class ModelTerminalRegistry {
  private sessions = new Map<string, TerminalSessionState>();
  private pending = new Map<
    string,
    { sessionID: string; request: ModelTerminalAction }
  >();
  private queues = new Map<string, Promise<void>>();

  create(input: Parameters<typeof createTerminalSession>[0]) {
    const existing = this.sessions.get(input.id);
    if (
      existing &&
      existing.status !== "exited" &&
      existing.status !== "failed"
    ) {
      return { session: existing, events: [] as RuntimeEvent[] };
    }
    const session = createTerminalSession(input);
    this.sessions.set(session.id, session);
    return {
      session,
      events: [
        terminalUpdateEvent(session),
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
    if (!session) throw new Error(`unknown terminal session: ${id}`);
    return session;
  }

  async request(
    id: string,
    request: ModelTerminalAction,
  ): Promise<ModelTerminalActionResult> {
    const session = this.get(id);
    if (session.ownership !== "model")
      throw new Error("terminal is not model-controlled");
    if (request.requiresApproval) {
      const approvalID = `apr_terminal_${id}_${this.pending.size + 1}`;
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
            request.reason ?? "model terminal action requested",
          ),
          { type: "terminal.update", ...session },
          {
            type: "terminal.approval",
            id,
            approvalID,
            state: "awaiting",
            action: request.action,
            reason: request.reason ?? "terminal action requires approval",
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
  ): Promise<ModelTerminalActionResult> {
    const pending = this.pending.get(approvalID);
    if (!pending) throw new Error(`unknown terminal approval: ${approvalID}`);
    this.pending.delete(approvalID);
    const session = this.get(pending.sessionID);
    session.approvalID = undefined;
    if (!approved) {
      session.status = "waiting";
      return {
        state: "rejected",
        events: [
          {
            type: "terminal.approval",
            id: session.id,
            approvalID,
            state: "rejected",
            action: pending.request.action,
            reason: "user rejected terminal action",
            target: session.target,
          },
          timeline(
            session,
            "system",
            "approval",
            "rejected",
            "user rejected terminal action",
          ),
          terminalUpdateEvent(session),
        ],
      };
    }
    const executed = await this.execute(session, pending.request);
    return {
      ...executed,
      events: [
        {
          type: "terminal.approval",
          id: session.id,
          approvalID,
          state: "approved",
          action: pending.request.action,
          reason: "user approved terminal action",
          target: session.target,
        },
        ...executed.events,
      ],
    };
  }

  private async execute(
    session: TerminalSessionState,
    request: ModelTerminalAction,
  ): Promise<ModelTerminalActionResult> {
    const prior = this.queues.get(session.id) ?? Promise.resolve();
    let events: RuntimeEvent[] = [];
    const next = prior.then(() => {
      applyTerminalAction(session, request.action, {
        rows: request.rows,
        cols: request.cols,
        sensitive: request.sensitive,
      });
      if (request.input) {
        appendTerminalOutput(session, {
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
        terminalActionEvent(
          session,
          request.action,
          Boolean(request.sensitive),
        ),
        terminalUpdateEvent(session),
      ];
    });
    this.queues.set(session.id, next);
    await next;
    return { state: "executed", events };
  }
}

function timeline(
  session: TerminalSessionState,
  actor: "model" | "user" | "system",
  action: "created" | "approval" | TerminalAction,
  status:
    | "requested"
    | "awaiting_approval"
    | "approved"
    | "executed"
    | "rejected",
  summary: string,
): RuntimeEvent {
  return {
    type: "terminal.timeline",
    id: session.id,
    actor,
    action,
    status,
    summary,
    at: new Date().toISOString(),
  };
}
