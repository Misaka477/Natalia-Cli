import type {
  ExecutionTarget,
  PTYAction,
  PTYOwnership,
  PTYStatus,
  RuntimeEvent,
} from "@natalia/contracts";

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

export function redactSensitiveInput(input: string) {
  return input.replace(/./gu, "*");
}

export function sanitizeTerminalOutput(text: string) {
  return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/gu, "");
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
