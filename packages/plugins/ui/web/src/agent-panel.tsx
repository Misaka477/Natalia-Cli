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
  const teamStatusTally = createMemo(() => {
    const tally: Record<string, number> = { completed: 0, failed: 0, stopped: 0 };
    for (const pr of teamPRs()) {
      const status = pr.status || "pending";
      tally[status] = (tally[status] ?? 0) + 1;
    }
    return tally;
  });

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

  const subagentTree = createMemo(() => {
    const roots: SubagentView[] = [];
    const children = new Map<string, SubagentView[]>();
    for (const agent of subagents()) {
      const parent = agent.parentAgentID;
      if (!parent || !subagents().some((item) => item.id === parent)) {
        roots.push(agent);
      } else {
        const list = children.get(parent) ?? [];
        list.push(agent);
        children.set(parent, list);
      }
    }
    return { roots, children };
  });

  const selectedSubagent = createMemo(() =>
    subagents().find((item) => item.id === selectedID()),
  );

  const subagentMessages = createMemo<Message[]>(() => {
    const id = selectedID();
    if (!id) return [];
    const child = props.state.subagentStates?.[id];
    if (child?.messages?.length) {
      return child.messages.map((msg, index) => {
        if (msg.tool) {
          return {
            id: `sub-${id}-${index}`,
            role: "assistant",
            content: "",
            status: (msg.tool.status as Message["status"]) ?? "completed",
            toolCalls: [
              {
                name: msg.tool.name,
                output: msg.tool.result ?? msg.tool.summary,
              },
            ],
          } satisfies Message;
        }
        return {
          id: `sub-${id}-${index}`,
          role:
            msg.role === "user"
              ? "user"
              : msg.role === "system"
                ? "system"
                : "assistant",
          thinking: msg.role === "thinking" && msg.reasoningVisible !== false,
          content: msg.text + (msg.pendingText || ""),
          status: msg.status as Message["status"],
          streaming: Boolean(
            (msg.pendingText ?? "").length > 0 && msg.role !== "user",
          ),
        } satisfies Message;
      });
    }
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
            <For each={subagentTree().roots}>
              {(agent) => (
                <div>
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
                      {agent.text || agent.activityDetail || agent.task || ""}
                    </div>
                  </button>
                  <For each={subagentTree().children.get(agent.id) ?? []}>
                    {(child) => (
                      <div class="agent-tree-child">
                        <button
                          type="button"
                          class="agent-card"
                          data-active={selectedID() === child.id}
                          onClick={() => setSelectedID(child.id)}
                        >
                          <div class="agent-card-title">└ {child.id}</div>
                          <div class="agent-card-status" data-status={child.status}>
                            {child.status} · {child.phase ?? "idle"}
                          </div>
                          <div class="agent-card-detail">
                            {child.text || child.activityDetail || child.task || ""}
                          </div>
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              )}
            </For>
            <Show when={!subagents().length}>
              <div class="agent-empty">暂无子 Agent</div>
            </Show>
          </div>
          <div class="agent-stream">
            <Show when={selectedSubagent()} fallback={<div class="agent-empty">选择一个子 Agent 查看信息流</div>}>
              <div class="agent-stream-header">
                <div class="agent-stream-title">{selectedSubagent()?.id}</div>
                <div class="agent-stream-meta">
                  {selectedSubagent()?.status} · {selectedSubagent()?.phase ?? "idle"} · {selectedSubagent()?.health ?? "active"}
                </div>
                <Show when={selectedSubagent()?.parentAgentID}>
                  <div class="agent-stream-meta">父 Agent: {selectedSubagent()?.parentAgentID}</div>
                </Show>
                <div class="agent-stream-meta">交互式终端: 当前子 Agent 未暴露终端会话</div>
              </div>
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
          <div class="team-stat">
            <span>已完成 / 失败 / 停止</span>
            <span>{teamStatusTally().completed ?? 0} / {teamStatusTally().failed ?? 0} / {teamStatusTally().stopped ?? 0}</span>
          </div>
          <For each={teamPRs()}>
            {(pr) => (
              <div class="team-card">
                <div class="team-card-title">{pr.task || pr.id}</div>
                <div class="team-card-detail">
                  <span>{pr.status}</span>
                  {" · "}
                  <span>子 Agent: {pr.sandboxID}</span>
                  {" · "}
                  <span>关联 phase: {subagents().find((item) => item.id === pr.sandboxID)?.phase ?? "未知"}</span>
                </div>
                <Show when={pr.result}>
                  <div class="team-card-result">{pr.result}</div>
                </Show>
                <Show when={pr.buildEvidence && !pr.buildEvidence.ok}>
                  <div class="team-card-error">build exit {pr.buildEvidence?.exitCode}</div>
                </Show>
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
