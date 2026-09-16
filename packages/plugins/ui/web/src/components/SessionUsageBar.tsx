import { Show, createMemo } from "solid-js";
import * as viewStore from "@natalia/view-store";
import type { AppState, SessionUsageView } from "@natalia/view-store";

function formatCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function formatMs(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

/**
 * Session token / latency dashboard bar (the data-interface consumer): renders
 * the per-session `deriveSessionUsageView` figures — steps, input/output/cache
 * tokens, cache hit rate, model/tool wall time, average first-token latency and
 * decode throughput. Session-scoped like the Work Graph: it reads the currently
 * active session's state, so switching sessions switches the figures. Cost is
 * intentionally absent (the user computes it).
 */
export function SessionUsageBar(props: { state: AppState }) {
  const view = createMemo<SessionUsageView | undefined>(() => {
    const stats = props.state.sessionUsage;
    if (stats.steps === 0) return undefined;
    return viewStore.deriveSessionUsageView(stats);
  });

  return (
    <Show when={view()}>
      {(current) => (
        <div class="session-usage-bar">
          <span class="session-usage-seg" title="Provider steps this session">
            {current().steps} 步
          </span>
          <span class="session-usage-sep">·</span>
          <span
            class="session-usage-seg"
            title={`Input ${current().inputTokens} · cache read ${current().cacheReadInputTokens} · cache write ${current().cacheCreationInputTokens}`}
          >
            In {formatCount(current().inputTokens)} · Out{" "}
            {formatCount(current().outputTokens)}
          </span>
          <span class="session-usage-sep">·</span>
          <span
            class="session-usage-seg"
            title={`Cache read ${current().cacheReadInputTokens} · write ${current().cacheCreationInputTokens}`}
          >
            Cache R {formatCount(current().cacheReadInputTokens)} · W{" "}
            {formatCount(current().cacheCreationInputTokens)}
          </span>
          <span class="session-usage-sep">·</span>
          <span class="session-usage-seg" title="Cache read / total input">
            命中 {(current().cacheHitRate * 100).toFixed(1)}%
          </span>
          <span class="session-usage-sep">·</span>
          <span class="session-usage-seg" title="Model / tool wall time">
            LLM {formatMs(current().llmMs)} · 工具 {formatMs(current().toolMs)}
          </span>
          <Show when={current().ttftSteps > 0}>
            <span class="session-usage-sep">·</span>
            <span class="session-usage-seg" title="Average first-token latency">
              首 token {formatMs(current().avgTtftMs)}
            </span>
          </Show>
          <Show when={current().tokensPerSecond > 0}>
            <span class="session-usage-sep">·</span>
            <span class="session-usage-seg" title="Decode throughput">
              {current().tokensPerSecond.toFixed(0)} tok/s
            </span>
          </Show>
        </div>
      )}
    </Show>
  );
}
