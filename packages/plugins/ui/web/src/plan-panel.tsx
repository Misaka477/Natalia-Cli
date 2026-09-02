import { For, Show, createMemo, createSignal } from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";
import type { AppState } from "@natalia/view-store";

export function PlanPanel(props: { state: AppState; runtime?: RuntimeClient }) {
  const [selectedID, setSelectedID] = createSignal<string | undefined>();
  const [draft, setDraft] = createSignal("");
  const [preview, setPreview] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [error, setError] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [markPath, setMarkPath] = createSignal("");

  const plans = createMemo(() =>
    Object.values(props.state.plans ?? {}).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    ),
  );
  const selected = createMemo(() =>
    plans().find((plan) => plan.planID === selectedID()) ?? plans()[0],
  );

  async function readSelected() {
    const plan = selected();
    if (!plan) return;
    try {
      const result = await props.runtime?.planDocRead?.({ planID: plan.planID });
      setDraft(result?.content ?? "");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function saveSelected() {
    const plan = selected();
    if (!plan) return;
    setSaving(true);
    try {
      const result = await props.runtime?.planDocWrite?.({
        path: plan.documentPath,
        content: draft(),
        title: plan.title,
        planID: plan.planID,
      });
      setNotice(result?.written ? `已保存 ${plan.documentPath}` : "保存未生效");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  async function markPlan() {
    const path = markPath().trim();
    if (!path) {
      setError("请输入要标记为 Plan 的 Markdown 路径");
      return;
    }
    try {
      const result = await props.runtime?.planDocMark?.({ path });
      setNotice(
        result?.marked && result.planID
          ? `已标记为 Plan：${result.planID}`
          : "标记未生效",
      );
      setMarkPath("");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  function selectPlan(planID: string) {
    setSelectedID(planID);
    setPreview(false);
    void readSelected();
  }

  return (
    <div class="review-pane">
      <div class="review-header">
        <div class="review-title">
          <span>计划文档</span>
        </div>
        <div class="review-meta">
          <span class="review-count">{plans().length} plans</span>
        </div>
      </div>
      <Show
        when={plans().length || markPath()}
        fallback={
          <div class="agent-empty-full">
            <div class="review-empty-icon">📄</div>
            <div class="review-empty-title">暂无计划文档</div>
            <div class="review-empty-desc">
              先把 Markdown 计划文档写入 .natalia/plans/，再标记为 Plan。
            </div>
          </div>
        }
      >
        <div class="review-body">
          <div class="review-diff">
            <div class="review-diff-header">
              <span class="review-diff-path">已标记 Plan</span>
            </div>
            <div class="review-diff-content">
              <For each={plans()}>
                {(plan) => (
                  <div
                    class="todo-row"
                    data-active={selected()?.planID === plan.planID}
                    onClick={() => selectPlan(plan.planID)}
                  >
                    <span class="todo-dot" data-status={plan.status} />
                    <span class="todo-text">{plan.title}</span>
                    <span class="todo-status">{plan.status}</span>
                  </div>
                )}
              </For>
            </div>
          </div>
          <div class="review-diff">
            <div class="review-diff-header">
              <span class="review-diff-path">编辑器</span>
            </div>
            <div class="review-diff-content">
              <Show when={selected()} fallback={<div class="review-empty">先标记一个 Plan</div>}>
                <div class="plan-panel-doc-meta">
                  <span>{selected()!.planID}</span>
                  <span>{selected()!.documentPath}</span>
                </div>
                <div class="plan-panel-doc-buttons">
                  <button
                    type="button"
                    class="review-action"
                    onClick={() => void saveSelected()}
                    disabled={saving()}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    class="review-action"
                    onClick={() => setPreview(!preview())}
                  >
                    {preview() ? "编辑" : "预览"}
                  </button>
                  <button
                    type="button"
                    class="review-action"
                    onClick={() =>
                      void props.runtime?.planDocDelete?.(selected()!.planID)
                    }
                  >
                    删除标记
                  </button>
                </div>
                <Show
                  when={preview()}
                  fallback={
                    <textarea
                      class="plan-panel-editor"
                      value={draft()}
                      onInput={(event) => setDraft(event.currentTarget.value)}
                    />
                  }
                >
                  <pre class="plan-panel-preview">{draft()}</pre>
                </Show>
              </Show>
            </div>
          </div>
          <div class="plan-panel-mark-row">
            <input
              type="text"
              placeholder="输入 .natalia/plans/ 下的 Markdown 文件路径"
              value={markPath()}
              onInput={(event) => setMarkPath(event.currentTarget.value)}
            />
            <button type="button" class="review-action" onClick={() => void markPlan()}>
              标记为 Plan
            </button>
          </div>
          <Show when={notice()}>
            <div class="plan-panel-notice">{notice()}</div>
          </Show>
          <Show when={error()}>
            <div class="plan-panel-error">{error()}</div>
          </Show>
        </div>
      </Show>
    </div>
  );
}
