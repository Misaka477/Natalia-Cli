/**
 * The interactive waiter: approvals and questions the runtime is waiting on.
 *
 * This is the runtime's only blocking conversation with a human, and it owns the
 * whole of it — the pending records, the waiters, the session-scoped grants and
 * the terminal approval scopes. What it takes from the runtime is deliberately
 * narrow: somewhere to publish events, the identity of the session, and a live
 * view of the three things that change underneath it.
 *
 * Those three are passed as functions rather than values because all of them
 * change during the client's life: a captured permission mode would keep asking
 * for approval after a switch to `auto`, and a captured abort signal would leave a
 * waiter listening to a turn that has already ended.
 *
 * Two rules here are load-bearing rather than incidental:
 *
 *   - **Session grants live in memory only.** Reopening a durable session must
 *     never silently restore permission to cause side effects, so granted tools
 *     and terminal scopes belong to this client instance and are never journaled.
 *   - **A timeout is not a cancellation.** Nobody answering is not the same as
 *     someone stopping the work: an expired approval tells the model the call did
 *     not run so the turn can continue, while an abort ends the turn.
 */
import type {
  ApprovalResponse,
  InteractiveResponseOutcome,
  QuestionResponse,
  RuntimeEvent,
  SessionID,
} from "@natalia/contracts";
import type { ProviderToolCall } from "@natalia/runtime";
import type { RuntimeTool } from "@natalia/tools";
import { projectInteractiveRequests } from "@natalia/session";
import { approvalEdge, approvalNode } from "./work-graph";
import { parseToolArguments, tryParseToolArguments } from "./tool-arguments";

export type InteractiveWaiterDeps = {
  publish: (event: RuntimeEvent) => void;
  sessionID: () => SessionID;
  permissionMode: () => "ask" | "auto" | "read_only";
  abortSignal: () => AbortSignal | undefined;
  activeTurnID: () => string | undefined;
  /**
   * Whether the runtime still considers this request open. Answered from the
   * journal rather than from the maps below, so a response arriving after a reopen
   * is judged against the durable record.
   */
  isPending: (
    sessionID: SessionID,
    id: string,
    kind: "approval" | "question",
  ) => boolean;
  /**
   * The session a turn belongs to. Parallel sessions make "the session" a
   * per-turn fact: a background turn keeps running after the UI attaches to
   * another session, and its approvals must be judged against the session it
   * was submitted to, never the currently attached one.
   */
  sessionIDForTurn: (turnID: string) => SessionID;
  /**
   * Publish into a specific session's exec (journal + stamp). Approval and
   * question events belong to the turn's session, not whichever session the UI
   * is attached to — a background turn's request must land in its own journal.
   */
  publishForSession: (sessionID: SessionID, event: RuntimeEvent) => void;
};

export type InteractiveWaiter = ReturnType<typeof createInteractiveWaiter>;

export function createInteractiveWaiter(deps: InteractiveWaiterDeps) {
  const { publish } = deps;
  const pendingApprovals = new Map<string, ApprovalResponse>();
  const pendingApprovalRequests = new Set<string>();
  // These grants only live in this RuntimeClient instance. Reopening a
  // durable session must never silently restore side-effecting permissions.
  // D5.3: they are keyed per session — what session A approved never grants
  // session B, and a background turn of A keeps its grants when the UI
  // attaches to B.
  const sessionApprovedTools = new Map<SessionID, Set<string>>();
  const approvalToolByID = new Map<string, string>();
  const approvalWorkGraphContext = new Map<
    string,
    { turnID: string; callID: string; toolName: string }
  >();
  const terminalApprovalByID = new Map<
    string,
    { scope: string; expiresAt: number }
  >();
  const terminalApprovalScopes = new Map<SessionID, Map<string, number>>();
  const approvalWaiters = new Map<
    string,
    (response: ApprovalResponse) => void
  >();
  const pendingQuestions = new Map<string, QuestionResponse>();
  const questionTurnByID = new Map<string, string>();
  const questionWaiters = new Map<
    string,
    (response: QuestionResponse) => void
  >();

  async function requireApproval(
    approvalID: string,
    tool: RuntimeTool,
    call: ProviderToolCall,
    turnID: string,
  ): Promise<{ reason: string } | undefined> {
    if (deps.permissionMode() === "auto") return undefined;
    if (deps.permissionMode() === "read_only")
      return { reason: readOnlyToolMessage(tool.name) };
    const session = deps.sessionIDForTurn(turnID);
    const terminalApproval = terminalApprovalScope(tool.name, call.arguments);
    if (terminalApproval) {
      if (terminalApproval.risk === "terminal_low") {
        const scopes = terminalApprovalScopes.get(session);
        const expiresAt = scopes?.get(terminalApproval.scope);
        if (expiresAt && expiresAt > Date.now()) return undefined;
        scopes?.delete(terminalApproval.scope);
      }
    } else if (sessionApprovedTools.get(session)?.has(tool.name))
      return undefined;
    const presentation = approvalPresentation(tool.name, call.arguments);
    const expiresAt =
      terminalApproval?.risk === "terminal_low"
        ? Date.now() + terminalApproval.ttlMs
        : undefined;
    // Establish every lookup before publishing. Event sinks are allowed to reply
    // synchronously; publishing first made an immediate `respondApproval()` look
    // like a response to a non-pending request and silently ignored it.
    pendingApprovalRequests.add(approvalID);
    approvalWorkGraphContext.set(approvalID, {
      turnID,
      callID: call.id,
      toolName: tool.name,
    });
    if (terminalApproval?.risk === "terminal_low" && expiresAt)
      terminalApprovalByID.set(approvalID, {
        scope: terminalApproval.scope,
        expiresAt,
      });
    else approvalToolByID.set(approvalID, tool.name);
    deps.publishForSession(session, {
      type: "approval.request",
      id: approvalID,
      title: `Approve ${tool.name}`,
      preview: presentation.preview,
      detail: presentation.detail,
      keyArguments: presentation.keyArguments,
      sensitive: presentation.sensitive,
      risk: terminalApproval?.risk,
      scope: terminalApproval?.scope,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      revocable: terminalApproval ? true : undefined,
    });
    try {
      const response = await waitForResponse(
        approvalID,
        pendingApprovals,
        approvalWaiters,
        deps.abortSignal(),
        `approval timed out: ${tool.name}`,
      );
      if (response.decision !== "reject") return undefined;
      deps.publishForSession(session, {
        type: "policy.decision",
        turnID,
        toolName: tool.name,
        toolCallID: call.id,
        decision: "rejected",
        reason: response.feedback,
      });
      return { reason: rejectedToolMessage(tool.name, response.feedback) };
    } catch (error) {
      // A cancellation is a deliberate stop and still ends the turn. A timeout
      // is not: nobody answered, and discarding the whole turn after a long
      // wait loses more work than telling the model the request expired.
      if (deps.abortSignal()?.aborted) throw error;
      deps.publishForSession(session, {
        type: "policy.decision",
        turnID,
        toolName: tool.name,
        toolCallID: call.id,
        decision: "rejected",
        reason: "approval expired without an answer",
      });
      return { reason: expiredToolMessage(tool.name) };
    } finally {
      pendingApprovalRequests.delete(approvalID);
      approvalToolByID.delete(approvalID);
      approvalWorkGraphContext.delete(approvalID);
      terminalApprovalByID.delete(approvalID);
    }
  }

  async function requireQuestion(
    requestID: string,
    turnID: string,
    request: {
      title: string;
      questions: Array<{
        id: string;
        header: string;
        question: string;
        options: Array<{ label: string; description?: string }>;
        multiple?: boolean;
        custom?: boolean;
      }>;
    },
  ) {
    questionTurnByID.set(requestID, turnID);
    deps.publishForSession(deps.sessionIDForTurn(turnID), {
      type: "question.request",
      id: requestID,
      ...request,
    });
    const response = await waitForResponse(
      requestID,
      pendingQuestions,
      questionWaiters,
      deps.abortSignal(),
      "question timed out",
    );
    if (response.rejected) throw new Error("user rejected question");
    return response.answers;
  }

  function restoreInteractiveState(events: RuntimeEvent[]) {
    const pending = projectInteractiveRequests(events);
    restoreRecoveredInteractiveState(pending.approvals, pending.questions);
  }

  function restoreRecoveredInteractiveState(
    approvals: Array<Extract<RuntimeEvent, { type: "approval.request" }>>,
    questions: Array<Extract<RuntimeEvent, { type: "question.request" }>>,
  ) {
    for (const request of approvals) {
      pendingApprovalRequests.add(request.id);
      publish({
        type: "diagnostic",
        level: "warning",
        message: `Recovered unresolved approval record ${request.id}; active tool execution was not replayed and must be resubmitted after a response.`,
      });
    }
    for (const request of questions)
      publish({
        type: "diagnostic",
        level: "warning",
        message: `Recovered unresolved question record ${request.id}; active tool execution was not replayed and must be resubmitted after an answer.`,
      });
  }

  /**
   * Answers an approval. Everything is published before the waiter is settled, so
   * a sink that replies synchronously cannot observe a half-resolved request.
   */
  function respondApproval(
    response: ApprovalResponse,
  ): InteractiveResponseOutcome {
    const respondGraph = approvalWorkGraphContext.get(response.requestID);
    const respondSession = respondGraph
      ? deps.sessionIDForTurn(respondGraph.turnID)
      : deps.sessionID();
    if (!deps.isPending(respondSession, response.requestID, "approval")) {
      publish({
        type: "diagnostic",
        level: "warning",
        message: "ignored approval response for a non-pending request",
      });
      // The waiter already knew this; the caller did not. An external UI has to
      // learn that its answer arrived too late, because "the model was told this
      // call did not run" is a different fact from "your answer took effect".
      return {
        accepted: false,
        reason: "the approval request is no longer pending",
      };
    }
    const graphContext = approvalWorkGraphContext.get(response.requestID);
    const responseSession = graphContext
      ? deps.sessionIDForTurn(graphContext.turnID)
      : deps.sessionID();
    deps.publishForSession(responseSession, {
      type: "approval.response",
      id: response.requestID,
      decision: response.decision,
      feedback: response.feedback,
    });
    // A resolved approval is a Work Graph fact: who authorized a side effect.
    // The decision is recorded; the preview text is not, because it can carry a
    // command line.
    deps.publishForSession(
      responseSession,
      approvalNode({
        approvalID: response.requestID,
        decision: response.decision,
        toolName:
          graphContext?.toolName ?? approvalToolByID.get(response.requestID),
        sessionID: responseSession,
        turnID: graphContext?.turnID,
      }),
    );
    if (graphContext)
      deps.publishForSession(
        responseSession,
        approvalEdge({
          approvalID: response.requestID,
          decision: response.decision,
          turnID: graphContext.turnID,
          callID: graphContext.callID,
        }),
      );
    if (response.decision === "session") {
      const terminalApproval = terminalApprovalByID.get(response.requestID);
      const session = deps.sessionIDForTurn(
        graphContext?.turnID ?? `approval:${deps.sessionID()}`,
      );
      if (terminalApproval) {
        const scopes =
          terminalApprovalScopes.get(session) ?? new Map<string, number>();
        scopes.set(terminalApproval.scope, terminalApproval.expiresAt);
        terminalApprovalScopes.set(session, scopes);
      } else {
        const toolName = approvalToolByID.get(response.requestID);
        if (toolName) {
          const approved = sessionApprovedTools.get(session) ?? new Set();
          approved.add(toolName);
          sessionApprovedTools.set(session, approved);
        }
      }
    }
    pendingApprovals.set(response.requestID, response);
    pendingApprovalRequests.delete(response.requestID);
    approvalWaiters.get(response.requestID)?.(response);
    return { accepted: true };
  }

  function respondQuestion(
    response: QuestionResponse,
  ): InteractiveResponseOutcome {
    const questionTurn = questionTurnByID.get(response.requestID);
    const questionSession = questionTurn
      ? deps.sessionIDForTurn(questionTurn)
      : deps.sessionID();
    if (!deps.isPending(questionSession, response.requestID, "question")) {
      publish({
        type: "diagnostic",
        level: "warning",
        message: "ignored question response for a non-pending request",
      });
      return {
        accepted: false,
        reason: "the question request is no longer pending",
      };
    }
    publish({
      type: "question.response",
      id: response.requestID,
      answers: response.answers,
      rejected: response.rejected,
    });
    pendingQuestions.set(response.requestID, response);
    questionTurnByID.delete(response.requestID);
    questionWaiters.get(response.requestID)?.(response);
    return { accepted: true };
  }

  /**
   * Drops a terminal's low-risk grant. Someone revoking it expects the model's
   * next keystroke to ask again, so it takes effect now rather than on expiry.
   * Revocation is a UI action, so it targets the currently attached session.
   */
  function revokeTerminalApprovalScope(terminalID: string) {
    const scope = `terminal:${terminalID}:low-risk`;
    const revoked =
      terminalApprovalScopes.get(deps.sessionID())?.delete(scope) === true;
    if (revoked)
      publish({
        type: "diagnostic",
        level: "info",
        message: `revoked terminal approval scope: ${scope}`,
      });
    return { id: terminalID, scope, revoked };
  }

  /** Whether anyone is still waiting on a human, which teardown has to know. */
  function hasPendingWaiters() {
    return approvalWaiters.size > 0 || questionWaiters.size > 0;
  }

  return {
    requireApproval,
    requireQuestion,
    respondApproval,
    respondQuestion,
    restoreInteractiveState,
    restoreRecoveredInteractiveState,
    revokeTerminalApprovalScope,
    hasPendingWaiters,
  };
}

function waitForResponse<T>(
  id: string,
  responses: Map<string, T>,
  waiters: Map<string, (response: T) => void>,
  signal: AbortSignal | undefined,
  timeoutMessage: string,
) {
  const existing = responses.get(id);
  if (existing) {
    responses.delete(id);
    return Promise.resolve(existing);
  }
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => finish(() => reject(new Error(timeoutMessage))),
      5 * 60_000,
    );
    const abort = () =>
      finish(() => reject(signal?.reason ?? new Error("request cancelled")));
    const finish = (settle: () => void) => {
      clearTimeout(timeout);
      waiters.delete(id);
      signal?.removeEventListener("abort", abort);
      settle();
    };
    waiters.set(id, (response) => {
      responses.delete(id);
      finish(() => resolve(response));
    });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }
    const raced = responses.get(id);
    if (raced) waiters.get(id)?.(raced);
  });
}

function approvalPresentation(toolName: string, rawArguments: string) {
  let args: Record<string, unknown> | undefined;
  try {
    const parsed = parseToolArguments(rawArguments);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      args = parsed as Record<string, unknown>;
  } catch {
    // Keep malformed raw arguments only in the explicit detail pane.
  }
  const keyArguments = [`tool=${toolName}`];
  const terminalID = typeof args?.id === "string" ? args.id : undefined;
  if (terminalID && toolName.startsWith("interactive_terminal_"))
    keyArguments.push(`terminal=${terminalID}`);
  const path = typeof args?.path === "string" ? args.path : undefined;
  if (path) keyArguments.push(`path=${path}`);
  const sensitive = Object.keys(args ?? {}).some((key) =>
    /api[_-]?key|token|secret|password|authorization|cookie/iu.test(key),
  );
  const content = typeof args?.content === "string" ? args.content : undefined;
  const command = typeof args?.command === "string" ? args.command : undefined;
  const preview =
    toolName === "write_file" && path
      ? [
          `Write ${path}`,
          content === undefined
            ? "Content: unavailable"
            : `Content: ${Array.from(content).length} chars${content.trim() ? ` · ${singleLine(content, 160)}` : ""}`,
        ].join("\n")
      : command
        ? `Run command: ${singleLine(command, 220)}`
        : path
          ? `${toolName}: ${path}`
          : `${toolName} requires approval`;
  return { preview, detail: rawArguments, keyArguments, sensitive };
}

export function terminalApprovalScope(toolName: string, rawArguments: string) {
  const args = tryParseToolArguments(rawArguments);
  const terminalID = typeof args.id === "string" ? args.id : undefined;
  if (!terminalID) return undefined;
  if (
    ![
      "interactive_terminal_write",
      "interactive_terminal_send_line",
      "interactive_terminal_keys",
    ].includes(toolName)
  )
    return undefined;
  const risk = terminalInputRisk(toolName, args);
  return {
    terminalID,
    risk,
    scope: `terminal:${terminalID}:${risk === "terminal_low" ? "low-risk" : "high-risk"}`,
    ttlMs: 30 * 60 * 1_000,
  } as const;
}

export function terminalInputRisk(
  toolName: string,
  args: Record<string, unknown>,
) {
  if (toolName === "interactive_terminal_keys") {
    const keys = Array.isArray(args.keys)
      ? args.keys
      : args.key === undefined
        ? []
        : [{ key: args.key, modifiers: args.modifiers }];
    return keys.every((value) => {
      if (!value || typeof value !== "object") return false;
      const key = value as Record<string, unknown>;
      const modifiers = Array.isArray(key.modifiers) ? key.modifiers : [];
      return (
        modifiers.length === 0 &&
        typeof key.key === "string" &&
        /^[\p{L}\p{N}\p{P}\p{S}\s]$/u.test(key.key)
      );
    })
      ? "terminal_low"
      : "terminal_high";
  }
  const input = typeof args.text === "string" ? args.text : args.input;
  if (typeof input !== "string") return "terminal_high";
  return /(?:\brm\b|\bsudo\b|\bcurl\b|\bwget\b|\bssh\b|\bscp\b|\b(?:git\s+push|npm\s+publish)\b|>|\bchmod\b|\bkill\b)/iu.test(
    input,
  )
    ? "terminal_high"
    : "terminal_low";
}

function singleLine(value: string, max: number) {
  const compact = value.replace(/\s+/gu, " ").trim();
  const chars = Array.from(compact);
  return chars.length > max ? `${chars.slice(0, max).join("")}...` : compact;
}

/**
 * The refusal a read-only session reports. Exported because the executor refuses
 * the same way before a call ever reaches an approval.
 */
export function readOnlyToolMessage(toolName: string) {
  return `tool denied by read-only permission mode: ${toolName}`;
}

/**
 * The refusal the model reads. The reason has to be actionable, because the
 * turn continues: repeating the same call would only be refused again.
 */
function rejectedToolMessage(toolName: string, feedback?: string) {
  const reason = feedback?.trim();
  return reason
    ? `tool "${toolName}" was rejected by the user: ${reason}. Do not retry the same call; take this into account and continue.`
    : `tool "${toolName}" was rejected by the user without a reason. Do not retry the same call; consider a different approach or ask what to do instead.`;
}

/**
 * An unanswered approval must never read as permission. The model is told the
 * call did not run so it can continue without it rather than assume success.
 */
function expiredToolMessage(toolName: string) {
  return `approval for tool "${toolName}" expired without an answer, so the call did not run. Do not assume it was allowed; continue without it or state what you need.`;
}
