import { createSignal, Show, onCleanup, onMount, For } from "solid-js";
import type { AppState } from "@natalia/view-store";

type Tab = "constitution" | "decisions" | "evidence" | "drift" | "workgraph";

const constitutionRules = [
  { ruleID: "C-001", statement: "Main Agent 是唯一模型侧写入执行者。", priority: "critical", scope: "runtime", enforcement: "hard" },
  { ruleID: "C-002", statement: "任何工具执行都受权限 profile 约束。", priority: "high", scope: "tools", enforcement: "hard" },
  { ruleID: "C-003", statement: "用户确认前不得删除不可逆工作区数据。", priority: "critical", scope: "workspace", enforcement: "approval" },
];

const decisions = [
  { decision: "采用 Neumorphism 作为 Web UI 主题", rationale: ["与当前工程气质统一", "用户偏好浅色系"], status: "accepted" },
  { decision: "右侧栏保留 Diff / 终端 / 文件 / 浏览器", rationale: ["高频协作工具集中"], status: "accepted" },
  { decision: "推迟治理类 UI 到后续阶段", rationale: ["先保证核心闭环"], status: "superseded" },
];

const evidence = [
  { taskID: "check-rollback", objective: "验证 rollback 行为一致", status: "validated", knownGaps: [] },
  { taskID: "write-ui", objective: "实现 Neumorphism 原型", status: "accepted", knownGaps: ["文件编辑器还缺真实读写"] },
  { taskID: "release-check", objective: "完成发布检查", status: "failed", knownGaps: ["tsc 未通过"] },
];

const driftFindings = [
  { findingID: "DRIFT-01", severity: "warning", confidence: 0.82, originalObjective: "完成第二套 UI 原型", currentActivity: "正在调整设置面板", evidence: ["settings-panel.tsx"], status: "open" },
  { findingID: "DRIFT-02", severity: "high", confidence: 0.91, originalObjective: "保持 Sidebar 简洁", currentActivity: "新增了多个 Top Bar 按钮", evidence: ["app-neu.tsx"], status: "open" },
];

const workNodes = [
  { nodeID: "n1", kind: "plan", summary: "实现 Web UI 工作台", actor: "Natalia" },
  { nodeID: "n2", kind: "task", summary: "实现设置面板", actor: "Natalia" },
  { nodeID: "n3", kind: "decision", summary: "采用 Neumorphism", actor: "Natalia" },
];

const workEdges = [
  { sourceID: "n1", targetID: "n2", kind: "leads_to" },
  { sourceID: "n1", targetID: "n3", kind: "informed_by" },
];

export function GovernancePanel(props: {
  open: boolean;
  onClose: () => void;
  state: AppState;
}) {
  const [tab, setTab] = createSignal<Tab>("constitution");

  onMount(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", handleKeydown);
    onCleanup(() => window.removeEventListener("keydown", handleKeydown));
  });

  return (
    <Show when={props.open}>
      <div class="neu-settings-backdrop" onClick={props.onClose}>
        <div class="neu-governance-window" onClick={(event) => event.stopPropagation()}>
          <div class="neu-settings-header">
            <span class="neu-settings-title">治理</span>
            <button
              type="button"
              class="neu-settings-close"
              onClick={props.onClose}
              aria-label="关闭治理"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 3l10 10M13 3L3 13"
                  stroke="currentColor"
                  stroke-width="1.4"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
          <div class="neu-governance-tabs">
            <button type="button" class="neu-settings-category" data-active={tab() === "constitution"} onClick={() => setTab("constitution")}>Constitution</button>
            <button type="button" class="neu-settings-category" data-active={tab() === "decisions"} onClick={() => setTab("decisions")}>Decisions</button>
            <button type="button" class="neu-settings-category" data-active={tab() === "evidence"} onClick={() => setTab("evidence")}>Evidence</button>
            <button type="button" class="neu-settings-category" data-active={tab() === "drift"} onClick={() => setTab("drift")}>Drift</button>
            <button type="button" class="neu-settings-category" data-active={tab() === "workgraph"} onClick={() => setTab("workgraph")}>Work Graph</button>
          </div>
          <div class="neu-governance-content">
            <Show when={tab() === "constitution"}>
              <For each={Object.values(props.state.constitutionRules)}>
                {(rule) => (
                  <div class="neu-gov-row">
                    <span class="neu-gov-title" data-priority={rule.priority}>{rule.ruleID}</span>
                    <span class="neu-gov-text">{rule.statement}</span>
                    <span class="neu-gov-meta">{rule.scope} · {rule.enforcement}</span>
                  </div>
                )}
              </For>
            </Show>
            <Show when={tab() === "decisions"}>
              <For each={props.state.decisions}>
                {(record) => (
                  <div class="neu-gov-row">
                    <span class="neu-gov-title" data-priority={record.status}>{record.status}</span>
                    <span class="neu-gov-text">{record.decision}</span>
                    <span class="neu-gov-meta">Rationale: {(record.rationale ?? []).join("; ")}</span>
                  </div>
                )}
              </For>
            </Show>
            <Show when={tab() === "evidence"}>
              <For each={props.state.evidence}>
                {(record) => (
                  <div class="neu-gov-row">
                    <span class="neu-gov-title" data-priority={record.status}>{record.status}</span>
                    <span class="neu-gov-text">{record.objective}</span>
                    <span class="neu-gov-meta">{record.taskID}{(record.knownGaps ?? []).length ? ` · Gaps: ${(record.knownGaps ?? []).join("; ")}` : ""}</span>
                  </div>
                )}
              </For>
            </Show>
            <Show when={tab() === "drift"}>
              <For each={driftFindings}>
                {(finding) => (
                  <div class="neu-gov-row">
                    <span class="neu-gov-title" data-priority={finding.severity}>{finding.severity} · {Math.round(finding.confidence * 100)}%</span>
                    <span class="neu-gov-text">Goal: {finding.originalObjective}</span>
                    <span class="neu-gov-meta">Current: {finding.currentActivity}</span>
                  </div>
                )}
              </For>
            </Show>
            <Show when={tab() === "workgraph"}>
              <For each={Object.values(props.state.workGraphNodes)}>
                {(node) => (
                  <div class="neu-gov-row">
                    <span class="neu-gov-title">{node.kind}</span>
                    <span class="neu-gov-text">{node.summary}</span>
                    <span class="neu-gov-meta">{node.nodeID}{node.actor ? ` · ${node.actor}` : ""}</span>
                  </div>
                )}
              </For>
              <div class="neu-gov-section-title">Relations</div>
              <For each={Object.values(props.state.workGraphEdges)}>
                {(edge) => (
                  <div class="neu-gov-row">
                    <span class="neu-gov-title">{edge.kind}</span>
                    <span class="neu-gov-text">{edge.sourceID} → {edge.targetID}</span>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
