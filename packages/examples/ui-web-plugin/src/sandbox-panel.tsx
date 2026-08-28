import { createSignal, Show, onCleanup, onMount, For } from "solid-js";

type Sandbox = {
  id: string;
  isolationLevel: string;
  changedFiles: number;
  resources: Array<{ id: string; status: string; command: string }>;
};

const sandboxes: Sandbox[] = [
  {
    id: "sb-20260828-01",
    isolationLevel: "workspace",
    changedFiles: 3,
    resources: [
      { id: "dev-server", status: "running", command: "bun run dev" },
      { id: "test-runner", status: "stopped", command: "bun test" },
    ],
  },
  {
    id: "sb-20260828-02",
    isolationLevel: "workspace",
    changedFiles: 0,
    resources: [],
  },
];

export function SandboxPanel(props: { open: boolean; onClose: () => void }) {
  const [selected, setSelected] = createSignal<Sandbox | null>(null);

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
        <div class="neu-sandbox-window" onClick={(event) => event.stopPropagation()}>
          <div class="neu-settings-header">
            <span class="neu-settings-title">沙箱管理</span>
            <button
              type="button"
              class="neu-settings-close"
              onClick={props.onClose}
              aria-label="关闭沙箱管理"
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
          <div class="neu-sandbox-body">
            <Show when={!selected()}>
              <For each={sandboxes}>
                {(sandbox) => (
                  <button type="button" class="neu-flow-card" onClick={() => setSelected(sandbox)}>
                    <span class="neu-flow-card-title">{sandbox.id}</span>
                    <span class="neu-flow-card-meta">
                      {sandbox.isolationLevel} · {sandbox.changedFiles} changes · {sandbox.resources.length} resources
                    </span>
                  </button>
                )}
              </For>
              <div class="neu-extension-actions">
                <button type="button" class="neu-extension-add">新建沙箱</button>
              </div>
            </Show>
            <Show when={selected()}>
              <button type="button" class="neu-flow-back" onClick={() => setSelected(null)}>← 返回</button>
              <div class="neu-flow-detail-title">{selected()?.id}</div>
              <div class="neu-flow-detail-field">{selected()?.isolationLevel} isolation · {selected()?.changedFiles} pending changes</div>
              <div class="neu-flow-section-title">Changes</div>
              <Show when={selected()?.changedFiles ?? 0 > 0}>
                <div class="neu-sandbox-change">3 个待合并变更</div>
              </Show>
              <div class="neu-flow-section-title">Resources</div>
              <For each={selected()?.resources ?? []}>
                {(resource) => (
                  <div class="neu-flow-module">
                    <div class="neu-flow-module-head">
                      <span class="neu-flow-module-name">{resource.id}</span>
                      <span class="neu-flow-module-type">{resource.command}</span>
                      <span class="neu-flow-module-enabled" data-enabled={resource.status === "running"}>
                        {resource.status}
                      </span>
                    </div>
                  </div>
                )}
              </For>
              <div class="neu-form-actions">
                <button type="button" class="neu-form-btn neu-form-cancel">合并变更</button>
                <button type="button" class="neu-form-btn neu-form-cancel">停止资源</button>
                <button type="button" class="neu-form-btn neu-form-primary">删除沙箱</button>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
