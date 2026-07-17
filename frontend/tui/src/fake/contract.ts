import type {
  ApprovalResponse,
  QuestionItem,
  QuestionResponse,
} from "../modal/controller";
export type { ApprovalResponse, QuestionResponse } from "../modal/controller";

export type SessionID = `ses_${string}`;

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

export type FakeBackend = {
  start(onEvent: (event: RuntimeEvent) => void): void;
  submit(text: string): Promise<SubmittedTurn>;
  cancel(reason?: string): void;
  snapshot(): RuntimeEvent;
  diagnostic(message: string, level?: "info" | "warning" | "error"): void;
  lastSubmission(): SubmittedTurn | undefined;
  respondApproval(response: ApprovalResponse): void;
  respondQuestion(response: QuestionResponse): void;
};
