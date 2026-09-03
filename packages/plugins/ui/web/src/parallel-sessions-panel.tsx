import { For, Show } from "solid-js";
import type { RuntimeSessionSummary } from "@natalia/contracts";

export function ParallelSessionsPanel(props: {
  sessions: RuntimeSessionSummary[];
  selectedSessionID?: string;
  onSelect: (id: string, name: string) => void;
}) {
  return (
    <div class="review-pane">
      <div class="review-section-label">并行会话</div>
      <Show when={props.sessions.length === 0}>
        <div class="agent-empty-full">
          <div class="review-empty-icon">🧵</div>
          <div class="review-empty-title">暂无会话</div>
        </div>
      </Show>
      <For each={props.sessions}>
        {(session) => {
          const status = session.status ?? (session.cancelled ? "error" : session.resumable ? "idle" : "running");
          return (
            <button
              type="button"
              class="agent-card"
              data-active={props.selectedSessionID === session.id}
              onClick={() => props.onSelect(session.id, session.title)}
            >
              <div class="agent-card-title">{session.title}</div>
              <div class="agent-card-status" data-active={status === "running"}>
                {status === "running" ? "运行中" : status === "idle" ? "空闲" : status === "error" ? "错误" : status}
              </div>
              <div class="agent-card-detail">
                {session.id} · {session.events} events
              </div>
            </button>
          );
        }}
      </For>
    </div>
  );
}
