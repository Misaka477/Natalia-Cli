import { createSignal, For, Show } from "solid-js";

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

export function ReviewPane() {
  const files = [
    {
      name: "apps/tui/src/app/App.tsx",
      status: "M",
      additions: 14490,
      deletions: 1039,
    },
    {
      name: "apps/tui/src/runtime.tsx",
      status: "M",
      additions: 458,
      deletions: 48,
    },
    {
      name: "apps/tui/src/context/theme.tsx",
      status: "M",
      additions: 67,
      deletions: 12,
    },
    { name: "src/utils/helpers.ts", status: "A", additions: 120, deletions: 0 },
    {
      name: "src/components/NewPanel.tsx",
      status: "A",
      additions: 340,
      deletions: 0,
    },
  ];
  const [selectedFile, setSelectedFile] = createSignal(files[0]);
  const [fileWidth, setFileWidth] = createSignal(140);
  function startFileResize(event: PointerEvent) {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    const startX = event.clientX;
    const startWidth = fileWidth();
    const move = (next: PointerEvent) =>
      setFileWidth(
        Math.max(120, Math.min(190, startWidth + next.clientX - startX)),
      );
    const finish = (next: PointerEvent) => {
      target.releasePointerCapture?.(next.pointerId);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", finish);
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", finish);
    target.addEventListener("pointercancel", finish);
  }
  const diffLines = [
    { type: "context", text: 'import { render } from "solid-js/web";' },
    { type: "removed", text: 'import { openDB } from "idb";' },
    { type: "added", text: 'import { createDB } from "@solid-primitives/db";' },
    { type: "context", text: "" },
    { type: "context", text: "export function createStore<T>(key: string) {" },
    { type: "removed", text: "const db = await openDB(key, 1);" },
    { type: "added", text: "const db = await createDB<T>({ name: key });" },
    { type: "context", text: "return new Proxy(db, {" },
    {
      type: "removed",
      text: "get(target, prop) { return target.get(prop as string); }",
    },
    {
      type: "added",
      text: "get(target, prop) { return target.read(prop as string); }",
    },
    { type: "context", text: "});" },
    { type: "context", text: "}" },
  ];
  const totalAdditions = files.reduce((sum, file) => sum + file.additions, 0);
  const totalDeletions = files.reduce((sum, file) => sum + file.deletions, 0);

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
          <span class="review-count">{files.length} files</span>
          <span class="review-additions">+{totalAdditions.toLocaleString()}</span>
          <span class="review-deletions">-{totalDeletions.toLocaleString()}</span>
        </div>
      </div>
      <div class="review-body">
        <div class="review-files" data-narrow={fileWidth() < 170} style={{ width: `${fileWidth()}px` }}>
          <div class="review-files-heading">Files changed</div>
          <For each={files}>
            {(file) => (
              <button
                type="button"
                class="review-file-row"
                data-active={selectedFile()?.name === file.name}
                onClick={() => setSelectedFile(file)}
              >
                <span
                  class={`review-file-status ${file.status === "A" ? "is-added" : "is-modified"}`}
                >
                  {file.status}
                </span>
                <span class="review-file-name">{file.name}</span>
                <span class="review-file-stats">
                  <span class="review-additions">
                    +{file.additions.toLocaleString()}
                  </span>
                  <span class="review-deletions">
                    -{file.deletions.toLocaleString()}
                  </span>
                </span>
              </button>
            )}
          </For>
        </div>
        <div
          class="review-resizer"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={startFileResize}
        />
        <div class="review-diff">
          <div class="review-diff-header">
            <span class="review-diff-path">{selectedFile()?.name}</span>
            <span class="review-diff-actions">
              <button type="button" class="review-icon-btn" title="Copy path">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect
                    x="5"
                    y="5"
                    width="7"
                    height="7"
                    rx="1"
                    stroke="currentColor"
                    stroke-width="1.2"
                  />
                  <path
                    d="M3 8H2V2C2 1.44772 2.44772 1 3 1H9V2"
                    stroke="currentColor"
                    stroke-width="1.2"
                  />
                </svg>
              </button>
              <button type="button" class="review-icon-btn" title="Open file">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M5 9L9 5M9 5H6.5M9 5V7.5"
                    stroke="currentColor"
                    stroke-width="1.2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </span>
          </div>
          <div class="review-diff-content">
            <For each={diffLines}>
              {(line, idx) => (
                <div class={`review-diff-line is-${line.type}`}>
                  <span class="review-diff-pos">{idx() + 1}</span>
                  <span class="review-diff-sign">
                    {line.type === "added"
                      ? "+"
                      : line.type === "removed"
                        ? "-"
                        : " "}
                  </span>
                  <span class="review-diff-text">{line.text || " "}</span>
                </div>
              )}
            </For>
          </div>
          <div class="review-diff-footer">
            <button type="button" class="review-commit-btn">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M7 1V7M7 7L4 4M7 7L10 4M3 10H11C11.5523 10 12 10.4477 12 11V12C12 12.5523 11.5523 13 11 13H3C2.44772 13 2 12.5523 2 12V11C2 10.4477 2.44772 10 3 10Z"
                  stroke="currentColor"
                  stroke-width="1.3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              提交或推送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function TerminalPane() {
  const lines = [
    {
      text: "(base) aquama@zephyrus-M16: ~/Development/Natalia_Project/natalia-cli$",
      type: "prompt" as const,
    },
    { text: "$ bun test --timeout 60000 \\", type: "command" as const },
    {
      text: "  ./test/workflow-execution.test.ts \\",
      type: "command" as const,
    },
    {
      text: "  ./test/prompt-autocomplete.test.ts \\",
      type: "command" as const,
    },
    {
      text: "  ./test/prompt-autocomplete-ui.test.tsx",
      type: "command" as const,
    },
    { text: "", type: "output" as const },
    { text: "纯文本", type: "header" as const },
    { text: "8 pass", type: "success" as const },
    { text: "0 fail", type: "success" as const },
  ];

  return (
    <div class="terminal-pane">
      <div class="terminal-output">
        <For each={lines}>
          {(line) => (
            <div class={`terminal-line terminal-line-${line.type}`}>
              {line.text}
            </div>
          )}
        </For>
        <div class="terminal-input-line">
          <span class="terminal-prompt">
            (base)
            aquama@zephyrus-M16:~/Development/Natalia_Project/natalia-cli$
          </span>
          <span class="terminal-cursor" />
        </div>
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
