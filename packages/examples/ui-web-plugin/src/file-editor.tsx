import { createSignal, For, Show, onMount } from "solid-js";
import type { UiTransport } from "@natalia/ui-host";
import type { RuntimeClient } from "@natalia/contracts";

type FileNode = {
  name: string;
  path: string;
  type: "dir" | "file";
  status?: "M" | "A" | null;
  children?: FileNode[];
};

const initialTree: FileNode[] = [
  {
    name: "natalia-cli",
    path: ".",
    type: "dir",
    children: [
      {
        name: "apps",
        path: "apps",
        type: "dir",
        children: [
          {
            name: "tui",
            path: "apps/tui",
            type: "dir",
            children: [
              {
                name: "src",
                path: "apps/tui/src",
                type: "dir",
                children: [
                  { name: "app.tsx", path: "apps/tui/src/app.tsx", type: "file", status: "M" },
                  { name: "runtime.tsx", path: "apps/tui/src/runtime.tsx", type: "file", status: "M" },
                  { name: "main.tsx", path: "apps/tui/src/main.tsx", type: "file" },
                ],
              },
            ],
          },
        ],
      },
      {
        name: "packages",
        path: "packages",
        type: "dir",
        children: [
          {
            name: "examples",
            path: "packages/examples",
            type: "dir",
            children: [
              {
                name: "ui-web-plugin",
                path: "packages/examples/ui-web-plugin",
                type: "dir",
                children: [
                  { name: "src", path: "packages/examples/ui-web-plugin/src", type: "dir", children: [] },
                  { name: "package.json", path: "packages/examples/ui-web-plugin/package.json", type: "file" },
                ],
              },
            ],
          },
          {
            name: "core",
            path: "packages/core",
            type: "dir",
            children: [],
          },
        ],
      },
      { name: "README.md", path: "README.md", type: "file" },
      { name: "tsconfig.json", path: "tsconfig.json", type: "file" },
      { name: "package.json", path: "package.json", type: "file" },
    ],
  },
];

const initialContents: Record<string, string> = {
  "apps/tui/src/app.tsx": `import { createSignal, Show } from "solid-js";
import { Composer } from "./components/Composer";
import { Transcript } from "./components/Transcript";

export function App() {
  const [messages, setMessages] = createSignal<string[]>([]);
  const [draft, setDraft] = createSignal("");

  function send() {
    const text = draft().trim();
    if (!text) return;
    setMessages((prev) => [...prev, text]);
    setDraft("");
  }

  return (
    <div class="app-shell">
      <Transcript messages={messages()} />
      <Composer value={draft()} onInput={setDraft} onSubmit={send} />
    </div>
  );
}
`,
  "apps/tui/src/runtime.tsx": `import { createWorkerRuntimeClient } from "@natalia/client";

export type Runtime = ReturnType<typeof createWorkerRuntimeClient>;

export function createRuntime(): Runtime {
  return createWorkerRuntimeClient({
    worker: () => new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
  });
}
`,
  "apps/tui/src/main.tsx": `import { createRoot } from "solid-js";
import { App } from "./app";
import "./styles.css";

createRoot(() => <App />);
`,
  "packages/examples/ui-web-plugin/package.json": `{
  "name": "@natalia/example-ui-web-plugin",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@natalia/ui-host": "workspace:*",
    "@natalia/view-store": "workspace:*",
    "solid-js": "1.9.12"
  }
}
`,
  "README.md": `# Natalia

A local-first agent runtime.

## Features

- Multi-agent collaboration
- Interactive terminal
- Self-modification
- Checkpoints and rollback

## Development

\`\`\`bash
bun install
bun run dev
\`\`\`
`,
  "tsconfig.json": `{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext"
  }
}
`,
  "package.json": `{
  "name": "natalia-workspace",
  "version": "0.0.0-m13",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
`,
};


function buildTree(entries: Array<{ path: string; type: "file" | "directory" }>): FileNode[] {
  const root: FileNode = { name: ".", path: ".", type: "dir", children: [] };
  for (const entry of entries) {
    const parts = entry.path.replace(/^\.\//u, "").split("/").filter(Boolean);
    if (!parts.length) continue;
    let node = root;
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index]!;
      const path = parts.slice(0, index + 1).join("/");
      const isFile = index === parts.length - 1 && entry.type === "file";
      let child = node.children?.find((candidate) => candidate.path === path);
      if (!child) {
        child = { name: part, path, type: isFile ? "file" : "dir", children: isFile ? undefined : [] };
        node.children?.push(child);
      }
      node = child;
    }
  }
  return root.children ?? [];
}

export function FileEditor(props: {
  transport?: UiTransport;
  runtime?: RuntimeClient;
}) {
  const [contents, setContents] = createSignal<Record<string, string>>({});
  const [selectedPath, setSelectedPath] = createSignal<string>("");
  const [expanded, setExpanded] = createSignal<Set<string>>(new Set(["."]));
  const [preview, setPreview] = createSignal(false);
  const [fileWidth, setFileWidth] = createSignal(140);
  const [tree, setTree] = createSignal<FileNode[]>(initialTree);
  onMount(() => {
    void props.runtime?.workspaceList?.().then((page) => {
      if (page?.entries?.length) {
        setTree(buildTree(page.entries));
        if (!selectedPath()) {
          const firstFile = page.entries.find(
            (entry) => entry.type === "file" && !entry.path.endsWith("/"),
          );
          if (firstFile) selectFile(firstFile.path);
        }
      }
    });
  });

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

  function selectedContent() {
    return contents()[selectedPath()] ?? "";
  }

  function selectFile(path: string) {
    setSelectedPath(path);
    setPreview(path.endsWith(".md") || path.endsWith(".markdown"));
    if (props.transport) {
      void props.transport.readFile(path).then(
        (bytes) => {
          const text = new TextDecoder().decode(bytes);
          setContents((prev) => ({ ...prev, [path]: text }));
        },
        () => undefined,
      );
    }
    void props.runtime?.workspaceRead?.({ path }).then(
      (result) => {
        if (!result) return;
        const text = result.encoding === "base64"
          ? new TextDecoder().decode(Uint8Array.from(atob(result.content), (ch) => ch.charCodeAt(0)))
          : result.content;
        setContents((prev) => ({ ...prev, [path]: text }));
      },
      () => undefined,
    );
  }

  function renderMarkdown(markdown: string): string {
    let html = markdown
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    html = html.replace(/```([\w+-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre class="neu-markdown-code"><code>${code.trim()}</code></pre>`;
    });
    html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");
    html = html.replace(/^[-*] (.*)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, (m) => `<ul>${m}</ul>`);
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\n\n+/g, "</p><p>");
    html = `<div class="neu-markdown-body">${html}</div>`;
    return html;
  }

  function lineCount() {
    return selectedContent().split("\n").length;
  }

  function setContent(value: string) {
    if (!selectedPath()) return;
    setContents((prev) => ({ ...prev, [selectedPath()!]: value }));
  }

  function saveCurrentFile() {
    // No real workspace write RPC is wired yet; keep the editor read-only until
    // workspaceWrite exists. Avoid silently writing to the fake in-memory
    // transport.
    props.runtime?.diagnostic?.(
      "文件保存暂未接入，当前文件浏览器为只读。",
      "warning",
    );
  }

  function renderTree(items: FileNode[], depth: number) {
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
                  onClick={() => toggle(item.path)}
                >
                  <svg
                    class="file-tree-chevron"
                    data-expanded={expanded().has(item.path)}
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
                <Show when={expanded().has(item.path)}>
                  {item.children ? renderTree(item.children, depth + 1) : null}
                </Show>
              </>
            ) : (
              <button
                type="button"
                class="file-tree-item file-tree-file"
                data-active={selectedPath() === item.path}
                style={{ "padding-left": `${depth * 16 + 24}px` }}
                onClick={() => selectFile(item.path)}
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

  const parts = () => selectedPath().split("/");
  const breadcrumbs = () => {
    const p = parts();
    return p.map((part, index) => p.slice(0, index + 1).join("/"));
  };

  return (
    <div class="neu-file-pane">
      <div class="neu-file-header">
        <span>资源管理器</span>
      </div>
      <div class="neu-file-body">
        <div class="file-tree neu-file-tree" style={{ width: `${fileWidth()}px` }}>
          {renderTree(tree(), 0)}
        </div>
        <div
          class="file-pane-resizer"
          role="separator"
          aria-orientation="vertical"
          onPointerDown={startFileResize}
        />
        <div class="neu-file-editor">
          <div class="neu-file-editor-tabs">
            <Show when={selectedPath().endsWith(".md") || selectedPath().endsWith(".markdown")}>
              <button
                type="button"
                class="neu-file-editor-tab"
                data-active={!preview()}
                onClick={() => setPreview(false)}
              >
                编辑
              </button>
              <button
                type="button"
                class="neu-file-editor-tab"
                data-active={preview()}
                onClick={() => setPreview(true)}
              >
                预览
              </button>
            </Show>
            <div class="neu-file-editor-tab" data-active={!preview() || !(selectedPath().endsWith(".md") || selectedPath().endsWith(".markdown"))}>
              <svg class="file-tree-icon file-tree-file-icon" viewBox="0 0 16 16" fill="none">
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
              <span class="neu-file-editor-tab-label">
                {selectedPath().split("/").pop()}
              </span>
              <span class="neu-tab-dirty" />
              <button
                type="button"
                class="neu-tab-close"
                aria-label="关闭文件"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                    stroke="currentColor"
                    stroke-width="1.2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div class="neu-file-breadcrumbs">
            <For each={breadcrumbs()}>
              {(part, index) => (
                <>
                  <span class="neu-file-breadcrumb">{part.split("/").pop()}</span>
                  <Show when={index() < breadcrumbs().length - 1}>
                    <span class="neu-file-breadcrumb-separator">›</span>
                  </Show>
                </>
              )}
            </For>
          </div>
          <div class="neu-file-editor-area" classList={{ "neu-file-editor-area-preview": preview() && (selectedPath().endsWith(".md") || selectedPath().endsWith(".markdown")) }}>
            {preview() && (selectedPath().endsWith(".md") || selectedPath().endsWith(".markdown")) ? (
              <div class="neu-markdown-preview" innerHTML={renderMarkdown(selectedContent())} />
            ) : (
              <>
                <div class="neu-line-numbers">
                  {Array.from({ length: lineCount() }, (_, index) => index + 1).join("\n")}
                </div>
                <textarea
                  class="neu-file-textarea"
                  value={selectedContent()}
                  spellcheck={false}
                  onInput={(event) => setContent(event.currentTarget.value)}
                  onBlur={saveCurrentFile}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FileEditor;
