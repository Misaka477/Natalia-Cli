import { createSignal, createEffect, Show, For } from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";
import type { AppState } from "@natalia/view-store";
import { WorkGraphTree } from "./components/WorkGraphTree";
import { useConfirmDialog } from "./components/ConfirmDialog";

export type GovernanceTab =
  | "constitution"
  | "decisions"
  | "evidence"
  | "completions"
  | "drift"
  | "workgraph"
  | "notices";
type Tab = GovernanceTab;

/**
 * Legacy findings predate `ruleHits`/`contractVersion` in the journal. Infer a
 * rule label from the safe evidence prefix so old cards are still judge-able
 * instead of showing an unexplained 100%.
 */
function ruleHitsFor(finding: {
  ruleHits?: Array<{ rule: string; confidence: number }>;
  evidence?: string[];
  confidence?: number;
}): Array<{ rule: string; confidence: number }> {
  if (finding.ruleHits?.length) return finding.ruleHits;
  const names = new Set<string>();
  for (const item of finding.evidence ?? []) {
    if (
      item.startsWith("objective_overlap:") ||
      item.startsWith("activity:") ||
      item.startsWith("activity_count:")
    )
      names.add("objective_activity_mismatch");
    else if (item.startsWith("constraint:"))
      names.add("constraint_violation_signal");
    else if (item.startsWith("completion:")) names.add("evidence_gap");
    else if (item.startsWith("dependency:")) names.add("dependency_signal");
    else if (item.startsWith("outside_target:")) names.add("target_drift");
    else if (item.startsWith("reference:no_accepted_contract"))
      names.add("unverifiable_no_contract");
  }
  return [...names].map((rule) => ({
    rule: `${rule} (legacy)`,
    confidence: finding.confidence ?? 0,
  }));
}

/**
 * The per-tab data bundle the governance pane renders. Kept outside the
 * component so a headless host can verify data, empty and failure states
 * without a DOM.
 */
export type GovernanceSliceBundle = {
  constitution: any[];
  decisions: any[];
  evidence: any[];
  completions: any[];
  drift: any[];
  notices: any[];
  errors: string[];
};

/**
 * Load every governance read surface independently: one unavailable tab must
 * not blank the others, and the failed label is preserved for the UI.
 */
export async function loadGovernanceSlices(
  runtime: RuntimeClient | undefined,
  sessionID?: string,
): Promise<GovernanceSliceBundle> {
  const errors: string[] = [];
  const loadSlice = async <T,>(
    label: string,
    load: () => Promise<T[] | undefined>,
  ): Promise<T[]> => {
    try {
      return (await load()) ?? [];
    } catch (error) {
      errors.push(
        `${label}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  };
  const [constitution, decisions, evidence, completions, drift, notices] =
    await Promise.all([
      loadSlice(
        "Constitution",
        () => runtime?.constitutionRules?.(sessionID) ?? Promise.resolve([]),
      ),
      loadSlice(
        "Decisions",
        () =>
          runtime?.decisionRecords?.({
            ...(sessionID ? { sessionID } : {}),
            scope: "session",
          }) ?? Promise.resolve([]),
      ),
      loadSlice(
        "Evidence",
        () => runtime?.evidenceRecords?.({ sessionID }) ?? Promise.resolve([]),
      ),
      loadSlice(
        "Completions",
        () => runtime?.completions?.({ sessionID }) ?? Promise.resolve([]),
      ),
      loadSlice(
        "Drift",
        () => runtime?.driftFindings?.({ sessionID }) ?? Promise.resolve([]),
      ),
      loadSlice(
        "Notices",
        () => runtime?.notices?.(sessionID) ?? Promise.resolve([]),
      ),
    ]);
  return {
    constitution,
    decisions,
    evidence,
    completions,
    drift,
    notices,
    errors,
  };
}

/**
 * The RPC action behind the drift card buttons. A headless test can call the
 * same function a click invokes and then re-read through loadGovernanceSlices,
 * proving the journal-backed read surface changed.
 */
export async function acknowledgeDriftFindingViaRpc(
  runtime: RuntimeClient | undefined,
  sessionID: string | undefined,
  findingID: string,
  status: "explained" | "disputed",
  rationale?: string,
) {
  return runtime?.acknowledgeDriftFinding?.(
    { findingID, status, ...(rationale ? { rationale } : {}) },
    sessionID,
  );
}

/** The RPC action behind a constitution rule disable/re-enable click. */
export async function updateConstitutionRuleViaRpc(
  runtime: RuntimeClient | undefined,
  sessionID: string | undefined,
  ruleID: string,
  enabled: boolean,
) {
  return runtime?.updateConstitutionRule?.({ ruleID, enabled }, sessionID);
}

/** The RPC action behind a constitution rule tombstone click. */
export async function removeConstitutionRuleViaRpc(
  runtime: RuntimeClient | undefined,
  sessionID: string | undefined,
  ruleID: string,
) {
  return runtime?.removeConstitutionRule?.({ ruleID }, sessionID);
}

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
  /** Optional deep-link target; defaults to the drift review view. */
  initialTab?: GovernanceTab;
}) {
  const [tab, setTab] = createSignal<Tab>(props.initialTab ?? "drift");
  const [liveConstitution, setLiveConstitution] = createSignal<any[]>([]);
  const [liveDecisions, setLiveDecisions] = createSignal<any[]>([]);
  const [liveEvidence, setLiveEvidence] = createSignal<any[]>([]);
  const [liveCompletions, setLiveCompletions] = createSignal<any[]>([]);
  const [liveDrift, setLiveDrift] = createSignal<any[]>([]);
  // ADR Phase C: the projected runtime notices (dual ingestion — the live
  // event stream and the server-projected contract converge here).
  const [liveNotices, setLiveNotices] = createSignal<any[]>([]);
  const [loadErrors, setLoadErrors] = createSignal<string[]>([]);
  const [actionNotice, setActionNotice] = createSignal<string | undefined>();
  const [actionBusy, setActionBusy] = createSignal(false);
  const { confirm, dialog } = useConfirmDialog();

  const load = async () => {
    const bundle = await loadGovernanceSlices(props.runtime, props.sessionID);
    setLiveConstitution(bundle.constitution);
    setLiveDecisions(bundle.decisions);
    setLiveEvidence(bundle.evidence);
    setLiveCompletions(bundle.completions);
    setLiveDrift(bundle.drift);
    setLiveNotices(bundle.notices);
    setLoadErrors(bundle.errors);
  };

  // Reload when the active session changes so the pane follows the session.
  createEffect(() => {
    void props.state.sessionID;
    void load();
  });

  // EI §3.5: acknowledge a drift finding — the Main Agent explains it or
  // disputes it as a false positive (with a user-supplied rationale). Only an
  // open finding transitions; reload to reflect the new status.
  function contractFor(planID?: string) {
    return planID ? props.state.workContracts?.[planID] : undefined;
  }

  async function acknowledgeFinding(
    findingID: string,
    status: "explained" | "disputed",
    rationale?: string,
  ) {
    setActionBusy(true);
    setActionNotice(undefined);
    try {
      const result = await acknowledgeDriftFindingViaRpc(
        props.runtime,
        props.sessionID,
        findingID,
        status,
        rationale,
      );
      setActionNotice(
        result?.acknowledged
          ? `已更新：${findingID} → ${status}`
          : `未更新：${findingID} 已不是 open，或服务端没找到这条 finding。`,
      );
      await load();
    } catch (error) {
      setActionNotice(
        `更新失败：${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setActionBusy(false);
    }
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
          data-active={tab() === "completions"}
          onClick={() => setTab("completions")}
        >
          Completions
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
        <Show when={loadErrors().length}>
          <div class="neu-gov-error">
            {loadErrors().join(" · ")}
          </div>
        </Show>
        <Show when={actionNotice()}>
          <div class="neu-gov-action-note">{actionNotice()}</div>
        </Show>
        <Show when={tab() === "drift"}>
          <For
            each={
              liveDrift().length
                ? liveDrift()
                : (props.state.driftFindings ?? [])
            }
          >
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
                <Show when={contractFor(finding.planID)}>
                  {(contract) => (
                    <div class="drift-card-section">
                      <div class="drift-card-section-title">
                        Reference frame
                      </div>
                      <Show when={contract().scope?.length}>
                        <div class="drift-card-evidence">
                          scope: {contract().scope!.join(", ")}
                        </div>
                      </Show>
                      <Show when={contract().verification?.length}>
                        <div class="drift-card-evidence">
                          verification:{" "}
                          {contract().verification!.join(", ")}
                        </div>
                      </Show>
                      <Show when={contract().constraints?.length}>
                        <div class="drift-card-evidence">
                          constraints: {contract().constraints!.join(", ")}
                        </div>
                      </Show>
                      <div class="drift-card-meta">
                        contract {contract().status} v{contract().version}
                      </div>
                    </div>
                  )}
                </Show>
                <div class="drift-card-current">
                  Current: {finding.currentActivity}
                </div>
                <Show
                  when={
                    ruleHitsFor(finding).length ||
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
                    <For each={ruleHitsFor(finding)}>
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
                      disabled={actionBusy()}
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
                      disabled={actionBusy()}
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
          <Show
            when={
              !liveDrift().length && !(props.state.driftFindings ?? []).length
            }
          >
            <div class="neu-gov-empty">
              No drift findings yet. The evaluator opens them from accepted
              contracts, constitution hits or behaviour signals.
            </div>
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
                        void updateConstitutionRuleViaRpc(
                          props.runtime,
                          props.sessionID,
                          rule.ruleID,
                          false,
                        ).then(() => load())
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
                            await removeConstitutionRuleViaRpc(
                              props.runtime,
                              props.sessionID,
                              rule.ruleID,
                            ).then(() => load());
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
          <Show
            when={
              !liveConstitution().length &&
              !Object.values(props.state.constitutionRules ?? {}).length
            }
          >
            <div class="neu-gov-empty">
              No constitution rules loaded. Seeded self-protection rules and
              user/project rules appear here.
            </div>
          </Show>
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
              <div class="gov-card">
                <div class="gov-card-head">
                  <span class="neu-gov-title" data-priority={record.status}>
                    {record.status}
                  </span>
                  <span class="gov-card-meta">{record.id}</span>
                </div>
                <div class="gov-card-section">
                  <div class="gov-card-label">Decision</div>
                  <div class="gov-card-text">{record.decision}</div>
                </div>
                <Show when={record.rationale?.length}>
                  <div class="gov-card-section">
                    <div class="gov-card-label">Rationale</div>
                    <div class="gov-card-text">
                      {(record.rationale ?? []).join("; ")}
                    </div>
                  </div>
                </Show>
                <Show when={record.alternatives?.length}>
                  <div class="gov-card-section">
                    <div class="gov-card-label">Alternatives</div>
                    <For each={record.alternatives ?? []}>
                      {(item: { option: string; rejectedReason?: string }) => (
                        <div class="gov-card-text">
                          {item.option}
                          {item.rejectedReason
                            ? ` — ${item.rejectedReason}`
                            : ""}
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={record.consequences?.length}>
                  <div class="gov-card-section">
                    <div class="gov-card-label">Consequences</div>
                    <div class="gov-card-text">
                      {(record.consequences ?? []).join("; ")}
                    </div>
                  </div>
                </Show>
              </div>
            )}
          </For>
          <Show
            when={
              !liveDecisions().length && !(props.state.decisions ?? []).length
            }
          >
            <div class="neu-gov-empty">
              No decision.recorded for this session yet. Decisions appear when
              the model calls record_decision for an architecture or trade-off
              choice.
            </div>
          </Show>
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
              <div class="gov-card">
                <div class="gov-card-head">
                  <span class="neu-gov-title" data-priority={record.status}>
                    {record.status}
                  </span>
                  <span class="gov-card-meta">{record.taskID}</span>
                </div>
                <div class="gov-card-text">{record.objective}</div>
                <Show when={record.validations?.length}>
                  <div class="gov-card-section">
                    <div class="gov-card-label">Validations</div>
                    <For each={record.validations ?? []}>
                      {(validation: {
                        command: string;
                        result: string;
                        safeSummary: string;
                      }) => (
                        <div class="gov-card-text">
                          [{validation.result}] {validation.command} —{" "}
                          {validation.safeSummary}
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={record.changes?.length}>
                  <div class="gov-card-section">
                    <div class="gov-card-label">
                      Changes ({record.changes!.length})
                    </div>
                    <For each={record.changes ?? []}>
                      {(change: {
                        path: string;
                        changeType?: string;
                        summary?: string;
                      }) => (
                        <div class="gov-card-text">
                          {change.changeType ?? "change"}: {change.path}
                          {change.summary ? ` — ${change.summary}` : ""}
                        </div>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={record.knownGaps?.length}>
                  <div class="gov-card-section">
                    <div class="gov-card-label">Known gaps</div>
                    <div class="gov-card-text">
                      {(record.knownGaps ?? []).join("; ")}
                    </div>
                  </div>
                </Show>
              </div>
            )}
          </For>
          <Show
            when={
              !liveEvidence().length && !(props.state.evidence ?? []).length
            }
          >
            <div class="neu-gov-empty">
              No evidence.recorded for this session yet. Evidence appears after
              the model runs record_validation / record_completion or Nia
              submits an audit report.
            </div>
          </Show>
        </Show>
        <Show when={tab() === "completions"}>
          <For
            each={
              liveCompletions().length
                ? liveCompletions()
                : (props.state.completions ?? [])
            }
          >
            {(record) => (
              <div class="gov-card gov-completion-card">
                <div class="gov-card-head">
                  <span class="neu-gov-title" data-priority="validated">
                    {record.taskID}
                  </span>
                  <span class="gov-card-meta">{record.recordedAt}</span>
                </div>
                <div class="gov-card-section">
                  <div class="gov-card-label">Target</div>
                  <div class="gov-card-text">{record.objective}</div>
                </div>
                <div class="gov-card-section">
                  <div class="gov-card-label">Changes</div>
                  <div class="gov-card-text">{record.changeSummary}</div>
                </div>
                <Show when={record.behaviorImpact}>
                  <div class="gov-card-section">
                    <div class="gov-card-label">Behavior impact</div>
                    <div class="gov-card-text">{record.behaviorImpact}</div>
                  </div>
                </Show>
                <div class="gov-card-section">
                  <div class="gov-card-label">Validation matrix</div>
                  <Show
                    when={(record.validations ?? []).length}
                    fallback={
                      <div class="gov-card-text">
                        no validation recorded
                      </div>
                    }
                  >
                    <For each={record.validations ?? []}>
                      {(validation: {
                        command: string;
                        result: string;
                        safeSummary: string;
                      }) => (
                        <div class="gov-card-text">
                          [{validation.result}] {validation.command} —{" "}
                          {validation.safeSummary}
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
                <Show when={(record.knownGaps ?? []).length}>
                  <div class="gov-card-section">
                    <div class="gov-card-label">Known gaps</div>
                    <div class="gov-card-text">
                      {(record.knownGaps ?? []).join("; ")}
                    </div>
                  </div>
                </Show>
                <Show when={record.humanValidation}>
                  <div class="gov-card-section">
                    <div class="gov-card-label">Human validation</div>
                    <div class="gov-card-text">{record.humanValidation}</div>
                  </div>
                </Show>
                <Show when={(record.externalSideEffects ?? []).length}>
                  <div class="gov-card-section">
                    <div class="gov-card-label">External side effects</div>
                    <div class="gov-card-text">
                      {(record.externalSideEffects ?? []).join("; ")}
                    </div>
                  </div>
                </Show>
                <Show when={(record.evidenceIDs ?? []).length}>
                  <div class="gov-card-section">
                    <div class="gov-card-label">Evidence IDs</div>
                    <div class="gov-card-text">
                      {(record.evidenceIDs ?? []).join(", ")}
                    </div>
                  </div>
                </Show>
                <Show when={record.rollbackState}>
                  <div class="gov-card-section">
                    <div class="gov-card-label">Rollback</div>
                    <div class="gov-card-text">{record.rollbackState}</div>
                  </div>
                </Show>
              </div>
            )}
          </For>
          <Show
            when={
              !liveCompletions().length &&
              !(props.state.completions ?? []).length
            }
          >
            <div class="neu-gov-empty">
              No completion.recorded yet. A completion card appears after the
              model calls record_completion with its validation matrix.
            </div>
          </Show>
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
