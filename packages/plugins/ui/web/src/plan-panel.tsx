import { For, Show, createMemo, createSignal, onMount } from "solid-js";
import { marked } from "marked";
import type { RuntimeClient } from "@natalia/contracts";
import type { AppState } from "@natalia/view-store";

type PlanRow = {
  planID: string;
  title: string;
  documentPath: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  markedAt?: string;
};

function MarkdownPreview(props: { content: string }) {
  const html = createMemo(
    () => marked.parse(props.content ?? "") as string,
  );
  return <div class="plan-panel-preview markdown-body" innerHTML={html()} />;
}

export function PlanPanel(props: { state: AppState; runtime?: RuntimeClient }) {
  const [selectedID, setSelectedID] = createSignal<string | undefined>();
  const [draft, setDraft] = createSignal("");
  const [preview, setPreview] = createSignal(false);
  const [notice, setNotice] = createSignal("");
  const [error, setError] = createSignal("");
  const [saving, setSaving] = createSignal(false);
  const [markPath, setMarkPath] = createSignal("");
  const [localPlans, setLocalPlans] = createSignal<PlanRow[]>([]);

  const plans = createMemo(() =>
    localPlans().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );
  const selected = createMemo(() =>
    plans().find((plan) => plan.planID === selectedID()) ?? plans()[0],
  );

  async function refreshPlans() {
    try {
      const list = (await props.runtime?.planDocList?.()) ?? [];
      setLocalPlans(
        list.map((plan) => ({
          ...plan,
          createdBy: plan.createdBy,
        })),
      );
    } catch {
      // Keep the current list if the runtime is not ready yet.
    }
  }

  onMount(() => {
    void refreshPlans();
  });

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
      await refreshPlans();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function newPlan() {
    const id = `plan_${Date.now().toString(36)}`;
    const path = `.natalia/plans/${id}.md`;
    const title = `新计划 ${id}`;
    try {
      await props.runtime?.planDocWrite?.({
        path,
        title,
        content: `# ${title}

## 目标


## 步骤


## 验证


## 总结

`,
      });
      const result = await props.runtime?.planDocMark?.({
        path,
        title,
      });
      setNotice(
        result?.marked && result.planID
          ? `已创建并标记为 Plan：${result.planID}`
          : "创建未生效",
      );
      setMarkPath("");
      setError("");
      setSelectedID(result?.planID);
      setPreview(false);
      await refreshPlans();
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
      <div class="review-section-label">计划文档</div>
      <div class="review-checkpoint-rename">
        <input
          class="review-checkpoint-rename-input"
          type="text"
          placeholder="输入 .natalia/plans/ 下的 Markdown 文件路径"
          value={markPath()}
          onInput={(event) => setMarkPath(event.currentTarget.value)}
        />
        <button
          type="button"
          class="plan-panel-btn"
          onClick={() => void markPlan()}
        >
          标记为 Plan
        </button>
        <button
          type="button"
          class="plan-panel-btn"
          onClick={() => void newPlan()}
        >
          新建
        </button>
      </div>
      <Show when={!plans().length}>
        <div class="agent-empty-full">
          <div class="review-empty-icon">📄</div>
          <div class="review-empty-title">暂无计划文档</div>
          <div class="review-empty-desc">
            可手动新建计划文档，或先用 Navi 写入 .natalia/plans/ 下的 Markdown 文件，再在这里标记为 Plan。
          </div>
        </div>
      </Show>
      <Show when={plans().length}>
        <div class="agent-layout">
          <div class="agent-sidebar">
            <div class="review-section-label">已标记 Plan</div>
            <For each={plans()}>
              {(plan) => (
                <button
                  type="button"
                  class="agent-card"
                  data-active={selected()?.planID === plan.planID}
                  onClick={() => selectPlan(plan.planID)}
                >
                  <div class="agent-card-title">{plan.title}</div>
                  <div class="agent-card-status">{plan.status}</div>
                  <div class="agent-card-detail">{plan.documentPath}</div>
                </button>
              )}
            </For>
          </div>
          <div class="agent-stream">
            <Show when={selected()} fallback={<div class="agent-empty">先选择或标记一个 Plan</div>}>
              <div class="agent-stream-header">
                <div class="agent-stream-title">{selected()!.title}</div>
                <div class="agent-stream-meta">
                  {selected()!.planID} · {selected()!.documentPath}
                </div>
              </div>
              <div class="plan-panel-doc-buttons">
                <button
                  type="button"
                  class="plan-panel-btn"
                  onClick={() => void saveSelected()}
                  disabled={saving()}
                >
                  保存
                </button>
                <button
                  type="button"
                  class="plan-panel-btn"
                  onClick={() => setPreview(!preview())}
                >
                  {preview() ? "编辑" : "预览"}
                </button>
                <button
                  type="button"
                  class="plan-panel-btn"
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
                <MarkdownPreview content={draft()} />
              </Show>
            </Show>
          </div>
        </div>
      </Show>
      <Show when={notice()}>
        <div class="plan-panel-notice">{notice()}</div>
      </Show>
      <Show when={error()}>
        <div class="plan-panel-error">{error()}</div>
      </Show>
    </div>
  );
}
