import { createSignal, onCleanup, onMount } from "solid-js";
import { render } from "solid-js/web";
import {
  defineUiPlugin,
  type UiPlugin,
  type UiPluginContext,
} from "@natalia/ui-host";
import type { AppState } from "@natalia/view-store";
import { TodoPanel } from "./todo-panel";

function TodoPanelHost(props: { ctx: UiPluginContext }) {
  const [state, setState] = createSignal<AppState>(
    props.ctx.projection.getState(),
  );

  onMount(() => {
    const off = props.ctx.projection.subscribe(() =>
      setState(props.ctx.projection.getState()),
    );
    onCleanup(off);
  });

  return <TodoPanel state={state()} />;
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
