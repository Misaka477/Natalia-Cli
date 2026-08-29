/**
 * Styles owned by the file editor UI plugin.
 *
 * These are intentionally injected by this plugin so the main web UI does not
 * need to know about CodeMirror or the file tree.
 */
export const fileEditorStyles = `
/* ===== File tree + editor ===== */
.neu-file-pane { flex: 1; display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
.neu-file-header { display: none; }
.neu-file-body { flex: 1; display: flex; min-height: 0; overflow: hidden; gap: 10px; }
.neu-file-tree {
  flex: 0 0 auto;
  overflow-y: auto;
  overflow-x: auto;
  background: var(--neu-bg);
  border-radius: 12px;
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
  padding: 6px;
  min-width: 120px;
}
.file-pane-resizer { width: 6px; flex: 0 0 6px; cursor: col-resize; background: transparent; touch-action: none; }
.file-pane-resizer:hover { background: rgba(143,183,176,0.15); border-radius: 4px; }
.file-tree-item { display: flex; align-items: center; gap: 6px; padding: 5px 8px; width: max-content; min-width: 100%; background: transparent; border: none; border-radius: 10px; color: var(--neu-text); font-family: var(--neu-font-mono); font-size: 12px; text-align: left; cursor: pointer; transition: all 100ms ease; }
.file-tree-item:hover { background: var(--neu-bg-light); }
.file-tree-item[data-active="true"] { background: var(--neu-bg-light); box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light); }
.file-tree-chevron { width: 12px; height: 12px; transition: transform 100ms ease; flex-shrink: 0; color: var(--neu-muted); }
.file-tree-chevron[data-expanded="true"] { transform: rotate(90deg); }
.file-tree-icon { width: 14px; height: 14px; flex-shrink: 0; color: var(--neu-muted); }
.file-tree-file-icon { color: var(--neu-accent); }
.file-tree-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-tree-status { font-size: 9px; font-weight: 700; width: 12px; text-align: center; flex-shrink: 0; }
.status-modified { color: #d8b04a; }
.status-added { color: var(--neu-success); }
.status-deleted { color: var(--neu-error); }

.neu-file-editor { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.neu-file-editor-tabs { display: flex; align-items: center; margin-bottom: 8px; }
.neu-file-editor-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 12px;
  background: var(--neu-bg);
  border-radius: 12px;
  color: var(--neu-text);
  font-size: 12px;
  box-shadow: 4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light);
}
.neu-file-editor-tab-label { max-width: 180px; overflow: hidden; text-overflow: ellipsis; }
.neu-file-editor-tab .neu-tab-dirty { width: 7px; height: 7px; border-radius: 50%; background: var(--neu-accent); }
.neu-file-editor-tab .neu-tab-close { width: 20px; height: 20px; background: transparent; border: none; color: var(--neu-muted); border-radius: 8px; cursor: pointer; }
.neu-file-breadcrumbs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--neu-muted);
  background: var(--neu-bg);
  border-radius: 12px;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-file-breadcrumb {
  border: none;
  background: transparent;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.neu-file-breadcrumb:hover { color: var(--neu-text); }
.neu-file-breadcrumb:disabled { cursor: default; }
.neu-file-breadcrumb:disabled:hover { color: var(--neu-muted); }
.neu-file-breadcrumb-separator { color: var(--neu-muted); opacity: 0.6; }
.neu-file-editor-host {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.neu-file-editor-area {
  flex: 1; display: flex; min-height: 0; overflow: hidden;
  background: var(--neu-bg-light);
  border-radius: 12px;
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
}
.neu-line-numbers {
  width: 44px; flex-shrink: 0; overflow: hidden;
  padding: 10px 8px 10px 0; text-align: right;
  font-family: var(--neu-font-mono); font-size: 12px; line-height: 1.6;
  color: var(--neu-muted); opacity: 0.8;
  user-select: none; white-space: pre;
}
.neu-file-codemirror {
  flex: 1; min-width: 0; overflow: hidden;
}
.neu-file-codemirror .cm-editor {
  height: 100%;
  background: transparent;
  color: var(--neu-text);
}
.neu-file-codemirror .cm-scroller {
  font-family: var(--neu-font-mono);
  font-size: 12px;
  line-height: 1.6;
}
.neu-file-textarea {
  flex: 1; min-width: 0; border: none; outline: none; resize: none;
  padding: 10px 12px; background: transparent; color: var(--neu-text);
  font-family: var(--neu-font-mono); font-size: 12px; line-height: 1.6;
  white-space: pre; tab-size: 2; overflow: auto;
}
.neu-file-textarea::selection { background: rgba(143,183,176,0.2); }

/* Markdown preview */
.neu-markdown-preview {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 14px 18px 20px;
  background: var(--neu-bg-light);
  color: var(--neu-text);
  line-height: 1.7;
  font-size: 13px;
  border-radius: 12px;
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
}
.neu-file-editor-area-preview {
  box-shadow: none;
  background: transparent;
}
.neu-markdown-body {
  max-width: 760px;
}
.neu-markdown-body h1,
.neu-markdown-body h2,
.neu-markdown-body h3 {
  color: var(--neu-text);
}
.neu-markdown-body h1 { font-size: 1.8em; }
.neu-markdown-body h2 { font-size: 1.5em; }
.neu-markdown-body h3 { font-size: 1.25em; }
.neu-markdown-body p { margin: 0.6em 0; }
.neu-markdown-body ul { margin: 0.6em 0; padding-left: 1.4em; }
.neu-markdown-body li { margin: 0.2em 0; }
.neu-markdown-body code {
  background: var(--neu-bg);
  padding: 0.1em 0.35em;
  border-radius: 6px;
  font-family: var(--neu-font-mono);
  font-size: 0.92em;
}
.neu-markdown-body pre {
  background: var(--neu-bg);
  padding: 10px 12px;
  border-radius: 10px;
  overflow-x: auto;
}
.neu-markdown-body pre code {
  background: transparent;
  padding: 0;
}
.neu-markdown-body strong { color: var(--neu-text); }
.neu-markdown-body em { color: var(--neu-muted); }
`;
