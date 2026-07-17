import type {
  ApprovalResponse,
  QuestionItem,
  QuestionResponse,
} from "@natalia/ui-model";
export type { ApprovalResponse, QuestionResponse } from "@natalia/ui-model";

export type SessionID = `ses_${string}`;

export type ErrorKind =
  | "timeout"
  | "connection"
  | "rate_limit"
  | "server"
  | "auth"
  | "invalid_request"
  | "empty_response"
  | "context_limit"
  | "cancel";

export type StepRetryOperation = "llm_step" | "compaction" | "metadata_probe";

export type ToolStatus =
  | "receiving_arguments"
  | "queued"
  | "awaiting_approval"
  | "running"
  | "succeeded"
  | "failed"
  | "rejected"
  | "cancelled";

export type RuntimeEvent =
  | { type: "session.created"; sessionID: SessionID; title: string }
  | { type: "session.ready"; sessionID: SessionID }
  | {
      type: "turn.submitted";
      id: string;
      text: string;
      byteLength: number;
      lineCount: number;
      sha256: string;
    }
  | { type: "turn.cancelled"; id: string; reason: string }
  | {
      type: "thinking.delta";
      id: string;
      text: string;
      visible?: boolean;
      attempt?: number;
    }
  | {
      type: "thinking.done";
      id: string;
      visible?: boolean;
      attempt?: number;
    }
  | { type: "content.delta"; id: string; text: string; attempt?: number }
  | { type: "content.done"; id: string; attempt?: number }
  | {
      type: "turn.retry";
      id: string;
      attempt: number;
      maxAttempts: number;
      reason: string;
      retryAfterMs: number;
    }
  | {
      type: "step.retry";
      id: string;
      operation: StepRetryOperation;
      step: number;
      attempt: number;
      maxAttempts: number;
      waitMs: number;
      reason: ErrorKind;
      statusCode?: number;
    }
  | {
      type: "step.retry.cleared";
      id: string;
      operation: StepRetryOperation;
      step: number;
      attempts: number;
    }
  | {
      type: "step.retry.exhausted";
      id: string;
      operation: StepRetryOperation;
      step: number;
      attempts: number;
      maxAttempts: number;
      reason: ErrorKind;
      statusCode?: number;
      message: string;
    }
  | {
      type: "tool.update";
      id: string;
      name: string;
      callID?: string;
      status: ToolStatus;
      summary: string;
      argumentsDelta?: string;
      result?: string;
      metadata?: Record<string, unknown>;
      startedAt?: number;
      endedAt?: number;
    }
  | { type: "status.update"; status: string; detail?: string }
  | {
      type: "status.snapshot";
      model: string;
      provider: string;
      context: string;
      step: string;
      permissions: string;
      cwd: string;
      background: string;
    }
  | { type: "diagnostic"; level: "info" | "warning" | "error"; message: string }
  | { type: "dialog.open"; dialog: "palette" | "approval" | "question" }
  | { type: "dialog.close" }
  | {
      type: "approval.request";
      id: string;
      title: string;
      preview: string;
      detail?: string;
      keyArguments?: string[];
      sensitive?: boolean;
    }
  | {
      type: "approval.response";
      id: string;
      decision: ApprovalResponse["decision"];
      feedback?: string;
    }
  | {
      type: "question.request";
      id: string;
      title: string;
      options?: string[];
      questions?: QuestionItem[];
    }
  | {
      type: "question.response";
      id: string;
      answers: string[][];
      rejected?: boolean;
    }
  | { type: "snapshot.created"; id: string; files: string[] }
  | {
      type: "turn.finished";
      id: string;
      stopReason: "done" | "cancelled" | "error";
    };

export type SubmittedTurn = Extract<RuntimeEvent, { type: "turn.submitted" }>;

export type RuntimeClient = {
  start(onEvent: (event: RuntimeEvent) => void): void;
  submit(text: string): Promise<SubmittedTurn>;
  cancel(reason?: string): void;
  snapshot(): RuntimeEvent;
  diagnostic(message: string, level?: "info" | "warning" | "error"): void;
  lastSubmission(): SubmittedTurn | undefined;
  respondApproval(response: ApprovalResponse): void;
  respondQuestion(response: QuestionResponse): void;
};

export type FakeBackend = RuntimeClient;
