import { createSignal, For, Show, onMount } from "solid-js";
import type { RuntimeClient, RuntimeNativeTerminalSession } from "@natalia/contracts";

export type RightPanelTab = "review" | "terminal" | "browser" | "file";

export interface RightPanelProps {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelProps["activeTab"]) => void;
  width?: number;
}

const TABS: { id: RightPanelTab; label: string; icon: string }[] = [
  { id: "review", label: "审阅", icon: "diff" },
  { id: "terminal", label: "终端", icon: "terminal" },
  { id: "browser", label: "浏览器", icon: "browser" },
  { id: "file", label: "文件", icon: "file" },
];

export function RightPanel(props: RightPanelProps) {
  return (
    <aside
      class="right-panel"
      style={{ width: props.width ? `${props.width}px` : undefined }}
    >
      <div class="right-panel-tabs">
        <For each={TABS}>
          {(tab) => (
            <button
              type="button"
              class="right-panel-tab"
              data-active={props.activeTab === tab.id}
              onClick={() => props.onTabChange(tab.id)}
            >
              <span class="right-panel-tab-icon">
                {tab.icon === "diff"
                  ? "⊞"
                  : tab.icon === "terminal"
                    ? ">_"
                    : tab.icon === "browser"
                      ? "◎"
                      : tab.icon === "file"
                        ? "☰"
                        : "💬"}
              </span>
              <span class="right-panel-tab-label">{tab.label}</span>
            </button>
          )}
        </For>
      </div>
      <div class="right-panel-content">
        <Show when={props.activeTab === "review"}>
          <ReviewPane />
        </Show>
        <Show when={props.activeTab === "terminal"}>
          <TerminalPane />
        </Show>
        <Show when={props.activeTab === "browser"}>
          <BrowserPane />
        </Show>
        <Show when={props.activeTab === "file"}>
          <FilePane />
        </Show>
      </div>
    </aside>
  );
}
export function ReviewPane(props: { runtime?: RuntimeClient } = {}) {
  const [changes, setChanges] = createSignal<Array<{
    id: string;
    path: string;
    operation: "added" | "modified" | "deleted" | "renamed";
    origin: string;
    health: string;
    at: string;
  }>>([]);
  const [drift, setDrift] = createSignal<Array<{
    findingID: string;
    severity: string;
    status: string;
    currentActivity: string;
    evidence: string[];
  }>>([]);
  const [loaded, setLoaded] = createSignal(false);

  onMount(() => {
    void Promise.all([
      props.runtime?.confirmedWorkspaceChanges?.() ?? Promise.resolve([]),
      props.runtime?.driftFindings?.() ?? Promise.resolve([]),
    ]).then(([confirmed, driftFindings]) => {
      const mapped = (confirmed ?? []).map((change) => ({
        id: change.id,
        path: change.path,
        operation: change.operation,
        origin: change.origin,
        health: change.health,
        at: change.at,
      }));
      setChanges(mapped);
      setDrift((driftFindings ?? []).map((item) => ({
        findingID: item.findingID,
        severity: item.severity,
        status: item.status,
        currentActivity: item.currentActivity,
        evidence: item.evidence,
      })));
      setLoaded(true);
    });
  });

  const totalFiles = () => changes().length;
  const additions = () =>
    changes().filter((item) => item.operation === "added").length;
  const deletions = () =>
    changes().filter((item) => item.operation === "deleted").length;

  return (
    <div class="review-pane">
      <div class="review-header">
        <div class="review-title">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 5C2 3.89543 2.89543 3 4 3H6.5L8 4.5H10C11.1046 4.5 12 5.39543 12 6.5V10C12 11.1046 11.1046 12 10 12H4C2.89543 12 2 11.1046 2 10V5Z"
              stroke="currentColor"
              stroke-width="1.2"
            />
            <path d="M2 7H12" stroke="currentColor" stroke-width="1.2" />
          </svg>
          <span>Changes</span>
        </div>
        <div class="review-meta">
          <span class="review-count">{totalFiles()} files</span>
          <span class="review-additions">+{additions()}</span>
          <span class="review-deletions">-{deletions()}</span>
        </div>
      </div>
      <div class="review-body">
        <Show when={!loaded()}>
          <div class="review-empty">
            <div class="review-empty-title">正在读取变更... </div>
          </div>
        </Show>
        <Show when={loaded() && !changes().length && !drift().length}>
          <div class="review-empty">
            <div class="review-empty-icon">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="3" y="4" width="22" height="5" rx="1.5" stroke="currentColor" stroke-width="1.6" />
                <rect x="3" y="12" width="22" height="5" rx="1.5" stroke="currentColor" stroke-width="1.6" />
                <circle cx="6" cy="6.5" r="1.2" fill="currentColor" />
                <circle cx="6" cy="14.5" r="1.2" fill="currentColor" />
                <path d="M22 6.5h3M22 14.5h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              </svg>
            </div>
            <div class="review-empty-title">暂无变更</div>
            <div class="review-empty-desc">
              当前工作区没有待审阅的变更。
            </div>
          </div>
        </Show>
        <For each={changes()}>
          {(change) => (
            <div class="review-file" data-operation={change.operation}>
              <div class="review-file-name">{change.path}</div>
              <div class="review-file-meta">
                <span class="review-file-op">{change.operation}</span>
                <span>{change.origin}</span>
                <span>{change.health}</span>
              </div>
            </div>
          )}
        </For>
        <Show when={drift().length}>
          <div class="review-section-title">Drift findings</div>
          <For each={drift()}>
            {(item) => (
              <div class="review-file" data-severity={item.severity}>
                <div class="review-file-name">{item.currentActivity}</div>
                <div class="review-file-meta">
                  <span>{item.severity}</span>
                  <span>{item.status}</span>
                </div>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}

export function TerminalPane(props: { runtime?: RuntimeClient } = {}) {
  const [sessions, setSessions] = createSignal<RuntimeNativeTerminalSession[]>([]);
  onMount(() => {
    void props.runtime?.nativeTerminalList?.().then((value) => {
      if (value) setSessions(value);
    });
  });

  return (
    <div class="terminal-pane">
      <div class="terminal-output">
        <For each={sessions()}>
          {(session) => (
            <div class="terminal-line terminal-line-output">
              <span class="terminal-prompt">{session.command}</span>
              <span class="terminal-line terminal-line-success">{session.status}</span>
              {session.cwd ? <span class="terminal-line terminal-line-header"> · {session.cwd}</span> : null}
            </div>
          )}
        </For>
        <Show when={!sessions().length}>
          <div class="terminal-line terminal-line-header">暂无连接的原生终端会话</div>
        </Show>
      </div>
    </div>
  );
}

export function BrowserPane() {
  return (
    <div class="browser-pane">
      <div class="browser-toolbar">
        <div class="browser-url-bar">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style="color: var(--text-dim); flex-shrink: 0;"
          >
            <circle
              cx="7"
              cy="7"
              r="6"
              stroke="currentColor"
              stroke-width="1.2"
            />
            <path
              d="M3 7H11M7 3C5.89543 3 5 4.89543 5 6C5 7.10457 5.89543 8 7 8C8.10457 8 9 7.10457 9 6C9 4.89543 8.10457 3 7 3Z"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
          <span class="browser-url-text">输入 URL 以打开页面</span>
        </div>
      </div>
      <div class="browser-empty">
        <div class="browser-empty-icon">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M16 24C16 19.5817 19.5817 16 24 16C28.4183 16 32 19.5817 32 24"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
            <path
              d="M8 24H40"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </div>
        <div class="browser-empty-text">开始浏览</div>
      </div>
    </div>
  );
}

export function FilePane() {
  const [expanded, setExpanded] = createSignal<Set<string>>(
    new Set(["root", "src", "packages"]),
  );
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);
  const [fileWidth, setFileWidth] = createSignal(140);
  const [preview, setPreview] = createSignal(false);

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function startFileResize(event: PointerEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = fileWidth();
    const move = (next: PointerEvent) =>
      setFileWidth(
        Math.max(120, Math.min(190, startWidth + next.clientX - startX)),
      );
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const tree = [
    {
      name: ".git",
      type: "dir",
      status: null as string | null,
      children: [] as any[],
    },
    {
      name: ".kilo",
      type: "dir",
      status: null,
      children: [
        { name: "node_modules", type: "dir", status: null, children: [] },
        {
          name: "plans",
          type: "dir",
          status: null,
          children: [
            { name: "architecture", type: "dir", status: null, children: [] },
            { name: "scratch", type: "dir", status: null, children: [] },
          ],
        },
      ],
    },
    { name: "node_modules", type: "dir", status: null, children: [] },
    {
      name: "packages",
      type: "dir",
      status: null,
      children: [
        { name: "core", type: "dir", status: null, children: [] },
        { name: "hosts", type: "dir", status: null, children: [] },
        { name: "framework", type: "dir", status: null, children: [] },
        { name: "domains", type: "dir", status: null, children: [] },
        { name: "plugins", type: "dir", status: null, children: [] },
      ],
    },
    {
      name: "apps",
      type: "dir",
      status: null,
      children: [
        {
          name: "tui",
          type: "dir",
          status: null,
          children: [
            {
              name: "src",
              type: "dir",
              status: null,
              children: [
                { name: "app.tsx", type: "file", status: "M" },
                { name: "runtime.tsx", type: "file", status: "M" },
                { name: "main.tsx", type: "file", status: null },
                { name: "README.md", type: "file", status: "A" },
              ],
            },
          ],
        },
      ],
    },
    { name: "package.json", type: "file", status: null },
    { name: "dsh.json", type: "file", status: null },
    { name: "tsconfig.json", type: "file", status: null },
    { name: "bun.lock", type: "file", status: null },
  ];

  const fileContents: Record<string, string> = {
    "app.tsx":
      'import { render } from "solid-js/web";\n\nexport function App() { return <div>Hello</div>; }\n',
    "runtime.tsx":
      'import { createWorkerRuntimeClient } from "@natalia/client";\n\ntype Runtime = ReturnType<typeof createWorkerRuntimeClient>;\n',
    "main.tsx":
      'import { createRoot } from "solid-js";\nimport { App } from "./app";\n\ncreateRoot(() => <App />);\n',
    "README.md":
      "# Natalia\n\nA local-first agent runtime.\n\n## Features\n\n- Multi-agent collaboration\n- Interactive terminal\n- Self-modification\n- Checkpoints and rollback\n",
    "package.json":
      '{\n  "name": "natalia-cli",\n  "version": "0.0.0-m13",\n  "private": true\n}\n',
  };

  function selectFile(path: string) {
    setSelectedPath(path);
    setPreview(path.endsWith(".md"));
  }

  function renderTree(items: typeof tree, depth: number) {
    return (
      <For each={items}>
        {(item) => (
          <div>
            {item.type === "dir" ? (
              <>
                <button
                  type="button"
                  class="file-tree-item"
                  style={{ "padding-left": `${depth * 16 + 8}px` }}
                  onClick={() => toggle(item.name)}
                >
                  <svg
                    class="file-tree-chevron"
                    data-expanded={expanded().has(item.name)}
                    viewBox="0 0 16 16"
                    fill="none"
                  >
                    <path
                      d="M6 4L10 8L6 12"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <svg class="file-tree-icon" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M2 4C2 2.89543 2.89543 2 4 2H7.5L9.5 4H12C13.1046 4 14 4.89543 14 6V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12V4Z"
                      stroke="currentColor"
                      stroke-width="1.2"
                    />
                  </svg>
                  <span class="file-tree-name">{item.name}</span>
                </button>
                <Show when={expanded().has(item.name)}>
                  {renderTree(item.children ?? [], depth + 1)}
                </Show>
              </>
            ) : (
              <button
                type="button"
                class="file-tree-item file-tree-file"
                data-active={selectedPath() === item.name}
                style={{ "padding-left": `${depth * 16 + 24}px` }}
                onClick={() => selectFile(item.name)}
              >
                <svg
                  class="file-tree-icon file-tree-file-icon"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M4 2C4 1.44772 4.44772 1 5 1H10L12 3V14C12 14.5523 11.5523 15 11 15H5C4.44772 15 4 14.5523 4 14V2Z"
                    stroke="currentColor"
                    stroke-width="1.2"
                  />
                  <path
                    d="M10 1V3H12"
                    stroke="currentColor"
                    stroke-width="1.2"
                    stroke-linecap="round"
                  />
                </svg>
                <span class="file-tree-name">{item.name}</span>
                {item.status && (
                  <span
                    class={`file-tree-status ${item.status === "M" ? "status-modified" : "status-added"}`}
                  >
                    {item.status}
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </For>
    );
  }

  const selectedContent = () =>
    selectedPath() ? (fileContents[selectedPath()!] ?? "") : "";

  return (
    <div class="file-pane">
      <div class="file-pane-header">
        <span class="file-pane-title">资源管理器</span>
      </div>
      <div class="file-pane-body">
        <div class="file-tree" style={{ width: `${fileWidth()}px` }}>
          {renderTree(tree, 0)}
        </div>
        <div
          class="file-pane-resizer"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={startFileResize}
        />
        <div class="file-editor">
          <div class="file-editor-tabs">
            <button
              type="button"
              class="file-editor-tab"
              data-active={!preview()}
              onClick={() => setPreview(false)}
            >
              编辑
            </button>
            <button
              type="button"
              class="file-editor-tab"
              data-active={preview()}
              onClick={() => setPreview(true)}
            >
              预览
            </button>
            <span class="file-editor-path">
              {selectedPath() ?? "未选择文件"}
            </span>
          </div>
          <div class="file-editor-content">
            {selectedPath() ? (
              preview() ? (
                <div class="markdown-preview">
                  <pre
                    style={{
                      "white-space": "pre-wrap",
                      "font-family": "var(--font-family-sans)",
                      "font-size": "13px",
                      "line-height": "1.7",
                    }}
                  >
                    {selectedContent()}
                  </pre>
                </div>
              ) : (
                <textarea
                  class="file-editor-textarea"
                  value={selectedContent()}
                  readOnly
                />
              )
            ) : (
              <div class="file-editor-empty">从左侧选择文件</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
