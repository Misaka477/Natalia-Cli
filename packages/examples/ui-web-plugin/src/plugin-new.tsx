import { render } from "solid-js/web";
import { defineUiPlugin, type UiPlugin } from "@natalia/ui-host";
import { App } from "./app-new";
import { EXAMPLE_WEB_UI_PANELS, EXAMPLE_WEB_UI_PLUGIN_ID } from "./identity";
import { nataliaWebUiStyles } from "./styles-new";

export function createNataliaWebUiPlugin(): UiPlugin {
  let unmount: (() => void) | undefined;
  return defineUiPlugin({
    id: EXAMPLE_WEB_UI_PLUGIN_ID,
    name: "Natalia Web UI",
    version: "2.0.0",
    description: "Phase 1 Web UI with modern design system - Main, Chat, model settings.",
    events: ["runtime.*"],
    panels: EXAMPLE_WEB_UI_PANELS,
    mount(ctx) {
      ctx.root.replaceChildren();
      
      // Inject styles
      const style = document.createElement("style");
      style.textContent = nataliaWebUiStyles;
      ctx.root.append(style);
      
      // Mount app
      const mountPoint = document.createElement("div");
      mountPoint.style.height = "100%";
      mountPoint.style.width = "100%";
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

export default createNataliaWebUiPlugin();
