import { createSignal, For, Show, onMount } from "solid-js";
import type { UiTransport } from "@natalia/ui-host";
import type { RuntimeClient } from "@natalia/contracts";
import { Compartment } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { StreamLanguage, syntaxHighlighting, HighlightStyle, foldGutter } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { rust } from "@codemirror/lang-rust";
import { go } from "@codemirror/lang-go";
import { sql } from "@codemirror/lang-sql";
import { yaml } from "@codemirror/lang-yaml";
import { autocompletion } from "@codemirror/autocomplete";
import { search, highlightSelectionMatches } from "@codemirror/search";
import { lintGutter } from "@codemirror/lint";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { cmake } from "@codemirror/legacy-modes/mode/cmake";
import type { Extension } from "@codemirror/state";

type FileNode = {
  name: string;
  path: string;
  type: "dir" | "file";
  status?: "M" | "A" | null;
  children?: FileNode[];
};

const initialTree: FileNode[] = [];

const initialContents: Record<string, string> = {};

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

const neuLightTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      color: "var(--neu-text)",
    },
    ".cm-content": {
      caretColor: "var(--neu-text)",
      fontFamily: "var(--neu-font-mono)",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--neu-muted)",
      border: "none",
    },
    ".cm-activeLine": {
      backgroundColor: "rgba(143,183,176,0.08)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "rgba(143,183,176,0.08)",
    },
    ".cm-selectionBackground": {
      backgroundColor: "rgba(143,183,176,0.22) !important",
    },
    ".cm-cursor": {
      borderLeftColor: "var(--neu-accent)",
    },
  },
  { dark: false },
);

const neuLightHighlight = HighlightStyle.define([
  { tag: tags.comment, color: "var(--neu-muted)", fontStyle: "italic" },
  { tag: [tags.keyword, tags.operatorKeyword], color: "#b85e9c", fontWeight: "600" },
  { tag: [tags.string, tags.special(tags.string)], color: "#2e8b57" },
  { tag: [tags.number, tags.bool, tags.null], color: "#b06e2c" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "#2a7ab0" },
  { tag: [tags.className, tags.typeName], color: "#7a4bb5" },
  { tag: [tags.propertyName, tags.attributeName], color: "#2a7ab0" },
  { tag: [tags.definition(tags.variableName), tags.variableName], color: "var(--neu-text)" },
]);

function languageForPath(path: string): Extension {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(ext))
    return javascript({ typescript: ext.includes("ts") });
  if (["json", "jsonc"].includes(ext)) return json();
  if (["html", "htm", "vue", "svelte"].includes(ext)) return html();
  if (["css", "scss", "less"].includes(ext)) return css();
  if (["c", "h", "cpp", "cc", "cxx", "hpp", "hh"].includes(ext)) return cpp();
  if (["rs"].includes(ext)) return rust();
  if (["go"].includes(ext)) return go();
  if (["sql"].includes(ext)) return sql();
  if (["yml", "yaml"].includes(ext)) return yaml();
  if (["md", "markdown"].includes(ext)) return markdown();
  if (["py"].includes(ext)) return python();
  if (["sh", "bash", "zsh"].includes(ext))
    return StreamLanguage.define(shell);
  if (["cmake", "txt"].includes(ext) && path.toLowerCase().includes("cmake"))
    return StreamLanguage.define(cmake);
  return [];
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
  const [entries, setEntries] = createSignal<Array<{ path: string; type: "file" | "directory" }>>([]);
  const [loadedDirs, setLoadedDirs] = createSignal<Set<string>>(new Set());
  let cmContainer: HTMLDivElement | undefined;
  let cmView: EditorView | undefined;
  const languageCompartment = new Compartment();
  onMount(() => {
    cmView = new EditorView({
      doc: selectedContent(),
      extensions: [
        basicSetup,
        lineNumbers(),
        highlightActiveLine(),
        autocompletion(),
        search({ top: true }),
        highlightSelectionMatches(),
        lintGutter(),
        foldGutter(),
        neuLightTheme,
        syntaxHighlighting(neuLightHighlight),
        languageCompartment.of(languageForPath(selectedPath())),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const text = update.state.doc.toString();
            const path = selectedPath();
            if (path) setContents((prev) => ({ ...prev, [path]: text }));
          }
        }),
        EditorView.domEventHandlers({
          blur: () => {
            void saveCurrentFile();
          },
        }),
      ],
      parent: cmContainer!,
    });
    void props.runtime?.workspaceList?.().then((page) => {
      if (page?.entries?.length) {
        setEntries(page.entries);
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

  async function toggle(path: string) {
    const next = new Set(expanded());
    if (next.has(path)) {
      next.delete(path);
      setExpanded(next);
      return;
    }
    next.add(path);
    setExpanded(next);
    if (!loadedDirs().has(path)) {
      const loaded = new Set(loadedDirs());
      loaded.add(path);
      setLoadedDirs(loaded);
      try {
        const page = await props.runtime?.workspaceList?.({ path });
        if (page?.entries?.length) {
          const merged = new Map(entries().map((entry) => [entry.path, entry]));
          for (const entry of page.entries) merged.set(entry.path, entry);
          const nextEntries = [...merged.values()];
          setEntries(nextEntries);
          setTree(buildTree(nextEntries));
        }
      } catch {
        // Keep the directory expanded even when listing fails; the tree will
        // simply show no children instead of pretending content exists.
      }
    }
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
          updateEditor(path, text);
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
        updateEditor(path, text);
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

  function updateEditor(path: string, text: string) {
    if (!cmView) return;
    cmView.dispatch({
      effects: languageCompartment.reconfigure(languageForPath(path)),
    });
    cmView.dispatch({
      changes: {
        from: 0,
        to: cmView.state.doc.length,
        insert: text,
      },
    });
  }



  async function saveCurrentFile() {
    const path = selectedPath();
    if (!path) return;
    if (!props.runtime?.workspaceWrite) {
      props.runtime?.diagnostic?.(
        "当前 runtime 不支持文件保存",
        "warning",
      );
      return;
    }
    try {
      await props.runtime.workspaceWrite({
        path,
        content: contents()[path] ?? "",
        encoding: "utf8",
      });
      props.runtime.diagnostic?.("已保存", "info");
    } catch (error) {
      props.runtime.diagnostic?.(
        `保存失败：${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    }
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
                  onClick={() => void toggle(item.path)}
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
                  <button
                    type="button"
                    class="neu-file-breadcrumb"
                    disabled={index() === breadcrumbs().length - 1}
                    onClick={() => void toggle(part)}
                  >
                    {part.split("/").pop()}
                  </button>
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
              <div
                class="neu-file-codemirror"
                ref={(element) => {
                  cmContainer = element;
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FileEditor;
