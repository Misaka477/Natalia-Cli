export const nataliaNeuBaseStyles = `
:root {
  font-family: "Inter", system-ui, -apple-system, sans-serif;
  background: var(--neu-bg);
  color: var(--neu-text);
  --neu-radius: 22px;
  --neu-radius-sm: 12px;
  --neu-font-mono: "JetBrains Mono", "SF Mono", Consolas, monospace;
  --neu-scrollbar: color-mix(in srgb, var(--neu-muted) 45%, transparent);
  --neu-scrollbar-hover: color-mix(in srgb, var(--neu-accent) 60%, transparent);
  --neu-accent-shadow: color-mix(in srgb, var(--neu-accent) 35%, transparent);
  --neu-focus-ring: color-mix(in srgb, var(--neu-accent) 18%, transparent);
  --neu-resizer-hover: color-mix(in srgb, var(--neu-accent) 25%, transparent);
  --neu-hairline-accent: color-mix(in srgb, var(--neu-accent) 15%, transparent);
  --neu-diff-removed-bg: color-mix(in srgb, var(--neu-error) 10%, transparent);
  --neu-diff-added-bg: color-mix(in srgb, var(--neu-success) 10%, transparent);
  --neu-error-soft: color-mix(in srgb, var(--neu-error) 12%, transparent);
  --neu-danger: var(--neu-error);
  --neu-on-accent: #1c211f;
  --neu-on-error: #fff;
  --neu-thumb: #fff;
  --neu-thumb-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  --neu-badge-inset: inset 1px 1px 2px rgba(0, 0, 0, 0.1);
  --neu-inset-pressed-dark: rgba(0, 0, 0, 0.18);
  --neu-inset-pressed-light: rgba(255, 255, 255, 0.35);
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html, body, #root { width: 100%; height: 100%; overflow: hidden; }
body { background: var(--neu-bg); color: var(--neu-text); font-size: 14px; }

.neu-shell {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 14px;
  background: var(--neu-bg);
  overflow: hidden;
}
.neu-app {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: stretch;
  gap: 14px;
  overflow: visible;
}

/* ===== Top bar ===== */
.neu-topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 56px;
  padding: 10px 18px;
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 3px 3px 8px var(--neu-shadow-dark), -3px -3px 8px var(--neu-shadow-light);
}
.neu-topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.neu-topbar-logo {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--neu-accent);
  color: var(--neu-on-accent);
  font-weight: 700;
  font-size: 14px;
}
.neu-topbar-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.neu-topbar-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--neu-text);
}
.neu-topbar-sub {
  font-size: 11px;
  color: var(--neu-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.neu-topbar-center {
  display: flex;
  align-items: center;
  gap: 16px;
  flex: 1;
  justify-content: center;
  min-width: 0;
}
.neu-topbar-agent {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--neu-bg);
  color: var(--neu-text);
  font-size: 12px;
  white-space: nowrap;
}
.neu-topbar-agent-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--neu-muted);
}
.neu-topbar-agent-dot[data-status="running"] { background: var(--neu-success); }
.neu-topbar-agent-state {
  color: var(--neu-muted);
  font-size: 11px;
}
.neu-topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.neu-topbar-btn {
  padding: 7px 14px;
  border: none;
  border-radius: 12px;
  background: var(--neu-bg);
  color: var(--neu-text);
  font-size: 12px;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
  transition: box-shadow 0.2s ease, background-color 0.2s ease, color 0.2s ease;
}
.neu-topbar-btn:hover { box-shadow: 2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light); color: var(--neu-accent); }
.neu-topbar-btn:active { box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light); }
.neu-topbar-btn[data-active="true"] { box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light); color: var(--neu-accent); }
.neu-topbar-btn-primary { background: var(--neu-accent); color: var(--neu-on-accent); }

/* ===== Left session sidebar ===== */
.neu-sidebar {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 3px 3px 8px var(--neu-shadow-dark), -3px -3px 8px var(--neu-shadow-light);
  padding: 18px;
  overflow: hidden;
  min-width: 0;
}
.neu-sidebar-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--neu-muted);
  letter-spacing: 0.04em;
  margin-bottom: 14px;
}
.neu-sidebar-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 2px;
}
.neu-tree-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--neu-muted);
  padding: 4px 6px 10px;
}
.neu-workspace-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  margin: 4px 0 6px;
  background: var(--neu-bg);
  border-radius: var(--neu-radius-sm);
  box-shadow: none;
  font-size: 13px;
  font-weight: 600;
}
.neu-count {
  font-size: 11px;
  color: var(--neu-muted);
}
.neu-workspace-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--neu-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.neu-workspace-remove:hover {
  background: var(--neu-bg);
  color: var(--neu-text);
}
.neu-tree-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 36px;
  padding: 6px 12px;
  margin: 4px 0;
  border: none;
  border-radius: var(--neu-radius-sm);
  background: transparent;
  color: var(--neu-text);
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
}
.neu-tree-row:active {
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-tree-row:focus-visible {
  outline: 2px solid var(--neu-accent);
  outline-offset: 2px;
}
.neu-tree-row:hover {
  background: var(--neu-bg);
  color: var(--neu-text);
}
.neu-tree-row[data-selected="true"] {
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
  color: var(--neu-text);
}
.neu-tree-edit {
  margin-left: auto;
  padding: 2px 6px;
  border: none;
  background: transparent;
  color: var(--neu-muted);
  cursor: pointer;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.neu-tree-row:hover .neu-tree-edit { opacity: 1; }
.neu-tree-edit:hover { color: var(--neu-accent); }
.neu-tree-edit-input {
  flex: 1;
  min-width: 0;
  padding: 3px 6px;
  border: none;
  border-radius: 6px;
  background: var(--neu-bg-light);
  color: var(--neu-text);
  font-size: 12px;
  outline: none;
  box-shadow: inset 1px 1px 2px var(--neu-shadow-dark), inset -1px -1px 2px var(--neu-shadow-light);
}
.neu-tree-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.neu-status-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--neu-muted);
  box-shadow: none;
}
.neu-status-dot[data-status="running"] { background: var(--neu-success); }
.neu-status-dot[data-status="error"] { background: var(--neu-error); }
.neu-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--neu-bg-light);
  color: var(--neu-muted);
  box-shadow: none;
  white-space: nowrap;
  flex-shrink: 0;
}

/* ===== Resizers ===== */
.neu-resizer,
.neu-right-resizer {
  width: 8px;
  flex-shrink: 0;
  cursor: col-resize;
  background: transparent;
  touch-action: none;
}
.neu-resizer:hover,
.neu-right-resizer:hover {
  background: var(--neu-resizer-hover);
  border-radius: 8px;
}

/* ===== Collapsed side rails ===== */
.neu-collapsed-rail {
  width: 18px;
  flex-shrink: 0;
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--neu-bg-light);
  border: none;
  cursor: pointer;
  padding: 0;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}
.neu-collapsed-rail:hover {
  background: var(--neu-bg);
  box-shadow: 2px 2px 6px var(--neu-shadow-dark), -2px -2px 6px var(--neu-shadow-light);
}
.neu-left-rail {
  border-radius: 18px;
  margin-left: 0;
  border: none;
}
.neu-right-rail {
  border-radius: 18px;
  margin-right: 0;
  border: none;
}
.neu-rail-dots {
  width: 4px;
  height: 34px;
  background-image: radial-gradient(circle, var(--neu-muted) 1.4px, transparent 1.8px);
  background-size: 4px 6px;
  background-position: center;
  opacity: 0.9;
}
.neu-collapsed-rail:hover .neu-rail-dots {
  opacity: 1;
}

/* ===== Main dual panes ===== */
.neu-main {
  flex: 1;
  min-width: 0;
  display: flex;
  overflow: visible;
}
.neu-main-panes {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 14px;
}
.neu-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 3px 3px 8px var(--neu-shadow-dark), -3px -3px 8px var(--neu-shadow-light);
  padding: 14px;
  overflow: hidden;
}
.neu-pane-divider {
  width: 8px;
  flex-shrink: 0;
  align-self: stretch;
  background: transparent;
}
.neu-pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
  padding: 4px 6px;
}
.neu-pane-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--neu-text);
}
.neu-pane-status {
  font-size: 11px;
  padding: 4px 10px;
  background: var(--neu-bg);
  border-radius: 999px;
  color: var(--neu-muted);
  box-shadow: none;
}
.neu-pane-status[data-running="true"] {
  color: var(--neu-success);
}
.neu-pane-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: var(--neu-radius-sm);
}

/* ===== Transcript + Composer ===== */
.neu-pane .natalia-transcript {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border-radius: 12px;
  padding: 8px 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: var(--neu-text);
  scrollbar-width: thin;
  scrollbar-color: var(--neu-scrollbar) transparent;
}
.neu-pane .natalia-transcript > * {
  flex-shrink: 0;
}
.neu-pane .natalia-transcript-empty {
  margin: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--neu-muted);
  max-width: 380px;
  text-align: center;
}
.neu-pane .natalia-transcript-empty-icon { color: var(--neu-accent); opacity: 0.55; }
.neu-pane .natalia-transcript-empty-title { font-size: 16px; color: var(--neu-text); }
.neu-pane .natalia-transcript-empty-hint { font-size: 13px; color: var(--neu-muted); }
.neu-pane .natalia-message {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 16px;
  background: var(--neu-bg);
  box-shadow: none;
  content-visibility: auto;
  contain-intrinsic-size: auto 80px;
}
.neu-pane .natalia-message[data-role="user"] {
  align-self: flex-end;
  background: var(--neu-user-bubble);
  box-shadow: none;
  border: none;
  color: var(--neu-user-bubble-text);
}
.neu-pane .natalia-message[data-role="user"] .natalia-message-author,
.neu-pane .natalia-message[data-role="user"] .natalia-message-time,
.neu-pane .natalia-message[data-role="user"] .natalia-message-body {
  color: var(--neu-user-bubble-text);
}
.neu-pane .natalia-message[data-role="system"] {
  max-width: 90%;
  background: var(--neu-bg);
  box-shadow: none;
}
.neu-pane .natalia-message-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
}
.neu-pane .natalia-message-avatar {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
  font-size: 10px;
  font-weight: 700;
  color: var(--neu-accent);
}
.neu-pane .natalia-message-meta { display: flex; align-items: center; gap: 6px; }
.neu-pane .natalia-message-author { font-size: 12px; font-weight: 600; color: var(--neu-text); }
.neu-pane .natalia-message-time { font-size: 10px; color: var(--neu-muted); }
.neu-pane .natalia-message-body { font-size: 13px; line-height: 1.65; color: var(--neu-text); }
.neu-pane .natalia-message-text p { margin: 0 0 6px; }
.neu-pane .natalia-thinking-block {
  padding: 8px 10px;
  margin: 4px 0;
  border-radius: 10px;
  background: var(--neu-bg-light);
  color: var(--neu-muted);
  font-style: italic;
  font-size: 12px;
  line-height: 1.6;
}
.neu-pane .natalia-thinking-label {
  display: block;
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--neu-accent);
  font-style: normal;
}
.neu-pane .natalia-thinking-text { color: var(--neu-muted); }

.neu-pane .natalia-code-block {
  background: var(--neu-bg-light);
  border-radius: 10px;
  margin: 6px 0;
  overflow: hidden;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-pane .natalia-code-header { display: flex; align-items: center; justify-content: space-between; padding: 4px 10px; color: var(--neu-muted); font-size: 11px; }
.neu-pane .natalia-code-block pre { padding: 10px; overflow-x: auto; font-family: var(--neu-font-mono); font-size: 12px; }
.neu-pane .natalia-badge { font-size: 10px; padding: 1px 7px; border-radius: 10px; background: var(--neu-bg-light); color: var(--neu-muted); box-shadow: var(--neu-badge-inset); }
.neu-pane .natalia-badge-running { color: var(--neu-success); }
.neu-pane .natalia-badge-success { color: var(--neu-success); }
.neu-pane .natalia-badge-error { color: var(--neu-error); }
.neu-pane .natalia-tool-card { border-radius: 12px; overflow: hidden; background: var(--neu-bg-light); box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light); margin: 6px 0; }
.neu-pane .natalia-tool-header { display: flex; align-items: center; gap: 6px; padding: 8px 10px; font-size: 12px; color: var(--neu-text); }
.neu-pane .natalia-tool-output { padding: 8px 10px; border-top: 1px solid var(--neu-divider); font-family: var(--neu-font-mono); font-size: 12px; color: var(--neu-muted); }
.neu-pane .natalia-streaming-indicator { display: flex; align-items: center; gap: 4px; color: var(--neu-muted); font-size: 12px; }
.neu-pane .natalia-streaming-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--neu-accent); animation: neu-blink 1s infinite; }
.neu-pane .natalia-message-actions { display: flex; gap: 6px; margin-top: 6px; }
.neu-pane .natalia-action-btn { padding: 5px 12px; border: none; border-radius: 12px; background: var(--neu-bg); color: var(--neu-text); box-shadow: 4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light); font-size: 12px; cursor: pointer; }
.neu-pane .natalia-action-btn:active { box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light); }
.neu-pane .natalia-action-btn-primary { background: var(--neu-accent); color: var(--neu-on-accent); box-shadow: 4px 4px 8px var(--neu-accent-shadow), -4px -4px 8px var(--neu-shadow-light); }

.neu-pane .natalia-composer {
  flex-shrink: 0;
  background: var(--neu-bg);
  border-radius: 16px;
  box-shadow: none;
  padding: 10px 12px 12px;
  margin-top: 6px;
}
.neu-pane .natalia-composer-textarea {
  width: 100%;
  min-height: 46px;
  max-height: 160px;
  resize: none;
  background: transparent;
  border: none;
  outline: none;
  color: var(--neu-text);
  padding: 6px 8px;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
}
.neu-pane .natalia-composer-toolbar { display: flex; align-items: center; justify-content: space-between; }
.neu-pane .natalia-composer-controls { display: flex; gap: 4px; }
.neu-pane .natalia-composer-icon-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--neu-muted);
  box-shadow: none;
  cursor: pointer;
}
.neu-pane .natalia-composer-icon-btn:hover {
  background: var(--neu-hover-overlay);
  color: var(--neu-text);
}
.neu-pane .natalia-composer-submit {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 12px;
  background: var(--neu-bg-light);
  color: var(--neu-accent);
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
  cursor: pointer;
}
.neu-pane .natalia-composer-submit:hover {
  box-shadow: 2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light);
  color: var(--neu-accent-soft);
}
.neu-pane .natalia-composer-submit:active {
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
  color: var(--neu-accent);
}
.neu-pane .natalia-composer-submit svg {
  transition: transform 0.15s ease, color 0.15s ease;
}
.neu-pane .natalia-composer-submit:active svg {
  transform: scale(0.82);
  opacity: 0.85;
}
.neu-pane .natalia-composer-submit[data-busy="true"] {
  color: var(--neu-error);
  background: var(--neu-error-soft);
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
}
.neu-pane .natalia-attachment-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; background: var(--neu-bg); border-radius: 10px; font-size: 12px; color: var(--neu-muted); box-shadow: 2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light); }

/* ===== Right secondary sidebar ===== */
.neu-secondary {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 3px 3px 8px var(--neu-shadow-dark), -3px -3px 8px var(--neu-shadow-light);
  padding: 16px;
  overflow: hidden;
  min-width: 0;
}
.neu-secondary-tabs {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 0 12px;
  margin-bottom: 8px;
  flex-shrink: 0;
  overflow: visible;
}
.neu-secondary-tab {
  flex-shrink: 0;
  padding: 8px 14px;
  border: none;
  border-radius: 12px;
  background: var(--neu-bg);
  color: var(--neu-muted);
  font-size: 12px;
  font-weight: 500;
  box-shadow: 4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light);
  cursor: pointer;
  white-space: nowrap;
}
.neu-secondary-tab:hover { box-shadow: 2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light); color: var(--neu-text); }
.neu-secondary-tab[data-active="true"] {
  background: var(--neu-bg-light);
  color: var(--neu-accent);
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
}
.neu-secondary-content {
  position: relative;
  z-index: 0;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border-radius: var(--neu-radius-sm);
}
.neu-secondary-content > * { flex: 1; min-height: 0; }

/* ===== Review / Diff ===== */
.review-pane { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
.review-subtabs { display: flex; gap: 6px; padding: 0 12px 8px; }
.review-subtab {
  flex: 1;
  padding: 6px 8px;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-muted);
  font-size: 11px;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
}
.review-subtab:hover {
  color: var(--neu-text);
}
.review-subtab[data-active="true"] {
  background: var(--neu-bg-light);
  color: var(--neu-text);
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
}
.review-section-label {
  padding: 0 12px 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--neu-muted);
  text-transform: uppercase;
}
.review-git-ranges {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px 8px;
}
.review-git-ranges .neu-select {
  flex: 1;
  min-width: 0;
}
.review-git-arrow {
  color: var(--neu-muted);
  font-size: 12px;
  flex-shrink: 0;
}
.review-entity-control {
  padding: 0 12px 8px;
}
.review-select {
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-text);
  font-size: 11px;
  outline: none;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.review-diff-raw {
  padding: 8px 12px;
  margin: 6px 12px;
  border-radius: 10px;
  background: var(--neu-bg-light);
}
.review-diff-raw-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--neu-muted);
  margin-bottom: 4px;
}
.review-diff-raw pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.review-pr-detail {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px;
  margin: 0 12px 8px;
  border-radius: 12px;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.review-pr-row {
  font-size: 11px;
  color: var(--neu-muted);
}
.review-pr-label {
  font-weight: 700;
  margin-right: 6px;
  color: var(--neu-muted);
}
.review-pr-text {
  color: var(--neu-text);
}
.review-pr-result {
  margin: 4px 0 0;
  padding: 6px 8px;
  max-height: 80px;
  overflow: auto;
  border-radius: 8px;
  background: var(--neu-bg-light);
  color: var(--neu-text);
  white-space: pre-wrap;
  font-family: var(--neu-font-mono);
  font-size: 10px;
}
.review-entity-list {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 0 12px 8px;
}
.review-entity-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-muted);
  font-size: 11px;
  cursor: pointer;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.review-entity-button[data-active="true"] {
  background: var(--neu-bg-light);
  color: var(--neu-text);
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
}
.review-entity-count {
  font-weight: 700;
  color: var(--neu-accent);
}
.review-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px;
  margin-bottom: 10px;
  border-radius: 12px;
  background: var(--neu-bg);
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
}
.review-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--neu-text); }
.review-title svg { color: var(--neu-accent); }
.review-meta { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--neu-muted); }
.review-additions { color: var(--neu-success); font-weight: 600; }
.review-deletions { color: var(--neu-error); font-weight: 600; }
.review-body { display: flex; flex: 1; min-height: 0; overflow: hidden; }

.review-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 24px;
  text-align: center;
  color: var(--neu-muted);
}
.review-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: var(--neu-bg);
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
  color: var(--neu-accent);
}
.review-empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--neu-text);
}
.review-empty-desc {
  font-size: 12px;
  line-height: 1.6;
  max-width: 320px;
}

.review-resizer {
  width: 6px;
  flex: 0 0 6px;
  cursor: col-resize;
  background: transparent;
  touch-action: none;
  transition: background 0.2s ease;
}
.review-resizer:hover { background: var(--neu-resizer-hover); border-radius: 8px; }
.review-files {
  width: 230px; flex-shrink: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--neu-bg);
  border-radius: 12px;
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
  padding: 6px;
}
.review-files-heading { padding: 8px 10px; font-size: 10px; font-weight: 600; color: var(--neu-muted); text-transform: uppercase; }
.review-file-row {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 8px 10px;
  background: transparent; border: none;
  border-radius: 10px; color: var(--neu-muted);
  font-family: var(--neu-font-mono); font-size: 11px; text-align: left; cursor: pointer;
}
.review-file-row:hover { background: var(--neu-bg-light); }
.review-file-row[data-active="true"] { background: var(--neu-bg-light); box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light); color: var(--neu-text); }
.review-file-status.is-added { color: var(--neu-success); }
.review-file-status.is-modified { color: var(--neu-warning); }
.review-file-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.review-file-stats { display: flex; gap: 6px; font-size: 10px; }
.review-files[data-narrow="true"] .review-file-stats { display: none; }
.review-diff { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 10px; overflow: hidden; margin-left: 10px; }
.review-diff-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px;
  border-radius: 12px;
  background: var(--neu-bg);
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
  font-family: var(--neu-font-mono); font-size: 11px; color: var(--neu-muted);
}
.review-diff-path { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.review-diff-actions { display: flex; gap: 2px; }
.review-icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: transparent; border: none; color: var(--neu-muted); cursor: pointer; border-radius: 8px; }
.review-icon-btn:hover { background: var(--neu-bg-light); color: var(--neu-text); }
.review-diff-content { flex: 1; overflow-y: auto; overflow-x: auto; font-family: var(--neu-font-mono); font-size: 11px; line-height: 1.65; background: var(--neu-bg-light); border-radius: 12px; box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light); padding: 12px 0 14px; }
.review-diff-line { display: flex; min-width: 0; }
.review-diff-pos { width: 32px; flex-shrink: 0; text-align: right; padding-right: 6px; user-select: none; color: var(--neu-muted); }
.review-diff-sign { width: 16px; flex-shrink: 0; text-align: center; user-select: none; }
.review-diff-text { flex: 1; white-space: pre; padding-right: 10px; }
.review-diff-line.is-header { background: transparent; }
.review-diff-line.is-header .review-diff-text {
  color: var(--neu-muted);
  font-size: 10px;
  opacity: 0.82;
}
.review-diff-line.is-header .review-diff-sign,
.review-diff-line.is-header .review-diff-pos {
  color: var(--neu-muted);
  font-size: 10px;
}
.review-diff-line.is-removed { background: var(--neu-diff-removed-bg); }
.review-diff-line.is-removed .review-diff-sign { color: var(--neu-error); }
.review-diff-line.is-added { background: var(--neu-diff-added-bg); }
.review-diff-line.is-added .review-diff-sign { color: var(--neu-success); }
.review-diff-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px 10px;
  margin-top: 8px;
  overflow: hidden;
  background: var(--neu-bg);
  border-radius: 18px;
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
}
.review-commit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: auto;
  min-width: 0;
  max-width: calc(100% - 16px);
  margin: 0 8px;
  padding: 7px 14px;
  background: var(--neu-bg-light);
  color: var(--neu-accent);
  border: none;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
  transition: box-shadow 0.2s ease, background-color 0.2s ease, color 0.2s ease;
}
.review-commit-btn:hover {
  box-shadow: 2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light);
  color: var(--neu-accent-soft);
}
.review-commit-btn:active {
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
  color: var(--neu-accent);
}
.review-commit-btn svg {
  transition: transform 0.15s ease, color 0.15s ease;
}
.review-commit-btn:active svg {
  transform: scale(0.82);
  opacity: 0.85;
}

/* ===== Terminal ===== */
.terminal-pane { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--neu-bg-light); border-radius: 12px; box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light); }
.agent-panel { display: flex; flex-direction: column; height: 100%; min-height: 0; overflow: hidden; }
.agent-subtabs { display: flex; gap: 6px; padding: 0 12px 8px; flex-shrink: 0; }
.agent-subtab {
  flex: 1;
  padding: 6px 8px;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-muted);
  font-size: 11px;
  cursor: pointer;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.agent-subtab[data-active="true"] {
  background: var(--neu-bg-light);
  color: var(--neu-text);
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
}
.agent-layout { display: flex; flex: 1; min-height: 0; }
.agent-sidebar { width: 220px; flex-shrink: 0; overflow-y: auto; padding: 8px; border-right: 1px solid var(--neu-divider); }
.agent-card { display: block; width: 100%; text-align: left; border: none; border-radius: 10px; padding: 8px 10px; margin-bottom: 6px; background: var(--neu-bg); color: var(--neu-text); cursor: pointer; box-shadow: 2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light); }
.agent-card[data-active="true"] { box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light); }
.agent-card-title { font-size: 12px; font-weight: 600; margin-bottom: 2px; }
.agent-card-status { font-size: 10px; color: var(--neu-muted); margin-bottom: 2px; }
.agent-card-detail { font-size: 11px; color: var(--neu-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.agent-stream { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; }
.agent-stream .natalia-transcript { flex: 1; }
.agent-empty { padding: 12px; color: var(--neu-muted); font-size: 12px; }
.agent-tree-child { margin-left: 12px; }
.todo-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  font-size: 12px;
  color: var(--neu-text);
}
.todo-row:hover { background: var(--neu-bg-light); }
.todo-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--neu-muted);
}
.todo-dot[data-status="in_progress"] { background: var(--neu-accent); }
.todo-dot[data-status="completed"] { background: var(--neu-success); }
.todo-text { flex: 1; min-width: 0; }
.todo-status { font-size: 10px; color: var(--neu-muted); }
.todo-completed-header {
  margin: 12px 0 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--neu-muted);
  text-transform: uppercase;
}
.todo-completed-text { color: var(--neu-muted); text-decoration: line-through; }
.agent-empty-full {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--neu-muted);
  text-align: center;
  padding: 24px;
}
.agent-tree-child { margin-left: 12px; }
.agent-stream-header { padding: 8px 12px; border-bottom: 1px solid var(--neu-divider); }
.agent-stream-title { font-size: 13px; font-weight: 600; }
.agent-stream-meta { font-size: 11px; color: var(--neu-muted); margin-top: 2px; }
.team-panel { flex: 1; min-height: 0; overflow-y: auto; padding: 10px; }
.team-header { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.team-stat { display: flex; justify-content: space-between; padding: 6px 10px; border-radius: 10px; background: var(--neu-bg); margin-bottom: 8px; font-size: 12px; }
.team-card { padding: 8px 10px; border-radius: 10px; background: var(--neu-bg); margin-bottom: 6px; box-shadow: 2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light); }
.team-card-title { font-size: 12px; font-weight: 600; }
.team-card-detail { font-size: 11px; color: var(--neu-muted); }
.team-card-result { font-size: 11px; color: var(--neu-success); margin-top: 4px; }
.team-queue-card { padding: 10px 12px; border-radius: 12px; background: var(--neu-bg); margin-bottom: 8px; box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light); }
.team-queue-title { font-size: 12px; font-weight: 600; margin-bottom: 4px; }
.team-queue-meta { display: flex; gap: 8px; flex-wrap: wrap; font-size: 11px; color: var(--neu-muted); }
.team-queue-result { margin-top: 6px; font-size: 11px; color: var(--neu-text); white-space: pre-wrap; }
.natalia-tool-summary { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--neu-muted); }
.team-card-result { font-size: 11px; color: var(--neu-success); margin-top: 4px; }
.team-card-error { font-size: 11px; color: var(--neu-error); margin-top: 4px; }
.terminal-pane { display: flex; flex-direction: column; height: 100%; overflow: hidden; background: var(--neu-bg-light); border-radius: 12px; box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light); }
.terminal-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 10px 0;
  flex-shrink: 0;
}
.terminal-search-input {
  border: none;
  border-radius: 8px;
  padding: 4px 8px;
  width: 90px;
  background: var(--neu-bg);
  color: var(--neu-text);
  font-size: 11px;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
  outline: none;
}
.terminal-toolbar-btn {
  border: none;
  border-radius: 10px;
  padding: 4px 10px;
  background: var(--neu-bg);
  color: var(--neu-muted);
  font-size: 11px;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
}
.terminal-toolbar-btn:hover { color: var(--neu-text); }
.terminal-toolbar-btn:active {
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.terminal-owner-badge {
  padding: 3px 8px;
  border-radius: 8px;
  font-size: 11px;
  background: var(--neu-bg-light);
  color: var(--neu-muted);
}
.terminal-owner-badge[data-owner="human"] {
  color: var(--neu-accent);
}
.terminal-profile-select { width: 92px; flex-shrink: 0; }
.terminal-profile-select .neu-select-trigger { padding: 5px 8px; font-size: 11px; }
.terminal-profile-select .neu-select-option { font-size: 11px; }
.terminal-split-stack {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 4px;
  padding: 4px;
}
.terminal-split-cell {
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid transparent;
  display: flex;
}
.terminal-split-cell[data-active="true"] {
  border-color: var(--neu-accent);
}
.terminal-tabs { display: flex; align-items: center; gap: 6px; padding: 8px 10px 0; flex-shrink: 0; overflow-x: auto; }
.terminal-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 6px 10px;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-muted);
  font-size: 11px;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
}
.terminal-tab[data-active="true"] {
  background: var(--neu-bg-light);
  color: var(--neu-accent);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.terminal-tab-label { white-space: nowrap; }
.terminal-tab-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 7px;
  color: var(--neu-muted);
  font-size: 12px;
  line-height: 1;
}
.terminal-tab-close:hover { color: var(--neu-error); }
.terminal-tab-add {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-muted);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
}
.terminal-tab-add:disabled { opacity: 0.45; cursor: not-allowed; }
.terminal-limit-error { padding: 4px 12px 0; font-size: 11px; color: var(--neu-error); }
.terminal-xterm-stack { position: relative; flex: 1; min-height: 0; }
.terminal-xterm-host {
  position: absolute;
  inset: 0;
  display: none;
  border-radius: 12px;
  overflow: hidden;
}
.terminal-xterm-host[data-active="true"] { display: flex; }
.web-terminal {
  flex: 1;
  min-height: 0;
  padding: 8px;
  border-radius: 10px;
  overflow: hidden;
  background: #1b1e24;
}
.web-terminal .xterm { height: 100%; border-radius: 10px; overflow: hidden; }
.web-terminal .xterm-viewport { overflow-y: auto !important; border-radius: 10px; }
.terminal-output { flex: 1; overflow-y: auto; padding: 12px; font-family: var(--neu-font-mono); font-size: 12px; line-height: 1.6; color: var(--neu-text); }
.terminal-line { color: var(--neu-muted); white-space: pre-wrap; word-break: break-all; }
.terminal-line-terminal { color: var(--neu-text); }
.terminal-line-success { color: var(--neu-success); }
.terminal-input-line { display: flex; align-items: center; color: var(--neu-muted); font-family: var(--neu-font-mono); font-size: 12px; }
.terminal-prompt { color: var(--neu-accent); }
.terminal-cursor { width: 7px; height: 14px; background: var(--neu-muted); animation: neu-blink 1s step-end infinite; margin-left: 2px; }

/* ===== Browser ===== */
.browser-pane { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.browser-nav-btn {
  border: none;
  border-radius: 8px;
  width: 30px;
  height: 28px;
  background: var(--neu-bg);
  color: var(--neu-muted);
  font-size: 14px;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
}
.browser-nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.browser-nav-btn:active {
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.browser-url-form { flex: 1; min-width: 0; display: flex; align-items: center; gap: 6px; }
.browser-url-input {
  flex: 1;
  min-width: 0;
  width: 100%;
  border: none;
  border-radius: 10px;
  padding: 7px 10px;
  background: var(--neu-bg);
  color: var(--neu-text);
  font-size: 11px;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
  outline: none;
}
.browser-url-input-loading {
  color: var(--neu-muted);
}
.browser-loading-bar {
  height: 2px;
  margin: 0 10px 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, var(--neu-accent), transparent);
  background-size: 200% 100%;
  animation: neu-browser-loading 1.1s linear infinite;
}
.browser-error {
  margin: 0 10px 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--neu-error-soft);
  color: var(--neu-error);
  font-size: 12px;
}
.browser-pause-hint {
  margin: 0 10px 8px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--neu-bg-light);
  color: var(--neu-accent);
  font-size: 12px;
}
.browser-owner-btn {
  width: auto;
  padding: 0 8px;
  font-size: 11px;
}
.browser-owner-btn[data-active="true"] {
  color: var(--neu-accent);
}
.browser-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px 8px;
  flex-shrink: 0;
  overflow-x: auto;
}
.browser-approval {
  margin: 0 10px 8px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--neu-bg-light);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.browser-approval-title {
  font-size: 12px;
  color: var(--neu-text);
  margin-bottom: 4px;
}
.browser-approval-summary {
  font-size: 12px;
  color: var(--neu-muted);
  margin-bottom: 8px;
  word-break: break-all;
}
.browser-approval-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
@keyframes neu-browser-loading {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}
.browser-frame { flex: 1; min-height: 0; width: 100%; border: none; background: white; }
.browser-webview-host { flex: 1; min-height: 0; border-radius: 12px; overflow: hidden; background: var(--neu-bg-light); }
.browser-load-btn {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  padding: 0;
  background: var(--neu-accent);
  color: var(--neu-on-accent);
  font-size: 11px;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
}
.browser-frame { flex: 1; min-height: 0; width: 100%; border: none; background: white; }
.browser-pane { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.browser-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin-bottom: 10px; background: var(--neu-bg); border-radius: 12px; box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light); }
.browser-url-bar { flex: 1; display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--neu-bg-light); border-radius: 10px; box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light); }
.browser-url-text { font-size: 12px; color: var(--neu-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.browser-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--neu-muted); background: var(--neu-bg-light); border-radius: 12px; box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light); }
.browser-empty-icon { opacity: 0.5; }
.browser-empty-text { font-size: 13px; color: var(--neu-muted); }

/* ===== Scrollbars ===== */
*::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
*::-webkit-scrollbar:horizontal {
  height: 6px;
}
*::-webkit-scrollbar-track {
  background: transparent;
}
*::-webkit-scrollbar-thumb {
  background: var(--neu-scrollbar);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
*::-webkit-scrollbar-thumb:horizontal {
  border: 0;
  border-radius: 999px;
}
*::-webkit-scrollbar-track:horizontal {
  margin: 0 10px;
}
*::-webkit-scrollbar-thumb:hover {
  background: var(--neu-scrollbar-hover);
  background-clip: padding-box;
}
*::-webkit-scrollbar-thumb:horizontal:hover {
  border: 0;
  border-radius: 999px;
}

/* ===== Settings panel ===== */
.neu-plugin-window {
  width: min(520px, 90vw);
  max-height: 80vh;
  overflow-y: auto;
  border-radius: 18px;
  background: var(--neu-bg);
  box-shadow: 8px 8px 16px var(--neu-shadow-dark), -8px -8px 16px var(--neu-shadow-light);
  padding: 16px;
  scrollbar-width: thin;
  scrollbar-color: var(--neu-scrollbar) transparent;
}
.neu-plugin-window::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.neu-plugin-window::-webkit-scrollbar-track {
  background: transparent;
}
.neu-plugin-window::-webkit-scrollbar-thumb {
  background: var(--neu-scrollbar);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
.neu-plugin-window::-webkit-scrollbar-thumb:hover {
  background: var(--neu-scrollbar-hover);
  background-clip: padding-box;
}
.neu-plugin-body { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.neu-plugin-section-title { font-size: 12px; font-weight: 700; color: var(--neu-muted); text-transform: uppercase; }
.neu-plugin-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; background: var(--neu-bg-light); }
.neu-plugin-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.neu-plugin-name { color: var(--neu-text); font-size: 12px; font-weight: 600; }
.neu-plugin-meta { color: var(--neu-muted); font-size: 10px; font-family: var(--neu-font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.neu-plugin-btn {
  padding: 5px 10px;
  border: 1px solid var(--neu-hairline);
  border-radius: 10px;
  background: var(--neu-bg-light);
  color: var(--neu-text);
  font-size: 11px;
  cursor: pointer;
  box-shadow: 2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light);
}
.neu-confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: var(--neu-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
}
.neu-confirm-box {
  width: min(360px, 84vw);
  padding: 16px;
  border-radius: 16px;
  background: var(--neu-bg);
  box-shadow: 8px 8px 20px var(--neu-shadow-dark), -8px -8px 20px var(--neu-shadow-light);
}
.neu-confirm-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--neu-text);
  margin-bottom: 8px;
}
.neu-confirm-text {
  font-size: 12px;
  color: var(--neu-muted);
  margin-bottom: 14px;
}
.neu-confirm-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.neu-confirm-danger {
  color: var(--neu-on-error);
  background: var(--neu-error);
  border-color: transparent;
}
.neu-plugin-btn:active {
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
  transform: translateY(1px);
}
.neu-plugin-switch {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}
.neu-plugin-switch input {
  display: none;
}
.neu-plugin-switch-track {
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: var(--neu-muted);
  opacity: 0.5;
  position: relative;
  transition: background 0.2s ease, opacity 0.2s ease;
}
.neu-plugin-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--neu-thumb);
  box-shadow: var(--neu-thumb-shadow);
  transition: left 0.2s ease;
}
.neu-plugin-switch input:checked + .neu-plugin-switch-track {
  background: var(--neu-success);
  opacity: 1;
}
.neu-plugin-switch input:checked + .neu-plugin-switch-track .neu-plugin-switch-thumb {
  left: 18px;
}
.neu-plugin-empty { color: var(--neu-muted); font-size: 12px; }
.neu-plugin-error { color: var(--neu-error); font-size: 12px; }
.neu-plugin-install { display: flex; gap: 8px; }
.neu-plugin-input {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg-light);
  color: var(--neu-text);
  font-size: 12px;
  outline: none;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--neu-overlay-scrim);
  backdrop-filter: blur(2px);
}
.neu-settings-window {
  width: min(920px, 90vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 6px 6px 16px var(--neu-shadow-dark), -6px -6px 16px var(--neu-shadow-light);
  overflow: hidden;
}
.neu-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--neu-hairline);
  flex-shrink: 0;
}
.neu-settings-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--neu-text);
}
.neu-settings-close {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-muted);
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
}
.neu-settings-close:active {
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-settings-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.neu-settings-categories {
  width: 200px;
  flex-shrink: 0;
  padding: 14px;
  border-right: 1px solid var(--neu-hairline);
  overflow-y: auto;
}
.neu-settings-category {
  display: block;
  width: 100%;
  padding: 10px 12px;
  margin-bottom: 4px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--neu-muted);
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.neu-settings-category:hover {
  background: var(--neu-bg);
  color: var(--neu-text);
}
.neu-settings-category[data-active="true"] {
  background: var(--neu-bg);
  color: var(--neu-accent);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-settings-content {
  flex: 1;
  min-width: 0;
  padding: 18px 20px;
  overflow-y: auto;
}
.neu-settings-content-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--neu-text);
  margin-bottom: 14px;
}
.neu-settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  margin-bottom: 8px;
  background: var(--neu-bg);
  border-radius: 12px;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-settings-item-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.neu-settings-item-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--neu-text);
}
.neu-settings-item-description {
  font-size: 12px;
  color: var(--neu-muted);
}
.neu-settings-item-value {
  font-size: 12px;
  color: var(--neu-accent);
  white-space: nowrap;
  padding: 4px 10px;
  border-radius: 10px;
  background: var(--neu-bg-light);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
button.neu-settings-item.neu-settings-item-button {
  width: 100%;
  border: none;
  text-align: left;
  font-family: inherit;
  cursor: pointer;
}
button.neu-settings-item.neu-settings-item-button:active {
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
}

/* ===== Session action toolbar / panel ===== */
.neu-session-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 2px 4px;
}
.neu-session-toolbar-label {
  font-size: 11px;
  color: var(--neu-muted);
}
.neu-session-toolbar-btn {
  padding: 5px 10px;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-text);
  font-size: 12px;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
}
.neu-session-toolbar-btn:hover {
  box-shadow: 2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light);
  color: var(--neu-accent);
}
.neu-session-toolbar-btn:active {
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-session-window {
  width: min(420px, 90vw);
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 6px 6px 16px var(--neu-shadow-dark), -6px -6px 16px var(--neu-shadow-light);
  overflow: hidden;
}
.neu-session-current {
  margin: 14px 20px 0;
  padding: 12px 14px;
  font-size: 13px;
  color: var(--neu-muted);
  background: var(--neu-bg);
  border-radius: 12px;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-session-current strong {
  color: var(--neu-text);
}
.neu-session-actions {
  padding: 14px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.neu-session-action-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 12px 14px;
  border: none;
  border-radius: 12px;
  background: var(--neu-bg);
  color: var(--neu-text);
  text-align: left;
  cursor: pointer;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-session-action-row:hover {
  background: var(--neu-bg-light);
}
.neu-session-action-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--neu-text);
}
.neu-session-action-description {
  font-size: 12px;
  color: var(--neu-muted);
}

/* ===== Checkpoint panel ===== */
.neu-checkpoint-window {
  width: min(620px, 90vw);
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 6px 6px 16px var(--neu-shadow-dark), -6px -6px 16px var(--neu-shadow-light);
  overflow: hidden;
}
.neu-checkpoint-current {
  padding: 12px 14px;
  margin: 14px 20px 0;
  border-radius: 12px;
  background: var(--neu-bg);
  font-size: 13px;
  color: var(--neu-muted);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-checkpoint-current strong { color: var(--neu-text); }
.neu-checkpoint-list {
  flex: 1;
  min-height: 0;
  padding: 14px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.neu-checkpoint-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-checkpoint-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.neu-checkpoint-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--neu-text);
}
.neu-checkpoint-time {
  font-size: 11px;
  color: var(--neu-muted);
}
.neu-checkpoint-id {
  font-size: 11px;
  color: var(--neu-muted);
  font-family: var(--neu-font-mono);
}
.neu-checkpoint-status {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 8px;
  background: var(--neu-bg-light);
  color: var(--neu-muted);
}
.neu-checkpoint-status[data-current="true"] {
  color: var(--neu-accent);
}
.neu-checkpoint-action {
  padding: 5px 10px;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg-light);
  color: var(--neu-text);
  font-size: 12px;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
}
.neu-checkpoint-action:active {
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-checkpoint-action:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
  background: var(--neu-bg);
}
.neu-checkpoint-actions {
  padding: 0 20px 18px;
  display: flex;
  justify-content: flex-end;
}
.neu-checkpoint-create {
  padding: 8px 16px;
  border: none;
  border-radius: 12px;
  background: var(--neu-accent);
  color: var(--neu-on-accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-accent-shadow), -3px -3px 6px var(--neu-shadow-light);
}
.neu-checkpoint-create:active {
  box-shadow: inset 3px 3px 6px var(--neu-inset-pressed-dark), inset -3px -3px 6px var(--neu-inset-pressed-light);
}

/* ===== Permission approval panel ===== */
.neu-permission-window {
  width: min(520px, 90vw);
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 6px 6px 16px var(--neu-shadow-dark), -6px -6px 16px var(--neu-shadow-light);
  overflow: hidden;
}
.neu-permission-body {
  padding: 16px 20px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.neu-permission-tool {
  display: flex;
  align-items: center;
  gap: 8px;
}
.neu-permission-tool-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--neu-text);
  font-family: var(--neu-font-mono);
}
.neu-permission-tool-badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 8px;
  background: var(--neu-bg);
  color: var(--neu-warning);
}
.neu-permission-command {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  background: var(--neu-bg);
  border-radius: 12px;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-permission-label {
  font-size: 11px;
  color: var(--neu-muted);
  text-transform: uppercase;
}
.neu-permission-command-text {
  font-family: var(--neu-font-mono);
  font-size: 13px;
  color: var(--neu-text);
  white-space: pre-wrap;
  word-break: break-all;
}
.neu-permission-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--neu-muted);
}
.neu-permission-actions {
  display: flex;
  gap: 8px;
  padding: 0 20px 20px;
}
.neu-permission-btn {
  flex: 1;
  padding: 9px 12px;
  border: none;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
  transition: box-shadow 0.2s ease, background-color 0.2s ease, color 0.2s ease;
}
.neu-permission-btn:active {
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
}
.neu-permission-deny {
  background: var(--neu-bg);
  color: var(--neu-error);
}
.neu-permission-allow {
  background: var(--neu-bg);
  color: var(--neu-success);
}
.neu-permission-allow-session {
  background: var(--neu-accent);
  color: var(--neu-on-accent);
}

/* ===== Permission reject reason ===== */
.neu-permission-reject-box {
  padding: 0 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.neu-permission-reject-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--neu-text);
}
.neu-permission-reason {
  width: 100%;
  min-height: 72px;
  resize: none;
  border: none;
  outline: none;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--neu-bg);
  color: var(--neu-text);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-permission-reason::placeholder {
  color: var(--neu-muted);
}
.neu-permission-reject-submit {
  background: var(--neu-bg);
  color: var(--neu-error);
}

/* ===== Status & diagnostics panel ===== */
.neu-status-window {
  width: min(720px, 90vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 6px 6px 16px var(--neu-shadow-dark), -6px -6px 16px var(--neu-shadow-light);
  overflow: hidden;
}
.neu-status-tabs {
  display: flex;
  gap: 8px;
  padding: 14px 20px 0;
}
.neu-status-tabs .neu-settings-category {
  width: auto;
  padding: 8px 16px;
  background: var(--neu-bg);
}
.neu-status-content {
  flex: 1;
  min-height: 0;
  padding: 14px 20px 20px;
  overflow-y: auto;
}
.neu-status-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.neu-status-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px;
  border-radius: 12px;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-status-card-label {
  font-size: 11px;
  color: var(--neu-muted);
}
.neu-status-card-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--neu-text);
}
.neu-status-diagnostics {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.neu-diagnostic-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-diagnostic-level {
  width: 48px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}
.neu-diagnostic-row[data-level="info"] .neu-diagnostic-level { color: var(--neu-success); }
.neu-diagnostic-row[data-level="warn"] .neu-diagnostic-level { color: var(--neu-warning); }
.neu-diagnostic-row[data-level="error"] .neu-diagnostic-level { color: var(--neu-error); }
.neu-diagnostic-message {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--neu-text);
}
.neu-diagnostic-time {
  font-size: 11px;
  color: var(--neu-muted);
}
.neu-status-section-title {
  margin: 8px 0 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--neu-muted);
}
.neu-status-tools {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.neu-status-tool-row,
.neu-status-cap-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-status-tool-row {
  width: 100%;
  border: none;
  text-align: left;
  cursor: pointer;
}
.neu-status-tool-arrow {
  margin-left: auto;
  color: var(--neu-muted);
  font-size: 10px;
  flex-shrink: 0;
}
.neu-status-tool-detail {
  margin: 4px 0 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--neu-bg-light);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-status-tool-detail-summary {
  font-size: 12px;
  color: var(--neu-text);
  white-space: pre-wrap;
  line-height: 1.6;
}
.neu-status-tool-detail-raw {
  margin: 8px 0 0;
  padding: 8px;
  max-height: 220px;
  overflow: auto;
  border-radius: 8px;
  background: var(--neu-bg);
  font-size: 11px;
  color: var(--neu-muted);
  white-space: pre-wrap;
  word-break: break-word;
}
.neu-status-tool-name,
.neu-status-cap-name {
  width: 100px;
  font-size: 12px;
  font-weight: 600;
  color: var(--neu-text);
  font-family: var(--neu-font-mono);
}
.neu-status-tool-description,
.neu-status-cap-grants {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--neu-muted);
}
.neu-status-tool-status {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 8px;
  background: var(--neu-bg-light);
  color: var(--neu-muted);
}
.neu-status-tool-status[data-pending="true"] {
  color: var(--neu-warning);
}
.neu-status-cap-version {
  font-size: 11px;
  color: var(--neu-accent);
}

/* ===== Providers & models panel ===== */
.neu-model-window {
  width: min(620px, 90vw);
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 6px 6px 16px var(--neu-shadow-dark), -6px -6px 16px var(--neu-shadow-light);
  overflow: hidden;
}
.neu-model-tabs {
  display: flex;
  gap: 8px;
  padding: 14px 20px 0;
}
.neu-model-tabs .neu-settings-category {
  width: auto;
  padding: 8px 16px;
  background: var(--neu-bg);
}
.neu-model-content {
  flex: 1;
  min-height: 0;
  padding: 14px 20px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.neu-model-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-model-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--neu-text);
  font-family: var(--neu-font-mono);
}
.neu-model-kind {
  font-size: 12px;
  color: var(--neu-muted);
}
.neu-model-status {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 8px;
  background: var(--neu-bg-light);
  color: var(--neu-muted);
}
.neu-model-status[data-connected="true"] {
  color: var(--neu-success);
}
.neu-model-default {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 8px;
  background: var(--neu-bg-light);
  color: var(--neu-accent);
}
.neu-model-set-default {
  padding: 5px 10px;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg-light);
  color: var(--neu-text);
  font-size: 12px;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
}
.neu-model-set-default:active {
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-model-set-default:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}
.neu-model-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
}
.neu-model-add {
  padding: 8px 16px;
  border: none;
  border-radius: 12px;
  background: var(--neu-accent);
  color: var(--neu-on-accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-accent-shadow), -3px -3px 6px var(--neu-shadow-light);
}
.neu-model-add:active {
  box-shadow: inset 3px 3px 6px var(--neu-inset-pressed-dark), inset -3px -3px 6px var(--neu-inset-pressed-light);
}

/* ===== Model tree ===== */
.neu-model-tree {
  flex: 1;
  min-height: 0;
  padding: 14px 20px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.neu-model-provider {
  border-radius: 14px;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
  padding: 4px;
}
.neu-model-provider-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--neu-text);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.neu-model-provider-header:hover {
  background: var(--neu-bg-light);
}
.neu-model-chevron {
  width: 12px;
  height: 12px;
  color: var(--neu-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}
.neu-model-chevron[data-expanded="true"] { transform: rotate(90deg); }
.neu-model-provider-name { flex: 1; min-width: 0; }
.neu-model-edit {
  flex-shrink: 0;
  padding: 5px 10px;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-accent);
  font-size: 11px;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
}
.neu-model-edit:hover {
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}

.neu-model-children {
  padding: 2px 6px 6px 34px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.neu-model-add-secondary {
  margin-left: 8px;
  background: var(--neu-bg-light);
  color: var(--neu-text);
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
}

/* ===== Model form ===== */
.neu-form {
  flex: 1;
  min-height: 0;
  padding: 14px 20px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.neu-form-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.neu-form-label {
  font-size: 12px;
  color: var(--neu-muted);
}
.neu-form-input {
  width: 100%;
  padding: 9px 12px;
  border: none;
  outline: none;
  border-radius: 12px;
  background: var(--neu-bg);
  color: var(--neu-text);
  font-family: inherit;
  font-size: 13px;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-form-input::placeholder {
  color: var(--neu-muted);
}
.neu-form-select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 34px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23888c8f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 14px;
  cursor: pointer;
}
.neu-form-select option {
  background: var(--neu-bg-light);
  color: var(--neu-text);
}


.neu-select {
  position: relative;
  width: 100%;
}
.neu-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 9px 12px;
  border: none;
  outline: none;
  border-radius: 12px;
  background: var(--neu-bg);
  color: var(--neu-text);
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-select-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.neu-select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.neu-select-chevron {
  flex-shrink: 0;
  color: var(--neu-muted);
  transition: transform 0.2s ease;
}
.neu-select-chevron[data-open="true"] {
  transform: rotate(180deg);
}
.neu-select-menu {
  position: absolute;
  z-index: 50;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  max-height: 240px;
  overflow-y: auto;
  padding: 4px;
  border-radius: 12px;
  background: var(--neu-bg-light);
  box-shadow: 4px 4px 10px var(--neu-shadow-dark), -4px -4px 10px var(--neu-shadow-light);
}
.neu-select-option {
  display: block;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--neu-text);
  font-family: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}
.neu-select-option:hover,
.neu-select-option[data-active="true"] {
  background: var(--neu-bg);
  color: var(--neu-accent);
}
.neu-form-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.neu-form-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-text);
  font-size: 12px;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
  cursor: pointer;
}
.neu-form-checkbox input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: none;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
  cursor: pointer;
  flex-shrink: 0;
}
.neu-form-checkbox input[type="checkbox"]:checked {
  background: var(--neu-accent);
  box-shadow:
    inset 2px 2px 4px var(--neu-inset-pressed-dark),
    inset -2px -2px 4px var(--neu-inset-pressed-light),
    0 0 0 3px var(--neu-focus-ring);
}
.neu-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}
.neu-form-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
  transition: box-shadow 0.2s ease, background-color 0.2s ease, color 0.2s ease;
}
.neu-form-btn:active {
  box-shadow: inset 3px 3px 6px var(--neu-shadow-dark), inset -3px -3px 6px var(--neu-shadow-light);
}
.neu-form-cancel {
  background: var(--neu-bg);
  color: var(--neu-text);
}
.neu-form-primary {
  background: var(--neu-accent);
  color: var(--neu-on-accent);
}

/* ===== Provider edit form extensions ===== */
.neu-form-section-title {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--neu-text);
}
.neu-model-edit-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.neu-model-edit-row .neu-form-input {
  flex: 1;
  min-width: 120px;
}
.neu-model-remove {
  padding: 6px 10px;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-error);
  font-size: 12px;
  cursor: pointer;
  box-shadow: 2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light);
}
.neu-model-remove:active {
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-model-add-full {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin: 0;
}

/* ===== Extensions panel ===== */
.neu-extensions-window {
  width: min(640px, 90vw);
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 6px 6px 16px var(--neu-shadow-dark), -6px -6px 16px var(--neu-shadow-light);
  overflow: hidden;
}
.neu-extensions-tabs {
  display: flex;
  gap: 8px;
  padding: 14px 20px 0;
}
.neu-extensions-tabs .neu-settings-category {
  width: auto;
  padding: 8px 16px;
  background: var(--neu-bg);
}
.neu-extensions-content {
  flex: 1;
  min-height: 0;
  padding: 14px 20px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.neu-extension-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-extension-name {
  width: 110px;
  font-size: 12px;
  font-weight: 600;
  color: var(--neu-text);
  font-family: var(--neu-font-mono);
}
.neu-extension-description {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--neu-muted);
}
.neu-extension-status,
.neu-extension-toggle {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 8px;
  background: var(--neu-bg-light);
  color: var(--neu-muted);
  white-space: nowrap;
}
.neu-extension-status[data-connected="true"],
.neu-extension-toggle[data-enabled="true"] {
  color: var(--neu-success);
}
.neu-extension-toggle[data-enabled="false"] {
  color: var(--neu-error);
}
.neu-extension-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
}
.neu-extension-add {
  padding: 8px 16px;
  border: none;
  border-radius: 12px;
  background: var(--neu-accent);
  color: var(--neu-on-accent);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-accent-shadow), -3px -3px 6px var(--neu-shadow-light);
}
.neu-extension-add:active {
  box-shadow: inset 3px 3px 6px var(--neu-inset-pressed-dark), inset -3px -3px 6px var(--neu-inset-pressed-light);
}

/* ===== Inline extensions in settings ===== */
.neu-extension-inline-section {
  margin-bottom: 14px;
}
.neu-extension-inline-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--neu-text);
  margin-bottom: 8px;
}

/* ===== Extension row actions ===== */
.neu-extension-btn {
  padding: 5px 10px;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg-light);
  color: var(--neu-text);
  font-size: 12px;
  cursor: pointer;
  box-shadow: 2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light);
  white-space: nowrap;
}
.neu-extension-btn:active {
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-extension-remove {
  color: var(--neu-error);
}
.neu-extension-primary-btn {
  background: var(--neu-accent);
  color: var(--neu-on-accent);
}
.neu-extension-add-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 0 4px;
  flex-wrap: wrap;
}
.neu-extension-add-row .neu-form-input {
  flex: 1;
  min-width: 120px;
}

/* ===== Extension add forms ===== */
.neu-extension-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0 4px;
}
.neu-extension-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* ===== Workspace search panel ===== */
.neu-search-window {
  width: min(620px, 90vw);
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 6px 6px 16px var(--neu-shadow-dark), -6px -6px 16px var(--neu-shadow-light);
  overflow: hidden;
}
.neu-search-body {
  flex: 1;
  min-height: 0;
  padding: 14px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.neu-search-input {
  flex-shrink: 0;
}
.neu-search-results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.neu-search-result {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 12px;
  border: none;
  border-radius: 12px;
  background: var(--neu-bg);
  color: var(--neu-text);
  text-align: left;
  cursor: pointer;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-search-result:hover {
  background: var(--neu-bg-light);
}
.neu-search-path {
  font-size: 12px;
  font-weight: 600;
  color: var(--neu-accent);
  font-family: var(--neu-font-mono);
}
.neu-search-snippet {
  font-size: 12px;
  color: var(--neu-muted);
  font-family: var(--neu-font-mono);
}

/* ===== Help panel ===== */
.neu-help-window {
  width: min(560px, 90vw);
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 6px 6px 16px var(--neu-shadow-dark), -6px -6px 16px var(--neu-shadow-light);
  overflow: hidden;
}
.neu-help-body {
  flex: 1;
  min-height: 0;
  padding: 14px 20px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.neu-help-section-title {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--neu-text);
}
.neu-help-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-help-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--neu-text);
}
.neu-help-item-text {
  font-size: 12px;
  color: var(--neu-muted);
}
.neu-help-shortcut {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-help-shortcut-keys {
  min-width: 130px;
  font-size: 12px;
  font-weight: 600;
  color: var(--neu-accent);
  font-family: var(--neu-font-mono);
}
.neu-help-shortcut-desc {
  font-size: 12px;
  color: var(--neu-muted);
}

/* ===== Stash panel ===== */
.neu-stash-window {
  width: min(620px, 90vw);
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 6px 6px 16px var(--neu-shadow-dark), -6px -6px 16px var(--neu-shadow-light);
  overflow: hidden;
}
.neu-stash-body {
  flex: 1;
  min-height: 0;
  padding: 14px 20px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.neu-stash-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-stash-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.neu-stash-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--neu-text);
}
.neu-stash-content {
  font-size: 12px;
  color: var(--neu-muted);
}
.neu-stash-time {
  font-size: 11px;
  color: var(--neu-muted);
}
.neu-stash-btn {
  padding: 5px 10px;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg-light);
  color: var(--neu-text);
  font-size: 12px;
  cursor: pointer;
  box-shadow: 2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light);
}
.neu-stash-btn:active {
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-stash-remove {
  color: var(--neu-error);
}
.neu-stash-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0 4px;
}
.neu-stash-textarea {
  min-height: 72px;
  resize: none;
}

/* ===== Flow / Task panel ===== */
.neu-flow-window {
  width: min(620px, 90vw);
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 6px 6px 16px var(--neu-shadow-dark), -6px -6px 16px var(--neu-shadow-light);
  overflow: hidden;
}
.neu-flow-tabs {
  display: flex;
  gap: 8px;
  padding: 14px 20px 0;
}
.neu-flow-tabs .neu-settings-category {
  width: auto;
  padding: 8px 16px;
  background: var(--neu-bg);
}
.neu-flow-content {
  flex: 1;
  min-height: 0;
  padding: 14px 20px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.neu-flow-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-flow-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--neu-text);
  font-family: var(--neu-font-mono);
}
.neu-flow-detail {
  font-size: 12px;
  color: var(--neu-muted);
}
.neu-flow-status {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 8px;
  background: var(--neu-bg-light);
  color: var(--neu-muted);
  white-space: nowrap;
}
.neu-flow-status[data-running="true"] {
  color: var(--neu-success);
}

/* ===== Flow / Task detail ===== */
.neu-flow-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 12px 14px;
  border: none;
  border-radius: 12px;
  background: var(--neu-bg);
  color: var(--neu-text);
  text-align: left;
  cursor: pointer;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-flow-card:hover {
  background: var(--neu-bg-light);
}
.neu-flow-card-title {
  font-size: 13px;
  font-weight: 600;
}
.neu-flow-card-id {
  font-size: 11px;
  color: var(--neu-muted);
  font-family: var(--neu-font-mono);
}
.neu-flow-card-meta {
  font-size: 11px;
  color: var(--neu-muted);
}
.neu-flow-back {
  align-self: flex-start;
  padding: 5px 10px;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-text);
  font-size: 12px;
  cursor: pointer;
  box-shadow: 2px 2px 4px var(--neu-shadow-dark), -2px -2px 4px var(--neu-shadow-light);
}
.neu-flow-detail-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--neu-text);
}
.neu-flow-detail-id {
  font-size: 11px;
  color: var(--neu-muted);
  font-family: var(--neu-font-mono);
}
.neu-flow-detail-field {
  font-size: 12px;
  color: var(--neu-muted);
  margin-top: 2px;
}
.neu-flow-module {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-flow-module-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.neu-flow-module-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--neu-text);
}
.neu-flow-module-type {
  font-size: 11px;
  color: var(--neu-accent);
  font-family: var(--neu-font-mono);
}
.neu-flow-module-enabled {
  margin-left: auto;
  font-size: 11px;
  color: var(--neu-muted);
}
.neu-flow-module-enabled[data-enabled="true"] {
  color: var(--neu-success);
}
.neu-flow-module-instructions {
  font-size: 12px;
  color: var(--neu-muted);
}
.neu-flow-prompt {
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--neu-bg);
  color: var(--neu-text);
  font-size: 12px;
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}

/* ===== Flow editor section title ===== */
.neu-flow-section-title {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--neu-text);
}

/* ===== Flow preview & problems ===== */
.neu-flow-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-flow-preview-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--neu-text);
}
.neu-flow-problems {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.neu-flow-problem {
  padding: 6px 10px;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-warning);
  font-size: 12px;
}

/* ===== Sandbox panel ===== */
.neu-sandbox-window {
  width: min(620px, 90vw);
  max-height: 78vh;
  display: flex;
  flex-direction: column;
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 6px 6px 16px var(--neu-shadow-dark), -6px -6px 16px var(--neu-shadow-light);
  overflow: hidden;
}
.neu-sandbox-body {
  flex: 1;
  min-height: 0;
  padding: 14px 20px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.neu-sandbox-change {
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-warning);
  font-size: 12px;
}

/* ===== Governance panel ===== */
.neu-governance-window {
  width: min(720px, 90vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 6px 6px 16px var(--neu-shadow-dark), -6px -6px 16px var(--neu-shadow-light);
  overflow: hidden;
}
.neu-governance-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 20px 0;
}
.neu-governance-tabs .neu-settings-category {
  width: auto;
  padding: 8px 14px;
  background: var(--neu-bg);
}
.neu-governance-content {
  flex: 1;
  min-height: 0;
  padding: 14px 20px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.neu-gov-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--neu-bg);
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}
.neu-gov-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--neu-accent);
  font-family: var(--neu-font-mono);
}
.neu-gov-title[data-priority="critical"],
.neu-gov-title[data-priority="failed"],
.neu-gov-title[data-priority="high"] {
  color: var(--neu-error);
}
.neu-gov-title[data-priority="warning"],
.neu-gov-title[data-priority="superseded"] {
  color: var(--neu-warning);
}
.neu-gov-title[data-priority="accepted"],
.neu-gov-title[data-priority="validated"] {
  color: var(--neu-success);
}
.neu-gov-text {
  font-size: 13px;
  color: var(--neu-text);
}
.neu-gov-meta {
  font-size: 11px;
  color: var(--neu-muted);
}
.neu-gov-section-title {
  margin-top: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--neu-text);
}

/* ===== Workspace add panel ===== */
.neu-workspace-window {
  width: min(480px, 90vw);
  background: var(--neu-bg-light);
  border-radius: var(--neu-radius);
  box-shadow: 6px 6px 16px var(--neu-shadow-dark), -6px -6px 16px var(--neu-shadow-light);
  overflow: hidden;
}
.neu-workspace-body {
  padding: 14px 20px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ===== Workspace success ===== */
.neu-workspace-success {
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-success);
  font-size: 12px;
}

/* ===== Workspace error ===== */
.neu-workspace-error {
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-error);
  font-size: 12px;
}

/* ===== Smooth transitions ===== */
.neu-workspace-row,
.neu-tree-row,
.neu-secondary-tab,
.neu-pane .natalia-action-btn,
.neu-pane .natalia-composer-icon-btn,
.neu-pane .natalia-composer-submit,
.file-tree-item,
.review-file-row,
.review-icon-btn,
.browser-url-bar,
.neu-file-editor-tab {
  transition:
    box-shadow 0.25s ease,
    background-color 0.25s ease,
    color 0.25s ease,
    transform 0.25s ease;
}

@keyframes neu-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ===== Responsive ===== */
@media (max-width: 1200px) {
  .neu-shell { padding: 10px; gap: 10px; }
  .neu-app { gap: 10px; }
  .neu-pane { padding: 12px; }
  .neu-secondary { max-width: 380px; }
  .neu-sidebar { max-width: 240px; }
}
@media (max-width: 1700px) {
  .neu-shell[data-compact="true"] .neu-sidebar {
    width: min(320px, 32vw);
  }
  .neu-shell[data-compact="true"] .neu-secondary {
    width: min(720px, 66vw);
  }
  .neu-shell[data-compact="true"] .neu-resizer {
    display: none;
  }
  .neu-shell[data-compact="true"] .neu-main-panes {
    flex-direction: column;
  }
  .neu-shell[data-compact="true"] .neu-pane-divider {
    height: 8px;
    width: auto;
  }
  .neu-shell[data-compact="true"] .neu-pane {
    min-height: 220px;
  }
  .neu-main-panes { gap: 10px; }
}
@media (max-width: 1000px) {
  .neu-shell { padding: 6px; gap: 6px; }
  .neu-app { gap: 6px; }
  .neu-main-panes { gap: 6px; }
  .neu-pane-divider { height: 8px; width: auto; }
  .neu-pane { min-height: 220px; }
  .neu-shell[data-tiny="true"] .neu-main-panes { flex-direction: column; }
  .neu-secondary-tabs { flex-wrap: nowrap; overflow-x: auto; }
  .neu-secondary-tab { white-space: nowrap; flex-shrink: 0; }

  /* Tiny mode: right sidebar takes the whole content area when opened. */
  .neu-shell[data-tiny="true"][data-right-open="true"] .neu-main {
    display: none;
  }
  .neu-shell[data-tiny="true"][data-right-open="true"] .neu-secondary {
    flex: 1;
    width: auto !important;
    max-width: none;
    min-width: 0;
  }
  .neu-shell[data-tiny="true"][data-right-open="true"] .neu-right-resizer {
    display: none;
  }
}

.neu-edit-window {
  width: min(480px, 90vw);
}
.neu-edit-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  max-height: min(70vh, 720px);
  overflow-y: auto;
}}





.neu-tool-select-grid {
  display: flex;
  flex-direction: column;
  max-height: 360px;
  overflow-y: auto;
  padding: 6px;
}
.neu-tool-check {
  width: 100%;
  min-height: 40px;
  margin-bottom: 15px;
  padding: 8px 12px;
  font-size: 13px;
  gap: 10px;
  border-radius: 14px;
}
.neu-tool-check span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.neu-permission-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.neu-permission-row .neu-settings-item {
  flex: 1;
  min-width: 0;
}
.neu-permission-edit {
  flex-shrink: 0;
  padding: 8px 12px;
  border: none;
  border-radius: 10px;
  background: var(--neu-bg);
  color: var(--neu-accent);
  font-size: 12px;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
}
.neu-permission-edit:hover {
  box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light);
}

.neu-main-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--neu-hairline-accent);
}
.neu-main-toolbar .neu-select {
  flex: 1;
  min-width: 0;
}

.neu-select-menu-top {
  top: auto;
  bottom: calc(100% + 6px);
}

/* Question panel (unified with permission panel) */
.neu-question-item { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.neu-question-header { font-size: 14px; font-weight: 600; color: var(--neu-text); }
.neu-question-options { display: flex; flex-direction: column; gap: 8px; }
.neu-question-option-active { color: var(--neu-accent) !important; box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light) !important; }
.neu-question-option-description { display: block; font-size: 12px; color: var(--neu-muted); }
.neu-question-custom { width: 100%; box-sizing: border-box; padding: 10px 12px; border: none; border-radius: 12px; background: var(--neu-bg); color: var(--neu-text); font-family: inherit; font-size: 13px; box-shadow: inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light); outline: none; }

/* Live status pulse */
@keyframes neu-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}
.neu-pane-status[data-running="true"]::before {
  content: "";
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
  background: var(--neu-accent);
  animation: neu-pulse 1s infinite;
}

/* Activity bar above composer */
.neu-activity-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px 0;
  font-size: 12px;
  color: var(--neu-muted);
}
.neu-activity-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--neu-muted);
}
.neu-activity-bar[data-running="true"] .neu-activity-pulse {
  background: var(--neu-accent);
  animation: neu-pulse 1s infinite;
}

/* Jump-to-bottom floating button */
.neu-jump-bottom {
  position: absolute;
  right: 16px;
  bottom: 48px;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: var(--neu-bg);
  color: var(--neu-accent);
  font-size: 16px;
  cursor: pointer;
  box-shadow: 3px 3px 6px var(--neu-shadow-dark), -3px -3px 6px var(--neu-shadow-light);
  z-index: 2;
}
.neu-pane-content { position: relative; }

/* Markdown tables and blocks */
.natalia-message-text table { border-collapse: collapse; margin: 8px 0; width: 100%; }
.natalia-message-text th, .natalia-message-text td { border: 1px solid var(--neu-border); padding: 6px 8px; text-align: left; }
.natalia-message-text pre { background: var(--neu-bg); border-radius: 8px; padding: 10px; overflow-x: auto; }
.natalia-message-text code { background: var(--neu-bg); border-radius: 4px; padding: 1px 4px; }
.natalia-message-text pre code { background: transparent; padding: 0; }
.natalia-message-text ul, .natalia-message-text ol { padding-left: 20px; }
.natalia-message-text blockquote { margin: 8px 0; padding: 4px 12px; border-left: 3px solid var(--neu-accent); color: var(--neu-muted); }
.natalia-message-text a { color: var(--neu-accent); }

.review-file {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--neu-bg-light);
  margin-bottom: 4px;
  font-size: 12px;
}
.review-file[data-operation="added"] { border-left: 3px solid var(--neu-success); }
.review-file[data-operation="modified"] { border-left: 3px solid var(--neu-warning); }
.review-file[data-operation="deleted"] { border-left: 3px solid var(--neu-danger); }
.review-file[data-operation="renamed"] { border-left: 3px solid var(--neu-accent); }
.review-file-name { font-weight: 600; color: var(--neu-text); word-break: break-all; }
.review-file-meta { display: flex; gap: 8px; font-size: 10px; color: var(--neu-muted); }
.review-file-op { font-weight: 600; text-transform: uppercase; }
.review-section-title { font-size: 12px; font-weight: 600; color: var(--neu-muted); margin: 10px 0 4px; }

.review-drift-card {
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--neu-bg-light);
  margin-bottom: 6px;
  font-size: 12px;
}
.review-drift-card[data-severity="high"] { border-left: 3px solid var(--neu-danger); }
.review-drift-card[data-severity="warning"] { border-left: 3px solid var(--neu-warning); }
.review-drift-card[data-severity="advisory"] { border-left: 3px solid var(--neu-accent); }
.review-drift-header { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 11px; color: var(--neu-muted); }
.review-severity, .review-drift-status { text-transform: uppercase; font-weight: 600; }
.review-drift-activity { color: var(--neu-text); font-weight: 500; margin-bottom: 6px; word-break: break-word; max-height: 72px; overflow: hidden; }
.review-drift-evidence { margin: 0; padding-left: 18px; color: var(--neu-muted); font-size: 11px; }
.review-drift-evidence li { margin-bottom: 2px; word-break: break-word; }
`;
