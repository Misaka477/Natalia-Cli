import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import type {
  RuntimeClient,
  RuntimeTeamPR,
} from "@natalia/contracts";
import type { AppState, SubagentView } from "@natalia/view-store";
import { Transcript } from "./components/Transcript";
import type { Message } from "./types";

export function AgentPanel(props: {
  state: AppState;
  runtime?: RuntimeClient;
}) {
  const [subTab, setSubTab] = createSignal<"subagent" | "team">("subagent");
  const [selectedID, setSelectedID] = createSignal<string | undefined>(undefined);
  const [teamAvailable, setTeamAvailable] = createSignal(false);
  const [teamPRs, setTeamPRs] = createSignal<RuntimeTeamPR[]>([]);
  const [teamConcurrency, setTeamConcurrency] = createSignal<number | undefined>(undefined);

  onMount(() => {
    void (async () => {
      try {
        const plugins = (await props.runtime?.plugins?.()) ?? [];
        setTeamAvailable(
          plugins.some((plugin) => plugin.id?.includes("team") || plugin.name?.includes("Team")),
        );
      } catch {
        setTeamAvailable(false);
      }
      try {
        const prs = (await props.runtime?.teamPRList?.()) ?? [];
        setTeamPRs(prs);
      } catch {
        setTeamPRs([]);
      }
      try {
        const config = await props.runtime?.configGet?.();
        setTeamConcurrency(config?.team?.maxConcurrent);
      } catch {
        setTeamConcurrency(undefined);
      }
    })();
  });

  const subagents = createMemo(() =>
    Object.values(props.state.subagents ?? {}).sort((a, b) => {
      const at = a.lastActivityAt ?? 0;
      const bt = b.lastActivityAt ?? 0;
      return bt - at;
    }),
  );

  const selectedSubagent = createMemo(() =>
    subagents().find((item) => item.id === selectedID()),
  );

  const subagentMessages = createMemo<Message[]>(() => {
    const id = selectedID();
    if (!id) return [];
    const history = props.state.subagentHistory?.[id] ?? [];
    return history.map((event, index) => {
      const text = event.text || event.activityDetail || event.task || event.event;
      const status =
        event.status === "running"
          ? "running"
          : event.status === "failed"
            ? "error"
            : event.status === "completed" || event.status === "done"
              ? "done"
              : undefined;
      return {
        id: `${event.id}:${event.event}:${index}`,
        role: event.event === "log" ? "assistant" : "system",
        content: text,
        timestamp: event.lastActivityAt
          ? new Date(event.lastActivityAt).toLocaleTimeString()
          : undefined,
        status,
      } satisfies Message;
    });
  });

  return (
    <div class="agent-panel">
      <div class="agent-subtabs">
        <button
          type="button"
          class="agent-subtab"
          data-active={subTab() === "subagent"}
          onClick={() => setSubTab("subagent")}
        >
          子 Agent
        </button>
        <Show when={teamAvailable()}>
          <button
            type="button"
            class="agent-subtab"
            data-active={subTab() === "team"}
            onClick={() => setSubTab("team")}
          >
            Team
          </button>
        </Show>
      </div>

      <Show when={subTab() === "subagent"}>
        <div class="agent-layout">
          <div class="agent-sidebar">
            <For each={subagents()}>
              {(agent) => (
                <button
                  type="button"
                  class="agent-card"
                  data-active={selectedID() === agent.id}
                  onClick={() => setSelectedID(agent.id)}
                >
                  <div class="agent-card-title">{agent.id}</div>
                  <div class="agent-card-status" data-status={agent.status}>
                    {agent.status} · {agent.phase ?? "idle"}
                  </div>
                  <div class="agent-card-detail">
                    {agent.parentAgentID ? `父: ${agent.parentAgentID} · ` : ""}{agent.text || agent.activityDetail || agent.task || ""}
                  </div>
                </button>
              )}
            </For>
            <Show when={!subagents().length}>
              <div class="agent-empty">暂无子 Agent</div>
            </Show>
          </div>
          <div class="agent-stream">
            <Show when={selectedSubagent()} fallback={<div class="agent-empty">选择一个子 Agent 查看信息流</div>}>
              <Transcript
                messages={subagentMessages()}
                emptyTitle="子 Agent 暂无消息"
                emptyHint="子 Agent 运行后这里会展示它的信息流"
                assistantName={selectedSubagent()?.id ?? "Subagent"}
                assistantInitial="A"
              />
            </Show>
          </div>
        </div>
      </Show>

      <Show when={subTab() === "team"}>
        <div class="team-panel">
          <div class="team-header">Team 概览</div>
          <div class="team-stat">
            <span>并发上限</span>
            <span>{teamConcurrency() ?? "未设置"}</span>
          </div>
          <div class="team-stat">
            <span>进行中/等待中的 PR</span>
            <span>{teamPRs().length}</span>
          </div>
          <For each={teamPRs()}>
            {(pr) => (
              <div class="team-card">
                <div class="team-card-title">{pr.title ?? pr.prID}</div>
                <div class="team-card-detail">{pr.status ?? "pending"}</div>
              </div>
            )}
          </For>
          <Show when={!teamPRs().length}>
            <div class="agent-empty">暂无 Team 任务</div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
