import { createSignal, onCleanup, onMount } from "solid-js";
import { render } from "solid-js/web";
import {
  defineUiPlugin,
  type UiPlugin,
  type UiPluginContext,
} from "@natalia/ui-host";
import type { AppState } from "@natalia/view-store";
import { TodoPanel } from "./todo-panel";

type TodoItem = {
  content: string;
  status: "pending" | "in_progress" | "completed";
};

function TodoPanelHost(props: { ctx: UiPluginContext }) {
  const [state, setState] = createSignal<AppState>(
    props.ctx.projection.getState(),
  );
  const [todos, setTodos] = createSignal<TodoItem[]>([]);
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;

  async function loadTodos() {
    const sessionID = props.ctx.projection.getState().sessionID;
    if (!sessionID) return;
    try {
      const result = await props.ctx.runtime.workspaceRead?.({
        path: `.natalia/todos/${encodeURIComponent(sessionID)}.json`,
      });
      const parsed = JSON.parse(result?.content ?? "[]") as unknown;
      if (!Array.isArray(parsed)) return;
      setTodos(
        parsed.filter(
          (item): item is TodoItem =>
            Boolean(item) &&
            typeof item === "object" &&
            typeof (item as { content?: unknown }).content === "string" &&
            ["pending", "in_progress", "completed"].includes(
              String((item as { status?: unknown }).status),
            ),
        ),
      );
    } catch {
      // No durable todo file yet.
    }
  }

  onMount(() => {
    void loadTodos();
    const off = props.ctx.projection.subscribe(() => {
      setState(props.ctx.projection.getState());
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void loadTodos(), 200);
    });
    onCleanup(() => {
      off();
      if (refreshTimer) clearTimeout(refreshTimer);
    });
  });

  return <TodoPanel state={state()} todos={todos()} />;
}

export function createTodoUiPlugin(): UiPlugin {
  return defineUiPlugin({
    id: "natalia.ui.todo",
    name: "Todo UI",
    version: "1.0.0",
    description: "Todo panel.",
    panels: [
      {
        id: "todo",
        title: "待办",
        region: "side",
        mount(ctx, container) {
          container.replaceChildren();
          const dispose = render(() => <TodoPanelHost ctx={ctx} />, container);
          return () => dispose();
        },
      },
    ],
    mount() {
      return undefined;
    },
  });
}
