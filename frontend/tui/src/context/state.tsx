import { createContext, onMount, useContext, type JSX } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { RuntimeEvent, SessionID, SubmittedTurn } from "../fake/contract";

export type MessageBlock = {
  id: string;
  role:
    | "system"
    | "user"
    | "thinking"
    | "assistant"
    | "tool"
    | "approval"
    | "question"
    | "snapshot";
  text: string;
  status?: string;
};

export type AppState = {
  sessionID?: SessionID;
  title: string;
  status: string;
  footer: string;
  statusSegments: string[];
  messages: MessageBlock[];
  activeTurn?: string;
  lastSubmission?: SubmittedTurn;
  dialog?: "palette" | "approval" | "question";
};

export const initialState: AppState = {
  title: "Natalia M5 TUI Shell",
  status: "booting",
  footer: "TypeScript/Bun + Solid/OpenTUI fake backend",
  statusSegments: ["mode:fixture", "model:gpt-5.5", "provider:fake"],
  messages: [
    {
      id: "welcome",
      role: "system",
      text: "M5 shell: legacy Go fallback frozen; fake backend only; runtime rebuild waits for M8.",
    },
  ],
};

export function reduceState(state: AppState, event: RuntimeEvent): AppState {
  const next = structuredClone(state) as AppState;
  applyEvent(next, event);
  return next;
}

export function StateProvider(props: {
  children: JSX.Element;
  onReady?: (dispatch: (event: RuntimeEvent) => void) => void;
}) {
  const [state, setState] = createStore<AppState>(initialState);
  const dispatch = (event: RuntimeEvent) =>
    setState(produce((draft) => applyEvent(draft, event)));
  onMount(() => props.onReady?.(dispatch));
  return (
    <StateContext.Provider value={{ state, dispatch }}>
      {props.children}
    </StateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(StateContext);
  if (!context) throw new Error("StateProvider missing");
  return context;
}

function applyEvent(state: AppState, event: RuntimeEvent) {
  switch (event.type) {
    case "session.created":
      state.sessionID = event.sessionID;
      state.title = event.title;
      return;
    case "session.ready":
      state.status = "ready";
      return;
    case "status.update":
      state.status = event.status;
      state.footer = [event.status, event.detail].filter(Boolean).join(" - ");
      return;
    case "status.snapshot":
      state.statusSegments = [
        "mode:fixture",
        `model:${event.model}`,
        `provider:${event.provider}`,
        `ctx:${event.context}`,
        `step:${event.step}`,
        event.permissions,
        `bg:${event.background}`,
      ];
      return;
    case "diagnostic":
      upsertBlock(
        state,
        `diagnostic:${Date.now()}`,
        "system",
        `${event.level}: ${event.message}`,
      );
      state.footer = event.message;
      return;
    case "dialog.open":
      state.dialog = event.dialog;
      return;
    case "dialog.close":
      state.dialog = undefined;
      return;
    case "turn.submitted":
      state.activeTurn = event.id;
      state.lastSubmission = event;
      state.messages.push({
        id: `${event.id}:user`,
        role: "user",
        text: event.text,
      });
      return;
    case "thinking.delta":
      appendBlock(state, `${event.id}:thinking`, "thinking", event.text);
      return;
    case "content.delta":
      appendBlock(state, `${event.id}:assistant`, "assistant", event.text);
      return;
    case "tool.update":
      upsertBlock(
        state,
        `${event.id}:tool:${event.name}`,
        "tool",
        `[${event.status}] ${event.name}: ${event.summary}`,
        event.status,
      );
      return;
    case "approval.request":
      state.dialog = "approval";
      upsertBlock(
        state,
        event.id,
        "approval",
        `${event.title}: ${event.preview}`,
      );
      return;
    case "question.request":
      state.dialog = "question";
      upsertBlock(
        state,
        event.id,
        "question",
        `${event.title}: ${event.options.join(" / ")}`,
      );
      return;
    case "snapshot.created":
      upsertBlock(
        state,
        event.id,
        "snapshot",
        `snapshot ${event.id}: ${event.files.join(", ")}`,
      );
      return;
    case "turn.cancelled":
      upsertBlock(
        state,
        `${event.id}:cancelled`,
        "system",
        `cancelled: ${event.reason}`,
      );
      return;
    case "turn.finished":
      state.activeTurn = undefined;
      state.status = event.stopReason === "done" ? "ready" : event.stopReason;
      return;
  }
}

function appendBlock(
  state: AppState,
  id: string,
  role: MessageBlock["role"],
  text: string,
) {
  const block = state.messages.find((item) => item.id === id);
  if (block) {
    block.text += text;
    return;
  }
  state.messages.push({ id, role, text });
}

function upsertBlock(
  state: AppState,
  id: string,
  role: MessageBlock["role"],
  text: string,
  status?: string,
) {
  const block = state.messages.find((item) => item.id === id);
  if (block) {
    block.text = text;
    block.status = status;
    return;
  }
  state.messages.push({ id, role, text, status });
}

const StateContext = createContext<{
  state: AppState;
  dispatch: (event: RuntimeEvent) => void;
}>();
