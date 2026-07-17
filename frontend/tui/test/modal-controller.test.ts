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
} from "../src/modal/controller";
import { reduceState, initialState } from "../src/context/state";

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

function question(id: string, header: string) {
  return {
    id,
    header,
    question: header,
    options: [{ label: "A" }, { label: "B" }],
    custom: true,
  };
}
