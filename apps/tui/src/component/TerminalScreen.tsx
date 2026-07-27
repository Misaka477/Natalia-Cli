import { For, Show } from "solid-js";
import type { TerminalScreenSnapshot } from "@natalia/contracts";
import { darkTheme } from "../theme/theme";
import { TerminalScreenRenderCache } from "./terminal-screen-model";

export function TerminalScreen(props: {
  screen?: TerminalScreenSnapshot;
  fallback?: string;
  maxRows?: number;
  onRenderModel?(at: number): void;
}) {
  const renderCache = new TerminalScreenRenderCache();
  const renderModel = () => {
    const model = renderCache.model(props.screen, props.maxRows);
    props.onRenderModel?.(performance.now());
    return model;
  };
  return (
    <box flexDirection="column" backgroundColor={darkTheme.background}>
      <Show
        when={props.screen}
        fallback={
          <text fg={darkTheme.muted} wrapMode="word">
            {props.fallback || "(waiting for terminal output)"}
          </text>
        }
      >
        {(screen) => (
          <For each={renderModel().rows}>
            {(row) => (
              <text wrapMode="none">
                <For each={row.runs}>
                  {(run) => <span style={run.style}>{run.text}</span>}
                </For>
              </text>
            )}
          </For>
        )}
      </Show>
    </box>
  );
}
