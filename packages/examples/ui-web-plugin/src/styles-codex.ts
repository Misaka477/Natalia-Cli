/**
 * Natalia Web UI - Codex Style
 * All combined styles for Codex-inspired design
 */

export const nataliaCodexStyles = `
/**
 * Natalia Design System - Codex Style
 * Inspired by Anthropic Codex - centered conversation flow, card-based messages
 */

:root {
  /* Surface colors - Codex-inspired deep grays */
  --surface-0: #0D0E11;      /* Deepest background */
  --surface-1: #16181D;      /* Main background */
  --surface-2: #1E2127;      /* Raised surface */
  --surface-3: #282C34;      /* Card background */
  --surface-4: #31363F;      /* Hover state */
  
  /* User message - light card */
  --user-bubble: #2A2E36;
  --user-bubble-hover: #32373F;
  
  /* Accent colors - softer blue/purple */
  --accent-primary: #5B8DEE;     /* Soft blue */
  --accent-hover: #6B9DF5;
  --accent-muted: #4A7BD9;
  
  --accent-secondary: #9B87F5;   /* Soft purple */
  
  /* Success/status colors */
  --accent-success: #50D890;
  --accent-warning: #F7B731;
  --accent-error: #EE5A6F;
  
  /* Text colors */
  --text-primary: #E8EAED;       /* Main text */
  --text-secondary: #B4B8BF;     /* Secondary text */
  --text-tertiary: #868B95;      /* Tertiary text */
  --text-dim: #5A5F6B;           /* Dim text */
  
  /* Border colors */
  --border-subtle: #2A2E36;
  --border-emphasis: #3A3F49;
  
  /* Status colors */
  --status-running: var(--accent-success);
  --status-idle: var(--text-tertiary);
  --status-error: var(--accent-error);
  
  /* Typography - Codex-like */
  --font-family-sans: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
  --font-family-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
  
  --font-size-xs: 0.75rem;       /* 12px */
  --font-size-sm: 0.875rem;      /* 14px */
  --font-size-base: 0.9375rem;   /* 15px */
  --font-size-md: 1rem;          /* 16px */
  --font-size-lg: 1.125rem;      /* 18px */
  --font-size-xl: 1.5rem;        /* 24px */
  
  --line-height-tight: 1.25;
  --line-height-snug: 1.4;
  --line-height-normal: 1.6;
  --line-height-relaxed: 1.75;
  
  /* Spacing - 8px base */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.5rem;    /* 24px */
  --space-6: 2rem;      /* 32px */
  --space-8: 3rem;      /* 48px */
  --space-10: 4rem;     /* 64px */
  --space-12: 6rem;     /* 96px */
  
  /* Radii - larger, more rounded */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-pill: 999px;
  
  /* Shadows - softer */
  --shadow-subtle: 0 1px 3px rgba(0, 0, 0, 0.3);
  --shadow-soft: 0 2px 8px rgba(0, 0, 0, 0.4);
  --shadow-medium: 0 4px 16px rgba(0, 0, 0, 0.5);
  --shadow-strong: 0 8px 32px rgba(0, 0, 0, 0.6);
  
  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 250ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 350ms cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Layout dimensions */
  --sidebar-width: 280px;
  --sidebar-collapsed: 60px;
  --conversation-max-width: 800px;
  --input-max-width: 720px;
}

/* Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family-sans);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  color: var(--text-primary);
  background: var(--surface-1);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Codex-style centered layout */
.codex-layout {
  display: grid;
  grid-template-columns: var(--sidebar-width) 1fr;
  grid-template-rows: auto 1fr;
  height: 100vh;
  overflow: hidden;
  background: var(--surface-1);
}

.codex-layout[data-sidebar-collapsed="true"] {
  grid-template-columns: var(--sidebar-collapsed) 1fr;
}

/* Top navigation bar */
.codex-topbar {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--surface-0);
  border-bottom: 1px solid var(--border-subtle);
  z-index: 10;
}

/* Sidebar */
.codex-sidebar {
  display: flex;
  flex-direction: column;
  background: var(--surface-0);
  border-right: 1px solid var(--border-subtle);
  overflow: hidden;
}

/* Main conversation area */
.codex-main {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* Centered conversation thread */
.codex-thread {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-6) var(--space-4) var(--space-12);
}

.codex-thread-inner {
  width: 100%;
  max-width: var(--conversation-max-width);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* Message blocks - Codex style */
.codex-message {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  animation: codex-message-appear 0.3s ease-out;
}

@keyframes codex-message-appear {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.codex-message-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 var(--space-2);
}

.codex-message-avatar {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: 600;
  flex-shrink: 0;
}

.codex-message-author {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-primary);
}

.codex-message-timestamp {
  font-size: var(--font-size-xs);
  color: var(--text-dim);
  margin-left: auto;
}

/* User message - light card */
.codex-message[data-role="user"] .codex-message-content {
  background: var(--user-bubble);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  padding: var(--space-4) var(--space-5);
  transition: all var(--transition-fast);
}

.codex-message[data-role="user"] .codex-message-content:hover {
  background: var(--user-bubble-hover);
  border-color: var(--border-emphasis);
}

.codex-message[data-role="user"] .codex-message-avatar {
  background: var(--accent-primary);
  color: white;
}

/* Assistant message - no background */
.codex-message[data-role="assistant"] .codex-message-content {
  padding: var(--space-2);
  color: var(--text-primary);
}

.codex-message[data-role="assistant"] .codex-message-avatar {
  background: var(--surface-3);
  color: var(--accent-secondary);
}

/* Message content styling */
.codex-message-content p {
  margin: 0 0 var(--space-3) 0;
  line-height: var(--line-height-relaxed);
}

.codex-message-content p:last-child {
  margin-bottom: 0;
}

.codex-message-content code {
  padding: 2px 6px;
  background: var(--surface-3);
  border-radius: var(--radius-sm);
  font-family: var(--font-family-mono);
  font-size: 0.9em;
  color: var(--accent-primary);
}

.codex-message-content pre {
  margin: var(--space-3) 0;
  padding: var(--space-4);
  background: var(--surface-0);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow-x: auto;
}

.codex-message-content pre code {
  padding: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

/* Input area - fixed bottom */
.codex-input-container {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: center;
  padding: var(--space-4);
  background: linear-gradient(to top, var(--surface-1) 80%, transparent);
  pointer-events: none;
}

.codex-input-wrapper {
  width: 100%;
  max-width: var(--input-max-width);
  pointer-events: auto;
}

.codex-input {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-2xl);
  padding: var(--space-4);
  transition: all var(--transition-fast);
  box-shadow: var(--shadow-medium);
}

.codex-input:focus-within {
  background: var(--surface-3);
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 4px rgba(91, 141, 238, 0.15), var(--shadow-medium);
}

.codex-input textarea {
  width: 100%;
  min-height: 24px;
  max-height: 200px;
  padding: 0;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-size-base);
  line-height: var(--line-height-relaxed);
}

.codex-input textarea::placeholder {
  color: var(--text-dim);
}

.codex-input-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--border-subtle);
}

/* Scrollbar */
.codex-thread::-webkit-scrollbar {
  width: 8px;
}

.codex-thread::-webkit-scrollbar-track {
  background: transparent;
}

.codex-thread::-webkit-scrollbar-thumb {
  background: var(--surface-3);
  border-radius: var(--radius-pill);
}

.codex-thread::-webkit-scrollbar-thumb:hover {
  background: var(--surface-4);
}

/* Responsive */
@media (max-width: 1024px) {
  :root {
    --conversation-max-width: 100%;
  }
  
  .codex-layout {
    grid-template-columns: 1fr;
  }
  
  .codex-sidebar {
    display: none;
  }
}
/**
 * Codex-style Components - Buttons, Badges, Icons
 */

/* Button styles - Codex inspired */
.codex-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-lg);
  font-family: inherit;
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  user-select: none;
}

.codex-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.codex-button-primary {
  background: var(--accent-primary);
  color: white;
}

.codex-button-primary:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(91, 141, 238, 0.3);
}

.codex-button-secondary {
  background: var(--surface-3);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
}

.codex-button-secondary:hover:not(:disabled) {
  background: var(--surface-4);
  border-color: var(--border-emphasis);
}

.codex-button-ghost {
  background: transparent;
  color: var(--text-secondary);
}

.codex-button-ghost:hover:not(:disabled) {
  background: var(--surface-2);
  color: var(--text-primary);
}

.codex-button-icon {
  width: 36px;
  height: 36px;
  padding: 0;
  border-radius: var(--radius-md);
}

.codex-button-sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-xs);
}

/* Badge styles */
.codex-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-weight: 500;
  line-height: 1;
}

.codex-badge-default {
  background: var(--surface-3);
  color: var(--text-secondary);
}

.codex-badge-success {
  background: rgba(80, 216, 144, 0.15);
  color: var(--accent-success);
}

.codex-badge-running {
  background: rgba(80, 216, 144, 0.15);
  color: var(--accent-success);
  animation: codex-pulse 2s ease-in-out infinite;
}

@keyframes codex-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.codex-badge-idle {
  background: var(--surface-3);
  color: var(--text-tertiary);
}

.codex-badge-error {
  background: rgba(238, 90, 111, 0.15);
  color: var(--accent-error);
}

/* Dot indicator */
.codex-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

/* Avatar */
.codex-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: var(--surface-3);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  font-weight: 600;
  user-select: none;
  flex-shrink: 0;
}

.codex-avatar-sm {
  width: 24px;
  height: 24px;
  font-size: 10px;
}

.codex-avatar-lg {
  width: 40px;
  height: 40px;
  font-size: var(--font-size-sm);
}

/* Select/dropdown */
.codex-select {
  appearance: none;
  padding: var(--space-2) var(--space-3);
  padding-right: var(--space-6);
  background: var(--surface-2);
  background-image: url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23868B95' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right var(--space-3) center;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.codex-select:hover {
  background-color: var(--surface-3);
  border-color: var(--border-emphasis);
}

.codex-select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(91, 141, 238, 0.15);
}

/* Icon button for toolbar */
.codex-icon-btn {
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
}

.codex-icon-btn:hover:not(:disabled) {
  background: var(--surface-3);
  color: var(--text-primary);
}

.codex-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Send button - special styling */
.codex-send-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  background: var(--accent-primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
}

.codex-send-btn:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(91, 141, 238, 0.4);
}

.codex-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.codex-send-btn[data-busy="true"] {
  background: var(--accent-error);
}

.codex-send-btn[data-busy="true"]:hover {
  background: #F5697D;
}

/* Spinner */
.codex-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--surface-4);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: codex-spin 0.8s linear infinite;
}

@keyframes codex-spin {
  to {
    transform: rotate(360deg);
  }
}

/* Divider */
.codex-divider {
  height: 1px;
  background: var(--border-subtle);
  border: none;
  margin: var(--space-4) 0;
}

/* Empty state */
.codex-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-12) var(--space-6);
  text-align: center;
  color: var(--text-tertiary);
}

.codex-empty-icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-xl);
  background: var(--surface-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
}

.codex-empty-title {
  font-size: var(--font-size-lg);
  font-weight: 500;
  color: var(--text-secondary);
}

.codex-empty-hint {
  max-width: 400px;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  color: var(--text-tertiary);
}

/* Attachment chip */
.codex-attachment {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  background: var(--surface-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.codex-attachment:hover {
  background: var(--surface-4);
  border-color: var(--border-emphasis);
}

.codex-attachment-icon {
  width: 14px;
  height: 14px;
  color: var(--accent-primary);
}

.codex-attachment-name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.codex-attachment-remove {
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-dim);
  border-radius: 50%;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: var(--space-1);
}

.codex-attachment-remove:hover {
  background: var(--surface-4);
  color: var(--text-primary);
}

/* Utility classes */
.flex {
  display: flex;
}

.flex-col {
  flex-direction: column;
}

.items-center {
  align-items: center;
}

.justify-center {
  justify-content: center;
}

.gap-2 {
  gap: var(--space-2);
}

.gap-3 {
  gap: var(--space-3);
}

.gap-4 {
  gap: var(--space-4);
}

.flex-1 {
  flex: 1;
}

.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Sidebar styles - Codex inspired */
.codex-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--surface-0);
  border-right: 1px solid var(--border-subtle);
  transition: width var(--transition-base);
}

.codex-sidebar-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}

.codex-brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.codex-brand-mark {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-lg);
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
  flex-shrink: 0;
}

.codex-brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.codex-brand-name {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--text-primary);
}

.codex-brand-subtitle {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.codex-sidebar-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--space-3);
}

.codex-sidebar-section {
  margin-bottom: var(--space-5);
}

.codex-sidebar-section-title {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.codex-sidebar-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Workspace item */
.codex-workspace {
  display: flex;
  flex-direction: column;
}

.codex-workspace-header {
  display: grid;
  grid-template-columns: 20px 20px 1fr auto;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
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

.codex-workspace-header:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.codex-workspace-chevron {
  width: 16px;
  height: 16px;
  color: var(--text-dim);
  transition: transform var(--transition-fast);
}

.codex-workspace-chevron[data-expanded="true"] {
  transform: rotate(90deg);
}

.codex-workspace-icon {
  width: 16px;
  height: 16px;
  color: var(--accent-primary);
}

.codex-workspace-name {
  font-weight: 500;
  min-width: 0;
}

.codex-workspace-count {
  font-size: var(--font-size-xs);
  color: var(--text-dim);
}

/* Session list */
.codex-sessions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: var(--space-1) 0 var(--space-2) 0;
  padding-left: calc(var(--space-3) + 20px);
  border-left: 1px solid var(--border-subtle);
  margin-left: calc(var(--space-3) + 10px);
}

.codex-session {
  display: grid;
  grid-template-columns: 8px 1fr auto;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--font-size-sm);
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 0;
}

.codex-session:hover {
  background: var(--surface-2);
  color: var(--text-primary);
}

.codex-session[data-active="true"] {
  background: var(--surface-3);
  color: var(--text-primary);
  box-shadow: var(--shadow-subtle);
}

.codex-session-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

.codex-session[data-state="running"] .codex-session-dot {
  color: var(--accent-success);
  animation: codex-pulse 2s ease-in-out infinite;
}

.codex-session[data-state="idle"] .codex-session-dot {
  color: var(--text-dim);
}

.codex-session[data-state="error"] .codex-session-dot {
  color: var(--accent-error);
}

.codex-session-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.codex-session-badge {
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  background: var(--surface-4);
  border-radius: var(--radius-sm);
  color: var(--text-dim);
}

/* Sidebar footer */
.codex-sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-top: 1px solid var(--border-subtle);
  background: var(--surface-0);
}

.codex-sidebar-footer .codex-button {
  width: 100%;
  justify-content: flex-start;
}

/* Scrollbar for sidebar */
.codex-sidebar-content::-webkit-scrollbar {
  width: 6px;
}

.codex-sidebar-content::-webkit-scrollbar-track {
  background: transparent;
}

.codex-sidebar-content::-webkit-scrollbar-thumb {
  background: var(--surface-3);
  border-radius: var(--radius-pill);
}

.codex-sidebar-content::-webkit-scrollbar-thumb:hover {
  background: var(--surface-4);
}

/* Collapsed sidebar */
.codex-sidebar[data-collapsed="true"] .codex-brand-text,
.codex-sidebar[data-collapsed="true"] .codex-sidebar-section-title,
.codex-sidebar[data-collapsed="true"] .codex-workspace-name,
.codex-sidebar[data-collapsed="true"] .codex-workspace-count,
.codex-sidebar[data-collapsed="true"] .codex-sessions,
.codex-sidebar[data-collapsed="true"] .codex-sidebar-footer .codex-button span {
  display: none;
}

.codex-sidebar[data-collapsed="true"] {
  width: var(--sidebar-collapsed);
}
`;
