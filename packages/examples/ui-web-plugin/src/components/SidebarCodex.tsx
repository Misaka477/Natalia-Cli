import { For, Show, createSignal } from "solid-js";
import type { NavWorkspace } from "../types";

export interface SidebarCodexProps {
  workspaces: NavWorkspace[];
  currentSessionId?: string;
  collapsed?: boolean;
  onSelectSession?: (sessionId: string) => void;
  onNewSession?: () => void;
  onToggleCollapse?: () => void;
}

export function SidebarCodex(props: SidebarCodexProps) {
  const [expandedWorkspaces, setExpandedWorkspaces] = createSignal<Set<string>>(
    new Set(props.workspaces.map((w) => w.id))
  );

  function toggleWorkspace(workspaceId: string) {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) {
        next.delete(workspaceId);
      } else {
        next.add(workspaceId);
      }
      return next;
    });
  }

  return (
    <aside class="codex-sidebar" data-collapsed={props.collapsed}>
      <div class="codex-sidebar-header">
        <div class="codex-brand">
          <div class="codex-brand-mark" />
          <div class="codex-brand-text">
            <div class="codex-brand-name">Natalia</div>
            <div class="codex-brand-subtitle">工程智能</div>
          </div>
        </div>
        <button
          type="button"
          class="codex-button codex-button-primary"
          onClick={() => props.onNewSession?.()}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M7 1V13M1 7H13"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <span>新建会话</span>
        </button>
      </div>

      <div class="codex-sidebar-content">
        <div class="codex-sidebar-section">
          <div class="codex-sidebar-section-title">工作区</div>
          <nav class="codex-sidebar-tree">
            <For each={props.workspaces}>
              {(workspace) => (
                <div class="codex-workspace">
                  <button
                    type="button"
                    class="codex-workspace-header"
                    onClick={() => toggleWorkspace(workspace.id)}
                  >
                    <svg
                      class="codex-workspace-chevron"
                      data-expanded={expandedWorkspaces().has(workspace.id)}
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M6 4L10 8L6 12"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                    <svg class="codex-workspace-icon" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M2 5C2 3.89543 2.89543 3 4 3H5.58579C6.11622 3 6.62493 3.21071 7 3.58579L7.41421 4C7.78929 4.37507 8.29799 4.58579 8.82843 4.58579H12C13.1046 4.58579 14 5.48122 14 6.58579V11C14 12.1046 13.1046 13 12 13H4C2.89543 13 2 12.1046 2 11V5Z"
                        stroke="currentColor"
                        stroke-width="1.5"
                      />
                    </svg>
                    <span class="codex-workspace-name">{workspace.name}</span>
                    <span class="codex-workspace-count">{workspace.sessions.length}</span>
                  </button>
                  <Show when={expandedWorkspaces().has(workspace.id)}>
                    <div class="codex-sessions">
                      <For each={workspace.sessions}>
                        {(session) => (
                          <button
                            type="button"
                            class="codex-session"
                            data-active={session.id === props.currentSessionId}
                            data-state={session.state}
                            onClick={() => props.onSelectSession?.(session.id)}
                          >
                            <span class="codex-session-dot" />
                            <span class="codex-session-title">{session.title}</span>
                            <span class="codex-session-badge">{session.state}</span>
                          </button>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </nav>
        </div>
      </div>

      <div class="codex-sidebar-footer">
        <button type="button" class="codex-button codex-button-ghost codex-button-sm">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2Z"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M8 5V8L10.5 10.5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
          <span>历史记录</span>
        </button>
        <button type="button" class="codex-button codex-button-ghost codex-button-sm">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M13 8C13 8 11 4 8 4C5 4 3 8 3 8C3 8 5 12 8 12C11 12 13 8 13 8Z"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
          <span>设置</span>
        </button>
      </div>
    </aside>
  );
}
