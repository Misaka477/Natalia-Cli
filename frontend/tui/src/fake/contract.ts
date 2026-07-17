export type SessionID = `ses_${string}`;

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
  | { type: "thinking.delta"; id: string; text: string }
  | { type: "content.delta"; id: string; text: string }
  | {
      type: "tool.update";
      id: string;
      name: string;
      status: "queued" | "running" | "succeeded" | "failed";
      summary: string;
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
  | { type: "approval.request"; id: string; title: string; preview: string }
  | { type: "question.request"; id: string; title: string; options: string[] }
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
};
