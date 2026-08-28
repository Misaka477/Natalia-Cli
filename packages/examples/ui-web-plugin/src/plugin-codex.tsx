import { render } from "solid-js/web";
import { defineUiPlugin, type UiPlugin } from "@natalia/ui-host";
import { AppCodex } from "./app-codex";
import { EXAMPLE_WEB_UI_PANELS, EXAMPLE_WEB_UI_PLUGIN_ID } from "./identity";
import { nataliaCodexStyles } from "./styles-codex";

export function createNataliaCodexPlugin(): UiPlugin {
  let unmount: (() => void) | undefined;
  return defineUiPlugin({
    id: EXAMPLE_WEB_UI_PLUGIN_ID + "-codex",
    name: "Natalia Web UI (Codex Style)",
    version: "2.1.0",
    description: "Codex-inspired centered conversation UI with elegant design",
    events: ["runtime.*"],
    panels: EXAMPLE_WEB_UI_PANELS,
    mount(ctx) {
      ctx.root.replaceChildren();
      
      // Inject styles
      const style = document.createElement("style");
      style.textContent = nataliaCodexStyles;
      ctx.root.append(style);
      
      // Mount app
      const mountPoint = document.createElement("div");
      mountPoint.style.height = "100%";
      mountPoint.style.width = "100%";
      ctx.root.append(mountPoint);
      
      const disposeRender = render(() => <AppCodex ctx={ctx} />, mountPoint);
      
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

export default createNataliaCodexPlugin();
