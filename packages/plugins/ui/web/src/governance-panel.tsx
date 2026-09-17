import { createSignal, createEffect, Show, For } from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";
import type { AppState } from "@natalia/view-store";
import { WorkGraphTree } from "./components/WorkGraphTree";
import { useConfirmDialog } from "./components/ConfirmDialog";

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
  const { confirm, dialog } = useConfirmDialog();

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

  // EI §3.5: acknowledge a drift finding — the Main Agent explains it or
  // disputes it as a false positive (with a user-supplied rationale). Only an
  // open finding transitions; reload to reflect the new status.
  async function acknowledgeFinding(
    findingID: string,
    status: "explained" | "disputed",
    rationale?: string,
  ) {
    try {
      await props.runtime?.acknowledgeDriftFinding?.(
        { findingID, status, ...(rationale ? { rationale } : {}) },
        props.sessionID,
      );
      await load();
    } catch {}
  }

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
          <For each={liveDrift()}>
            {(finding) => (
              <div class="drift-card">
                <div class="drift-card-head">
                  <span class="neu-gov-title" data-priority={finding.severity}>
                    {finding.severity} · {Math.round(finding.confidence * 100)}%
                  </span>
                  <span class="drift-card-status" data-status={finding.status}>
                    {finding.status}
                  </span>
                </div>
                <div class="drift-card-goal">
                  Goal: {finding.originalObjective}
                </div>
                <Show when={finding.planID}>
                  <div class="drift-card-meta">Plan: {finding.planID}</div>
                </Show>
                <div class="drift-card-current">
                  Current: {finding.currentActivity}
                </div>
                <Show
                  when={
                    finding.ruleHits?.length ||
                    finding.contractVersion !== undefined
                  }
                >
                  <div class="drift-card-section">
                    <div class="drift-card-section-title">
                      Why this fired
                    </div>
                    <Show when={finding.contractVersion !== undefined}>
                      <div class="drift-card-meta">
                        contract v{finding.contractVersion}
                      </div>
                    </Show>
                    <For each={finding.ruleHits ?? []}>
                      {(hit) => (
                        <div class="drift-card-rule">
                          {hit.rule} · {Math.round(hit.confidence * 100)}%
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={finding.evidence?.length}>
                  <div class="drift-card-section">
                    <div class="drift-card-section-title">Evidence</div>
                    <For each={finding.evidence}>
                      {(item) => (
                        <div class="drift-card-evidence">{item}</div>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={finding.applicableConstraints?.length}>
                  <div class="drift-card-section">
                    <div class="drift-card-section-title">Constraints</div>
                    <For each={finding.applicableConstraints}>
                      {(item) => (
                        <div class="drift-card-evidence">{item}</div>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={finding.rationale}>
                  <div class="drift-card-rationale">{finding.rationale}</div>
                </Show>
                <Show when={finding.status === "open"}>
                  <div class="drift-card-actions">
                    <button
                      type="button"
                      class="drift-card-btn"
                      onClick={() =>
                        void acknowledgeFinding(finding.findingID, "explained")
                      }
                    >
                      解释
                    </button>
                    <button
                      type="button"
                      class="drift-card-btn"
                      data-kind="dispute"
                      onClick={() => {
                        const reason =
                          window.prompt("声明这是误报，给出理由：");
                        if (reason?.trim())
                          void acknowledgeFinding(
                            finding.findingID,
                            "disputed",
                            reason.trim(),
                          );
                      }}
                    >
                      误报
                    </button>
                  </div>
                </Show>
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
              <div class="constitution-row">
                <div class="constitution-row-main">
                  <span class="neu-gov-title" data-priority={rule.priority}>
                    {rule.ruleID}
                  </span>
                  <span class="neu-gov-text">{rule.statement}</span>
                  <span class="neu-gov-meta">
                    {rule.scope} · {rule.enforcement}
                  </span>
                </div>
                <Show when={rule.scope !== "release"}>
                  <div class="constitution-row-actions">
                    <button
                      type="button"
                      class="constitution-btn"
                      onClick={() =>
                        void props.runtime
                          ?.updateConstitutionRule?.(
                            { ruleID: rule.ruleID, enabled: false },
                            props.sessionID,
                          )
                          .then(() => load())
                      }
                    >
                      停用
                    </button>
                    <button
                      type="button"
                      class="constitution-btn"
                      data-danger
                      onClick={() =>
                        void (async () => {
                          const ok = await confirm({
                            title: "删除规则",
                            message: `删除 ${rule.ruleID}？记录进 journal（墓碑），历史保留。`,
                            confirmLabel: "删除",
                            danger: true,
                          });
                          if (ok)
                            await props.runtime
                              ?.removeConstitutionRule?.(
                                { ruleID: rule.ruleID },
                                props.sessionID,
                              )
                              .then(() => load());
                        })()
                      }
                    >
                      删除
                    </button>
                  </div>
                </Show>
              </div>
            )}
          </For>
          {dialog}
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
