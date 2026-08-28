import type {
  ChatModelProfile,
  RuntimeClient,
  RuntimeReasoningEffort,
  SubmitInput,
} from "@natalia/contracts";
import type { AppState } from "@natalia/view-store";

export const REASONING_OPTIONS: Array<RuntimeReasoningEffort | undefined> = [
  undefined,
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

export type SessionToast = { kind: "info" | "error"; text: string };

export type SessionController = {
  attachments(): string[];
  queueAttachment(path: string): string | undefined;
  removeAttachment(path: string): void;
  clearAttachments(): void;
  chatAttachments(): string[];
  queueChatAttachment(path: string): string | undefined;
  removeChatAttachment(path: string): void;
  chatExpert(): boolean;
  setChatExpert(on: boolean): void;
  chatProfile(): ChatModelProfile;
  setChatProfile(profile: ChatModelProfile): Promise<void>;
  submitMain(text: string): Promise<void>;
  stopMain(): void;
  submitChat(text: string): Promise<void>;
  stopChat(): Promise<void>;
  selectModel(modelID: string, variant?: string): Promise<void>;
  setReasoning(effort?: RuntimeReasoningEffort): Promise<void>;
  approve(
    requestID: string,
    decision: "once" | "session" | "reject",
    feedback?: string,
  ): Promise<void>;
  answerQuestion(
    requestID: string,
    answers: string[][],
    rejected?: boolean,
  ): Promise<void>;
  rollback(checkpointID: string, dryRun?: boolean): Promise<void>;
};

export function validateAttachmentPath(path: string): string | undefined {
  const trimmed = path.trim();
  if (!trimmed) return "attachment path is empty";
  if (trimmed.startsWith("/") || /^[a-zA-Z]:[\\/]/u.test(trimmed))
    return "attachment path must be workspace-relative";
  if (trimmed.split(/[\\/]/u).includes(".."))
    return "attachment path must not contain ..";
  return undefined;
}

export function createSessionController(
  runtime: RuntimeClient,
  getState: () => AppState,
  notify: (toast: SessionToast) => void = () => undefined,
): SessionController {
  const mainAttachments: string[] = [];
  const chatAttachmentPaths: string[] = [];
  let expert = false;
  let chatProfile: ChatModelProfile = {};

  const busy = () => Boolean(getState().activeTurn);
  const chatBusy = () => Boolean(getState().chatActivity);
  const pendingPrompt = () => {
    const state = getState();
    return (
      state.pendingApprovals.length > 0 || state.pendingQuestions.length > 0
    );
  };

  const queue = (list: string[], path: string) => {
    const error = validateAttachmentPath(path);
    if (error) return error;
    if (!list.includes(path)) list.push(path);
    return undefined;
  };

  return {
    attachments: () => [...mainAttachments],
    queueAttachment: (path) => queue(mainAttachments, path),
    removeAttachment: (path) => {
      const index = mainAttachments.indexOf(path);
      if (index >= 0) mainAttachments.splice(index, 1);
    },
    clearAttachments: () => {
      mainAttachments.length = 0;
    },
    chatAttachments: () => [...chatAttachmentPaths],
    queueChatAttachment: (path) => queue(chatAttachmentPaths, path),
    removeChatAttachment: (path) => {
      const index = chatAttachmentPaths.indexOf(path);
      if (index >= 0) chatAttachmentPaths.splice(index, 1);
    },
    chatExpert: () => expert,
    setChatExpert: (on) => {
      expert = on;
    },
    chatProfile: () => chatProfile,
    async setChatProfile(profile) {
      chatProfile = profile;
      await runtime.setChatModelProfile?.(profile);
    },
    async submitMain(text) {
      const body = text.trim();
      if (!body && mainAttachments.length === 0) return;
      if (pendingPrompt() && !isPauseResume(body)) {
        notify({
          kind: "info",
          text: "Answer the pending prompt above",
        });
        return;
      }
      if (busy() && runtime.submitInput) {
        const input: SubmitInput = {
          text: body,
          delivery: "steer",
          ...(mainAttachments.length
            ? { attachments: [...mainAttachments] }
            : {}),
        };
        mainAttachments.length = 0;
        await runtime.submitInput(input);
        return;
      }
      if (mainAttachments.length) {
        if (!runtime.submitInput) {
          notify({
            kind: "error",
            text: "This runtime transport does not support attachments",
          });
          return;
        }
        const attachments = [...mainAttachments];
        mainAttachments.length = 0;
        await runtime.submitInput({ text: body, attachments });
        return;
      }
      await runtime.submit(body);
    },
    stopMain() {
      if (!busy()) return;
      runtime.cancel();
    },
    async submitChat(text) {
      const body = text.trim();
      if (!body && chatAttachmentPaths.length === 0) return;
      if (!runtime.chatSubmit) {
        notify({ kind: "error", text: "chatSubmit is unavailable" });
        return;
      }
      const profile = expert ? chatProfile.expert : chatProfile.normal;
      const attachments = [...chatAttachmentPaths];
      chatAttachmentPaths.length = 0;
      await runtime.chatSubmit({
        text: body,
        ...(profile?.modelID
          ? { model: { modelID: profile.modelID, variant: profile.variant } }
          : {}),
        ...(profile?.reasoningEffort
          ? { reasoningEffort: profile.reasoningEffort }
          : {}),
        ...(attachments.length ? { attachments } : {}),
      });
      if (expert) expert = false;
    },
    async stopChat() {
      if (!chatBusy()) return;
      await runtime.chatAbort?.();
    },
    async selectModel(modelID, variant) {
      if (busy()) {
        notify({
          kind: "info",
          text: "Finish or stop queued work before changing the model",
        });
        return;
      }
      await runtime.selectModel?.(modelID, variant);
    },
    async setReasoning(effort) {
      if (busy()) {
        notify({
          kind: "info",
          text: "Finish or stop queued work before changing reasoning",
        });
        return;
      }
      await runtime.setReasoningEffort?.(effort);
    },
    async approve(requestID, decision, feedback) {
      const outcome = await runtime.respondApproval({
        requestID,
        decision,
        ...(feedback ? { feedback } : {}),
      });
      if (!outcome.accepted)
        notify({
          kind: "error",
          text: outcome.reason ?? "approval was not accepted",
        });
    },
    async answerQuestion(requestID, answers, rejected) {
      const outcome = await runtime.respondQuestion({
        requestID,
        answers,
        ...(rejected ? { rejected: true } : {}),
      });
      if (!outcome.accepted)
        notify({
          kind: "error",
          text: outcome.reason ?? "question was not accepted",
        });
    },
    async rollback(checkpointID, dryRun) {
      if (!runtime.checkpointRollback) {
        notify({ kind: "error", text: "checkpoint rollback is unavailable" });
        return;
      }
      await runtime.checkpointRollback({ id: checkpointID, dryRun });
    },
  };
}

function isPauseResume(text: string) {
  const command = text.trim().toLowerCase();
  return command === "/pause" || command === "/resume";
}
