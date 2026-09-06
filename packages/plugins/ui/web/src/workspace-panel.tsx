import { Show, createSignal, onCleanup, onMount, For } from "solid-js";
import type { WorkspaceSummary } from "@natalia/contracts";

export function WorkspacePanel(props: {
  open: boolean;
  onClose: () => void;
  onAdd?: (path: string) => Promise<void> | void;
  onActivate?: (workspaceID: string) => Promise<void> | void;
  onRemove?: (workspaceID: string) => Promise<void> | void;
  workspaces?: WorkspaceSummary[];
  error?: string;
}) {
  const [path, setPath] = createSignal("");
  const [busy, setBusy] = createSignal(false);
  const [localError, setLocalError] = createSignal("");

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
          class="neu-workspace-window"
          onClick={(event) => event.stopPropagation()}
        >
          <div class="neu-settings-header">
            <span class="neu-settings-title">添加工作区</span>
            <button
              type="button"
              class="neu-settings-close"
              onClick={props.onClose}
              aria-label="关闭添加工作区"
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
          <div class="neu-workspace-body">
            <Show when={props.error || localError()}>
              <div class="neu-workspace-error">
                {props.error || localError()}
              </div>
            </Show>
            <Show when={props.workspaces?.length}>
              <div class="neu-form-section-title">已添加工作区</div>
              <div class="neu-workspace-list">
                <For each={props.workspaces ?? []}>
                  {(workspace) => (
                    <div class="neu-workspace-item">
                      <div class="neu-workspace-item-info">
                        <span class="neu-workspace-item-title">
                          {workspace.title}
                        </span>
                        <Show when={workspace.status === "active"}>
                          <span class="neu-workspace-item-badge">当前</span>
                        </Show>
                      </div>
                      <div class="neu-workspace-item-actions">
                        <button
                          type="button"
                          class="neu-form-btn neu-workspace-switch"
                          disabled={workspace.status === "active"}
                          onClick={() => {
                            void props.onActivate?.(workspace.workspaceID);
                          }}
                        >
                          切换
                        </button>
                        <button
                          type="button"
                          class="neu-form-btn neu-workspace-remove"
                          onClick={() => {
                            void props.onRemove?.(workspace.workspaceID);
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <input
              class="neu-form-input"
              value={path()}
              placeholder="工作区路径，例如 /home/user/project"
              onInput={(event) => setPath(event.currentTarget.value)}
            />
            <Show when={busy()}>
              <div class="neu-workspace-error">正在添加工作区…</div>
            </Show>
            <div class="neu-form-actions">
              <button
                type="button"
                class="neu-form-btn neu-form-cancel"
                onClick={props.onClose}
                disabled={busy()}
              >
                取消
              </button>
              <button
                type="button"
                class="neu-form-btn neu-form-primary"
                onClick={() => {
                  if (busy()) return;
                  const trimmed = path().trim();
                  if (!trimmed) return;
                  setBusy(true);
                  setLocalError("");
                  const result = props.onAdd?.(trimmed);
                  if (
                    !result ||
                    typeof (result as Promise<void>).then !== "function"
                  ) {
                    setBusy(false);
                    setLocalError(
                      "内部错误：添加请求未返回 Promise，请查看控制台",
                    );
                    return;
                  }
                  void (result as Promise<void>)
                    .then(() => {
                      setBusy(false);
                      props.onClose();
                      setPath("");
                    })
                    .catch(() => {
                      setBusy(false);
                      // Keep the panel open so the error prop can render.
                    });
                }}
              >
                添加
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
}
