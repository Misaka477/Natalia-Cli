import { Show, createSignal, onCleanup, onMount } from "solid-js";

export function WorkspacePanel(props: {
  open: boolean;
  onClose: () => void;
  onAdd?: (path: string) => unknown;
}) {
  const [path, setPath] = createSignal("");

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
        <div class="neu-workspace-window" onClick={(event) => event.stopPropagation()}>
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
            <input
              class="neu-form-input"
              value={path()}
              placeholder="工作区路径，例如 /home/user/project"
              onInput={(event) => setPath(event.currentTarget.value)}
            />
            <div class="neu-form-actions">
              <button type="button" class="neu-form-btn neu-form-cancel" onClick={props.onClose}>取消</button>
              <button
                type="button"
                class="neu-form-btn neu-form-primary"
                onClick={() => {
                  props.onAdd?.(path().trim());
                  props.onClose();
                  setPath("");
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
