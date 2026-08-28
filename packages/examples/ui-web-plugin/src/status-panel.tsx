import { createSignal, Show, onCleanup, onMount, For } from "solid-js";
import type { AppState, CapabilityView, ToolBlock } from "@natalia/view-store";
import type { RuntimeClient, RuntimeDiagnostic, RuntimeStatusSnapshot } from "@natalia/contracts";

type Tab = "status" | "diagnostics" | "tools";

export function StatusPanel(props: {
  open: boolean;
  onClose: () => void;
  state: AppState;
  runtime?: RuntimeClient;
}) {
  const [tab, setTab] = createSignal<Tab>("status");
  const [statusData, setStatusData] = createSignal<RuntimeStatusSnapshot | undefined>();
  const [diagRows, setDiagRows] = createSignal<RuntimeDiagnostic[]>([]);

  onMount(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", handleKeydown);
    onCleanup(() => window.removeEventListener("keydown", handleKeydown));

    if (props.runtime) {
      void props.runtime.runtimeStatus?.().then((value) => setStatusData(value));
      void props.runtime.diagnostics?.().then((value) => {
        if (value) setDiagRows(value);
      });
    }
  });

  return (
    <Show when={props.open}>
      <div class="neu-settings-backdrop" onClick={props.onClose}>
        <div class="neu-status-window" onClick={(event) => event.stopPropagation()}>
          <div class="neu-settings-header">
            <span class="neu-settings-title">状态与诊断</span>
            <button
              type="button"
              class="neu-settings-close"
              onClick={props.onClose}
              aria-label="关闭状态与诊断"
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
          <div class="neu-status-tabs">
            <button
              type="button"
              class="neu-settings-category"
              data-active={tab() === "status"}
              onClick={() => setTab("status")}
            >
              运行时状态
            </button>
            <button
              type="button"
              class="neu-settings-category"
              data-active={tab() === "diagnostics"}
              onClick={() => setTab("diagnostics")}
            >
              诊断
            </button>
            <button
              type="button"
              class="neu-settings-category"
              data-active={tab() === "tools"}
              onClick={() => setTab("tools")}
            >
              工具与能力
            </button>
          </div>
          <div class="neu-status-content">
            <Show when={tab() === "status"}>
              <div class="neu-status-grid">
                <div class="neu-status-card">
                  <span class="neu-status-card-label">Runtime</span>
                  <span class="neu-status-card-value">{props.state.status}</span>
                </div>
                <div class="neu-status-card">
                  <span class="neu-status-card-label">当前模型</span>
                  <span class="neu-status-card-value">{statusData()?.model ?? props.state.modelSelection?.modelID ?? "未选择"}</span>
                </div>
                <div class="neu-status-card">
                  <span class="neu-status-card-label">Provider</span>
                  <span class="neu-status-card-value">{statusData()?.provider ?? "未选择"}</span>
                </div>
                <div class="neu-status-card">
                  <span class="neu-status-card-label">工作区</span>
                  <span class="neu-status-card-value">{statusData()?.cwd ?? "unknown"}</span>
                </div>
                <div class="neu-status-card">
                  <span class="neu-status-card-label">会话</span>
                  <span class="neu-status-card-value">{props.state.sessionID ?? "无"}</span>
                </div>
                <div class="neu-status-card">
                  <span class="neu-status-card-label">上下文</span>
                  <span class="neu-status-card-value">{statusData()?.context ?? "—"}</span>
                </div>
              </div>
            </Show>
            <Show when={tab() === "diagnostics"}>
              <div class="neu-status-diagnostics">
                <For each={diagRows()}>
                  {(item) => (
                    <div class="neu-diagnostic-row" data-level={item.level}>
                      <span class="neu-diagnostic-level">{item.level}</span>
                      <span class="neu-diagnostic-message">{item.message}</span>
                      <span class="neu-diagnostic-time">{item.at ?? ""}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
            <Show when={tab() === "tools"}>
              <div class="neu-status-tools">
                <div class="neu-status-section-title">工具</div>
                <For each={Object.values(props.state.tools)}>
                  {(tool: ToolBlock) => (
                    <div class="neu-status-tool-row">
                      <span class="neu-status-tool-name">{tool.name}</span>
                      <span class="neu-status-tool-description">{tool.summary}</span>
                      <span class="neu-status-tool-status">{tool.status}</span>
                    </div>
                  )}
                </For>
                <div class="neu-status-section-title">能力</div>
                <For each={Object.values(props.state.capabilities)}>
                  {(cap: CapabilityView) => (
                    <div class="neu-status-cap-row">
                      <span class="neu-status-cap-name">{cap.name ?? cap.id}</span>
                      <span class="neu-status-cap-version">v{cap.version}</span>
                      <span class="neu-status-cap-grants">{(cap.grants ?? []).join(" · ")}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
