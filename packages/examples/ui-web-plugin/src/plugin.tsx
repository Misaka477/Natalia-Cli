import { render } from "solid-js/web";
import { defineUiPlugin, type UiPlugin } from "@natalia/ui-host";
import { App } from "./app";
import { EXAMPLE_WEB_UI_PANELS, EXAMPLE_WEB_UI_PLUGIN_ID } from "./identity";
import { exampleWebUiStyles } from "./styles";

export { EXAMPLE_WEB_UI_PLUGIN_ID };

export function createExampleWebUiPlugin(): UiPlugin {
  let unmount: (() => void) | undefined;
  return defineUiPlugin({
    id: EXAMPLE_WEB_UI_PLUGIN_ID,
    name: "Example Web UI",
    version: "1.0.0",
    description: "Phase 1 Web UI: Main, Chat, model settings, approvals.",
    events: ["runtime.*"],
    panels: EXAMPLE_WEB_UI_PANELS,
    mount(ctx) {
      ctx.root.replaceChildren();
      const style = document.createElement("style");
      style.textContent = exampleWebUiStyles;
      ctx.root.append(style);
      const mountPoint = document.createElement("div");
      mountPoint.style.height = "100%";
      ctx.root.append(mountPoint);
      const disposeRender = render(() => <App ctx={ctx} />, mountPoint);
      unmount = () => {
        disposeRender();
        ctx.root.replaceChildren();
        unmount = undefined;
      };
      return { dispose: () => unmount?.() };
    },
    unmount() {
      unmount?.();
    },
  });
}

export default createExampleWebUiPlugin();
