import { createSignal, createEffect, Show, For } from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";
import type { AppState } from "@natalia/view-store";
import { WorkGraphTree } from "./components/WorkGraphTree";

type Tab =
  | "constitution"
  | "decisions"
  | "evidence"
  | "drift"
  | "workgraph"
  | "notices";

/**
 * The governance pane content (EI Phase 2): the six governance sub-tabs and
 * their rows, reading the live RPC surfaces with the view-store projection as
 * the fallback. Extracted from the modal so the same content mounts both in
 * the right-sidebar composite tab (the plan's target host) and, during the
 * transition, in the retiring modal. Cost/dashboard-free: this is the
 * governance surface only.
 */
export function GovernancePane(props: {
  state: AppState;
  runtime?: RuntimeClient;
  sessionID?: string;
}) {
  const [tab, setTab] = createSignal<Tab>("drift");
  const [liveConstitution, setLiveConstitution] = createSignal<any[]>([]);
  const [liveDecisions, setLiveDecisions] = createSignal<any[]>([]);
  const [liveEvidence, setLiveEvidence] = createSignal<any[]>([]);
  const [liveDrift, setLiveDrift] = createSignal<any[]>([]);
  // ADR Phase C: the projected runtime notices (dual ingestion — the live
  // event stream and the server-projected contract converge here).
  const [liveNotices, setLiveNotices] = createSignal<any[]>([]);

  const load = async () => {
    const sessionID = props.sessionID;
    try {
      setLiveConstitution(
        (await props.runtime?.constitutionRules?.(sessionID)) ?? [],
      );
    } catch {}
    try {
      setLiveDecisions(
        (await props.runtime?.decisionRecords?.(sessionID)) ?? [],
      );
    } catch {}
    try {
      setLiveEvidence(
        (await props.runtime?.evidenceRecords?.({ sessionID })) ?? [],
      );
    } catch {}
    try {
      setLiveDrift((await props.runtime?.driftFindings?.({ sessionID })) ?? []);
    } catch {}
    try {
      setLiveNotices((await props.runtime?.notices?.(sessionID)) ?? []);
    } catch {}
  };

  // Reload when the active session changes so the pane follows the session.
  createEffect(() => {
    void props.state.sessionID;
    void load();
  });

  return (
    <div class="governance-pane">
      <div class="review-subtabs">
        <button
          type="button"
          class="review-subtab"
          data-active={tab() === "drift"}
          onClick={() => setTab("drift")}
        >
          Drift
        </button>
        <button
          type="button"
          class="review-subtab"
          data-active={tab() === "constitution"}
          onClick={() => setTab("constitution")}
        >
          Constitution
        </button>
        <button
          type="button"
          class="review-subtab"
          data-active={tab() === "decisions"}
          onClick={() => setTab("decisions")}
        >
          Decisions
        </button>
        <button
          type="button"
          class="review-subtab"
          data-active={tab() === "evidence"}
          onClick={() => setTab("evidence")}
        >
          Evidence
        </button>
        <button
          type="button"
          class="review-subtab"
          data-active={tab() === "workgraph"}
          onClick={() => setTab("workgraph")}
        >
          Work Graph
        </button>
        <button
          type="button"
          class="review-subtab"
          data-active={tab() === "notices"}
          onClick={() => setTab("notices")}
        >
          Notices
        </button>
      </div>
      <div class="neu-governance-content">
        <Show when={tab() === "drift"}>
          <For each={liveDrift().length ? liveDrift() : []}>
            {(finding) => (
              <div class="neu-gov-row">
                <span class="neu-gov-title" data-priority={finding.severity}>
                  {finding.severity} · {Math.round(finding.confidence * 100)}%
                </span>
                <span class="neu-gov-text">
                  Goal: {finding.originalObjective}
                </span>
                <span class="neu-gov-meta">
                  Current: {finding.currentActivity}
                  {finding.status && finding.status !== "open"
                    ? ` · ${finding.status}`
                    : ""}
                </span>
              </div>
            )}
          </For>
          <Show when={!liveDrift().length}>
            <div class="neu-gov-empty">No open drift findings.</div>
          </Show>
        </Show>
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
        <Show when={tab() === "workgraph"}>
          <WorkGraphTree state={props.state} />
        </Show>
        <Show when={tab() === "notices"}>
          <div class="neu-gov-section-title">Runtime Notices</div>
          <For
            each={
              liveNotices().length
                ? liveNotices()
                : (props.state.runtimeNotices ?? [])
            }
          >
            {(notice) => (
              <div class="neu-gov-row">
                <span class="neu-gov-title" data-priority={notice.kind}>
                  {notice.kind} · r{notice.revision}
                </span>
                <span class="neu-gov-text">{notice.summary}</span>
                <span class="neu-gov-meta">{notice.at}</span>
              </div>
            )}
          </For>
          <Show
            when={
              !liveNotices().length &&
              !(props.state.runtimeNotices ?? []).length
            }
          >
            <div class="neu-gov-empty">
              No runtime notices yet — a config reload or agent switch records
              one here.
            </div>
          </Show>
        </Show>
      </div>
    </div>
  );
}
