import { Show, onCleanup, onMount, For } from "solid-js";

const checkpoints = [
  { id: "ckpt-20260828-1", time: "10:24", summary: "修复 rollback 前", status: "可回滚" },
  { id: "ckpt-20260828-2", time: "10:31", summary: "检查 diff 后", status: "当前" },
  { id: "ckpt-20260828-3", time: "10:38", summary: "完成第一轮验证", status: "可回滚" },
];

export function CheckpointPanel(props: {
  open: boolean;
  session: string;
  onClose: () => void;
}) {
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
        <div class="neu-checkpoint-window" onClick={(event) => event.stopPropagation()}>
          <div class="neu-settings-header">
            <span class="neu-settings-title">Checkpoint 管理</span>
            <button
              type="button"
              class="neu-settings-close"
              onClick={props.onClose}
              aria-label="关闭 Checkpoint 管理"
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
          <div class="neu-checkpoint-current">
            当前会话：<strong>{props.session}</strong>
          </div>
          <div class="neu-checkpoint-list">
            <For each={checkpoints}>
              {(checkpoint) => (
                <div class="neu-checkpoint-row">
                  <div class="neu-checkpoint-main">
                    <span class="neu-checkpoint-title">
                      {checkpoint.summary}
                      <span class="neu-checkpoint-time">{checkpoint.time}</span>
                    </span>
                    <span class="neu-checkpoint-id">{checkpoint.id}</span>
                  </div>
                  <span class="neu-checkpoint-status" data-current={checkpoint.status === "当前"}>
                    {checkpoint.status}
                  </span>
                  <button type="button" class="neu-checkpoint-action" disabled={checkpoint.status === "当前"}>
                    回滚
                  </button>
                </div>
              )}
            </For>
          </div>
          <div class="neu-checkpoint-actions">
            <button type="button" class="neu-checkpoint-create">创建 Checkpoint</button>
          </div>
        </div>
      </div>
    </Show>
  );
}
