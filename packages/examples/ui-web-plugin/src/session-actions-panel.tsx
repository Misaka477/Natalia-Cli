import { Show, onCleanup, onMount, For } from "solid-js";

const actions = [
  { id: "new", label: "新建会话", description: "创建一个新的空白会话" },
  { id: "fork", label: "Fork 当前会话", description: "复制当前会话并作为新分支" },
  { id: "snapshot", label: "创建快照", description: "保存当前会话状态，方便回滚" },
  { id: "rollback", label: "回滚到快照", description: "恢复到最近一次快照" },
];

export function SessionActionsPanel(props: {
  open: boolean;
  session: string;
  onClose: () => void;
  onNew?: () => unknown;
  onFork?: () => unknown;
  onSnapshot?: () => unknown;
  onRollback?: () => unknown;
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
        <div class="neu-session-window" onClick={(event) => event.stopPropagation()}>
          <div class="neu-settings-header">
            <span class="neu-settings-title">会话操作</span>
            <button
              type="button"
              class="neu-settings-close"
              onClick={props.onClose}
              aria-label="关闭会话操作"
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
          <div class="neu-session-current">
            当前会话：<strong>{props.session}</strong>
          </div>
          <div class="neu-session-actions">
            <For each={actions}>
              {(action) => (
                <button
                  type="button"
                  class="neu-session-action-row"
                  onClick={() => {
                    if (action.id === "new") props.onNew?.();
                    else if (action.id === "fork") props.onFork?.();
                    else if (action.id === "snapshot") props.onSnapshot?.();
                    else if (action.id === "rollback") props.onRollback?.();
                  }}
                >
                  <span class="neu-session-action-label">{action.label}</span>
                  <span class="neu-session-action-description">{action.description}</span>
                </button>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  );
}
