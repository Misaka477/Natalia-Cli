import { expect, test } from "bun:test";
import type {
  ApprovalResponse,
  ChatModelProfile,
  QuestionResponse,
  RuntimeClient,
  SubmitInput,
} from "@natalia/contracts";
import { initialState, type AppState } from "@natalia/view-store";
import {
  createSessionController,
  validateAttachmentPath,
} from "../src/session";

function runtimeSpy() {
  const calls: Array<{ method: string; args: unknown }> = [];
  const runtime = {
    start() {},
    async submit(text: string) {
      calls.push({ method: "submit", args: text });
      return {
        type: "turn.submitted",
        id: "t1",
        text,
        byteLength: text.length,
        lineCount: 1,
        sha256: "x",
      };
    },
    async submitInput(input: SubmitInput) {
      calls.push({ method: "submitInput", args: input });
      return {
        type: "turn.submitted",
        id: "t2",
        text: input.text,
        byteLength: input.text.length,
        lineCount: 1,
        sha256: "x",
      };
    },
    cancel(reason?: string) {
      calls.push({ method: "cancel", args: reason });
    },
    async chatSubmit(input: {
      text: string;
      model?: { modelID?: string; variant?: string };
      reasoningEffort?: string;
      attachments?: string[];
    }) {
      calls.push({ method: "chatSubmit", args: input });
      return { messageID: "c1" };
    },
    async chatAbort() {
      calls.push({ method: "chatAbort", args: undefined });
      return { aborted: true };
    },
    async selectModel(modelID?: string, variant?: string) {
      calls.push({ method: "selectModel", args: { modelID, variant } });
    },
    async setReasoningEffort(effort?: string) {
      calls.push({ method: "setReasoningEffort", args: effort });
    },
    async setChatModelProfile(profile: ChatModelProfile) {
      calls.push({ method: "setChatModelProfile", args: profile });
    },
    respondApproval(response: ApprovalResponse) {
      calls.push({ method: "respondApproval", args: response });
      return { accepted: true };
    },
    respondQuestion(response: QuestionResponse) {
      calls.push({ method: "respondQuestion", args: response });
      return { accepted: true };
    },
    async checkpointRollback(input: { id: string; dryRun?: boolean }) {
      calls.push({ method: "checkpointRollback", args: input });
      return {
        checkpointID: input.id,
        dryRun: Boolean(input.dryRun),
        changes: [],
        context: {
          truncateMessages: 0,
          targetJournalOffset: 0,
          targetStep: 0,
          targetTokens: 0,
          compactionGeneration: 0,
        },
        resources: [],
        ignoredFiles: 0,
        diskUsageBytes: 0,
        complete: true,
        warnings: [],
      };
    },
  } as unknown as RuntimeClient;
  return { runtime, calls };
}

test("attachment paths must stay workspace-relative", () => {
  expect(validateAttachmentPath("../secret")).toBeDefined();
  expect(validateAttachmentPath("/etc/passwd")).toBeDefined();
  expect(validateAttachmentPath("notes.md")).toBeUndefined();
});

test("idle Main submit uses submit; busy or attachments use submitInput", async () => {
  const spy = runtimeSpy();
  let state: AppState = initialState();
  const session = createSessionController(spy.runtime, () => state);
  await session.submitMain("hello");
  expect(spy.calls.at(-1)).toEqual({ method: "submit", args: "hello" });
  state = { ...state, activeTurn: "t1" };
  await session.submitMain("steer me");
  expect(spy.calls.at(-1)?.method).toBe("submitInput");
  expect(spy.calls.at(-1)?.args).toEqual({
    text: "steer me",
    delivery: "steer",
  });
  state = initialState();
  expect(session.queueAttachment("shot.png")).toBeUndefined();
  await session.submitMain("with file");
  expect(spy.calls.at(-1)?.args).toEqual({
    text: "with file",
    attachments: ["shot.png"],
  });
  expect(session.attachments()).toEqual([]);
});

test("pending approvals block Main submit except pause/resume", async () => {
  const spy = runtimeSpy();
  const toasts: string[] = [];
  const state: AppState = {
    ...initialState(),
    pendingApprovals: [
      {
        type: "approval.request",
        id: "apr_1",
        title: "Approve?",
        preview: "tool",
      },
    ],
  };
  const session = createSessionController(
    spy.runtime,
    () => state,
    (toast) => toasts.push(toast.text),
  );
  await session.submitMain("go");
  expect(spy.calls).toEqual([]);
  expect(toasts).toEqual(["Answer the pending prompt above"]);
  await session.submitMain("/pause");
  expect(spy.calls.at(-1)?.method).toBe("submit");
});

test("Stop only cancels an active Main turn; Chat stop uses chatAbort", async () => {
  const spy = runtimeSpy();
  let state: AppState = initialState();
  const session = createSessionController(spy.runtime, () => state);
  session.stopMain();
  expect(spy.calls).toEqual([]);
  state = { ...state, activeTurn: "t1" };
  session.stopMain();
  expect(spy.calls).toEqual([{ method: "cancel", args: undefined }]);
  state = {
    ...initialState(),
    chatActivity: {
      messageID: "m1",
      phase: "generating",
      startedAt: 1,
    },
  };
  await session.stopChat();
  expect(spy.calls.at(-1)?.method).toBe("chatAbort");
});

test("Chat expert is a per-send override and resets after submit", async () => {
  const spy = runtimeSpy();
  const session = createSessionController(spy.runtime, initialState);
  await session.setChatProfile({
    normal: { modelID: "gpt-5" },
    expert: { modelID: "opus", reasoningEffort: "high" },
  });
  session.setChatExpert(true);
  await session.submitChat("plan this");
  expect(spy.calls.at(-1)?.args).toEqual({
    text: "plan this",
    model: { modelID: "opus", variant: undefined },
    reasoningEffort: "high",
  });
  expect(session.chatExpert()).toBe(false);
});

test("model and reasoning changes are blocked while Main is busy", async () => {
  const spy = runtimeSpy();
  const toasts: string[] = [];
  const state: AppState = { ...initialState(), activeTurn: "t1" };
  const session = createSessionController(
    spy.runtime,
    () => state,
    (toast) => toasts.push(toast.text),
  );
  await session.selectModel("gpt-5");
  await session.setReasoning("high");
  expect(spy.calls).toEqual([]);
  expect(toasts).toHaveLength(2);
});

test("approvals, questions and rollback map onto RuntimeClient", async () => {
  const spy = runtimeSpy();
  const session = createSessionController(spy.runtime, initialState);
  await session.approve("apr_1", "once");
  await session.answerQuestion("q_1", [["继续"]]);
  await session.rollback("checkpoint_1");
  expect(spy.calls.map((call) => call.method)).toEqual([
    "respondApproval",
    "respondQuestion",
    "checkpointRollback",
  ]);
});
