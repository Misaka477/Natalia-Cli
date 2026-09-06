import { Show, createSignal, onCleanup, onMount } from "solid-js";
import type { RuntimeClient } from "@natalia/contracts";

export function PermissionPanel(props: {
  open: boolean;
  approval: {
    id: string;
    title: string;
    preview: string;
    detail?: string;
  } | null;
  runtime?: Pick<RuntimeClient, "respondApproval">;
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

  function respond(decision: "once" | "session" | "reject", feedback?: string) {
    if (!props.approval) return;
    props.runtime?.respondApproval?.({
      requestID: props.approval.id,
      decision,
      ...(feedback ? { feedback } : {}),
    });
    props.onClose();
  }

  function rejectReason() {
    respond("reject", reason().trim() || undefined);
  }

  return (
    <Show when={props.open}>
      <div class="neu-settings-backdrop" onClick={props.onClose}>
        <div
          class="neu-permission-window"
          onClick={(event) => event.stopPropagation()}
        >
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
              <span class="neu-permission-tool-name">
                {props.approval?.title ?? "权限请求"}
              </span>
              <span class="neu-permission-tool-badge">需审批</span>
            </div>
            <div class="neu-permission-command">
              <span class="neu-permission-label">预览</span>
              <pre class="neu-permission-command-text">
                {props.approval?.preview ?? "等待模型请求权限..."}
              </pre>
            </div>
            <div class="neu-permission-info">
              {props.approval?.detail ? (
                <span>{props.approval.detail}</span>
              ) : (
                <span>来源：运行时</span>
              )}
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
                    onClick={() => respond("reject")}
                  >
                    直接拒绝
                  </button>
                  <button
                    type="button"
                    class="neu-permission-btn neu-permission-reject-submit"
                    onClick={rejectReason}
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
                onClick={() => setRejecting(true)}
              >
                拒绝
              </button>
              <button
                type="button"
                class="neu-permission-btn neu-permission-allow"
                onClick={() => respond("once")}
              >
                允许一次
              </button>
              <button
                type="button"
                class="neu-permission-btn neu-permission-allow-session"
                onClick={() => respond("session")}
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
