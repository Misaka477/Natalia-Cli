import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import type {
  RuntimeClient,
  RuntimeNativeTerminalSession,
  RuntimeTeamPR,
} from "@natalia/contracts";
import type { AppState, SubagentView } from "@natalia/view-store";
import { Transcript } from "@natalia/ui-kit";
import type { Message } from "./types";

function subagentToolCallsFromText(
  text: string,
): NonNullable<Message["toolCalls"]> | undefined {
  const trimmed = text.trim();
  const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+(\{[\s\S]*\})$/u);
  if (!match) return undefined;
  try {
    JSON.parse(match[2]!);
  } catch {
    return undefined;
  }
  return [
    {
      name: match[1]!,
      output: match[2]!,
      status: "completed",
      summary: match[1]!,
    },
  ];
}

export function AgentPanel(props: {
  state: AppState;
  runtime?: RuntimeClient;
  onOpenTerminal?: (terminalID: string) => void;
}) {
  const [subTab, setSubTab] = createSignal<"subagent" | "team">("subagent");
  const [selectedID, setSelectedID] = createSignal<string | undefined>(
    undefined,
  );
  const [teamAvailable, setTeamAvailable] = createSignal(false);
  const [teamPRs, setTeamPRs] = createSignal<RuntimeTeamPR[]>([]);
  const [teamConcurrency, setTeamConcurrency] = createSignal<
    number | undefined
  >(undefined);
  const [terminals, setTerminals] = createSignal<
    RuntimeNativeTerminalSession[]
  >([]);
  const teamStatusTally = createMemo(() => {
    const tally: Record<string, number> = {
      completed: 0,
      failed: 0,
      stopped: 0,
    };
    for (const pr of teamPRs()) {
      const status = pr.status || "pending";
      tally[status] = (tally[status] ?? 0) + 1;
    }
    return tally;
  });

  async function refreshData() {
    let teamSeen = false;
    try {
      const prs = (await props.runtime?.teamPRList?.()) ?? [];
      setTeamPRs(prs);
      teamSeen = true;
    } catch {
      setTeamPRs([]);
    }
    try {
      const plugins = (await props.runtime?.plugins?.()) ?? [];
      if (
        plugins.some(
          (plugin) =>
            plugin.id?.includes("team") || plugin.name?.includes("Team"),
        )
      )
        teamSeen = true;
    } catch {
      // plugin list may be unavailable; teamPRList already tried
    }
    setTeamAvailable(teamSeen);
    try {
      const list = (await props.runtime?.nativeTerminalList?.()) ?? [];
      setTerminals(list);
    } catch {
      setTerminals([]);
    }
    try {
      const config = await props.runtime?.configGet?.();
      setTeamConcurrency(config?.team?.maxConcurrent);
    } catch {
      setTeamConcurrency(undefined);
    }
  }

  onMount(() => {
    void refreshData();
  });

  const subagents = createMemo(() =>
    Object.values(props.state.subagents ?? {}).sort((a, b) => {
      const at = a.lastActivityAt ?? 0;
      const bt = b.lastActivityAt ?? 0;
      return bt - at;
    }),
  );

  const runningSubagents = createMemo(() =>
    subagents().filter((agent) => agent.status === "running"),
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

  const selectedTerminals = createMemo(() =>
    terminals().filter((terminal) => terminal.agentID === selectedID()),
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
                status: msg.tool.status,
                summary: msg.tool.summary,
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
      const text =
        event.text || event.activityDetail || event.task || event.event;
      const status =
        event.status === "running"
          ? "running"
          : event.status === "failed"
            ? "error"
            : event.status === "completed"
              ? "done"
              : undefined;
      const toolCalls = subagentToolCallsFromText(text);
      if (toolCalls) {
        return {
          id: `${event.id}:${event.event}:${index}`,
          role: "assistant",
          content: "",
          toolCalls,
          status: "done",
          timestamp: event.lastActivityAt
            ? new Date(event.lastActivityAt).toLocaleTimeString()
            : undefined,
        } satisfies Message;
      }
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

  const [subTranscriptEl, setSubTranscriptEl] = createSignal<
    HTMLDivElement | undefined
  >();
  const [subFollowBottom, setSubFollowBottom] = createSignal(true);
  const [subShowJumpToBottom, setSubShowJumpToBottom] = createSignal(false);
  let subObservedTop = 0;

  function handleSubagentTranscriptScroll() {
    const el = subTranscriptEl();
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setSubFollowBottom(nearBottom);
    setSubShowJumpToBottom(!nearBottom);
    subObservedTop = el.scrollTop;
  }

  function jumpSubagentToBottom() {
    const el = subTranscriptEl();
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    subObservedTop = el.scrollTop;
    setSubFollowBottom(true);
    setSubShowJumpToBottom(false);
  }

  const subFollowObserver =
    typeof ResizeObserver === "undefined"
      ? undefined
      : new ResizeObserver(() => {
          if (subFollowBottom() && subTranscriptEl()) {
            const el = subTranscriptEl()!;
            el.scrollTop = el.scrollHeight;
            subObservedTop = el.scrollTop;
          }
        });
  onCleanup(() => subFollowObserver?.disconnect());

  createEffect(() => {
    const el = subTranscriptEl();
    const content = el?.querySelector<HTMLElement>(
      ".natalia-transcript-content",
    );
    if (el) subFollowObserver?.observe(el);
    if (content) subFollowObserver?.observe(content);
    if (el) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (subFollowBottom() && subTranscriptEl()) {
            const target = subTranscriptEl()!;
            target.scrollTop = target.scrollHeight;
            subObservedTop = target.scrollTop;
          }
        });
      });
    }
  });

  createEffect(() => {
    const id = selectedID();
    if (!id) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (subFollowBottom() && subTranscriptEl()) {
          const el = subTranscriptEl()!;
          el.scrollTop = el.scrollHeight;
          subObservedTop = el.scrollTop;
        }
      });
    });
  });

  function agentStatusLabel(agent: SubagentView) {
    return agent.status === "running"
      ? "运行"
      : agent.status === "completed"
        ? "完成"
        : agent.status === "failed"
          ? "失败"
          : agent.status;
  }

  return (
    <div class="review-pane">
      <div class="review-subtabs">
        <button
          type="button"
          class="review-subtab"
          data-active={subTab() === "subagent"}
          onClick={() => setSubTab("subagent")}
        >
          子 Agent
        </button>
        <Show when={teamAvailable()}>
          <button
            type="button"
            class="review-subtab"
            data-active={subTab() === "team"}
            onClick={() => setSubTab("team")}
          >
            Team
          </button>
        </Show>
      </div>

      <Show when={subTab() === "subagent"}>
        <div class="review-header">
          <div class="review-title">
            <span>子 Agent</span>
          </div>
          <div class="review-meta">
            <span class="review-count">{subagents().length} agents</span>
          </div>
        </div>
        <Show
          when={subagents().length}
          fallback={
            <div class="agent-empty-full">
              <div class="review-empty-icon">
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <circle
                    cx="18"
                    cy="12"
                    r="6"
                    stroke="currentColor"
                    stroke-width="1.6"
                  />
                  <path
                    d="M8 30C8 23.373 12.477 19 18 19C23.523 19 28 23.373 28 30"
                    stroke="currentColor"
                    stroke-width="1.6"
                    stroke-linecap="round"
                  />
                </svg>
              </div>
              <div class="review-empty-title">暂无子 Agent</div>
              <div class="review-empty-desc">
                子 Agent 运行后会出现在这里，并展示它的独立信息流。
              </div>
            </div>
          }
        >
          <div class="review-body">
            <div class="review-files" style="width: 220px">
              <div class="review-files-heading">Agents</div>
              <For each={subagentTree().roots}>
                {(agent) => (
                  <div>
                    <button
                      type="button"
                      class="review-file-row"
                      data-active={selectedID() === agent.id}
                      onClick={() => setSelectedID(agent.id)}
                    >
                      <span class="review-file-status">
                        {agentStatusLabel(agent)}
                      </span>
                      <span class="review-file-name">{agent.id}</span>
                    </button>
                    <For each={subagentTree().children.get(agent.id) ?? []}>
                      {(child) => (
                        <div class="agent-tree-child">
                          <button
                            type="button"
                            class="review-file-row"
                            data-active={selectedID() === child.id}
                            onClick={() => setSelectedID(child.id)}
                          >
                            <span class="review-file-status">
                              {agentStatusLabel(child)}
                            </span>
                            <span class="review-file-name">└ {child.id}</span>
                          </button>
                        </div>
                      )}
                    </For>
                  </div>
                )}
              </For>
              <Show when={!subagents().length}>
                <div class="review-empty">
                  <div class="review-empty-title">暂无子 Agent</div>
                </div>
              </Show>
            </div>
            <div
              class="review-resizer"
              role="separator"
              aria-orientation="vertical"
            />
            <div class="review-diff">
              <div class="review-diff-header">
                <span class="review-diff-path">
                  {selectedSubagent()?.id ?? "选择一个子 Agent"}
                </span>
                <Show when={selectedSubagent()}>
                  <span class="review-meta">
                    {selectedSubagent()?.status} ·{" "}
                    {selectedSubagent()?.phase ?? "idle"}
                    {selectedSubagent()?.parentAgentID
                      ? ` · 父 ${selectedSubagent()?.parentAgentID}`
                      : ""}
                    <Show when={selectedTerminals().length}>
                      {" · "}
                      终端:{" "}
                      {selectedTerminals()
                        .map((terminal) => terminal.id)
                        .join(", ")}
                      <button
                        type="button"
                        class="terminal-toolbar-btn"
                        onClick={() =>
                          props.onOpenTerminal?.(selectedTerminals()[0]!.id)
                        }
                      >
                        打开终端
                      </button>
                    </Show>
                  </span>
                </Show>
              </div>
              <div class="review-diff-content neu-pane nia-flat-pane">
                <Show
                  when={selectedSubagent()}
                  fallback={
                    <div class="review-empty">
                      <div class="review-empty-title">
                        选择一个子 Agent 查看信息流
                      </div>
                    </div>
                  }
                >
                  <Transcript
                    messages={subagentMessages()}
                    emptyTitle="子 Agent 暂无消息"
                    emptyHint="子 Agent 运行后这里会展示它的信息流"
                    assistantName={selectedSubagent()?.id ?? "Subagent"}
                    assistantInitial="A"
                    scrollRef={setSubTranscriptEl}
                    onScroll={handleSubagentTranscriptScroll}
                  />
                  <Show when={subShowJumpToBottom()}>
                    <button
                      type="button"
                      class="neu-jump-bottom"
                      onClick={jumpSubagentToBottom}
                      title="跳到底部"
                    >
                      ↓
                    </button>
                  </Show>
                </Show>
              </div>
            </div>
          </div>
        </Show>
      </Show>

      <Show when={subTab() === "team"}>
        <div class="review-header">
          <div class="review-title">
            <span>Team 概览</span>
            <button
              type="button"
              class="terminal-toolbar-btn"
              onClick={() => void refreshData()}
            >
              刷新
            </button>
          </div>
          <div class="review-meta">
            <span class="review-count">{teamPRs().length} PR</span>
          </div>
        </div>
        <div class="review-section-label">并发上限</div>
        <div class="review-entity-control">
          <div class="review-select">{teamConcurrency() ?? "未设置"}</div>
        </div>
        <div class="review-section-label">运行中的子 Agent</div>
        <div class="review-entity-control">
          <div class="review-select">{runningSubagents().length}</div>
        </div>
        <div class="review-section-label">状态统计</div>
        <div class="review-entity-control">
          <div class="review-select">
            完成 {teamStatusTally().completed ?? 0} · 失败{" "}
            {teamStatusTally().failed ?? 0} · 停止{" "}
            {teamStatusTally().stopped ?? 0}
          </div>
        </div>
        <Show when={teamPRs().length}>
          <div class="review-section-label">任务队列</div>
          <div class="review-entity-list">
            <For each={teamPRs()}>
              {(pr) => (
                <div class="team-queue-card">
                  <div class="team-queue-title">{pr.task || pr.id}</div>
                  <div class="team-queue-meta">
                    <span>状态: {pr.status}</span>
                    <span>子 Agent: {pr.sandboxID}</span>
                    <span>
                      phase:{" "}
                      {subagents().find((item) => item.id === pr.sandboxID)
                        ?.phase ?? "未知"}
                    </span>
                  </div>
                  <Show when={pr.result}>
                    <div class="team-queue-result">{pr.result}</div>
                  </Show>
                  <Show when={pr.buildEvidence && !pr.buildEvidence.ok}>
                    <div class="team-card-error">
                      build exit {pr.buildEvidence?.exitCode}
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
        <Show when={!teamPRs().length}>
          <div class="review-empty">
            <div class="review-empty-title">暂无 Team 任务</div>
          </div>
        </Show>
      </Show>
    </div>
  );
}
