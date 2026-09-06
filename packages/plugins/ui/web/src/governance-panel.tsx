import {
  createSignal,
  createEffect,
  Show,
  onCleanup,
  onMount,
  For,
} from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";
import type { AppState } from "@natalia/view-store";

type Tab = "constitution" | "decisions" | "evidence" | "drift" | "workgraph";

export function GovernancePanel(props: {
  open: boolean;
  onClose: () => void;
  state: AppState;
  runtime?: RuntimeClient;
}) {
  const [tab, setTab] = createSignal<Tab>("constitution");
  const [liveConstitution, setLiveConstitution] = createSignal<any[]>([]);
  const [liveDecisions, setLiveDecisions] = createSignal<any[]>([]);
  const [liveEvidence, setLiveEvidence] = createSignal<any[]>([]);
  const [liveDrift, setLiveDrift] = createSignal<any[]>([]);
  const [liveNodes, setLiveNodes] = createSignal<any[]>([]);
  const [liveEdges, setLiveEdges] = createSignal<any[]>([]);

  const load = async () => {
    try {
      setLiveConstitution((await props.runtime?.constitutionRules?.()) ?? []);
    } catch {}
    try {
      setLiveDecisions((await props.runtime?.decisionRecords?.()) ?? []);
    } catch {}
    try {
      setLiveEvidence((await props.runtime?.evidenceRecords?.()) ?? []);
    } catch {}
    try {
      setLiveDrift((await props.runtime?.driftFindings?.()) ?? []);
    } catch {}
    try {
      setLiveNodes((await props.runtime?.workGraphNodes?.()) ?? []);
    } catch {}
    try {
      setLiveEdges((await props.runtime?.workGraphEdges?.()) ?? []);
    } catch {}
  };

  createEffect(() => {
    if (props.open) void load();
  });

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
        <div
          class="neu-governance-window"
          onClick={(event) => event.stopPropagation()}
        >
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
            <button
              type="button"
              class="neu-settings-category"
              data-active={tab() === "constitution"}
              onClick={() => setTab("constitution")}
            >
              Constitution
            </button>
            <button
              type="button"
              class="neu-settings-category"
              data-active={tab() === "decisions"}
              onClick={() => setTab("decisions")}
            >
              Decisions
            </button>
            <button
              type="button"
              class="neu-settings-category"
              data-active={tab() === "evidence"}
              onClick={() => setTab("evidence")}
            >
              Evidence
            </button>
            <button
              type="button"
              class="neu-settings-category"
              data-active={tab() === "drift"}
              onClick={() => setTab("drift")}
            >
              Drift
            </button>
            <button
              type="button"
              class="neu-settings-category"
              data-active={tab() === "workgraph"}
              onClick={() => setTab("workgraph")}
            >
              Work Graph
            </button>
          </div>
          <div class="neu-governance-content">
            <Show when={tab() === "constitution"}>
              <For
                each={
                  liveConstitution().length
                    ? liveConstitution()
                    : Object.values(props.state.constitutionRules ?? {})
                }
              >
                {(rule) => (
                  <div class="neu-gov-row">
                    <span class="neu-gov-title" data-priority={rule.priority}>
                      {rule.ruleID}
                    </span>
                    <span class="neu-gov-text">{rule.statement}</span>
                    <span class="neu-gov-meta">
                      {rule.scope} · {rule.enforcement}
                    </span>
                  </div>
                )}
              </For>
            </Show>
            <Show when={tab() === "decisions"}>
              <For
                each={
                  liveDecisions().length
                    ? liveDecisions()
                    : (props.state.decisions ?? [])
                }
              >
                {(record) => (
                  <div class="neu-gov-row">
                    <span class="neu-gov-title" data-priority={record.status}>
                      {record.status}
                    </span>
                    <span class="neu-gov-text">{record.decision}</span>
                    <span class="neu-gov-meta">
                      Rationale: {(record.rationale ?? []).join("; ")}
                    </span>
                  </div>
                )}
              </For>
            </Show>
            <Show when={tab() === "evidence"}>
              <For
                each={
                  liveEvidence().length
                    ? liveEvidence()
                    : (props.state.evidence ?? [])
                }
              >
                {(record) => (
                  <div class="neu-gov-row">
                    <span class="neu-gov-title" data-priority={record.status}>
                      {record.status}
                    </span>
                    <span class="neu-gov-text">{record.objective}</span>
                    <span class="neu-gov-meta">
                      {record.taskID}
                      {(record.knownGaps ?? []).length
                        ? ` · Gaps: ${(record.knownGaps ?? []).join("; ")}`
                        : ""}
                    </span>
                  </div>
                )}
              </For>
            </Show>
            <Show when={tab() === "drift"}>
              <For each={liveDrift().length ? liveDrift() : []}>
                {(finding) => (
                  <div class="neu-gov-row">
                    <span
                      class="neu-gov-title"
                      data-priority={finding.severity}
                    >
                      {finding.severity} ·{" "}
                      {Math.round(finding.confidence * 100)}%
                    </span>
                    <span class="neu-gov-text">
                      Goal: {finding.originalObjective}
                    </span>
                    <span class="neu-gov-meta">
                      Current: {finding.currentActivity}
                    </span>
                  </div>
                )}
              </For>
            </Show>
            <Show when={tab() === "workgraph"}>
              <For
                each={
                  liveNodes().length
                    ? liveNodes()
                    : Object.values(props.state.workGraphNodes ?? {})
                }
              >
                {(node) => (
                  <div class="neu-gov-row">
                    <span class="neu-gov-title">{node.kind}</span>
                    <span class="neu-gov-text">{node.summary}</span>
                    <span class="neu-gov-meta">
                      {node.nodeID}
                      {node.actor ? ` · ${node.actor}` : ""}
                    </span>
                  </div>
                )}
              </For>
              <div class="neu-gov-section-title">Relations</div>
              <For
                each={
                  liveEdges().length
                    ? liveEdges()
                    : Object.values(props.state.workGraphEdges ?? {})
                }
              >
                {(edge) => (
                  <div class="neu-gov-row">
                    <span class="neu-gov-title">{edge.kind}</span>
                    <span class="neu-gov-text">
                      {edge.sourceID} → {edge.targetID}
                    </span>
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
