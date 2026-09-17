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
 * How many activity refs / evidence lines a drift card shows before it offers a
 * "view all" toggle. The truncation here is presentation-only and always paired
 * with a reveal path: the evaluator keeps the full list (see its activity cap),
 * so "view all" always has everything to show. Truncation without a reveal path
 * is not allowed.
 */
export const DRIFT_COLLAPSE_LIMIT = 6;

/** Split a comma-joined activity string into trimmed, non-empty refs. */
export function splitActivityRefs(text: string): string[] {
  return text
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * Collapse a long list to its first `limit` entries, reporting how many are
 * hidden so the card can render a "view all (+N)" toggle. A list that already
 * fits (or an expanded one) is returned whole with hiddenCount 0. Pure so the
 * collapse contract is unit-testable without a DOM; the caller owns the flag.
 */
export function collapseList<T>(
  items: readonly T[],
  expanded: boolean,
  limit: number = DRIFT_COLLAPSE_LIMIT,
): { shown: readonly T[]; hiddenCount: number } {
  if (expanded || items.length <= limit) {
    return { shown: items, hiddenCount: 0 };
  }
  return { shown: items.slice(0, limit), hiddenCount: items.length - limit };
}

/**
 * The per-tab data bundle the governance pane renders. Kept outside the
 * component so a headless host can verify data, empty and failure states
 * without a DOM.
 */
export type GovernanceSliceBundle = {
  constitution: any[];
  docRules: any[];
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
  options: {
    decisionScope?: "session" | "workspace" | "all";
  } = {},
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
  const [
    constitution,
    docRules,
    decisions,
    evidence,
    completions,
    drift,
    notices,
  ] = await Promise.all([
      loadSlice(
        "Constitution",
        () => runtime?.constitutionRules?.(sessionID) ?? Promise.resolve([]),
      ),
      loadSlice(
        "ConstitutionDocs",
        () =>
          runtime?.constitutionDocRules?.(sessionID) ?? Promise.resolve([]),
      ),
      loadSlice(
        "Decisions",
        () =>
          runtime?.decisionRecords?.({
            ...(sessionID ? { sessionID } : {}),
            scope: options.decisionScope ?? "session",
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
    docRules,
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
  status: "explained" | "disputed" | "dismissed",
  rationale?: string,
) {
  return runtime?.acknowledgeDriftFinding?.(
    { findingID, status, ...(rationale ? { rationale } : {}) },
    sessionID,
  );
}

/**
 * The RPC action behind a drift card's [重新打开] (reopen / 翻案) button — a
 * user-only lift of a dismissed/explained finding back to open. A headless
 * test can call the same function a click invokes.
 */
export async function reopenDriftFindingViaRpc(
  runtime: RuntimeClient | undefined,
  sessionID: string | undefined,
  findingID: string,
) {
  return runtime?.reopenDriftFinding?.({ findingID }, sessionID);
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

/** The RPC action behind a constitution document-rule promote click. */
export async function promoteConstitutionDocRuleViaRpc(
  runtime: RuntimeClient | undefined,
  sessionID: string | undefined,
  id: string,
) {
  return runtime?.promoteConstitutionDocRule?.({ id }, sessionID);
}

/** The RPC action behind the [新增规则] button (user creates a rule). */
export async function createConstitutionRuleViaRpc(
  runtime: RuntimeClient | undefined,
  sessionID: string | undefined,
  input: {
    statement: string;
    enforcement: "deny" | "approval" | "warn";
    scope?: "project" | "package";
    appliesTo?: {
      tools?: string[];
      paths?: string[];
      commandPattern?: string;
    };
    priority?: "critical" | "high" | "medium" | "low";
  },
) {
  return runtime?.createConstitutionRule?.(input, sessionID);
}

/** The RPC action behind a constitution rule [编辑] (tighten/edit) click. */
export async function editConstitutionRuleViaRpc(
  runtime: RuntimeClient | undefined,
  sessionID: string | undefined,
  input: {
    ruleID: string;
    statement?: string;
    enforcement?: "deny" | "approval" | "warn";
    priority?: "critical" | "high" | "medium" | "low";
    appliesTo?: {
      tools?: string[];
      paths?: string[];
      commandPattern?: string;
    };
  },
) {
  return runtime?.updateConstitutionRule?.(input, sessionID);
}

/**
 * One drift finding card (EI Phase 2 / §3.5). A finding is a suspicion, not a
 * verdict — the card is a read-only audit view (finding + rationale + status
 * transitions) with the minimal user exits. The two long lists it can carry
 * (the Current activity refs and the Evidence lines) collapse to a few entries
 * with a "view all" toggle: the data layer keeps them whole, so the reveal path
 * always has everything to show. Extracted as its own component so each card
 * owns its expand state locally (no per-card bookkeeping in the pane).
 */
function DriftCard(props: {
  finding: any;
  resolveContract: (planID?: string) => any;
  actionBusy: () => boolean;
  onAcknowledge: (
    findingID: string,
    status: "explained" | "disputed" | "dismissed",
    rationale?: string,
  ) => void;
  onReopen: (findingID: string) => void;
}) {
  const [activityExpanded, setActivityExpanded] = createSignal(false);
  const [evidenceExpanded, setEvidenceExpanded] = createSignal(false);
  const finding = () => props.finding;

  const activityRefs = () => splitActivityRefs(finding().currentActivity ?? "");
  const activityView = () => collapseList(activityRefs(), activityExpanded());
  const evidenceItems = (): any[] => finding().evidence ?? [];
  const evidenceView = () => collapseList(evidenceItems(), evidenceExpanded());

  return (
    <div class="drift-card">
      <div class="drift-card-head">
        <span class="neu-gov-title" data-priority={finding().severity}>
          {finding().severity} · {Math.round(finding().confidence * 100)}%
        </span>
        <span class="drift-card-status" data-status={finding().status}>
          {finding().status}
        </span>
        <Show when={(finding().reopenedCount ?? 0) > 0}>
          <span class="drift-card-reopened">
            已翻案 {finding().reopenedCount} 次
          </span>
        </Show>
      </div>
      <div class="drift-card-goal">Goal: {finding().originalObjective}</div>
      <Show when={finding().planID}>
        <div class="drift-card-meta">Plan: {finding().planID}</div>
      </Show>
      <Show when={props.resolveContract(finding().planID)}>
        {(contract) => (
          <div class="drift-card-section">
            <div class="drift-card-section-title">Reference frame</div>
            <Show when={contract().scope?.length}>
              <div class="drift-card-evidence">
                scope: {contract().scope!.join(", ")}
              </div>
            </Show>
            <Show when={contract().verification?.length}>
              <div class="drift-card-evidence">
                verification: {contract().verification!.join(", ")}
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
        Current: {activityView().shown.join(", ")}
        <Show when={activityView().hiddenCount > 0 || activityExpanded()}>
          <button
            type="button"
            class="drift-card-expand"
            onClick={() => setActivityExpanded(!activityExpanded())}
          >
            {activityExpanded()
              ? "收起"
              : `展开全部 (+${activityView().hiddenCount})`}
          </button>
        </Show>
      </div>
      <Show
        when={
          ruleHitsFor(finding()).length ||
          finding().contractVersion !== undefined
        }
      >
        <div class="drift-card-section">
          <div class="drift-card-section-title">Why this fired</div>
          <Show when={finding().contractVersion !== undefined}>
            <div class="drift-card-meta">
              contract v{finding().contractVersion}
            </div>
          </Show>
          <For each={ruleHitsFor(finding())}>
            {(hit) => (
              <div class="drift-card-rule">
                {hit.rule} · {Math.round(hit.confidence * 100)}%
              </div>
            )}
          </For>
        </div>
      </Show>
      <Show when={evidenceItems().length}>
        <div class="drift-card-section">
          <div class="drift-card-section-title">Evidence</div>
          <For each={evidenceView().shown}>
            {(item) => <div class="drift-card-evidence">{item}</div>}
          </For>
          <Show when={evidenceView().hiddenCount > 0 || evidenceExpanded()}>
            <button
              type="button"
              class="drift-card-expand"
              onClick={() => setEvidenceExpanded(!evidenceExpanded())}
            >
              {evidenceExpanded()
                ? "收起"
                : `展开全部 evidence (+${evidenceView().hiddenCount})`}
            </button>
          </Show>
        </div>
      </Show>
      <Show when={finding().applicableConstraints?.length}>
        <div class="drift-card-section">
          <div class="drift-card-section-title">Constraints</div>
          <For each={finding().applicableConstraints}>
            {(item) => <div class="drift-card-evidence">{item}</div>}
          </For>
        </div>
      </Show>
      <Show when={finding().rationale}>
        <div class="drift-card-rationale">{finding().rationale}</div>
      </Show>
      <Show when={finding().status === "open"}>
        <div class="drift-card-actions">
          <button
            type="button"
            class="drift-card-btn"
            disabled={props.actionBusy()}
            onClick={() => props.onAcknowledge(finding().findingID, "explained")}
          >
            解释
          </button>
          <button
            type="button"
            class="drift-card-btn"
            data-kind="dispute"
            disabled={props.actionBusy()}
            onClick={() => {
              const reason = window.prompt("声明这是误报，给出理由：");
              if (reason?.trim())
                props.onAcknowledge(
                  finding().findingID,
                  "disputed",
                  reason.trim(),
                );
            }}
          >
            误报
          </button>
          <button
            type="button"
            class="drift-card-btn"
            data-kind="dismiss"
            disabled={props.actionBusy()}
            onClick={() =>
              props.onAcknowledge(finding().findingID, "dismissed")
            }
          >
            忽略
          </button>
        </div>
      </Show>
      <Show
        when={
          finding().status === "dismissed" || finding().status === "explained"
        }
      >
        <div class="drift-card-actions">
          <button
            type="button"
            class="drift-card-btn"
            data-kind="reopen"
            disabled={props.actionBusy()}
            onClick={() => props.onReopen(finding().findingID)}
          >
            重新打开
          </button>
        </div>
      </Show>
    </div>
  );
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
  const [liveDocRules, setLiveDocRules] = createSignal<any[]>([]);
  const [liveDecisions, setLiveDecisions] = createSignal<any[]>([]);
  const [decisionScope, setDecisionScope] = createSignal<
    "session" | "workspace" | "all"
  >("session");
  const [liveEvidence, setLiveEvidence] = createSignal<any[]>([]);
  const [liveCompletions, setLiveCompletions] = createSignal<any[]>([]);
  const [liveDrift, setLiveDrift] = createSignal<any[]>([]);
  // ADR Phase C: the projected runtime notices (dual ingestion — the live
  // event stream and the server-projected contract converge here).
  const [liveNotices, setLiveNotices] = createSignal<any[]>([]);
  const [loadErrors, setLoadErrors] = createSignal<string[]>([]);
  const [actionNotice, setActionNotice] = createSignal<string | undefined>();
  const [actionBusy, setActionBusy] = createSignal(false);
  // The constitution rule editor (add / edit a hard rule): the user owns these
  // rules, so the panel can create, tighten/edit and delete them.
  const [ruleEditor, setRuleEditor] = createSignal<
    | {
        mode: "add" | "edit";
        ruleID?: string;
        statement: string;
        enforcement: "deny" | "approval" | "warn";
        tools: string;
        paths: string;
        commandPattern: string;
      }
    | undefined
  >();
  const { confirm, dialog } = useConfirmDialog();

  const load = async () => {
    const bundle = await loadGovernanceSlices(props.runtime, props.sessionID, {
      decisionScope: decisionScope(),
    });
    setLiveConstitution(bundle.constitution);
    setLiveDocRules(bundle.docRules);
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
    void decisionScope();
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
    status: "explained" | "disputed" | "dismissed",
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

  function openRuleEditor(
    mode: "add" | "edit",
    rule?: { ruleID: string; statement: string; enforcement: string; appliesTo?: { tools?: string[]; paths?: string[]; commandPattern?: string } },
  ) {
    setActionNotice(undefined);
    setRuleEditor({
      mode,
      ...(rule ? { ruleID: rule.ruleID } : {}),
      statement: rule?.statement ?? "",
      enforcement: (rule?.enforcement as "deny" | "approval" | "warn") ?? "warn",
      tools: (rule?.appliesTo?.tools ?? []).join(", "),
      paths: (rule?.appliesTo?.paths ?? []).join(", "),
      commandPattern: rule?.appliesTo?.commandPattern ?? "",
    });
  }

  async function saveRule() {
    const editor = ruleEditor();
    if (!editor) return;
    setActionBusy(true);
    setActionNotice(undefined);
    try {
      const list = (value: string) =>
        value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean);
      const appliesTo = {
        ...(list(editor.tools).length ? { tools: list(editor.tools) } : {}),
        ...(list(editor.paths).length ? { paths: list(editor.paths) } : {}),
        ...(editor.commandPattern.trim()
          ? { commandPattern: editor.commandPattern.trim() }
          : {}),
      };
      const result =
        editor.mode === "add"
          ? await createConstitutionRuleViaRpc(props.runtime, props.sessionID, {
              statement: editor.statement,
              enforcement: editor.enforcement,
              ...(Object.keys(appliesTo).length ? { appliesTo } : {}),
            })
          : await editConstitutionRuleViaRpc(props.runtime, props.sessionID, {
              ruleID: editor.ruleID!,
              statement: editor.statement,
              enforcement: editor.enforcement,
              ...(Object.keys(appliesTo).length ? { appliesTo } : {}),
            });
      const outcome = result as
        | { created?: boolean; updated?: boolean; reason?: string }
        | undefined;
      const ok = editor.mode === "add" ? outcome?.created : outcome?.updated;
      setActionNotice(
        ok
          ? editor.mode === "add"
            ? "已新增规则"
            : "已更新规则"
          : `失败：${outcome?.reason ?? "未知原因"}`,
      );
      if (ok) setRuleEditor(undefined);
      await load();
    } catch (error) {
      setActionNotice(
        `失败：${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function reopenFinding(findingID: string) {
    setActionBusy(true);
    setActionNotice(undefined);
    try {
      const result = await reopenDriftFindingViaRpc(
        props.runtime,
        props.sessionID,
        findingID,
      );
      setActionNotice(
        result?.reopened
          ? `已翻案：${findingID} → open`
          : `无法翻案：${result?.reason ?? "未知原因"}`,
      );
      await load();
    } catch (error) {
      setActionNotice(
        `翻案失败：${error instanceof Error ? error.message : String(error)}`,
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
              <DriftCard
                finding={finding}
                resolveContract={contractFor}
                actionBusy={actionBusy}
                onAcknowledge={acknowledgeFinding}
                onReopen={reopenFinding}
              />
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
          <div class="constitution-toolbar">
            <button
              type="button"
              class="constitution-btn"
              disabled={actionBusy()}
              onClick={() => openRuleEditor("add")}
            >
              新增规则
            </button>
          </div>
          <Show when={ruleEditor()}>
            {(editor) => (
              <div class="constitution-editor">
                <input
                  class="constitution-input"
                  placeholder="规则内容（statement）"
                  value={editor().statement}
                  onInput={(event) =>
                    setRuleEditor({
                      ...editor(),
                      statement: event.currentTarget.value,
                    })
                  }
                />
                <div class="constitution-editor-row">
                  <select
                    class="constitution-input"
                    value={editor().enforcement}
                    onChange={(event) =>
                      setRuleEditor({
                        ...editor(),
                        enforcement: event.currentTarget.value as
                          | "deny"
                          | "approval"
                          | "warn",
                      })
                    }
                  >
                    <option value="warn">warn</option>
                    <option value="approval">approval</option>
                    <option value="deny">deny</option>
                  </select>
                  <input
                    class="constitution-input"
                    placeholder="tools（逗号分隔）"
                    value={editor().tools}
                    onInput={(event) =>
                      setRuleEditor({
                        ...editor(),
                        tools: event.currentTarget.value,
                      })
                    }
                  />
                  <input
                    class="constitution-input"
                    placeholder="paths（逗号分隔）"
                    value={editor().paths}
                    onInput={(event) =>
                      setRuleEditor({
                        ...editor(),
                        paths: event.currentTarget.value,
                      })
                    }
                  />
                  <input
                    class="constitution-input"
                    placeholder="commandPattern"
                    value={editor().commandPattern}
                    onInput={(event) =>
                      setRuleEditor({
                        ...editor(),
                        commandPattern: event.currentTarget.value,
                      })
                    }
                  />
                </div>
                <div class="constitution-editor-actions">
                  <button
                    type="button"
                    class="constitution-btn"
                    disabled={actionBusy()}
                    onClick={() => void saveRule()}
                  >
                    {editor().mode === "add" ? "新增" : "保存"}
                  </button>
                  <button
                    type="button"
                    class="constitution-btn"
                    onClick={() => setRuleEditor(undefined)}
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
          </Show>
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
                      disabled={actionBusy()}
                      onClick={() => openRuleEditor("edit", rule)}
                    >
                      编辑
                    </button>
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
          <Show when={liveDocRules().length}>
            <div class="neu-gov-section-label">文档规则（可提升）</div>
            <For each={liveDocRules()}>
              {(rule) => (
                <div class="constitution-row">
                  <div class="constitution-row-main">
                    <span class="neu-gov-title">{rule.section}</span>
                    <span class="neu-gov-text">{rule.statement}</span>
                    <span class="neu-gov-meta">
                      {rule.source} · {rule.enforcement}
                      {rule.annotated ? " · 已标注" : " · prose"}
                    </span>
                  </div>
                  <div class="constitution-row-actions">
                    <button
                      type="button"
                      class="constitution-btn"
                      onClick={() =>
                        void (async () => {
                          const result =
                            await promoteConstitutionDocRuleViaRpc(
                              props.runtime,
                              props.sessionID,
                              rule.id,
                            );
                          setActionNotice(
                            result?.promoted
                              ? `已提升为正式规则 ${result.ruleID}`
                              : `提升失败：${result?.reason ?? "未知原因"}`,
                          );
                          await load();
                        })()
                      }
                    >
                      提升为正式规则
                    </button>
                  </div>
                </div>
              )}
            </For>
          </Show>
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
          <div class="gov-scope-switch">
            <button
              type="button"
              class="gov-scope-btn"
              data-active={decisionScope() === "session"}
              onClick={() => setDecisionScope("session")}
            >
              This session
            </button>
            <button
              type="button"
              class="gov-scope-btn"
              data-active={decisionScope() === "workspace"}
              onClick={() => setDecisionScope("workspace")}
            >
              Workspace
            </button>
          </div>
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
              No decision.recorded for this {decisionScope()} scope yet.
              Session decisions appear when the model calls record_decision;
              workspace decisions come from an explicit workspace promotion.
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
