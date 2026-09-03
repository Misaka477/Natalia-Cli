import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";
import type { RuntimeClient, RuntimeSessionSummary } from "@natalia/contracts";

export function ParallelSessionsPanel(props: {
  sessions: RuntimeSessionSummary[];
  selectedSessionID?: string;
  runtime?: RuntimeClient;
  onSelect: (id: string, name: string) => void;
}) {
  const [liveStatuses, setLiveStatuses] = createSignal<Record<string, string>>({});
  let disposed = false;

  createEffect(() => {
    const running = props.sessions.filter(
      (session) => (session.status ?? "running") === "running",
    );
    let cancelled = false;
    const timer = setInterval(() => {
      if (disposed || cancelled) return;
      for (const session of running) {
        void props.runtime?.runtimeStatus?.(session.id).then((status) => {
          if (disposed || cancelled) return;
          setLiveStatuses((current) => ({
            ...current,
            [session.id]: status?.agentStatus ?? "running",
          }));
        }).catch(() => undefined);
      }
    }, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  });

  onCleanup(() => {
    disposed = true;
  });

  function statusOf(session: RuntimeSessionSummary) {
    if (session.pendingHumanTerminal) return "waiting_human";
    const base = session.status ?? (session.cancelled ? "error" : session.resumable ? "idle" : "running");
    return liveStatuses()[session.id] ?? base;
  }

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
          const status = statusOf(session);
          return (
            <button
              type="button"
              class="agent-card"
              data-active={props.selectedSessionID === session.id}
              onClick={() => props.onSelect(session.id, session.title)}
            >
              <div class="agent-card-title">{session.title}</div>
              <div class="agent-card-status" data-active={status === "running"}>
                {status === "running" ? "运行中" : status === "idle" ? "空闲" : status === "waiting_human" ? "等待人工" : status === "error" ? "错误" : status}
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
