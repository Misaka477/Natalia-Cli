import { createSignal, For, Show } from "solid-js";

export type RightPanelTab =
  | "review"
  | "terminal"
  | "browser"
  | "file"
  | "sidechat";

export interface RightPanelProps {
  activeTab: RightPanelTab;
  onTabChange: (tab: RightPanelProps["activeTab"]) => void;
}

const TABS: { id: RightPanelTab; label: string; icon: string }[] = [
  { id: "review", label: "审阅", icon: "diff" },
  { id: "terminal", label: "终端", icon: "terminal" },
  { id: "browser", label: "浏览器", icon: "browser" },
  { id: "file", label: "文件", icon: "file" },
  { id: "sidechat", label: "侧边聊天", icon: "chat" },
];

export function RightPanel(props: RightPanelProps) {
  return (
    <aside class="right-panel">
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
        <Show when={props.activeTab === "sidechat"}>
          <SideChatPane />
        </Show>
      </div>
    </aside>
  );
}

function ReviewPane() {
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
  const diffLines = [
    {
      type: "context" as const,
      text: '﻿import { render } from "solid-js/web";',
    },
    { type: "removed" as const, text: '- import { openDB } from "idb";' },
    {
      type: "added" as const,
      text: '+ import { createDB } from "@solid-primitives/db";',
    },
    { type: "context" as const, text: "" },
    {
      type: "context" as const,
      text: "export function createStore<T>(key: string) {",
    },
    { type: "removed" as const, text: "-   const db = await openDB(key, 1);" },
    {
      type: "added" as const,
      text: "+   const db = await createDB<T>({ name: key });",
    },
    { type: "context" as const, text: "   return new Proxy(db, {" },
    {
      type: "removed" as const,
      text: "-     get(target, prop) { return target.get(prop as string); }",
    },
    {
      type: "added" as const,
      text: "+     get(target, prop) { return target.read(prop as string); }",
    },
    { type: "context" as const, text: "   });" },
    { type: "context" as const, text: "}" },
  ];

  return (
    <div class="review-pane">
      <div class="review-toolbar">
        <span class="review-branch">master → origin/master</span>
        <span class="review-stats">
          <span class="diff-stat-add">
            +{selectedFile()?.additions.toLocaleString()}
          </span>
          <span class="diff-stat-remove">
            -{selectedFile()?.deletions.toLocaleString()}
          </span>
        </span>
      </div>
      <div class="review-body">
        <div class="review-file-list">
          <For each={files}>
            {(file) => (
              <button
                type="button"
                class="review-file-item"
                data-active={selectedFile()?.name === file.name}
                onClick={() => setSelectedFile(file)}
              >
                <span
                  class={`review-file-status ${file.status === "A" ? "status-added" : "status-modified"}`}
                >
                  {file.status}
                </span>
                <span class="review-file-name">{file.name}</span>
                <span class="review-file-stats">
                  <span class="diff-add">
                    +{file.additions.toLocaleString()}
                  </span>
                  <span class="diff-remove">
                    -{file.deletions.toLocaleString()}
                  </span>
                </span>
              </button>
            )}
          </For>
        </div>
        <div class="review-diff">
          <div class="review-diff-header">{selectedFile()?.name}</div>
          <div class="review-diff-content">
            <For each={diffLines}>
              {(line) => (
                <div class={`diff-line diff-line-${line.type}`}>
                  <span class="diff-line-num">
                    {line.type === "added"
                      ? "+"
                      : line.type === "removed"
                        ? "-"
                        : " "}
                  </span>
                  <span class="diff-line-text">{line.text || " "}</span>
                </div>
              )}
            </For>
          </div>
          <button type="button" class="review-commit-btn">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M7 1V7M7 7L4 4M7 7L10 4M3 10H11C11.5523 10 12 10.4477 12 11V12C12 12.5523 11.5523 13 11 13H3C2.44772 13 2 12.5523 2 12V11C2 10.4477 2.44772 10 3 10Z"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            提交或推送
          </button>
        </div>
      </div>
    </div>
  );
}

function TerminalPane() {
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

function BrowserPane() {
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

function FilePane() {
  const [expanded, setExpanded] = createSignal<Set<string>>(
    new Set(["root", "src", "packages"]),
  );

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
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
        {
          name: "core",
          type: "dir",
          status: null,
          children: [
            { name: "contracts", type: "dir", status: null, children: [] },
            {
              name: "runtime-services",
              type: "dir",
              status: null,
              children: [],
            },
          ],
        },
        {
          name: "hosts",
          type: "dir",
          status: null,
          children: [
            { name: "ui-host", type: "dir", status: null, children: [] },
            { name: "view-store", type: "dir", status: null, children: [] },
          ],
        },
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
                    {item.name === ".git" ? (
                      <path
                        d="M3 10V13C3 13.5523 3.44772 14 4 14H12C12.5523 14 13 13.5523 13 13V10"
                        stroke="currentColor"
                        stroke-width="1.2"
                        stroke-linecap="round"
                      />
                    ) : (
                      <path
                        d="M2 4C2 2.89543 2.89543 2 4 2H7.5L9.5 4H12C13.1046 4 14 4.89543 14 6V12C14 13.1046 13.1046 14 12 14H4C2.89543 14 2 13.1046 2 12V4Z"
                        stroke="currentColor"
                        stroke-width="1.2"
                      />
                    )}
                  </svg>
                  <span class="file-tree-name">{item.name}</span>
                </button>
                <Show when={expanded().has(item.name)}>
                  {renderTree(item.children ?? [], depth + 1)}
                </Show>
              </>
            ) : (
              <div
                class="file-tree-item file-tree-file"
                style={{ "padding-left": `${depth * 16 + 24}px` }}
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
              </div>
            )}
          </div>
        )}
      </For>
    );
  }

  return (
    <div class="file-pane">
      <div class="file-pane-header">
        <span class="file-pane-title">资源管理器</span>
      </div>
      <div class="file-tree">{renderTree(tree, 0)}</div>
    </div>
  );
}

function SideChatPane() {
  return (
    <div class="side-chat-pane">
      <div class="side-chat-empty">
        <div class="side-chat-empty-icon">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle
              cx="20"
              cy="20"
              r="16"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M14 18C14 16.8954 14.8954 16 16 16H24C25.1046 16 26 16.8954 26 18V26C26 27.1046 25.1046 28 24 28H16C14.8954 28 14 27.1046 14 26V18Z"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M18 12H22M18 12L16 10M18 12L20 10M22 12L24 10M22 12L20 10"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </div>
        <div class="side-chat-empty-title">侧边聊天</div>
        <div class="side-chat-empty-hint">
          侧边聊天是临时聊天，关闭应用会消失。
        </div>
        <div
          class="side-chat-empty-hint"
          style={{ "margin-top": "var(--space-4)" }}
        >
          使用侧边栏 Tab 在新会话间快速切换。
        </div>
      </div>
    </div>
  );
}
