import type {
  ApprovalResponse,
  QuestionResponse,
  RuntimeClient,
  RuntimeEvent,
  SessionID,
  SubmittedTurn,
} from "@natalia/contracts";

/**
 * Browser-safe fixture runtime for the Phase 0 web host.
 *
 * The shell owns runtime construction. Swap this for a real worker/RPC client
 * later without touching `@natalia/ui-host` or the UI plugin.
 */
export function createWebFixtureRuntime(): RuntimeClient {
  const sessionID = "ses_web_host" as SessionID;
  let sink: ((event: RuntimeEvent) => void) | undefined;
  let turns = 0;
  let submission: SubmittedTurn | undefined;
  const publish = (event: RuntimeEvent) => sink?.(event);
  return {
    start(onEvent) {
      sink = onEvent;
      publish({
        type: "session.created",
        sessionID,
        title: "Web UI prototype",
      });
      publish({ type: "session.ready", sessionID });
      publish({
        type: "status.update",
        status: "ready",
        detail: "web fixture connected",
      });
    },
    async submit(text) {
      turns += 1;
      const id = `turn_${turns}`;
      const submissionEvent: SubmittedTurn = {
        type: "turn.submitted",
        id,
        text,
        byteLength: new TextEncoder().encode(text).byteLength,
        lineCount: text.split("\n").length,
        sha256: "web-fixture",
      };
      submission = submissionEvent;
      publish(submissionEvent);
      publish({ type: "content.done", id, text: `main echo: ${text}` });
      publish({ type: "turn.finished", id, stopReason: "done" });
      return submissionEvent;
    },
    async chatSubmit(input) {
      const messageID = `chat_${Date.now()}`;
      const at = new Date().toISOString();
      publish({
        type: "chat.message.added",
        id: messageID,
        messageID,
        role: "user",
        text: input.text,
        at,
      });
      publish({
        type: "chat.message.added",
        id: `${messageID}:reply`,
        messageID: `${messageID}:reply`,
        role: "chat",
        text: `chat echo: ${input.text}`,
        at,
      });
      return { messageID };
    },
    cancel() {},
    snapshot() {
      const event: RuntimeEvent = {
        type: "snapshot.created",
        id: `snap_${Date.now().toString(36)}`,
        files: [],
      };
      publish(event);
      return event;
    },
    diagnostic(message, level = "warning") {
      publish({ type: "diagnostic", level, message });
    },
    lastSubmission() {
      return submission;
    },
    respondApproval(response: ApprovalResponse) {
      publish({
        type: "approval.response",
        id: response.requestID,
        decision: response.decision,
        feedback: response.feedback,
      });
      return { accepted: true };
    },
    respondQuestion(response: QuestionResponse) {
      publish({
        type: "question.response",
        id: response.requestID,
        answers: response.answers,
        rejected: response.rejected,
      });
      return { accepted: true };
    },
  };
}
