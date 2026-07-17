export type ApprovalDecision = "once" | "session" | "reject";

export type ApprovalRequest = {
  id: string;
  title: string;
  preview: string;
  detail?: string;
  keyArguments?: string[];
  sensitive?: boolean;
};

export type ApprovalResponse = {
  requestID: string;
  decision: ApprovalDecision;
  feedback?: string;
};

export type QuestionOption = {
  label: string;
  description?: string;
};

export type QuestionItem = {
  id: string;
  header: string;
  question: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
};

export type QuestionRequest = {
  id: string;
  title: string;
  questions: QuestionItem[];
};

export type QuestionResponse = {
  requestID: string;
  answers: string[][];
  rejected?: boolean;
};

export type ModalRequest =
  | ({ kind: "approval"; priority: number; sequence: number } & ApprovalRequest)
  | ({
      kind: "question";
      priority: number;
      sequence: number;
    } & QuestionRequest);

export type ModalControllerState = {
  activeID?: string;
  queue: ModalRequest[];
  sequence: number;
  resolved: Array<ApprovalResponse | QuestionResponse>;
};

export const initialModalState: ModalControllerState = {
  queue: [],
  sequence: 0,
  resolved: [],
};

export function enqueueApproval(
  state: ModalControllerState,
  request: ApprovalRequest,
) {
  enqueue(state, { ...request, kind: "approval", priority: 10 });
}

export function enqueueQuestion(
  state: ModalControllerState,
  request: QuestionRequest,
) {
  enqueue(state, { ...request, kind: "question", priority: 20 });
}

export function activeModal(state: ModalControllerState) {
  return state.queue.find((request) => request.id === state.activeID);
}

export function resolveApproval(
  state: ModalControllerState,
  response: ApprovalResponse,
) {
  resolveModal(state, response.requestID, response);
}

export function resolveQuestion(
  state: ModalControllerState,
  response: QuestionResponse,
) {
  resolveModal(state, response.requestID, response);
}

export function cancelPendingModals(
  state: ModalControllerState,
  reason: string,
) {
  for (const request of state.queue) {
    if (request.kind === "approval") {
      state.resolved.push({
        requestID: request.id,
        decision: "reject",
        feedback: reason,
      });
      continue;
    }
    state.resolved.push({
      requestID: request.id,
      answers: [],
      rejected: true,
    });
  }
  state.queue = [];
  state.activeID = undefined;
}

export function normalizeQuestionRequest(input: {
  id: string;
  title: string;
  options?: string[];
  questions?: QuestionItem[];
}): QuestionRequest {
  if (input.questions?.length)
    return { id: input.id, title: input.title, questions: input.questions };
  return {
    id: input.id,
    title: input.title,
    questions: [
      {
        id: `${input.id}:q0`,
        header: input.title,
        question: input.title,
        options: (input.options ?? []).map((label) => ({ label })),
        custom: true,
      },
    ],
  };
}

function enqueue(
  state: ModalControllerState,
  request: Omit<ModalRequest, "sequence">,
) {
  state.sequence += 1;
  const next = { ...request, sequence: state.sequence } as ModalRequest;
  state.queue = [...state.queue, next].sort((left, right) => {
    const priority = left.priority - right.priority;
    if (priority !== 0) return priority;
    return left.sequence - right.sequence;
  });
  state.activeID = state.activeID ?? state.queue[0]?.id;
}

function resolveModal(
  state: ModalControllerState,
  requestID: string,
  response: ApprovalResponse | QuestionResponse,
) {
  state.queue = state.queue.filter((request) => request.id !== requestID);
  state.resolved.push(response);
  if (state.activeID !== requestID) return;
  state.activeID = state.queue[0]?.id;
}
