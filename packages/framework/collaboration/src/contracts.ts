import type {
  ApprovalResponse,
  InteractiveResponseOutcome,
  QuestionResponse,
  RuntimeEvent,
  SessionID,
} from "@natalia/contracts";
import type { ProviderToolCall } from "@natalia/runtime";
import type { RuntimeTool } from "@anthelia/tools";
import type { WorkLedgerController } from "@natalia/work-ledger";

/** Interactive waiter contracts, moved from runtime-services with the token. */

export interface InteractiveWaiter {
  requireApproval(
    approvalID: string,
    tool: RuntimeTool,
    call: ProviderToolCall,
    turnID: string,
    options?: { force?: boolean; reason?: string },
  ): Promise<{ reason: string } | undefined>;
  requireQuestion(
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
  ): Promise<string[][]>;
  restoreInteractiveState(events: RuntimeEvent[]): void;
  restoreRecoveredInteractiveState(
    approvals: Array<Extract<RuntimeEvent, { type: "approval.request" }>>,
    questions: Array<Extract<RuntimeEvent, { type: "question.request" }>>,
    interactives?: Array<
      Extract<RuntimeEvent, { type: "interactive.request" }>
    >,
  ): void;
  respondApproval(response: ApprovalResponse): InteractiveResponseOutcome;
  respondQuestion(response: QuestionResponse): InteractiveResponseOutcome;
  /**
   * Issues a generic interactive request and waits for its response. The
   * `validate` callback is the in-process business authority; the runtime only
   * checks the envelope, and the returned promise carries the raw response.
   */
  requireInteractive(input: {
    requestID: string;
    turnID: string;
    kind: string;
    title: string;
    payload: import("@natalia/contracts").JsonValue;
    responseSchema?: import("@natalia/contracts").JsonSchema;
    expiresAt?: string;
    priority?: number;
    validate?(
      response: import("@natalia/contracts").JsonValue,
    ): string[] | void;
  }): Promise<{
    response: import("@natalia/contracts").JsonValue;
    rejected?: boolean;
  }>;
  respondInteractive(
    response: import("@natalia/contracts").InteractiveResponse,
  ): InteractiveResponseOutcome;
  revokeTerminalApprovalScope(terminalID: string): {
    id: string;
    scope: string;
    revoked: boolean;
  };
  hasPendingWaiters(): boolean;
  requirePlanAcceptance(input: {
    approvalID: string;
    planID: string;
    title: string;
    detail: string;
    preview?: string;
    scope?: string;
    sessionID?: SessionID;
    permissionMode?: "ask" | "auto" | "read_only";
    signal?: AbortSignal;
    permissionFamily?: import("@natalia/contracts").PermissionFamily;
    /**
     * EI §3.7.1/3.7.2: a rule-class/user-safety change is confirmed per item —
     * the gate is never auto-granted in `auto` mode and never session-approved.
     */
    requireExplicit?: boolean;
  }): Promise<ApprovalResponse | undefined>;
}

export type InteractiveWaiterDeps = {
  publish(event: RuntimeEvent): void;
  sessionID(): SessionID;
  permissionMode(turnID?: string): "ask" | "auto" | "read_only";
  abortSignal(turnID: string): AbortSignal | undefined;
  activeTurnID(): string | undefined;
  isPending(sessionID: SessionID, id: string, kind: string): boolean;
  sessionIDForTurn(turnID: string): SessionID;
  agentIDForTurn?(turnID: string): string | undefined;
  publishForSession(sessionID: SessionID, event: RuntimeEvent): void;
  capabilityOwnerForTool?(toolName: string): string | undefined;
  workLedger(): WorkLedgerController;
};
