import type {
  ExecutionTarget,
  TerminalAction,
  TerminalOwnership,
  TerminalStatus,
  RuntimeEvent,
  TerminalScreenSnapshot,
} from "@natalia/contracts";

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
