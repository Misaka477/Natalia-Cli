import { Show, createSignal, onCleanup, onMount } from "solid-js";

export function PermissionPanel(props: {
  open: boolean;
  onClose: () => void;
}) {
  const [rejecting, setRejecting] = createSignal(false);
  const [reason, setReason] = createSignal("");

  onMount(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", handleKeydown);
    onCleanup(() => window.removeEventListener("keydown", handleKeydown));
  });

  function reject() {
    setRejecting(true);
  }

  function rejectNow() {
    props.onClose();
  }

  function rejectWithReason() {
    props.onClose();
  }

  return (
    <Show when={props.open}>
      <div class="neu-settings-backdrop" onClick={props.onClose}>
        <div class="neu-permission-window" onClick={(event) => event.stopPropagation()}>
          <div class="neu-settings-header">
            <span class="neu-settings-title">权限请求</span>
            <button
              type="button"
              class="neu-settings-close"
              onClick={props.onClose}
              aria-label="关闭权限请求"
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
          <div class="neu-permission-body">
            <div class="neu-permission-tool">
              <span class="neu-permission-tool-name">bash</span>
              <span class="neu-permission-tool-badge">需审批</span>
            </div>
            <div class="neu-permission-command">
              <span class="neu-permission-label">命令</span>
              <pre class="neu-permission-command-text">rm -rf dist</pre>
            </div>
            <div class="neu-permission-info">
              <span>工作区：/home/aquama/Development/Natalia_Project/natalia-cli</span>
              <span>来源：Main Agent</span>
            </div>
          </div>
          <Show
            when={!rejecting()}
            fallback={
              <div class="neu-permission-reject-box">
                <div class="neu-permission-reject-title">拒绝原因（可选）</div>
                <textarea
                  class="neu-permission-reason"
                  value={reason()}
                  placeholder="例如：这个命令会删除构建产物，需要人工确认"
                  onInput={(event) => setReason(event.currentTarget.value)}
                />
                <div class="neu-permission-actions">
                  <button
                    type="button"
                    class="neu-permission-btn neu-permission-deny"
                    onClick={rejectNow}
                  >
                    直接拒绝
                  </button>
                  <button
                    type="button"
                    class="neu-permission-btn neu-permission-reject-submit"
                    onClick={rejectWithReason}
                  >
                    提交原因并拒绝
                  </button>
                </div>
              </div>
            }
          >
            <div class="neu-permission-actions">
              <button
                type="button"
                class="neu-permission-btn neu-permission-deny"
                onClick={reject}
              >
                拒绝
              </button>
              <button
                type="button"
                class="neu-permission-btn neu-permission-allow"
                onClick={props.onClose}
              >
                允许一次
              </button>
              <button
                type="button"
                class="neu-permission-btn neu-permission-allow-session"
                onClick={props.onClose}
              >
                允许本次会话
              </button>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
