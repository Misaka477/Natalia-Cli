export const nataliaWebUiStyles = `
:root {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  text-rendering: auto;
  color-scheme: dark;
  --surface-0: oklch(0.145 0 0);
  --surface-1: oklch(0.168 0 0);
  --surface-2: oklch(0.195 0 0);
  --surface-3: oklch(0.235 0 0);
  --surface-4: oklch(0.274 0 0);
  --surface-hover: oklch(0.215 0 0);
  --surface-active: oklch(0.305 0 0);
  --accent-primary: #7a9dcc;
  --accent-hover: #9bb8e0;
  --accent-muted: #4a8caa;
  --accent-success: #78ebbe;
  --accent-warning: #ffaf55;
  --accent-error: #ff6e6e;
  --text-primary: #e6e7ea;
  --text-secondary: #c8c8c8;
  --text-tertiary: #a3a3a3;
  --text-dim: #737373;
  --border-subtle: oklch(1 0 0 / 10%);
  --border-emphasis: oklch(1 0 0 / 18%);
  --border-strong: oklch(0.32 0 0);
  --status-running: var(--accent-success);
  --status-idle: var(--text-tertiary);
  --status-error: var(--accent-error);
  --status-warning: var(--accent-warning);
  --font-family-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  --font-family-mono: "SF Mono", "SFMono-Regular", Menlo, Monaco, monospace;
  --font-size-xs: 11px;
  --font-size-sm: 12px;
  --font-size-base: 13px;
  --font-size-md: 14px;
  --font-size-lg: 16px;
  --font-size-xl: 18px;
  --line-height-tight: 1.2;
  --line-height-snug: 1.4;
  --line-height-normal: 1.6;
  --line-height-relaxed: 1.75;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-8: 48px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;
  --radius-pill: 999px;
  --shadow-soft: 0 4px 20px rgba(0, 0, 0, 0.25);
  --transition-fast: 120ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--font-family-sans);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  color: var(--text-primary);
  background: var(--surface-0);
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
}

/* ===== App Layout ===== */
.natalia-app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: var(--surface-1);
}

.natalia-app-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.sidebar-resizer,
.right-panel-resizer {
  width: 4px;
  flex-shrink: 0;
  cursor: col-resize;
  background: transparent;
  transition: background var(--transition-fast);
}

.sidebar-resizer:hover,
.sidebar-resizer.is-dragging,
.right-panel-resizer:hover,
.right-panel-resizer.is-dragging {
  background: var(--border-emphasis);
}

/* ===== TopNav ===== */
.topnav {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-3);
  background: var(--surface-0);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  gap: var(--space-3);
}
.topnav-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}
.topnav-breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  overflow: hidden;
}
.topnav-breadcrumb-segment {
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.topnav-breadcrumb-active {
  color: var(--text-secondary);
  font-weight: 500;
}
.topnav-right {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.topnav-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
}
.topnav-icon-btn:hover { background: var(--surface-2); color: var(--text-primary); }
.topnav-action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}
.topnav-action-btn:hover { background: var(--surface-3); border-color: var(--border-emphasis); }
.topnav-divider {
  width: 1px;
  height: 20px;
  background: var(--border-subtle);
  margin: 0 var(--space-1);
}
.topnav-notification-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 6px;
  height: 6px;
  background: var(--accent-primary);
  border-radius: 50%;
}

/* ===== Sidebar ===== */
.natalia-sidebar {
  width: 250px;
  display: flex;
  flex-direction: column;
  background: var(--surface-1);
  border-right: 1px solid var(--border-subtle);
  flex-shrink: 0;
  overflow: hidden;
}
.natalia-sidebar-header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}
.natalia-sidebar-brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.natalia-sidebar-brand-mark {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-success));
  flex-shrink: 0;
}
.natalia-sidebar-brand-text { display: flex; flex-direction: column; gap: 1px; }
.natalia-sidebar-brand-name {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--text-primary);
  line-height: var(--line-height-tight);
}
.natalia-sidebar-brand-subtitle {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}
.natalia-sidebar-new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin: var(--space-3) var(--space-3) var(--space-1);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--accent-primary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  width: calc(100% - var(--space-6));
}
.natalia-sidebar-new-btn:hover { background: var(--surface-2); }
.natalia-sidebar-section {
  padding: var(--space-2) var(--space-3);
}
.natalia-sidebar-section-title {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: var(--space-1) var(--space-2);
  margin-bottom: var(--space-1);
}
.natalia-sidebar-section-grow {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
.natalia-sidebar-recent { display: flex; flex-direction: column; gap: 1px; }
.natalia-sidebar-session {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-fast);
  width: 100%;
}
.natalia-sidebar-session:hover { background: var(--surface-2); color: var(--text-primary); }
.natalia-sidebar-session[data-active="true"] { background: var(--surface-3); color: var(--text-primary); }
.natalia-session-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
  color: var(--text-dim);
}
.natalia-sidebar-session[data-state="running"] .natalia-session-dot { color: var(--accent-success); animation: natalia-pulse 2s ease-in-out infinite; }
.natalia-sidebar-session[data-state="error"] .natalia-session-dot { color: var(--status-error); }
.natalia-session-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.natalia-session-badge {
  font-size: var(--font-size-xs);
  padding: 1px 6px;
  background: var(--surface-4);
  border-radius: var(--radius-sm);
  color: var(--text-dim);
  white-space: nowrap;
}
.natalia-sidebar-tree { display: flex; flex-direction: column; gap: 2px; }
.natalia-workspace { display: flex; flex-direction: column; }
.natalia-workspace-header {
  display: grid;
  grid-template-columns: 16px 16px 1fr;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-2);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.natalia-workspace-header:hover { background: var(--surface-2); color: var(--text-primary); }
.natalia-workspace-chevron {
  width: 14px; height: 14px; color: var(--text-dim);
  transition: transform var(--transition-fast);
}
.natalia-workspace-chevron[data-expanded="true"] { transform: rotate(90deg); }
.natalia-workspace-icon { width: 14px; height: 14px; color: var(--accent-primary); }
.natalia-workspace-name { font-weight: 500; min-width: 0; }
.natalia-sessions {
  display: flex; flex-direction: column; gap: 1px;
  margin: 1px 0 var(--space-2) var(--space-4);
  padding-left: var(--space-2);
  border-left: 1px solid var(--border-subtle);
}
.natalia-session-btn {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-2);
  background: transparent; border: none; border-radius: var(--radius-md);
  color: var(--text-secondary); font-family: inherit; font-size: var(--font-size-sm);
  text-align: left; cursor: pointer; transition: all var(--transition-fast);
  width: 100%;
}
.natalia-session-btn:hover { background: var(--surface-2); color: var(--text-primary); }
.natalia-session-btn[data-active="true"] { background: var(--surface-3); color: var(--text-primary); }
.natalia-sidebar-footer {
  display: flex; flex-direction: column; gap: var(--space-1);
  padding: var(--space-2) var(--space-3);
  border-top: 1px solid var(--border-subtle);
}
.natalia-sidebar-footer-btn {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: transparent; border: none; border-radius: var(--radius-md);
  color: var(--text-secondary); font-family: inherit; font-size: var(--font-size-sm);
  cursor: pointer; transition: all var(--transition-fast); width: 100%;
}
.natalia-sidebar-footer-btn:hover { background: var(--surface-2); color: var(--text-primary); }

/* ===== Main / Chat Panels ===== */
.natalia-main-panel {
  display: flex; flex-direction: column; min-width: 0; flex: 1;
  border-right: 1px solid var(--border-subtle);
}
.natalia-chat-panel {
  display: flex; flex-direction: column; min-width: 0; width: 380px;
  border-right: 1px solid var(--border-subtle);
}
.natalia-chat-header,
.natalia-chat-panel-header {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-1);
  flex-shrink: 0;
}
.natalia-chat-header-actions { margin-left: auto; }
.natalia-panel-title {
  font-size: var(--font-size-lg);
  font-weight: 500;
  line-height: var(--line-height-snug);
  color: var(--text-primary);
}
.natalia-chat-scroll {
  flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;
  background: var(--surface-1);
}

/* ===== Badge ===== */
.natalia-badge {
  display: inline-flex; align-items: center; gap: var(--space-1);
  padding: 2px 8px; border-radius: var(--radius-pill);
  font-size: var(--font-size-xs); font-weight: 500; line-height: 1.5;
  white-space: nowrap;
}
.natalia-badge-default { background: var(--surface-3); color: var(--text-secondary); }
.natalia-badge-running { background: hsla(152, 76%, 66%, 0.12); color: var(--accent-success); animation: natalia-pulse 2s ease-in-out infinite; }
.natalia-badge-success { background: hsla(152, 76%, 66%, 0.12); color: var(--accent-success); }
.natalia-badge-error { background: hsla(0, 76%, 62%, 0.12); color: var(--status-error); }
.natalia-badge-warning { background: hsla(40, 80%, 60%, 0.12); color: var(--status-warning); }

@keyframes natalia-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

/* ===== Transcript & Messages ===== */
.natalia-transcript {
  display: flex; flex-direction: column; gap: var(--space-4);
  padding: var(--space-5) var(--space-4); max-width: 800px; margin: 0 auto; width: 100%;
}
.natalia-transcript-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: var(--space-3); min-height: 300px; padding: var(--space-8); text-align: center;
  color: var(--text-tertiary);
}
.natalia-transcript-empty-icon { color: var(--text-dim); opacity: 0.5; }
.natalia-transcript-empty-title {
  font-size: var(--font-size-lg); font-weight: 500; color: var(--text-secondary);
}
.natalia-transcript-empty-hint {
  max-width: 320px; font-size: var(--font-size-sm); color: var(--text-tertiary); line-height: var(--line-height-relaxed);
}

.natalia-message {
  display: flex; flex-direction: column; gap: var(--space-2);
}
.natalia-message-header {
  display: flex; align-items: center; gap: var(--space-2);
}
.natalia-message-avatar {
  width: 28px; height: 28px; border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center;
  font-size: var(--font-size-xs); font-weight: 600; flex-shrink: 0;
}
.natalia-message-avatar[data-role="user"] { background: hsla(195, 60%, 35%, 0.2); color: var(--accent-primary); }
.natalia-message-avatar[data-role="assistant"] { background: hsla(152, 40%, 35%, 0.2); color: var(--accent-success); }
.natalia-message-avatar[data-role="system"] { background: var(--surface-3); color: var(--text-tertiary); }
.natalia-message-meta { display: flex; align-items: center; gap: var(--space-2); }
.natalia-message-author { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-primary); }
.natalia-message-time { font-size: var(--font-size-xs); color: var(--text-dim); }
.natalia-message-body { line-height: var(--line-height-relaxed); }

.natalia-message[data-role="user"] .natalia-message-text {
  padding: var(--space-3) var(--space-4);
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  border-top-left-radius: var(--radius-sm);
}
.natalia-message[data-role="user"] .natalia-message-text:hover {
  background: var(--surface-3);
  border-color: var(--border-emphasis);
}

.natalia-streaming-indicator {
  display: flex; align-items: center; gap: var(--space-2);
  color: var(--text-dim); padding: var(--space-2) 0;
}
.natalia-streaming-dot {
  width: 4px; height: 4px; border-radius: 50%;
  background: var(--accent-primary);
  animation: natalia-blink 1.4s infinite;
}
.natalia-streaming-dot:nth-child(2) { animation-delay: 0.2s; }
.natalia-streaming-dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes natalia-blink { 0%,60%,100% { opacity: 0.2; } 30% { opacity: 1; } }

/* ===== Message Actions ===== */
.natalia-message-actions {
  display: flex; gap: var(--space-2); margin-top: var(--space-2);
}
.natalia-action-btn {
  display: inline-flex; align-items: center; gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: transparent; border: none; border-radius: var(--radius-md);
  color: var(--accent-primary); font-family: inherit;
  font-size: var(--font-size-xs); font-weight: 500;
  cursor: pointer; transition: all var(--transition-fast);
}
.natalia-action-btn:hover { background: var(--surface-2); }
.natalia-action-btn-primary {
  background: var(--surface-2); border: 1px solid var(--border-subtle); color: var(--text-primary);
}
.natalia-action-btn-primary:hover { background: var(--surface-3); }

/* ===== Tool Cards ===== */
.natalia-tool-calls { display: flex; flex-direction: column; gap: var(--space-2); margin-top: var(--space-2); }
.natalia-tool-card {
  padding: var(--space-3);
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  display: flex; flex-direction: column; gap: var(--space-2);
}
.natalia-tool-header {
  display: flex; align-items: center; gap: var(--space-2);
}
.natalia-tool-name {
  font-size: var(--font-size-sm); font-weight: 500; color: var(--text-primary);
}
.natalia-tool-output {
  padding: var(--space-2);
  background: var(--surface-0);
  border-radius: var(--radius-sm);
  overflow-x: auto;
}
.natalia-tool-output pre {
  margin: 0; font-family: var(--font-family-mono);
  font-size: var(--font-size-xs); color: var(--text-secondary);
  white-space: pre-wrap; word-break: break-all;
}

/* ===== Code Blocks ===== */
.natalia-code-blocks p { margin: 0 0 var(--space-3) 0; }
.natalia-code-blocks p:last-child { margin-bottom: 0; }
.natalia-code-block {
  margin: var(--space-3) 0;
  background: var(--surface-0);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.natalia-code-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-1) var(--space-3);
  background: var(--surface-2);
  border-bottom: 1px solid var(--border-subtle);
}
.natalia-code-header span {
  font-size: var(--font-size-xs); color: var(--text-dim);
  font-family: var(--font-family-mono); text-transform: uppercase;
}
.natalia-code-copy {
  background: transparent; border: none; color: var(--text-tertiary);
  font-family: var(--font-family-mono); font-size: var(--font-size-xs);
  cursor: pointer; padding: 2px 8px; border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}
.natalia-code-copy:hover { background: var(--surface-3); color: var(--text-primary); }
.natalia-code-block pre {
  margin: 0; padding: var(--space-3) var(--space-4);
  overflow-x: auto;
  font-family: var(--font-family-mono);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  line-height: var(--line-height-normal);
}
.natalia-code-block code { padding: 0; background: transparent; }

/* ===== Composer ===== */
.natalia-composer {
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-1);
  padding: var(--space-3) var(--space-4) var(--space-4);
}
.natalia-composer-attachments {
  display: flex; flex-wrap: wrap; gap: var(--space-2);
  margin-bottom: var(--space-2);
}
.natalia-attachment-chip {
  display: inline-flex; align-items: center; gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs); color: var(--text-secondary);
}
.natalia-attachment-icon { width: 12px; height: 12px; color: var(--accent-primary); }
.natalia-attachment-name { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.natalia-attachment-remove {
  display: flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; padding: 0; background: transparent;
  border: none; color: var(--text-dim); border-radius: 50%;
  cursor: pointer; transition: all var(--transition-fast);
}
.natalia-attachment-remove:hover { background: var(--surface-3); color: var(--text-primary); }

.natalia-composer-textarea {
  width: 100%; min-height: 24px; max-height: 200px;
  padding: 0; background: transparent; border: none; outline: none; resize: none;
  color: var(--text-primary); font-family: inherit;
  font-size: var(--font-size-base); line-height: var(--line-height-relaxed);
}
.natalia-composer-textarea::placeholder { color: var(--text-dim); }

.natalia-composer-toolbar {
  display: flex; align-items: center; gap: var(--space-3);
  padding-top: var(--space-2); margin-top: var(--space-1);
  border-top: 1px solid var(--border-subtle) transparent;
}
.natalia-composer-controls {
  display: flex; align-items: center; gap: var(--space-2); flex: 1;
}
.natalia-composer-actions {
  display: flex; align-items: center; gap: var(--space-2); margin-left: auto;
}
.natalia-composer-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; padding: 0; background: transparent;
  border: none; border-radius: var(--radius-md); color: var(--text-secondary);
  cursor: pointer; transition: all var(--transition-fast);
}
.natalia-composer-icon-btn:hover:not(:disabled) { background: var(--surface-2); color: var(--text-primary); }
.natalia-composer-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.natalia-composer-submit {
  width: 32px; height: 32px; padding: 0;
  background: var(--accent-primary); color: var(--surface-0);
  border: none; border-radius: var(--radius-md);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all var(--transition-fast);
}
.natalia-composer-submit:hover:not(:disabled) { background: var(--accent-hover); transform: scale(1.05); }
.natalia-composer-submit:disabled { opacity: 0.4; cursor: not-allowed; }
.natalia-composer-submit[data-busy="true"] { background: var(--status-error); }
.natalia-composer-submit[data-busy="true"]:hover { background: hsl(0, 76%, 58%); }

.natalia-select {
  padding: var(--space-1) var(--space-3); padding-right: var(--space-6);
  background: var(--surface-2);
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23868B95' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right var(--space-3) center;
  border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
  color: var(--text-primary); font-family: inherit; font-size: var(--font-size-xs);
  cursor: pointer; transition: all var(--transition-fast);
}
.natalia-select:hover { background-color: var(--surface-3); border-color: var(--border-emphasis); }
.natalia-select:focus { outline: none; border-color: var(--accent-primary); }

.natalia-toggle {
  display: inline-flex; align-items: center; gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  background: transparent; border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill); color: var(--text-secondary);
  font-family: inherit; font-size: var(--font-size-xs);
  cursor: pointer; transition: all var(--transition-fast); user-select: none;
}
.natalia-toggle:hover { background: var(--surface-1); border-color: var(--border-emphasis); }
.natalia-toggle input[type="checkbox"] { width: 13px; height: 13px; cursor: pointer; accent-color: var(--accent-primary); }

/* ===== Right Panel ===== */
.right-panel {
  width: 400px; display: flex; flex-direction: column;
  background: var(--surface-1); flex-shrink: 0; overflow: hidden;
}
.right-panel-tabs {
  display: flex; gap: 0;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  background: var(--surface-0);
}
.right-panel-tab {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: transparent; border: none; border-bottom: 2px solid transparent;
  color: var(--text-dim); font-family: inherit; font-size: var(--font-size-xs);
  cursor: pointer; transition: all var(--transition-fast);
  white-space: nowrap;
}
.right-panel-tab:hover { color: var(--text-secondary); background: var(--surface-1); }
.right-panel-tab[data-active="true"] {
  color: var(--accent-primary); border-bottom-color: var(--accent-primary);
  background: var(--surface-1);
}
.right-panel-tab-icon { font-size: 12px; }

/* Review Tab - GitHub-inspired */
.gh-review { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.gh-review-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-1); flex-shrink: 0;
}
.gh-review-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 600; color: var(--text-primary);
}
.gh-review-title svg { color: var(--accent-primary); }
.gh-review-meta { display: flex; align-items: center; gap: 8px; font-size: 11px; }
.gh-review-count { color: var(--text-secondary); }
.gh-additions { color: #3fb950; font-weight: 500; }
.gh-deletions { color: #f85149; font-weight: 500; }
.gh-review-body { display: flex; flex: 1; min-height: 0; overflow: hidden; }
.gh-review-files {
  width: 240px; flex-shrink: 0; border-right: 1px solid var(--border-subtle);
  overflow-y: auto; background: var(--surface-1);
}
.gh-review-files-heading {
  padding: 10px 12px; font-size: 11px; font-weight: 600;
  color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em;
  position: sticky; top: 0; background: var(--surface-1); border-bottom: 1px solid var(--border-subtle);
}
.gh-file-row {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 8px 12px;
  background: transparent; border: none; border-bottom: 1px solid transparent;
  color: var(--text-secondary); font-family: var(--font-family-mono);
  font-size: 11px; text-align: left; cursor: pointer;
  transition: background var(--transition-fast);
}
.gh-file-row:hover { background: var(--surface-hover); }
.gh-file-row[data-active="true"] {
  background: var(--surface-active); color: var(--text-primary);
  border-bottom-color: var(--accent-primary);
}
.gh-file-status {
  width: 16px; font-size: 9px; font-weight: 700; text-align: center;
}
.gh-file-status.is-added { color: #3fb950; }
.gh-file-status.is-modified { color: #d29922; }
.gh-file-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gh-file-stats { display: flex; gap: 6px; font-size: 10px; }
.gh-diff { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.gh-diff-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 14px; border-bottom: 1px solid var(--border-subtle);
  font-family: var(--font-family-mono); font-size: 11px; color: var(--text-secondary);
  flex-shrink: 0; background: var(--surface-1);
}
.gh-diff-path { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gh-diff-actions { display: flex; gap: 2px; }
.gh-icon-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; background: transparent; border: none;
  color: var(--text-tertiary); cursor: pointer; border-radius: 6px;
  transition: all var(--transition-fast);
}
.gh-icon-btn:hover { background: var(--surface-2); color: var(--text-primary); }
.gh-diff-content { flex: 1; overflow-y: auto; font-family: var(--font-family-mono); font-size: 11px; line-height: 1.65; }
.gh-diff-line { display: flex; min-width: 0; }
.gh-diff-pos {
  width: 32px; flex-shrink: 0; text-align: right; padding-right: 8px; user-select: none;
  color: var(--text-dim); background: transparent;
}
.gh-diff-sign { width: 18px; flex-shrink: 0; text-align: center; user-select: none; }
.gh-diff-text { flex: 1; white-space: pre; padding-right: 12px; }
.gh-diff-line.is-removed { background: rgba(248, 81, 73, 0.08); }
.gh-diff-line.is-removed .gh-diff-sign { color: #f85149; }
.gh-diff-line.is-added { background: rgba(63, 185, 80, 0.08); }
.gh-diff-line.is-added .gh-diff-sign { color: #3fb950; }
.gh-diff-footer {
  display: flex; justify-content: flex-end; padding: 10px 14px;
  border-top: 1px solid var(--border-subtle); flex-shrink: 0;
}
.gh-commit-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px; background: #238636; color: #fff;
  border: none; border-radius: 6px; font-family: inherit; font-size: 12px; font-weight: 500;
  cursor: pointer; transition: background var(--transition-fast);
}
.gh-commit-btn:hover { background: #2ea043; }

/* Terminal Tab */
.terminal-pane { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.terminal-output {
  flex: 1; overflow-y: auto; padding: var(--space-3);
  font-family: var(--font-family-mono); font-size: var(--font-size-xs);
  line-height: 1.6; background: var(--surface-0);
}
.terminal-line { color: var(--text-secondary); white-space: pre-wrap; word-break: break-all; }
.terminal-line-terminal { color: var(--text-primary); }
.terminal-line-success { color: var(--accent-success); }
.terminal-line-header { color: var(--text-dim); font-weight: 500; }
.terminal-input-line {
  display: flex; align-items: center; color: var(--text-secondary);
  font-family: var(--font-family-mono); font-size: var(--font-size-xs);
}
.terminal-prompt { color: var(--accent-success); }
.terminal-cursor {
  width: 7px; height: 14px; background: var(--text-tertiary);
  animation: natalia-blink 1s step-end infinite; margin-left: 2px;
}

/* Browser Tab */
.browser-pane { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.browser-toolbar {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.browser-url-bar {
  flex: 1; display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  min-width: 0;
}
.browser-url-text {
  font-size: var(--font-size-xs); color: var(--text-dim);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.browser-empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: var(--space-3);
  color: var(--text-dim);
}
.browser-empty-icon { opacity: 0.4; }
.browser-empty-text {
  font-size: var(--font-size-sm); color: var(--text-secondary);
}

/* File Tree Pane */
.file-pane { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.file-pane-header {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.file-pane-title {
  font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary);
}
.file-tree { flex: 1; overflow-y: auto; padding: var(--space-2); }
.file-tree-item {
  display: flex; align-items: center; gap: var(--space-1);
  padding: 2px var(--space-2); width: 100%;
  background: transparent; border: none; border-radius: var(--radius-sm);
  color: var(--text-secondary); font-family: var(--font-family-mono);
  font-size: var(--font-size-xs); text-align: left; cursor: pointer;
  transition: all var(--transition-fast); min-width: 0;
}
.file-tree-item:hover { background: var(--surface-2); }
.file-tree-chevron { width: 12px; height: 12px; transition: transform var(--transition-fast); flex-shrink: 0; color: var(--text-dim); }
.file-tree-chevron[data-expanded="true"] { transform: rotate(90deg); }
.file-tree-icon { width: 14px; height: 14px; flex-shrink: 0; color: var(--text-dim); }
.file-tree-file-icon { color: var(--text-tertiary); }
.file-tree-file { color: var(--text-secondary); }
.file-tree-file:hover { background: var(--surface-2); }
.file-tree-name {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.file-tree-status {
  font-size: 9px; font-weight: 700; width: 12px; text-align: center; flex-shrink: 0;
}
.status-modified { color: var(--accent-primary); }
.status-added { color: var(--accent-success); }
.status-deleted { color: var(--status-error); }

/* ===== Responsive ===== */
@media (max-width: 1400px) {
  .natalia-chat-panel { width: 320px; }
  .right-panel { width: 340px; }
}
@media (max-width: 1100px) {
  .natalia-chat-panel { display: none; }
  .right-panel { width: 320px; }
}
@media (max-width: 800px) {
  .natalia-sidebar { display: none; }
  .right-panel { width: 100%; }
}

/* ===== Scrollbars ===== */
.natalia-chat-scroll::-webkit-scrollbar,
.review-file-list::-webkit-scrollbar,
.review-diff-content::-webkit-scrollbar,
.terminal-output::-webkit-scrollbar,
.file-tree::-webkit-scrollbar,
.natalia-sidebar-section-grow::-webkit-scrollbar {
  width: 6px;
}
.natalia-chat-scroll::-webkit-scrollbar-track,
.review-file-list::-webkit-scrollbar-track,
.review-diff-content::-webkit-scrollbar-track,
.terminal-output::-webkit-scrollbar-track,
.file-tree::-webkit-scrollbar-track,
.natalia-sidebar-section-grow::-webkit-scrollbar-track {
  background: transparent;
}
.natalia-chat-scroll::-webkit-scrollbar-thumb,
.review-file-list::-webkit-scrollbar-thumb,
.review-diff-content::-webkit-scrollbar-thumb,
.terminal-output::-webkit-scrollbar-thumb,
.file-tree::-webkit-scrollbar-thumb,
.natalia-sidebar-section-grow::-webkit-scrollbar-thumb {
  background: var(--surface-3); border-radius: var(--radius-pill);
}
.natalia-chat-scroll::-webkit-scrollbar-thumb:hover,
.review-file-list::-webkit-scrollbar-thumb:hover,
.review-diff-content::-webkit-scrollbar-thumb:hover,
.terminal-output::-webkit-scrollbar-thumb:hover,
.file-tree::-webkit-scrollbar-thumb:hover,
.natalia-sidebar-section-grow::-webkit-scrollbar-thumb:hover {
  background: var(--surface-4);
}

`;
