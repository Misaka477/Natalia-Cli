import { expect, test } from "bun:test";
import {
  activeModal,
  cancelPendingModals,
  enqueueApproval,
  enqueueQuestion,
  initialModalState,
  normalizeQuestionRequest,
  resolveApproval,
  resolveQuestion,
} from "@natalia/ui-model";
import { reduceState, initialState } from "../src/context/state";
import { hasUnsavedPromptChanges } from "../src/dialog/PromptDialog";

test("prompt dialog only asks before discarding changed input", () => {
  expect(hasUnsavedPromptChanges("", undefined)).toBe(false);
  expect(hasUnsavedPromptChanges("same", "same")).toBe(false);
  expect(hasUnsavedPromptChanges("edited", "same")).toBe(true);
});

test("state reducer opens session history and settings dialogs", () => {
  let state = structuredClone(initialState);
  state = reduceState(state, { type: "dialog.open", dialog: "sessions" });
  expect(state.dialog).toBe("sessions");
  state = reduceState(state, { type: "dialog.open", dialog: "settings" });
  expect(state.dialog).toBe("settings");
});

test("modal queue prioritizes approval while preserving stable request order", () => {
  const state = structuredClone(initialModalState);
  enqueueQuestion(state, {
    id: "q_first",
    title: "First question",
    questions: [question("q1", "First")],
  });
  enqueueApproval(state, {
    id: "apr_priority",
    title: "Approval",
    preview: "Needs approval",
  });
  enqueueQuestion(state, {
    id: "q_second",
    title: "Second question",
    questions: [question("q2", "Second")],
  });

  expect(activeModal(state)?.id).toBe("q_first");
  resolveQuestion(state, { requestID: "q_first", answers: [["ok"]] });
  expect(activeModal(state)?.id).toBe("apr_priority");
  resolveApproval(state, { requestID: "apr_priority", decision: "once" });
  expect(activeModal(state)?.id).toBe("q_second");
});

test("modal controller records approval reject feedback", () => {
  const state = structuredClone(initialModalState);
  enqueueApproval(state, {
    id: "apr_reject",
    title: "Approval",
    preview: "Needs approval",
  });
  resolveApproval(state, {
    requestID: "apr_reject",
    decision: "reject",
    feedback: "Use a safer path",
  });

  expect(state.resolved).toEqual([
    {
      requestID: "apr_reject",
      decision: "reject",
      feedback: "Use a safer path",
    },
  ]);
  expect(activeModal(state)).toBeUndefined();
});

test("normalizes legacy single-question request and supports multi question answers", () => {
  const normalized = normalizeQuestionRequest({
    id: "q_legacy",
    title: "Pick one",
    options: ["A", "B"],
  });
  expect(normalized.questions).toHaveLength(1);
  expect(normalized.questions[0].custom).toBe(true);
  expect(normalized.questions[0].options.map((option) => option.label)).toEqual(
    ["A", "B"],
  );

  const state = structuredClone(initialModalState);
  enqueueQuestion(state, {
    id: "q_multi",
    title: "Multi",
    questions: [
      question("one", "One"),
      { ...question("many", "Many"), multiple: true },
    ],
  });
  resolveQuestion(state, {
    requestID: "q_multi",
    answers: [["A"], ["X", "custom"]],
  });
  expect(state.resolved[0]).toEqual({
    requestID: "q_multi",
    answers: [["A"], ["X", "custom"]],
  });
});

test("cancel pending modals rejects active and queued requests", () => {
  const state = structuredClone(initialModalState);
  enqueueApproval(state, {
    id: "apr_cancel",
    title: "Approval",
    preview: "Needs approval",
  });
  enqueueQuestion(state, {
    id: "q_cancel",
    title: "Question",
    questions: [question("q", "Question")],
  });

  cancelPendingModals(state, "turn cancelled");
  expect(state.queue).toHaveLength(0);
  expect(state.resolved).toEqual([
    {
      requestID: "apr_cancel",
      decision: "reject",
      feedback: "turn cancelled",
    },
    {
      requestID: "q_cancel",
      answers: [],
      rejected: true,
    },
  ]);
});

test("state reducer keeps runtime events flowing while modal is active", () => {
  let state = structuredClone(initialState);
  state = reduceState(state, {
    type: "approval.request",
    id: "apr_state",
    title: "Approval",
    preview: "Needs approval",
  });
  state = reduceState(state, {
    type: "content.delta",
    id: "turn_modal",
    text: "runtime continues\n\n",
  });
  state = reduceState(state, {
    type: "approval.response",
    id: "apr_state",
    decision: "session",
  });

  expect(state.dialog).toBeUndefined();
  expect(
    state.messages.some((message) =>
      message.text.includes("runtime continues"),
    ),
  ).toBe(true);
  expect(
    state.messages.find((message) => message.id === "apr_state")?.status,
  ).toBe("session");
});

test("state reducer advances queued /modal requests after keyboard responses", () => {
  let state = structuredClone(initialState);
  state = reduceState(state, {
    type: "question.request",
    id: "q_modal_first",
    title: "Queued question",
    options: ["alpha", "beta"],
  });
  state = reduceState(state, {
    type: "approval.request",
    id: "apr_modal_priority",
    title: "Priority approval",
    preview: "Approval should not freeze focus.",
  });

  expect(state.dialog).toBe("question");
  state = reduceState(state, {
    type: "question.response",
    id: "q_modal_first",
    answers: [["alpha"]],
  });
  expect(state.dialog).toBe("approval");
  state = reduceState(state, {
    type: "approval.response",
    id: "apr_modal_priority",
    decision: "once",
  });
  expect(state.dialog).toBeUndefined();
});

function question(id: string, header: string) {
  return {
    id,
    header,
    question: header,
    options: [{ label: "A" }, { label: "B" }],
    custom: true,
  };
}
